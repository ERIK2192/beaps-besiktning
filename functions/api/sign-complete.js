// Receives the signature and emails the signed record to longstay with a copy to the person
// who signed: the report exactly as it stood when the link was created, plus a one-page
// signature certificate.
//
// The report is never rewritten. Appending a page to it means having pdf-lib parse and
// re-serialise the whole document, which costs far more than the ten milliseconds of CPU a
// request gets on Cloudflare's free plan - and rewriting is the one thing the report must not
// undergo, since the point of the whole flow is that what was signed is what was shown. So the
// signature goes into its own page (a few milliseconds to build) carrying the SHA-256 of the
// report it belongs to, and the mail carries the two files together. The report itself the mail
// service fetches from sign-pdf; no worker ever holds it.
//
// The report is always the stored one, never the recipient's copy, so the content cannot be
// changed in transit. Only the signature image comes from outside.
//
//   POST /api/sign-complete  { t, sig(dataURL png), name, role }
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sendMail, longstay, esc, stamp, typeLabel } from '../../cflib/mail.js';
import { loadRequest, store, writeMeta, readMeta, b64ToBytes, bytesToB64, reportExists, reportStream } from '../../cflib/sign.js';
import { readManifest } from '../../cflib/media.js';
import { dbxOn, uploadFile, cleanPart } from '../../cflib/dropbox.js';

// StandardFonts can only draw WinAnsi. If a character goes outside that, pdf-lib throws.
const wa = s => String(s == null ? '' : s)
  .replace(/[–—]/g, '-')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/…/g, '...')
  .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');

const A4 = { w: 595.28, h: 841.89 };
const INK = rgb(0.086, 0.196, 0.361);
const GREY = rgb(0.43, 0.49, 0.58);

async function signaturePage(sigDataUrl, meta, signedAt) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([A4.w, A4.h]);
  const M = 34;
  let y = A4.h - M;

  const tid = wa(stamp(signedAt));
  page.drawText('SIGNATURE', { x: M, y: y - 8, size: 8, font, color: GREY });
  page.drawText(tid, { x: A4.w - M - font.widthOfTextAtSize(tid, 8), y: y - 8, size: 8, font, color: GREY });
  y -= 30;

  page.drawText(wa(meta.ref || [meta.address, meta.apt].filter(Boolean).join(', ')),
    { x: M, y: y - 16, size: 16, font: bold, color: INK });
  y -= 30;
  page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 1.2, color: INK });
  y -= 24;

  const rows = [
    ['Type', typeLabel(meta.type) || '-'],
    ['Inspector', meta.inspector || '-'],
    ['Signed by', meta.signedName || meta.recipientName || '-'],
    ['Role', meta.signedRole || meta.recipientRole || '-'],
    ['Signed', stamp(signedAt)],
    ['Signing link sent to', meta.to + (meta.cc ? ', copy ' + meta.cc : '')],
    ['Link created', stamp(meta.created)],
    ['Report', meta.filename || 'Inspection report.pdf']
  ];
  for (const [k, v] of rows) {
    page.drawText(wa(k), { x: M, y: y - 10, size: 10, font, color: GREY });
    page.drawText(wa(v), { x: M + 180, y: y - 10, size: 10, font, color: INK });
    y -= 19;
  }

  // The fingerprint of the report this page belongs to. Split in two, because 64 characters
  // in one line runs off the page.
  if (meta.sha256) {
    page.drawText('Report fingerprint', { x: M, y: y - 10, size: 10, font, color: GREY });
    page.drawText('SHA-256', { x: M, y: y - 22, size: 8, font, color: GREY });
    page.drawText(meta.sha256.slice(0, 32), { x: M + 180, y: y - 10, size: 9, font, color: INK });
    page.drawText(meta.sha256.slice(32), { x: M + 180, y: y - 22, size: 9, font, color: INK });
    y -= 31;
  }
  y -= 22;

  const b64 = String(sigDataUrl).slice(String(sigDataUrl).indexOf(',') + 1);
  const png = await doc.embedPng(b64ToBytes(b64));
  const maxW = 260, maxH = 90;
  const scale = Math.min(maxW / png.width, maxH / png.height, 1);
  const w = png.width * scale, h = png.height * scale;
  page.drawImage(png, { x: M, y: y - h, width: w, height: h });
  y -= h + 8;

  page.drawLine({ start: { x: M, y }, end: { x: M + Math.max(maxW, w), y }, thickness: 0.8, color: INK });
  y -= 16;
  page.drawText(wa(meta.signedName || meta.recipientName || ''), { x: M, y: y - 9, size: 10, font, color: INK });
  y -= 15;
  page.drawText(wa(meta.signedRole || meta.recipientRole || ''), { x: M, y: y - 9, size: 9, font, color: GREY });
  y -= 40;

  for (const rad of [
    'Signed digitally via a one-time link sent by Beaps. The recipient saw the entire',
    'report with photos and comments before the signature was given, and confirmed',
    'that the report was read.',
    '',
    'This page belongs with the report named above, which accompanies it and is',
    meta.sha256
      ? 'unchanged since the link was created - the fingerprint above is that of the'
      : 'unchanged since the link was created. It was never rewritten in order to be',
    meta.sha256
      ? 'file that was shown and signed, and identifies it.'
      : 'signed, so what was shown is what is filed.'
  ]) {
    if (rad) page.drawText(wa(rad), { x: M, y: y - 8, size: 8, font, color: GREY });
    y -= 12;
  }

  return bytesToB64(await doc.save());
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let b;
  try { b = await request.json() } catch { return new Response('Bad request', { status: 400 }) }

  const url = new URL(request.url);
  url.searchParams.set('t', b.t || '');
  const { fel, token, meta, status } = await loadRequest(env, url);
  if (fel) return fel;

  if (status === 'signed') return new Response('The report is already signed', { status: 409 });
  if (status === 'cancelled') return new Response('The link has been revoked', { status: 410 });
  if (status === 'expired') return new Response('The link has expired', { status: 410 });
  if (!b.sig || String(b.sig).indexOf('base64,') < 0) return new Response('Signature missing', { status: 400 });
  if (String(b.sig).length > 3 * 1024 * 1024) return new Response('The signature is too large', { status: 413 });

  // Only that it is there - the bytes are never pulled into the worker.
  if (!await reportExists(env, meta, token)) {
    return new Response('The report was not found', { status: 404 });
  }

  const signedAt = Date.now();
  const signed = {
    ...meta, status: 'signed', signedAt,
    signedName: (b.name || meta.recipientName || '').trim().slice(0, 120),
    signedRole: (b.role || meta.recipientRole || '').trim().slice(0, 120)
  };

  let certB64;
  try {
    certB64 = await signaturePage(b.sig, signed, signedAt);
  } catch (e) {
    return new Response('Could not finalize the PDF: ' + String(e && e.message).slice(0, 200), { status: 500 });
  }

  // Final check just before sending: if someone else (e.g. the CC recipient) managed to sign or
  // revoke while the PDF was being built, abort so we don't email and overwrite twice.
  try {
    const nu = await readMeta(env, token);
    if (nu && nu.status === 'signed') return new Response('The report is already signed', { status: 409 });
    if (nu && nu.status === 'cancelled') return new Response('The link has been revoked', { status: 410 });
  } catch (e) {}

  const rapportNamn = meta.filename || 'Inspection report.pdf';
  const certNamn = rapportNamn.replace(/\.pdf$/i, '') + ' - signature.pdf';

  // Both files belong in the Dropbox folder with the photos. The report is streamed out of its
  // own storage rather than held here, the way a walkthrough video is in media-put. Best effort
  // throughout: none of it may stand between a signature and the email.
  if (dbxOn(env) && meta.gallery) {
    try {
      const m = await readManifest(env, meta.gallery);
      if (m && m.dropbox && m.dropbox.path) {
        await uploadFile(env, m.dropbox.path + '/' + cleanPart(certNamn.replace(/\.pdf$/i, '')) + '.pdf',
          b64ToBytes(certB64));
        const kropp = await reportStream(env, meta);
        if (kropp) {
          await uploadFile(env, m.dropbox.path + '/' + cleanPart(rapportNamn.replace(/\.pdf$/i, '')) + '.pdf', kropp);
        }
      }
    } catch (e) {}
  }
  const objekt = meta.ref || [meta.address, meta.apt].filter(Boolean).join(', ');

  const text = [
    `${signed.signedName || 'The counterparty'} has signed the inspection report.`,
    '',
    `Property: ${objekt}`,
    meta.type ? `Type: ${typeLabel(meta.type)}` : '',
    `Inspector: ${meta.inspector || '-'}`,
    `Signed by: ${signed.signedName || '-'}${signed.signedRole ? ' (' + signed.signedRole + ')' : ''}`,
    `Signed: ${stamp(signedAt)}`,
    `Link sent to: ${meta.to}${meta.cc ? ' (copy ' + meta.cc + ')' : ''}`,
    '',
    'Two files are attached: the report as it was signed, and the signature page',
    'belonging to it. The report was not rewritten in order to be signed, so what',
    'the counterparty saw is exactly what is filed.'
  ].filter(x => x !== '').join('\n');

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;color:#16325C;line-height:1.5">
    <p><b>${esc(signed.signedName || 'The counterparty')}</b> has signed the inspection report.</p>
    <table style="border-collapse:collapse;font-size:14px;margin:0 0 18px">
      <tr><td style="padding:2px 14px 2px 0;color:#6E7C94">Property</td><td style="padding:2px 0"><b>${esc(objekt)}</b></td></tr>
      ${meta.type ? `<tr><td style="padding:2px 14px 2px 0;color:#6E7C94">Type</td><td style="padding:2px 0">${esc(typeLabel(meta.type))}</td></tr>` : ''}
      <tr><td style="padding:2px 14px 2px 0;color:#6E7C94">Inspector</td><td style="padding:2px 0">${esc(meta.inspector || '-')}</td></tr>
      <tr><td style="padding:2px 14px 2px 0;color:#6E7C94">Signed by</td><td style="padding:2px 0">${esc(signed.signedName || '-')}${signed.signedRole ? ' (' + esc(signed.signedRole) + ')' : ''}</td></tr>
      <tr><td style="padding:2px 14px 2px 0;color:#6E7C94">Signed</td><td style="padding:2px 0">${esc(stamp(signedAt))}</td></tr>
      <tr><td style="padding:2px 14px 2px 0;color:#6E7C94">Link sent to</td><td style="padding:2px 0">${esc(meta.to)}${meta.cc ? ' (copy ' + esc(meta.cc) + ')' : ''}</td></tr>
    </table>
    <p><b>Two files are attached:</b> the report as it was signed, and the signature page
    belonging to it. The report was not rewritten in order to be signed, so what the
    counterparty saw is exactly what is filed.</p>
  </div>`;

  const m = await sendMail(env, {
    to: longstay(env),
    cc: [meta.to, meta.cc].filter(Boolean),
    subject: `BesiktningPDF ${objekt} - signed`,
    text, html,
    attachments: [
      // The report is fetched by the mail service straight from its storage, so a 16 MB
      // move-out never passes through this worker.
      { filename: rapportNamn, path: new URL(request.url).origin + '/api/sign-pdf?t=' + token },
      { filename: certNamn, content: certB64 }
    ]
  });
  if (!m.ok) return new Response(m.error || 'The email could not be sent', { status: m.error === 'quota' ? 429 : 502 });

  // One page, so KV is the right home for it. This is what sign-pdf serves as ?cert=1.
  await store(env).put('cert/' + token, certB64, { expirationTtl: 90 * 86400 });
  // Renew an old KV-stored report's TTL so sign-pdf can show it for as long as the meta lives.
  // A report in R2 has no expiry to renew.
  if (!signed.pdfId) {
    try {
      const gammal = await store(env).get('pdf/' + token, 'text');
      if (gammal) await store(env).put('pdf/' + token, gammal, { expirationTtl: 90 * 86400 });
    } catch (e) {}
  }
  await writeMeta(env, token, signed);

  return Response.json({ ok: true, signedAt, to: longstay(env) });
}
