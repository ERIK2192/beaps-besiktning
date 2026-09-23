// Parks a finished report next to its photos, so send-pdf can mail it as a link that Resend
// fetches from media-file instead of as base64 inside a JSON body.
//   PUT /api/report-put?t=<gallery token>   body: the PDF itself
//
// Up to 4 MB the app still posts the PDF straight to send-pdf. Above that this is the road:
// the bytes stream from the phone into R2 here and from R2 to Resend in media-file, and no
// worker ever holds them as text. Parsing a 15 MB JSON body would take more than the ten
// milliseconds of CPU the free plan allows a request; streaming takes none.
import { MAX_REPORT, REPORT_PREFIX, newReportId, loadGallery, r2, fileKey, NO_STORE, appOk } from '../../cflib/media.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'PUT' && request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!appOk(request)) return new Response('Reload the app', { status: 401 });

  const { fel, token } = await loadGallery(env, new URL(request.url));
  if (fel) return fel;

  // The browser always sends the length of a Blob body, and R2 needs it to store a stream; if it
  // is ever missing the put below says so in its own words.
  const cl = request.headers.get('content-length');
  const langd = cl == null ? null : Number(cl);
  if (langd === 0) return new Response('The report is empty', { status: 400 });
  if (langd > MAX_REPORT) return new Response('size', { status: 413 });

  const id = newReportId();
  try {
    await r2(env).put(fileKey(token, id), request.body, {
      httpMetadata: { contentType: 'application/pdf', cacheControl: 'private, max-age=60' }
    });
  } catch (e) {
    return new Response('Could not store the report: ' + String(e.message).slice(0, 160), { status: 502 });
  }

  // Drop the report from an earlier send of the same inspection. After the new one is safely
  // stored, and wrapped: a gallery keeping two reports for a while costs nothing, losing the
  // one just uploaded would cost the mail.
  try {
    const gamla = await r2(env).list({ prefix: fileKey(token, REPORT_PREFIX) });
    for (const o of (gamla.objects || [])) {
      if (o.key !== fileKey(token, id)) await r2(env).delete(o.key);
    }
  } catch (e) {}

  return Response.json({ ok: true, id }, { headers: NO_STORE });
}
