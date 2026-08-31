// Sjalva protokollet, for visning i signeringssidan.  GET /api/sign-pdf?t=<token>
import { NO_STORE, loadRequest, store, b64ToBytes } from '../../cflib/sign.js';

export async function onRequest(context) {
  const { request, env } = context;
  const { fel, token, meta, status } = await loadRequest(env, new URL(request.url));
  if (fel) return fel;

  if (status !== 'pending' && status !== 'signed') {
    return new Response('Lanken galler inte langre', { status: 410 });
  }

  let b64 = await store(env).get('pdf/' + token, 'text');
  // Har originalet gatt ut men protokollet ar signerat, visa det arkiverade signerade.
  if (!b64) b64 = await store(env).get('signed/' + token, 'text');
  if (!b64) return new Response('Protokollet hittades inte', { status: 404 });

  // Content-Disposition ar en ByteString - tecken utanfor Latin-1 (emoji o.dyl.) kastar.
  const safeName = (meta.filename || 'protokoll.pdf').replace(/["\\\r\n]/g, '').replace(/[^\x20-\x7E]/g, '_');
  return new Response(b64ToBytes(b64), {
    headers: {
      ...NO_STORE,
      'Content-Type': 'application/pdf',
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': `inline; filename="${safeName}"`
    }
  });
}
