// Takes the team password and sets the session cookie.  POST /api/login  { password }
//
// Wrong answers are counted per address in KV and paused after ten in fifteen minutes, and
// every wrong answer waits most of a second before it is answered - enough to make guessing
// by hand pointless. The counter is read-then-write on KV, so a burst of parallel guesses can
// slip past it; the rate-limiting rule on /api/login in the Cloudflare dashboard (Security ->
// WAF, see CLOUDFLARE.md) is what actually holds. Only a JSON body from our own page is taken:
// a form or script on another site cannot send that without a preflight it would fail.
import { configured, passwordOk, issue, setCookie, failsFor, noteFail, clientIp, crossSite, MAX_FAILS, NO_STORE } from '../../cflib/auth.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));

// A first line against bursts, inside this isolate: more than ten answers to one address in
// ten seconds and the rest are refused before the password is even looked at. Isolates come
// and go, and a colo may run several, so this is a speed bump; the WAF rule is the lock.
export const BURST_MAX = 10, BURST_WINDOW_MS = 10 * 1000;
const recent = new Map();
export function burst(ip, now) {
  const t = now || Date.now();
  const list = (recent.get(ip) || []).filter(x => t - x < BURST_WINDOW_MS);
  list.push(t);
  if (recent.size > 2000) recent.clear();
  recent.set(ip, list);
  return list.length > BURST_MAX;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!configured(env)) return new Response('The app password is not set on the server', { status: 503, headers: NO_STORE });
  if (crossSite(request)) return new Response('Cross-site request refused', { status: 403, headers: NO_STORE });
  if (!/application\/json/i.test(request.headers.get('content-type') || '')) return new Response('Bad request', { status: 400 });

  let b;
  try { b = await request.json() } catch { return new Response('Bad request', { status: 400 }) }
  if (!b || typeof b !== 'object') return new Response('Bad request', { status: 400 });

  const ip = clientIp(request);
  if (burst(ip)) return new Response('Too many attempts', { status: 429, headers: { ...NO_STORE, 'Retry-After': '10' } });
  if (await failsFor(env, ip) >= MAX_FAILS) {
    return new Response('Too many attempts', { status: 429, headers: { ...NO_STORE, 'Retry-After': '900' } });
  }

  if (!await passwordOk(env, b.password)) {
    await noteFail(env, ip);
    await sleep(700);
    return new Response('Wrong password', { status: 401, headers: NO_STORE });
  }

  const token = await issue(env);
  return Response.json({ ok: true }, { headers: { ...NO_STORE, 'Set-Cookie': setCookie(request, token) } });
}
