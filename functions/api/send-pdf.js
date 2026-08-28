// Mejlar en PDF fran appen. Samma beteende som netlify/functions/send-pdf.mjs.
//   POST /api/send-pdf  { filename, subject, pdf(base64), kind }
import { sendMail, longstay, shortstay } from '../../cflib/mail.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try { body = await request.json() } catch { return new Response('Bad request', { status: 400 }) }
  const { filename, subject, pdf, kind } = body || {};
  if (!filename || !pdf) return new Response('Bad request', { status: 400 });

  // shortstay-upplasningar till guestservice, allt annat till longstay
  const to = kind === 'upplasning' ? shortstay(env) : longstay(env);

  const m = await sendMail(env, {
    to,
    subject: subject || filename,
    text: 'Bifogat: ' + filename,
    attachments: [{ filename, content: pdf }]
  });

  if (!m.ok) {
    if (m.error === 'quota') return new Response('quota', { status: 429 });
    if (m.error === 'Mail ar inte konfigurerat') return new Response(m.error, { status: 501 });
    return new Response(m.error, { status: 502 });
  }
  return Response.json({ ok: true });
}
