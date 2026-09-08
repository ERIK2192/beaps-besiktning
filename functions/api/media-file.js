// Serves a file from the gallery.  GET /api/media-file?t=<token>&id=<id>
//
// The video needs Range support, otherwise iOS Safari refuses to play it.
import { cleanId, loadGallery, r2, fileKey } from '../../cflib/media.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const { fel, token, manifest } = await loadGallery(env, url);
  if (fel) return fel;

  const id = cleanId(url.searchParams.get('id'));
  if (!id) return new Response('File not found', { status: 404 });
  // A photo uploaded while the inspection was still running is not in the manifest at all, so
  // the manifest cannot be the gatekeeper. The R2 fetch below is the real check and answers
  // 404 when the file does not exist. The token, which is 48 random characters, is the lock.
  const post = manifest.items.find(i => i.id === id) || null;

  const range = request.headers.get('range');
  let obj;
  try {
    obj = await r2(env).get(fileKey(token, id), range ? { range: request.headers } : undefined);
  } catch (e) {
    return new Response('Could not fetch the file', { status: 502 });
  }
  if (!obj) return new Response('File not found', { status: 404 });

  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  h.set('Cache-Control', 'private, max-age=3600');
  h.set('X-Robots-Tag', 'noindex, nofollow');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Accept-Ranges', 'bytes');
  h.set('Content-Disposition',
    'inline; filename="' + String((post && post.name) || id).replace(/["\\\r\n]/g, '').replace(/[^\x20-\x7E]/g, '_') + '"');

  if (obj.range && obj.size != null) {
    const start = obj.range.offset || 0;
    const len = obj.range.length != null ? obj.range.length : obj.size - start;
    h.set('Content-Range', `bytes ${start}-${start + len - 1}/${obj.size}`);
    return new Response(obj.body, { status: 206, headers: h });
  }
  return new Response(obj.body, { headers: h });
}
