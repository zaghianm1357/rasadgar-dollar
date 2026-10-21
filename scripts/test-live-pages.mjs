// تست لایو سایت GitHub Pages با شبیه‌سازی موبایل لمسی
// 1) بارگذاری صفحه  2) بررسی خطاهای کنسول  3) کلیک روی آیکون‌ها  4) بررسی باز شدن اپ‌ها
import { chromium, devices } from 'playwright';

const URL = process.env.TARGET_URL || 'https://zaghianm1357.github.io/rasadgar-dollar/';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices['iPhone 13'],
  locale: 'fa-IR',
});
const page = await ctx.newPage();

const consoleErrors = [];
const failedRequests = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
page.on('requestfailed', (r) => failedRequests.push(r.url().slice(0, 120) + ' :: ' + (r.failure()?.errorText || '')));

await page.goto(URL, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(3500);

console.log('=== title ===', await page.title());

// وضعیت اولیه: آیکون‌های صفحه ۱
const icons = await page.evaluate(() => {
  const grid = document.querySelector('#page1-inner');
  const els = grid ? [...grid.querySelectorAll('[data-icon]')] : [];
  return { count: els.length, ids: els.map((e) => e.getAttribute('data-icon')) };
});
console.log('=== icons on page1 ===', JSON.stringify(icons));

const dock = await page.evaluate(() => {
  const els = [...document.querySelectorAll('#dock-in [data-app]')];
  return els.map((e) => e.getAttribute('data-app'));
});
console.log('=== dock apps ===', JSON.stringify(dock));

// تست کلیک روی هر آیکون صفحه ۱ → باید #app-sheet باز شود و عنوانش پر شود
const results = [];
for (const id of icons.ids) {
  const before = await page.evaluate(() => {
    const s = document.querySelector('#app-sheet');
    return { hidden: s ? s.hidden : null, title: (document.querySelector('#app-title') || {}).textContent || '' };
  });
  try {
    await page.tap(`[data-icon="${id}"]`);
    await page.waitForTimeout(900);
  } catch (e) {
    results.push({ id, error: 'tap-failed: ' + e.message.slice(0, 80) });
    continue;
  }
  const after = await page.evaluate(() => {
    const s = document.querySelector('#app-sheet');
    return { hidden: s ? s.hidden : null, title: (document.querySelector('#app-title') || {}).textContent || '' };
  });
  results.push({ id, opened: before.hidden === true && after.hidden === false, title: after.title });
  // بستن اپ با دکمه بازگشت
  try { await page.tap('#app-back'); await page.waitForTimeout(600); } catch (e) {}
}

console.log('=== tap results ===');
for (const r of results) console.log(JSON.stringify(r));

console.log('=== console errors ===', consoleErrors.length ? '' : 'NONE');
for (const e of consoleErrors.slice(0, 10)) console.log('  ERR:', e);
console.log('=== failed requests ===', failedRequests.length ? '' : 'NONE');
for (const f of failedRequests.slice(0, 10)) console.log('  FAIL:', f);

await page.screenshot({ path: '/home/z/my-project/scripts/live-pages-test.png' });
await browser.close();
