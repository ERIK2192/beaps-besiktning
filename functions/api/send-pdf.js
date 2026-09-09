// Emails a PDF from the app. Same behavior as netlify/functions/send-pdf.mjs.
//   POST /api/send-pdf  { filename, subject, pdf(base64), kind }
import { sendMail, longstay, shortstay, appOk } from '../../cflib/mail.js';
import { readManifest, cleanToken } from '../../cflib/media.js';
import { dbxOn, uploadFile, cleanPart } from '../../cflib/dropbox.js';
import { b64ToBytes } from '../../cflib/sign.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!appOk(request)) return new Response('Reload the app', { status: 401 });

  let body;
  try { body = await request.json() } catch { return new Response('Bad request', { status: 400 }) }
  const { filename, subject, pdf, kind, gallery } = body || {};
  if (!filename || !pdf) return new Response('Bad request', { status: 400 });

  // The finished report belongs in the same Dropbox folder as its photos. Done before the mail,
  // so a report that is filed is filed even if the mail then fails; and wrapped, so a Dropbox
  // problem can never stop the mail going out.
  if (dbxOn(env) && gallery) {
    try {
      const m = await readManifest(env, cleanToken(gallery));
      if (m && m.dropbox && m.dropbox.path) {
        const namn = cleanPart(String(filename).replace(/\.pdf$/i, '')) + '.pdf';
        await uploadFile(env, m.dropbox.path + '/' + namn, b64ToBytes(pdf));
      }
    } catch (e) {}
  }

  // shortstay check-ins to guestservice, everything else to longstay
  const to = kind === 'upplasning' ? shortstay(env) : longstay(env);

  const m = await sendMail(env, {
    to,
    subject: subject || filename,
    text: 'Attached: ' + filename,
    attachments: [{ filename, content: pdf }]
  });

  if (!m.ok) {
    if (m.error === 'quota') return new Response('quota', { status: 429 });
    if (m.error === 'Mail is not configured') return new Response(m.error, { status: 501 });
    return new Response(m.error, { status: 502 });
  }
  return Response.json({ ok: true });
}
