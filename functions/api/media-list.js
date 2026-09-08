// The gallery's table of contents.  GET /api/media-list?t=<token>
import { loadGallery, kv, manifestKey, NO_STORE } from '../../cflib/media.js';

export async function onRequest(context) {
  const { request, env } = context;
  const { fel, token, manifest } = await loadGallery(env, new URL(request.url));
  if (fel) return fel;

  // Uploaded files are marked with their own key per file (see media-put). List them and cross-reference
  // against the manifest, so we avoid rewriting the manifest per file and its KV write ceiling.
  const prefix = manifestKey(token) + '/up/';
  const uppe = new Map();
  try {
    let cursor;
    for (;;) {
      const up = await kv(env).list({ prefix, cursor });
      for (const k of (up.keys || [])) uppe.set(k.name.slice(prefix.length), k.metadata || null);
      if (up.list_complete || !up.cursor) break;
      cursor = up.cursor;
    }
  } catch (e) {}

  // The uploaded files are the truth. A photo sent while the inspection was still running is not
  // in the manifest at all, and carries its description in its own metadata instead.
  const iManifest = new Map((manifest.items || []).map(i => [i.id, i]));
  const items = [];
  for (const [id, md] of uppe) {
    const m = iManifest.get(id) || {};
    items.push({
      id,
      name: (md && md.name) || m.name || '',
      kind: ((md && md.kind) || m.kind) === 'video' ? 'video' : 'bild',
      ts: (md && md.ts) || m.ts || null
    });
  }
  items.sort((a, b) => (a.ts || 0) - (b.ts || 0));

  return Response.json({
    ref: manifest.ref, type: manifest.type, address: manifest.address, apt: manifest.apt,
    inspector: manifest.inspector, created: manifest.created, expires: manifest.expires,
    items,
    saknas: (manifest.items || []).filter(i => !uppe.has(i.id)).length
  }, { headers: NO_STORE });
}
