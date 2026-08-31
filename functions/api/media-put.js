// Receives a file into the gallery. The body is raw bytes, not JSON - the images are
// large and base64 would have made them a third bigger in transit.
//   PUT /api/media-put?t=<token>&id=<id>
import { MAX_FIL, GALLERI_DAGAR, cleanId, loadGallery, kv, manifestKey, r2, fileKey, typeFor, NO_STORE, appOk } from '../../cflib/media.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'PUT' && request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!appOk(request)) return new Response('Reload the app', { status: 401 });

  const url = new URL(request.url);
  const { fel, token, manifest } = await loadGallery(env, url);
  if (fel) return fel;

  const id = cleanId(url.searchParams.get('id'));
  const post = manifest.items.find(i => i.id === id);
  if (!post) return new Response('Unknown file in the gallery', { status: 404 });

  const langd = Number(request.headers.get('content-length') || 0);
  if (langd > MAX_FIL) return new Response('The file is too large', { status: 413 });

  // Use the file's real type (the client sends it) so video plays in the recipient's
  // browser. Only if it's missing/generic do we fall back to guessing from the name.
  const ct = request.headers.get('content-type') || '';
  // Validate the base type but keep the full value (e.g. 'video/webm;codecs=vp9') so playback works.
  const base = ct.split(';')[0].trim().toLowerCase();
  const type = /^(image|video)\/[a-z0-9.+-]+$/i.test(base) ? ct : typeFor(post.kind, post.name);
  try {
    await r2(env).put(fileKey(token, id), request.body, {
      httpMetadata: { contentType: type, cacheControl: 'private, max-age=3600' }
    });
  } catch (e) {
    return new Response('Could not store the file: ' + String(e.message).slice(0, 160), { status: 502 });
  }

  // Mark as uploaded with its OWN key per file, instead of rewriting the manifest.
  // KV allows only 1 write/second/key; rewriting the manifest for every file dropped
  // markings when images were uploaded in a row, so images went silent from the gallery. Distinct
  // keys have no such ceiling.
  try { await kv(env).put(manifestKey(token) + '/up/' + id, String(langd || 0), { expirationTtl: GALLERI_DAGAR * 86400 }); } catch (e) {}

  return Response.json({ ok: true }, { headers: NO_STORE });
}
