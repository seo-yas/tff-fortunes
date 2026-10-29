// Gemini A1: a phone already running the page picks up a new release with one automatic reload from the landing screen.
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const SW = '_site/sw.js';

test('a new release reloads the landing screen once and the new worker controls the page', async ({ page }) => {
  const original = readFileSync(SW, 'utf8');
  let loads = 0;
  page.on('load', () => { loads++; });
  try {
    await page.goto('/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload(); // now controlled at boot, so the page watches for a new worker
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    const oldScript = await page.evaluate(() => navigator.serviceWorker.controller.scriptURL);
    await page.evaluate(() => { window.__marker = 'before'; });
    const before = loads;
    writeFileSync(SW, original.replace(/const VERSION = '[^']*';/, "const VERSION = 'fff-test-next-release';"));
    await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update(); });
    await expect.poll(() => loads, { timeout: 15_000 }).toBe(before + 1);
    await expect.poll(() => page.evaluate(() => window.__marker ?? 'gone')).toBe('gone'); // a real reload, not a hook
    await page.waitForTimeout(1500);
    expect(loads, 'exactly one reload').toBe(before + 1);
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    const keys = await page.evaluate(() => caches.keys());
    expect(keys).toContain('fff-test-next-release');
    expect(oldScript).toMatch(/sw\.js$/);
  } finally {
    writeFileSync(SW, original);
  }
});

test('a new release does not reload a form the guest has started typing in', async ({ page }) => {
  const original = readFileSync(SW, 'utf8');
  let loads = 0;
  page.on('load', () => { loads++; });
  try {
    await page.goto('/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.getByRole('button', { name: 'Pull a card' }).click();
    await page.getByLabel('Your name').fill('Ines');
    const before = loads;
    writeFileSync(SW, original.replace(/const VERSION = '[^']*';/, "const VERSION = 'fff-test-next-release-2';"));
    await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update(); });
    await expect.poll(() => page.evaluate(() => caches.keys().then((k) => k.includes('fff-test-next-release-2')))).toBe(true);
    await page.waitForTimeout(1200);
    expect(loads).toBe(before);
    await expect(page.getByLabel('Your name')).toHaveValue('Ines');
  } finally {
    writeFileSync(SW, original);
  }
});

test('a new release does not reload a form where a dish is ticked but no name is typed', async ({ page }) => {
  const original = readFileSync(SW, 'utf8');
  let loads = 0;
  page.on('load', () => { loads++; });
  try {
    await page.goto('/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.getByRole('button', { name: 'Pull a card' }).click();
    await page.locator('input[name="dish"]').first().check({ force: true });
    await expect(page.getByLabel('Your name')).toHaveValue('');
    const before = loads;
    writeFileSync(SW, original.replace(/const VERSION = '[^']*';/, "const VERSION = 'fff-test-next-release-3';"));
    await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update(); });
    await expect.poll(() => page.evaluate(() => caches.keys().then((k) => k.includes('fff-test-next-release-3')))).toBe(true);
    await page.waitForTimeout(1200);
    expect(loads).toBe(before);
    await expect(page.locator('input[name="dish"]').first()).toBeChecked();
  } finally {
    writeFileSync(SW, original);
  }
});

test('a new release does not reload a form that is focused but still empty', async ({ page }) => {
  const original = readFileSync(SW, 'utf8');
  let loads = 0;
  page.on('load', () => { loads++; });
  try {
    await page.goto('/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await page.getByRole('button', { name: 'Pull a card' }).click();
    await page.getByLabel('Your name').focus();
    await expect(page.getByLabel('Your name')).toHaveValue('');
    const before = loads;
    writeFileSync(SW, original.replace(/const VERSION = '[^']*';/, "const VERSION = 'fff-test-next-release-4';"));
    await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg.update(); });
    await expect.poll(() => page.evaluate(() => caches.keys().then((k) => k.includes('fff-test-next-release-4')))).toBe(true);
    await page.waitForTimeout(1200);
    expect(loads).toBe(before);
  } finally {
    writeFileSync(SW, original);
  }
});
