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
  if (!id) return new Response('File id missing', { status: 400 });

  // A photo may arrive while the inspection is still going on, long before it is listed in the
  // manifest. Take it anyway and read its description off the query. Making a photo wait for the
  // report to be finished is how a whole inspection was lost once.
  const post = manifest.items.find(i => i.id === id) || null;
  const namn = String(url.searchParams.get('name') || (post && post.name) || '').slice(0, 120);
  const kind = (url.searchParams.get('kind') || (post && post.kind) || 'bild') === 'video' ? 'video' : 'bild';
  const ts = Number(url.searchParams.get('ts')) || (post && post.ts) || null;

  const langd = Number(request.headers.get('content-length') || 0);
  if (langd > MAX_FIL) return new Response('The file is too large', { status: 413 });

  // Use the file's real type (the client sends it) so video plays in the recipient's
  // browser. Only if it's missing/generic do we fall back to guessing from the name.
  const ct = request.headers.get('content-type') || '';
  // Validate the base type but keep the full value (e.g. 'video/webm;codecs=vp9') so playback works.
  const base = ct.split(';')[0].trim().toLowerCase();
  const type = /^(image|video)\/[a-z0-9.+-]+$/i.test(base) ? ct : typeFor(kind, namn);
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
  // The description rides along as KV metadata, which list() hands back without a read per file.
  // That is what lets a photo uploaded mid-inspection show up in the gallery with its room name.
  try {
    await kv(env).put(manifestKey(token) + '/up/' + id, String(langd || 0),
      { expirationTtl: GALLERI_DAGAR * 86400, metadata: { name: namn, kind, ts } });
  } catch (e) {}

  return Response.json({ ok: true }, { headers: NO_STORE });
}
