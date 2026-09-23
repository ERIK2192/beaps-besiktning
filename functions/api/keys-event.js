// Records a check-out, a check-in or a hand-over in the shared key ledger.
//   POST /api/keys-event  { events:[{id, bundle, kind:'out'|'in'|'place', who, reason, name, ts, from, apt, place, guest}] }
//   -> { ok, saved:[id] }
//
// Three kinds. 'out': someone took the bundle (from the cabinet, or over from a colleague,
// or up from an apartment - `from` says which when it was not the cabinet). 'in': it is
// back in the cabinet. 'place': it was left in an apartment or with a guest - `apt` is the
// object number (112 in 112:3), `place` the label the log shows ("lgh 1102 TÄRNA"), `guest`
// the guest's name; any of the three may be empty. Where a bundle is right now is always
// the last of these for it, whichever kind.
//
// Every event is a KV entry of its own. That matters: if the whole log lived under one key,
// two phones writing in the same minute would overwrite each other and one check-out would
// simply vanish. Separate keys cannot collide.
//
// The event rides in the key's metadata rather than its value, so the whole log comes back
// from a single list call instead of one read per entry.
//
// The key ends with the id the phone generated, so sending the same event twice - which is
// exactly what happens when a flaky connection retries - writes the same key twice instead
// of making a duplicate.
import { kv, appOk, NO_STORE, clip } from '../../cflib/media.js';

export const PREFIX = 'kev/';
const KEEP = 3 * 365 * 86400;          // three years; a key ledger is worth keeping
const MAX_BATCH = 50;
const KINDS = ['out', 'in', 'place'];
const stampKey = ts => String(ts).padStart(13, '0');   // so listing comes back in time order

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!appOk(request)) return new Response('Reload the app', { status: 401 });

  let body;
  try { body = await request.json() } catch { return new Response('Bad request', { status: 400 }) }

  const list = Array.isArray(body.events) ? body.events : [body];
  if (!list.length) return new Response('No events', { status: 400 });
  if (list.length > MAX_BATCH) return new Response('Too many events at once', { status: 413 });

  const saved = [];
  for (const raw of list) {
    const bundle = clip(raw.bundle, 32).trim();
    const kind = KINDS.includes(raw.kind) ? raw.kind : null;
    const who = clip(raw.who, 60).trim();
    // A line without a bundle, a direction or a name says nothing. Skip it rather than
    // store a row nobody can act on. A bundle number looks like 112:3 or 112:EXTRA;
    // anything outside that alphabet is not a tag, and it must never reach a phone's
    // screen, where the number is written straight into the page.
    if (!bundle || !kind || !who || !/^[A-Za-z0-9:_-]+$/.test(bundle)) continue;

    const ts = Number(raw.ts) || Date.now();
    const id = clip(raw.id, 24).replace(/[^a-zA-Z0-9_-]/g, '') ||
               [...crypto.getRandomValues(new Uint8Array(6))].map(b => b.toString(16).padStart(2, '0')).join('');

    const event = {
      id, bundle, kind, who, ts,
      reason: clip(raw.reason, 80),
      name: clip(raw.name, 40),          // apartment name, so the log reads without the register
      from: clip(raw.from, 60),          // where it came from, when that was not the cabinet
      // a hand-over: the apartment (object number and label), the guest, or both
      apt: clip(raw.apt, 16).replace(/[^A-Za-z0-9_-]/g, ''),
      place: clip(raw.place, 60),
      guest: clip(raw.guest, 60)
    };

    try {
      await kv(env).put(PREFIX + stampKey(ts) + '-' + id, '1', {
        metadata: event,
        expirationTtl: KEEP
      });
      saved.push(id);
    } catch (e) {
      return new Response('Could not write to the log: ' + String(e.message).slice(0, 140), { status: 502 });
    }
  }

  return Response.json({ ok: true, saved }, { headers: NO_STORE });
}
