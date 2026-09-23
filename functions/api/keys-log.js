// The shared key ledger.
//   GET /api/keys-log  -> { ok, events:[{id, bundle, kind, who, reason, name, ts}], state:[...] }
//
// One list call reads every entry's metadata, so this is a single round trip however many
// check-outs there have been. `events` is the recent tail, newest first - enough for the
// "Latest" list. `state` is a different cut of the same read: the last event per bundle,
// over everything the scan saw, so a bundle checked out long before the tail's cutoff and
// never checked back in is never lost from the phones' idea of what is out.
//
// Guarded by the same app key as the writing endpoints. That is a soft guard - the key
// ships inside the client - and it is worth being honest about what it is for: it keeps
// the endpoint from being trivially scraped, not from a determined reader. The log holds
// bundle numbers, apartment names and staff names; an address appears only in a hand-over
// to an apartment the register does not know yet. Real protection would be Cloudflare
// Access in front of the app.
import { kv, appOk, NO_STORE } from '../../cflib/media.js';

const PREFIX = 'kev/';
const PAGE = 1000;
const MAX_RETURNED = 500;
// KV lists this prefix oldest-first (the key is a zero-padded timestamp), so stopping
// early would drop the newest events - which is what the old 5000-event guard did once
// the log grew past it. Read everything; the page cap is only there to stop a runaway
// loop, and at 1000 events a page it sits far beyond three years of check-outs.
const MAX_PAGES = 200;

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  if (!appOk(request)) return new Response('Reload the app', { status: 401 });

  const events = [];
  let cursor, pages = 0;
  try {
    do {
      const page = await kv(env).list({ prefix: PREFIX, limit: PAGE, cursor });
      for (const k of page.keys) if (k.metadata) events.push(k.metadata);
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor && ++pages < MAX_PAGES);
  } catch (e) {
    return new Response('Could not read the log: ' + String(e.message).slice(0, 140), { status: 502 });
  }

  // The last event per bundle, whatever it is, is "where is 112:3 right now" - and it has
  // to survive even for a bundle whose last event fell out of the 500-row tail below.
  const last = {};
  // The list is in key order - timestamp, then id - so on a tie the later id wins, which is
  // the same rule the phones apply. >= makes that the case.
  for (const e of events) if (!last[e.bundle] || (e.ts || 0) >= (last[e.bundle].ts || 0)) last[e.bundle] = e;

  events.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return Response.json({
    ok: true,
    events: events.slice(0, MAX_RETURNED),
    state: Object.values(last)
  }, { headers: NO_STORE });
}
