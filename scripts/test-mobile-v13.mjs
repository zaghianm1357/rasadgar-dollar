// تست نسخه موبایل rebuild شده: فونت، آیکون‌ها، نقطه‌های صفحه
import { chromium, devices } from 'playwright';

const URL = 'file:///home/z/my-project/download/rasadgar-dollar.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'fa-IR' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 120)); });

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2000);

const out = {};
// 1) فونت واقعا لود شده؟
out.fontLoaded = await page.evaluate(async () => {
  await document.fonts.ready;
  return document.fonts.check('700 16px Vazirmatn') && document.fonts.check('400 14px Vazirmatn');
});
out.noExternalReqs = await page.evaluate(() => performance.getEntriesByType('resource').filter(r => /^https?:/.test(r.name) && !r.name.startsWith('file:')).map(r => r.name.slice(0, 60)));

// 2) آیکون‌ها
await page.tap('[data-icon="news"]');
await page.waitForTimeout(700);
out.iconOpens = await page.evaluate(() => !document.querySelector('#app-sheet').hidden);
await page.tap('#app-back');
await page.waitForTimeout(500);

// 3) نقطه صفحه ۲ — الان باید بدون بلاک شدن hint کار کند
await page.tap('.dot[data-page="1"]');
await page.waitForTimeout(1000);
out.page2Works = await page.evaluate(() => Math.abs(document.querySelector('#pages').scrollLeft) > 50);

// 4) برگشت به صفحه ۱ با نقطه
await page.tap('.dot[data-page="0"]');
await page.waitForTimeout(1000);
out.backToPage1 = await page.evaluate(() => Math.abs(document.querySelector('#pages').scrollLeft) < 40);

console.log(JSON.stringify(out, null, 2));
console.log('=== errors (non-network) ===', errs.length ? '' : 'NONE');
for (const e of errs.slice(0, 6)) console.log(' ', e);
await browser.close();
