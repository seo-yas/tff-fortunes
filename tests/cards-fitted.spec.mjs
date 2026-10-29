// Round 2, Leg 2: the numeral and title of every cat card sit inside that card's painted boxes, at every phone width.
// The proof reads the TEXT extents (a Range over the text node), not the positioned span, which would only echo its own style.
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const boxes = JSON.parse(readFileSync('page/cards/cats/boxes.json', 'utf8'));
const PAD = 0.06;
const EPS = 0.6; // px of sub-pixel slack in layout and rounding
const WIDTHS = [390, 430, 375, 320];
const DISH_IDS = ['brodo', 'beetlejuice', 'ichabod', 'hex', 'aloo', 'ghosted'];

// Render all 24 cat faces at the result card's real width (min(70vw, 300px)) and measure each one.
async function renderAll(page, cardW) {
  return page.evaluate(async ({ cardW }) => {
    await window.__fff.ready();
    const fontOk = document.fonts.check('600 20px Fraunces');
    const host = document.createElement('div');
    host.id = 'fit-host';
    host.style.cssText = 'position:absolute;left:0;top:0;display:flex;flex-wrap:wrap;gap:12px;padding:8px;background:#faf6f0;z-index:99';
    document.body.append(host);
    const out = [];
    for (const c of window.__fff.engine.CAT_CARDS) {
      const wrap = document.createElement('div');
      wrap.style.cssText = `width:${cardW}px;aspect-ratio:2/3;flex:none`;
      wrap.dataset.id = c.id;
      wrap.append(window.__fff.cardFace(c.id, c.numeral, c.title, [], true));
      host.append(wrap);
    }
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (const wrap of host.children) {
      const art = wrap.querySelector('.art');
      const a = art.getBoundingClientRect();
      const text = (el) => { const r = document.createRange(); r.selectNodeContents(el); const b = r.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom }; };
      const el = (k) => art.querySelector(`.ov.${k}`);
      out.push({
        id: wrap.dataset.id, art: { l: a.left, t: a.top, w: a.width, h: a.height },
        num: { text: text(el('num')), client: el('num').clientWidth, scroll: el('num').scrollWidth, fs: parseFloat(getComputedStyle(el('num')).fontSize) },
        title: { text: text(el('title')), client: el('title').clientWidth, scroll: el('title').scrollWidth, fs: parseFloat(getComputedStyle(el('title')).fontSize) },
      });
    }
    return { fontOk, out };
  }, { cardW });
}

for (const width of WIDTHS) {
  test(`all 24 cat faces: text inside the painted boxes at ${width} wide`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const cardW = Math.min(0.7 * width, 300);
    const { fontOk, out } = await renderAll(page, cardW);
    expect(fontOk, 'Fraunces is loaded before measuring').toBe(true);
    expect(out).toHaveLength(24);
    for (const c of out) {
      for (const kind of ['num', 'title']) {
        const b = boxes[c.id][kind], t = c[kind].text;
        const boxL = c.art.l + b.x * c.art.w, boxW = b.w * c.art.w;
        const boxT = c.art.t + b.y * c.art.h, boxH = b.h * c.art.h;
        const msg = `${c.id} ${kind}`;
        expect(t.l, `${msg} left`).toBeGreaterThanOrEqual(boxL + PAD * boxW - EPS);
        expect(t.r, `${msg} right`).toBeLessThanOrEqual(boxL + boxW - PAD * boxW + EPS);
        expect(t.t, `${msg} top`).toBeGreaterThanOrEqual(boxT - EPS);
        expect(t.b, `${msg} bottom`).toBeLessThanOrEqual(boxT + boxH + EPS);
        expect(c[kind].scroll, `${msg} overflow`).toBeLessThanOrEqual(c[kind].client);
      }
    }
    if (width === 390) {
      // the font-size table for the report: uniform cap, so DEATH is not bigger than THE HIGH PRIESTESS
      const rows = out.map((c) => ({ id: c.id, titlePx: +c.title.fs.toFixed(2), numPx: +c.num.fs.toFixed(2) }));
      mkdirSync('test-results', { recursive: true });
      writeFileSync('test-results/title-font-sizes-390.json', JSON.stringify(rows, null, 1));
      console.log('title font px at 390 wide (card width ' + cardW + 'px)\n' + rows.map((r) => `${r.id.padEnd(18)} title ${r.titlePx}  numeral ${r.numPx}`).join('\n'));
      const max = Math.max(...rows.map((r) => r.titlePx));
      expect(rows.filter((r) => Math.abs(r.titlePx - max) < 0.02).length, 'several titles sit at the shared cap').toBeGreaterThan(3);
      expect(rows.every((r) => r.titlePx <= max + 0.02)).toBe(true);
    }
  });
}

test('the 24-card grid, for the eye (screenshot)', async ({ page }) => {
  await page.setViewportSize({ width: 1060, height: 900 });
  await page.goto('/');
  await renderAll(page, 240);
  await page.waitForFunction(() => [...document.querySelectorAll('#fit-host img')].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15_000 });
  await page.evaluate(async () => { await Promise.all([...document.querySelectorAll('#fit-host img')].map((i) => i.decode().catch(() => {}))); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
  await page.waitForTimeout(500);
  await page.locator('#fit-host').screenshot({ path: 'test-results/cards-fitted.png' });
});

test('smoke: the six dish faces carry no lettering overlay', async ({ page }) => {
  await page.goto('/');
  const res = await page.evaluate(async (ids) => {
    await window.__fff.ready();
    return ids.map((id) => {
      const face = window.__fff.cardFace(`dish-${id}`, 'I', id, [id], true);
      return { id, tag: face.tagName, ov: face.querySelectorAll?.('.ov').length ?? 0, src: face.getAttribute?.('src') };
    });
  }, DISH_IDS);
  for (const r of res) { expect(r.ov, r.id).toBe(0); expect(r.src, r.id).toBe(`cards/dish/${r.id}.webp`); }
});
