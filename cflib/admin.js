// Admin access to the key register (2026-10-13). Same pattern as the team login in auth.js -
// a password held only as a Cloudflare secret, a signed HttpOnly cookie, a fail counter - with
// its own secret, ADMIN_PASSWORD, and its own cookie. The team login still stands in front
// (functions/_middleware.js); this is a second door behind it, checked by the server on every
// admin call. The phone only ever learns yes or no.
//
// Fails closed: without ADMIN_PASSWORD, or with it equal to the team password, nobody is admin.
// The signing key is derived from ADMIN_PASSWORD, so changing it logs every admin out.
import { cookieOf, sha256Hex, sameHex } from './auth.js';

export const ADMIN_COOKIE = 'beaps_admin';
export const ADMIN_DAYS = 30;
export const ADMIN_FAIL = 'afail';

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

export const adminConfigured = env =>
  typeof env.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length > 0 && env.ADMIN_PASSWORD !== env.APP_PASSWORD;

export async function adminPasswordOk(env, pw) {
  if (!adminConfigured(env) || typeof pw !== 'string' || !pw) return false;
  return sameHex(await sha256Hex(pw), await sha256Hex(env.ADMIN_PASSWORD));
}

async function mac(env, s) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode('beaps-admin|' + env.ADMIN_PASSWORD));
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(s)));
}

export async function adminIssue(env, now) {
  const iat = now || Date.now();
  const body = `a1.${iat + ADMIN_DAYS * 86400000}.${iat}`;
  return body + '.' + await mac(env, body);
}

export async function adminVerify(env, token, now) {
  if (!adminConfigured(env) || typeof token !== 'string') return false;
  const m = /^a1\.(\d{1,16})\.(\d{1,16})\.([a-f0-9]{64})$/.exec(token);
  if (!m || !sameHex(await mac(env, `a1.${m[1]}.${m[2]}`), m[3])) return false;
  const t = now || Date.now();
  return Number(m[1]) > t && Number(m[2]) <= t + 60000;
}

export const isAdmin = (env, request) => adminVerify(env, cookieOf(request, ADMIN_COOKIE));

const secure = request => /^https:/i.test(request.url) ? '; Secure' : '';
export const adminCookie = (request, token) =>
  `${ADMIN_COOKIE}=${token}; Path=/api/; Max-Age=${ADMIN_DAYS * 86400}; HttpOnly; SameSite=Strict${secure(request)}`;
export const adminClear = request =>
  `${ADMIN_COOKIE}=; Path=/api/; Max-Age=0; HttpOnly; SameSite=Strict${secure(request)}`;
