// Shared parts for the signing links on Cloudflare.
//
// Two differences from the Netlify version:
//   1. Storage is Cloudflare KV (env.SIGNSTORE) instead of Netlify Blobs.
//   2. Workers has no Buffer. All base64 goes through atob/btoa instead.
import { r2 } from './media.js';

export const GILTIGHET_DAGAR = 30;
export const MAX_PDF = 16 * 1024 * 1024;

// The report behind a signing link lives in R2 as raw bytes under a random id, not as base64
// in KV. Base64 makes a 16 MB report 21 MB, which is close to KV's 25 MB ceiling for one value,
// and turning it back into bytes byte by byte costs more CPU than the free plan gives a whole
// request. Links made before this change still keep theirs in KV under `pdf/<token>`, so both
// are read; only new links are written to R2.
export const newPdfId = () =>
  [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
export const isPdfId = s => /^[a-f0-9]{48}$/.test(s || '');
export const pdfKey = id => 'sign/' + id;

// Is the report still there? The link must never go out pointing at nothing.
export async function reportExists(env, meta, token) {
  if (meta && isPdfId(meta.pdfId)) {
    try { return !!(await r2(env).head(pdfKey(meta.pdfId))) } catch (e) { return false }
  }
  try { return !!(await store(env).get('pdf/' + token, 'text')) } catch (e) { return false }
}

// The report as a stream that can be handed to Dropbox without ever being held in the worker.
// Null when it is gone - and null for an old KV link too: turning megabytes of base64 back
// into bytes one byte at a time is the very cost this road exists to avoid, and those reports
// reached Dropbox through send-pdf when they were emailed.
export async function reportStream(env, meta) {
  if (!meta || !isPdfId(meta.pdfId)) return null;
  const obj = await r2(env).get(pdfKey(meta.pdfId));
  return obj ? obj.body : null;
}

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
