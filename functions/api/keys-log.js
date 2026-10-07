// The shared key ledger, read in the pieces a screen actually needs (2026-10-07).
//
//   GET /api/keys-log?view=state                 -> { ok, state }   where every bundle is now
//   GET /api/keys-log?view=events[&cursor=][&limit=]
//                                                -> { ok, events, cursor }  the log, newest first,
//                                                   one page; cursor is null on the last page
//   GET /api/keys-log?view=hist&bundle=112:3     -> { ok, events }  one bundle's last 30 events
//   GET /api/keys-log                            -> { ok, events, state }  what an app from before
//                                                   this change asks for: the newest 200 + state
//
// None of these reads more than it returns. "Where is everything" is one list over ~500
// entries (cflib/keys.js keeps one per bundle); the log is read a page at a time from the top
// and only by the key log page. The phones fetch nothing in the background: state when someone
// opens the scanner or a bundle, the log when someone opens the log.
//
// Guarded by the login wall in front of the app, and by the app key as well.
import { kv, appOk, NO_STORE } from '../../cflib/media.js';
import { migrate } from '../../cflib/keys.js';

const OK_BUNDLE = /^[A-Za-z0-9:_-]{1,32}$/;

async function listAll(store, prefix, max) {
  const out = [];
  let cursor, pages = 0;
  do {
    const page = await store.list({ prefix, limit: 1000, cursor });
    for (const k of page.keys) if (k.metadata) out.push(k.metadata);
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor && ++pages < max);
  return out;
}
async function eventsPage(store, cursor, limit) {
  const page = await store.list({ prefix: 'kevr/', limit, cursor: cursor || undefined });
  return { events: page.keys.map(k => k.metadata).filter(Boolean), cursor: page.list_complete ? null : page.cursor };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  if (!appOk(request)) return new Response('Reload the app', { status: 401 });

  const u = new URL(request.url);
  const view = u.searchParams.get('view') || '';
  const store = kv(env);
  try {
    // The old oldest-first log is copied into the new layout the first time anyone asks;
    // after that this is one read of a marker.
    await migrate(store);

    if (view === 'state') {
      return Response.json({ ok: true, state: await listAll(store, 'kst/', 5) }, { headers: NO_STORE });
    }
    if (view === 'events') {
      const limit = Math.max(1, Math.min(200, Number(u.searchParams.get('limit')) || 50));
      const p = await eventsPage(store, u.searchParams.get('cursor'), limit);
      return Response.json({ ok: true, events: p.events, cursor: p.cursor }, { headers: NO_STORE });
    }
    if (view === 'hist') {
      const bundle = u.searchParams.get('bundle') || '';
      if (!OK_BUNDLE.test(bundle)) return new Response('Bad bundle', { status: 400 });
      const v = await store.get('kst/' + bundle, { type: 'json' });
      return Response.json({ ok: true, events: (v && Array.isArray(v.hist)) ? v.hist : [] }, { headers: NO_STORE });
    }
    // An app from before this change: the newest 200 and the state, in two list calls.
    const p = await eventsPage(store, null, 200);
    return Response.json({ ok: true, events: p.events, state: await listAll(store, 'kst/', 5) }, { headers: NO_STORE });
  } catch (e) {
    return new Response('Could not read the log: ' + String(e && e.message).slice(0, 140), { status: 502 });
  }
}
