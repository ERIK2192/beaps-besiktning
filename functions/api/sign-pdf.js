// Sjalva protokollet, for visning i signeringssidan.  GET /api/sign-pdf?t=<token>
// Signaturintyget efter signering:                    GET /api/sign-pdf?t=<token>&cert=1
//
// The report is streamed straight out of R2, so no worker ever holds it and a big one costs
// no CPU at all. Range is answered because that is what lets a phone's PDF viewer page
// through a large document instead of waiting for the whole file. This is also the URL the
// mail service fetches when it attaches the report to the signed email.
import { NO_STORE, loadRequest, store, b64ToBytes, isPdfId, pdfKey } from '../../cflib/sign.js';
import { r2 } from '../../cflib/media.js';

const head = (name, extra) => ({
  ...NO_STORE,
  'Content-Type': 'application/pdf',
  'X-Content-Type-Options': 'nosniff',
  // Content-Disposition ar en ByteString - tecken utanfor Latin-1 (emoji o.dyl.) kastar.
  'Content-Disposition': `inline; filename="${name}"`,
  ...(extra || {})
});

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const { fel, token, meta, status } = await loadRequest(env, url);
  if (fel) return fel;

  if (status !== 'pending' && status !== 'signed') {
    return new Response('Lanken galler inte langre', { status: 410 });
  }

  const safeName = (meta.filename || 'protokoll.pdf').replace(/["\\\r\n]/g, '').replace(/[^\x20-\x7E]/g, '_');

  // The signature certificate is a single page, so it stays in KV as base64.
  if (url.searchParams.get('cert')) {
    const cert = await store(env).get('cert/' + token, 'text');
    if (cert) {
      return new Response(b64ToBytes(cert), {
        headers: head(safeName.replace(/\.pdf$/i, '') + ' - signature.pdf')
      });
    }
    // A link signed before the split has no certificate of its own: back then the signature
    // page was merged into the report and archived under `signed/`. That document is what
    // this link is for, so serve it under its own name rather than answering 404.
    const gammal = await store(env).get('signed/' + token, 'text');
    if (gammal) {
      return new Response(b64ToBytes(gammal), {
        headers: head(safeName.replace(/\.pdf$/i, '') + ' signed.pdf')
      });
    }
    return new Response('Signaturintyget hittades inte', { status: 404 });
  }

  if (isPdfId(meta.pdfId)) {
    const range = request.headers.get('range');
    let obj;
    try { obj = await r2(env).get(pdfKey(meta.pdfId), range ? { range: request.headers } : undefined) }
    catch (e) { return new Response('Kunde inte hamta protokollet', { status: 502 }) }
    if (obj) {
      const h = new Headers(head(safeName, { 'Accept-Ranges': 'bytes' }));
      if (obj.range && obj.size != null) {
        const start = obj.range.offset || 0;
        const len = obj.range.length != null ? obj.range.length : obj.size - start;
        h.set('Content-Range', `bytes ${start}-${start + len - 1}/${obj.size}`);
        return new Response(obj.body, { status: 206, headers: h });
      }
      return new Response(obj.body, { headers: h });
    }
  }

  // Links made before the report moved to R2 keep their base64 in KV.
  let b64 = await store(env).get('pdf/' + token, 'text');
  // Har originalet gatt ut men protokollet ar signerat, visa det arkiverade signerade.
  if (!b64) b64 = await store(env).get('signed/' + token, 'text');
  if (!b64) return new Response('Protokollet hittades inte', { status: 404 });

  return new Response(b64ToBytes(b64), { headers: head(safeName) });
}
