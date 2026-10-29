import { test, expect } from '@playwright/test';
import { writeFileSync, readFileSync } from 'node:fs';

const READINGS = JSON.parse(readFileSync('engine/readings.json', 'utf8'));

const ENDPOINT = 'https://script.google.com/macros/s/TEST/exec';
const COLUMNS = ['submitted_at', 'name', 'email', 'news_opt_in', 'birthday', 'sign', 'rating', 'dishes',
  'dish_ways', 'note', 'card_id', 'card_title', 'fortune_seed', 'device', 'source'];

// No test may reach the real Sheet: every Apps Script request is answered here unless a test mocks it itself
// (a test's own page.route is registered later, so it takes precedence).
test.beforeEach(async ({ page }) => {
  await page.route(/script\.google(usercontent)?\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}' }));
});

// Point the page at a fake Apps Script endpoint and record what it receives.
async function mockSheet(page) {
  const posts = [];
  await page.addInitScript((u) => { globalThis.__FFF_ENDPOINT = u; }, ENDPOINT);
  await page.route(ENDPOINT, async (route) => {
    posts.push(JSON.parse(route.request().postData()));
    // Apps Script's reply (after its redirect) carries Access-Control-Allow-Origin: *, so the page can read it
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}' });
  });
  return posts;
}

async function fillAndRead(page, { dishes = ['hex'], rating = 'Marry it' } = {}) {
  await page.getByRole('button', { name: 'Pull a card' }).click();
  await page.getByLabel('Your name').fill('Marguerite Okafor');
  await page.getByLabel('Email').fill('marguerite@example.com');
  await page.getByLabel('Month').selectOption({ label: 'October' });
  await page.getByLabel('Day').selectOption('31');
  for (const d of dishes) await page.locator(`input[name="dish"][value="${d}"]`).check({ force: true });
  await page.locator('#rating label', { hasText: rating }).click();
  await page.getByRole('button', { name: 'Read my cards' }).click();
  await expect(page.locator('#result')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#flip')).toHaveClass(/open/);
}

test('full flow at 390x844: form, draw, reading, row sent to the Sheet', async ({ page }) => {
  const posts = await mockSheet(page);
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Fortunes');
  await fillAndRead(page);
  await expect(page.locator('#r-name')).toHaveText('Marguerite');
  await expect(page.locator('#r-title')).not.toBeEmpty();
  await expect(page.locator('#r-modeled')).toHaveText(/^Modeled by Sgt\. (Peppers|Sushi|Peppers & Sgt\. Sushi)$/);
  await expect(page.locator('#r-tagline')).not.toBeEmpty();
  await expect(page.locator('#r-text')).not.toBeEmpty();
  await expect(page.locator('#r-closing')).not.toBeEmpty();
  await expect(page.locator('#r-omen')).not.toBeEmpty();
  // the reading is Jess's fixed text for the drawn card, verbatim
  const drawn = await page.evaluate(() => window.__fff.current.fortune.cardId);
  await expect(page.locator('#r-text')).toHaveText(READINGS.cards[drawn].text);
  await expect(page.locator('#r-tagline')).toHaveText(READINGS.cards[drawn].tagline);
  // Yas, 2026-10-28: the fortune is a cat card even when a dish is ticked; the dish is the second card
  await expect(page.locator('#card-front .art img')).toHaveAttribute('src', /^cards\/cats\/[a-z-]+\.avif$/);
  await expect(page.locator('#r-second .mini img')).toHaveAttribute('src', 'cards/dish/hex.webp');
  await expect(page.locator('#r-second p')).toHaveText('Your second card: Hex & the City.');
  await expect.poll(() => posts.length).toBe(1);
  const row = posts[0];
  for (const c of COLUMNS) { expect(row, c).toHaveProperty(c); expect(row[c], c).not.toBeUndefined(); }
  for (const c of ['card_id', 'card_title', 'fortune_seed']) expect(String(row[c]).length, c).toBeGreaterThan(0);
  expect(row.sign).toBe('Scorpio');
  expect(row.birthday).toBe('10-31');
  expect(row.dish_ways).toBe('hex: Beef');
  expect(row.card_id).not.toMatch(/^dish-/); // the Sheet's card_id is the cat card
  expect(row.rating).toBe('5 Marry it');
  expect(await page.evaluate(() => window.__fff.queue().length)).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole('link', { name: 'Back to thefreckledfork.com' })).toHaveAttribute('href', 'https://thefreckledfork.com/');
  for (const n of ['Instagram', 'Substack', 'Facebook']) await expect(page.getByRole('link', { name: n })).toHaveAttribute('href', /^https:\/\//);
});

test('pull again: a new seed, same guest, logged as pull-again', async ({ page }) => {
  const posts = await mockSheet(page);
  await page.goto('/');
  await fillAndRead(page, { dishes: ['brodo', 'aloo'] });
  const first = await page.evaluate(() => window.__fff.current.fortune.seed);
  await page.getByRole('button', { name: 'Pull again' }).click();
  await expect(page.locator('#flip')).toHaveClass(/open/, { timeout: 15_000 });
  const second = await page.evaluate(() => window.__fff.current.fortune.seed);
  expect(second).not.toBe(first);
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[1].source).toBe('pull-again');
  expect(posts[1].email).toBe('marguerite@example.com');
});

test('a row leaves the phone only when the Sheet says ok: a failed write is kept and retried', async ({ page }) => {
  await page.addInitScript((u) => { globalThis.__FFF_ENDPOINT = u; }, ENDPOINT);
  let calls = 0;
  await page.route(ENDPOINT, async (route) => {
    calls++;
    const ok = calls > 1; // the first write fails (a lock timeout, say), the retry lands
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(ok ? { ok: true } : { ok: false, error: 'lock timeout' }) });
  });
  await page.goto('/');
  await fillAndRead(page);
  await expect.poll(() => calls, { timeout: 10_000 }).toBeGreaterThan(1);
  await expect.poll(() => page.evaluate(() => window.__fff.queue().length)).toBe(0);
});

test('a double tap makes one reading and one row, stored before the shuffle', async ({ page }) => {
  const posts = await mockSheet(page);
  const rows = () => page.evaluate(() => window.__fff.queue().length).then((q) => q + posts.length); // queued or sent
  await page.goto('/');
  await page.getByRole('button', { name: 'Pull a card' }).click();
  await page.getByLabel('Your name').fill('Ines');
  await page.locator('#rating label', { hasText: 'Good' }).first().click();
  const btn = page.getByRole('button', { name: 'Read my cards' });
  await btn.evaluate((b) => { b.click(); b.click(); });
  await expect(page.locator('#draw')).toBeVisible();
  // stored (or already sent) while the deck is still shuffling; mid-send a row can be both sent and not yet dequeued
  expect(await rows()).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#flip')).toHaveClass(/open/, { timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => window.__fff.queue().length)).toBe(0);
  expect(posts.length).toBe(1); // exactly one row reached the Sheet
});

test('validation: no name, no rating', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pull a card' }).click();
  await page.getByRole('button', { name: 'Read my cards' }).click();
  await expect(page.locator('.error[data-for="name"]')).toBeVisible();
  await expect(page.locator('.error[data-for="rating"]')).toBeVisible();
  await expect(page.locator('#form')).toBeVisible();
});

test('offline: draw works with no signal, row queues, sends when back online', async ({ page, context }) => {
  const posts = await mockSheet(page);
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await fillAndRead(page, { dishes: [] });
  await expect(page.locator('#queue-note')).toBeVisible();
  expect(await page.evaluate(() => window.__fff.queue().length)).toBe(1);
  expect(posts.length).toBe(0);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => posts.length).toBe(1);
  expect(await page.evaluate(() => window.__fff.queue().length)).toBe(0);
});

test('save image: a 1080x1920 PNG download when there is no share sheet', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator, 'canShare', { value: undefined }); });
  await page.goto('/');
  await fillAndRead(page);
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save my card' }).click();
  const file = await dl;
  expect(file.suggestedFilename()).toMatch(/^freckled-fork-fortune-\d+\.png$/);
  const size = await page.evaluate(async () => {
    const b = await window.__fff.cardImage();
    const bmp = await createImageBitmap(b);
    return [bmp.width, bmp.height, b.size];
  });
  expect(size.slice(0, 2)).toEqual([1080, 1920]);
  expect(size[2]).toBeGreaterThan(50_000);
  await file.saveAs('test-results/saved-card.png');
});

test.describe('missing art', () => {
  // a controlling service worker fetches outside page.route, so keep it out of this test
  test.use({ serviceWorkers: 'block' });
test('missing art never breaks a draw', async ({ page }) => {
  await page.route(/\/cards\/(dish|cats)\/[^/]+\.(webp|avif)$/, (r) => r.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await fillAndRead(page, { dishes: ['ghosted'] });
  await expect(page.locator('#card-front .ph')).toBeVisible();
});
});

test.describe('reduced motion', () => {
  test('no shuffle, the card is there at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const t0 = Date.now();
    await fillAndRead(page);
    expect(Date.now() - t0).toBeLessThan(6000);
    const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.landing-card img')).animationName);
    expect(anim).toBe('none');
    await page.screenshot({ path: 'test-results/reduced-motion-result.png', fullPage: true });
  });
});

test('no dish: a cat card, lettered in its boxes, and saved with the lettering', async ({ page }) => {
  await page.goto('/');
  await fillAndRead(page, { dishes: [] });
  const img = page.locator('#card-front .art img');
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth)).toBe(480);
  await expect(page.locator('#card-front .ov.title')).not.toBeEmpty();
  await page.waitForTimeout(1300);
  await page.screenshot({ path: 'test-results/05-cat-card.png' });
  const blob = await page.evaluate(async () => {
    const b = await window.__fff.cardImage();
    const r = new FileReader();
    return new Promise((res) => { r.onload = () => res(r.result); r.readAsDataURL(b); });
  });
  writeFileSync('test-results/saved-cat-card.png', Buffer.from(blob.split(',')[1], 'base64'));
});

test('screens for review', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/01-landing.png' });
  await page.getByRole('button', { name: 'Pull a card' }).click();
  await page.locator('input[name="dish"][value="ichabod"]').check({ force: true });
  await page.screenshot({ path: 'test-results/02-form.png', fullPage: true });
  await page.getByLabel('Your name').fill('Theo');
  await page.locator('#rating label', { hasText: 'Real good' }).click();
  await page.getByRole('button', { name: 'Read my cards' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/03-draw.png' });
  await expect(page.locator('#flip')).toHaveClass(/open/, { timeout: 15_000 });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'test-results/04-result.png', fullPage: true });
});

test('the reading never mentions what they ate, their sign or their rating', async ({ page }) => {
  await page.goto('/');
  await fillAndRead(page, { dishes: ['hex', 'brodo'], rating: 'Marry it' });
  const drawn = await page.evaluate(() => window.__fff.current.fortune.cardId);
  const verbatim = `${READINGS.cards[drawn].tagline} ${READINGS.cards[drawn].text}`.toLowerCase();
  // everything in the reading article except the second-card caption
  const text = (await page.locator('#reading').evaluate((el) => {
    const c = el.cloneNode(true);
    c.querySelector('#r-second')?.remove();
    return c.textContent;
  })).toLowerCase();
  const names = await page.evaluate(() => [...document.querySelectorAll('#dishes strong')].map((e) => e.textContent));
  const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
  const ratings = ['meh', 'real good', 'marry it'];
  expect(names.length).toBe(6);
  for (const w of [...names, ...signs, ...ratings]) {
    const needle = w.toLowerCase();
    if (verbatim.includes(needle)) continue; // Jess's own words may say it
    expect(text, `reading must not contain "${w}"`).not.toContain(needle);
  }
});

test('the queued row carries all 15 Code.gs columns, none undefined', async ({ page }) => {
  await page.addInitScript(() => { globalThis.__FFF_ENDPOINT = 'https://script.google.com/macros/s/NEVER/exec'; });
  await page.route('https://script.google.com/macros/s/NEVER/exec', (r) => r.abort()); // the row stays queued
  await page.goto('/');
  await fillAndRead(page);
  const row = await page.evaluate(() => window.__fff.queue()[0]);
  for (const c of COLUMNS) { expect(row, c).toHaveProperty(c); expect(row[c], c).not.toBeUndefined(); }
  for (const c of ['card_id', 'card_title', 'fortune_seed']) expect(String(row[c]).length, c).toBeGreaterThan(0);
});

test('a print-QR visit (?s=print) under a controlling service worker queues source "print"', async ({ page }) => {
  const posts = await mockSheet(page);
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.goto('/?s=print');
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await fillAndRead(page);
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0].source).toBe('print');
});
