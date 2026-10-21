/* Draw a tag design: Key admin → Tags → New design (2026-10-21). A small paint program, after
 * Erik: draw and write on the front and the back of the tag yourself.
 *
 * Loaded on demand by index.html (openTplEditor), so it costs nothing anywhere else. It uses the
 * app's own helpers (T, esc, toast, admSheet, topbar, uid) and tags.js, both loaded by then.
 *
 * Each face is a canvas at 12 px per mm (about 300 dpi): the front 37.5 x 23.5 mm, the back
 * 23.5 x 37.5 mm, in three layers:
 *   paint    what is drawn - pen, eraser (paints the side's background colour), line, rectangle,
 *            ellipse (outline or filled), fill bucket
 *   objects  text boxes and the Beaps wordmark, always on top and never burnt in: click one to
 *            change it, drag it to move it (it snaps to the middle of the side), centre it with a
 *            tap (Erik: text that is already there should be easy to change)
 *   overlay  what only the editor shows: where the code and the number go on the back, the
 *            selected box, the middle lines while dragging, a shape being drawn
 * Saved with the device's other tag data (tagTplPut in index.html), nothing to the server: the two
 * sides as printed (paint + objects, PNG), and the layers apart, so the boxes stay boxes when the
 * design is opened again. On the back, the QR code on its white field and the bundle number are
 * laid on top when the tag is made, so a drawn tag scans like any other.
 *
 * Undo / redo, also Ctrl+Z / Ctrl+Y. Delete removes the selected box, the arrows nudge it, Esc lets
 * go of it. "Start from" draws one of the three printed designs to build on - its wordmark and
 * phone number as boxes.
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
  const POINTS = [5, 6, 7, 8, 10, 12, 14, 18, 24, 32];
  const FONTS = { sans: 'Arial, Helvetica, sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: 'Consolas, "Courier New", monospace' };
  const SNAP = 8;                                  // px from the middle that a dragged box snaps to it
  const ICON = {
    select: '<path d="M5 3l10.5 6.5-4.6 1.4 2.6 5.3-2 1-2.6-5.4L5 15z"/>',
    pen: '<path d="M4 16l1.5-4.5L14 3l3 3-8.5 8.5z"/><path d="M12 5l3 3"/>',
    eraser: '<path d="M3 13.5l7.5-7.5 5.5 5.5-4.5 4.5H7z"/><path d="M8 16h9"/>',
    line: '<path d="M4 16L16 4"/>',
    rect: '<rect x="3" y="5" width="14" height="10" rx="1"/>',
    ellipse: '<ellipse cx="10" cy="10" rx="7.5" ry="5.5"/>',
    fill: '<path d="M3.5 9.5L9 4l6 6-5.5 5.5z"/><path d="M3.5 9.5h11.5"/><path d="M17 12.5c.9 1.5 1.4 2.4 1.4 3a1.4 1.4 0 01-2.8 0c0-.6.5-1.5 1.4-3z"/>',
    text: '<rect x="2.5" y="4" width="15" height="12" rx="1.5" stroke-dasharray="2 2"/><path d="M6.5 7.5h7M10 7.5v6"/>',
    pick: '<path d="M12.5 3.5l4 4-2 2-4-4z"/><path d="M10.5 5.5L4 12v4h4l6.5-6.5"/>',
    wm: '<path d="M3 8h14M3 12h9"/>'
  };
  const TOOLS = [['select', 'Select'], ['pen', 'Pen'], ['eraser', 'Eraser'], ['line', 'Line'], ['rect', 'Rectangle'],
                 ['ellipse', 'Ellipse'], ['fill', 'Fill'], ['text', 'Text box'], ['pick', 'Eyedropper'], ['wm', 'Wordmark']];
  const CSS = `
.pnt{display:flex;flex-direction:column;gap:16px}
.pnt-stage{order:-1}
@media (min-width:960px){ .pnt{display:grid;grid-template-columns:310px minmax(0,1fr);gap:28px;align-items:start} .pnt-stage{order:0;position:sticky;top:12px}
  .pnt-prev .tg-pair{zoom:1.6} }
.pnt-tgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.pnt-tool{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 2px 6px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:11px;line-height:1.15;min-width:0}
.pnt-tool svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.pnt-tool.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.pnt-opts{margin-top:12px;display:flex;flex-direction:column;gap:10px}
.pnt-opts .kfrow{margin-top:0}
.pnt-opts select{flex:1;min-width:0;font-family:inherit;font-size:15px;padding:9px 10px;border:1px solid var(--line);border-radius:9px;background:#fff;color:var(--ink)}
.pnt-opts .field{margin-bottom:0}
.pnt-opts input[type=range]{padding:0;border:0;background:none}
.pnt-opts textarea{min-height:0;font-size:16px;padding:10px 12px}
.pnt-obj{background:#fff;border:1px solid var(--ink);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px}
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
.pnt-cv canvas + canvas{position:absolute;left:0;top:0}
.pnt-cv canvas:last-child{cursor:crosshair}
.pnt-cv.sel canvas:last-child{cursor:default}
.pnt-prev{display:flex;flex-direction:column;gap:6px}
`;
  let P = null;

  const rgb = h => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] };
  const hex = d => '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const okHex = h => /^#[0-9A-Fa-f]{6}$/.test(String(h || ''));
  const $p = id => document.getElementById(id);
  const face = f => P.cv[f];
  const copy = o => JSON.parse(JSON.stringify(o));

  // ----- the wordmark: the same paths as the printed tags -----
  function wordmarkPaths() {
    const s = B.WORDMARK, i = s.indexOf('<g transform');
    const ds = part => [...part.matchAll(/ d="([^"]+)"/g)].map(m => new Path2D(m[1]));
    return { top: ds(s.slice(0, i)), bottom: ds(s.slice(i)) };
  }
  let WM = null;
  const wmH = w => w * 25.6 / 389.2;
  function drawWordmark(ctx, cx, cy, w, color) {
    WM = WM || wordmarkPaths();
    const k = w / 389.2, h = wmH(w);
    ctx.save();
    ctx.translate(cx - w / 2 + 1 * k, cy - h / 2 + 1.6 * k);
    ctx.scale(k, k);
    ctx.fillStyle = color;
    WM.top.forEach(p => ctx.fill(p));
    ctx.translate(178.8, -28.6);
    WM.bottom.forEach(p => ctx.fill(p));
    ctx.restore();
  }

  // ----- text boxes and the wordmark: { id, type: 'text'|'wm', cx, cy, color, and for text
  //       text, pt, font, weight, align, ls (letter spacing in em); for the wordmark w (px) } -----
  const sizePx = o => o.pt * 0.3528 * PX;
  function textLayout(ctx, o) {
    ctx.font = `${o.weight || 400} ${sizePx(o).toFixed(1)}px ${FONTS[o.font] || FONTS.sans}`;
    try { ctx.letterSpacing = o.ls ? (o.ls * sizePx(o)).toFixed(1) + 'px' : '0px' } catch (e) {}
    const lines = String(o.text || '').split('\n'), lh = sizePx(o) * 1.2;
    const ws = lines.map(l => ctx.measureText(l).width);
    return { lines, w: Math.max(sizePx(o) * .4, ...ws), h: lh * lines.length, lh };
  }
  function bounds(o, f) {
    if (o.type === 'wm') return { x: o.cx - o.w / 2, y: o.cy - wmH(o.w) / 2, w: o.w, h: wmH(o.w) };
    const ctx = face(f).jctx;
    ctx.save(); const L = textLayout(ctx, o); ctx.restore();
    return { x: o.cx - L.w / 2, y: o.cy - L.h / 2, w: L.w, h: L.h };
  }
  function drawObj(ctx, o) {
    if (o.type === 'wm') return drawWordmark(ctx, o.cx, o.cy, o.w, o.color);
    ctx.save();
    const L = textLayout(ctx, o);
    ctx.fillStyle = o.color; ctx.textBaseline = 'middle';
    ctx.textAlign = o.align === 'left' ? 'left' : o.align === 'right' ? 'right' : 'center';
    const x = o.align === 'left' ? o.cx - L.w / 2 : o.align === 'right' ? o.cx + L.w / 2 : o.cx;
    L.lines.forEach((l, i) => ctx.fillText(l, x, o.cy - L.h / 2 + L.lh * (i + .5)));
    ctx.restore();
  }
  function renderObjs(f) { const c = face(f); c.jctx.clearRect(0, 0, c.obj.width, c.obj.height); P.objs[f].forEach(o => drawObj(c.jctx, o)) }
  // What a stored design may hold, whatever the storage gave back.
  function cleanObj(o, f) {
    if (!o || (o.type !== 'text' && o.type !== 'wm')) return null;
    const n = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d };
    const [W, H] = SIZE[f];
    const out = { id: String(o.id || uid()).slice(0, 24), type: o.type, cx: n(o.cx, -W, 2 * W, W / 2), cy: n(o.cy, -H, 2 * H, H / 2), color: okHex(o.color) ? o.color.toUpperCase() : '#000000' };
    if (o.type === 'wm') return { ...out, w: n(o.w, 2 * PX, 40 * PX, 33 * PX) };
    return { ...out, text: String(o.text == null ? '' : o.text).slice(0, 200), pt: n(o.pt, 4, 48, 10), font: FONTS[o.font] ? o.font : 'sans',
             weight: [400, 600, 700].includes(Number(o.weight)) ? Number(o.weight) : 700, align: ['left', 'center', 'right'].includes(o.align) ? o.align : 'center', ls: n(o.ls, 0, .5, 0) };
  }
  const hitObj = (f, p) => { const os = P.objs[f]; for (let i = os.length - 1; i >= 0; i--) { const b = bounds(os[i], f); if (p.x >= b.x - 6 && p.x <= b.x + b.w + 6 && p.y >= b.y - 6 && p.y <= b.y + b.h + 6) return os[i] } return null };
  const selObj = () => P && P.sel ? P.objs[P.sel.f].find(o => o.id === P.sel.id) || null : null;

  // ----- painting -----
  function fillAll(f, color) { const c = face(f); c.ctx.fillStyle = color; c.ctx.fillRect(0, 0, c.main.width, c.main.height); P.bg[f] = color }
  // One of the printed designs, to build on: the colour on both sides, and on the front the
  // wordmark and the phone number as tags.js sets them - as boxes, so both can be changed.
  function preset(key) {
    if (key === 'blank') { fillAll('front', '#FFFFFF'); fillAll('back', '#FFFFFF'); P.num = '#000000'; P.objs = { front: [], back: [] }; return }
    const t = B.TEMPLATES[key], W = SIZE.front[0];
    fillAll('front', t.bg); fillAll('back', t.bg); P.num = t.num;
    // 33 mm wordmark, 2.2 mm gap, 7 pt phone number, centred in the 23.5 mm height
    const wh = 33 * 25.6 / 389.2, th = 7 * 0.3528, top = (23.5 - (wh + 2.2 + th)) / 2;
    P.objs = { back: [], front: [
      { id: uid(), type: 'wm', cx: W / 2, cy: (top + wh / 2) * PX, w: 33 * PX, color: t.text },
      { id: uid(), type: 'text', text: B.PHONE, cx: W / 2, cy: (top + wh + 2.2 + th / 2) * PX, color: t.text, pt: 7, font: 'mono', weight: 600, align: 'center', ls: .09 }
    ] };
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
  // A side as it prints: the painting with the boxes on it.
  function flat(f) {
    const c = document.createElement('canvas'); c.width = SIZE[f][0]; c.height = SIZE[f][1];
    const x = c.getContext('2d'); x.drawImage(face(f).main, 0, 0); P.objs[f].forEach(o => drawObj(x, o));
    return c;
  }

  // ----- the overlay -----
  function overlay(f) {
    const c = face(f), o = c.octx, [W, H] = SIZE[f];
    o.clearRect(0, 0, W, H);
    o.save();
    if (f === 'back') {
      o.fillStyle = 'rgba(255,255,255,.82)'; o.fillRect(QR.x, QR.y, QR.w, QR.h);
      o.setLineDash([8, 6]); o.lineWidth = 2; o.strokeStyle = 'rgba(22,50,92,.7)';
      o.strokeRect(QR.x, QR.y, QR.w, QR.h); o.strokeRect(NUM.x, NUM.y, NUM.w, NUM.h);
      o.fillStyle = 'rgba(22,50,92,.75)'; o.font = `600 ${3 * PX}px Arial, sans-serif`; o.textAlign = 'center'; o.textBaseline = 'middle';
      o.fillText(T('QR code'), QR.x + QR.w / 2, QR.y + QR.h / 2);
      o.globalAlpha = .55; o.fillStyle = P.num; o.font = `700 ${16.5 * 0.3528 * PX}px Arial, sans-serif`;
      o.fillText('404:1', NUM.x + NUM.w / 2, NUM.y + NUM.h / 2);
      o.globalAlpha = 1;
    }
    if (P.snap && P.snap.f === f) {
      o.setLineDash([]); o.lineWidth = 2; o.strokeStyle = '#E2387D';
      if (P.snap.v) { o.beginPath(); o.moveTo(W / 2, 0); o.lineTo(W / 2, H); o.stroke() }
      if (P.snap.h) { o.beginPath(); o.moveTo(0, H / 2); o.lineTo(W, H / 2); o.stroke() }
    }
    const s = selObj();
    if (s && P.sel.f === f) {
      const b = bounds(s, f);
      o.setLineDash([7, 5]); o.lineWidth = 2; o.strokeStyle = '#2E6DB4';
      o.strokeRect(b.x - 5, b.y - 5, b.w + 10, b.h + 10);
      o.setLineDash([]); o.fillStyle = '#fff';
      for (const [x, y] of [[b.x - 5, b.y - 5], [b.x + b.w + 5, b.y - 5], [b.x - 5, b.y + b.h + 5], [b.x + b.w + 5, b.y + b.h + 5]]) { o.fillRect(x - 4, y - 4, 8, 8); o.strokeRect(x - 4, y - 4, 8, 8) }
    }
    o.restore();
    if (P.drag && P.drag.mode === 'shape' && P.drag.f === f) shape(o, P.drag);
  }
  const redraw = f => { renderObjs(f); overlay(f) };

  // ----- undo: the paint of each side a step touched, all the boxes, the colours -----
  function snapshot(faces) {
    const e = { faces: {}, objs: copy(P.objs), bg: { ...P.bg }, num: P.num };
    for (const f of faces) e.faces[f] = face(f).ctx.getImageData(0, 0, SIZE[f][0], SIZE[f][1]);
    return e;
  }
  function begin(faces) { P.undo.push(snapshot(faces)); if (P.undo.length > 30) P.undo.shift(); P.redo = [] }
  function step(from, to) {
    const e = from.pop(); if (!e) return;
    to.push(snapshot(Object.keys(e.faces)));
    for (const f of Object.keys(e.faces)) face(f).ctx.putImageData(e.faces[f], 0, 0);
    P.objs = copy(e.objs); P.bg = { ...e.bg }; P.num = e.num;
    if (!selObj()) P.sel = null;
    P.editing = false;
    P.dirty = true; redraw('front'); redraw('back'); paintNum(); paintOpts(); preview();
  }
  window.paintUndo = () => P && step(P.undo, P.redo);
  window.paintRedo = () => P && step(P.redo, P.undo);
  function commit() { P.dirty = true; preview() }

  // ----- selecting a box -----
  function select(f, o) {
    const was = P.sel;
    if (was && (!o || was.id !== o.id)) dropEmpty(was);
    P.sel = o ? { f, id: o.id } : null;
    P.editing = false;
    if (o) { P.color = o.color; paintSw() }
    ['front', 'back'].forEach(x => { face(x).wrap.classList.toggle('sel', !!P.sel); overlay(x) });
    paintOpts();
  }
  // A text box left with no text in it goes when it is let go of.
  function dropEmpty(s) {
    const os = P.objs[s.f], i = os.findIndex(o => o.id === s.id);
    if (i >= 0 && os[i].type === 'text' && !String(os[i].text).trim()) { os.splice(i, 1); renderObjs(s.f); commit() }
  }
  function change(fn) {
    const o = selObj(); if (!o) return;
    begin([]); fn(o); redraw(P.sel.f); commit();
  }
  window.paintObjText = v => {
    const o = selObj(); if (!o) return;
    if (!P.editing) { begin([]); P.editing = true }   // one undo step for one round of typing
    o.text = v; redraw(P.sel.f); commit();
  };
  window.paintObjSet = (k, v) => { change(o => { o[k] = v }); paintOpts() };
  window.paintCenter = axis => change(o => { const [W, H] = SIZE[P.sel.f]; if (axis !== 'v') o.cx = W / 2; if (axis !== 'h') o.cy = H / 2 });
  window.paintObjDel = () => {
    if (!P || !P.sel) return;
    begin([]);
    P.objs[P.sel.f] = P.objs[P.sel.f].filter(o => o.id !== P.sel.id);
    const f = P.sel.f; P.sel = null; P.editing = false;
    redraw(f); face(f).wrap.classList.remove('sel'); paintOpts(); commit();
  };

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
    if (t === 'pick') {
      const d = flat(f).getContext('2d').getImageData(p.x | 0, p.y | 0, 1, 1).data;
      setColor(hex(d)); setTool(P.before || 'pen'); return;
    }
    // The pointer, the text box and the wordmark tools pick up a box that is already there.
    const hit = (t === 'select' || t === 'text' || t === 'wm') ? hitObj(f, p) : null;
    if (hit) { select(f, hit); P.drag = { mode: 'move', f, o: hit, dx: p.x - hit.cx, dy: p.y - hit.cy, moved: false }; return }
    if (t === 'select') return select(f, null);
    if (t === 'text' || t === 'wm') {
      begin([]);
      const o = t === 'text'
        ? { id: uid(), type: 'text', text: T('Text'), cx: p.x, cy: p.y, color: P.color, pt: P.pt, font: P.font, weight: P.bold ? 700 : 400, align: P.align, ls: 0 }
        : { id: uid(), type: 'wm', cx: p.x, cy: p.y, w: P.wm * PX, color: P.color };
      P.objs[f].push(o);
      renderObjs(f); select(f, o); commit();
      // Straight into writing: the new box's words are selected, so typing replaces them.
      if (t === 'text') { const ta = $p('pn_text'); if (ta) { ta.focus(); ta.select() } }
      return;
    }
    if (P.sel) select(f, null);
    begin([f]);
    if (t === 'fill') { flood(c.ctx, p.x | 0, p.y | 0, P.color); return commit() }
    P.drag = { mode: t === 'pen' || t === 'eraser' ? 'paint' : 'shape', f, x0: p.x, y0: p.y, x: p.x, y: p.y };
    if (P.drag.mode === 'paint') stroke(c.ctx, p, p, t === 'eraser' ? P.bg[f] : P.color);
  }
  function move(e, f) {
    const d = P && P.drag; if (!d || d.f !== f) return;
    const c = face(f), [W, H] = SIZE[f];
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    if (d.mode === 'move') {
      const p = pos(evs[evs.length - 1], c);
      let x = p.x - d.dx, y = p.y - d.dy;
      if (!d.moved && Math.hypot(x - d.o.cx, y - d.o.cy) < 2) return;
      if (!d.moved) { begin([]); d.moved = true; d.o = selObj() }
      // Close to the middle of the side, it is the middle.
      const v = Math.abs(x - W / 2) < SNAP, h = Math.abs(y - H / 2) < SNAP;
      if (v) x = W / 2; if (h) y = H / 2;
      d.o.cx = x; d.o.cy = y; P.snap = { f, v, h };
      return redraw(f);
    }
    for (const ev of evs) {
      const p = pos(ev, c);
      if (d.mode === 'paint') stroke(c.ctx, d, p, P.tool === 'eraser' ? P.bg[f] : P.color);
      d.x = p.x; d.y = p.y;
    }
    if (d.mode === 'shape') overlay(f);
  }
  function up(e, f) {
    const d = P && P.drag; if (!d || d.f !== f) return;
    P.drag = null; P.snap = null;
    if (d.mode === 'move') { overlay(f); if (d.moved) commit(); return }
    if (d.mode === 'shape') shape(face(f).ctx, d);
    overlay(f); commit();
  }

  // ----- the page -----
  function setFace(f) { P.face = f; ['front', 'back'].forEach(x => { const el = $p('pn_f_' + x); if (el) el.classList.toggle('on', x === f) }) }
  function setTool(t) {
    if (t === 'pick' && P.tool !== 'pick') P.before = P.tool;
    P.tool = t;
    if (P.sel && !['select', 'text', 'wm'].includes(t)) select(P.face, null);
    paintTools(); paintOpts();
  }
  // A colour picked with a box selected is that box's colour too.
  function setColor(c) {
    if (!okHex(c)) return;
    P.color = c.toUpperCase(); paintSw();
    const o = selObj(); if (o && o.color !== P.color) change(x => { x.color = P.color });
  }
  window.paintTool = setTool;
  window.paintColor = setColor;
  window.paintSet = (k, v) => { P[k] = v; if (k === 'name') P.dirty = true; if (k === 'filled' || k === 'bold' || k === 'align' || k === 'wm') paintOpts() };
  window.paintNumColor = c => { if (!okHex(c) || c.toUpperCase() === P.num) return; begin([]); P.num = c.toUpperCase(); paintNum(); overlay('back'); commit() };
  window.paintFillSide = () => { begin([P.face]); fillAll(P.face, P.color); overlay(P.face); commit() };
  window.paintStart = key => { begin(['front', 'back']); P.sel = null; ['front', 'back'].forEach(x => face(x).wrap.classList.remove('sel')); preset(key); redraw('front'); redraw('back'); paintNum(); paintOpts(); commit() };

  function paintTools() {
    const box = $p('pn_tools'); if (!box) return;
    box.innerHTML = TOOLS.map(([k, l]) => `<button class="pnt-tool${P.tool === k ? ' on' : ''}" onclick="paintTool('${k}')" aria-pressed="${P.tool === k}" title="${T(l)}"><svg viewBox="0 0 20 20">${ICON[k]}</svg>${T(l)}</button>`).join('');
  }
  const chip = (on, label, click) => `<button class="chip${on ? ' on' : ''}" onclick="${click}">${label}</button>`;
  const ptSel = (cur, fn) => `<select onchange="${fn}" aria-label="${T('Size')}">${POINTS.concat(POINTS.includes(cur) ? [] : [cur]).sort((a, b) => a - b).map(p => `<option value="${p}"${cur === p ? ' selected' : ''}>${p} pt</option>`).join('')}</select>`;
  const fontSel = (cur, fn) => `<select onchange="${fn}" aria-label="${T('Font')}">${[['sans', 'Sans'], ['serif', 'Serif'], ['mono', 'Mono']].map(([k, l]) => `<option value="${k}"${cur === k ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const alignChips = (cur, fn) => [['left', 'Align left'], ['center', 'Align centre'], ['right', 'Align right']].map(([k, l]) => chip(cur === k, T(l), `${fn}('align','${k}')`)).join('');
  const centreRow = () => `<div class="field"><label class="eyebrow">${T('Centre on the side')}</label><div class="chips">${chip(false, T('Across'), "paintCenter('h')")}${chip(false, T('Up and down'), "paintCenter('v')")}${chip(false, T('In the middle'), "paintCenter('b')")}</div></div>`;
  function paintOpts() {
    const box = $p('pn_opts'); if (!box) return;
    const o = selObj();
    if (o && o.type === 'text') {
      box.innerHTML = `<div class="pnt-obj"><div class="eyebrow">${T('Text box')}</div>
        <textarea id="pn_text" rows="2" oninput="paintObjText(this.value)" onblur="paintTextBlur()" aria-label="${T('Text')}">${esc(o.text)}</textarea>
        <div class="kfrow">${ptSel(o.pt, "paintObjSet('pt', +this.value)")}${fontSel(o.font, "paintObjSet('font', this.value)")}</div>
        <div class="chips">${chip(o.weight >= 600, T('Bold'), `paintObjSet('weight', ${o.weight >= 600 ? 400 : 700})`)}</div>
        <div class="chips">${alignChips(o.align, 'paintObjSet')}</div>
        ${centreRow()}
        <div class="chips">${chip(false, T('Phone number'), `paintObjText('${B.PHONE}'); paintOpts()`)}${chip(false, T('Delete'), 'paintObjDel()')}</div>
        <div class="hint" style="margin:0">${T('Drag the box to move it. It snaps to the middle.')}</div></div>`;
      return;
    }
    if (o && o.type === 'wm') {
      box.innerHTML = `<div class="pnt-obj"><div class="eyebrow">${T('Wordmark')}</div>
        <div class="field"><label class="eyebrow">${T('Width')}</label><div class="chips">${[15, 20, 26, 33].map(w => chip(Math.round(o.w / PX) === w, w + ' mm', `paintObjSet('w', ${w * PX})`)).join('')}</div></div>
        ${centreRow()}
        <div class="chips">${chip(false, T('Delete'), 'paintObjDel()')}</div>
        <div class="hint" style="margin:0">${T('Drag the box to move it. It snaps to the middle.')}</div></div>`;
      return;
    }
    const t = P.tool, size = `<div class="field"><label class="eyebrow">${T('Size')} <span id="pn_sizev">${P.size}</span></label>
      <input type="range" min="1" max="40" value="${P.size}" oninput="paintSet('size', +this.value); document.getElementById('pn_sizev').textContent = this.value"></div>`;
    const hint = s => `<div class="hint" style="margin:0">${T(s)}</div>`;
    box.innerHTML =
      (t === 'pen' || t === 'line') ? size
      : t === 'eraser' ? size + hint('The eraser paints with the side\'s background colour.')
      : (t === 'rect' || t === 'ellipse') ? size + `<div class="chips">${chip(!P.filled, T('Outline'), "paintSet('filled', false)")}${chip(P.filled, T('Filled'), "paintSet('filled', true)")}</div>`
      : t === 'fill' ? hint('Click in an area to fill it with the colour.')
      : t === 'pick' ? hint('Click on the tag to take its colour.')
      : t === 'select' ? hint('Click a text box or the wordmark to change it, drag to move it.')
      : t === 'wm' ? `<div class="field"><label class="eyebrow">${T('Width')}</label><div class="chips">${[15, 20, 26, 33].map(w => chip(P.wm === w, w + ' mm', `paintSet('wm', ${w})`)).join('')}</div></div>` + hint('Click where the wordmark goes.')
      : `<div class="kfrow">${ptSel(P.pt, "paintSet('pt', +this.value)")}${fontSel(P.font, "paintSet('font', this.value)")}</div>
         <div class="chips">${chip(P.bold, T('Bold'), `paintSet('bold', ${!P.bold})`)}</div>
         <div class="chips">${alignChips(P.align, 'paintSet')}</div>`
        + hint('Click where the text box goes, then write in it. Click a text box to change it.');
  }
  window.paintTextBlur = () => { if (P) P.editing = false };
  const swatches = (cur, fn) => SWATCHES.map(c => `<button class="${cur === c ? 'on' : ''}" style="background:${c}" onclick="${fn}('${c}')" aria-label="${c}"></button>`).join('')
    + `<input type="color" value="${cur.toLowerCase()}" onchange="${fn}(this.value)" aria-label="${T('Other colour')}">`;
  function paintSw() { const box = $p('pn_sw'); if (box) box.innerHTML = swatches(P.color, 'paintColor') }
  function paintNum() { const box = $p('pn_num'); if (box) box.innerHTML = swatches(P.num, 'paintNumColor') }
  // The tag as it prints, from the two sides as they are now.
  function preview() {
    clearTimeout(P.pt_);
    P.pt_ = setTimeout(() => {
      if (!P) return;
      B.setCustom('cdraft', { name: P.name, front: flat('front').toDataURL('image/png'), back: flat('back').toDataURL('image/png'), num: P.num, bg: P.bg.back, fbg: P.bg.front }, true);
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
    else if (!P.sel) return;
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); window.paintObjDel() }
    else if (e.key === 'Escape') select(P.sel.f, null);
    else if (/^Arrow/.test(e.key)) {
      e.preventDefault();
      const n = e.shiftKey ? 10 : 1, dx = { ArrowLeft: -n, ArrowRight: n }[e.key] || 0, dy = { ArrowUp: -n, ArrowDown: n }[e.key] || 0;
      change(o => { o.cx += dx; o.cy += dy });
    }
  }
  // Read-only, for the tests: the boxes on a side.
  window.paintObjects = f => P ? copy(P.objs[f]) : [];

  window.paintOpen = async function (id) {
    if (!document.getElementById('pntcss')) { const s = document.createElement('style'); s.id = 'pntcss'; s.textContent = CSS; document.head.appendChild(s) }
    const rec = id ? ((typeof tagTpls !== 'undefined' && tagTpls) || []).find(t => t.id === id) : null;
    P = { id: rec ? rec.id : '', created: rec ? rec.created : 0, name: rec ? rec.name : '', face: 'front', tool: 'select', before: 'pen', size: 6, filled: false,
          color: '#FFFFFF', pt: 10, font: 'sans', bold: true, align: 'center', wm: 33, num: '#FFFFFF', bg: { front: '#16453E', back: '#16453E' },
          objs: { front: [], back: [] }, sel: null, editing: false, snap: null, cv: {}, undo: [], redo: [], drag: null, dirty: false };
    admSheet('atpl', topbar(rec ? T('Edit design') : T('New design'), T('Tags'), null, 'paintClose()') + `<div class="wrap tgwide"><div class="pnt">
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
          <div class="pnt-face on" id="pn_f_front"><div class="eyebrow">${T('Front side')}</div><div class="pnt-cv" id="pn_w_front"><canvas id="pn_c_front"></canvas><canvas id="pn_j_front"></canvas><canvas id="pn_o_front"></canvas></div></div>
          <div class="pnt-face" id="pn_f_back"><div class="eyebrow">${T('Back side')} · ${T('the code and the number go on top')}</div><div class="pnt-cv" id="pn_w_back"><canvas id="pn_c_back"></canvas><canvas id="pn_j_back"></canvas><canvas id="pn_o_back"></canvas></div></div>
          <div class="pnt-prev"><div class="eyebrow">${T('As it prints')}</div><div id="pn_prev"></div></div>
        </div>
      </div></div>
      <div class="sheetbar"><button class="btn ghost" onclick="paintClose()">${T('Cancel')}</button>
        ${rec ? `<button class="btn ghost" onclick="paintDelete()">${T('Delete design')}</button>` : ''}
        <button class="btn" id="pn_save" onclick="paintSave()">${T('Save design')}</button></div>`);
    window.scrollTo(0, 0);
    for (const f of ['front', 'back']) {
      const main = $p('pn_c_' + f), obj = $p('pn_j_' + f), ov = $p('pn_o_' + f);
      main.width = obj.width = ov.width = SIZE[f][0]; main.height = obj.height = ov.height = SIZE[f][1];
      P.cv[f] = { main, obj, ov, ctx: main.getContext('2d', { willReadFrequently: true }), jctx: obj.getContext('2d'), octx: ov.getContext('2d'), wrap: $p('pn_w_' + f) };
      ov.addEventListener('pointerdown', e => down(e, f));
      ov.addEventListener('pointermove', e => move(e, f));
      ov.addEventListener('pointerup', e => up(e, f));
      ov.addEventListener('pointercancel', e => up(e, f));
    }
    if (rec) {
      P.num = rec.num; P.bg = { front: (rec.bg && rec.bg.front) || '#FFFFFF', back: (rec.bg && rec.bg.back) || '#FFFFFF' };
      const L = rec.layers || {};
      for (const f of ['front', 'back']) {
        // A design saved before the boxes came opens with its text as part of the picture.
        const lay = L[f] && /^data:image\/png;base64,/.test(L[f].paint || '') ? L[f] : null;
        const img = new Image(); img.src = lay ? lay.paint : rec[f];
        try { await img.decode() } catch (e) {}
        if (!P) return;
        face(f).ctx.drawImage(img, 0, 0, SIZE[f][0], SIZE[f][1]);
        P.objs[f] = lay && Array.isArray(lay.objs) ? lay.objs.map(o => cleanObj(o, f)).filter(Boolean) : [];
      }
    } else preset('green');
    P.color = P.num;
    paintTools(); paintOpts(); paintSw(); paintNum(); redraw('front'); redraw('back'); fit(); preview();
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
    if (P.sel) select(P.sel.f, null);
    for (const f of ['front', 'back']) P.objs[f] = P.objs[f].filter(o => o.type !== 'text' || String(o.text).trim());
    const btn = $p('pn_save'); if (btn) btn.disabled = true;
    const rec = { id: P.id || ('c' + uid()), name: P.name.trim() || T('Own design'),
                  front: flat('front').toDataURL('image/png'), back: flat('back').toDataURL('image/png'),
                  layers: { front: { paint: face('front').main.toDataURL('image/png'), objs: copy(P.objs.front) },
                            back: { paint: face('back').main.toDataURL('image/png'), objs: copy(P.objs.back) } },
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
