// Register corrections made in the admin panel (2026-10-13). nycklar.js stays the base and is
// never rewritten; an entry here replaces that bundle's line in it, or adds a new bundle. The
// bundle number is the id and never changes, so every printed QR code keeps working.
//
// Built for what KV actually is: no compare-and-swap, and a read or a list may be up to about a
// minute behind a write made elsewhere. So nothing here is ever read, changed and written back:
//
//   krv/<bundle>/<op>  one per save, never rewritten (a retry of the same save writes the same
//                      key). Value: the whole entry. Metadata: {id, rev, base, seen, op}. `base`
//                      is the version the admin edited from, `seen` other versions the admin was
//                      shown and chose over. Two admins saving at once both land, side by side.
//   current            the newest version no other version builds on (a "head"). More than one
//                      head = two saves that did not know of each other: the newest is used, the
//                      others are kept and shown to the admin as a conflict until a save resolves
//                      them (`seen`). Nothing is lost either way.
//   kreg:all           a copy of every current entry for the phones (one read). Only a cache,
//                      rebuilt from the versions after each save; a rebuild that ran on a listing
//                      a minute behind is caught by kreg:dirty (time of the latest save) and run
//                      again once that save is old enough to be in every listing (`fresh`).
//
// Entry: { id, a, l, n, c, k:[[type, marking, quantity, note]], off, src, rev, base, seen, op, by, conf }
import { clip } from './media.js';

export const REG_ALL = 'kreg:all';
export const DIRTY = 'kreg:dirty';
export const verPrefix = id => 'krv/' + id + '/';
export const verKey = (id, op) => verPrefix(id) + op;
export const OK_ID = /^[A-Za-z0-9:_-]{1,32}$/;
export const MAX_KEYS = 60;
export const SETTLE_MS = 75 * 1000;     // KV: a write is in every read and list within about 60 s

const txt = (s, n) => clip(s, n).replace(/[\u0000-\u001f]/g, ' ').trim();

// What may be stored, whatever the phone sent. Null when the id is not a bundle number.
export function cleanRec(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!OK_ID.test(id)) return null;
  const k = (Array.isArray(raw.k) ? raw.k : []).slice(0, MAX_KEYS).map(r => {
    const row = Array.isArray(r) ? r : [];
    const q = Math.max(1, Math.min(99, Math.round(Number(row[2]) || 1)));
    return [txt(row[0], 60), txt(row[1], 60), q, txt(row[3], 120)];
  }).filter(r => r[0] || r[1] || r[3]);
  return { id, a: txt(raw.a, 80), l: txt(raw.l, 16), n: txt(raw.n, 40), c: txt(raw.c, 300), k,
           off: raw.off === true, src: txt(raw.src, 40) };
}

const newer = (a, b) => (a.rev || 0) > (b.rev || 0) || ((a.rev || 0) === (b.rev || 0) && String(a.op) > String(b.op));

// The versions no other version builds on, newest first.
export function heads(vers) {
  const used = new Set();
  for (const v of vers) { if (v.base) used.add(v.base); (v.seen || []).forEach(r => used.add(r)) }
  return vers.filter(v => !used.has(v.rev)).sort((a, b) => newer(a, b) ? -1 : 1);
}

async function listAll(kv, prefix, maxPages) {
  const out = [];
  let cursor, pages = 0;
  do {
    const page = await kv.list({ prefix, limit: 1000, cursor });
    for (const key of page.keys) if (key.metadata && key.metadata.id) out.push({ ...key.metadata, key: key.name });
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor && ++pages < maxPages);
  return out;
}
export const versions = (kv, id) => listAll(kv, verPrefix(id), 5);
const getJson = async (kv, key) => { try { return await kv.get(key, { type: 'json' }) } catch (e) { return null } };

// Where a bundle's entry stands: the current version, the others still in conflict with it.
export async function current(kv, id) {
  const vers = await versions(kv, id);
  const hs = heads(vers);
  if (!hs.length) return { cur: null, conf: [], vers };
  const all = await Promise.all(hs.map(h => getJson(kv, h.key)));
  const recs = all.filter(Boolean);
  return { cur: recs[0] || null, conf: recs.slice(1), vers };
}

export async function readAll(kv) {
  const all = await getJson(kv, REG_ALL);
  return all && typeof all === 'object' && all.recs ? all : { rev: 0, builtAt: 0, recs: {} };
}

// Rebuilds the phones' copy from the versions. `just` is a version written in this request,
// which the listing may not show yet.
export async function rebuild(kv, just) {
  const now = Date.now();
  const prev = await readAll(kv);
  const vers = await listAll(kv, 'krv/', 20);
  if (just && !vers.some(v => v.key === just.key)) vers.push(just);
  const byId = {};
  for (const v of vers) (byId[v.id] = byId[v.id] || []).push(v);
  const recs = {};
  for (const id of Object.keys(byId)) {
    const hs = heads(byId[id]);
    const h = hs[0];
    let rec = prev.recs[id] && prev.recs[id].rev === h.rev && prev.recs[id].op === h.op ? prev.recs[id]
      : (just && just.key === h.key ? just.rec : await getJson(kv, h.key));
    if (!rec) continue;
    recs[id] = { ...rec, conf: hs.slice(1).map(x => x.rev) };
  }
  // A bundle the listing does not show yet but the old copy had stays: losing it is worse than a
  // minute's lag, and the next rebuild sees it.
  for (const id of Object.keys(prev.recs)) if (!recs[id]) recs[id] = prev.recs[id];
  const rev = Math.max(0, ...Object.values(recs).map(r => r.rev || 0));
  await kv.put(REG_ALL, JSON.stringify({ rev, builtAt: now, recs }));
  return { rev, builtAt: now, recs };
}

// The phones' copy, rebuilt first when a save may have been missed by the last rebuild and is
// now old enough to be in every listing. At most once a minute.
export async function fresh(kv) {
  const all = await readAll(kv);
  const dirty = Number(await getJson(kv, DIRTY)) || 0;
  const now = Date.now();
  if (dirty && dirty > all.builtAt - SETTLE_MS && now - dirty > SETTLE_MS && now - all.builtAt > 60000) {
    try { return await rebuild(kv) } catch (e) { return all }
  }
  return all;
}

// Writes one version. Returns { rec } or { conflict: current entry }.
//   base  the rev the admin edited from (0 for none); seen  other versions the admin chose over
export async function saveVersion(kv, rec, { base, seen, op, who }) {
  const { cur, vers } = await current(kv, rec.id);
  const mine = vers.find(v => v.op === op);
  if (mine) { const v = await getJson(kv, mine.key); if (v) return { rec: v, again: true } }
  if (cur && (cur.rev || 0) !== (Number(base) || 0)) return { conflict: cur };
  const out = { ...rec, rev: Math.max(Date.now(), cur ? (cur.rev || 0) + 1 : 0), base: Number(base) || 0,
                seen: (Array.isArray(seen) ? seen : []).map(Number).filter(Boolean).slice(0, 10), op, by: who };
  const key = verKey(out.id, op);
  await kv.put(key, JSON.stringify(out), { metadata: { id: out.id, rev: out.rev, base: out.base, seen: out.seen, op } });
  await kv.put(DIRTY, JSON.stringify(out.rev));
  await rebuild(kv, { id: out.id, rev: out.rev, base: out.base, seen: out.seen, op, key, rec: out });
  return { rec: out };
}
