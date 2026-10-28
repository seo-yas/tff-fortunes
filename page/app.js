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
// The real engine loads its line bank (lines.json) once; the stub has none to load.
const bankReady = (engine.loadBank ? engine.loadBank() : Promise.resolve()).catch(() => {});
const artReady = fetch('cards/cats/index.json').then((r) => (r.ok ? r.json() : [])).then((ids) => { catArt = new Set(ids); }).catch(() => {});

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
  return catArt.has(cardId) ? `cards/cats/${cardId}.webp` : null;
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

// An <img> that turns into a placeholder if the file is missing; a missing card never breaks a draw.
function cardFace(cardId, numeral, title, dishes) {
  const src = artSrc(cardId, dishes);
  if (!src) return placeholder(numeral, title);
  const img = new Image(560, 840);
  img.alt = title;
  img.decoding = 'async';
  img.src = src;
  img.onerror = () => img.replaceWith(placeholder(numeral, title));
  return img;
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

function lineList(fortune) {
  const L = fortune.lines || {};
  const speaker = secondCard(fortune)?.name;
  const dish = L.dish && speaker ? `${speaker} says: ${L.dish}` : L.dish;
  return [L.opening, dish, L.sign, L.rating, L.closing].filter(Boolean);
}

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
  $('#r-lines').replaceChildren(...lineList(fortune).map((t) => Object.assign(document.createElement('p'), { textContent: t })));
  $('#r-omen').textContent = cap(fortune.lines?.omen || '');
  $('#card-front').replaceChildren(cardFace(fortune.cardId, fortune.numeral, fortune.title, v.dishes));

  const second = $('#r-second');
  second.replaceChildren();
  const c2 = secondCard(fortune);
  if (c2 && c2.cardId !== fortune.cardId) {
    const mini = document.createElement('div');
    mini.className = 'mini';
    mini.append(cardFace(c2.cardId, c2.numeral, c2.title, []));
    const p = document.createElement('p');
    p.textContent = c2.name ? `${c2.name} pulled your second card: ${c2.title}.` : `Your second card: ${c2.title}.`;
    second.append(mini, p);
  }
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

async function reveal(v, seed, source) {
  await Promise.all([artReady, bankReady]);
  const fortune = cast(v, seed);
  current = { v, fortune };
  await shuffle();
  render(v, fortune);
  $('#flip').classList.remove('open');
  show('result');
  requestAnimationFrame(() => setTimeout(() => $('#flip').classList.add('open'), reduceMotion ? 0 : 250));
  submit(v, fortune, source);
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

function submit(v, fortune, source) {
  const q = store.get(QUEUE_KEY, []);
  q.push(row(v, fortune, source));
  store.set(QUEUE_KEY, q);
  flush();
}

// Test seam: the Playwright gate points the page at a fake endpoint without touching config.js.
const endpoint = () => globalThis.__FFF_ENDPOINT || SHEET_ENDPOINT;

let flushing = false;
async function flush() {
  if (flushing) return;
  const q = store.get(QUEUE_KEY, []);
  const url = endpoint();
  $('#queue-note').hidden = !(q.length && !navigator.onLine);
  if (!q.length || !url || !navigator.onLine) return;
  flushing = true;
  try {
    while (true) {
      const [next] = store.get(QUEUE_KEY, []);
      if (!next) break;
      // text/plain + no-cors: a "simple" request, so no preflight; Apps Script dedupes retries.
      await fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify(next), keepalive: true });
      const rest = store.get(QUEUE_KEY, []);
      store.set(QUEUE_KEY, rest.filter((r) => !(r.fortune_seed === next.fortune_seed && r.email === next.email && r.submitted_at === next.submitted_at)));
    }
  } catch {
    // offline or blocked: the rows stay queued; the next online event or page load sends them
  } finally {
    flushing = false;
    $('#queue-note').hidden = !(store.get(QUEUE_KEY, []).length && !navigator.onLine);
  }
}
addEventListener('online', flush);

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

function wrap(ctx, text, x, y, maxW, lh, maxLines = 99) {
  const words = String(text).split(/\s+/);
  let line = '', lines = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y); y += lh; line = w;
      if (++lines >= maxLines) return y;
    } else line = test;
  }
  if (line) { ctx.fillText(line, x, y); y += lh; }
  return y;
}

async function cardImage() {
  const { v, fortune } = current;
  await document.fonts.ready;
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
  if (art) x.drawImage(art, cx, cy, cw, ch);
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

  x.fillStyle = '#faf6f0';
  x.font = '400 40px "Instrument Sans", sans-serif';
  let y = wrap(x, fortune.lines?.opening || '', W / 2, 1250, W - 180, 54, 3);
  y = wrap(x, fortune.lines?.dish || '', W / 2, y + 10, W - 180, 54, 3);
  x.fillStyle = '#8fa57f'; x.font = 'italic 400 40px Fraunces, serif';
  y = wrap(x, `Pantry omen: ${cap(fortune.lines?.omen || '')}`, W / 2, y + 30, W - 200, 52, 3);

  const logo = await loadImg('img/logo-ff-white.png');
  if (logo) x.drawImage(logo, W / 2 - 50, H - 250, 100, 119);
  x.fillStyle = '#d4b469'; x.font = '600 38px "Instrument Sans", sans-serif';
  x.fillText(HANDLE, W / 2, H - 80);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

async function save() {
  const btn = $('#save');
  btn.disabled = true;
  try {
    const blob = await cardImage();
    const file = new File([blob], `freckled-fork-fortune-${current.fortune.seed}.png`, { type: 'image/png' });
    // On phones the share sheet is the only reliable way into Photos; elsewhere, a download.
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'My Freckled Fork fortune' }); return; }
      catch (e) { if (e?.name === 'AbortError') return; }
    }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: file.name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } finally {
    btn.disabled = false;
  }
}

/* ---------- tilt parallax (pointer and phone tilt), off under reduced motion ---------- */
function tilt() {
  if (reduceMotion) return;
  const set = (rx, ry) => document.querySelectorAll('.tilt').forEach((el) => {
    el.style.setProperty('--rx', `${rx.toFixed(2)}deg`); el.style.setProperty('--ry', `${ry.toFixed(2)}deg`);
  });
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    set(((e.clientY / innerHeight) - .5) * -10, ((e.clientX / innerWidth) - .5) * 12);
  }, { passive: true });
  addEventListener('deviceorientation', (e) => {
    if (e.beta == null) return;
    set(Math.max(-8, Math.min(8, (e.beta - 45) / 4)), Math.max(-10, Math.min(10, e.gamma / 3)));
  }, { passive: true });
}

/* ---------- wire up ---------- */
function init() {
  buildForm();
  Object.entries(LINKS).forEach(([k, href]) => { const a = $(`#l-${k}`) || (k === 'home' && $('#home')); if (a) a.href = href; });
  document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
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
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

init();

// test hook: lets the Playwright gate drive the page without timing guesses
window.__fff = { get current() { return current; }, queue: () => store.get(QUEUE_KEY, []), flush, cardImage };
