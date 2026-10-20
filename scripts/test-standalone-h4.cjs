/* تست موتور اسکلپ مستقل با دادهٔ مصنوعی — صحت انتخاب کندل ملاک */
const fs = require("fs");

const TEHRAN = "Asia/Tehran";
global.lsGet = () => null;
global.lsSet = () => {};
global.faTime = (d) => new Intl.DateTimeFormat("fa-IR", { timeZone: TEHRAN, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
global.faDigits = (v) => String(v);
global.faDateLong = () => "";
global.icon = () => "";
global.PROXIES = [];
global.fetchJSON = () => Promise.reject(new Error("no-net"));
global.appScroll = { querySelectorAll: () => [], querySelector: () => null };
global.trRangeComp = () => ({ active: false });
global.SC_GA = () => {};
/* هر گزاره‌ای که app.f.js در سطح ماژول صدا می‌زند */
try {
  eval(fs.readFileSync("/home/z/my-project/scripts/standalone/app.f.js", "utf8"));
} catch (e) {
  console.log("LOAD ERROR:", e.message);
  process.exit(1);
}

const H4 = 14400;
const nowSec = Math.floor(Date.now() / 1000);
const phase = scPhase(nowSec, "broker");
console.log("phase:", phase, "(DST تابستان → ۳۶۰۰ = مرز ۲۱:۰۰ UTC)");

/* کندل‌های اسکلپ ۵دقیقه‌ای — ۴۸ ساعت اخیر تا الان */
const bars = [];
for (let t = nowSec - 48 * 3600; t <= nowSec; t += 300) {
  bars.push({ t, o: 100, h: 101, l: 99, c: 100.5 });
}

/* کندل‌های ۴ساعته — سناریو ۱: باکت بستهٔ بلافصل موجود */
function mkH4(withLatest) {
  const arr = [];
  const nowBucket = Math.floor((nowSec - phase) / H4);
  for (let g = 1; g <= 8; g++) {
    const idx = nowBucket - g;
    if (!withLatest && g === 1) continue; // سناریو ۲: کندل بلافصل در داده نیست
    arr.push({ t: idx * H4 + phase, o: 100, h: 105 + g, l: 95 - g, c: 102 });
  }
  return arr;
}

for (const [label, withLatest] of [["با کندل بلافصل (gap باید ۰ باشد)", true], ["بدون کندل بلافصل (gap باید ۱ + هشدار)", false]]) {
  const r = scalpRun(bars, mkH4(withLatest), { nowSec, anchor: "broker" });
  const tehran = (t) => new Date(t * 1000).toLocaleString("fa-IR", { timeZone: TEHRAN, dateStyle: "short", timeStyle: "short" });
  console.log("\n=== " + label + " ===");
  console.log("h4Ref:", r.h4Ref ? { gap: r.h4Ref.gap, startUTC: new Date(r.h4Ref.startT * 1000).toISOString(), H: r.h4Ref.high, L: r.h4Ref.low } : "null");
  console.log("پنجرهٔ تهران:", r.h4Ref ? tehran(r.h4Ref.startT) + " تا " + tehran(r.h4Ref.endT) : "-");
  console.log("h4High/Low:", r.h4High, r.h4Low);
  const gapNote = (r.notes || []).find((n) => n.includes("بلافصل"));
  if (gapNote) console.log("هشدار:", gapNote.slice(0, 80) + "…");
  if (withLatest && r.h4Ref && r.h4Ref.gap === 0 && r.h4Ref.high === 106) console.log("✓ سناریو ۱ درست");
  if (!withLatest && r.h4Ref && r.h4Ref.gap === 1 && r.h4Ref.high === 107) console.log("✓ سناریو ۲ درست (یک کندل عقب‌تر + ثبت گپ)");
}

/* سناریو ۳: anchor=utc باید باکت متفاوتی را ملاک بگیرد (اختلاف فاز ۳ ساعت الان) */
const rU = scalpRun(bars, mkH4(true), { nowSec, anchor: "utc" });
const rB = scalpRun(bars, mkH4(true), { nowSec, anchor: "broker" });
console.log("\n=== مقایسه تراز UTC و بروکر ===");
console.log("UTC   start:", new Date(rU.h4Ref.startT * 1000).toISOString());
console.log("broker start:", new Date(rB.h4Ref.startT * 1000).toISOString());
console.log(rU.h4Ref.startT !== rB.h4Ref.startT ? "✓ دو تراز کندل متفاوت — انتخابگر کار می‌کند" : "✗ ترازها یکسان شدند (اشکال)");
