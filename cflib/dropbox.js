// Filing inspections into Dropbox.
//
// The refresh token never touches the phone. index.html is a static page that anyone can read
// the source of, so a token there would hand a stranger the whole team Dropbox. All of this runs
// on the server, with the credentials in Cloudflare's encrypted secrets next to the mail key.
//
// Everything here is best effort. Dropbox being unconfigured, slow or down must never fail an
// inspection - the photos are already safe in R2 by the time any of this is called.

const API = 'https://api.dropboxapi.com/2';
const CONTENT = 'https://content.dropboxapi.com/2';
const TOKEN_URL = 'https://api.dropbox.com/oauth2/token';

export const dbxOn = env =>
  !!(env.DROPBOX_REFRESH_TOKEN && env.DROPBOX_APP_KEY && env.DROPBOX_APP_SECRET);

// The folder the inspections are filed under. Everything the app asks for is placed inside it,
// so a mistake on the phone cannot write somewhere else in the team's Dropbox.
export const dbxRoot = env =>
  '/' + String(env.DROPBOX_ROOT || 'Longstay PICTURES').trim().replace(/^\/+|\/+$/g, '');

// Dropbox rejects these characters outright, and a stray slash would quietly file the photos
// in a folder of its own somewhere else.
export const cleanPart = s => String(s == null ? '' : s)
  .replace(/[\\/:?*<>"|]+/g, ' ')
  .replace(/[\u0000-\u001F]/g, '')
  .replace(/\s+/g, ' ')
  .replace(/^[. ]+|[. ]+$/g, '')
  .slice(0, 120);

export function dbxPath(env, subfolder, file) {
  const parts = String(subfolder || '').split('/').map(cleanPart).filter(Boolean);
  if (!parts.length) return null;
  const namn = file ? cleanPart(file) : '';
  return dbxRoot(env) + '/' + parts.join('/') + (namn ? '/' + namn : '');
}

// Dropbox-API-Arg is an HTTP header, so it has to be plain ASCII. Swedish street names would
// otherwise break every upload on the first a-ring or umlaut.
const asciiJson = o => JSON.stringify(o).replace(/[\u007F-\uFFFF]/g,
  c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

const kvOf = env => env.SIGNSTORE || null;

async function accessToken(env) {
  const kv = kvOf(env);
  if (kv) { try { const c = await kv.get('dbx/token'); if (c) return c } catch (e) {} }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: env.DROPBOX_REFRESH_TOKEN,
    client_id: env.DROPBOX_APP_KEY,
    client_secret: env.DROPBOX_APP_SECRET
  });
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });
  if (!r.ok) throw new Error('Dropbox refused the refresh token (' + r.status + ')');
  const j = await r.json();
  if (!j.access_token) throw new Error('Dropbox returned no access token');

  // Cached a little short of its real life, so a token never expires mid-upload.
  const ttl = Math.max(60, Math.min(Number(j.expires_in) || 14400, 14400) - 600);
  if (kv) { try { await kv.put('dbx/token', j.access_token, { expirationTtl: ttl }) } catch (e) {} }
  return j.access_token;
}

// A team account roots every call in the member's own space unless told otherwise, and the
// Longstay folders live in the team space. Set DROPBOX_TEAM=no for a personal account.
async function rootNamespace(env, token) {
  if (String(env.DROPBOX_TEAM || 'yes').toLowerCase() === 'no') return null;
  const kv = kvOf(env);
  if (kv) { try { const c = await kv.get('dbx/root-ns'); if (c) return c } catch (e) {} }

  const r = await fetch(API + '/users/get_current_account', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token }
  });
  if (!r.ok) return null;
  const j = await r.json().catch(() => null);
  const ns = j && j.root_info && j.root_info.root_namespace_id;
  if (!ns) return null;
  if (kv) { try { await kv.put('dbx/root-ns', String(ns), { expirationTtl: 86400 }) } catch (e) {} }
  return String(ns);
}

async function heads(env, extra) {
  const token = await accessToken(env);
  const h = Object.assign({ Authorization: 'Bearer ' + token }, extra || {});
  const ns = await rootNamespace(env, token);
  if (ns) h['Dropbox-API-Path-Root'] = JSON.stringify({ '.tag': 'root', root: ns });
  return h;
}

const short = async r => (await r.text().catch(() => '')).slice(0, 200);

export async function ensureFolder(env, path) {
  const r = await fetch(API + '/files/create_folder_v2', {
    method: 'POST',
    headers: await heads(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ path, autorename: false })
  });
  if (r.ok) return true;
  const txt = await short(r);
  // Already there is exactly what we wanted.
  if (r.status === 409 || txt.indexOf('conflict') >= 0) return true;
  throw new Error('Dropbox folder: ' + txt);
}

export async function uploadFile(env, path, body) {
  const r = await fetch(CONTENT + '/files/upload', {
    method: 'POST',
    headers: await heads(env, {
      'Content-Type': 'application/octet-stream',
      // overwrite, so a retried upload replaces the file instead of leaving "Hall 1 (1).jpg"
      'Dropbox-API-Arg': asciiJson({ path, mode: 'overwrite', autorename: false, mute: true })
    }),
    body
  });
  if (!r.ok) throw new Error('Dropbox upload: ' + (await short(r)));
  return true;
}

// A link the recipient can open. A team policy may forbid public links, in which case we take
// whatever sharing the team does allow rather than coming back with nothing.
export async function sharedLink(env, path) {
  const h = await heads(env, { 'Content-Type': 'application/json' });

  for (const settings of [{ requested_visibility: 'public' }, null]) {
    const r = await fetch(API + '/sharing/create_shared_link_with_settings', {
      method: 'POST', headers: h,
      body: JSON.stringify(settings ? { path, settings } : { path })
    });
    if (r.ok) {
      const j = await r.json().catch(() => null);
      if (j && j.url) return j.url;
      break;
    }
    const txt = await short(r);
    // The folder is already shared - fetch the link that exists instead of making another.
    if (txt.indexOf('shared_link_already_exists') >= 0) break;
    if (txt.indexOf('settings_error') < 0) break;
  }

  const l = await fetch(API + '/sharing/list_shared_links', {
    method: 'POST', headers: h,
    body: JSON.stringify({ path, direct_only: true })
  });
  if (l.ok) {
    const j = await l.json().catch(() => null);
    if (j && j.links && j.links.length && j.links[0].url) return j.links[0].url;
  }
  return null;
}

// Used when the address or the tenant's name was corrected after the folder was made.
export async function moveFolder(env, from, to) {
  const r = await fetch(API + '/files/move_v2', {
    method: 'POST',
    headers: await heads(env, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ from_path: from, to_path: to, autorename: true })
  });
  if (r.ok) return true;
  const txt = await short(r);
  if (txt.indexOf('conflict') >= 0 || txt.indexOf('not_found') >= 0) return false;
  throw new Error('Dropbox move: ' + txt);
}
