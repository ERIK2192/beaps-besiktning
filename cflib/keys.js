// The key ledger's storage (2026-10-07). Built so that reading it never gets slower or dearer
// as the history grows - with about 500 bundles the old layout, one list of every event ever,
// would have run into Cloudflare's daily list limit within months.
//
// Three kinds of entry, all in the SIGNSTORE KV namespace:
//
//   kevr/<rev ts>-<id>  one per event, the event in the key's metadata. The time is written
//                       backwards (9999999999999 - ts), so a list comes back NEWEST FIRST and
//                       the log can be read a page at a time from the top. Only the key log
//                       page reads these, and only the page it is showing.
//   kst/<bundle>        one per bundle: metadata = the event that decides where it is now,
//                       value = that bundle's last 30 events. "Where is every bundle" is one
//                       list call over ~500 entries, however long the history; a bundle's own
//                       history is one read.
//   kev/<ts>-<id>       the original layout, oldest first. No longer written. Copied once into
//                       the two above (migrate) and otherwise left alone.
//
// Three years on every entry, as before (Erik: fine). A bundle's kst entry is rewritten on every
// event, so only a bundle nobody has touched for three years loses its record.

export const KEEP = 3 * 365 * 86400;
export const HIST = 30;
const REV = 9999999999999;
export const revKey = (ts, id) => 'kevr/' + String(REV - Math.max(0, Math.min(REV, Number(ts) || 0))).padStart(13, '0') + '-' + id;
export const stKey = bundle => 'kst/' + bundle;
export const MIGRATED = 'kmeta/v2';

// "Empty the key log" (2026-10-14, before real use): nothing is deleted. The time of the reset is
// kept here, and everything stamped before it is left out of every read - the bundles show in
// the cabinet and the log starts over. Removing the key brings it all back.
export const EPOCH = 'kmeta/epoch';
export async function readEpoch(kv) {
  try { return Number(await kv.get(EPOCH)) || 0 } catch (e) { return 0 }
}

// The same rule the phones use: the later time wins; on a tie, the larger id.
export const later = (a, b) => !b || a.ts > b.ts || (a.ts === b.ts && String(a.id) > String(b.id));

// Only these say where a bundle is. 'edit' (an admin changed the register entry) is history
// and log, never a position (2026-10-13).
export const STATUS_KINDS = ['out', 'in', 'place'];
const placing = e => STATUS_KINDS.includes(e && e.kind);

// A phone number as typed, minus anything that is not part of one.
export const cleanPhone = s => String(s == null ? '' : s).slice(0, 24).replace(/[^0-9+ ()-]/g, '').trim();

// An e-mail address for the person who has a bundle (2026-10-14): optional; anything that does
// not look like one is dropped rather than stored half-right.
export const cleanEmail = s => { const e = String(s == null ? '' : s).trim().slice(0, 80); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : '' };

// KV metadata holds at most 1024 bytes. An event full of long Swedish text could pass that, so
// the free-text fields are shortened, least important first, until it fits.
const bytes = o => new TextEncoder().encode(JSON.stringify(o)).length;
export function fitMeta(e, max = 1000) {
  const out = { ...e };
  for (const f of ['note', 'reason', 'from', 'email', 'place', 'unit', 'guest', 'holder', 'name', 'who']) {
    while (bytes(out) > max && typeof out[f] === 'string' && out[f]) out[f] = out[f].slice(0, Math.floor(out[f].length * 0.7));
  }
  return out;
}

// Folds events into their bundles' kst entries: one read and one write per bundle touched.
// Idempotent - an event already in the history is not added twice - so a retry, or the
// migration running over events a phone has meanwhile written, changes nothing.
export async function foldState(kv, events) {
  const byBundle = {};
  for (const e of events) (byBundle[e.bundle] = byBundle[e.bundle] || []).push(e);
  for (const bundle of Object.keys(byBundle)) {
    const key = stKey(bundle);
    let cur = null;
    try { const r = await kv.getWithMetadata(key, { type: 'json' }); cur = r && r.value } catch (e) {}
    const hist = Array.isArray(cur && cur.hist) ? cur.hist : [];
    const seen = new Set(hist.map(e => e.id));
    let last = cur && cur.last || null, changed = false;
    for (const e of byBundle[bundle]) {
      if (!seen.has(e.id)) { hist.push(e); seen.add(e.id); changed = true }
      if (placing(e) && later(e, last)) { last = e; changed = true }
    }
    if (!changed) continue;
    hist.sort((a, b) => later(a, b) ? -1 : 1);
    // No metadata without a position: the state list skips the bundle, as for one never moved.
    await kv.put(key, JSON.stringify({ last, hist: hist.slice(0, HIST) }), last ? { metadata: last, expirationTtl: KEEP } : { expirationTtl: KEEP });
  }
}

// One event into the ledger: its own newest-first entry, and its bundle's state.
export async function record(kv, events) {
  events = events.map(e => fitMeta(e));
  for (const e of events) await kv.put(revKey(e.ts, e.id), '1', { metadata: e, expirationTtl: KEEP });
  await foldState(kv, events);
}

// Copies the old oldest-first log into the new layout, once. Runs from the log endpoint the
// first time it is asked for anything; at most `budget` events per call, so a long old log is
// moved over a few calls instead of blowing one request's limits. Progress is kept in the
// marker: the last kev key copied.
export async function migrate(kv, budget = 250) {
  let mark = null;
  try { mark = await kv.get(MIGRATED, { type: 'json' }) } catch (e) {}
  if (mark && mark.done) return true;
  const after = mark && mark.after || '';
  const batch = [];
  let cursor, lastKey = after, complete = false;
  do {
    const page = await kv.list({ prefix: 'kev/', limit: 1000, cursor });
    for (const k of page.keys) {
      if (k.name <= after || !k.metadata) continue;
      if (batch.length >= budget) break;
      batch.push(k.metadata); lastKey = k.name;
    }
    complete = page.list_complete;
    cursor = complete ? null : page.cursor;
  } while (cursor && batch.length < budget);
  if (batch.length) await record(kv, batch);
  const done = complete && batch.length < budget;
  await kv.put(MIGRATED, JSON.stringify(done ? { done: true, at: Date.now() } : { after: lastKey }));
  return done;
}
