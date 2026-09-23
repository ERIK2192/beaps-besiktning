// Emails a PDF from the app. Same behavior as netlify/functions/send-pdf.mjs.
//   POST /api/send-pdf  { filename, subject, kind, gallery, pdf(base64) }   up to 4 MB
//   POST /api/send-pdf  { filename, subject, kind, gallery, hosted:<report id> }   bigger: the app
//                        has already parked the PDF in the gallery's storage with report-put, and
//                        the mail carries a media-file link that Resend fetches itself
import { sendMail, longstay, shortstay, appOk } from '../../cflib/mail.js';
import { readManifest, cleanToken, r2, fileKey, isReportId } from '../../cflib/media.js';
import { dbxOn, uploadFile, cleanPart } from '../../cflib/dropbox.js';
import { b64ToBytes } from '../../cflib/sign.js';

// A base64 body is parsed and re-serialised in the worker, so it stays small; anything bigger
// belongs on the hosted road. 4 MB of PDF is about 5.6 MB of base64.
const MAX_INLINE_B64 = 6 * 1024 * 1024;

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!appOk(request)) return new Response('Reload the app', { status: 401 });

  let body;
  try { body = await request.json() } catch { return new Response('Bad request', { status: 400 }) }
  const { filename, subject, pdf, kind, gallery, hosted } = body || {};
  if (!filename || (!pdf && !hosted)) return new Response('Bad request', { status: 400 });
  if (pdf && String(pdf).length > MAX_INLINE_B64) return new Response('size', { status: 413 });

  const token = cleanToken(gallery);
  let manifest = null;
  if (token) { try { manifest = await readManifest(env, token) } catch (e) {} }

  let attachment, key = null;
  if (pdf) {
    attachment = { filename, content: pdf };
  } else {
    // The report must already be in R2, or the mail would go out with a dead link. The id comes
    // from the phone, so check its shape before it is used to build a key or a URL.
    if (!isReportId(hosted)) return new Response('Bad request', { status: 400 });
    if (!manifest) return new Response('Gallery not found', { status: 404 });
    key = fileKey(token, hosted);
    let head = null;
    try { head = await r2(env).head(key) } catch (e) {}
    if (!head) return new Response('Report not found', { status: 404 });
    attachment = { filename, path: new URL(request.url).origin + '/api/media-file?t=' + token + '&id=' + hosted };
  }

  // The finished report belongs in the same Dropbox folder as its photos. Done before the mail,
  // so a report that is filed is filed even if the mail then fails; and wrapped, so a Dropbox
  // problem can never stop the mail going out.
  if (dbxOn(env) && manifest && manifest.dropbox && manifest.dropbox.path) {
    try {
      const namn = cleanPart(String(filename).replace(/\.pdf$/i, '')) + '.pdf';
      let bytes = null;
      if (pdf) bytes = b64ToBytes(pdf);
      else { const obj = await r2(env).get(key); if (obj) bytes = await obj.arrayBuffer() }
      if (bytes) await uploadFile(env, manifest.dropbox.path + '/' + namn, bytes);
    } catch (e) {}
  }

  // shortstay check-ins to guestservice, everything else to longstay
  const to = kind === 'upplasning' ? shortstay(env) : longstay(env);

  const m = await sendMail(env, {
    to,
    subject: subject || filename,
    text: 'Attached: ' + filename,
    attachments: [attachment]
  });

  if (!m.ok) {
    if (m.error === 'quota') return new Response('quota', { status: 429 });
    if (m.error === 'Mail is not configured') return new Response(m.error, { status: 501 });
    return new Response(m.error, { status: 502 });
  }
  return Response.json({ ok: true });
}
