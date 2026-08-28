// Skapar en signeringslank. Appen laddar upp det fardiga protokollet, funktionen
// lagger det i Netlify Blobs bakom en slumpad token och mejlar lanken till mottagaren.
//
// POST /api/sign-request
//   { pdf(base64), filename, ref, type, address, apt, inspector,
//     to, cc, recipientName, recipientRole }
//   -> { ok, token, url, expires }
import { getStore } from '@netlify/blobs';
import { sendMail, isEmail, esc, stamp } from '../lib/mail.mjs';

const MAX_PDF = 4 * 1024 * 1024;   // samma tak som mejlutskicket i appen
const GILTIGHET_DAGAR = 30;

const newToken = () =>
  [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let b;
  try { b = await req.json() } catch { return new Response('Bad request', { status: 400 }) }

  const to = (b.to || '').trim();
  const cc = (b.cc || '').trim();
  if (!isEmail(to)) return new Response('Ogiltig mottagaradress', { status: 400 });
  if (cc && !isEmail(cc)) return new Response('Ogiltig CC-adress', { status: 400 });
  if (!b.pdf) return new Response('PDF saknas', { status: 400 });

  const bytes = Math.round((b.pdf.length - (b.pdf.indexOf(',') + 1)) * 0.75);
  if (bytes > MAX_PDF) return new Response('size', { status: 413 });

  const token = newToken();
  const now = Date.now();
  const meta = {
    token, created: now, expires: now + GILTIGHET_DAGAR * 86400000, status: 'pending',
    ref: b.ref || '', type: b.type || '', address: b.address || '', apt: b.apt || '',
    inspector: b.inspector || '', filename: b.filename || 'Besiktningsprotokoll.pdf',
    to, cc, recipientName: b.recipientName || '', recipientRole: b.recipientRole || '',
    signedAt: null, signedName: null, signedRole: null
  };

  const store = getStore({ name: 'signrequests', consistency: 'strong' });
  try {
    await store.set('pdf/' + token, b.pdf);
    await store.setJSON('meta/' + token, meta);
  } catch (e) {
    return new Response('Kunde inte lagra protokollet: ' + String(e && e.message).slice(0, 200), { status: 502 });
  }

  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || new URL(req.url).origin;
  const url = `${base}/sign.html?t=${token}`;
  const vem = meta.recipientName ? meta.recipientName : 'du';
  const rubrik = `Signera besiktningsprotokoll - ${meta.ref || meta.address || 'Beaps'}`;

  const text = [
    `Hej${meta.recipientName ? ' ' + meta.recipientName : ''},`,
    '',
    `${meta.inspector || 'Beaps'} har gjort en besiktning som ${vem} ombeds signera.`,
    '',
    `Objekt: ${meta.ref || [meta.address, meta.apt].filter(Boolean).join(', ')}`,
    meta.type ? `Typ: ${meta.type}` : '',
    `Besiktningsman: ${meta.inspector || '-'}`,
    '',
    'Oppna lanken nedan. Dar visas hela protokollet med bilder och kommentarer,',
    'och langst ner signerar du direkt i webblasaren.',
    '',
    url,
    '',
    `Lanken gar ut ${stamp(meta.expires)}.`
  ].filter(x => x !== '').join('\n');

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#16325C;line-height:1.5">
    <p>Hej${meta.recipientName ? ' ' + esc(meta.recipientName) : ''},</p>
    <p>${esc(meta.inspector || 'Beaps')} har gjort en besiktning som ${esc(vem)} ombeds signera.</p>
    <table style="border-collapse:collapse;font-size:14px;margin:0 0 18px">
      <tr><td style="padding:2px 14px 2px 0;color:#6E7C94">Objekt</td><td style="padding:2px 0"><b>${esc(meta.ref || [meta.address, meta.apt].filter(Boolean).join(', '))}</b></td></tr>
      ${meta.type ? `<tr><td style="padding:2px 14px 2px 0;color:#6E7C94">Typ</td><td style="padding:2px 0">${esc(meta.type)}</td></tr>` : ''}
      <tr><td style="padding:2px 14px 2px 0;color:#6E7C94">Besiktningsman</td><td style="padding:2px 0">${esc(meta.inspector || '-')}</td></tr>
    </table>
    <p>I länken visas <b>hela protokollet</b> med bilder och kommentarer. Längst ner signerar du direkt i webbläsaren.</p>
    <p style="margin:22px 0">
      <a href="${esc(url)}" style="display:inline-block;background:#FFC629;color:#16325C;text-decoration:none;font-weight:650;padding:13px 22px;border-radius:11px;border:1px solid #E9AF12">Öppna och signera</a>
    </p>
    <p style="font-size:13px;color:#6E7C94">Fungerar inte knappen, klistra in adressen i webbläsaren:<br>${esc(url)}</p>
    <p style="font-size:13px;color:#6E7C94">Länken går ut ${esc(stamp(meta.expires))}.</p>
  </div>`;

  const m = await sendMail({ to, cc: cc || undefined, subject: rubrik, text, html });
  if (!m.ok) {
    await store.delete('pdf/' + token).catch(() => {});
    await store.delete('meta/' + token).catch(() => {});
    return new Response(m.error || 'Mejlet gick inte att skicka', { status: m.error === 'quota' ? 429 : 502 });
  }

  return Response.json({ ok: true, token, url, expires: meta.expires });
};

export const config = { path: '/api/sign-request' };
