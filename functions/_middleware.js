// The login wall. Runs in front of everything on the Cloudflare host: the app, the registers,
// the notes, and every /api endpoint the app itself calls. A request without a valid session
// cookie gets the login page (for a page) or a 401 (for an API call) and never reaches the
// asset or the function behind it.
//
// What is left open is listed in cflib/auth.js: the guest's signing page and gallery, the
// endpoints those two pages call, the report URL the mail service fetches, and the login
// endpoints themselves. Everything guests reach is behind the 48-character token in their
// link, as before.
//
// Fails closed. With no APP_PASSWORD set the app is not served and the page says what to set,
// rather than quietly running open. Set the secret before the deploy that brings this file.
import { session, issue, setCookie, isPublic, configured, RENEW_AFTER_MS, needLogin, NO_STORE } from '../cflib/auth.js';
import { loginPage } from '../cflib/login-page.js';

const page = (html, status) => new Response(html, {
  status, headers: { ...NO_STORE, 'Content-Type': 'text/html; charset=utf-8' }
});

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  if (isPublic(url.pathname)) return next();

  const navigation = (request.method === 'GET' || request.method === 'HEAD')
    && /text\/html/i.test(request.headers.get('accept') || '');

  if (!configured(env)) {
    return navigation ? page(loginPage({ unconfigured: true }), 503)
                      : new Response('The app password is not set on the server', { status: 503, headers: NO_STORE });
  }

  const s = await session(env, request);
  if (!s) return navigation ? page(loginPage(), 401) : needLogin();

  const res = await next();
  // A phone in daily use never sees the login page again: each visit older than a day gets
  // a fresh cookie. Only on the page itself, not on every photo upload.
  if (navigation && Date.now() - s.iat > RENEW_AFTER_MS) {
    const out = new Response(res.body, res);
    out.headers.append('Set-Cookie', setCookie(request, await issue(env)));
    return out;
  }
  return res;
}
