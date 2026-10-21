/* Draw a tag design: Key admin → Tags → New design (2026-10-21). A small paint program, after
 * Erik: draw and write on the front and the back of the tag yourself.
 *
 * Loaded on demand by index.html (openTplEditor), so it costs nothing anywhere else. It uses the
 * app's own helpers (T, esc, toast, admSheet, topbar) and tags.js, both already loaded by then.
 *
 * Each face is a canvas at 12 px per mm (about 300 dpi): the front 37.5 x 23.5 mm, the back
 * 23.5 x 37.5 mm. Saved as two PNG pictures with the device's other tag data (tagTplPut in
 * index.html) - nothing goes to the server. On the back, the QR code on its white field and the
 * bundle number are laid on top of the picture when the tag is made, so a drawn tag scans like
 * any other; the editor shows where they will be, and a preview shows the tag as it prints.
 *
 * Tools as in Paint: pen, eraser (paints the side's background colour), line, rectangle, ellipse
 * (outline or filled), fill bucket, text, eyedropper, and the Beaps wordmark. Undo / redo, also
 * Ctrl+Z / Ctrl+Y. "Start from" draws one of the three printed designs to build on.
 */
(function(){
  const B = window.BEAPS_TAGS;
  const PX = 12;                                   // pixels per mm in the saved pictures
  const SIZE = { front: [Math.round(37.5 * PX), Math.round(23.5 * PX)], back: [Math.round(23.5 * PX), Math.round(37.5 * PX)] };
  // Where the code and the number land on the back: tags.js centres a 21 mm field, a 1.7 mm gap
  // and the 16.5 pt number in the 37.5 mm face, inside 1.25 mm of padding.
  const QR = { x: 1.25 * PX, y: 4.49 * PX, w: 21 * PX, h: 21 * PX };
  const NUM = { x: 1.25 * PX, y: 27.19 * PX, w: 21 * PX, h: 5.82 * PX };
  const SWATCHES = ['#16453E', '#0D2F2A', '#E2987D', '#F9D7C5', '#FFD340', '#FFFFFF', '#000000', '#8A8F8C', '#C0392B', '#2E6DB4'];
  const POINTS = [6, 7, 8, 10, 12, 14, 18, 24, 32];
  const FONTS = { sans: 'Arial, Helvetica, sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: 'Consolas, "Courier New", monospace' };
  const ICON = {
    pen: '<path d="M4 16l1.5-4.5L14 3l3 3-8.5 8.5z"/><path d="M12 5l3 3"/>',
    eraser: '<path d="M3 13.5l7.5-7.5 5.5 5.5-4.5 4.5H7z"/><path d="M8 16h9"/>',
    line: '<path d="M4 16L16 4"/>',
    rect: '<rect x="3" y="5" width="14" height="10" rx="1"/>',
    ellipse: '<ellipse cx="10" cy="10" rx="7.5" ry="5.5"/>',
    fill: '<path d="M3.5 9.5L9 4l6 6-5.5 5.5z"/><path d="M3.5 9.5h11.5"/><path d="M17 12.5c.9 1.5 1.4 2.4 1.4 3a1.4 1.4 0 01-2.8 0c0-.6.5-1.5 1.4-3z"/>',
    text: '<path d="M4.5 5h11M10 5v11"/>',
    pick: '<path d="M12.5 3.5l4 4-2 2-4-4z"/><path d="M10.5 5.5L4 12v4h4l6.5-6.5"/>',
    wm: '<path d="M3 8h14M3 12h9"/>'
  };
  const TOOLS = [['pen', 'Pen'], ['eraser', 'Eraser'], ['line', 'Line'], ['rect', 'Rectangle'], ['ellipse', 'Ellipse'],
                 ['fill', 'Fill'], ['text', 'Text'], ['pick', 'Eyedropper'], ['wm', 'Wordmark']];
  const CSS = `
.pnt{display:flex;flex-direction:column;gap:16px}
.pnt-stage{order:-1}
@media (min-width:960px){ .pnt{display:grid;grid-template-columns:310px minmax(0,1fr);gap:28px;align-items:start} .pnt-stage{order:0} .pnt-tools{position:sticky;top:12px}
  .pnt-prev .tg-pair{zoom:1.6} }
.pnt-tgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.pnt-tool{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 2px 6px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:11px;line-height:1.15;min-width:0}
.pnt-tool svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.pnt-tool.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.pnt-opts{margin-top:12px;display:flex;flex-direction:column;gap:10px}
.pnt-opts .kfrow{margin-top:0}
.pnt-opts input[type=range]{padding:0;border:0;background:none}
.pnt-sw{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
.pnt-sw button{width:28px;height:28px;border-radius:7px;border:1px solid rgba(0,0,0,.2);padding:0}
.pnt-sw button.on{box-shadow:0 0 0 2px var(--paper),0 0 0 4px var(--ink)}
.pnt-sw input[type=color]{width:44px;height:30px;padding:0 2px;border:1px solid var(--line);border-radius:7px;background:#fff}
.pnt-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.pnt-row .btn{flex:1 1 auto}
.pnt-stage{display:flex;flex-wrap:wrap;gap:22px 26px;align-items:flex-start;min-width:0}
.pnt-face{display:flex;flex-direction:column;gap:6px}
.pnt-cv{position:relative;box-shadow:0 1px 3px rgba(0,0,0,.18),0 6px 18px rgba(0,0,0,.08);outline:2px solid transparent;outline-offset:4px;touch-action:none;background:#fff}
.pnt-face.on .pnt-cv{outline-color:var(--ink)}
.pnt-cv canvas{display:block;width:100%;height:100%}
.pnt-cv canvas + canvas{position:absolute;left:0;top:0;cursor:crosshair}
.pnt-prev{display:flex;flex-direction:column;gap:6px}
`;
  let P = null;

  const rgb = h => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] };
  const hex = d => '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const okHex = h => /^#[0-9A-Fa-f]{6}$/.test(String(h || ''));
  const $p = id => document.getElementById(id);
  const face = f => P.cv[f];

  // ----- drawing -----
  function wordmarkPaths() {
    const s = B.WORDMARK, i = s.indexOf('<g transform');
    const ds = part => [...part.matchAll(/ d="([^"]+)"/g)].map(m => new Path2D(m[1]));
    return { top: ds(s.slice(0, i)), bottom: ds(s.slice(i)) };
  }
  let WM = null;
  // The wordmark on one line, w px wide, centred on (cx, cy): the same paths as the printed tags.
  function drawWordmark(ctx, cx, cy, w, color) {
    WM = WM || wordmarkPaths();
    const k = w / 389.2, h = 25.6 * k;
    ctx.save();
    ctx.translate(cx - w / 2 + 1 * k, cy - h / 2 + 1.6 * k);
    ctx.scale(k, k);
    ctx.fillStyle = color;
    WM.top.forEach(p => ctx.fill(p));
    ctx.translate(178.8, -28.6);
    WM.bottom.forEach(p => ctx.fill(p));
    ctx.restore();
  }
  function fillAll(f, color) { const c = face(f); c.ctx.fillStyle = color; c.ctx.fillRect(0, 0, c.main.width, c.main.height); P.bg[f] = color }
  // One of the printed designs, drawn to build on: the wordmark and the phone number on the front
  // as tags.js sets them, the colour on the back, the number's colour.
  function preset(key) {
    if (key === 'blank') { fillAll('front', '#FFFFFF'); fillAll('back', '#FFFFFF'); P.num = '#000000'; return }
    const t = B.TEMPLATES[key];
    fillAll('front', t.bg); fillAll('back', t.bg); P.num = t.num;
    const ctx = face('front').ctx, W = SIZE.front[0];
    // 33 mm wordmark, 2.2 mm gap, 7 pt phone number, centred in the 23.5 mm height
    const wmH = 33 * 25.6 / 389.2, telH = 7 * 0.3528, top = (23.5 - (wmH + 2.2 + telH)) / 2;
    drawWordmark(ctx, W / 2, (top + wmH / 2) * PX, 33 * PX, t.text);
    ctx.save();
    ctx.fillStyle = t.text;
    ctx.font = `600 ${7 * 0.3528 * PX}px Consolas, "Courier New", monospace`;
    try { ctx.letterSpacing = (0.09 * 7 * 0.3528 * PX).toFixed(1) + 'px' } catch (e) {}
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(B.PHONE, W / 2, (top + wmH + 2.2) * PX);
    ctx.restore();
  }
  function stroke(ctx, a, b, color) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = P.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.restore();
  }
  function shape(ctx, d) {
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = P.color; ctx.lineWidth = P.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (P.tool === 'line') { ctx.moveTo(d.x0, d.y0); ctx.lineTo(d.x, d.y); ctx.stroke() }
    else {
      const x = Math.min(d.x0, d.x), y = Math.min(d.y0, d.y), w = Math.abs(d.x - d.x0), h = Math.abs(d.y - d.y0);
      if (P.tool === 'rect') ctx.rect(x, y, w, h);
      else ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      P.filled ? ctx.fill() : ctx.stroke();
    }
    ctx.restore();
  }
  // Paint's bucket: the area of about the same colour around the click, as far as it reaches.
  function flood(ctx, x, y, color) {
    const W = ctx.canvas.width, H = ctx.canvas.height, img = ctx.getImageData(0, 0, W, H), d = img.data;
    const [r, g, b] = rgb(color), i0 = (y * W + x) * 4, t = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
    if (Math.abs(t[0] - r) + Math.abs(t[1] - g) + Math.abs(t[2] - b) < 3 && t[3] === 255) return;
    const same = i => Math.abs(d[i] - t[0]) + Math.abs(d[i + 1] - t[1]) + Math.abs(d[i + 2] - t[2]) + Math.abs(d[i + 3] - t[3]) <= 60;
    const seen = new Uint8Array(W * H), stack = [x, y];
    while (stack.length) {
      const py = stack.pop(), px = stack.pop();
      if (seen[py * W + px]) continue;
      let lx = px, rx = px;
      while (lx > 0 && !seen[py * W + lx - 1] && same((py * W + lx - 1) * 4)) lx--;
      while (rx < W - 1 && !seen[py * W + rx + 1] && same((py * W + rx + 1) * 4)) rx++;
      for (let i = lx; i <= rx; i++) {
        const k = py * W + i;
        seen[k] = 1; d[k * 4] = r; d[k * 4 + 1] = g; d[k * 4 + 2] = b; d[k * 4 + 3] = 255;
        if (py > 0 && !seen[k - W] && same((k - W) * 4)) stack.push(i, py - 1);
        if (py < H - 1 && !seen[k + W] && same((k + W) * 4)) stack.push(i, py + 1);
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  function drawText(ctx, p) {
    ctx.save();
    ctx.fillStyle = P.color;
    ctx.font = `${P.bold ? 700 : 400} ${(P.pt * 0.3528 * PX).toFixed(1)}px ${FONTS[P.font]}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(P.text, p.x, p.y);
    ctx.restore();
  }
  // The back's overlay: where the code (a white field) and the number will be laid on top.
  function guides(f) {
    const c = face(f), o = c.octx;
    o.clearRect(0, 0, c.ov.width, c.ov.height);
    if (f !== 'back') return;
    o.save();
    o.fillStyle = 'rgba(255,255,255,.82)'; o.fillRect(QR.x, QR.y, QR.w, QR.h);
    o.setLineDash([8, 6]); o.lineWidth = 2; o.strokeStyle = 'rgba(22,50,92,.7)';
    o.strokeRect(QR.x, QR.y, QR.w, QR.h); o.strokeRect(NUM.x, NUM.y, NUM.w, NUM.h);
    o.fillStyle = 'rgba(22,50,92,.75)'; o.font = `600 ${3 * PX}px Arial, sans-serif`; o.textAlign = 'center'; o.textBaseline = 'middle';
    o.fillText(T('QR code'), QR.x + QR.w / 2, QR.y + QR.h / 2);
    o.globalAlpha = .55; o.fillStyle = P.num; o.font = `700 ${16.5 * 0.3528 * PX}px Arial, sans-serif`;
    o.fillText('404:1', NUM.x + NUM.w / 2, NUM.y + NUM.h / 2);
    o.restore();
  }

  // ----- undo: a picture of each side a step touched, and the colours -----
  function snapshot(faces) {
    const e = { faces: {}, bg: { ...P.bg }, num: P.num };
    for (const f of faces) e.faces[f] = face(f).ctx.getImageData(0, 0, SIZE[f][0], SIZE[f][1]);
    return e;
  }
  function begin(faces) { P.undo.push(snapshot(faces)); if (P.undo.length > 25) P.undo.shift(); P.redo = [] }
  function restore(e) {
    for (const f of Object.keys(e.faces)) face(f).ctx.putImageData(e.faces[f], 0, 0);
    P.bg = { ...e.bg }; P.num = e.num;
  }
  function step(from, to) {
    const e = from.pop(); if (!e) return;
    to.push(snapshot(Object.keys(e.faces)));
    restore(e);
    P.dirty = true; guides('back'); paintNum(); preview();
  }
  window.paintUndo = () => P && step(P.undo, P.redo);
  window.paintRedo = () => P && step(P.redo, P.undo);
  function commit() { P.dirty = true; preview() }

  // ----- pointer -----
  function pos(e, c) {
    const r = c.ov.getBoundingClientRect();
    return { x: Math.max(0, Math.min(c.main.width - 1, (e.clientX - r.left) * c.main.width / r.width)),
             y: Math.max(0, Math.min(c.main.height - 1, (e.clientY - r.top) * c.main.height / r.height)) };
  }
  function down(e, f) {
    if (!P || (e.button != null && e.button > 0)) return;
    e.preventDefault();
    setFace(f);
    const c = face(f), p = pos(e, c), t = P.tool;
    try { c.ov.setPointerCapture(e.pointerId) } catch (x) {}
    if (t === 'pick') { const d = c.ctx.getImageData(p.x | 0, p.y | 0, 1, 1).data; setColor(hex(d)); setTool(P.before || 'pen'); return }
    if (t === 'text' && !P.text.trim()) { toast(T('Write the text first, then click where it goes')); const i = $p('pn_text'); if (i) i.focus(); return }
    begin([f]);
    if (t === 'fill') { flood(c.ctx, p.x | 0, p.y | 0, P.color); return commit() }
    if (t === 'text') { drawText(c.ctx, p); return commit() }
    if (t === 'wm') { drawWordmark(c.ctx, p.x, p.y, P.wm * PX, P.color); return commit() }
    P.drag = { f, x0: p.x, y0: p.y, x: p.x, y: p.y };
    if (t === 'pen' || t === 'eraser') stroke(c.ctx, p, p, t === 'eraser' ? P.bg[f] : P.color);
  }
  function move(e, f) {
    const d = P && P.drag; if (!d || d.f !== f) return;
    const c = face(f), t = P.tool;
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    for (const ev of evs) {
      const p = pos(ev, c);
      if (t === 'pen' || t === 'eraser') { stroke(c.ctx, d, p, t === 'eraser' ? P.bg[f] : P.color); d.x = p.x; d.y = p.y }
      else { d.x = p.x; d.y = p.y }
    }
    if (t !== 'pen' && t !== 'eraser') { guides(f); shape(c.octx, d) }
  }
  function up(e, f) {
    const d = P && P.drag; if (!d || d.f !== f) return;
    P.drag = null;
    if (P.tool !== 'pen' && P.tool !== 'eraser') { guides(f); shape(face(f).ctx, d) }
    commit();
  }

  // ----- the page -----
  function setFace(f) { P.face = f; ['front', 'back'].forEach(x => { const el = $p('pn_f_' + x); if (el) el.classList.toggle('on', x === f) }) }
  function setTool(t) { if (t === 'pick' && P.tool !== 'pick') P.before = P.tool; P.tool = t; paintTools(); paintOpts() }
  function setColor(c) { if (!okHex(c)) return; P.color = c.toUpperCase(); paintSw() }
  window.paintTool = setTool;
  window.paintColor = setColor;
  window.paintSet = (k, v) => { P[k] = v; if (k === 'name') P.dirty = true; if (k === 'filled' || k === 'bold') paintOpts() };
  window.paintNumColor = c => { if (!okHex(c) || c.toUpperCase() === P.num) return; begin([]); P.num = c.toUpperCase(); paintNum(); guides('back'); commit() };
  window.paintFillSide = () => { begin([P.face]); fillAll(P.face, P.color); guides(P.face); commit() };
  window.paintStart = key => { begin(['front', 'back']); preset(key); guides('back'); paintNum(); commit() };

  function paintTools() {
    const box = $p('pn_tools'); if (!box) return;
    box.innerHTML = TOOLS.map(([k, l]) => `<button class="pnt-tool${P.tool === k ? ' on' : ''}" onclick="paintTool('${k}')" aria-pressed="${P.tool === k}" title="${T(l)}"><svg viewBox="0 0 20 20">${ICON[k]}</svg>${T(l)}</button>`).join('');
  }
  function paintOpts() {
    const box = $p('pn_opts'); if (!box) return;
    const t = P.tool, size = `<div class="field"><label class="eyebrow">${T('Size')} <span id="pn_sizev">${P.size}</span></label>
      <input type="range" min="1" max="40" value="${P.size}" oninput="paintSet('size', +this.value); document.getElementById('pn_sizev').textContent = this.value"></div>`;
    const hint = s => `<div class="hint" style="margin:0">${T(s)}</div>`;
    box.innerHTML =
      (t === 'pen' || t === 'line') ? size
      : t === 'eraser' ? size + hint('The eraser paints with the side\'s background colour.')
      : (t === 'rect' || t === 'ellipse') ? size + `<div class="chips"><button class="chip${P.filled ? '' : ' on'}" onclick="paintSet('filled', false)">${T('Outline')}</button><button class="chip${P.filled ? ' on' : ''}" onclick="paintSet('filled', true)">${T('Filled')}</button></div>`
      : t === 'fill' ? hint('Click in an area to fill it with the colour.')
      : t === 'pick' ? hint('Click on the tag to take its colour.')
      : t === 'wm' ? `<div class="field"><label class="eyebrow">${T('Width')}</label><div class="chips">${[20, 26, 33].map(w => `<button class="chip${P.wm === w ? ' on' : ''}" onclick="paintSet('wm', ${w}); paintTool('wm')">${w} mm</button>`).join('')}</div></div>` + hint('Click where the wordmark goes.')
      : `<div class="field"><label class="eyebrow">${T('Text')}</label><input id="pn_text" value="${esc(P.text)}" placeholder="${T('Write the text first, then click where it goes')}" oninput="paintSet('text', this.value)" autocomplete="off"></div>
         <div class="kfrow"><select onchange="paintSet('pt', +this.value)" aria-label="${T('Size')}">${POINTS.map(p => `<option value="${p}"${P.pt === p ? ' selected' : ''}>${p} pt</option>`).join('')}</select>
           <select onchange="paintSet('font', this.value)" aria-label="${T('Font')}">${[['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono']].map(([k, l]) => `<option value="${k}"${P.font === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
         <div class="chips"><button class="chip${P.bold ? ' on' : ''}" onclick="paintSet('bold', !${P.bold})">${T('Bold')}</button>
           <button class="chip" onclick="paintSet('text', '${B.PHONE}'); paintTool('text')">${T('Phone number')}</button></div>`;
  }
  const swatches = (cur, fn) => SWATCHES.map(c => `<button class="${cur === c ? 'on' : ''}" style="background:${c}" onclick="${fn}('${c}')" aria-label="${c}"></button>`).join('')
    + `<input type="color" value="${cur.toLowerCase()}" onchange="${fn}(this.value)" aria-label="${T('Other colour')}">`;
  function paintSw() { const box = $p('pn_sw'); if (box) box.innerHTML = swatches(P.color, 'paintColor') }
  function paintNum() { const box = $p('pn_num'); if (box) box.innerHTML = swatches(P.num, 'paintNumColor') }
  // The tag as it prints, from the two pictures as they are now.
  function preview() {
    clearTimeout(P.pt_);
    P.pt_ = setTimeout(() => {
      if (!P) return;
      B.setCustom('cdraft', { name: P.name, front: face('front').main.toDataURL('image/png'), back: face('back').main.toDataURL('image/png'), num: P.num, bg: P.bg.back, fbg: P.bg.front }, true);
      const box = $p('pn_prev'); if (box) box.innerHTML = B.pair('cdraft', '404:1');
    }, 120);
  }
  // Both sides at the same scale, as large as the room allows (14 px per mm at most).
  function fit() {
    const st = $p('pn_stage'); if (!st || !P) return;
    const W = st.clientWidth, side = W >= 61 * 9 + 26;
    const mm = Math.max(6, Math.min(14, side ? (W - 26) / 61 : (W - 2) / 37.5));
    for (const f of ['front', 'back']) { const c = face(f).wrap; c.style.width = (SIZE[f][0] / PX * mm) + 'px'; c.style.height = (SIZE[f][1] / PX * mm) + 'px' }
  }
  function key(e) {
    if (!P || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
    const m = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (m && k === 'z' && !e.shiftKey) { e.preventDefault(); window.paintUndo() }
    else if (m && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); window.paintRedo() }
  }

  window.paintOpen = async function (id) {
    if (!document.getElementById('pntcss')) { const s = document.createElement('style'); s.id = 'pntcss'; s.textContent = CSS; document.head.appendChild(s) }
    const rec = id ? ((typeof tagTpls !== 'undefined' && tagTpls) || []).find(t => t.id === id) : null;
    P = { id: rec ? rec.id : '', created: rec ? rec.created : 0, name: rec ? rec.name : '', face: 'front', tool: 'pen', before: 'pen', size: 6, filled: false,
          color: '#FFFFFF', text: '', pt: 10, font: 'sans', bold: true, wm: 33, num: '#FFFFFF', bg: { front: '#16453E', back: '#16453E' },
          cv: {}, undo: [], redo: [], drag: null, dirty: false };
    const el = admSheet('atpl', topbar(rec ? T('Edit design') : T('New design'), T('Tags'), null, 'paintClose()') + `<div class="wrap tgwide"><div class="pnt">
        <div class="pnt-tools">
          <div class="card">
            <div class="field"><label class="eyebrow">${T('Name')}</label><input id="pn_name" value="${esc(P.name)}" placeholder="${T('Own design')}" oninput="paintSet('name', this.value)" autocomplete="off"></div>
            <div class="field"><label class="eyebrow">${T('Start from')}</label><div class="chips">${B.ORDER.filter(k => !B.TEMPLATES[k].custom).map(k => `<button class="chip" onclick="paintStart('${k}')">${T(B.TEMPLATES[k].name)}</button>`).join('')}<button class="chip" onclick="paintStart('blank')">${T('Blank')}</button></div></div>
          </div>
          <div class="csec">${T('Tools')}</div>
          <div class="pnt-tgrid" id="pn_tools"></div>
          <div class="pnt-opts" id="pn_opts"></div>
          <div class="csec">${T('Colour')}</div>
          <div class="pnt-sw" id="pn_sw"></div>
          <div class="pnt-row"><button class="btn ghost small" onclick="paintFillSide()">${T('Fill the whole side')}</button></div>
          <div class="csec">${T('The number on the back')}</div>
          <div class="pnt-sw" id="pn_num"></div>
          <div class="pnt-row"><button class="btn ghost small" onclick="paintUndo()">↶ ${T('Undo')}</button><button class="btn ghost small" onclick="paintRedo()">↷ ${T('Redo')}</button></div>
        </div>
        <div class="pnt-stage" id="pn_stage">
          <div class="pnt-face on" id="pn_f_front"><div class="eyebrow">${T('Front side')}</div><div class="pnt-cv" id="pn_w_front"><canvas id="pn_c_front"></canvas><canvas id="pn_o_front"></canvas></div></div>
          <div class="pnt-face" id="pn_f_back"><div class="eyebrow">${T('Back side')} · ${T('the code and the number go on top')}</div><div class="pnt-cv" id="pn_w_back"><canvas id="pn_c_back"></canvas><canvas id="pn_o_back"></canvas></div></div>
          <div class="pnt-prev"><div class="eyebrow">${T('As it prints')}</div><div id="pn_prev"></div></div>
        </div>
      </div></div>
      <div class="sheetbar"><button class="btn ghost" onclick="paintClose()">${T('Cancel')}</button>
        ${rec ? `<button class="btn ghost" onclick="paintDelete()">${T('Delete design')}</button>` : ''}
        <button class="btn" id="pn_save" onclick="paintSave()">${T('Save design')}</button></div>`);
    window.scrollTo(0, 0);
    for (const f of ['front', 'back']) {
      const main = $p('pn_c_' + f), ov = $p('pn_o_' + f);
      main.width = ov.width = SIZE[f][0]; main.height = ov.height = SIZE[f][1];
      P.cv[f] = { main, ov, ctx: main.getContext('2d', { willReadFrequently: true }), octx: ov.getContext('2d'), wrap: $p('pn_w_' + f) };
      ov.addEventListener('pointerdown', e => down(e, f));
      ov.addEventListener('pointermove', e => move(e, f));
      ov.addEventListener('pointerup', e => up(e, f));
      ov.addEventListener('pointercancel', e => up(e, f));
    }
    if (rec) {
      P.num = rec.num; P.bg = { front: (rec.bg && rec.bg.front) || '#FFFFFF', back: (rec.bg && rec.bg.back) || '#FFFFFF' };
      for (const f of ['front', 'back']) {
        const img = new Image(); img.src = rec[f];
        try { await img.decode() } catch (e) {}
        if (!P) return;
        face(f).ctx.drawImage(img, 0, 0, SIZE[f][0], SIZE[f][1]);
      }
    } else preset('green');
    P.color = P.num;
    paintTools(); paintOpts(); paintSw(); paintNum(); guides('back'); fit(); preview();
    window.addEventListener('resize', fit);
    document.addEventListener('keydown', key);
  };
  // Closing throws away what was drawn, so that one case asks first.
  window.paintClose = function (force) {
    if (!P) return;
    if (!force && P.dirty && !confirm(T('Close without saving?'))) return;
    window.removeEventListener('resize', fit);
    document.removeEventListener('keydown', key);
    clearTimeout(P.pt_);
    B.dropCustom('cdraft');
    P = null;
    const el = document.getElementById('atpl'); if (el) el.remove();
  };
  window.paintSave = async function () {
    if (!P) return;
    const btn = $p('pn_save'); if (btn) btn.disabled = true;
    const rec = { id: P.id || ('c' + uid()), name: P.name.trim() || T('Own design'), front: face('front').main.toDataURL('image/png'), back: face('back').main.toDataURL('image/png'),
                  num: P.num, bg: { ...P.bg }, created: P.created || Date.now(), updated: Date.now() };
    const ok = await window.tagTplPut(rec);
    if (btn) btn.disabled = false;
    if (!ok) return toast(T('Could not save on this device'));
    window.paintClose(true);
    toast(T('Design saved') + ': ' + rec.name);
    window.tagTplChosen(rec.id);
  };
  window.paintDelete = async function () {
    if (!P || !P.id || !confirm(T('Delete this design? Tags on the sheet in it go back to green.'))) return;
    if (!await window.tagTplDel(P.id)) return toast(T('Could not save on this device'));
    window.paintClose(true);
    toast(T('Design deleted'));
  };
})();
