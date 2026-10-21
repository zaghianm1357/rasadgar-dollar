// تست نسخه دسکتاپ: تب‌ها، خانه، کیبورد، منو
import { chromium } from 'playwright';

const URL = 'file:///home/z/my-project/download/rasadgar-dollar-desktop.html';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'fa-IR' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text().slice(0, 100)); });

await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2200);

const out = {};
out.title = await page.title();
out.fontOk = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 16px Vazirmatn'); });

// تب‌ها
out.tabCount = await page.evaluate(() => document.querySelectorAll('#dt-tabs .dt-tab').length);
out.tabLabels = await page.evaluate(() => [...document.querySelectorAll('#dt-tabs .dt-tab span')].map(s => s.textContent).filter((_, i) => i % 2 === 0));

// خانه باز است؟
out.homeVisible = await page.evaluate(() => {
  const s = document.querySelector('#app-sheet');
  return !s.hidden && !!document.querySelector('#app-scroll .dt-home');
});
out.homeTitle = await page.evaluate(() => document.querySelector('#app-title').textContent);
out.homeWidgets = await page.evaluate(() => document.querySelectorAll('#app-scroll .dt-home .widget').length);
out.chips = await page.evaluate(() => document.querySelector('#dt-chips').children.length);
out.clockOk = await page.evaluate(() => document.querySelector('#dt-clock').textContent !== '--:--');

// کلیک روی تب‌های اصلی
const tabs = ['news', 'structure', 'suggestion', 'scalp', 'chart', 'trader', 'analysis', 'about'];
out.tabTests = {};
for (const t of tabs) {
  await page.click(`[data-dt-tab="${t}"]`);
  await page.waitForTimeout(t === 'chart' ? 2500 : 1200);
  out.tabTests[t] = await page.evaluate(() => ({
    title: document.querySelector('#app-title').textContent,
    contentLen: document.querySelector('#app-scroll').innerHTML.length,
  }));
}

// برگشت به خانه با کیبورد (کلید ۱)
await page.keyboard.press('1');
await page.waitForTimeout(900);
out.keyboardHome = await page.evaluate(() => !!document.querySelector('#app-scroll .dt-home'));

// فلش‌ها: چپ → تب بعدی (news)
await page.keyboard.press('ArrowLeft');
await page.waitForTimeout(900);
out.keyboardArrowTab = await page.evaluate(() => document.querySelector('#app-title').textContent);

// منوی جانبی
await page.click('#dt-menu');
await page.waitForTimeout(700);
out.drawerOk = await page.evaluate(() => document.querySelector('#drawer-layer').classList.contains('on'));
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
out.drawerClosed = await page.evaluate(() => !document.querySelector('#drawer-layer').classList.contains('on'));

console.log(JSON.stringify(out, null, 2));
console.log('=== errors ===', errs.length ? '' : 'NONE');
const unique = [...new Set(errs)];
for (const e of unique.slice(0, 10)) console.log(' ', e);
await page.screenshot({ path: '/home/z/my-project/scripts/desktop-test.png', fullPage: false });
await browser.close();
