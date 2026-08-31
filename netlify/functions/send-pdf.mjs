// Emails a PDF from the app. Supports Resend or SendGrid.
// Environment variables in Netlify:
//   RESEND_API_KEY  or  SENDGRID_API_KEY   (one of them is enough)
//   MAIL_TO_SHORTSTAY  default guestservice@beaps.se
//   MAIL_TO_LONGSTAY   default longstay@beaps.se
//   MAIL_TO            optional: sends EVERYTHING to one and the same address
//   MAIL_FROM  e.g. Beaps Besiktning <besiktning@bedoma.se>
const parseFrom = raw => {
  const m = /^(.*)<(.+)>$/.exec(raw || '');
  return m ? { name: m[1].trim(), email: m[2].trim() } : { name: 'Beaps Besiktning', email: (raw || '').trim() };
};

const APP_TOKEN = 'bges-a7f3c1e9b4d2e806';

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if ((req.headers.get('x-beaps-app') || '') !== APP_TOKEN) return new Response('Reload the app', { status: 401 });

  let body;
  try { body = await req.json(); } catch { return new Response('Bad request', { status: 400 }); }
  const { filename, subject, pdf, kind } = body || {};
  if (!filename || !pdf) return new Response('Bad request', { status: 400 });

  // shortstay check-ins to guestservice, everything else to longstay
  const to = process.env.MAIL_TO
    || (kind === 'upplasning'
        ? (process.env.MAIL_TO_SHORTSTAY || 'guestservice@beaps.se')
        : (process.env.MAIL_TO_LONGSTAY || 'longstay@beaps.se'));
  const from = parseFrom(process.env.MAIL_FROM);

  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: from.email ? `${from.name} <${from.email}>` : 'onboarding@resend.dev',
        to: [to],
        subject: subject || filename,
        text: 'Attached: ' + filename,
        attachments: [{ filename, content: pdf }]
      })
    });
    if (r.status === 429) return new Response('quota', { status: 429 });
    if (!r.ok) return new Response('Mail error: ' + (await r.text()).slice(0, 300), { status: 502 });
    return Response.json({ ok: true });
  }

  if (process.env.SENDGRID_API_KEY) {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.SENDGRID_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from.email, name: from.name },
        subject: subject || filename,
        content: [{ type: 'text/plain', value: 'Attached: ' + filename }],
        attachments: [{ content: pdf, filename, type: 'application/pdf', disposition: 'attachment' }]
      })
    });
    if (r.status === 429) return new Response('quota', { status: 429 });
    if (r.status !== 202) return new Response('Mail error: ' + (await r.text()).slice(0, 300), { status: 502 });
    return Response.json({ ok: true });
  }

  return new Response('Mail is not configured', { status: 501 });
};

export const config = { path: '/api/send-pdf' };
