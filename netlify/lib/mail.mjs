// Delad mejlhjalp for signeringsfunktionerna. Stodjer Resend eller SendGrid,
// samma miljovariabler som send-pdf.mjs. send-pdf.mjs har en egen kopia och lamnas
// orord for att inte rora det som redan fungerar i produktion.

const parseFrom = raw => {
  const m = /^(.*)<(.+)>$/.exec(raw || '');
  return m ? { name: m[1].trim(), email: m[2].trim() } : { name: 'Beaps Besiktning', email: (raw || '').trim() };
};

export const mailFrom = () => parseFrom(process.env.MAIL_FROM);

export const longstay = () => process.env.MAIL_TO || process.env.MAIL_TO_LONGSTAY || 'longstay@beaps.se';

export const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

// Avsandaradressen ar ofta en ren utskicksadress utan brevlada, sa svar pa den
// studsar. Satt MAIL_REPLY_TO till en adress som gar att na, sa hamnar svar dar.
export const replyTo = () => (process.env.MAIL_REPLY_TO || '').trim();

// { to, cc, subject, text, html, attachments:[{filename, content(base64)}] }
export async function sendMail({ to, cc, subject, text, html, attachments }) {
  const from = mailFrom();
  const svara = replyTo();
  const toList = [].concat(to || []).map(x => (x || '').trim()).filter(Boolean);
  const ccList = [].concat(cc || []).map(x => (x || '').trim()).filter(Boolean);
  const files = (attachments || []).filter(a => a && a.content);
  if (!toList.length) return { ok: false, error: 'Ingen mottagare angiven' };

  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: from.email ? `${from.name} <${from.email}>` : 'onboarding@resend.dev',
        to: toList,
        ...(ccList.length ? { cc: ccList } : {}),
        ...(svara ? { reply_to: svara } : {}),
        subject,
        text,
        ...(html ? { html } : {}),
        ...(files.length ? { attachments: files.map(a => ({ filename: a.filename, content: a.content })) } : {})
      })
    });
    if (r.status === 429) return { ok: false, error: 'quota' };
    if (!r.ok) return { ok: false, error: 'Mailfel: ' + (await r.text()).slice(0, 300) };
    return { ok: true };
  }

  if (process.env.SENDGRID_API_KEY) {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.SENDGRID_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{
          to: toList.map(email => ({ email })),
          ...(ccList.length ? { cc: ccList.map(email => ({ email })) } : {})
        }],
        from: { email: from.email, name: from.name },
        ...(svara ? { reply_to: { email: svara } } : {}),
        subject,
        content: [
          { type: 'text/plain', value: text || ' ' },
          ...(html ? [{ type: 'text/html', value: html }] : [])
        ],
        ...(files.length ? {
          attachments: files.map(a => ({
            content: a.content, filename: a.filename, type: 'application/pdf', disposition: 'attachment'
          }))
        } : {})
      })
    });
    if (r.status === 429) return { ok: false, error: 'quota' };
    if (r.status !== 202) return { ok: false, error: 'Mailfel: ' + (await r.text()).slice(0, 300) };
    return { ok: true };
  }

  return { ok: false, error: 'Mail ar inte konfigurerat' };
}

export const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Funktionerna kor i UTC, protokollen last i Sverige. Formatera darefter.
export const stamp = ms => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
}).format(new Date(ms)).replace(',', '');
