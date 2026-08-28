// Galleriets innehallsforteckning.  GET /api/media-list?t=<token>
import { loadGallery, NO_STORE } from '../../cflib/media.js';

export async function onRequest(context) {
  const { request, env } = context;
  const { fel, manifest } = await loadGallery(env, new URL(request.url));
  if (fel) return fel;

  return Response.json({
    ref: manifest.ref, type: manifest.type, address: manifest.address, apt: manifest.apt,
    inspector: manifest.inspector, created: manifest.created, expires: manifest.expires,
    items: manifest.items.filter(i => i.uploaded)
      .map(i => ({ id: i.id, name: i.name, kind: i.kind, ts: i.ts, size: i.size || null })),
    saknas: manifest.items.filter(i => !i.uploaded).length
  }, { headers: NO_STORE });
}
