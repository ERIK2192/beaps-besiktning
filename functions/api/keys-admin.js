// Admin for the key register (2026-10-13).  POST /api/keys-admin  { op, ... }
//
//   check                        -> { ok, configured, admin }
//   login   { password }         -> sets the admin cookie (cflib/admin.js)
//   logout                       -> clears it
//   get     { bundle }           -> { rec, conf, rev }  the bundle's current entry straight from
//                                   its versions, and any saved alongside it (cflib/keyreg.js)
//   reg     { rec, base, seen, op_id, who, note } -> saves a register entry as a new version. base
//                                   = the rev the phone edited from; another current rev answers
//                                   409 with it. Two saves that miss each other (KV lags up to a
//                                   minute) both land and show as a conflict - never overwritten.
//                                   An 'edit' event with the note goes in the history.
//   reset   { confirm:'TOM' }    -> empties the key log: a reset time, nothing deleted (cflib/keys.js)
//   unreset                      -> takes the reset back
//   state   { bundle, event, base_ev, op_id, who, note } -> a correction of where the bundle is or who has it,
//                                   written as an ordinary out/in/place event marked adm, after
//                                   the bundle's last one. Earlier events stay as they were.
//   queue                        -> { items:[{id, tpl, at, rev, by}] }  what is left of the tag sheet
//                                   that lived here for a day (2026-10-21, ktq/<bundle>). The sheet
//   qdel    { items:[{id, rev}] } -> is kept on each device now (Erik: not in the database); these two
//                                   only let the first device that opens it take what was here - read,
//                                   saved there, then deleted here. Nothing writes ktq/ any more.
//
// Behind the team login (middleware) and the app key; reg and state also need the admin
// cookie, checked here on every call.
import { kv, appOk, NO_STORE, clip } from '../../cflib/media.js';
import { crossSite, clientIp, failsFor, noteFail, MAX_FAILS } from '../../cflib/auth.js';
import { record, fitMeta, stKey, cleanPhone, cleanEmail, readEpoch, EPOCH } from '../../cflib/keys.js';
import { cleanRec, current, saveVersion, OK_ID } from '../../cflib/keyreg.js';
import { burst } from './login.js';
import { adminConfigured, adminPasswordOk, adminIssue, isAdmin, adminCookie, adminClear, ADMIN_FAIL } from '../../cflib/admin.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const json = (obj, status, extra) => Response.json(obj, { status: status || 200, headers: { ...NO_STORE, ...(extra || {}) } });
const OK_OP = /^[A-Za-z0-9_-]{6,24}$/;
const newId = () => 'a' + [...crypto.getRandomValues(new Uint8Array(8))].map(b => b.toString(16).padStart(2, '0')).join('');
// The tag sheet as it was kept here for a day: the metadata held everything, so one list() reads it.
const TQ = 'ktq/';
const TQ_MAX = 200;
// A few at a time: a KV call each, and the free plan allows only so many in flight.
async function inBatches(list, fn) { for (let i = 0; i < list.length; i += 20) await Promise.all(list.slice(i, i + 20).map(fn)) }

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!appOk(request)) return new Response('Reload the app', { status: 401 });
  if (crossSite(request)) return new Response('Cross-site request refused', { status: 403, headers: NO_STORE });
  if (!/application\/json/i.test(request.headers.get('content-type') || '')) return new Response('Bad request', { status: 400 });

  let b;
  try { b = await request.json() } catch { return new Response('Bad request', { status: 400 }) }
  if (!b || typeof b !== 'object') return new Response('Bad request', { status: 400 });

  const configured = adminConfigured(env);
  if (b.op === 'check') return json({ ok: true, configured, admin: configured && await isAdmin(env, request) });
  if (b.op === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': adminClear(request) });

  if (!configured) return json({ ok: false, error: 'unconfigured' }, 503);

  if (b.op === 'login') {
    const ip = clientIp(request);
    if (burst(ip)) return json({ ok: false, error: 'locked' }, 429, { 'Retry-After': '10' });
    if (await failsFor(env, ip, ADMIN_FAIL) >= MAX_FAILS) return json({ ok: false, error: 'locked' }, 429, { 'Retry-After': '900' });
    if (!await adminPasswordOk(env, b.password)) {
      await noteFail(env, ip, ADMIN_FAIL);
      await sleep(700);
      return json({ ok: false, error: 'wrong' }, 401);
    }
    return json({ ok: true }, 200, { 'Set-Cookie': adminCookie(request, await adminIssue(env)) });
  }

  if (!await isAdmin(env, request)) return json({ ok: false, error: 'admin' }, 403);
  const store = kv(env);
  const who = clip(b.who, 60).trim() || 'Admin';

  try {
    if (b.op === 'get') {
      const bundle = String(b.bundle || '');
      if (!OK_ID.test(bundle)) return json({ ok: false, error: 'bad' }, 400);
      const { cur, conf } = await current(store, bundle);
      return json({ ok: true, rec: cur, conf, rev: cur ? cur.rev : 0 });
    }

    if (b.op === 'reg') {
      const rec = cleanRec(b.rec);
      if (!rec) return json({ ok: false, error: 'id' }, 400);
      const op = OK_OP.test(b.op_id || '') ? b.op_id : newId();
      const r = await saveVersion(store, rec, { base: b.base, seen: b.seen, op, who });
      if (r.conflict) return json({ ok: false, error: 'conflict', rec: r.conflict }, 409);
      // The history line carries the save's own id and time, so a retry writes the same one.
      const ev = fitMeta({ id: 'e' + r.rec.op, bundle: r.rec.id, kind: 'edit', who: r.rec.by, ts: r.rec.rev, adm: 1,
        note: clip(b.note, 200) || 'Registret ändrat', name: r.rec.n || (r.rec.l ? 'lgh ' + r.rec.l : '') });
      await record(store, [ev]);
      return json({ ok: true, rec: r.rec, event: ev });
    }

    if (b.op === 'queue') {
      const items = [];
      let cursor, pages = 0;
      do {
        const page = await store.list({ prefix: TQ, limit: 1000, cursor });
        for (const k of page.keys) if (k.metadata && k.metadata.id) items.push(k.metadata);
        cursor = page.list_complete ? null : page.cursor;
      } while (cursor && ++pages < 5);
      items.sort((x, y) => (x.at || 0) - (y.at || 0) || (x.id < y.id ? -1 : 1));
      return json({ ok: true, items });
    }
    if (b.op === 'qdel') {
      const list = (Array.isArray(b.items) ? b.items : []).slice(0, TQ_MAX)
        .map(it => ({ id: String((it && it.id) || ''), rev: Number(it && it.rev) || 0 })).filter(it => OK_ID.test(it.id));
      await inBatches(list, async it => {
        let m = null;
        try { m = (await store.getWithMetadata(TQ + it.id)).metadata } catch (e) {}
        if (m && (Number(m.rev) || 0) > it.rev) return;
        await store.delete(TQ + it.id);
      });
      return json({ ok: true });
    }

    if (b.op === 'reset') {
      if (b.confirm !== 'TOM') return json({ ok: false, error: 'confirm' }, 400);
      const epoch = Date.now();
      await store.put(EPOCH, String(epoch));
      return json({ ok: true, epoch });
    }
    if (b.op === 'unreset') {
      await store.delete(EPOCH);
      return json({ ok: true, epoch: 0 });
    }

    if (b.op === 'state') {
      const bundle = String(b.bundle || '');
      const raw = b.event || {};
      if (!OK_ID.test(bundle) || !['out', 'in', 'place'].includes(raw.kind)) return json({ ok: false, error: 'bad' }, 400);
      // After whatever decides the bundle now, so the correction is what counts.
      let last = null, hist = [];
      try { const r = await store.getWithMetadata(stKey(bundle), { type: 'json' }); last = r && r.metadata; hist = (r && r.value && r.value.hist) || [] } catch (e) {}
      // Before a reset of the log, the bundle counts as never moved.
      const epoch = await readEpoch(store);
      if (last && (Number(last.ts) || 0) < epoch) last = null;
      hist = hist.filter(e => (Number(e.ts) || 0) >= epoch);
      // The phone names the correction; a retry of one already written gets it back, not a second.
      const id = OK_OP.test(b.op_id || '') ? 'a' + b.op_id : newId();
      const again = hist.find(e => e.id === id);
      if (again) return json({ ok: true, event: again });
      // Someone moved the bundle after the admin opened it: show that rather than correct blind.
      // (Every event is its own key, so neither move is lost whichever way this goes.)
      if (typeof b.base_ev === 'string' && ((last && last.id) || '') !== b.base_ev) return json({ ok: false, error: 'conflict', event: last }, 409);
      const ev = fitMeta({
        id, bundle, kind: raw.kind, who, ts: Math.max(Date.now(), last ? (last.ts || 0) + 1 : 0), adm: 1,
        note: clip(b.note, 200),
        reason: clip(raw.reason, 80), name: clip(raw.name, 40),
        from: clip(raw.from, 60),
        apt: clip(raw.apt, 16).replace(/[^A-Za-z0-9_-]/g, ''),
        place: clip(raw.place, 60), guest: clip(raw.guest, 60),
        holder: raw.kind === 'out' ? clip(raw.holder, 60) : '',
        phone: cleanPhone(raw.phone),
        email: cleanEmail(raw.email),
        loc: ['box', 'tube', 'apt', 'guest', 'lost'].includes(raw.loc) ? raw.loc : '',
        unit: clip(raw.unit, 40)
      });
      await record(store, [ev]);
      return json({ ok: true, event: ev });
    }
  } catch (e) {
    return json({ ok: false, error: 'store', detail: String(e && e.message).slice(0, 140) }, 502);
  }
  return json({ ok: false, error: 'op' }, 400);
}
