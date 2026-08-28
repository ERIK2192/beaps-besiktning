// Aterkallar en signeringslank.  POST /api/sign-cancel  { t }
import { loadRequest, store, writeMeta } from '../../cflib/sign.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let b;
  try { b = await request.json() } catch { return new Response('Bad request', { status: 400 }) }

  const url = new URL(request.url);
  url.searchParams.set('t', b.t || '');
  const { fel, token, meta, status } = await loadRequest(env, url);
  if (fel) return fel;

  if (status === 'signed') return new Response('Redan signerat', { status: 409 });

  await writeMeta(env, token, { ...meta, status: 'cancelled', cancelledAt: Date.now() });
  await store(env).delete('pdf/' + token).catch(() => {});
  return Response.json({ ok: true, status: 'cancelled' });
}
