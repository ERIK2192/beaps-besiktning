// Mejlhjalp for Cloudflare Pages Functions.
// Skillnad mot Netlify-versionen: miljovariabler kommer fran env, inte process.env.
// Cloudflare Workers har inget process-objekt alls.

const parseFrom = raw => {
  const m = /^(.*)<(.+)>$/.exec(raw || '');
  return m ? { name: m[1].trim(), email: m[2].trim() } : { name: 'Beaps Besiktning', email: (raw || '').trim() };
};

export const mailFrom = env => parseFrom(env.MAIL_FROM);

export const longstay = env => env.MAIL_TO || env.MAIL_TO_LONGSTAY || 'longstay@beaps.se';
export const shortstay = env => env.MAIL_TO || env.MAIL_TO_SHORTSTAY || 'guestservice@beaps.se';

export const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

export const esc = s => String(s == null ? '' : s)
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Funktionerna kor i UTC, protokollen las i Sverige.
export const stamp = ms => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Stockholm',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
}).format(new Date(ms)).replace(',', '');

// { to, cc, subject, text, html, attachments:[{filename, content(base64)}] }
export async function sendMail(env, { to, cc, subject, text, html, attachments }) {
  const from = mailFrom(env);
  const toList = [].concat(to || []).map(x => (x || '').trim()).filter(Boolean);
  const ccList = [].concat(cc || []).map(x => (x || '').trim()).filter(Boolean);
  const files = (attachments || []).filter(a => a && a.content);
  if (!toList.length) return { ok: false, error: 'Ingen mottagare angiven' };

  if (env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: from.email ? `${from.name} <${from.email}>` : 'onboarding@resend.dev',
        to: toList,
        ...(ccList.length ? { cc: ccList } : {}),
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

  if (env.SENDGRID_API_KEY) {
    const r = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.SENDGRID_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{
          to: toList.map(email => ({ email })),
          ...(ccList.length ? { cc: ccList.map(email => ({ email })) } : {})
        }],
        from: { email: from.email, name: from.name },
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
