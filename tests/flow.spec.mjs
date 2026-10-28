import { test, expect } from '@playwright/test';

const ENDPOINT = 'https://script.google.com/macros/s/TEST/exec';
const COLUMNS = ['submitted_at', 'name', 'email', 'news_opt_in', 'birthday', 'sign', 'rating', 'dishes',
  'dish_ways', 'note', 'card_id', 'card_title', 'fortune_seed', 'device', 'source'];

// Point the page at a fake Apps Script endpoint and record what it receives.
async function mockSheet(page) {
  const posts = [];
  await page.addInitScript((u) => { globalThis.__FFF_ENDPOINT = u; }, ENDPOINT);
  await page.route(ENDPOINT, async (route) => {
    posts.push(JSON.parse(route.request().postData()));
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
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
  expect(await page.locator('#r-lines p').count()).toBeGreaterThan(2);
  await expect(page.locator('#r-omen')).not.toBeEmpty();
  await expect(page.locator('#card-front img, #card-front .ph')).toHaveCount(1);
  await expect.poll(() => posts.length).toBe(1);
  const row = posts[0];
  for (const c of COLUMNS) expect(row, c).toHaveProperty(c);
  expect(row.sign).toBe('Scorpio');
  expect(row.birthday).toBe('10-31');
  expect(row.dish_ways).toBe('hex: Beef');
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
  await page.route('**/cards/dish/*.webp', (r) => r.fulfill({ status: 404, body: '' }));
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
