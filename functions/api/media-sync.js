// Tidies the gallery to the photos the inspector actually kept.
//   POST /api/media-sync  { t, ids:[...] }
//
// Photos are copied to the server while the inspection is still running, so a photo that was
// taken and then deleted may already be up here. Without this it would show up in the
// recipient's gallery, which is the opposite of what deleting it meant.
import { cleanId, loadGallery, kv, manifestKey, r2, fileKey, writeManifest, NO_STORE, appOk } from '../../cflib/media.js';
import { dbxOn, dbxPath, moveFolder, sharedLink } from '../../cflib/dropbox.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!appOk(request)) return new Response('Reload the app', { status: 401 });

  let b;
  try { b = await request.json() } catch { return new Response('Bad request', { status: 400 }) }

  const url = new URL(request.url);
  url.searchParams.set('t', b.t || '');
  const { fel, token, manifest } = await loadGallery(env, url);
  if (fel) return fel;

  const keep = new Set((Array.isArray(b.ids) ? b.ids : []).map(cleanId).filter(Boolean));
  // An empty list is refused rather than obeyed. A gallery is only ever tidied down to the
  // photos that remain, never emptied, so a bug on the phone cannot erase the one copy that
  // exists off it.
  if (!keep.size) return new Response('No photos listed', { status: 400 });

  const prefix = manifestKey(token) + '/up/';
  let bort = 0;
  try {
    let cursor;
    for (;;) {
      const up = await kv(env).list({ prefix, cursor });
      for (const k of (up.keys || [])) {
        const id = k.name.slice(prefix.length);
        if (keep.has(id)) continue;
        try { await r2(env).delete(fileKey(token, id)) } catch (e) {}
        try { await kv(env).delete(k.name) } catch (e) {}
        bort++;
      }
      if (up.list_complete || !up.cursor) break;
      cursor = up.cursor;
    }
  } catch (e) {
    return new Response('Could not tidy the gallery: ' + String(e.message).slice(0, 120), { status: 502 });
  }

  // The address or the tenant's name may have been corrected after the folder was created.
  // Rename it so the filing matches the report, and take a fresh share link, because a Dropbox
  // link does not reliably survive a move.
  let dropbox = manifest.dropbox || null;
  if (dbxOn(env) && dropbox && dropbox.path && b.subfolder && b.subfolder !== dropbox.subfolder) {
    const to = dbxPath(env, b.subfolder);
    if (to && to !== dropbox.path) {
      try {
        if (await moveFolder(env, dropbox.path, to)) {
          dropbox = { path: to, subfolder: String(b.subfolder).slice(0, 200), url: await sharedLink(env, to) };
          await writeManifest(env, token, Object.assign({}, manifest, { dropbox }));
        }
      } catch (e) {}
    }
  }

  return Response.json({ ok: true, removed: bort, kept: keep.size, dropbox }, { headers: NO_STORE });
}
