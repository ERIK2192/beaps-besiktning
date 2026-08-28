// Lasesidan for en signeringslank.
//   GET /api/sign-load?t=<token>  -> metadata om protokollet
//   GET /api/sign-pdf?t=<token>   -> sjalva PDF:en, for visning i sidan
import { getStore } from '@netlify/blobs';

const store = () => getStore({ name: 'signrequests', consistency: 'strong' });
const cleanToken = s => (s || '').replace(/[^a-f0-9]/g, '');

export default async (req) => {
  const url = new URL(req.url);
  const token = cleanToken(url.searchParams.get('t'));
  if (token.length !== 48) return new Response('Ogiltig lank', { status: 400 });

  let meta;
  try { meta = await store().get('meta/' + token, { type: 'json' }) }
  catch { return new Response('Kunde inte lasa lanken', { status: 502 }) }
  if (!meta) return new Response('Lanken finns inte', { status: 404 });

  const expired = Date.now() > meta.expires;
  const status = meta.status === 'pending' && expired ? 'expired' : meta.status;

  if (url.pathname.endsWith('/sign-pdf')) {
    if (status !== 'pending' && status !== 'signed') {
      return new Response('Lanken galler inte langre', { status: 410 });
    }
    const b64 = await store().get('pdf/' + token, { type: 'text' });
    if (!b64) return new Response('Protokollet hittades inte', { status: 404 });
    const safeName = (meta.filename || 'protokoll.pdf').replace(/["\\\r\n]/g, '');
    return new Response(Buffer.from(b64, 'base64'), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${safeName}"`,
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow'
      }
    });
  }

  return Response.json({
    status,
    ref: meta.ref, type: meta.type, address: meta.address, apt: meta.apt,
    inspector: meta.inspector, filename: meta.filename,
    recipientName: meta.recipientName, recipientRole: meta.recipientRole,
    created: meta.created, expires: meta.expires,
    signedAt: meta.signedAt, signedName: meta.signedName, signedRole: meta.signedRole
  }, { headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
};

export const config = { path: ['/api/sign-load', '/api/sign-pdf'] };
