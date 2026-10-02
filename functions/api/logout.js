// Clears the session cookie.  POST /api/logout
// The token is not kept anywhere on the server, so there is nothing to revoke: a cookie the
// browser no longer sends is a session that no longer exists. Refused from another site, so a
// page elsewhere cannot log a phone out by posting here.
import { clearCookie, crossSite, NO_STORE } from '../../cflib/auth.js';

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (crossSite(request)) return new Response('Cross-site request refused', { status: 403, headers: NO_STORE });
  return Response.json({ ok: true }, { headers: { ...NO_STORE, 'Set-Cookie': clearCookie(request) } });
}
