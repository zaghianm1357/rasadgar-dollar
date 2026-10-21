import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') errs.push('C: ' + m.text().slice(0, 200)); });
await page.goto('file:///home/z/my-project/download/rasadgar-dollar-desktop.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2000);
const st = await page.evaluate(() => ({
  dtTabs: !!document.getElementById('dt-tabs'),
  tabsHTMLlen: (document.getElementById('dt-tabs') || {}).innerHTML?.length,
  tabCount: document.querySelectorAll('.dt-tab').length,
  sheetHidden: document.querySelector('#app-sheet')?.hidden,
  appTitle: document.querySelector('#app-title')?.textContent,
  dtDesktop: window.__SD_DESKTOP__,
  homePresent: !!document.querySelector('.dt-home'),
  clock: document.querySelector('#dt-clock')?.textContent,
  ver: document.querySelector('#dt-ver')?.textContent,
  logoSet: (document.getElementById('dt-logo') || {}).style?.backgroundImage?.slice(0, 30),
}));
console.log(JSON.stringify(st, null, 2));
console.log('=== errors ===');
for (const e of [...new Set(errs)].slice(0, 8)) console.log(' ', e);
await browser.close();
