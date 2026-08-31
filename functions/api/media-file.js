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
  // the uploaded flag is no longer in the manifest; the R2 fetch below is the real
  // check and returns 404 if the file doesn't exist.
  const post = manifest.items.find(i => i.id === id);
  if (!post) return new Response('File not found', { status: 404 });

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
    'inline; filename="' + String(post.name || id).replace(/["\\\r\n]/g, '').replace(/[^\x20-\x7E]/g, '_') + '"');

  if (obj.range && obj.size != null) {
    const start = obj.range.offset || 0;
    const len = obj.range.length != null ? obj.range.length : obj.size - start;
    h.set('Content-Range', `bytes ${start}-${start + len - 1}/${obj.size}`);
    return new Response(obj.body, { status: 206, headers: h });
  }
  return new Response(obj.body, { headers: h });
}
