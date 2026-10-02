// The login wall, the part that does not depend on any platform.
//
// One shared password for the whole team, set as the Cloudflare secret APP_PASSWORD (never in
// git, never in the served app). Logging in gives the browser a signed session token in an
// HttpOnly cookie. The password itself is never stored anywhere on the phone: the cookie holds
// only an expiry, an issue time and an HMAC over the two, so a stolen cookie cannot be turned
// back into the password, and a forged one fails the HMAC.
//
// Why a server-set HttpOnly cookie and not localStorage: iOS Safari wipes script-writable
// storage after seven days without a visit, but leaves cookies the server sets alone. It is also
// what makes the wall real - index.html itself is only served once the cookie checks out, so
// someone with the link sees the login page and nothing else.
//
// The signing key is derived from the password unless APP_SESSION_SECRET is set. Deriving it
// means changing the password logs every phone out at once, which is what you want when a
// password has leaked. Setting APP_SESSION_SECRET (any long random string) instead lets a
// password change leave existing sessions alone.

export const COOKIE = 'beaps_session';
export const SESSION_DAYS = 180;                       // a phone that has not opened the app for this long must log in again
export const RENEW_AFTER_MS = 24 * 3600 * 1000;        // an active phone gets a fresh 180-day cookie about once a day
export const LOGIN_HEADER = 'X-Beaps-Login';           // on a 401 that means "log in", so the app can tell it from a stale APP key
export const MAX_FAILS = 10;                           // wrong passwords per address before a pause
export const FAIL_WINDOW_S = 15 * 60;

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

export const configured = env => typeof env.APP_PASSWORD === 'string' && env.APP_PASSWORD.length > 0;

export async function sha256Hex(s) {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(String(s))));
}

// Equal-length strings compared without an early exit. Both sides are always hashes here, so
// the length check leaks nothing.
export function sameHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function passwordOk(env, pw) {
  if (!configured(env) || typeof pw !== 'string' || !pw) return false;
  return sameHex(await sha256Hex(pw), await sha256Hex(env.APP_PASSWORD));
}

async function hmacKey(env) {
  const secret = (env.APP_SESSION_SECRET && String(env.APP_SESSION_SECRET)) || ('beaps-session|' + env.APP_PASSWORD);
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(secret));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}
const mac = async (env, s) => hex(await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(s)));

// v1.<expires ms>.<issued ms>.<hmac>
export async function issue(env, now) {
  const iat = now || Date.now();
  const exp = iat + SESSION_DAYS * 86400000;
  const body = `v1.${exp}.${iat}`;
  return body + '.' + await mac(env, body);
}

// { exp, iat } for a valid token, null for anything else. A token from the future is refused
// too: a clock that far off is a forgery, not a phone.
export async function verify(env, token, now) {
  if (!configured(env) || typeof token !== 'string') return null;
  const m = /^v1\.(\d{1,16})\.(\d{1,16})\.([a-f0-9]{64})$/.exec(token);
  if (!m) return null;
  if (!sameHex(await mac(env, `v1.${m[1]}.${m[2]}`), m[3])) return null;
  const exp = Number(m[1]), iat = Number(m[2]), t = now || Date.now();
  if (!(exp > t) || iat > t + 60000) return null;
  return { exp, iat };
}

export function cookieOf(request) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim();
  }
  return '';
}

// Secure only over https: the production host always is, the local test server is not, and a
// Secure cookie set over plain http is silently dropped by the browser.
const secureFlag = request => /^https:/i.test(request.url) ? '; Secure' : '';
export const setCookie = (request, token) =>
  `${COOKIE}=${token}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; SameSite=Lax${secureFlag(request)}`;
export const clearCookie = request =>
  `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secureFlag(request)}`;

export const session = (env, request, now) => verify(env, cookieOf(request), now);

// What stays reachable without a login. Guests (the signing page, the photo gallery) and the
// mail service, which fetches a report by URL to attach it, have no app password and never
// will; they are guarded by the 48-character tokens in their links instead. Pages serves
// /sign.html as /sign (a 308), so both spellings are listed. speed-ping is the one-byte health
// check in CLOUDFLARE.md.
//
// Only paths that exist as a file or a function belong here. Pages answers index.html - the
// whole app - for any path that is neither, so an open path with nothing behind it (a
// favicon.ico, say) would hand the app to anyone who asked for it by that name.
const PUBLIC = new Set([
  '/sign', '/sign.html', '/galleri', '/galleri.html',
  '/logo.svg', '/logo.png', '/beaps-logo-white.png',   // the mail's wordmark; mail clients fetch it with no cookie
  '/api/login', '/api/logout', '/api/session',
  '/api/sign-load', '/api/sign-pdf', '/api/sign-complete',
  '/api/media-list', '/api/media-file',
  '/api/speed-ping'
]);
export const isPublic = pathname => PUBLIC.has(pathname);

// A request a page on another site made the browser send: a hidden form or a script posting
// to us. Browsers say so in Sec-Fetch-Site, and name the page in Origin; a request with
// neither is a browser of our own page, or not a browser at all.
export function crossSite(request) {
  const sfs = (request.headers.get('sec-fetch-site') || '').toLowerCase();
  if (sfs && sfs !== 'same-origin' && sfs !== 'none') return true;
  const origin = request.headers.get('origin');
  if (origin) {
    try { return new URL(origin).host !== new URL(request.url).host } catch (e) { return true }
  }
  return false;
}

// The failed-login counter, per address, in the same KV namespace as everything else. Best
// effort: KV missing or failing must not stop a correct password from working. A preview
// deployment shares the namespace with production (wrangler.jsonc), so its counter is kept
// under its own name (ENV), and a lockout test there never locks the office out of the app.
export const failKey = (env, ip) => 'auth/fail/' + (env && env.ENV ? String(env.ENV) + '/' : '') + (ip || 'unknown');
export async function failsFor(env, ip) {
  try { return Number(await env.SIGNSTORE.get(failKey(env, ip))) || 0 } catch (e) { return 0 }
}
export async function noteFail(env, ip) {
  try {
    const n = (await failsFor(env, ip)) + 1;
    await env.SIGNSTORE.put(failKey(env, ip), String(n), { expirationTtl: FAIL_WINDOW_S });
    return n;
  } catch (e) { return 0 }
}
export const clientIp = request => request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';

export const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow'
};
export const needLogin = (body, status) => new Response(body || 'Not logged in', {
  status: status || 401, headers: { ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8', [LOGIN_HEADER]: 'required' }
});
