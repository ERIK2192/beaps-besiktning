// Takes the report for a signing link as raw bytes and parks it in R2.
//   PUT /api/sign-upload   body: the PDF   ->  { ok, id }
//
// The id comes back and is handed to sign-request, which ties it to the link's token. Sending
// the PDF base64-encoded inside sign-request's JSON body is the older road; it still works and
// is what the app falls back to on a host without this endpoint, but it cannot carry a real
// move-out report - parsing 20 MB of JSON costs far more than the ten milliseconds of CPU a
// request gets on the free plan, while a stream into R2 costs none.
import { MAX_PDF, newPdfId, pdfKey, NO_STORE } from '../../cflib/sign.js';
import { appOk } from '../../cflib/mail.js';
import { r2 } from '../../cflib/media.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'PUT' && request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!appOk(request)) return new Response('Reload the app', { status: 401 });

  const cl = request.headers.get('content-length');
  const langd = cl == null ? null : Number(cl);
  if (langd === 0) return new Response('The report is empty', { status: 400 });
  if (langd > MAX_PDF) return new Response('size', { status: 413 });

  const id = newPdfId();
  try {
    await r2(env).put(pdfKey(id), request.body, {
      httpMetadata: { contentType: 'application/pdf', cacheControl: 'private, max-age=60' }
    });
  } catch (e) {
    return new Response('Could not store the report: ' + String(e.message).slice(0, 160), { status: 502 });
  }
  return Response.json({ ok: true, id }, { headers: NO_STORE });
}
