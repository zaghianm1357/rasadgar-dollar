// ریشه‌یابی مشکل اسکرول صفحه ۲ در حالت RTL
import { chromium, devices } from 'playwright';

const URL = process.env.TARGET_URL || 'https://zaghianm1357.github.io/rasadgar-dollar/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'fa-IR' });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(2500);

const diag = await page.evaluate(() => {
  const p = document.querySelector('#pages');
  const cs = getComputedStyle(p);
  const d1 = document.querySelector('.dot[data-page="1"]');
  const r = d1 ? d1.getBoundingClientRect() : null;
  return {
    dir: cs.direction,
    scrollSnapType: cs.scrollSnapType,
    scrollBehavior: cs.scrollBehavior,
    overflowX: cs.overflowX,
    scrollWidth: p.scrollWidth,
    clientWidth: p.clientWidth,
    maxAbs: p.scrollWidth - p.clientWidth,
    scrollLeftNow: p.scrollLeft,
    dot1Exists: !!d1,
    dot1Visible: r ? (r.width > 0 && r.height > 0) : false,
    dot1Rect: r ? { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } : null,
    pagesRect: (() => { const pr = p.getBoundingClientRect(); return { y: Math.round(pr.y), h: Math.round(pr.height) }; })(),
  };
});
console.log('=== diag ===', JSON.stringify(diag, null, 2));

// تلاش مستقیم برای کلیک روی نقطه ۱
try {
  await page.click('.dot[data-page="1"]', { timeout: 4000 });
  console.log('click dot1: OK (no exception)');
} catch (e) {
  console.log('click dot1 FAILED:', e.message.slice(0, 120));
}
await page.waitForTimeout(1500);
const after1 = await page.evaluate(() => ({
  scrollLeft: document.querySelector('#pages').scrollLeft,
  abs: Math.abs(document.querySelector('#pages').scrollLeft),
}));
console.log('after dot click:', JSON.stringify(after1));

// اسکرول دستی به -maxAbs بدون smooth
await page.evaluate(() => {
  const p = document.querySelector('#pages');
  const max = p.scrollWidth - p.clientWidth;
  p.scrollTo({ left: -max, behavior: 'instant' });
});
await page.waitForTimeout(600);
const after2 = await page.evaluate(() => ({
  scrollLeft: document.querySelector('#pages').scrollLeft,
  abs: Math.abs(document.querySelector('#pages').scrollLeft),
}));
console.log('after instant scrollTo(-max):', JSON.stringify(after2));

// تلاش scrollTo مثبت
await page.evaluate(() => {
  const p = document.querySelector('#pages');
  p.scrollTo({ left: 0, behavior: 'instant' });
  const max = p.scrollWidth - p.clientWidth;
  p.scrollTo({ left: +max, behavior: 'instant' });
});
await page.waitForTimeout(600);
const after3 = await page.evaluate(() => ({
  scrollLeft: document.querySelector('#pages').scrollLeft,
}));
console.log('after instant scrollTo(+max):', JSON.stringify(after3));

await browser.close();
