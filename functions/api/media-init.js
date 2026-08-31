// Creates a gallery and returns its address.
//   POST /api/media-init  { ref, type, address, apt, inspector, items:[{id, name, kind}] }
//   -> { ok, token, url }
import { GALLERI_DAGAR, newToken, writeManifest, cleanId, NO_STORE, appOk, clip } from '../../cflib/media.js';

const MAX_POSTER = 600;

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!appOk(request)) return new Response('Reload the app', { status: 401 });

  let b;
  try { b = await request.json() } catch { return new Response('Bad request', { status: 400 }) }

  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) return new Response('No photos provided', { status: 400 });
  if (items.length > MAX_POSTER) return new Response('Too many files in one gallery', { status: 413 });

  const token = newToken();
  const now = Date.now();
  const manifest = {
    token, created: now, expires: now + GALLERI_DAGAR * 86400000,
    ref: clip(b.ref), type: clip(b.type), address: clip(b.address), apt: clip(b.apt),
    inspector: clip(b.inspector),
    items: items.map(i => ({
      id: cleanId(i.id),
      name: String(i.name || '').slice(0, 120),
      kind: i.kind === 'video' ? 'video' : 'bild',
      ts: Number(i.ts) || null,
      uploaded: false
    })).filter(i => i.id)
  };

  try { await writeManifest(env, token, manifest) }
  catch (e) { return new Response('Could not create the gallery: ' + String(e.message).slice(0, 160), { status: 502 }) }

  const url = new URL(request.url).origin + '/galleri.html?t=' + token;
  return Response.json({ ok: true, token, url, count: manifest.items.length }, { headers: NO_STORE });
}
