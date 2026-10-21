/* Key tags: the QR code and the three tag designs, for the print sheet in Key admin → Tags.
 *
 * Loaded on demand by index.html when an admin opens Tags, so it costs nothing anywhere else.
 * The same tags as the sheets printed so far (outputs/qr-design, outputs/keyflow-test/tags.cjs):
 *   front  the wordmark on one line, the phone number under it
 *   back   the QR code on a white field, the bundle number under it
 * both 23.5 x 37.5 mm, side by side on the sheet, cut out and mounted back to back.
 *
 * The code holds the bare bundle number ("112:3") and nothing else. Every code is read back
 * with the app's own reader (jsqr.js, loaded first by index.html) before it is shown, so a tag
 * can never carry a number the scanner will not read.
 */
(function(){
  // ----- QR Code, version 1 (21 modules), byte mode, error correction level M -----
  // Up to 14 bytes, which covers every bundle number ("112:EXTRA" is 9). A port of
  // outputs/keyflow-test/qrgen.cjs, which made the sheets printed before this.
  const N = 21, DATA_CW = 16, EC_CW = 10, MAX_BYTES = 14;

  // GF(256) with the QR primitive polynomial x^8 + x^4 + x^3 + x^2 + 1.
  const EXP = new Array(512), LOG = new Array(256);
  { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255] }
  const mul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
  function rsDivisor(degree) {
    const r = new Array(degree).fill(0); r[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < degree; j++) { r[j] = mul(r[j], root); if (j + 1 < degree) r[j] ^= r[j + 1] }
      root = mul(root, 2);
    }
    return r;
  }
  function rsRemainder(data, divisor) {
    const r = new Array(divisor.length).fill(0);
    for (const b of data) { const f = b ^ r.shift(); r.push(0); divisor.forEach((c, i) => r[i] ^= mul(c, f)) }
    return r;
  }
  const bytesOf = text => [...new TextEncoder().encode(text)];

  function codewords(text) {
    const bytes = bytesOf(text);
    if (bytes.length > MAX_BYTES) throw new Error('too long for a version-1 code: ' + text);
    const bits = [];
    const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1) };
    put(4, 4); put(bytes.length, 8); bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, DATA_CW * 8 - bits.length));
    while (bits.length % 8) bits.push(0);
    for (let p = 0xEC; bits.length < DATA_CW * 8; p ^= 0xEC ^ 0x11) put(p, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    return data.concat(rsRemainder(data, rsDivisor(EC_CW)));
  }

  function matrix(text) {
    const mod = Array.from({ length: N }, () => new Array(N).fill(false));
    const fn = Array.from({ length: N }, () => new Array(N).fill(false));
    const set = (x, y, v) => { mod[y][x] = v; fn[y][x] = true };
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= N || y >= N) continue; const d = Math.max(Math.abs(dx), Math.abs(dy)); set(x, y, d !== 2 && d !== 4) } };
    // Timing first, then the finders over its ends - the other way round the finders lose their edge.
    for (let i = 0; i < N; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0) }
    finder(3, 3); finder(N - 4, 3); finder(3, N - 4);
    const format = (mask) => {
      const data = (0 << 3) | mask;              // level M is 00
      let rem = data; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((data << 10) | rem) ^ 0x5412;
      const bit = i => ((bits >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(N - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, N - 15 + i, bit(i));
      set(8, N - 8, true);
    };
    format(0);                                    // reserves the format areas before data goes in
    // Data, two columns at a time, snaking up and down, skipping the timing column.
    const bits = []; for (const cw of codewords(text)) for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1);
    let k = 0;
    for (let right = N - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < N; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? N - 1 - vert : vert;
        if (!fn[y][x] && k < bits.length) { mod[y][x] = bits[k] === 1; k++ }
      }
    }
    const MASKS = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0
    ];
    const masked = m => { const out = mod.map(r => r.slice()); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!fn[y][x] && MASKS[m](x, y)) out[y][x] = !out[y][x]; return out };
    const penalty = g => {
      let p = 0;
      const runs = line => { let run = 1; for (let i = 1; i <= line.length; i++) { if (i < line.length && line[i] === line[i - 1]) run++; else { if (run >= 5) p += 3 + run - 5; run = 1 } } };
      for (let i = 0; i < N; i++) { runs(g[i]); runs(g.map(r => r[i])) }
      for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) { const v = g[y][x]; if (g[y][x + 1] === v && g[y + 1][x] === v && g[y + 1][x + 1] === v) p += 3 }
      const s = line => line.map(v => v ? '1' : '0').join('');
      const finderish = t => { let n = 0; for (const pat of ['10111010000', '00001011101']) { let i = -1; while ((i = t.indexOf(pat, i + 1)) >= 0) n++ } return n };
      for (let i = 0; i < N; i++) p += 40 * (finderish(s(g[i])) + finderish(s(g.map(r => r[i]))));
      const dark = g.flat().filter(Boolean).length, pct = dark * 100 / (N * N);
      p += 10 * (Math.ceil(Math.abs(pct - 50) / 5) - 1);
      return p;
    };
    let bestP = Infinity, bestG = null;
    for (let m = 0; m < 8; m++) { format(m); const g = masked(m); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (fn[y][x]) g[y][x] = mod[y][x]; const p = penalty(g); if (p < bestP) { bestP = p; bestG = g } }
    const cells = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (bestG[y][x]) cells.push([x, y]);
    return { n: N, cells };
  }

  // Read back with the app's own reader, at 10 px per module with the 4-module quiet zone.
  function verify(text, g) {
    if (typeof window.jsQR !== 'function') return false;
    const size = g.n + 8, px = new Uint8ClampedArray(size * size * 100 * 4).fill(255);
    for (const [x, y] of g.cells) for (let dy = 0; dy < 10; dy++) for (let dx = 0; dx < 10; dx++) { const i = (((y + 4) * 10 + dy) * size * 10 + (x + 4) * 10 + dx) * 4; px[i] = px[i + 1] = px[i + 2] = 0 }
    const r = window.jsQR(px, size * 10, size * 10);
    return !!r && r.data === text;
  }
  const cache = {};
  function grid(text) {
    if (cache[text]) return cache[text];
    const g = matrix(text);
    if (!verify(text, g)) throw new Error('the code for ' + text + ' does not read back');
    return cache[text] = g;
  }
  // Null when the number cannot go on a tag, otherwise the reason it cannot: 'long' or 'code'.
  function problem(text) {
    if (bytesOf(text).length > MAX_BYTES) return 'long';
    try { grid(text); return null } catch (e) { return 'code' }
  }
  function svgFor(text, fill, quiet = 4) {
    const g = grid(text), size = g.n + 2 * quiet;
    const d = g.cells.map(([x, y]) => `M${x + quiet} ${y + quiet}h1v1h-1z`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#FFFFFF"/><path d="${d}" fill="${fill}"/></svg>`;
  }

  // ----- the three designs -----
  // Proposals 4, 3 and 1 from 2026-09-22, as printed since: the code black on a white field on
  // all three. Green is the default and the general line to go by (Erik).
  const TEMPLATES = {
    green:      { name: 'Green',       bg: '#16453E', text: '#FFFFFF', num: '#FFFFFF' },
    darkpeach:  { name: 'Dark peach',  bg: '#E2987D', text: '#0D2F2A', num: '#0D2F2A' },
    lightpeach: { name: 'Light peach', bg: '#F9D7C5', text: '#16453E', num: '#000000' }
  };
  const ORDER = ['green', 'darkpeach', 'lightpeach'];
  const PHONE = '08-528 006 00';
  // Designs drawn in the app (Tags → New design, tagpaint.js): a picture of each face, kept on the
  // device. On the back the code and the number still go on top, so the tag scans like any other.
  // hidden: drawn with, never offered (the editor's own preview).
  function setCustom(key, t, hidden) {
    TEMPLATES[key] = { name: t.name, custom: true, front: t.front, back: t.back, fbg: t.fbg || '#FFFFFF', bg: t.bg || '#FFFFFF', num: t.num || '#000000', text: t.num || '#000000' };
    if (!hidden && !ORDER.includes(key)) ORDER.push(key);
  }
  function dropCustom(key) { delete TEMPLATES[key]; const i = ORDER.indexOf(key); if (i >= 0) ORDER.splice(i, 1) }

  // The wordmark on one line: the two rows of beaps-web-logo.svg set side by side (tags.cjs).
  const WORDMARK = '<svg class="tg-wm" xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1.6 389.2 25.6" role="img" aria-label="Beautiful Apartments"><g fill="currentColor"><path d="M27,17.8v-5.4h7.2V8.6H27V4.4h9.8v-4H22.7v21.5h14.5v-4.1H27z"/><path d="M15.4,10.3c1-1,2.3-4.1,0.7-6.9C14.7,0.9,12.7,0.4,9,0.4c-1.5,0-7,0-7,0l0.7,1.6v20c0,0,5.4,0,7.4,0     c5.7,0,7.9-1.3,8.9-5.1C19.4,14.5,19,12.2,15.4,10.3z M6.9,4.2h2c2.1,0,3.6,0,3.6,2.5c0,2-1.2,2.2-3,2.2H6.9V4.2z M11.9,18.1h-5     v-5.2h4.9c2.1,0,2.9,0.9,2.9,2.5C14.8,17.5,13.7,18.1,11.9,18.1z"/><path d="M44.4,21.9l1-2.5h8.8l1,2.5h4.7L49.8,0L39.7,21.9H44.4z M49.8,8.6l2.9,7h-5.7L49.8,8.6z"/><path d="M74.3,0.3v13.6c0,2.2-1.9,4-4.4,4c-2.9,0-4.7-1.8-4.7-4V0.3H61v13.2c0,4.6,3.4,8.3,9,8.3     c4.9,0,8.5-3.7,8.5-8.2V0.3H74.3z"/><path d="M145.8,0.3v13.6c0,2.2-1.9,4-4.4,4c-2.9,0-4.7-1.8-4.7-4V0.3h-4.2v13.2c0,4.6,3.4,8.3,9,8.3     c4.9,0,8.5-3.7,8.5-8.2V0.3H145.8z"/><path d="M99.7,0.4H82v3.9h6.7v17.6H93V4.3h6.7V0.4z"/><path d="M154.4,21.9h13.4V18h-9.2V0.4h-4.2V21.9z"/><path d="M108.3,21.9V0.4h-4.2v21.5H108.3z"/><path d="M128.3,4.3V0.4h-13.6l-0.1,0.2v21.3h4.2v-8.1h7.8v-4h-7.8V4.3H128.3z"/><g transform="translate(178.8,-28.6)"><path d="M41.9,50.4l1-2.5h8.8l1,2.5h4.7L47.3,28.7L37.2,50.4H41.9z M47.3,37.1l2.9,7h-5.7L47.3,37.1z"/><path d="M4.7,50.4l1-2.5h8.8l1,2.5h4.7L10.1,28.7L0,50.4H4.7z M10.1,37.1l2.9,7H7.2L10.1,37.1z"/><path d="M129.3,46.4V41h7.2v-3.8h-7.2V33h9.8v-4H125v21.5h14.5v-4.1H129.3z"/><path d="M96,29H78.3v3.9H85v17.6h4.2V32.9H96V29z"/><path d="M182.3,29h-17.7v3.9h6.8v17.6h4.2V32.9h6.8V29z"/><path d="M77.9,50.4L72,42.1c2.1-0.9,3.7-3,3.7-5.5c0-4.7-2.4-7.6-8.1-7.6c-1.9,0-8.1,0-8.1,0l0.7,1.6v19.9     c0,0,2.3,0,4.1,0l0.1-7.5c0.8,0,2-0.1,3.1-0.1l5.4,7.6H77.9z M64.4,32.9h3.7c1.5,0,3.1,0.8,3.1,3.1c0,2-1.4,3-3.1,3h-3.7     L64.4,32.9L64.4,32.9z"/><path d="M109.7,40.4L99.4,28.6v21.9h4.3v-11h0.2l5.8,7.2l5.8-7.2h0.2v11h4.3V28.6L109.7,40.4z"/><path d="M157.2,29v12.4l-13.6-12.8v21.9h4.3V38.1l13.6,12.8V29H157.2z"/><path d="M197.3,40.2c-0.8-0.7-5.5-3-6.8-3.7c-0.6-0.4-1.2-0.9-1.2-1.7s0.3-2.1,2.7-2.1c2.1,0,3.1,1.3,4,2.4l2.9-2.2     c-1.9-2.6-3.8-4.1-7.2-4.1c-4.6,0-6.9,3.7-6.9,5.6c0,0.7,0,3,2.5,5c0,0,0,0,0,0c0,0,0,0,0,0c1.1,0.8,1.9,1.1,4.1,2.2     c1.1,0.6,3.6,1.4,3.6,3c0,0.8-0.3,2.5-2.9,2.5c-3.2,0-4.5-1.9-5.3-3l-2.9,2.1c1.5,2.5,4.5,4.7,8.1,4.7c5.6,0,7.4-3.8,7.4-5.9     C199.4,44.3,199.7,42.3,197.3,40.2z"/><path d="M205.1,51c1.6,0,2.9-1.3,2.9-3c0-1.6-1.3-3-2.9-3s-2.9,1.3-2.9,3C202.1,49.7,203.4,51,205.1,51z"/><path d="M30.2,29c-1.9,0-7.4,0-7.4,0h-0.7l0.7,1.6v19.9c0,0,2.3,0,4.1,0l0.1-7.5c1.7,0,5.3-0.3,6.5-0.5     c2.6-0.6,4.8-3,4.8-5.8C38.4,31.9,36,29,30.2,29z M30.8,39h-3.7v-6.2h3.7c1.5,0,3.1,0.8,3.1,3.1C33.9,38,32.5,39,30.8,39z"/></g></g></svg>';

  // In mm, so the sheet printed at 100 % is the real size. Used on screen too, for the preview.
  // The front is drawn landscape and turned a quarter, so both faces stand portrait side by side.
  const CSS = `
.tg-pair{display:flex;gap:2mm}
.tg-face{width:23.5mm;height:37.5mm;position:relative;outline:.15mm solid #739085;flex:none;overflow:hidden;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.tg-front{position:absolute;width:37.5mm;height:23.5mm;left:-7mm;top:7mm;transform:rotate(-90deg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.2mm}
.tg-wm{width:33mm;height:auto;display:block}
.tg-tel{font-family:Consolas,'Courier New',monospace;font-size:7pt;font-weight:600;letter-spacing:.09em;line-height:1;white-space:nowrap}
.tg-back{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.7mm;padding:1.25mm}
.tg-qr{width:21mm;height:21mm;background:#fff;flex:none}
.tg-qr svg{width:100%;height:100%;display:block}
.tg-num{font-family:Arial,Helvetica,sans-serif;font-size:16.5pt;font-weight:700;line-height:1;white-space:nowrap}
.tg-num.long{font-size:10pt}
.tg-cfront{position:absolute;width:37.5mm;height:23.5mm;left:-7mm;top:7mm;transform:rotate(-90deg);display:block}
.tg-cback{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.tg-back .tg-qr,.tg-back .tg-num{position:relative}
.tg-page{font-family:Arial,Helvetica,sans-serif;color:#16453E;break-after:page;page-break-after:always;background:#fff}
.tg-page:last-child{break-after:auto;page-break-after:auto}
.tg-page h1{font-size:11pt;margin:0 0 1mm;font-family:Arial,Helvetica,sans-serif;color:#16453E}
.tg-page p{font-size:7.5pt;margin:0;line-height:1.35}
.tg-grid{display:grid;grid-template-columns:repeat(3,49mm);column-gap:6mm;grid-auto-rows:41mm;row-gap:1mm;margin-top:2mm}
.tg-empty{margin-top:3.5mm;width:49mm;height:37.5mm;border:.3mm dashed #c4cfca;box-sizing:border-box}
.tg-meta{height:3.5mm;font-size:6.5pt;line-height:3.5mm;color:#526b62;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tg-foot{display:flex;justify-content:space-between;align-items:center;width:159mm;font-size:6.5pt;margin-top:2mm}
.tg-ruler{width:50mm;border:.25mm solid #16453E;border-top:0;height:2mm;display:inline-block;margin-left:3mm;vertical-align:middle}
`;

  const esc = s => (s == null ? '' : String(s)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tpl = key => TEMPLATES[key] || TEMPLATES.green;

  // A drawn design is a picture, so it prints whether or not the browser prints background colours.
  function front(key) {
    const t = tpl(key);
    if (t.custom) return `<div class="tg-face" style="background:${esc(t.fbg)}"><img class="tg-cfront" src="${esc(t.front)}" alt=""></div>`;
    return `<div class="tg-face" style="background:${t.bg}"><div class="tg-front" style="color:${t.text}">${WORDMARK}<div class="tg-tel">${PHONE}</div></div></div>`;
  }
  function back(key, id) {
    const t = tpl(key);
    return `<div class="tg-face tg-back" style="background:${esc(t.bg)}">${t.custom ? `<img class="tg-cback" src="${esc(t.back)}" alt="">` : ''}<div class="tg-qr">${svgFor(id, '#000000')}</div><div class="tg-num${id.length > 6 ? ' long' : ''}" style="color:${esc(t.num)}">${esc(id)}</div></div>`;
  }
  const pair = (key, id) => `<div class="tg-pair">${front(key)}${back(key, id)}</div>`;

  // The print sheet: 18 pairs to an A4 page, three across and six down, each with a line above
  // it saying where it belongs. Each item may carry its own design (it.tpl); key is the one for
  // those that do not. txt carries the words, in the app's language:
  //   { title, instr, ruler, count, date }
  // The same sheet is the paper on screen: opts.slots draws the free places on the last page (and
  // one empty page when there is nothing), it.mark is an extra class on the item, data-id names it.
  const PER_PAGE = 18;
  function sheet(key, items, txt, opts) {
    opts = opts || {};
    const pages = [];
    for (let i = 0; i < items.length; i += PER_PAGE) pages.push(items.slice(i, i + PER_PAGE));
    if (!pages.length && opts.slots) pages.push([]);
    return `<style>${CSS}</style>` + pages.map((p, i) => `<section class="tg-page">
      <h1>${esc(txt.title)}</h1><p>${esc(txt.instr)}</p>
      <div class="tg-grid">${p.map(it => `<div class="tg-item${it.mark ? ' ' + esc(it.mark) : ''}" data-id="${esc(it.id)}"><div class="tg-meta"><b>${esc(it.id)}</b>${it.line ? ' · ' + esc(it.line) : ''}</div>${pair(it.tpl || key, it.id)}</div>`).join('')}${opts.slots && i === pages.length - 1 ? '<div class="tg-empty"></div>'.repeat(PER_PAGE - p.length) : ''}</div>
      <div class="tg-foot"><span>${esc(txt.ruler)}<span class="tg-ruler"></span></span><span>${esc(txt.date)} · ${i + 1} / ${pages.length} · ${p.length} ${esc(txt.count)}</span></div>
    </section>`).join('');
  }

  window.BEAPS_TAGS = { TEMPLATES, ORDER, CSS, MAX_BYTES, PER_PAGE, PHONE, WORDMARK, problem, svgFor, front, back, pair, sheet, setCustom, dropCustom };
})();
