// تست عمیق: داک، نقطه‌ها، منوی جانبی، دکمه‌های داخل اپ‌ها
import { chromium, devices } from 'playwright';

const URL = process.env.TARGET_URL || 'https://zaghianm1357.github.io/rasadgar-dollar/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'fa-IR' });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('PAGEERROR: ' + String(e).slice(0, 150)));

await page.goto(URL, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(2500);

const out = {};

// 1) داک
await page.tap('#dock-in [data-app="news"]').catch(() => {});
await page.waitForTimeout(800);
out.dockTap = await page.evaluate(() => !document.querySelector('#app-sheet').hidden);
await page.tap('#app-back').catch(() => {});
await page.waitForTimeout(500);

// 2) نقطه‌ها → صفحه ۲
await page.tap('.dot[data-page="1"]').catch(() => {});
await page.waitForTimeout(900);
out.page2Scroll = await page.evaluate(() => {
  const p = document.querySelector('#pages');
  return Math.abs(p.scrollLeft) > 50;
});
out.page2Content = await page.evaluate(() => document.querySelector('#page2-inner').children.length);

// 3) منوی جانبی
await page.tap('#sb-menu').catch(() => {});
await page.waitForTimeout(700);
out.drawerOpened = await page.evaluate(() => {
  const d = document.querySelector('#drawer-layer');
  return d && d.classList.contains('on');
});
const dn = await page.$('[data-dnav]');
if (dn) { await dn.tap().catch(() => {}); }
await page.waitForTimeout(800);
out.drawerNavOpensApp = await page.evaluate(() => !document.querySelector('#app-sheet').hidden);
await page.tap('#app-back').catch(() => {});
await page.waitForTimeout(400);

// 4) دکمه‌های داخل اپ اخبار (تب‌ها/بیشتر)
await page.tap('[data-icon="news"]').catch(() => {});
await page.waitForTimeout(1200);
out.newsInnerButtons = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('#app-scroll button')];
  return { count: btns.length, labels: btns.slice(0, 6).map((b) => (b.textContent || '').trim().slice(0, 24)) };
});
const nb = await page.$$('#app-scroll button');
if (nb.length) { await nb[0].tap().catch(() => {}); await page.waitForTimeout(700); }
out.newsInnerStillAlive = await page.evaluate(() => !!document.querySelector('#app-scroll').children.length);
await page.tap('#app-back').catch(() => {});

// 5) اپ ساختار بازار — چیپ‌های تایم‌فریم
await page.tap('[data-icon="structure"]').catch(() => {});
await page.waitForTimeout(1500);
out.structureChips = await page.evaluate(() => {
  const chips = [...document.querySelectorAll('#app-scroll [data-tf], #app-scroll button')];
  return chips.slice(0, 10).map((c) => (c.textContent || '').trim().slice(0, 12));
});
const chip = await page.$('#app-scroll [data-tf]');
if (chip) { await chip.tap().catch(() => {}); await page.waitForTimeout(600); }

console.log(JSON.stringify(out, null, 2));
console.log('=== pageerrors ===', errs.length ? '' : 'NONE');
for (const e of errs.slice(0, 8)) console.log(' ', e);
await browser.close();
