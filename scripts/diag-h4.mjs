/* تشخیص: کندل ۴ساعتهٔ انتخابی موتور در برابر واقعیت دادهٔ Yahoo */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

async function fetchCandles(symbol, interval, range) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  const r = j.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0] ?? {};
  const ts = r?.timestamp;
  const out = [];
  for (let i = 0; i < (ts?.length ?? 0); i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if ([o, h, l, c].some((v) => typeof v !== "number" || !isFinite(v))) continue;
    out.push({ t: ts[i], o, h, l, c });
  }
  return { bars: out, meta: r?.meta ?? {} };
}

const fmt = (t) => new Date(t * 1000).toISOString().replace("T", " ").slice(0, 16) + " UTC";
const tehran = (t) => new Date(t * 1000).toLocaleString("fa-IR", { timeZone: "Asia/Tehran", dateStyle: "short", timeStyle: "short" });

const now = Math.floor(Date.now() / 1000);
console.log("=== NOW:", fmt(now), "| Tehran:", tehran(now));

const { bars: b1h } = await fetchCandles("GC=F", "1h", "3mo");
console.log("\n=== GC=F 1h — آخرین ۸ کندل خام ===");
for (const b of b1h.slice(-8)) console.log(fmt(b.t), `O=${b.o} H=${b.h} L=${b.l} C=${b.c}`);

const last1h = b1h[b1h.length - 1];
console.log("\nآخرین کندل ۱h:", fmt(last1h.t), "→ سن داده:", Math.round((now - last1h.t) / 60), "دقیقه");

// تجمیع epoch-به‌هم‌تراز (روش فعلی)
const H4 = 4 * 3600;
const agg = new Map();
for (const b of b1h) {
  const k = Math.floor(b.t / H4) * H4;
  const ex = agg.get(k);
  if (!ex) agg.set(k, { t: k, o: b.o, h: b.h, l: b.l, c: b.c });
  else {
    ex.h = Math.max(ex.h, b.h); ex.l = Math.min(ex.l, b.l); ex.c = b.c;
  }
}
const buckets = [...agg.entries()].sort((a, b) => a[0] - b[0]);
console.log("\n=== باکت‌های ۴ساعته (تراز epoch/UTC) — ۶ تای آخر ===");
for (const [k, v] of buckets.slice(-6)) {
  const end = k + H4;
  const complete = end <= now;
  console.log(fmt(k), "→", fmt(end - 1), complete ? "[بسته]" : "[در حال شکل‌گیری]", `H=${v.h} L=${v.l}`);
}

// آنچه موتور برای آخرین کندل اسکلپ انتخاب می‌کند
const lastBarT = last1h.t; // تقریب: آخرین داده
const curBucket = Math.floor(lastBarT / H4);
let picked = null, pickedGap = null;
for (let b = curBucket - 1; b >= curBucket - 12; b--) {
  const e = agg.get(b);
  if (e) { picked = { bucket: b, ...e }; pickedGap = curBucket - 1 - b; break; }
}
console.log("\n=== انتخاب موتور فعلی ===");
console.log("باکت جاری:", fmt(curBucket * H4));
if (picked) {
  console.log(`کندل انتخابی: ${fmt(picked.bucket)} H=${picked.h} L=${picked.l} → ${pickedGap === 0 ? "همان کندل بستهٔ قبلی ✓" : `⚠️ ${pickedGap} باکت عقب‌تر (${pickedGap * 4} ساعت)`}`);
} else console.log("هیچ کندلی پیدا نشد");

// کندل ۴ساعتهٔ واقعیِ «آخرین بسته‌شده» بر اساس زمان حال
const nowBucket = Math.floor(now / H4);
const truePrev = agg.get((nowBucket - 1) * H4);
console.log("\n=== واقعیت: کندل بسته‌شدهٔ قبلی بر اساس الان ===");
console.log("باکت جاری زمان:", fmt(nowBucket * H4), "→ کندل بستهٔ قبلی:", fmt((nowBucket - 1) * H4));
if (truePrev) console.log(`H=${truePrev.h} L=${truePrev.l}`); else console.log("⚠️ در نقشهٔ تجمیعی Yahoo وجود ندارد!");

// مقایسهٔ انتخاب موتور با واقعیت
if (picked && truePrev && picked.bucket !== nowBucket - 1) {
  console.log(`\n🚨 ناهم‌خوانی: موتور کندل ${fmt(picked.bucket)} را نشان می‌دهد ولی کندل بستهٔ درست ${fmt((nowBucket - 1) * H4)} است`);
  if (picked.bucket < nowBucket - 1) {
    const tp = agg.get(picked.bucket);
    console.log(`   اختلاف سقف: ${truePrev.h - picked.h > 0 ? "+" : ""}(true ${truePrev.h} vs shown ${picked.h}) — سطوح از کندل قدیمی`);
  }
}

// بررسی گپ‌های ۱ساعته در ۴۸ ساعت اخیر
console.log("\n=== گپ‌های ۱ساعته در ۴۸ ساعت اخیر (GC=F) ===");
const cutoff = now - 48 * 3600;
const recent = b1h.filter((b) => b.t >= cutoff);
let prevT = null, gaps = 0;
for (const b of recent) {
  if (prevT !== null && b.t - prevT > 3600) { gaps++; console.log(`گپ: ${fmt(prevT)} → ${fmt(b.t)} (${(b.t - prevT) / 3600} ساعت)`); }
  prevT = b.t;
}
if (!gaps) console.log("بدون گپ —", recent.length, "کندل");

// نقره هم چک شود
const { bars: s1h } = await fetchCandles("SI=F", "1h", "3mo");
const sLast = s1h[s1h.length - 1];
console.log("\n=== SI=F 1h: آخرین کندل ===", fmt(sLast.t), "→ سن:", Math.round((now - sLast.t) / 60), "دقیقه");
