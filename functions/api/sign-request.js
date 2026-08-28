// Skapar en signeringslank. Appen laddar upp det fardiga protokollet, funktionen
// lagger det i Cloudflare KV bakom en slumpad token och mejlar lanken till mottagaren.
//
//   POST /api/sign-request -> { ok, token, url, expires }
import { sendMail, isEmail, esc, stamp } from '../../cflib/mail.js';
import { GILTIGHET_DAGAR, MAX_PDF, newToken, store, writeMeta, b64Bytes } from '../../cflib/sign.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let b;
  try { b = await request.json() } catch { return new Response('Bad request', { status: 400 }) }

  const to = (b.to || '').trim();
  const cc = (b.cc || '').trim();
  if (!isEmail(to)) return new Response('Ogiltig mottagaradress', { status: 400 });
  if (cc && !isEmail(cc)) return new Response('Ogiltig CC-adress', { status: 400 });
  if (!b.pdf) return new Response('PDF saknas', { status: 400 });
  if (b64Bytes(b.pdf) > MAX_PDF) return new Response('size', { status: 413 });

  const token = newToken();
  const now = Date.now();
  const meta = {
    token, created: now, expires: now + GILTIGHET_DAGAR * 86400000, status: 'pending',
    ref: b.ref || '', type: b.type || '', address: b.address || '', apt: b.apt || '',
    inspector: b.inspector || '', filename: b.filename || 'Besiktningsprotokoll.pdf',
    to, cc, recipientName: b.recipientName || '', recipientRole: b.recipientRole || '',
    signedAt: null, signedName: null, signedRole: null
  };

  try {
    await store(env).put('pdf/' + token, b.pdf,
      { expirationTtl: GILTIGHET_DAGAR * 86400 + 7 * 86400 });
    await writeMeta(env, token, meta);
  } catch (e) {
    return new Response('Kunde inte lagra protokollet: ' + String(e && e.message).slice(0, 200), { status: 502 });
  }

  const url = new URL(request.url).origin + '/sign.html?t=' + token;
  const vem = meta.recipientName ? meta.recipientName : 'du';
  const rubrik = `Signera besiktningsprotokoll - ${meta.ref || meta.address || 'Beaps'}`;
  const objekt = meta.ref || [meta.address, meta.apt].filter(Boolean).join(', ');

  const text = [
    `Hej${meta.recipientName ? ' ' + meta.recipientName : ''},`,
    '',
    `${meta.inspector || 'Beaps'} har gjort en besiktning som ${vem} ombeds signera.`,
    '',
    `Objekt: ${objekt}`,
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
      <tr><td style="padding:2px 14px 2px 0;color:#6E7C94">Objekt</td><td style="padding:2px 0"><b>${esc(objekt)}</b></td></tr>
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

  const m = await sendMail(env, { to, cc: cc || undefined, subject: rubrik, text, html });
  if (!m.ok) {
    await store(env).delete('pdf/' + token).catch(() => {});
    await store(env).delete('meta/' + token).catch(() => {});
    return new Response(m.error || 'Mejlet gick inte att skicka', { status: m.error === 'quota' ? 429 : 502 });
  }

  return Response.json({ ok: true, token, url, expires: meta.expires });
}
