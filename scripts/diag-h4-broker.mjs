/* صحت‌سنجی عددی: کندل ملاک ۴ساعته با تراز بروکر در برابر دادهٔ خام Yahoo */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function h4PhaseSec(nowSec, anchor) {
  if (anchor !== "broker") return 0;
  const ms = nowSec * 1000;
  const y = new Date(ms).getUTCFullYear();
  const dow = (u) => new Date(u).getUTCDay();
  const mar1 = Date.UTC(y, 2, 1);
  const firstSunMar = mar1 + ((7 - dow(mar1)) % 7) * 86400000;
  const dstStart = firstSunMar + 7 * 86400000;
  const nov1 = Date.UTC(y, 10, 1);
  const dstEnd = nov1 + ((7 - dow(nov1)) % 7) * 86400000;
  return ms >= dstStart && ms < dstEnd ? 3600 : 7200;
}
const H4 = 14400;
const fmt = (t) => new Date(t * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC";
const tehran = (t) => new Date(t * 1000).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "short", timeStyle: "short" });

async function fetch1h(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1h&range=3mo&includePrePost=false`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  const j = await res.json();
  const r = j.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0] ?? {};
  const out = [];
  for (let i = 0; i < (r?.timestamp?.length ?? 0); i++) {
    const [o, h, l, c] = [q.open?.[i], q.high?.[i], q.low?.[i], q.close?.[i]];
    if ([o, h, l, c].some((v) => typeof v !== "number" || !isFinite(v))) continue;
    out.push({ t: r.timestamp[i], o, h, l, c });
  }
  return out;
}

const now = Math.floor(Date.now() / 1000);
const anchor = "broker";
const phase = h4PhaseSec(now, anchor);
console.log("NOW:", fmt(now), "| Tehran:", tehran(now));
console.log("phase (broker):", phase, "→ مرزها در ساعت UTC:", [...Array(6)].map((_, i) => ((phase / 3600 + i * 4) % 24).toFixed(0)).join(":00, ") + ":00");

const raw = await fetch1h("GC=F");
// تجمیع با فاز بروکر — کلید = شمارهٔ باکت (دقیقاً مثل موتور)
const mapIdx = new Map();
for (const b of raw) {
  const idx = Math.floor((b.t - phase) / H4);
  const ex = mapIdx.get(idx);
  if (!ex) mapIdx.set(idx, { h: b.h, l: b.l, n: 1 });
  else { ex.h = Math.max(ex.h, b.h); ex.l = Math.min(ex.l, b.l); ex.n++; }
}
const nowBucket = Math.floor((now - phase) / H4);
console.log("\nباکت جاری (بروکر):", fmt(nowBucket * H4 + phase), "→", fmt((nowBucket + 1) * H4 + phase - 1));
for (let g = 1; g <= 3; g++) {
  const k = (nowBucket - g) * H4 + phase;
  const e = mapIdx.get(nowBucket - g);
  console.log(`کندل ملاک-${g > 1 ? g : ""}: ${fmt(k)} → ${fmt(k + H4 - 1)} [تهران ${tehran(k)} – ${tehran(k + H4)}]`, e ? `H=${e.h} L=${e.l} (${e.n} کندل ۱h)` : "⚠ نیست");
}

// شبیه‌سازی دقیق انتخاب موتور جدید (کلید = idx مثل موتور)
function pickRef(bucket) {
  for (const [gap, b] of [[0, bucket - 1], [1, bucket - 2], [2, bucket - 3]]) {
    const e = mapIdx.get(b);
    if (e) return { ref: e, gap, refBucket: b };
  }
  return { ref: null, gap: 3 };
}
const disp = pickRef(nowBucket);
console.log("\n=== انتخاب موتور جدید ===");
if (disp.ref) {
  const startT = disp.refBucket * H4 + phase;
  console.log(`کندل ملاک: ${fmt(startT)} → ${fmt(startT + H4 - 1)} | gap=${disp.gap} | H=${disp.ref.h} L=${disp.ref.l}`);
  console.log(`تهران: ${tehran(startT)} تا ${tehran(startT + H4)}`);
  // صحت: کندل ملاک باید کندل بستهٔ درست باشد (gap=0 یعنی همان باکت قبل)
  if (disp.gap === 0) console.log("✓ همان کندل بستهٔ بلافصل — منطق درست است");
  else console.log(`⚠ gap=${disp.gap} — کندل بلافصل در دادهٔ Yahoo نیست (گپ فید)`);
} else console.log("هیچ کندلی در ۳ باکت اخیر نیست");

// مقایسه با مرز UTC قدیمی
const phaseUtc = 0;
const nowBucketUtc = Math.floor(now / H4);
const mapUtc = new Map();
for (const b of raw) {
  const k = Math.floor(b.t / H4) * H4;
  const ex = mapUtc.get(k);
  if (!ex) mapUtc.set(k, { h: b.h, l: b.l });
  else { ex.h = Math.max(ex.h, b.h); ex.l = Math.min(ex.l, b.l); }
}
const refUtc = mapUtc.get((nowBucketUtc - 1) * H4);
const refBrok = mapIdx.get(nowBucket - 1);
console.log("\n=== تفاوت تراز UTC (قدیمی) با بروکر (جدید) ===");
console.log("UTC  کندل بستهٔ قبلی:", fmt((nowBucketUtc - 1) * H4), refUtc ? `H=${refUtc.h} L=${refUtc.l}` : "نیست");
console.log("بروکر کندل بستهٔ قبلی:", fmt((nowBucket - 1) * H4 + phase), refBrok ? `H=${refBrok.h} L=${refBrok.l}` : "نیست");
if (refUtc && refBrok && ((nowBucketUtc - 1) * H4 !== (nowBucket - 1) * H4 + phase))
  console.log(`→ دو تراز کندل متفاوتی را «کندل بسته» می‌دانند (اختلاف ${((nowBucket - 1) * H4 + phase - (nowBucketUtc - 1) * H4) / 3600} ساعت) — عین شکایت کاربر`);
else console.log("→ در این لحظه هر دو تراز یک کندل را نشان می‌دهند");
