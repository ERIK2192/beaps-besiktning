// Dropbox filing for the three branches (MOVE IN, MOVE OUT, NYA OBJEKT), function by function,
// against the REAL media-init, media-put, media-sync and send-pdf with Dropbox, KV, R2 and the
// mail service stubbed. Nothing leaves the machine.
//   ELECTRON_RUN_AS_NODE=1 ".../Code.exe" dbx-test.mjs
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const mod = p => import(pathToFileURL(ROOT + p).href);

let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('PASS ' + m) } else { fail++; console.log('FAIL ' + m + (extra !== undefined ? '  ' + JSON.stringify(extra) : '')) } };

const dbx = await mod('cflib/dropbox.js');
const { onRequest: mediaInit } = await mod('functions/api/media-init.js');
const { onRequest: mediaPut } = await mod('functions/api/media-put.js');
const { onRequest: mediaSync } = await mod('functions/api/media-sync.js');
const { onRequest: sendPdf } = await mod('functions/api/send-pdf.js');

// ---- stubs ----
function kvStub() {
  const m = new Map();
  return {
    m,
    async get(k, type) { const v = m.get(k); if (v == null) return null; return type === 'json' ? JSON.parse(v) : v },
    async put(k, v) { m.set(k, typeof v === 'string' ? v : String(v)) },
    async delete(k) { m.delete(k) },
    async list(o) { const p = (o && o.prefix) || ''; return { keys: [...m.keys()].filter(k => k.startsWith(p)).map(name => ({ name })), list_complete: true } }
  };
}
function r2Stub() {
  const o = new Map();
  return {
    o,
    async put(key, body) { const buf = body == null ? new ArrayBuffer(0) : await new Response(body).arrayBuffer(); o.set(key, buf) },
    async head(key) { return o.has(key) ? { size: o.get(key).byteLength } : null },
    async get(key) { if (!o.has(key)) return null; const b = o.get(key); return { size: b.byteLength, body: new Response(b).body, arrayBuffer: async () => b } },
    async delete(key) { o.delete(key) }
  };
}

// A Dropbox with folders and files. `strict` refuses to make a folder whose parent is missing, so
// the code is tested both ways (the real create_folder_v2 is not verified here).
const D = { folders: new Set(), files: new Map(), calls: [], down: false, strict: false, links: 0 };
const ROOTDIR = '/Longstay PICTURES';
const parentOf = p => p.slice(0, p.lastIndexOf('/'));
function resetDropbox() { D.folders = new Set([ROOTDIR]); D.files = new Map(); D.calls = []; D.down = false; D.strict = false }
const j = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { 'Content-Type': 'application/json' } });
const mails = [];
globalThis.fetch = async (url, opts) => {
  url = String(url);
  if (url.indexOf('resend') >= 0) { mails.push(JSON.parse(opts.body)); return j({ id: 'm1' }) }
  if (url.indexOf('dropbox') < 0) return new Response('nope', { status: 404 });
  const ep = url.replace(/^https:\/\/[^/]+\/(2\/)?/, '');
  D.calls.push(ep);
  if (D.down) return new Response('service unavailable', { status: 503 });
  if (ep === 'oauth2/token') return j({ access_token: 'tok', expires_in: 14400 });
  if (ep === 'users/get_current_account') return j({ root_info: { root_namespace_id: '777' } });
  const h = opts.headers || {};
  if (h['Dropbox-API-Path-Root'] !== JSON.stringify({ '.tag': 'root', root: '777' })) return new Response('wrong namespace', { status: 400 });
  if (ep === 'files/create_folder_v2') {
    const { path } = JSON.parse(opts.body);
    if (D.folders.has(path)) return j({ error_summary: 'path/conflict/folder/..' }, 409);
    if (!D.folders.has(parentOf(path))) {
      if (D.strict) return j({ error_summary: 'path/not_found/..' }, 409);
      let p = parentOf(path); while (p && !D.folders.has(p)) { D.folders.add(p); p = parentOf(p) }
    }
    D.folders.add(path);
    return j({ metadata: { path_display: path } });
  }
  if (ep === 'files/upload') {
    const arg = JSON.parse(h['Dropbox-API-Arg']);
    if (/[^\x00-\x7F]/.test(h['Dropbox-API-Arg'])) return new Response('header not ascii', { status: 400 });
    let p = parentOf(arg.path); while (p && !D.folders.has(p)) { D.folders.add(p); p = parentOf(p) }
    const body = await new Response(opts.body).arrayBuffer();
    D.files.set(arg.path, body.byteLength);
    return j({ path_display: arg.path });
  }
  if (ep === 'sharing/create_shared_link_with_settings') { D.links++; return j({ url: 'https://www.dropbox.com/s/' + encodeURIComponent(JSON.parse(opts.body).path) }) }
  if (ep === 'sharing/list_shared_links') return j({ links: [] });
  if (ep === 'files/move_v2') {
    const { from_path, to_path, autorename } = JSON.parse(opts.body);
    if (D.folders.has(to_path)) { if (autorename) throw new Error('Unsafe automatic rename'); return j({ error_summary: 'to/conflict/folder/..' }, 409) }
    if (!D.folders.has(from_path)) return j({ error_summary: 'from_lookup/not_found/' }, 409);
    for (const f of [...D.folders]) if (f === from_path || f.startsWith(from_path + '/')) { D.folders.delete(f); D.folders.add(to_path + f.slice(from_path.length)) }
    for (const [f, n] of [...D.files]) if (f.startsWith(from_path + '/')) { D.files.delete(f); D.files.set(to_path + f.slice(from_path.length), n) }
    let p = parentOf(to_path); while (p && !D.folders.has(p)) { D.folders.add(p); p = parentOf(p) }
    return j({ metadata: { path_display: to_path } });
  }
  return new Response('unknown endpoint ' + ep, { status: 400 });
};

const SECRETS = { DROPBOX_APP_KEY: 'k', DROPBOX_APP_SECRET: 's', DROPBOX_REFRESH_TOKEN: 'r', DROPBOX_ROOT: 'Longstay PICTURES', RESEND_API_KEY: 'x', MAIL_FROM: 'Beaps <b@bedoma.se>' };
const newEnv = (extra) => ({ SIGNSTORE: kvStub(), MEDIA: r2Stub(), ...SECRETS, ...(extra || {}) });
const APP = { 'x-beaps-app': 'bges-a7f3c1e9b4d2e806' };
const O = 'https://beaps-besiktning.pages.dev';
const post = (ep, body) => new Request(O + '/api/' + ep, { method: 'POST', headers: { ...APP, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const call = async (fn, request, env) => { const r = await fn({ request, env }); let b = null; const t = await r.text(); try { b = JSON.parse(t) } catch (e) { b = t } return { status: r.status, body: b } };

// What the app sends: dropboxSubfolder() for each type, written out by hand so the test does not
// trust the code it tests.
const sub = (branch, code, address, apt, day, id) => `${branch}/${code} - ${address} ${apt} ${day} ${id}`;
async function init(env, subfolder, type, ids) {
  return call(mediaInit, post('media-init', { ref: 'x', type, address: 'Folkungagatan 59', apt: '1201', inspector: 'Erik',
    items: (ids || ['p1']).map(id => ({ id, name: 'Hall 1', kind: 'bild', ts: Date.UTC(2026, 9, 9, 9, 11, 4) })), subfolder }), env);
}
async function put(env, token, id, name, ts) {
  const q = `t=${token}&id=${id}&name=${encodeURIComponent(name)}&kind=bild&ts=${ts || Date.UTC(2026, 9, 9, 9, 11, 4)}`;
  return call(mediaPut, new Request(O + '/api/media-put?' + q, { method: 'PUT', headers: { ...APP, 'content-type': 'image/jpeg', 'content-length': '5' }, body: new Uint8Array([1, 2, 3, 4, 5]) }), env);
}
const filesUnder = dir => [...D.files.keys()].filter(f => f.startsWith(dir + '/'));
const foldersIn = dir => [...D.folders].filter(f => parentOf(f) === dir);

// ---- 1. the allowlist ----
{
  const e = newEnv();
  ok(dbx.filingPath(e, 'MOVE IN/MIN - Folkungagatan 59 1201 2026-10-09 abc') === ROOTDIR + '/MOVE IN/MIN - Folkungagatan 59 1201 2026-10-09 abc', 'a move-in folder is accepted');
  ok(dbx.filingPath(e, 'MOVE OUT/MOU - A 1 2026-10-09 x') === ROOTDIR + '/MOVE OUT/MOU - A 1 2026-10-09 x', 'a move-out folder is accepted');
  ok(dbx.filingPath(e, 'NYA OBJEKT/NYTT - A 1 2026-10-09 x') === ROOTDIR + '/NYA OBJEKT/NYTT - A 1 2026-10-09 x', 'a new-property folder is accepted');
  ok(dbx.filingPath(e, 'MOVE IN/MIN - Folkungagatan 59 1201 Lovable') !== null, 'the old name an app from before the change sends is still accepted');
  ok(dbx.filingPath(e, 'MOVE IN/MOU - A 1') === null, 'a move-out name in the move-in branch is refused');
  ok(dbx.filingPath(e, 'NYA OBJEKT/MIN - A 1') === null, 'a move-in name in the new-property branch is refused');
  ok(dbx.filingPath(e, 'MOVE OUT/NYTT - A 1') === null, 'a new-property name in the move-out branch is refused');
  ok(dbx.filingPath(e, 'SKADA/X - A') === null, 'any other branch is refused');
  ok(dbx.filingPath(e, 'MOVE IN/MIN -') === null, 'a name with nothing after the code is refused (once a shared "MIN -" folder)');
  ok(dbx.filingPath(e, 'MOVE IN/MIN - Storgatan 1/3 1201') === null, 'a slash that would nest a folder is refused');
  const climb = [dbx.filingPath(e, '../MOVE IN/MIN - A'), dbx.filingPath(e, 'MOVE IN/../../MIN - A')];
  ok(climb.every(p => p === null || (p === ROOTDIR + '/MOVE IN/MIN - A')), 'a climb out of the root is flattened into the branch, never above it', climb);
  ok(dbx.filingPath(e, '') === null && dbx.filingPath(e, null) === null, 'nothing is nothing');
}

// ---- 2. three types, three branches, one folder each ----
resetDropbox();
const env = newEnv();
const MIN = sub('MOVE IN', 'MIN', 'Folkungagatan 59', '1201', '2026-10-09', 'aaaa1111bbb');
const MOU = sub('MOVE OUT', 'MOU', 'Folkungagatan 59', '1201', '2026-10-09', 'cccc2222ddd');
const NYTT = sub('NYA OBJEKT', 'NYTT', 'Folkungagatan 59', '1201', '2026-10-09', 'eeee3333fff');
const NYTT2 = sub('NYA OBJEKT', 'NYTT', 'Folkungagatan 59', '1201', '2026-10-09', 'gggg4444hhh');
const g = {};
for (const [k, s, type] of [['min', MIN, 'Inflytt'], ['mou', MOU, 'Utflytt'], ['nytt', NYTT, 'Nytt objekt'], ['nytt2', NYTT2, 'Nytt objekt']]) {
  const r = await init(env, s, type);
  ok(r.status === 200 && r.body.token && r.body.dropbox && r.body.dropbox.url, `media-init files the ${k} inspection and returns a link`, r.body);
  g[k] = r.body;
}
ok(D.folders.has(ROOTDIR + '/NYA OBJEKT'), 'NYA OBJEKT is created when it is first needed');
ok(foldersIn(ROOTDIR).sort().join('|') === [ROOTDIR + '/MOVE IN', ROOTDIR + '/MOVE OUT', ROOTDIR + '/NYA OBJEKT'].join('|'), 'the root holds exactly the three branches', foldersIn(ROOTDIR));
ok(foldersIn(ROOTDIR + '/MOVE IN').length === 1 && foldersIn(ROOTDIR + '/MOVE OUT').length === 1, 'one move-in folder, one move-out folder');
ok(foldersIn(ROOTDIR + '/NYA OBJEKT').length === 2, 'two new properties of the same apartment on the same day get two folders', foldersIn(ROOTDIR + '/NYA OBJEKT'));
ok(g.min.dropbox.path === ROOTDIR + '/' + MIN && g.mou.dropbox.path === ROOTDIR + '/' + MOU && g.nytt.dropbox.path === ROOTDIR + '/' + NYTT, 'each manifest points at its own folder');

for (const k of ['min', 'mou', 'nytt', 'nytt2']) {
  const r = await put(env, g[k].token, 'p1', 'Hall 1');
  ok(r.status === 200, `a photo goes into the ${k} gallery`);
}
ok(filesUnder(g.min.dropbox.path).length === 1 && filesUnder(g.mou.dropbox.path).length === 1 && filesUnder(g.nytt.dropbox.path).length === 1 && filesUnder(g.nytt2.dropbox.path).length === 1,
  'each photo lands in its own inspection folder only', [...D.files.keys()]);
ok(filesUnder(g.nytt.dropbox.path)[0] === g.nytt.dropbox.path + '/Hall 2026-10-09 09-11-04.jpg', 'named by room and capture time', filesUnder(g.nytt.dropbox.path));

// an equipment photo, named the way galleryItems names it
await put(env, g.nytt.token, 'p2', 'Electricity meter 1', Date.UTC(2026, 9, 9, 9, 30, 0));
ok(D.files.has(g.nytt.dropbox.path + '/Electricity meter 2026-10-09 09-30-00.jpg'), 'an equipment photo is filed beside the rooms under its short name', filesUnder(g.nytt.dropbox.path));

// ---- 3. uploading again reuses the folder ----
const before = { files: D.files.size, folders: D.folders.size, creates: D.calls.filter(c => c === 'files/create_folder_v2').length };
await put(env, g.nytt.token, 'p1', 'Hall 1');   // the same photo again (a retry)
await put(env, g.nytt.token, 'p1', 'Hall 1');
ok(D.files.size === before.files && D.folders.size === before.folders, 'the same photo sent twice more makes no new file and no new folder', { before, after: { files: D.files.size, folders: D.folders.size } });
ok(D.calls.filter(c => c === 'files/create_folder_v2').length === before.creates, 'and asks Dropbox for no folder at all: the gallery remembers where it is filed');
const sync = await call(mediaSync, post('media-sync', { t: g.nytt.token, ids: ['p1', 'p2'], subfolder: NYTT }), env);
ok(sync.status === 200 && sync.body.dropbox.path === g.nytt.dropbox.path && !sync.body.attached, 'tidying before a send with the same name changes nothing', sync.body);

// ---- 4. the PDF goes into the same folder, and a resend overwrites rather than duplicates ----
const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
for (let i = 0; i < 2; i++) {
  const r = await call(sendPdf, post('send-pdf', { filename: 'Nytt objekt Folkungagatan 59, 1201.pdf', subject: 'BesiktningPDF Nytt objekt Folkungagatan 59, 1201', kind: 'besiktning', gallery: g.nytt.token, pdf }), env);
  ok(r.status === 200 && r.body.ok === true, `send-pdf mails the new property (round ${i + 1})`, r.body);
}
const pdfs = filesUnder(g.nytt.dropbox.path).filter(f => f.endsWith('.pdf'));
ok(pdfs.length === 1 && pdfs[0] === g.nytt.dropbox.path + '/Nytt objekt Folkungagatan 59, 1201.pdf', 'one PDF named "Nytt objekt ..." in the new-property folder after two sends', pdfs);
ok(filesUnder(g.nytt2.dropbox.path).filter(f => f.endsWith('.pdf')).length === 0, 'the other new property of the same apartment did not get it');
ok(mails.length === 2 && mails.every(m => m.to && JSON.stringify(m.to).indexOf('longstay') >= 0), 'the mail goes to longstay', mails.map(m => m.to));

// ---- 5. a corrected address renames the folder, keeping the id ----
const NYTTfix = sub('NYA OBJEKT', 'NYTT', 'Folkungagatan 61', '1201', '2026-10-09', 'eeee3333fff');
const ren = await call(mediaSync, post('media-sync', { t: g.nytt.token, ids: ['p1', 'p2'], subfolder: NYTTfix }), env);
ok(ren.body.dropbox && ren.body.dropbox.path === ROOTDIR + '/' + NYTTfix, 'a corrected address moves the folder to the new name', ren.body);
ok(filesUnder(ROOTDIR + '/' + NYTTfix).length === 3 && filesUnder(g.nytt.dropbox.path).length === 0, 'with everything in it');
ok(foldersIn(ROOTDIR + '/NYA OBJEKT').length === 2, 'and still two folders in the branch');
const renMIN = await call(mediaSync, post('media-sync', { t: g.min.token, ids: ['p1'], subfolder: 'MOVE IN/MOU - Folkungagatan 59 1201 2026-10-09 aaaa1111bbb' }), env);
ok(renMIN.body.dropbox.path === g.min.dropbox.path, 'a rename into a name that does not match its branch is refused, the folder stays', renMIN.body);

// ---- 6. a gallery made without a folder is filed later ----
const plain = await init(env, null, 'Upplåsning');
ok(plain.status === 200 && plain.body.dropbox === null, 'a shortstay gallery gets no Dropbox folder');
await put(env, plain.body.token, 'q1', 'Hall 1');
const NYTT3 = sub('NYA OBJEKT', 'NYTT', 'Upplandsgatan 91B', '1102', '2026-10-09', 'iiii5555jjj');
const att = await call(mediaSync, post('media-sync', { t: plain.body.token, ids: ['q1'], subfolder: NYTT3 }), env);
ok(att.body.attached === true && att.body.dropbox && att.body.dropbox.path === ROOTDIR + '/' + NYTT3 && att.body.dropbox.url, 'changed into a new property, it is filed at the next send', att.body);
await put(env, plain.body.token, 'q1', 'Hall 1');
ok(filesUnder(ROOTDIR + '/' + NYTT3).length === 1, 'the photo sent again by the phone is copied in');
const att2 = await call(mediaSync, post('media-sync', { t: plain.body.token, ids: ['q1'], subfolder: NYTT3 }), env);
ok(att2.body.attached === false && foldersIn(ROOTDIR + '/NYA OBJEKT').length === 3, 'a second send does not file it again', att2.body);

// ---- 7. a branch that Dropbox will not make on its own ----
resetDropbox(); D.strict = true;
const env2 = newEnv();
const s1 = await init(env2, sub('NYA OBJEKT', 'NYTT', 'A', '1', '2026-10-09', 'kkkk6666lll'), 'Nytt objekt');
ok(s1.body.dropbox && s1.body.dropbox.url && D.folders.has(ROOTDIR + '/NYA OBJEKT/NYTT - A 1 2026-10-09 kkkk6666lll'), 'the branch is made first when Dropbox refuses a missing parent', [...D.folders]);
D.folders.delete(ROOTDIR);
const s2 = await init(newEnv(), sub('MOVE IN', 'MIN', 'B', '2', '2026-10-09', 'mmmm7777nnn'), 'Inflytt');
ok(s2.status === 200 && s2.body.token && !D.folders.has(ROOTDIR), 'a missing root is never made up: the gallery is made, nothing is filed', { body: s2.body, folders: [...D.folders] });

// ---- 8. Dropbox down never costs the inspection ----
resetDropbox(); D.down = true;
const env3 = newEnv();
const d1 = await init(env3, sub('NYA OBJEKT', 'NYTT', 'C', '3', '2026-10-09', 'oooo8888ppp'), 'Nytt objekt');
ok(d1.status === 200 && d1.body.token, 'with Dropbox down the gallery is still made', d1.body);
const d2 = await put(env3, d1.body.token, 'p1', 'Hall 1');
ok(d2.status === 200 && env3.MEDIA.o.size === 1, 'the photo is still stored in R2');
const d3 = await call(sendPdf, post('send-pdf', { filename: 'Nytt objekt C, 3.pdf', subject: 's', kind: 'besiktning', gallery: d1.body.token, pdf }), env3);
ok(d3.status === 200 && d3.body.ok === true, 'and the report is still mailed');
const d4 = await call(mediaSync, post('media-sync', { t: d1.body.token, ids: ['p1'], subfolder: sub('NYA OBJEKT', 'NYTT', 'C', '3', '2026-10-09', 'oooo8888ppp') }), env3);
ok(d4.status === 200 && d4.body.ok === true, 'tidying still answers ok', d4.body);

// ---- 9. Dropbox not configured: nothing is tried ----
resetDropbox();
const env4 = { SIGNSTORE: kvStub(), MEDIA: r2Stub(), RESEND_API_KEY: 'x', MAIL_FROM: 'Beaps <b@bedoma.se>' };
const n1 = await init(env4, NYTT, 'Nytt objekt');
await put(env4, n1.body.token, 'p1', 'Hall 1');
ok(n1.body.dropbox === null && D.calls.length === 0, 'without the secrets no Dropbox call is made at all');

// Regression: old shared folders must never be moved, including by an older client.
resetDropbox();
const safetyEnv = newEnv();
const oldSub = 'MOVE IN/MIN - Shared old address Guest';
const old = await init(safetyEnv, oldSub, 'Inflytt');
await put(safetyEnv, old.body.token, 'oldphoto', 'Hall 1');
const proposed = sub('MOVE OUT','MOU','Changed','1','2026-10-09','aaaa1111bbb');
const oldResult = await call(mediaSync, post('media-sync',{t:old.body.token,ids:['oldphoto'],subfolder:proposed}),safetyEnv);
ok(oldResult.body.dropbox.path === ROOTDIR+'/'+oldSub, 'legacy folder stays at its exact original path');
ok(!D.calls.includes('files/move_v2') && filesUnder(ROOTDIR+'/'+oldSub).length===1, 'no move or loss of legacy files');

// A destination collision must not change the remembered path or merge either folder.
const ownSub = sub('NYA OBJEKT','NYTT','Original','1','2026-10-09','bbbb2222ccc');
const destSub = sub('NYA OBJEKT','NYTT','Corrected','1','2026-10-09','bbbb2222ccc');
const own = await init(safetyEnv, ownSub, 'Nytt objekt');
await put(safetyEnv, own.body.token, 'ownphoto', 'Hall 1');
D.folders.add(ROOTDIR+'/'+destSub);
D.files.set(ROOTDIR+'/'+destSub+'/existing.pdf',123);
const collision=await call(mediaSync,post('media-sync',{t:own.body.token,ids:['ownphoto'],subfolder:destSub}),safetyEnv);
ok(collision.body.dropbox.path===ROOTDIR+'/'+ownSub, 'a conflicting rename retains the original path');
ok(filesUnder(ROOTDIR+'/'+ownSub).length===1 && D.files.get(ROOTDIR+'/'+destSub+'/existing.pdf')===123, 'both folders retain their own files on conflict');
const otherId=sub('NYA OBJEKT','NYTT','Other','1','2026-10-09','dddd3333eee');
const movesBefore=D.calls.filter(c=>c==='files/move_v2').length;
await call(mediaSync,post('media-sync',{t:own.body.token,ids:['ownphoto'],subfolder:otherId}),safetyEnv);
ok(D.calls.filter(c=>c==='files/move_v2').length===movesBefore,'cannot rename into a different inspection identity');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
