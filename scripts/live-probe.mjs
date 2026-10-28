// One real submission from the live page to the real Sheet (source=probe), to prove the browser path end to end:
// the page posts, reads Apps Script's reply across origins, and empties its queue. usage: node scripts/live-probe.mjs
import { chromium } from '@playwright/test';

const URL = 'https://fortunes.thefreckledfork.com/?s=probe';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const replies = [];
page.on('response', async (r) => {
  if (/script\.google(usercontent)?\.com/.test(r.url())) replies.push({ status: r.status(), acao: r.headers()['access-control-allow-origin'] || null });
});
await page.goto(URL);
await page.getByRole('button', { name: 'Pull a card' }).click();
await page.getByLabel('Your name').fill('Code probe (delete me)');
await page.locator('#rating label', { hasText: 'Fine' }).click();
await page.getByRole('button', { name: 'Read my cards' }).click();
await page.locator('#flip.open').waitFor({ timeout: 20_000 });
const seed = await page.evaluate(() => window.__fff.current.fortune.seed);
let left = -1;
for (let i = 0; i < 30; i++) {
  left = await page.evaluate(() => window.__fff.queue().length);
  if (left === 0) break;
  await page.waitForTimeout(1000);
}
const cardId = await page.evaluate(() => window.__fff.current.fortune.cardId);
console.log(JSON.stringify({ seed, cardId, queueLeft: left, replies, title: await page.locator('#r-title').textContent() }, null, 2));
await browser.close();
process.exit(left === 0 ? 0 : 1);
