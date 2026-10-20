/**
 * ساخت فایل مستقل «رصدگر دلار» — تک‌فایل HTML قابل ارسال با ایمیل
 * منبع داده: تلاش برای دریافت تازه از سرور محلی؛ در غیر این صورت فایل‌های اسنپ‌شات
 * خروجی: /home/z/my-project/download/rasadgar-dollar.html
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASE = '/home/z/my-project/scripts/standalone';
const OUT = '/home/z/my-project/download/rasadgar-dollar.html';

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
const head = readFileSync(BASE + '/head.html', 'utf8');
let body = readFileSync(BASE + '/body.html', 'utf8');
const js = [
  readFileSync(BASE + '/app.a.js', 'utf8'),
  readFileSync(BASE + '/app.b.js', 'utf8'),
  readFileSync(BASE + '/app.c.js', 'utf8'),
  readFileSync(BASE + '/app.d.js', 'utf8'),
  readFileSync(BASE + '/app.e.js', 'utf8'),
  readFileSync(BASE + '/app.f.js', 'utf8'),
].join('\n');

/* اسنپ‌شات تحلیل و پیش‌بینی طلا (پشتوانه آفلاین اپ «تحلیل و پیش‌بینی») */
const analysisSnapshot = existsSync(BASE + '/snapshot-analysis.json')
  ? JSON.parse(readFileSync(BASE + '/snapshot-analysis.json', 'utf8'))
  : null;

/* لوگوی BIG TRADER (base64) — در app.b.js و app.e.js جای‌گذاری می‌شود */
const logoB64 = readFileSync(BASE + '/logo-b64.txt', 'utf8').trim();
if (logoB64.length < 1000) throw new Error('logo-b64 invalid');

/* شماره نسخه از version.json (منبع واحد) — در متن درباره جای‌گذاری می‌شود */
const appVersion = JSON.parse(readFileSync('/home/z/my-project/version.json', 'utf8')).version;

let jsWithLogo = js.split('__BT_LOGO_B64__').join(logoB64);
jsWithLogo = jsWithLogo.split('__APP_VERSION__').join(appVersion);
if (!jsWithLogo.includes('data:image/png;base64,')) throw new Error('logo placeholder missing');
if (jsWithLogo.includes('__APP_VERSION__')) throw new Error('version placeholder not replaced');
const wrapped = '(function(){\n' + jsWithLogo + '\n})();';

// امن‌سازی JSON برای جای‌گذاری داخل <script>
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
console.log('OK →', OUT, (out.length / 1024).toFixed(1) + ' KB', '| source:', snap.source, '| events:', snap.news.events.length, '| analysis snapshot:', analysisSnapshot ? 'yes' : 'missing');
