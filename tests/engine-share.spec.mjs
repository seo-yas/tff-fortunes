// The browser runs the same engine as Node, and the share image keeps every word clear of the logo.
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync('tests/fixtures/draws-r2.json', 'utf8'));
const READINGS = JSON.parse(readFileSync('engine/readings.json', 'utf8'));
const longestOmen = READINGS.omens.reduce((a, b) => (b.length > a.length ? b : a));

test('browser engine reproduces tests/fixtures/draws-r2.json byte for byte', async ({ page }) => {
  await page.goto('/');
  const got = await page.evaluate(async (draws) => {
    const m = await import('./engine/fortune.mjs');
    await m.loadBank();
    return draws.map((d) => JSON.stringify(m.drawFortune(d.input)));
  }, fixture.draws);
  expect(got.length).toBe(fixture.draws.length);
  expect(got.length).toBeGreaterThan(50);
  const want = fixture.draws.map((d) => JSON.stringify(d.out));
  expect(got.filter((g, i) => g !== want[i]).length).toBe(0);
});

test('share image: every card with the longest omen keeps its lowest text above the logo (1650)', async ({ page }) => {
  await page.goto('/');
  const res = await page.evaluate(async (omen) => {
    await window.__fff.ready();
    const m = window.__fff.engine;
    const v = { name: 'Marguerite', dishes: [], rating: 5, month: 10, day: 31 };
    const out = [];
    for (const c of m.CAT_CARDS) {
      const base = m.drawFortune({ name: 'Marguerite', seed: 7 });
      await window.__fff.cardImage({ v, fortune: { ...base, cardId: c.id, title: c.title, numeral: c.numeral, omen } });
      out.push({ id: c.id, ...window.__fff.lastImageLayout });
    }
    return out;
  }, longestOmen);
  expect(res).toHaveLength(24);
  console.log('card / lowest text px / reading lines / reading px\n' + res.map((r) => `${r.id.padEnd(18)} ${r.bottom.toFixed(0)} ${r.readingLines} ${r.readingPx}`).join('\n'));
  for (const r of res) expect(r.bottom, r.id).toBeLessThanOrEqual(1650);
});

test('share image of the longest reading, saved for the eye', async ({ page }) => {
  await page.goto('/');
  const [id, card] = Object.entries(READINGS.cards).sort((a, b) => b[1].text.length - a[1].text.length)[0];
  const { data, layout } = await page.evaluate(async ({ id, longest, card }) => {
    await window.__fff.ready();
    const m = window.__fff.engine;
    const c = m.CAT_CARDS.find((x) => x.id === id);
    const base = m.drawFortune({ name: 'Marguerite', seed: 7 });
    const fortune = { ...base, cardId: id, title: c.title, numeral: c.numeral, omen: longest, tagline: card.tagline, reading: card.text, modeledBy: 'Sgt. Peppers & Sgt. Sushi' };
    const b = await window.__fff.cardImage({ v: { name: 'Marguerite', dishes: [] }, fortune });
    const r = new FileReader();
    const data = await new Promise((res) => { r.onload = () => res(r.result); r.readAsDataURL(b); });
    return { data, layout: window.__fff.lastImageLayout };
  }, { id, longest: longestOmen, card });
  writeFileSync('test-results/saved-card-longest.png', Buffer.from(data.split(',')[1], 'base64'));
  console.log(id, JSON.stringify(layout));
  expect(layout.bottom).toBeLessThanOrEqual(1650);
});
