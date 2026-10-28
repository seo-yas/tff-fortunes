// Draws a Freckled Fork tarot card (1080x1920, story-sized) in the Halloween-poster collage style.
const PAL = { navy: "#2a2d54", blush: "#edc9c3", fog: "#e9ecef", chart: "#c4b710", salmon: "#e4a089",
  aqua: "#9bc4c2", green: "#367047", red: "#bb3826", mustard: "#dba51e", ink: "#1a1a1d", paper: "#fbfaf6" };
const F = { block: '"Bowlby One", Impact, sans-serif', didot: '"GFS Didot", Didot, "Bodoni 72", Georgia, serif',
  gothic: '"Didact Gothic", "Century Gothic", Futura, sans-serif', type: '"Special Elite", "Courier New", monospace' };

function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function hashStr(t) { let h = 2166136261; for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function stripes(ctx, x, y, w, h, R) {
  ctx.save(); ctx.strokeStyle = PAL.mustard; ctx.lineWidth = 15; ctx.lineCap = "round";
  for (let sx = x + 22; sx < x + w; sx += 72) {
    const ph = R() * 6.28, amp = 7 + R() * 7;
    ctx.beginPath();
    for (let t = y - 10; t <= y + h + 10; t += 10) { const px = sx + Math.sin(t / 95 + ph) * amp; t === y - 10 ? ctx.moveTo(px, t) : ctx.lineTo(px, t); }
    ctx.stroke();
  }
  ctx.restore();
}

function bat(ctx, x, y, s, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(0, -6);
  ctx.quadraticCurveTo(14, -22, 46, -14); ctx.quadraticCurveTo(38, -6, 40, 4);
  ctx.quadraticCurveTo(32, -2, 26, 6); ctx.quadraticCurveTo(18, 0, 12, 8); ctx.quadraticCurveTo(6, 4, 0, 12);
  ctx.quadraticCurveTo(-6, 4, -12, 8); ctx.quadraticCurveTo(-18, 0, -26, 6); ctx.quadraticCurveTo(-32, -2, -40, 4);
  ctx.quadraticCurveTo(-38, -6, -46, -14); ctx.quadraticCurveTo(-14, -22, 0, -6); ctx.closePath();
  ctx.fillStyle = PAL.ink; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-4, -8); ctx.lineTo(-6, -15); ctx.lineTo(-1, -10); ctx.lineTo(1, -10); ctx.lineTo(6, -15); ctx.lineTo(4, -8); ctx.fill();
  ctx.restore();
}

function web(ctx, cx, cy, r, dir) {
  // corner web like the poster: black fan with cream threads. dir = angle the fan opens toward.
  const spokes = 6, a0 = dir - Math.PI / 4, span = Math.PI / 2;
  const pt = (a, d) => [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
  ctx.save();
  ctx.beginPath(); ctx.moveTo(cx, cy);
  for (let i = 0; i <= spokes; i++) {
    const a = a0 + span * i / spokes; const [px, py] = pt(a, r);
    if (i === 0) ctx.lineTo(px, py);
    else { const am = a - span / spokes / 2; const [qx, qy] = pt(am, r * 0.86); ctx.quadraticCurveTo(qx, qy, px, py); }
  }
  ctx.closePath(); ctx.fillStyle = PAL.ink; ctx.fill();
  ctx.strokeStyle = "#f3eadc"; ctx.lineWidth = 2.2;
  for (let i = 0; i <= spokes; i++) { const [px, py] = pt(a0 + span * i / spokes, r * 0.98); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke(); }
  for (let k = 1; k <= 5; k++) {
    const d = r * k / 5.6; ctx.beginPath();
    for (let i = 0; i <= spokes; i++) {
      const a = a0 + span * i / spokes; const [px, py] = pt(a, d);
      if (!i) ctx.moveTo(px, py); else { const [qx, qy] = pt(a - span / spokes / 2, d * 0.85); ctx.quadraticCurveTo(qx, qy, px, py); }
    }
    ctx.stroke();
  }
  ctx.restore();
}

function star(ctx, x, y, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r * 0.42 : r; ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = PAL.navy; ctx.stroke();
}
function apple(ctx, x, y, r) {
  ctx.beginPath(); ctx.arc(x - r * 0.35, y, r * 0.75, 0, Math.PI * 2); ctx.arc(x + r * 0.35, y, r * 0.75, 0, Math.PI * 2);
  ctx.fillStyle = PAL.red; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = PAL.navy; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - r * 0.6); ctx.lineTo(x + 3, y - r * 1.2); ctx.stroke();
}

// line-art tarot motif in the arch, navy ink with brand-color fills
function motif(ctx, m, x, y, w, h, R) {
  const cx = x + w / 2; ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = PAL.navy; ctx.lineCap = "round";
  if (m === "sun" || m === "hills") {
    const cy = y + 170, r = 70;
    for (let i = 0; i < 20; i++) { const a = i * Math.PI / 10, L = i % 2 ? 125 : 165;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r + 10), cy + Math.sin(a) * (r + 10)); ctx.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = m === "sun" ? PAL.salmon : PAL.chart; ctx.fill(); ctx.stroke();
    if (m === "hills") for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.moveTo(x, y + h * (0.55 + k * 0.08));
      for (let i = 1; i <= 6; i++) ctx.quadraticCurveTo(x + w * (i - 0.5) / 6, y + h * (0.47 + k * 0.08) - R() * 30, x + w * i / 6, y + h * (0.55 + k * 0.08)); ctx.stroke(); }
  } else if (m === "moon") {
    const cy = y + 180; ctx.beginPath(); ctx.arc(cx, cy, 82, 0.6, Math.PI * 2 - 0.6, false);
    ctx.arc(cx + 46, cy - 6, 70, Math.PI * 2 - 0.95, 0.95, true); ctx.closePath(); ctx.fillStyle = PAL.chart; ctx.fill(); ctx.stroke();
    for (let i = 0; i < 9; i++) star(ctx, x + 40 + R() * (w - 80), y + 60 + R() * h * 0.3, 7 + R() * 7, PAL.fog);
  } else if (m === "stars") {
    star(ctx, cx, y + 170, 64, PAL.chart);
    for (let i = 0; i < 10; i++) star(ctx, x + 40 + R() * (w - 80), y + 60 + R() * h * 0.32, 8 + R() * 8, i % 3 ? PAL.fog : PAL.aqua);
  } else if (m === "leaves") {
    for (let i = 0; i < 7; i++) apple(ctx, x + 60 + R() * (w - 120), y + 70 + R() * h * 0.3, 22 + R() * 10);
  } else if (m === "lantern") {
    const lx = cx + 90, ly = y + 190; ctx.beginPath(); ctx.moveTo(lx, y); ctx.lineTo(lx, ly - 70); ctx.stroke();
    rr(ctx, lx - 36, ly - 70, 72, 120, 14); ctx.fillStyle = PAL.chart; ctx.fill(); ctx.stroke();
    star(ctx, lx, ly - 10, 20, PAL.fog);
  } else if (m === "wheel") {
    const cy = y + h * 0.36, r = w * 0.4; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2); ctx.fillStyle = PAL.salmon; ctx.fill(); ctx.stroke();
  } else if (m === "scales") {
    const cy = y + 150; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(cx, y + 50); ctx.lineTo(cx, cy); ctx.moveTo(cx - 160, cy); ctx.lineTo(cx + 160, cy); ctx.stroke();
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + s * 160, cy); ctx.lineTo(cx + s * 110, cy + 80); ctx.moveTo(cx + s * 160, cy); ctx.lineTo(cx + s * 210, cy + 80); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx + s * 160, cy + 82, 56, 18, 0, 0, Math.PI); ctx.fillStyle = s < 0 ? PAL.aqua : PAL.salmon; ctx.fill(); ctx.stroke(); }
  } else if (m === "cups") {
    ctx.beginPath(); ctx.moveTo(cx - 150, y + 120); ctx.bezierCurveTo(cx - 60, y + 60, cx + 60, y + 130, cx + 150, y + 180);
    ctx.lineWidth = 12; ctx.strokeStyle = PAL.aqua; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = PAL.navy;
    for (const s of [-1, 1]) { const ux = cx + s * 170, uy = y + 150 + (s > 0 ? 60 : 0);
      ctx.beginPath(); ctx.moveTo(ux - 40, uy - 40); ctx.lineTo(ux + 40, uy - 40); ctx.lineTo(ux + 20, uy + 20); ctx.lineTo(ux - 20, uy + 20); ctx.closePath();
      ctx.fillStyle = PAL.chart; ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ux, uy + 20); ctx.lineTo(ux, uy + 50); ctx.moveTo(ux - 22, uy + 52); ctx.lineTo(ux + 22, uy + 52); ctx.stroke(); }
  } else if (m === "wreath") {
    const cy = y + h * 0.45;
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2; star(ctx, cx + Math.cos(a) * w * 0.42, cy + Math.sin(a) * h * 0.4, 12, [PAL.chart, PAL.aqua, PAL.salmon][i % 3]); }
  }
  ctx.restore();
}

// ransom-note numeral: each character on its own scrap
function ransom(ctx, text, cx, cy, R) {
  const styles = [
    { bg: PAL.ink, fg: "#fff", font: `56px ${F.block}` },
    { bg: "#fff", fg: PAL.ink, font: `700 66px ${F.didot}` },
    { bg: PAL.red, fg: "#fff", font: `56px ${F.block}` },
    { bg: PAL.fog, fg: PAL.navy, font: `62px ${F.type}` }];
  const parts = [...text].map((ch, i) => { const st = styles[(i + Math.floor(R() * 4)) % 4]; ctx.font = st.font;
    return { ch, st, w: Math.max(ctx.measureText(ch).width + 26, 54) }; });
  const total = parts.reduce((a, p) => a + p.w + 6, -6); let x = cx - total / 2;
  for (const p of parts) {
    ctx.save(); ctx.translate(x + p.w / 2, cy); ctx.rotate((R() - 0.5) * 0.18);
    ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
    ctx.fillStyle = p.st.bg; ctx.fillRect(-p.w / 2, -42, p.w, 84); ctx.shadowColor = "transparent";
    ctx.fillStyle = p.st.fg; ctx.font = p.st.font; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(p.ch, 0, 4);
    ctx.restore(); x += p.w + 6;
  }
}

function tornStrip(ctx, x, y, w, h, R) {
  ctx.beginPath(); ctx.moveTo(x, y);
  for (let t = 0; t <= w; t += 14) ctx.lineTo(x + t, y + (R() - 0.5) * 6);
  for (let t = 0; t <= h; t += 12) ctx.lineTo(x + w + (R() - 0.5) * 6, y + t);
  for (let t = w; t >= 0; t -= 14) ctx.lineTo(x + t, y + h + (R() - 0.5) * 6);
  for (let t = h; t >= 0; t -= 12) ctx.lineTo(x + (R() - 0.5) * 6, y + t);
  ctx.closePath();
}

function spaced(ctx, text, x, y, sp) {
  let total = 0; for (const ch of text) total += ctx.measureText(ch).width + sp; total -= sp;
  let cx = x - total / 2; ctx.textAlign = "left";
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; }
  ctx.textAlign = "center"; return total;
}
function wrapLines(ctx, text, maxW) {
  const words = text.split(" "), lines = []; let line = "";
  for (const wd of words) { const t = line ? line + " " + wd : wd; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t; }
  if (line) lines.push(line); return lines;
}

const PHOTO_MODE = new Set(["0816", "1261", "2586", "2355", "0699"]);

async function renderCard(canvas, card, opts) {
  const W = 1080, H = 1920; canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d"); const R = rng(hashStr(card.title));
  await Promise.all([`56px "Bowlby One"`, `700 66px "GFS Didot"`, `28px "Didact Gothic"`, `30px "Special Elite"`]
    .map((f) => document.fonts.load(f))).catch(() => {});
  const [cat, logoB, logoW] = await Promise.all([loadImg(`art2/${card.photo}.webp`), loadImg("art2/logo-ff-black.png"), loadImg("art2/logo-ff-white.png")]);

  // page: brand navy with blush freckles
  ctx.fillStyle = PAL.navy; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 220; i++) { ctx.beginPath(); ctx.arc(R() * W, R() * H, 1 + R() * 2.2, 0, 7); ctx.fillStyle = `rgba(237,201,195,${0.08 + R() * 0.18})`; ctx.fill(); }

  // card
  const x0 = 130, y0 = 80, cw = 820, ch = 1420;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
  rr(ctx, x0, y0, cw, ch, 24); ctx.fillStyle = PAL.paper; ctx.fill(); ctx.restore();
  ctx.save(); rr(ctx, x0, y0, cw, ch, 24); ctx.clip();
  stripes(ctx, x0, y0, cw, ch, R);

  // arch panel
  const ax = x0 + 80, aw = cw - 160, atop = y0 + 190, abot = y0 + ch - 230, ar = aw / 2;
  const arch = () => { ctx.beginPath(); ctx.moveTo(ax, abot); ctx.lineTo(ax, atop + ar); ctx.arc(ax + ar, atop + ar, ar, Math.PI, 0); ctx.lineTo(ax + aw, abot); ctx.closePath(); };
  arch(); ctx.fillStyle = PAL.fog; ctx.fill();
  ctx.save(); arch(); ctx.clip(); motif(ctx, card.motif, ax, atop, aw, abot - atop, R); ctx.restore();

  // web in a top corner, bats tumbling from the other side
  const left = R() < 0.5;
  web(ctx, left ? x0 : x0 + cw, y0, 270, left ? Math.PI / 4 : Math.PI * 3 / 4);
  const bx = left ? x0 + cw - 150 : x0 + 150;
  for (let i = 0; i < 6; i++) bat(ctx, bx + (R() - 0.5) * 200, y0 + ch * 0.55 + i * 70 + R() * 40, 0.7 + R() * 0.7, (R() - 0.5) * 0.8);

  // the cat
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.3)"; ctx.shadowBlur = 16; ctx.shadowOffsetY = 8;
  const tilt = (R() - 0.5) * 0.08;
  if (PHOTO_MODE.has(card.photo)) {
    const pw = aw - 30, ph = pw * cat.height / cat.width, py = abot - ph + 10;
    ctx.translate(ax + aw / 2, py + ph / 2); ctx.rotate(tilt);
    ctx.fillStyle = "#fff"; ctx.fillRect(-pw / 2 - 14, -ph / 2 - 14, pw + 28, ph + 28);
    ctx.shadowColor = "transparent"; ctx.drawImage(cat, -pw / 2, -ph / 2, pw, ph);
  } else {
    // find the visible cat's bounding box, then fit it into the arch and stand it on the bottom edge
    const oc = document.createElement("canvas"); oc.width = cat.width; oc.height = cat.height;
    const ox = oc.getContext("2d"); ox.drawImage(cat, 0, 0); const d = ox.getImageData(0, 0, oc.width, oc.height).data;
    let bx0 = oc.width, by0 = oc.height, bx1 = 0, by1 = 0;
    for (let yy = 0; yy < oc.height; yy += 2) for (let xx = 0; xx < oc.width; xx += 2)
      if (d[(yy * oc.width + xx) * 4 + 3] > 40) { if (xx < bx0) bx0 = xx; if (xx > bx1) bx1 = xx; if (yy < by0) by0 = yy; if (yy > by1) by1 = yy; }
    const bw = bx1 - bx0, bh = by1 - by0;
    const sc = Math.min((aw + 80) / bw, (abot - atop - 70) / bh);
    const dw = bw * sc, dh = bh * sc, dy = abot + 30 - dh;
    ctx.translate(ax + aw / 2, dy + dh / 2); ctx.rotate(tilt);
    ctx.drawImage(cat, bx0, by0, bw, bh, -dw / 2, -dh / 2, dw, dh);
  }
  ctx.restore();
  ctx.restore(); // end card clip

  // numeral, ransom style
  ransom(ctx, card.n, W / 2, y0 + 105, R);

  // title on a torn white strip
  ctx.save(); ctx.translate(W / 2, y0 + ch - 150); ctx.rotate(-0.02);
  let fs = 58; ctx.font = `${fs}px ${F.block}`;
  while (ctx.measureText(card.title.toUpperCase()).width > cw - 150 && fs > 34) { fs -= 2; ctx.font = `${fs}px ${F.block}`; }
  const tw = ctx.measureText(card.title.toUpperCase()).width + 60;
  ctx.shadowColor = "rgba(0,0,0,.25)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
  tornStrip(ctx, -tw / 2, -50, tw, 96, R); ctx.fillStyle = "#fff"; ctx.fill(); ctx.shadowColor = "transparent";
  ctx.fillStyle = PAL.red; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(card.title.toUpperCase(), 0, 4);
  ctx.restore();
  ctx.font = `26px ${F.type}`; ctx.fillStyle = PAL.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.save(); ctx.translate(W / 2 - 40, y0 + ch - 70); ctx.rotate(0.01);
  const mt = "modeled by " + CATS[card.cat]; const mw = ctx.measureText(mt).width + 30;
  ctx.fillStyle = PAL.fog; ctx.fillRect(-mw / 2, -22, mw, 44); ctx.fillStyle = PAL.ink; ctx.fillText(mt, 0, 2); ctx.restore();
  const lh = 120, lw = lh * logoB.width / logoB.height; ctx.drawImage(logoB, x0 + cw - lw - 40, y0 + ch - lh - 26, lw, lh);
  rr(ctx, x0, y0, cw, ch, 24); ctx.lineWidth = 4; ctx.strokeStyle = PAL.ink; ctx.stroke();

  // reading strip on navy
  let y = y0 + ch + 74; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = PAL.blush; ctx.font = `700 26px ${F.gothic}`; spaced(ctx, ("Pulled for " + opts.name).toUpperCase(), W / 2, y, 6);
  y += 70; ctx.fillStyle = "#fff"; ctx.font = `52px ${F.didot}`;
  for (const l of wrapLines(ctx, card.key, 880)) { ctx.fillText(l, W / 2, y); y += 60; }
  y += 6; ctx.fillStyle = PAL.fog; ctx.font = `30px ${F.gothic}`; ctx.fillText("Pantry omen: " + opts.omen, W / 2, y);
  const fh = 74, fw = fh * logoW.width / logoW.height;
  ctx.drawImage(logoW, W / 2 - fw / 2, H - 150, fw, fh);
  ctx.fillStyle = PAL.blush; ctx.font = `24px ${F.gothic}`; spaced(ctx, "THE FRECKLED FORK  ·  HALLOWEEN AT THE STARLITE", W / 2, H - 50, 5);
  return canvas;
}
