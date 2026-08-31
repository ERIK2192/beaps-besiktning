// Emails a PDF from the app. Same behavior as netlify/functions/send-pdf.mjs.
//   POST /api/send-pdf  { filename, subject, pdf(base64), kind }
import { sendMail, longstay, shortstay, appOk } from '../../cflib/mail.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!appOk(request)) return new Response('Reload the app', { status: 401 });

  let body;
  try { body = await request.json() } catch { return new Response('Bad request', { status: 400 }) }
  const { filename, subject, pdf, kind } = body || {};
  if (!filename || !pdf) return new Response('Bad request', { status: 400 });

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
