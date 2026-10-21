/**
 * ساخت نسخه دسکتاپ «رصدگر دلار» — تک‌فایل HTML با قالب سایت
 * همان موتور JS موبایل + پوسته داشبورد دسکتاپ (هدر + تب + پنل)
 * خروجی: /home/z/my-project/download/rasadgar-dollar-desktop.html
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASE = '/home/z/my-project/scripts/standalone';
const OUT = '/home/z/my-project/download/rasadgar-dollar-desktop.html';

async function getSnapshot() {
  try {
    const [n, m] = await Promise.all([
      fetch('http://localhost:3000/api/news', { signal: AbortSignal.timeout(25000) }),
      fetch('http://localhost:3000/api/market-structure', { signal: AbortSignal.timeout(25000) }),
    ]);
    if (n.ok && m.ok) {
      const news = await n.json();
      const market = await m.json();
      if (news && Array.isArray(news.events) && market) {
        return { generatedAt: new Date().toISOString(), news, market, source: 'live' };
      }
    }
  } catch (e) {
    console.log('live fetch failed:', e.message);
  }
  if (!existsSync(BASE + '/snapshot-news.json') || !existsSync(BASE + '/snapshot-ms.json')) {
    throw new Error('no snapshot source available');
  }
  const news = JSON.parse(readFileSync(BASE + '/snapshot-news.json', 'utf8'));
  const market = JSON.parse(readFileSync(BASE + '/snapshot-ms.json', 'utf8'));
  return { generatedAt: new Date().toISOString(), news, market, source: 'files' };
}

const snap = await getSnapshot();
let head = readFileSync(BASE + '/head.html', 'utf8');
let body = readFileSync(BASE + '/body-desktop.html', 'utf8');
const desktopCss = readFileSync(BASE + '/desktop.css', 'utf8');
const desktopJs = readFileSync(BASE + '/desktop-embed.js', 'utf8');

/* فونت وزیرمتن متغیر — جاسازی کامل (بدون فونت گوگل؛ در ایران فیلتر است) */
const vazirB64 = readFileSync(BASE + '/vazirmatn-var-b64.txt', 'utf8').trim();
if (vazirB64.length < 10000) throw new Error('vazirmatn base64 invalid');
head = head.split('__VAZIRMATN_VAR_B64__').join(vazirB64);
if (head.includes('__VAZIRMATN_VAR_B64__')) throw new Error('font placeholder not replaced');

/* عنوان و متای دسکتاپ */
head = head
  .split('<title>رصدگر دلار — نسخه موبایل</title>').join('<title>رصدگر دلار — نسخه دسکتاپ</title>')
  .split('رصدگر دلار — نسخه موبایل').join('رصدگر دلار — نسخه دسکتاپ');

/* تزریق CSS دسکتاپ پیش از بستن استایل اصلی */
if (!head.includes('</style>')) throw new Error('no style tag in head');
head = head.replace('</style>', '\n/* ================= لایه دسکتاپ ================= */\n' + desktopCss + '\n</style>');

const js = [
  readFileSync(BASE + '/app.a.js', 'utf8'),
  readFileSync(BASE + '/app.b.js', 'utf8'),
  readFileSync(BASE + '/app.c.js', 'utf8'),
  readFileSync(BASE + '/app.d.js', 'utf8'),
  readFileSync(BASE + '/app.e.js', 'utf8'),
  readFileSync(BASE + '/app.f.js', 'utf8'),
  desktopJs,
].join('\n');

/* اسنپ‌شات تحلیل و پیش‌بینی طلا */
const analysisSnapshot = existsSync(BASE + '/snapshot-analysis.json')
  ? JSON.parse(readFileSync(BASE + '/snapshot-analysis.json', 'utf8'))
  : null;

/* لوگوی BIG TRADER (base64) */
const logoB64 = readFileSync(BASE + '/logo-b64.txt', 'utf8').trim();
if (logoB64.length < 1000) throw new Error('logo-b64 invalid');

/* شماره نسخه از version.json (منبع واحد) */
const appVersion = JSON.parse(readFileSync('/home/z/my-project/version.json', 'utf8')).version;

let jsWithLogo = js.split('__BT_LOGO_B64__').join(logoB64);
jsWithLogo = jsWithLogo.split('__APP_VERSION__').join(appVersion);
jsWithLogo = jsWithLogo.split('__DT_VERSION__').join(appVersion);
if (!jsWithLogo.includes('data:image/png;base64,')) throw new Error('logo placeholder missing');
if (jsWithLogo.includes('__APP_VERSION__')) throw new Error('version placeholder not replaced');
if (jsWithLogo.includes('__DT_VERSION__')) throw new Error('dt version placeholder not replaced');
const wrapped = '(function(){\n' + jsWithLogo + '\n})();';

const json = JSON.stringify(snap)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

if (!json.includes('"events"')) throw new Error('snapshot json invalid');

const analysisJson = analysisSnapshot
  ? JSON.stringify(analysisSnapshot).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
  : JSON.stringify({ generatedAtISO: new Date().toISOString(), lite: { ok: false }, fx: { ok: false, poll: [], items: [] } });

body = body
  .split('__SNAPSHOT__').join(json)
  .split('__SNAPSHOT_ANALYSIS__').join(analysisJson)
  .split('__APP_JS__').join(wrapped);
const out = head + body;
writeFileSync(OUT, out);
console.log('OK →', OUT, (out.length / 1024).toFixed(1) + ' KB', '| source:', snap.source, '| events:', snap.news.events.length, '| v' + appVersion);
