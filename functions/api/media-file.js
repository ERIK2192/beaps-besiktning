// Serverar en fil ur galleriet.  GET /api/media-file?t=<token>&id=<id>
//
// Videon behover Range-stod, annars vagrar iOS Safari spela upp den.
import { cleanId, loadGallery, r2, fileKey } from '../../cflib/media.js';

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const { fel, token, manifest } = await loadGallery(env, url);
  if (fel) return fel;

  const id = cleanId(url.searchParams.get('id'));
  const post = manifest.items.find(i => i.id === id && i.uploaded);
  if (!post) return new Response('Filen finns inte', { status: 404 });

  const range = request.headers.get('range');
  let obj;
  try {
    obj = await r2(env).get(fileKey(token, id), range ? { range: request.headers } : undefined);
  } catch (e) {
    return new Response('Kunde inte hamta filen', { status: 502 });
  }
  if (!obj) return new Response('Filen finns inte', { status: 404 });

  const h = new Headers();
  obj.writeHttpMetadata(h);
  h.set('etag', obj.httpEtag);
  h.set('Cache-Control', 'private, max-age=3600');
  h.set('X-Robots-Tag', 'noindex, nofollow');
  h.set('Accept-Ranges', 'bytes');
  h.set('Content-Disposition',
    'inline; filename="' + String(post.name || id).replace(/["\\\r\n]/g, '') + '"');

  if (obj.range && obj.size != null) {
    const start = obj.range.offset || 0;
    const len = obj.range.length != null ? obj.range.length : obj.size - start;
    h.set('Content-Range', `bytes ${start}-${start + len - 1}/${obj.size}`);
    return new Response(obj.body, { status: 206, headers: h });
  }
  return new Response(obj.body, { headers: h });
}
