// Mejlar en PDF fran appen. Stodjer Resend eller SendGrid.
// Miljovariabler i Netlify:
//   RESEND_API_KEY  eller  SENDGRID_API_KEY   (en av dem racker)
//   MAIL_TO_SHORTSTAY  standard guestservice@beaps.se
//   MAIL_TO_LONGSTAY   standard longstay@beaps.se
//   MAIL_TO            valfri: skickar ALLT till en och samma adress
//   MAIL_FROM  t.ex. Beaps Besiktning <besiktning@bedoma.se>
const parseFrom = raw => {
  const m = /^(.*)<(.+)>$/.exec(raw || '');
  return m ? { name: m[1].trim(), email: m[2].trim() } : { name: 'Beaps Besiktning', email: (raw || '').trim() };
};

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let body;
  try { body = await req.json(); } catch { return new Response('Bad request', { status: 400 }); }
  const { filename, subject, pdf, kind } = body || {};
  if (!filename || !pdf) return new Response('Bad request', { status: 400 });

  // shortstay-upplasningar till guestservice, allt annat till longstay
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
        text: 'Bifogat: ' + filename,
        attachments: [{ filename, content: pdf }]
      })
    });
    if (r.status === 429) return new Response('quota', { status: 429 });
    if (!r.ok) return new Response('Mailfel: ' + (await r.text()).slice(0, 300), { status: 502 });
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
        content: [{ type: 'text/plain', value: 'Bifogat: ' + filename }],
        attachments: [{ content: pdf, filename, type: 'application/pdf', disposition: 'attachment' }]
      })
    });
    if (r.status === 429) return new Response('quota', { status: 429 });
    if (r.status !== 202) return new Response('Mailfel: ' + (await r.text()).slice(0, 300), { status: 502 });
    return Response.json({ ok: true });
  }

  return new Response('Mail ar inte konfigurerat', { status: 501 });
};

export const config = { path: '/api/send-pdf' };
