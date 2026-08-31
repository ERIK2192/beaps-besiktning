// The gallery's table of contents.  GET /api/media-list?t=<token>
import { loadGallery, kv, manifestKey, NO_STORE } from '../../cflib/media.js';

export async function onRequest(context) {
  const { request, env } = context;
  const { fel, token, manifest } = await loadGallery(env, new URL(request.url));
  if (fel) return fel;

  // Uploaded files are marked with their own key per file (see media-put). List them and cross-reference
  // against the manifest, so we avoid rewriting the manifest per file and its KV write ceiling.
  const prefix = manifestKey(token) + '/up/';
  let done = new Set();
  try {
    const up = await kv(env).list({ prefix });
    done = new Set((up.keys || []).map(k => k.name.slice(prefix.length)));
  } catch (e) {}

  return Response.json({
    ref: manifest.ref, type: manifest.type, address: manifest.address, apt: manifest.apt,
    inspector: manifest.inspector, created: manifest.created, expires: manifest.expires,
    items: manifest.items.filter(i => done.has(i.id))
      .map(i => ({ id: i.id, name: i.name, kind: i.kind, ts: i.ts })),
    saknas: manifest.items.filter(i => !done.has(i.id)).length
  }, { headers: NO_STORE });
}
