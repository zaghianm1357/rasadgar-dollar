import { NextResponse } from "next/server";
import { getMeta, setMeta } from "@/lib/ff";
import {
  olsNW,
  horizonPairs,
  splitHalfAgree,
  zScore,
  meanStd,
  reliability,
  pressureOf,
  compositeScore,
  compositeLabelFa,
  percentileOf,
  EFFECT_FA,
} from "@/lib/factor-quant";
import type { BetaOut, EffectKind, DatePoint } from "@/lib/factor-quant";
import type { FactorRow, FactorQuantResponse } from "@/lib/factor-types";
import { pearson } from "@/lib/trader-engine";

export const dynamic = "force-dynamic";

/**
 * API کمّی‌سازی اثر عوامل (/api/factor-quant?symbol=xau|dji)
 * β رگرسیون بازده نماد بر تغییر عامل در افق‌های ۱/۵/۲۰ روزه + Z جاری + Pressure + Composite
 * همه خروجی‌ها «رابطه تاریخی/آماری» هستند — نه علّی و نه تضمین.
 */

const TTL_MS = 15 * 60 * 1000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface Candle {
  t: number;
  c: number;
}

function num(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

async function fetchDaily(symbol: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=2y&includePrePost=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ close?: (number | null)[] }> };
      }> | null;
    };
  };
  const r = json.chart?.result?.[0];
  const ts = r?.timestamp;
  const q = r?.indicators?.quote?.[0];
  if (!r || !Array.isArray(ts) || !q?.close) throw new Error(`empty ${symbol}`);
  const out: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = num(q.close[i]);
    if (c === null) continue;
    out.push({ t: ts[i], c });
  }
  if (out.length < 100) throw new Error(`thin ${symbol}: ${out.length}`);
  return out;
}

/* ---------- تعریف عوامل هر نماد ---------- */

interface FactorDef {
  id: string;
  nameFa: string;
  roleFa: string;
  yahoo: string;
  /** واحد «تغییر عامل»: pct = ٪ تغییر | pp = واحد درصد (بازده) | pts = امتیاز شاخص */
  unit: "pct" | "pp" | "pts";
  unitFa: string;
  w: number;
}

const FACTORS: Record<"xau" | "dji", FactorDef[]> = {
  xau: [
    { id: "DXY", nameFa: "شاخص دلار (DXY)", roleFa: "ارزش دلار — رابطه معمول با طلا معکوس است", yahoo: "DX-Y.NYB", unit: "pct", unitFa: "٪", w: 0.4 },
    { id: "US10Y", nameFa: "بازده ۱۰ساله خزانه (US10Y)", roleFa: "هزینه فرصت نگهداری طلا — جانشین نرخ واقعی (اسمی)", yahoo: "^TNX", unit: "pp", unitFa: "واحد درصد بازده", w: 0.35 },
    { id: "SPX", nameFa: "شاخص S&P 500", roleFa: "اشتها به ریسک — جریان ریسک‌گریزی سرمایه", yahoo: "^GSPC", unit: "pct", unitFa: "٪", w: 0.25 },
  ],
  dji: [
    { id: "US10Y", nameFa: "بازده ۱۰ساله خزانه (US10Y)", roleFa: "نرخ بهره و ارزش‌گذاری سهام", yahoo: "^TNX", unit: "pp", unitFa: "واحد درصد بازده", w: 0.35 },
    { id: "VIX", nameFa: "شاخص نوسان (VIX)", roleFa: "سطح ترس/ریسک‌گریزی بازار", yahoo: "^VIX", unit: "pts", unitFa: "امتیاز", w: 0.35 },
    { id: "DXY", nameFa: "شاخص دلار (DXY)", roleFa: "ارزش دلار و اثر بر درآمد ارزی شرکت‌ها", yahoo: "DX-Y.NYB", unit: "pct", unitFa: "٪", w: 0.3 },
  ],
};

/* ---------- تایپ پاسخ ---------- */

export type { FactorRow, FactorQuantResponse };

/* ---------- برچسب اثر فعلی ---------- */

function effectOf(
  b1: BetaOut | null,
  b5: BetaOut | null,
  b20: BetaOut | null,
  z: number | null,
  change5: number | null,
  std5: number | null
): EffectKind {
  if (!b5 || change5 === null) return "unknown";
  /* تضاد بین افق‌ها: افق معنادار دیگری با علامت مخالف β5 */
  const sig = [b1, b20].filter((b): b is BetaOut => b !== null && b.n >= 60 && Math.abs(b.t) >= 2);
  if (sig.some((b) => Math.sign(b.beta) !== Math.sign(b5.beta))) return "conflict";
  /* خنثی: سطح و حرکت اخیر عامل هر دو کم‌اهمیت */
  const smallZ = z !== null && Math.abs(z) < 0.5;
  const smallMove = std5 !== null ? Math.abs(change5) < 0.25 * std5 : Math.abs(change5) < 1e-9;
  if (smallZ && smallMove) return "neutral";
  const dir = Math.sign(b5.beta) * Math.sign(change5);
  if (dir === 0) return "neutral";
  return dir > 0 ? "supportive" : "restrictive";
}

/* ---------- غافلگیری استانداردشده خبری ---------- */

function parseNum(v: string | null): number | null {
  if (!v) return null;
  const m = v.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const x = parseFloat(m[0]);
  return isFinite(x) ? x : null;
}

async function computeSurprise(): Promise<FactorQuantResponse["surprise"]> {
  try {
    const { db } = await import("@/lib/db");
    const latest = await db.economicEvent.findFirst({
      where: { impact: "High", actual: { not: null }, forecast: { not: null }, date: { lte: new Date(), gte: new Date(Date.now() - 10 * 24 * 3600 * 1000) } },
      orderBy: { date: "desc" },
    });
    if (!latest || !latest.actual || !latest.forecast) return null;
    const hist = await db.economicEvent.findMany({
      where: { title: latest.title, actual: { not: null }, forecast: { not: null }, date: { lt: new Date(), gte: new Date(Date.now() - 180 * 24 * 3600 * 1000) } },
      orderBy: { date: "desc" },
      take: 24,
    });
    const sur = hist
      .map((e) => {
        const a = parseNum(e.actual);
        const f = parseNum(e.forecast);
        return a !== null && f !== null ? a - f : null;
      })
      .filter((v): v is number => v !== null);
    const actNow = parseNum(latest.actual);
    const fcNow = parseNum(latest.forecast);
    if (actNow === null || fcNow === null) return null;
    const latestSur = actNow - fcNow;
    const base = {
      title: latest.title,
      titleFa: latest.titleFa,
      dateISO: latest.date ? latest.date.toISOString() : null,
      actual: latest.actual,
      forecast: latest.forecast,
    };
    if (sur.length < 6) {
      return {
        ...base,
        surpriseZ: null,
        n: sur.length,
        note: `نمونه غافلگیری تاریخی کافی نیست (${sur.length} از حداقل ۶) — Surprise Z حدس زده نمی‌شود.`,
      };
    }
    let s = 0;
    for (const v of sur) s += v;
    const m = s / sur.length;
    let ss = 0;
    for (const v of sur) ss += (v - m) * (v - m);
    const std = Math.sqrt(ss / sur.length);
    if (!(std > 1e-12)) {
      return {
        ...base,
        surpriseZ: null,
        n: sur.length,
        note: "پراکندگی غافلگیری‌های تاریخی صفر است — Surprise Z تعریف‌پذیر نیست.",
      };
    }
    return {
      ...base,
      surpriseZ: Math.round((latestSur / std) * 100) / 100,
      n: sur.length,
      note: `Surprise Z = (واقعی − انتظار) ÷ انحراف معیار ${sur.length} غافلگیری تاریخی همان عنوان (۱۸۰ روز). β رگرسیونی برای خبرها با نمونه فعلی قابل برآورد نیست → Pressure «نامشخص» و خارج از امتیاز تجمیعی.`,
    };
  } catch {
    return null;
  }
}

/* ---------- محاسبه اصلی ---------- */

async function computeFactors(symbolKey: "xau" | "dji"): Promise<FactorQuantResponse> {
  const defs = FACTORS[symbolKey];
  const yahooSym = symbolKey === "xau" ? "GC=F" : "^DJI";

  const [symRaw, ...facRaw] = await Promise.all([
    fetchDaily(yahooSym),
    ...defs.map((d) => fetchDaily(d.yahoo)),
  ]);

  /* مقیاس TNX: اگر سری ×۱۰ باشد (میانه >۲۰) تقسیم بر ۱۰ تا واحد «واحد درصد بازده» درست شود */
  const scaled: Candle[][] = facRaw.map((ser, i) => {
    if (defs[i].unit !== "pp") return ser;
    const sorted = [...ser.map((c) => c.c)].sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    if (med > 20) return ser.map((c) => ({ t: c.t, c: c.c / 10 }));
    return ser;
  });

  const symPts: DatePoint[] = symRaw.map((c) => ({ t: c.t, c: c.c }));
  const rows: FactorRow[] = [];

  for (let i = 0; i < defs.length; i++) {
    const def = defs[i];
    const ser = scaled[i];
    const mode = def.unit === "pct" ? "pct" : "delta";
    const facPts: DatePoint[] = ser.map((c) => ({ t: c.t, c: c.c }));

    const p1 = horizonPairs(symPts, facPts, 1, mode);
    const p5 = horizonPairs(symPts, facPts, 5, mode);
    const p20 = horizonPairs(symPts, facPts, 20, mode);
    const b1 = olsNW(p1.x, p1.y, 0);
    const b5 = olsNW(p5.x, p5.y, 4);
    const b20 = olsNW(p20.x, p20.y, 19);
    const split = splitHalfAgree(p5.x, p5.y);

    const levelSeries = ser.map((c) => c.c);
    const current = ser.length ? ser[ser.length - 1].c : null;
    const z = current !== null ? zScore(current, levelSeries) : null;
    const pctile = current !== null ? percentileOf(current, levelSeries) : null;
    const change5 = p5.x.length ? Math.round(p5.x[p5.x.length - 1] * 100) / 100 : null;
    const ms5 = meanStd(p5.x);

    const reliable5 = b5 !== null && b5.n >= 60 && Math.abs(b5.t) >= 2;
    let unreliableReason: string | null = null;
    if (b5 === null) unreliableReason = "نمونه کافی نیست — β برآورد نشد.";
    else if (b5.n < 60) unreliableReason = `نمونه کافی نیست (${b5.n} مشاهده — کمتر از ۶۰).`;
    else if (Math.abs(b5.t) < 2) unreliableReason = `از نظر آماری معنادار نیست (|t|=${b5.t} < ۲) — عدد اثر قابل اتکا نیست.`;

    /* ثبات علامت: نسبت افق‌های معنادار هم‌علامت با β5 */
    let signConsistency = 1;
    if (b5) {
      const others = [b1, b20].filter((b): b is BetaOut => b !== null && b.n >= 60 && Math.abs(b.t) >= 2);
      if (others.length > 0) {
        const match = others.filter((b) => Math.sign(b.beta) === Math.sign(b5.beta)).length / others.length;
        signConsistency = match === 1 ? 1 : match === 0 ? 0.3 : 0.6;
      }
    }

    const rel = reliable5 && b5 ? reliability({ n: b5.n, t: b5.t, signConsistency, splitAgree: split, freshness: 1 }) : null;
    const press = reliable5 && b5 && z !== null && rel !== null ? pressureOf(b5.beta, z, rel) : null;

    const effect = effectOf(b1, b5, b20, z, change5, ms5 ? ms5.std : null);

    let interpFa: string | null = null;
    if (b5 && reliable5) {
      const unitTxt = def.unit === "pct" ? "۱٪ تغییر" : def.unit === "pp" ? "۱ واحد درصد تغییر" : "۱ امتیاز تغییر";
      interpFa = `در نمونه ${b5.n} روزه، ${unitTxt} در ${def.nameFa} به‌طور متوسط با ${b5.beta >= 0 ? "+" : ""}${b5.beta}٪ تغییر در نماد طی افق ۵روزه همراه بوده است (فاصله اطمینان ۹۵٪: ${b5.ciLo} تا ${b5.ciHi}).`;
    }

    rows.push({
      id: def.id,
      nameFa: def.nameFa,
      roleFa: def.roleFa,
      sourceYahoo: def.yahoo,
      unitFa: def.unitFa,
      current: current !== null ? Math.round(current * 100) / 100 : null,
      currentZPctile: pctile,
      change5,
      z,
      beta: { h1: b1, h5: b5, h20: b20 },
      reliable5,
      unreliableReason,
      pressure: press,
      reliability: rel,
      effect,
      effectFa: EFFECT_FA[effect],
      w: def.w,
      interpFa,
    });
  }

  /* هم‌پوشانی عوامل: همبستگی تغییرات روزانه ۳۰روزه بین جفت عوامل */
  const overlaps: FactorQuantResponse["overlaps"] = [];
  const dayKey = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
  const mkChanges = (ser: Candle[], mode: "pct" | "delta") => {
    const m = new Map<string, number>();
    for (let k = 1; k < ser.length; k++) {
      const a = ser[k - 1].c;
      if (mode === "pct" && !(a > 0)) continue;
      m.set(dayKey(ser[k].t), mode === "pct" ? ((ser[k].c - a) / a) * 100 : ser[k].c - a);
    }
    return m;
  };
  for (let i = 0; i < defs.length; i++) {
    for (let j = i + 1; j < defs.length; j++) {
      const modeI = defs[i].unit === "pct" ? "pct" : "delta";
      const modeJ = defs[j].unit === "pct" ? "pct" : "delta";
      const mi = mkChanges(scaled[i], modeI);
      const mj = mkChanges(scaled[j], modeJ);
      const keys = [...mi.keys()].sort().slice(-31);
      const a: number[] = [];
      const b: number[] = [];
      for (const k of keys) {
        const vj = mj.get(k);
        if (vj === undefined) continue;
        a.push(mi.get(k)!);
        b.push(vj);
      }
      const r = pearson(a, b);
      if (r !== null && Math.abs(r) > 0.6) {
        const rr = Math.round(r * 100) / 100;
        overlaps.push({
          a: defs[i].nameFa,
          b: defs[j].nameFa,
          r: rr,
          combinedW: Math.round((defs[i].w + defs[j].w) * 100) / 100,
          note: `این دو عامل هم‌پوشان‌اند (همبستگی ۳۰روزه ${rr}) — وزن ترکیبی ${Math.round((defs[i].w + defs[j].w) * 100)}٪ است؛ در تفسیر امتیاز، اثرشان بیش از یک عامل مستقل حساب می‌شود.`,
        });
      }
    }
  }

  /* امتیاز تجمیعی با وزن‌های پیش‌فرض (کاربر می‌تواند در UI تغییر دهد) */
  const used = rows
    .filter((r) => r.pressure !== null)
    .map((r) => ({ id: r.id, nameFa: r.nameFa, w: r.w, p: r.pressure as number }));
  const skipped = rows
    .filter((r) => r.pressure === null)
    .map((r) => ({ id: r.id, nameFa: r.nameFa, reason: r.unreliableReason ?? "β قابل اتکا نیست" }));
  const score = compositeScore(used.map((u) => ({ id: u.id, w: u.w, p: u.p })));

  const surprise = await computeSurprise();

  return {
    ok: true,
    symbol: symbolKey,
    generatedAtISO: new Date().toISOString(),
    sample: {
      fromISO: symRaw.length ? new Date(symRaw[0].t * 1000).toISOString() : null,
      toISO: symRaw.length ? new Date(symRaw[symRaw.length - 1].t * 1000).toISOString() : null,
      bars: symRaw.length,
    },
    rows,
    surprise,
    composite: {
      score,
      label: compositeLabelFa(score),
      used,
      skipped,
    },
    overlaps,
    notes: [
      "β = تغییر درصدی نماد به‌ازای ۱ واحد تغییر عامل در همان افق — رابطه تاریخی/آماری است، نه اثر علّی.",
      "خطای استاندارد با تصحیح Newey-West محاسبه شده (نمونه‌های افق ۵ و ۲۰ روزه هم‌پوشان‌اند)؛ فاصله اطمینان ۹۵٪ تقریبی است.",
      "Z = (مقدار جاری − میانگین ۲۵۲روزه) ÷ انحراف معیار همان دوره.",
      "Pressure بر اساس «سطح غیرعادی» عامل (Z) است ولی ستون «اثر فعلی» بر اساس «جهت حرکت اخیر» عامل — این دو می‌توانند متفاوت باشند؛ مثلاً دلار در سطح بالای تاریخی (فشار نزولی بر طلا) ولی در ۵ روز اخیر در حال افت (حمایتی کوتاه‌مدت).",
      "Pressure = علامت β × Z × قابلیت اتکا — اگر β معنادار نباشد، عدد فشار حدس زده نمی‌شود و عامل با وزنِ بازتنظیم‌شده از امتیاز کنار گذاشته می‌شود.",
      "شاخص فشار مدل، احتمال صعود یا بازده مورد انتظار نیست و حرکت قیمت را تضمین نمی‌کند.",
    ],
    disclaimer:
      "این جدول کمّی‌سازی شفاف رابطه تاریخی عوامل با نماد است؛ برای تصمیم معامله به تنهایی کافی نیست و توصیه خرید/فروش محسوب نمی‌شود.",
  };
}

/* ---------- Route با کش ---------- */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbolKey = (url.searchParams.get("symbol") || "xau") as "xau" | "dji";
  const force = url.searchParams.get("force") === "1";
  if (!FACTORS[symbolKey]) {
    return NextResponse.json({ ok: false, error: "نماد پشتیبانی نمی‌شود" }, { status: 400 });
  }
  const cacheKey = `fq_cache_v1:${symbolKey}`;
  try {
    if (!force) {
      const cached = await getMeta(cacheKey);
      if (cached) {
        try {
          const obj = JSON.parse(cached) as FactorQuantResponse & { _cacheAt: number };
          if (obj._cacheAt && Date.now() - obj._cacheAt < TTL_MS) {
            return NextResponse.json({ ...obj, cached: true }, { headers: { "Cache-Control": "no-store" } });
          }
        } catch {
          /* کش نامعتبر */
        }
      }
    }
    const resp = await computeFactors(symbolKey);
    await setMeta(cacheKey, JSON.stringify({ ...resp, _cacheAt: Date.now() }));
    return NextResponse.json(resp, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[factor-quant] failed:", (err as Error).message);
    return NextResponse.json(
      { ok: false, error: "دریافت داده عوامل ناموفق بود — اتصال به Yahoo Finance را کمی بعد دوباره بررسی کنید." },
      { status: 502 }
    );
  }
}
