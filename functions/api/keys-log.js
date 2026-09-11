// The shared key ledger, newest first.
//   GET /api/keys-log  -> { ok, events:[{id, bundle, kind, who, reason, name, ts}] }
//
// One list call returns every entry with its metadata, so this is a single round trip
// however many check-outs there have been.
//
// Guarded by the same app key as the writing endpoints. That is a soft guard - the key
// ships inside the client - and it is worth being honest about what it is for: it keeps
// the endpoint from being trivially scraped, not from a determined reader. The log holds
// bundle numbers, apartment names and staff names, never an address. Real protection
// would be Cloudflare Access in front of the app.
import { kv, appOk, NO_STORE } from '../../cflib/media.js';

const PREFIX = 'kev/';
const PAGE = 1000;
const MAX_RETURNED = 500;

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  if (!appOk(request)) return new Response('Reload the app', { status: 401 });

  const events = [];
  let cursor;
  try {
    do {
      const page = await kv(env).list({ prefix: PREFIX, limit: PAGE, cursor });
      for (const k of page.keys) if (k.metadata) events.push(k.metadata);
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor && events.length < 5000);
  } catch (e) {
    return new Response('Could not read the log: ' + String(e.message).slice(0, 140), { status: 502 });
  }

  events.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return Response.json({ ok: true, events: events.slice(0, MAX_RETURNED) }, { headers: NO_STORE });
}
