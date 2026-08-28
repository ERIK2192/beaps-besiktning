// Tar emot en fil till galleriet. Kroppen ar rena bytes, inte JSON - bilderna ar
// stora och base64 hade gjort dem en tredjedel storre pa vagen.
//   PUT /api/media-put?t=<token>&id=<id>
import { MAX_FIL, cleanId, loadGallery, writeManifest, r2, fileKey, typeFor, NO_STORE } from '../../cflib/media.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'PUT' && request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const url = new URL(request.url);
  const { fel, token, manifest } = await loadGallery(env, url);
  if (fel) return fel;

  const id = cleanId(url.searchParams.get('id'));
  const post = manifest.items.find(i => i.id === id);
  if (!post) return new Response('Okand fil i galleriet', { status: 404 });

  const langd = Number(request.headers.get('content-length') || 0);
  if (langd > MAX_FIL) return new Response('Filen ar for stor', { status: 413 });

  try {
    await r2(env).put(fileKey(token, id), request.body, {
      httpMetadata: { contentType: typeFor(post.kind, post.name), cacheControl: 'private, max-age=3600' }
    });
  } catch (e) {
    return new Response('Kunde inte lagra filen: ' + String(e.message).slice(0, 160), { status: 502 });
  }

  // Markera som uppladdad. Manifestet skrivs om vid varje fil, men det ar en liten
  // JSON och racker gott - alternativet vore ett extra anrop pa slutet som kan utebli.
  post.uploaded = true;
  post.size = langd || null;
  try { await writeManifest(env, token, manifest) } catch (e) {}

  const klara = manifest.items.filter(i => i.uploaded).length;
  return Response.json({ ok: true, uploaded: klara, total: manifest.items.length }, { headers: NO_STORE });
}
