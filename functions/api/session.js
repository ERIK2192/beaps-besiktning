// Is this browser logged in?  GET /api/session  -> { ok, expires }  or 401
// Open in the middleware so it can be asked without a session; it does its own check.
import { configured, session, needLogin, NO_STORE } from '../../cflib/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!configured(env)) return new Response('The app password is not set on the server', { status: 503, headers: NO_STORE });
  const s = await session(env, request);
  if (!s) return needLogin();
  return Response.json({ ok: true, expires: s.exp }, { headers: NO_STORE });
}
