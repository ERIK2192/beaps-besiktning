// Delade delar for bildgalleriet.
//
// Bilderna ligger i R2 (env.MEDIA), manifestet i KV (env.SIGNSTORE). R2 for att
// filerna ar manga och stora - KV:s skrivtak pa gratisnivan racker inte till ett hus
// med flera hundra bilder, medan R2 har 10 GB och en miljon skrivningar i manaden.

export const GALLERI_DAGAR = 365;
export const MAX_FIL = 60 * 1024 * 1024;   // rymmer en lang genomgangsvideo

export const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow'
};

export const cleanToken = s => (s || '').replace(/[^a-f0-9]/g, '');
export const cleanId = s => (s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

export const newToken = () =>
  [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');

export const kv = env => {
  if (!env.SIGNSTORE) throw new Error('KV-lagringen SIGNSTORE ar inte kopplad');
  return env.SIGNSTORE;
};

export const r2 = env => {
  if (!env.MEDIA) throw new Error('Bildlagringen MEDIA ar inte kopplad');
  return env.MEDIA;
};

export const manifestKey = token => 'gallery/' + token;
export const fileKey = (token, id) => 'gallery/' + token + '/' + id;

export const readManifest = (env, token) => kv(env).get(manifestKey(token), 'json');

export const writeManifest = (env, token, m) =>
  kv(env).put(manifestKey(token), JSON.stringify(m), { expirationTtl: GALLERI_DAGAR * 86400 });

// Hamtar token ur querystring och laser manifestet. Returnerar { fel } eller { token, manifest }.
export async function loadGallery(env, url) {
  const token = cleanToken(url.searchParams.get('t'));
  if (token.length !== 48) return { fel: new Response('Ogiltig lank', { status: 400 }) };

  let manifest;
  try { manifest = await readManifest(env, token) }
  catch (e) { return { fel: new Response('Kunde inte lasa galleriet: ' + String(e.message).slice(0, 120), { status: 502 }) } }
  if (!manifest) return { fel: new Response('Galleriet finns inte', { status: 404 }) };

  if (Date.now() > manifest.expires) return { fel: new Response('Galleriet har gatt ut', { status: 410 }) };
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
