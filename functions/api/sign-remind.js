// Sends a reminder about a signing link that is still waiting.  POST /api/sign-remind  { t, text }
//
// The same link goes out again, to the same recipient and copy, with a short message the
// inspector may have edited in the app. Nothing else moves: the token, the report, the expiry
// and the status are exactly as they were, so a reminder can never make a second link, revoke
// the first, or touch a signature. A link that is signed, revoked or expired is refused - a
// reminder about it would only confuse.
import { sendMail, esc, stamp, appOk, typeLabel } from '../../cflib/mail.js';
import { loadRequest, store, metaTtl, ttlOpts, NO_STORE } from '../../cflib/sign.js';

// The note that a reminder went is kept beside the record, never written into it: a guest
// signing at the same moment must not have "signed" overwritten by a stale copy of "pending".
export const remindKey = token => 'remind/' + token;
export const readReminders = async (env, token) => {
  try { return (await store(env).get(remindKey(token), 'json')) || null } catch (e) { return null }
};
// Two reminders within a minute of each other are one reminder sent twice, whatever caused it.
export const COOLDOWN_MS = 60 * 1000;

export const DEFAULT_TEXT = [
  'Hi!',
  '',
  'Here is a friendly reminder to sign the inspection report for your apartment. You open and sign via the link below. Please get in touch if you have any questions or need help.',
  '',
  'Thank you!',
  'Team Longstay Beautiful Apartments'
].join('\n');

const MAX_TEXT = 2000;
// What the inspector typed, as plain text: line breaks kept, control characters and anything
// over the cap dropped. The link is appended by this function, never typed in.
export const cleanText = s => String(s == null ? '' : s)
  .replace(/\r\n?/g, '\n')
  .replace(/[^\S\n]+\n/g, '\n')
  .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '')
  .trim()
  .slice(0, MAX_TEXT);

// Paragraphs for the HTML half: blank lines split, single line breaks stay.
const paragraphs = text => text.split(/\n{2,}/).map(p => '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>').join('\n    ');

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  if (!appOk(request)) return new Response('Reload the app', { status: 401 });

  let b;
  try { b = await request.json() } catch { return new Response('Bad request', { status: 400 }) }
  if (!b || typeof b !== 'object') return new Response('Bad request', { status: 400 });

  const url = new URL(request.url);
  url.searchParams.set('t', b.t || '');
  const { fel, token, meta, status } = await loadRequest(env, url);
  if (fel) return fel;

  if (status === 'signed') return new Response('The report is already signed', { status: 409 });
  if (status === 'cancelled') return new Response('The link has been revoked', { status: 410 });
  if (status === 'expired') return new Response('The link has expired', { status: 410 });
  if (status !== 'pending') return new Response('The link is not awaiting a signature', { status: 409 });

  // The app names each attempt. A second request with the same name - a tap that landed twice,
  // a retry after the first answer was lost on the way back - is answered with what the first
  // one did, and nothing is sent again. A different attempt inside a minute is refused too.
  const attempt = String(b.attempt || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const prev = await readReminders(env, token);
  if (prev && attempt && prev.lastAttempt === attempt) {
    return Response.json({ ok: true, repeated: true, remindedAt: prev.remindedAt, reminders: prev.reminders, to: meta.to, cc: meta.cc || '' }, { headers: NO_STORE });
  }
  if (prev && Date.now() - Number(prev.remindedAt || 0) < COOLDOWN_MS) {
    return new Response('A reminder was sent less than a minute ago', { status: 429, headers: { ...NO_STORE, 'Retry-After': '60' } });
  }

  const text = cleanText(b.text) || DEFAULT_TEXT;
  // The very same address the first mail carried: sign-request keeps it on the record. A link
  // made before that was recorded is rebuilt the way sign-request built it.
  const link = (typeof meta.url === 'string' && /^https?:\/\/\S+\?t=[a-f0-9]{48}$/.test(meta.url))
    ? meta.url : url.origin + '/sign.html?t=' + token;
  const objekt = meta.ref || [meta.address, meta.apt].filter(Boolean).join(', ') || 'Beaps';
  const subject = `Reminder: sign inspection report - ${objekt}`;

  const plain = text + '\n\n' + link + '\n\n' + [
    `Property: ${objekt}`,
    meta.type ? `Type: ${typeLabel(meta.type)}` : '',
    `The link expires ${stamp(meta.expires)}.`
  ].filter(x => x !== '').join('\n');

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#16325C;line-height:1.5">
    ${paragraphs(text)}
    <p style="margin:22px 0">
      <a href="${esc(link)}" style="display:inline-block;background:#FFC629;color:#16325C;text-decoration:none;font-weight:650;padding:13px 22px;border-radius:11px;border:1px solid #E9AF12">Open and sign</a>
    </p>
    <table style="border-collapse:collapse;font-size:14px;margin:0 0 18px">
      <tr><td style="padding:2px 14px 2px 0;color:#6E7C94">Property</td><td style="padding:2px 0"><b>${esc(objekt)}</b></td></tr>
      ${meta.type ? `<tr><td style="padding:2px 14px 2px 0;color:#6E7C94">Type</td><td style="padding:2px 0">${esc(typeLabel(meta.type))}</td></tr>` : ''}
    </table>
    <p style="font-size:13px;color:#6E7C94">If the button doesn't work, paste the address into your browser:<br>${esc(link)}</p>
    <p style="font-size:13px;color:#6E7C94">The link expires ${esc(stamp(meta.expires))}.</p>
  </div>`;

  const m = await sendMail(env, { to: meta.to, cc: meta.cc || undefined, subject, text: plain, html });
  if (!m.ok) return new Response(m.error || 'The email could not be sent', { status: m.error === 'quota' ? 429 : 502 });

  // Only a note that it went, beside the record. Status, expiry, token and report stay.
  const remindedAt = Date.now();
  const reminders = ((prev && Number(prev.reminders)) || 0) + 1;
  try {
    await store(env).put(remindKey(token), JSON.stringify({ remindedAt, reminders, lastAttempt: attempt || null }), ttlOpts(metaTtl(meta)));
  } catch (e) {}

  return Response.json({ ok: true, remindedAt, reminders, to: meta.to, cc: meta.cc || '' }, { headers: NO_STORE });
}
