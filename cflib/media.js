// Shared parts for the image gallery.
//
// The images sit in R2 (env.MEDIA), the manifest in KV (env.SIGNSTORE). R2 because
// the files are many and large - KV's write cap on the free tier is not enough for a house
// with several hundred images, whereas R2 has 10 GB and a million writes per month.

export const GALLERI_DAGAR = 365;
export const MAX_FIL = 60 * 1024 * 1024;   // holds a long walkthrough video

export const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow'
};

export const cleanToken = s => (s || '').replace(/[^a-f0-9]/g, '');
export const cleanId = s => (s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

// Same simple app guard as cflib/mail.js for the gallery endpoints the app calls (init/put).
// Viewing endpoints (list/file) are left open - they are protected by the unguessable token.
export const APP_TOKEN = 'bges-a7f3c1e9b4d2e806';
export const appOk = request => (request.headers.get('x-beaps-app') || '') === APP_TOKEN;
export const clip = (s, n) => String(s == null ? '' : s).slice(0, n || 200);

export const newToken = () =>
  [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');

export const kv = env => {
  if (!env.SIGNSTORE) throw new Error('KV store SIGNSTORE is not bound');
  return env.SIGNSTORE;
};

export const r2 = env => {
  if (!env.MEDIA) throw new Error('Media store MEDIA is not bound');
  return env.MEDIA;
};

export const manifestKey = token => 'gallery/' + token;
export const fileKey = (token, id) => 'gallery/' + token + '/' + id;

export const readManifest = (env, token) => kv(env).get(manifestKey(token), 'json');

export const writeManifest = (env, token, m) =>
  kv(env).put(manifestKey(token), JSON.stringify(m), { expirationTtl: GALLERI_DAGAR * 86400 });

// Fetches the token from the query string and reads the manifest. Returns { fel } or { token, manifest }.
export async function loadGallery(env, url) {
  const token = cleanToken(url.searchParams.get('t'));
  if (token.length !== 48) return { fel: new Response('Invalid link', { status: 400 }) };

  let manifest;
  try { manifest = await readManifest(env, token) }
  catch (e) { return { fel: new Response('Could not read the gallery: ' + String(e.message).slice(0, 120), { status: 502 }) } }
  if (!manifest) return { fel: new Response('Gallery not found', { status: 404 }) };

  if (Date.now() > manifest.expires) return { fel: new Response('The gallery has expired', { status: 410 }) };
  return { token, manifest };
}

const TYPER = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm'
};
export const typeFor = (kind, name) => {
  const ext = String(name || '').split('.').pop().toLowerCase();
  return TYPER[ext] || (kind === 'video' ? 'video/mp4' : 'image/jpeg');
};
