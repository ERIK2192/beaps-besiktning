// The mail that goes out once the counterparty has signed (sign-complete.js): to Longstay, with
// a copy to the guest. The same plain letter as the signing-link mail (cflib/mail-signing.js):
// white, black text, grey hairlines, no coloured surface, so a dark theme - classic Outlook's
// included - turns it into an ordinary dark mail. Built for mail clients: tables, inline styles,
// spacer rows instead of table margins, a 600 px ghost table for classic Outlook. Every value
// is HTML-escaped. (2026-10-07)
import { esc } from './mail.js';

const SERIF = "Georgia,'Times New Roman',Times,serif";
const INK = '#111111', BODY = '#333333', SEC = '#555555', HAIR = '#DDDDDD';
const SP = (h, cols) => `<tr><td${cols ? ` colspan="${cols}"` : ''} height="${h}" style="height:${h}px;padding:0;font-size:1px;line-height:${h}px;mso-line-height-rule:exactly">&nbsp;</td></tr>`;

// v: { name, role, property, type (label, e.g. "Move-in"), inspector, signed (text), to, cc }
export function renderSignedMail(v) {
  const name = v.name || 'The counterparty';
  const kind = (v.type && v.type !== '-' ? String(v.type).toLowerCase() + ' ' : '') + 'inspection report';
  const rows = [
    ['PROPERTY', `<b>${esc(v.property || '-')}</b>`],
    v.type && v.type !== '-' ? ['TYPE', esc(v.type)] : null,
    ['INSPECTOR', esc(v.inspector || '-')],
    ['SIGNED BY', esc(v.name || '-') + (v.role ? ` <span style="color:${SEC}">(${esc(v.role)})</span>` : '')],
    ['SIGNED', esc(v.signed || '-')],
    ['LINK SENT TO', esc(v.to || '-') + (v.cc ? `<br><span style="color:${SEC}">copy ${esc(v.cc)}</span>` : '')]
  ].filter(Boolean);
  const label = `class="label-col" width="150" valign="top" style="width:150px;padding:12px 16px 12px 0;border-top:1px solid ${HAIR};font-family:${SERIF};font-size:11px;line-height:22px;letter-spacing:2px;color:${SEC}"`;
  const value = `valign="top" style="padding:12px 0;border-top:1px solid ${HAIR};font-family:${SERIF};font-size:16px;line-height:22px;color:${INK}"`;
  const last = rows.length - 1;
  const rowHtml = rows.map((r, i) => {
    const bottom = i === last ? `;border-bottom:1px solid ${HAIR}` : '';
    return `<tr><td ${label.replace('color:' + SEC + '"', 'color:' + SEC + bottom + '"')}>${r[0]}</td><td ${value.replace('color:' + INK + '"', 'color:' + INK + bottom + '"')}>${r[1]}</td></tr>`;
  }).join('\n              ');

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
<title>The report has been signed</title>
<!--[if mso]>
<noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
<style>table,td,p,h1,a{font-family:Georgia,"Times New Roman",Times,serif !important}</style>
<![endif]-->
<style>
  body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}
  td{mso-line-height-rule:exactly}
  @media only screen and (max-width:620px){
    .wrap{padding:16px 10px 24px !important}
    .container{width:100% !important;max-width:100% !important}
    .pad{padding:30px 22px 32px !important}
    .h1{font-size:28px !important;line-height:34px !important}
    .hide-sm{display:none !important;max-height:0 !important;overflow:hidden !important;mso-hide:all !important}
    .label-col{width:104px !important}
  }
</style>
</head>
<body bgcolor="#FFFFFF" style="margin:0;padding:0;background-color:#FFFFFF;word-spacing:normal">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:#FFFFFF">${esc(name)} has signed the ${esc(kind)} for ${esc(v.property || '')}. The signed report and the signature page are attached.</div>
<div role="article" aria-roledescription="email" aria-label="The report has been signed" lang="en">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#FFFFFF" style="width:100%;background-color:#FFFFFF">
  <tr>
    <td class="wrap" align="center" style="padding:36px 16px 32px">
      <!--[if mso]><table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" border="0"><tr><td><![endif]-->
      <table role="presentation" class="container" width="600" align="center" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;margin:0 auto">
        <tr>
          <td style="padding:10px 0 26px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td valign="middle" style="padding:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:18px;font-weight:bold;letter-spacing:1px;color:${INK}">BEAUTIFUL APARTMENTS</td>
                <td class="hide-sm" align="right" valign="middle" style="padding:0 0 0 12px;font-family:${SERIF};font-size:11px;line-height:18px;letter-spacing:2.5px;color:${SEC};white-space:nowrap">INSPECTION REPORT</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td class="pad" bgcolor="#FFFFFF" style="background-color:#FFFFFF;padding:44px 48px 40px;border:1px solid ${HAIR}">
            <p style="margin:0 0 14px;font-family:${SERIF};font-size:12px;line-height:16px;letter-spacing:2.5px;color:${SEC}">SIGNED</p>
            <h1 class="h1" style="margin:0 0 18px;font-family:${SERIF};font-size:32px;line-height:38px;font-weight:normal;color:${INK};mso-line-height-rule:exactly">The report has been signed</h1>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0">
              <tr><td width="56" style="width:56px;border-top:3px solid ${INK};font-size:1px;line-height:1px;height:1px">&nbsp;</td></tr>
              ${SP(28)}
            </table>
            <p style="margin:0 0 30px;font-family:${SERIF};font-size:20px;line-height:30px;font-style:italic;color:${INK}">${esc(name)} has signed the ${esc(kind)}.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              ${rowHtml}
              ${SP(30, 2)}
            </table>
            <p style="margin:0 0 8px;font-family:${SERIF};font-size:16px;line-height:24px;font-weight:bold;color:${INK}">Two files are attached</p>
            <p style="margin:0 0 30px;font-family:${SERIF};font-size:15px;line-height:23px;color:${BODY}">The report exactly as it was signed, and the signature page that belongs to it. Keep them together.</p>
            <p style="margin:0;font-family:${SERIF};font-size:16px;line-height:26px;color:${INK}">With kind regards,<br><b>Team Longstay Beautiful Apartments</b></p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:24px 24px 0;font-family:${SERIF};font-size:12px;line-height:19px;color:${SEC}">
            Beaps &middot; Longstay Beautiful Apartments &middot; 08-528 006 00<br>
            Sent by Beaps Besiktning (besiktning@bedoma.se).
          </td>
        </tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td>
  </tr>
</table>
</div>
</body>
</html>
`;
}
