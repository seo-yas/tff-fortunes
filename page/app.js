// Freckled Fork Fortunes: the page. No framework; the engine is a plain ES module (engine/fortune.mjs).
import * as engine from './engine/fortune.mjs';
import { SHEET_ENDPOINT, LINKS, HANDLE } from './config.js';
import { MENU, DISH_ALIASES, RATINGS, MONTHS, signFor } from './menu.js';

const $ = (s, el = document) => el.querySelector(s);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const QUEUE_KEY = 'fff-queue-v1';
const SOURCE = new URLSearchParams(location.search).get('s') || 'web';

/* ---------- storage that never throws (private mode, full disk) ---------- */
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};

/* ---------- card art ---------- */
let catArt = new Set();
// The real engine loads its line bank (lines.json) once; the stub has none to load. A failed load is retried on the next draw.
let bankLoad = null;
function ensureBank() {
  if (!engine.loadBank) return Promise.resolve();
  if (!bankLoad) bankLoad = engine.loadBank().catch((e) => { bankLoad = null; throw e; });
  return bankLoad;
}
ensureBank().catch(() => {});
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
const artReady = fetch('cards/cats/index.json').then((r) => (r.ok ? r.json() : [])).then((ids) => { catArt = new Set(ids); }).catch(() => {});
// Where the painted numeral and title boxes sit on each cat card (fractions of the 480x720 art). Optional: without it the CSS defaults apply.
let boxes = {};
const boxesReady = fetch('cards/cats/boxes.json').then((r) => (r.ok ? r.json() : {})).then((b) => { boxes = b || {}; }).catch(() => {});
// The card faces are lettered in Fraunces; fit and canvas measuring both need it loaded.
const fontsReady = Promise.all([document.fonts.load('600 100px Fraunces'), document.fonts.load('italic 400 100px Fraunces'), document.fonts.load('400 40px "Instrument Sans"')]).then(() => document.fonts.ready).catch(() => {});

function dishFor(cardId, dishes) {
  const id = String(cardId || '').toLowerCase();
  for (const d of MENU) {
    // A bare arcana id (the-devil) only means the dish card when the guest ate that dish.
    const aliases = DISH_ALIASES[d.id];
    if (id === d.id || id === `dish-${d.id}`) return d;
    if (aliases.includes(id) && dishes.includes(d.id)) return d;
  }
  return null;
}

function artSrc(cardId, dishes = []) {
  const dish = dishFor(cardId, dishes);
  if (dish) return `cards/dish/${dish.id}.webp`;
  return catArt.has(cardId) ? `cards/cats/${cardId}.avif` : null;
}

function placeholder(numeral, title) {
  const ph = document.createElement('div');
  ph.className = 'ph';
  ph.setAttribute('role', 'img');
  ph.setAttribute('aria-label', title);
  ph.innerHTML = `<span class="num"></span><span class="glyph">ff</span><span class="t"></span>`;
  ph.querySelector('.num').textContent = numeral || '';
  ph.querySelector('.t').textContent = title || '';
  return ph;
}

// Where the empty boxes sit when boxes.json is missing (the single measurement of the r1 art).
const BOX = { num: { x: .156, y: .011, w: .688, h: .07 }, title: { x: .108, y: .878, w: .783, h: .085 } };

/* ---------- fitted lettering ----------
   The card is a fixed 2:3, so its height is 150 cqw of its own width. Font sizes are in cqw and the box widths scale with
   the same width, so one fit holds at every card size: measure each text once (canvas, same font), never the DOM. */
const CARD_H = 150, PAD = .06, CAP_FILL = .62, TITLE_SPACING = .06;
// Fraunces has an optical-size axis: glyph widths change with font size unless it is pinned. The lettering pins it
// (font-optical-sizing: none in styles.css), which makes a width measured once true at every card size.
let ruler = null;
const emCache = new Map();
function emWidth(text, spacing = 0, upper = false) {
  const key = `${spacing}|${upper}|${text}`;
  if (emCache.has(key)) return emCache.get(key);
  if (!ruler) {
    ruler = document.createElement('span');
    ruler.className = 'ov-ruler';
    ruler.setAttribute('aria-hidden', 'true');
    document.body.append(ruler);
  }
  ruler.style.letterSpacing = `${spacing}em`;
  ruler.style.textTransform = upper ? 'uppercase' : 'none';
  ruler.textContent = text;
  const em = ruler.getBoundingClientRect().width / 100; // the ruler is set at 100px
  emCache.set(key, em);
  return em;
}
function boxOf(cardId) {
  const b = boxes[cardId];
  return { num: b?.num || BOX.num, title: b?.title || BOX.title, placed: !!b?.num && !!b?.title };
}
// One maximum per kind for every card, from the shortest box: DEATH is not bigger than THE HIGH PRIESTESS.
function capOf(kind) {
  const hs = Object.entries(boxes).filter(([k, b]) => !k.startsWith('_') && b?.[kind]).map(([, b]) => b[kind].h);
  return CAP_FILL * (hs.length ? Math.min(...hs) : BOX[kind].h) * CARD_H;
}
// Font sizes in cqw (percent of card width) for a cat card's numeral and title.
function fontSizes(cardId, numeral, title) {
  const b = boxOf(cardId);
  const fit = (box, text, spacing, cap) => {
    const em = emWidth(text, spacing, spacing > 0);
    return Math.min(cap, em ? (box.w * 100 * (1 - 2 * PAD) * .985) / em : cap);
  };
  return {
    num: fit(b.num, numeral || '', 0, capOf('num')),
    title: fit(b.title, String(title || ''), TITLE_SPACING, capOf('title')),
  };
}
function place(el, box) {
  Object.assign(el.style, { left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`, paddingInline: `${box.w * PAD * 100}%` });
}

// An <img> that turns into a placeholder if the file is missing; a missing card never breaks a draw.
// Cat cards are painted with empty boxes: the numeral and title are lettered on top (overlay).
function cardFace(cardId, numeral, title, dishes, overlay = true) {
  const src = artSrc(cardId, dishes);
  if (!src) return placeholder(numeral, title);
  const img = new Image(480, 720);
  img.alt = title;
  img.decoding = 'async';
  img.src = src;
  const isCat = src.startsWith('cards/cats/');
  if (!isCat || !overlay) {
    img.onerror = () => img.replaceWith(placeholder(numeral, title));
    return img;
  }
  const art = document.createElement('div');
  art.className = 'art';
  const num = Object.assign(document.createElement('span'), { className: 'ov num', textContent: numeral || '' });
  const t = Object.assign(document.createElement('span'), { className: 'ov title', textContent: title || '' });
  num.setAttribute('aria-hidden', 'true');
  t.setAttribute('aria-hidden', 'true');
  const b = boxOf(cardId);
  if (b.placed) { place(num, b.num); place(t, b.title); }
  const fit = () => { const f = fontSizes(cardId, numeral, title); num.style.fontSize = `${f.num}cqw`; t.style.fontSize = `${f.title}cqw`; };
  fit();
  fontsReady.then(() => { emCache.clear(); fit(); }); // measured again once the font is certainly there
  art.append(img, num, t);
  img.onerror = () => art.replaceWith(placeholder(numeral, title));
  return art;
}

/* ---------- screens ---------- */
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== id; });
  scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  const h = $(`#${id} h1, #${id} h2`);
  if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
}

/* ---------- form ---------- */
function buildForm() {
  const month = $('#f-month'), day = $('#f-day');
  MONTHS.forEach((m, i) => month.add(new Option(m, String(i + 1))));
  const fillDays = () => {
    const keep = day.value;
    const n = month.value ? new Date(2024, +month.value, 0).getDate() : 31; // 2024: leap year, so 29 Feb is allowed
    day.length = 1;
    for (let d = 1; d <= n; d++) day.add(new Option(String(d), String(d)));
    if (keep && +keep <= n) day.value = keep;
  };
  month.addEventListener('change', fillDays);
  fillDays();

  $('#dishes').append(...MENU.map((d) => {
    const box = document.createElement('div');
    box.className = 'dish';
    box.innerHTML = `<label><input type="checkbox" name="dish" value="${d.id}"><img src="cards/dish/${d.id}.webp" alt="" width="44" height="66" loading="lazy"><span><strong></strong><small></small></span></label>`;
    box.querySelector('strong').textContent = d.name;
    box.querySelector('small').textContent = d.desc;
    if (d.ways) {
      const ways = document.createElement('div');
      ways.className = 'ways';
      ways.setAttribute('role', 'radiogroup');
      ways.setAttribute('aria-label', `${d.name}: which way?`);
      d.ways.forEach((w, i) => {
        const l = document.createElement('label');
        l.className = 'chip';
        l.innerHTML = `<input type="radio" name="way-${d.id}" value="${w}"${i === 0 ? ' checked' : ''}><span></span>`;
        l.querySelector('span').textContent = w;
        ways.append(l);
      });
      box.append(ways);
    }
    return box;
  }));

  $('#rating').append(...RATINGS.map((r, i) => {
    const l = document.createElement('label');
    l.innerHTML = `<input type="radio" name="rating" value="${i + 1}"><span></span>`;
    l.querySelector('span').textContent = r;
    return l;
  }));
}

function readForm() {
  const f = $('#reading-form');
  const fd = new FormData(f);
  const dishes = fd.getAll('dish');
  const month = +fd.get('month') || 0, day = +fd.get('day') || 0;
  return {
    name: String(fd.get('name') || '').trim(),
    email: String(fd.get('email') || '').trim(),
    news: fd.get('news') === 'on',
    month, day,
    dishes,
    ways: dishes.filter((id) => fd.get(`way-${id}`)).map((id) => `${id}: ${fd.get(`way-${id}`)}`),
    rating: +fd.get('rating') || 0,
    note: String(fd.get('note') || '').trim(),
    website: String(fd.get('website') || ''),
  };
}

function validate(v) {
  const bad = {
    name: !v.name,
    email: v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email),
    rating: !v.rating,
  };
  for (const [k, isBad] of Object.entries(bad)) {
    const err = $(`.error[data-for="${k}"]`);
    if (err) err.hidden = !isBad;
    const ctl = k === 'rating' ? $('#rating') : $(`[name="${k}"]`);
    ctl?.setAttribute('aria-invalid', isBad ? 'true' : 'false');
  }
  const first = Object.keys(bad).find((k) => bad[k]);
  if (first) {
    const el = first === 'rating' ? $('#rating input') : $(`[name="${first}"]`);
    el?.focus();
    return false;
  }
  return true;
}

/* ---------- the reading ---------- */
let current = null; // { v, fortune }

const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const firstName = (n) => n.split(/\s+/)[0];
const birthdayStr = (v) => (v.month && v.day ? `${String(v.month).padStart(2, '0')}-${String(v.day).padStart(2, '0')}` : '');

function cast(v, seed) {
  return engine.drawFortune({ name: firstName(v.name), birthday: birthdayStr(v), rating: v.rating, dishes: v.dishes, seed });
}

const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : '');

// A dish card is printed with its menu numeral (I-VI); show that one, so the title block matches the art.
// On a dish card the dish name leads (the arcana is printed under it on the art).
function titleLine(fortune, dishes) {
  const dish = dishFor(fortune.cardId, dishes);
  return dish ? `${dish.numeral} · ${dish.name}` : [fortune.numeral, fortune.title].filter(Boolean).join(' · ');
}

// The engine returns the second card as { cardId, title, numeral, name }; the stub as an id string.
function secondCard(fortune) {
  const c = fortune.cat;
  if (!c) return null;
  if (typeof c === 'string') return { cardId: c, title: c.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()), numeral: '' };
  return c.cardId ? c : null;
}

function render(v, fortune) {
  $('#r-name').textContent = firstName(v.name);
  $('#r-title').textContent = titleLine(fortune, v.dishes);
  $('#r-modeled').textContent = fortune.modeledBy ? `Modeled by ${fortune.modeledBy}` : '';
  $('#r-tagline').textContent = fortune.tagline || '';
  $('#r-text').textContent = fortune.reading || '';
  $('#r-omen').textContent = cap(fortune.omen || '');
  $('#r-closing').textContent = fortune.closing || '';
  $('#card-front').replaceChildren(cardFace(fortune.cardId, fortune.numeral, fortune.title, v.dishes));

  const second = $('#r-second');
  second.replaceChildren();
  const c2 = secondCard(fortune);
  if (c2 && c2.cardId !== fortune.cardId) {
    const mini = document.createElement('div');
    mini.className = 'mini';
    mini.append(cardFace(c2.cardId, c2.numeral, c2.title, [], false));
    const p = document.createElement('p');
    p.textContent = secondCaption(c2);
    second.append(mini, p);
  }
}

// Two shapes only: a dish second card, or a cat second card named with who pulled it.
function secondCaption(c2) {
  const dish = dishFor(c2.cardId, []);
  if (dish) return `Your second card: ${dish.name}.`;
  return c2.name ? `${c2.name} pulled your second card: ${c2.title}.` : `Your second card: ${c2.title}.`;
}

async function shuffle() {
  show('draw');
  if (reduceMotion) return;
  const deck = $('#deck');
  const cards = Array.from({ length: 7 }, () => Object.assign(document.createElement('div'), { className: 'c' }));
  deck.replaceChildren(...cards);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(60);
  cards.forEach((c, i) => { c.style.transform = `rotate(${(i - 3) * 11}deg) translateY(-8px)`; c.style.transformOrigin = '50% 140%'; });
  await wait(800);
  cards.forEach((c, i) => { c.style.transform = `translateX(${(i % 2 ? 1 : -1) * 60}px) rotate(${(i % 2 ? 6 : -6)}deg)`; });
  await wait(600);
  cards.forEach((c) => { c.style.transform = 'none'; });
  await wait(600);
  cards[6].style.transform = 'translateY(-40px) scale(1.06)';
  cards.slice(0, 6).forEach((c) => { c.style.opacity = '0'; });
  await wait(700);
}

let busy = false;
function setBusy(on) {
  busy = on;
  document.querySelectorAll('#reading-form [type="submit"], #again').forEach((b) => { b.disabled = on; });
}

async function reveal(v, seed, source) {
  if (busy) return; // one draw at a time: a double tap must not make two readings and two rows
  setBusy(true);
  $('#draw-error').hidden = true;
  try {
    await withTimeout(Promise.all([artReady, boxesReady, fontsReady]), 1500); // art, boxes and the card font are optional: placeholders and CSS defaults cover a slow load
    await ensureBank();
    const fortune = cast(v, seed);
    current = { v, fortune };
    readyFile = null;
    await submit(v, fortune, source); // on the phone before any animation: closing the page now loses nothing
    await shuffle();
    render(v, fortune);
    $('#flip').classList.remove('open');
    show('result');
    requestAnimationFrame(() => setTimeout(() => $('#flip').classList.add('open'), reduceMotion ? 0 : 250));
    prepareImage();
  } catch {
    show('form');
    $('#draw-error').hidden = false;
  } finally {
    setBusy(false);
  }
}

/* ---------- submissions: queue first, send when possible; never lose a row ---------- */
function device() {
  const ua = navigator.userAgent;
  const kind = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : 'desktop';
  return `${kind} ${innerWidth}x${innerHeight}`;
}

function row(v, fortune, source) {
  return {
    submitted_at: new Date().toISOString(),
    name: v.name,
    email: v.email,
    news_opt_in: v.news ? 'yes' : 'no',
    birthday: birthdayStr(v),
    sign: signFor(v.month, v.day),
    rating: v.rating ? `${v.rating} ${RATINGS[v.rating - 1]}` : '',
    dishes: v.dishes.join(', '),
    dish_ways: v.ways.join('; '),
    note: v.note,
    card_id: fortune.cardId,
    card_title: fortune.title,
    fortune_seed: String(fortune.seed),
    device: device(),
    source,
    website: v.website,
  };
}

// Queue in localStorage (memory if storage is refused), under a cross-tab lock where the browser has Web Locks.
const mem = [];
const keyOf = (r) => `${r.email}|${r.fortune_seed}|${r.submitted_at}`;
const withLock = (fn) => (navigator.locks?.request ? navigator.locks.request('fff-queue', fn) : fn());

function submit(v, fortune, source) {
  const r = row(v, fortune, source);
  return Promise.resolve(withLock(() => {
    const q = store.get(QUEUE_KEY, []);
    q.push(r);
    if (!store.set(QUEUE_KEY, q)) mem.push(r);
  })).then(() => { flush(); });
}

// Test seam: the Playwright gate points the page at a fake endpoint without touching config.js.
const endpoint = () => globalThis.__FFF_ENDPOINT || SHEET_ENDPOINT;

function updateNote() {
  const pending = store.get(QUEUE_KEY, []).length + mem.length;
  $('#queue-note').hidden = !(pending && (!navigator.onLine || retryTimer));
}

// Send queued rows one at a time; a row leaves the queue only when the Sheet answers ok (or says it already has it).
// text/plain is a "simple" request (no preflight); Apps Script's reply carries Access-Control-Allow-Origin, so it is readable.
let flushing = false, retryTimer = null, backoff = 2000;
async function flush() {
  const url = endpoint();
  if (flushing || !url || !navigator.onLine) { updateNote(); return; }
  flushing = true;
  clearTimeout(retryTimer); retryTimer = null;
  try {
    await withLock(async () => {
      while (true) {
        const stored = store.get(QUEUE_KEY, []);
        const next = stored[0] || mem[0];
        if (!next) break;
        const res = await fetch(url, { method: 'POST', body: JSON.stringify(next) });
        const data = await res.json();
        if (!data.ok && data.retry !== false) throw new Error(data.error || 'not ok'); // retry:false = a row the Sheet will never take
        if (stored[0]) {
          // cannot delete it: stop rather than resend the same row in a loop
          if (!store.set(QUEUE_KEY, store.get(QUEUE_KEY, []).filter((r) => keyOf(r) !== keyOf(next)))) break;
        } else mem.shift();
      }
    });
    backoff = 2000;
  } catch {
    retryTimer = setTimeout(flush, backoff); // weak signal: try again, 2 s doubling to a minute
    backoff = Math.min(backoff * 2, 60_000);
  } finally {
    flushing = false;
    updateNote();
  }
}
addEventListener('online', flush);
addEventListener('pageshow', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') flush(); });

/* ---------- save the card as a phone-story image ---------- */
function loadImg(src) {
  return new Promise((res) => {
    if (!src) return res(null);
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = src;
  });
}

// Break text into lines no wider than maxW at the context's current font. Never drops a word.
function breakLines(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const w of String(text).split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// Where the words go on the 1080x1920 frame, below the title block, at body size px. The logo's top is H-250; the text must clear it.
// Canvas text picks its optical size from the pixel size, so the fit is solved at the size it will be drawn: a few passes converge.
function fitCanvasPx(x, text, boxW, capPx, spacing) {
  const avail = boxW * (1 - 2 * PAD) * .985;
  let px = capPx;
  for (let i = 0; i < 6; i++) {
    x.font = `600 ${px}px Fraunces, serif`;
    const w = x.measureText(text).width + text.length * spacing * px;
    px = Math.min(capPx, px * avail / w);
  }
  return px;
}

const SHARE_TOP = 1268, SHARE_LIMIT = 1650, W_TEXT = 1080 - 180;
function planShare(x, f, px) {
  const items = [];
  let y = SHARE_TOP, bottom = 0, readingLines = 0;
  const add = (kind, font, color, text, size, lh) => {
    x.font = font;
    for (const t of breakLines(x, text, W_TEXT)) {
      items.push({ font, color, text: t, y });
      bottom = Math.max(bottom, y + size * .28); // descent below the baseline
      y += lh;
      if (kind === 'reading') readingLines++;
    }
  };
  const tag = Math.round(px * 1.15);
  add('tagline', `italic 400 ${tag}px Fraunces, Georgia, serif`, '#d4b469', f.tagline || '', tag, tag * 1.25);
  y += 8;
  add('reading', `400 ${px}px "Instrument Sans", sans-serif`, '#faf6f0', f.reading || '', px, px * 1.36);
  y += 14;
  add('omen', `italic 400 ${px}px Fraunces, serif`, '#8fa57f', `Pantry omen: ${cap(f.omen || '')}`, px, px * 1.3);
  return { items, bottom, readingLines };
}

// 40px; a reading that wraps past 4 lines steps down 10% (36px) and wraps again; then smaller only if the logo would be touched. Nothing is cut.
function layoutShare(x, f) {
  let px = 40, plan = planShare(x, f, px);
  if (plan.readingLines > 4) { px = 36; plan = planShare(x, f, px); }
  while (plan.bottom > SHARE_LIMIT && px > 24) { px -= 2; plan = planShare(x, f, px); }
  return { ...plan, px };
}

async function cardImage(cur = current) {
  const { v, fortune } = cur;
  await fontsReady;
  const W = 1080, H = 1920, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3a2a40'); g.addColorStop(.55, '#1d1824'); g.addColorStop(1, '#14101a');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const glow = x.createRadialGradient(W / 2, 520, 40, W / 2, 520, 700);
  glow.addColorStop(0, 'rgba(244,196,120,.28)'); glow.addColorStop(1, 'rgba(244,196,120,0)');
  x.fillStyle = glow; x.fillRect(0, 0, W, H);

  x.textAlign = 'center';
  x.fillStyle = '#d4b469';
  x.font = 'italic 400 54px Fraunces, Georgia, serif';
  x.fillText(`A reading for ${firstName(v.name)}`, W / 2, 150);

  const cw = 560, ch = 840, cx = (W - cw) / 2, cy = 210;
  const art = await loadImg(artSrc(fortune.cardId, v.dishes));
  x.save();
  x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 50; x.shadowOffsetY = 20;
  if (art) {
    x.drawImage(art, cx, cy, cw, ch);
    if (!dishFor(fortune.cardId, v.dishes)) {
      x.shadowColor = 'transparent';
      x.fillStyle = '#33302e';
      x.textBaseline = 'middle';
      const b = boxOf(fortune.cardId);
      // no maxWidth: it would squeeze the glyphs; the size is fitted to the box (minus padding) and capped like the page
      const nPx = fitCanvasPx(x, fortune.numeral || '', b.num.w * cw, capOf('num') * cw / 100, 0);
      x.font = `600 ${nPx}px Fraunces, serif`;
      x.fillText(fortune.numeral || '', cx + (b.num.x + b.num.w / 2) * cw, cy + (b.num.y + b.num.h / 2) * ch);
      const title = (fortune.title || '').toUpperCase();
      const tPx = fitCanvasPx(x, title, b.title.w * cw, capOf('title') * cw / 100, TITLE_SPACING);
      x.font = `600 ${tPx}px Fraunces, serif`;
      if ('letterSpacing' in x) x.letterSpacing = `${TITLE_SPACING * tPx}px`;
      x.fillText(title, cx + (b.title.x + b.title.w / 2) * cw, cy + (b.title.y + b.title.h / 2) * ch);
      if ('letterSpacing' in x) x.letterSpacing = '0px';
      x.textBaseline = 'alphabetic';
    }
  }
  else {
    x.fillStyle = '#f6efe3'; x.fillRect(cx, cy, cw, ch);
    x.shadowColor = 'transparent';
    x.strokeStyle = '#b8933f'; x.lineWidth = 6; x.strokeRect(cx + 18, cy + 18, cw - 36, ch - 36);
    x.fillStyle = '#b8933f'; x.font = '600 48px Fraunces, serif'; x.fillText(fortune.numeral || '', W / 2, cy + 110);
    x.fillStyle = '#c86a53'; x.font = 'italic 400 200px Fraunces, serif'; x.fillText('ff', W / 2, cy + 500);
  }
  x.restore();

  // the hot-pink title block
  x.font = '600 58px Fraunces, serif';
  const title = titleLine(fortune, v.dishes);
  const tw = Math.min(W - 120, x.measureText(title).width + 60);
  x.save(); x.translate(W / 2, 1130); x.rotate(-0.018);
  x.fillStyle = '#e0457b'; x.fillRect(-tw / 2, -62, tw, 92);
  x.fillStyle = '#fff8fb'; x.fillText(title, 0, 4, W - 160);
  x.restore();

  if (fortune.modeledBy) {
    x.fillStyle = '#d9d0c4'; x.font = 'italic 400 30px Fraunces, serif';
    x.fillText(`Modeled by ${fortune.modeledBy}`, W / 2, 1208);
  }

  const plan = layoutShare(x, fortune);
  for (const it of plan.items) { x.font = it.font; x.fillStyle = it.color; x.fillText(it.text, W / 2, it.y); }
  window.__fff.lastImageLayout = { bottom: plan.bottom, readingLines: plan.readingLines, readingPx: plan.px };

  const logo = await loadImg('img/logo-ff-white.png');
  if (logo) x.drawImage(logo, W / 2 - 50, H - 250, 100, 119);
  x.fillStyle = '#d4b469'; x.font = '600 38px "Instrument Sans", sans-serif';
  x.fillText(HANDLE, W / 2, H - 80);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

// Safari opens the share sheet only from a fresh tap, so the image is made as soon as the card is shown, not on the tap.
let readyFile = null;
function prepareImage() {
  const f = current;
  cardImage().then((blob) => {
    if (current === f && blob) readyFile = new File([blob], `freckled-fork-fortune-${f.fortune.seed}.png`, { type: 'image/png' });
  }).catch(() => {});
}

function download(file) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function save() {
  let file = readyFile;
  if (file && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'My Freckled Fork fortune' }); return; }
    catch (e) { if (e?.name === 'AbortError') return; }
  }
  const btn = $('#save');
  btn.disabled = true;
  try {
    if (!file) {
      const blob = await cardImage();
      file = new File([blob], `freckled-fork-fortune-${current.fortune.seed}.png`, { type: 'image/png' });
      readyFile = file;
    }
    download(file);
  } finally {
    btn.disabled = false;
  }
}

/* ---------- tilt parallax (pointer and phone tilt), off under reduced motion ---------- */
let orient = null;
function askTilt() {
  if (!orient || typeof DeviceOrientationEvent === 'undefined' || typeof DeviceOrientationEvent.requestPermission !== 'function') return;
  DeviceOrientationEvent.requestPermission()
    .then((r) => { if (r === 'granted') addEventListener('deviceorientation', orient, { passive: true }); })
    .catch(() => {});
}

function tilt() {
  if (reduceMotion) return;
  const set = (rx, ry) => document.querySelectorAll('.tilt').forEach((el) => {
    el.style.setProperty('--rx', `${rx.toFixed(2)}deg`); el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    set(((e.clientY / innerHeight) - .5) * -10, ((e.clientX / innerWidth) - .5) * 12);
  }, { passive: true });
  orient = (e) => {
    if (e.beta == null) return;
    set(Math.max(-8, Math.min(8, (e.beta - 45) / 4)), Math.max(-10, Math.min(10, e.gamma / 3)));
  };
  // iOS asks once, from a tap (askTilt); elsewhere the events just arrive.
  if (typeof DeviceOrientationEvent === 'undefined' || typeof DeviceOrientationEvent.requestPermission !== 'function') {
    addEventListener('deviceorientation', orient, { passive: true });
  }
}

/* ---------- wire up ---------- */
function init() {
  buildForm();
  Object.entries(LINKS).forEach(([k, href]) => { const a = $(`#l-${k}`) || (k === 'home' && $('#home')); if (a) a.href = href; });
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { askTilt(); show(b.dataset.go); }));
  $('#reading-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = readForm();
    if (!validate(v)) return;
    reveal(v, newSeed(), SOURCE);
  });
  $('#again').addEventListener('click', () => current && reveal(current.v, newSeed(), 'pull-again'));
  $('#save').addEventListener('click', save);
  tilt();
  flush();
  if ('serviceWorker' in navigator) {
    watchForNewWorker();
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// A phone that already runs this page picks up a new release on its next quiet moment: one reload, and only from the landing
// screen or an untouched form, so a typed name or a draw in flight is never lost. Otherwise the next visit is the new one.
function watchForNewWorker() {
  if (!navigator.serviceWorker.controller) return; // first install: nothing old to replace
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || busy) return;
    const quiet = !$('#landing').hidden || (!$('#form').hidden && !$('#f-name').value);
    if (!quiet) return;
    reloaded = true;
    location.reload();
  });
}

init();

// test hook: lets the Playwright gate drive the page without timing guesses
window.__fff = {
  get current() { return current; }, queue: () => store.get(QUEUE_KEY, []), flush, cardImage, cardFace, engine,
  ready: () => Promise.all([artReady, boxesReady, fontsReady, ensureBank()]), lastImageLayout: null,
};
