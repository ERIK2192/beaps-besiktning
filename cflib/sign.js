// Shared parts for the signing links on Cloudflare.
//
// Two differences from the Netlify version:
//   1. Storage is Cloudflare KV (env.SIGNSTORE) instead of Netlify Blobs.
//   2. Workers has no Buffer. All base64 goes through atob/btoa instead.

export const GILTIGHET_DAGAR = 30;
export const MAX_PDF = 4 * 1024 * 1024;

export const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow'
};

export const cleanToken = s => (s || '').replace(/[^a-f0-9]/g, '');

export const newToken = () =>
  [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');

// base64 -> bytes without Buffer
export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// bytes -> base64 without Buffer. Chunked, otherwise large files blow the call stack.
export function bytesToB64(bytes) {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, bytes.length)));
  }
  return btoa(s);
}

// Approximate byte length of a base64 string, without decoding it
export const b64Bytes = s => Math.round((s.length - (s.indexOf(',') + 1)) * 0.75);

export const store = env => {
  if (!env.SIGNSTORE) throw new Error('KV store SIGNSTORE is not bound');
  return env.SIGNSTORE;
};

export const readMeta = (env, token) => store(env).get('meta/' + token, 'json');

export const writeMeta = (env, token, meta) =>
  store(env).put('meta/' + token, JSON.stringify(meta),
    { expirationTtl: GILTIGHET_DAGAR * 86400 + 7 * 86400 });

// Reads the token out of the query string and fetches metadata. Returns { fel } or { token, meta, status }.
export async function loadRequest(env, url) {
  const token = cleanToken(url.searchParams.get('t'));
  if (token.length !== 48) return { fel: new Response('Invalid link', { status: 400 }) };

  let meta;
  try { meta = await readMeta(env, token) }
  catch (e) { return { fel: new Response('Could not read the link: ' + String(e.message).slice(0, 120), { status: 502 }) } }
  if (!meta) return { fel: new Response('Link not found', { status: 404 }) };

  const expired = Date.now() > meta.expires;
  return { token, meta, status: meta.status === 'pending' && expired ? 'expired' : meta.status };
}
