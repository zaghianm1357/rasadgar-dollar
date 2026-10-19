import { NextResponse } from "next/server";
import { getMeta, setMeta } from "@/lib/ff";
import { rangeCompression } from "@/lib/trader-engine";
import { runScalpEngine, type ScalpBar } from "@/lib/scalp-engine";

export const dynamic = "force-dynamic";

/**
 * API اسکلپ — پورت اندیکاتور کاربر (SBW + OB + ستاپ ۴ساعته + واگرایی)
 * ورودی: نماد + تایم‌فریم اسکلپ (۱/۵/۱۵ دقیقه) → کندل‌های Yahoo + تجمیع ۴ساعته
 * کش ۳ دقیقه‌ای؛ خروجی اطلاع‌رسانی است، نه سیگنال قطعی.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TTL_MS = 3 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const MIN_BARS = 80;

const SCALP_SYMBOLS: Record<string, { yahoo: string[]; label: string; mono: string; spot?: { url: string; sym: string } }> = {
  xau: {
    yahoo: ["GC=F"],
    label: "طلا (اونس) — XAUUSD",
    mono: "XAUUSD",
    /* کندل Yahoo = آتی GC=F؛ برای هم‌ترازی با اسپات، قیمت لحظه‌ای اسپات از gold-api کالیبره می‌شود */
    spot: { url: "https://api.gold-api.com/price/XAU", sym: "XAU" },
  },
  xag: {
    yahoo: ["SI=F"],
    label: "نقره — XAGUSD",
    mono: "XAGUSD",
    spot: { url: "https://api.gold-api.com/price/XAG", sym: "XAG" },
  },
  dji: { yahoo: ["^DJI", "YM=F"], label: "داوجونز — DJI", mono: "DJI · ^DJI" },
  eurusd: { yahoo: ["EURUSD=X"], label: "یورو/دلار — EURUSD", mono: "EURUSD" },
  btc: { yahoo: ["BTC-USD"], label: "بیت‌کوین — BTC", mono: "BTCUSDT · BTC-USD" },
};

const TF_SEC: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900 };

const SCALP_TFS: Record<string, { interval: string; range: string; label: string }> = {
  "1m": { interval: "1m", range: "2d", label: "۱ دقیقه" },
  "5m": { interval: "5m", range: "5d", label: "۵ دقیقه" },
  "15m": { interval: "15m", range: "1mo", label: "۱۵ دقیقه" },
};

function num(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

async function fetchCandles(symbol: string, interval: string, range: string): Promise<ScalpBar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=${interval}&range=${range}&includePrePost=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }> | null };
      }> | null;
    };
  };
  const r = json.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0] ?? {};
  const ts = r?.timestamp;
  if (!r || !Array.isArray(ts) || ts.length === 0) throw new Error("empty chart response");
  const bars: ScalpBar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = num(q.open?.[i]);
    const h = num(q.high?.[i]);
    const l = num(q.low?.[i]);
    const c = num(q.close?.[i]);
    if (o === null || h === null || l === null || c === null) continue;
    bars.push({ t: ts[i], o, h, l, c });
  }
  if (bars.length < MIN_BARS) throw new Error(`not enough bars: ${bars.length}`);
  return bars;
}

function aggregate4h(bars: ScalpBar[]): ScalpBar[] {
  const BUCKET = 4 * 3600;
  const map = new Map<number, ScalpBar>();
  for (const b of bars) {
    const k = Math.floor(b.t / BUCKET) * BUCKET;
    const ex = map.get(k);
    if (!ex) map.set(k, { t: k, o: b.o, h: b.h, l: b.l, c: b.c });
    else {
      if (b.h > ex.h) ex.h = b.h;
      if (b.l < ex.l) ex.l = b.l;
      ex.c = b.c;
    }
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}

/** قیمت لحظه‌ای اسپات از gold-api (بدون کلید، CORS باز) — برای کالیبراسیون آتی↔اسپات */
async function fetchSpot(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { price?: number | string };
    const p = typeof j.price === "number" ? j.price : parseFloat(String(j.price));
    return isFinite(p) && p > 0 ? p : null;
  } catch {
    return null;
  }
}

/** جای‌جایی همهٔ سطوح مطلق موتور با اختلاف آتی↔اسپات (شکل زون‌ها و ATR بدون تغییر) */
function shiftEngine(e: Record<string, unknown>, d: number): void {
  const sh = (v: unknown): unknown => (typeof v === "number" && isFinite(v) ? Math.round((v + d) * 100) / 100 : v);
  const shZone = (z: { lo: number; hi: number } | null) => (z ? { lo: sh(z.lo), hi: sh(z.hi) } : z);
  const shBars = (arr: unknown) =>
    Array.isArray(arr)
      ? arr.map((b) => {
          const o = b as Record<string, unknown>;
          /* سیگنال: price/zoneLo/zoneHi — زون: top/bot — کندل: o/h/l/c */
          if (typeof o.zoneLo === "number")
            return { ...o, price: sh(o.price), zoneLo: sh(o.zoneLo), zoneHi: sh(o.zoneHi) };
          if (typeof o.top === "number") return { ...o, top: sh(o.top), bot: sh(o.bot) };
          return { ...o, o: sh(o.o), h: sh(o.h), l: sh(o.l), c: sh(o.c) };
        })
      : arr;
  const sg = e.suggestion as Record<string, unknown> | null;
  if (sg) {
    sg.entryLo = sh(sg.entryLo);
    sg.entryHi = sh(sg.entryHi);
    sg.sl = sh(sg.sl);
    sg.tp1 = sh(sg.tp1);
    sg.tp2 = sh(sg.tp2);
  }
  e.lastClose = sh(e.lastClose);
  e.h4High = sh(e.h4High);
  e.h4Low = sh(e.h4Low);
  e.swingHigh = sh(e.swingHigh);
  e.swingLow = sh(e.swingLow);
  const setup = e.setup as Record<string, unknown> | undefined;
  if (setup) {
    setup.sellZone = shZone(setup.sellZone as { lo: number; hi: number } | null);
    setup.buyZone = shZone(setup.buyZone as { lo: number; hi: number } | null);
  }
  const wave = e.wave as Record<string, unknown> | undefined;
  if (wave) wave.retrLevel = sh(wave.retrLevel);
  e.supplyZones = shBars(e.supplyZones);
  e.demandZones = shBars(e.demandZones);
  e.signals = shBars(e.signals);
  /* فاصلهٔ سیگنال تا قیمت بعد از جابه‌جایی مجدداً محاسبه می‌شود */
  if (sg && typeof e.lastClose === "number" && typeof sg.entryLo === "number" && typeof sg.entryHi === "number") {
    const side = sg.side as string;
    const buy = side === "buy";
    const dist =
      e.lastClose >= sg.entryLo && e.lastClose <= sg.entryHi
        ? 0
        : buy
          ? e.lastClose < sg.entryLo
            ? sg.entryLo - e.lastClose
            : e.lastClose - sg.entryHi
          : e.lastClose > sg.entryHi
            ? e.lastClose - sg.entryHi
            : sg.entryLo - e.lastClose;
    sg.dist = Math.round(dist * 100) / 100;
    sg.distAtr = typeof e.atr === "number" && e.atr > 0 ? Math.round((dist / e.atr) * 100) / 100 : null;
  }
}

interface ScalpCache {
  generatedAtISO: string;
  payload: Record<string, unknown>;
}

async function computeScalp(symbol: string, tf: string): Promise<ScalpCache> {
  const symSpec = SCALP_SYMBOLS[symbol];
  const tfSpec = SCALP_TFS[tf];
  if (!symSpec || !tfSpec) throw new Error("unsupported symbol/tf");

  let bars: ScalpBar[] | null = null;
  let lastErr: Error | null = null;
  for (const y of symSpec.yahoo) {
    try {
      bars = await fetchCandles(y, tfSpec.interval, tfSpec.range);
      break;
    } catch (err) {
      lastErr = err as Error;
    }
  }
  if (!bars) throw new Error(`yahoo failed: ${lastErr?.message ?? "unknown"}`);

  let h4: ScalpBar[] | null = null;
  try {
    const raw1h = await fetchCandles(symSpec.yahoo[0], "1h", "3mo");
    h4 = aggregate4h(raw1h);
  } catch {
    h4 = null;
  }

  const engine = runScalpEngine(bars, h4, tfSpec.label);
  const range = rangeCompression(bars.map((b) => b.h), bars.map((b) => b.l), bars.map((b) => b.c));

  /* --- کالیبراسیون آتی↔اسپات: منشأ اصلی فاصلهٔ سطوح با چارت اسپات کاربر --- */
  let basisInfo: Record<string, unknown> | null = null;
  if (symSpec.spot) {
    const spot = await fetchSpot(symSpec.spot.url);
    const futures = engine.lastClose;
    if (spot !== null && isFinite(futures)) {
      const basis = Math.round((spot - futures) * 100) / 100;
      if (Math.abs(basis) > 0.01) shiftEngine(engine as unknown as Record<string, unknown>, basis);
      basisInfo = {
        applied: Math.abs(basis) > 0.01,
        spot,
        futures,
        basis,
        source: "gold-api.com",
        note: `کندل‌های منبع برای ${symSpec.spot.sym} از بازار آتی (Yahoo) است؛ همهٔ سطوح با اختلاف لحظه‌ای آتی↔اسپات (${basis > 0 ? "+" : ""}${basis} دلار) کالیبره شدند تا با چارت اسپات هم‌تراز باشند.`,
      };
    } else {
      basisInfo = {
        applied: false,
        futures,
        note: `کالیبراسیون اسپات انجام نشد (سرویس قیمت لحظه‌ای در دسترس نبود) — سطوح مستقیماً از بازار آتی هستند و با چارت اسپات اختلاف دارند (تاریخچهٔ معمول: حدود ۲۰ دلار برای طلا).`,
      };
    }
  }

  /* --- گیت تازگی داده: کندل آخر چه قدر قدیمی است؟ --- */
  const tfSec = TF_SEC[tf] ?? 300;
  const nowSec = Math.floor(Date.now() / 1000);
  const lastAgeSec = Math.max(0, nowSec - engine.lastT);
  const stale = lastAgeSec > Math.max(3 * tfSec, 900);
  const freshness = {
    lastAgeSec,
    stale,
    lastBarISO: new Date(engine.lastT * 1000).toISOString(),
    note: stale
      ? `آخرین کندل منبع ${Math.round(lastAgeSec / 60)} دقیقه پیش است — بازار ممکن است بسته باشد یا فید تأخیر/قطعی داشته باشد؛ تا بازشدن فید، سیگنال‌ها به‌روز نیستند.`
      : null,
  };

  return {
    generatedAtISO: new Date().toISOString(),
    payload: {
      ok: true,
      symbol,
      symbolLabel: symSpec.label,
      symbolMono: symSpec.mono,
      tf,
      tfLabel: tfSpec.label,
      engine: engine as unknown as Record<string, unknown>,
      rangeWarning: range,
      basis: basisInfo,
      freshness,
      feedNote: "کندل‌های اینترادی Yahoo ~۱۰ دقیقه تأخیر دارند؛ سطوح حدودی‌اند.",
    },
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") ?? "xau").toLowerCase();
  const tf = (url.searchParams.get("tf") ?? "5m").toLowerCase();
  const force = url.searchParams.get("force") === "1";
  const key = `scalp_v1:${symbol}:${tf}`;

  if (!force) {
    try {
      const raw = await getMeta(key);
      if (raw) {
        const obj = JSON.parse(raw) as ScalpCache;
        if (obj?.payload && Date.now() - new Date(obj.generatedAtISO).getTime() < TTL_MS) {
          return NextResponse.json({ ...obj.payload, generatedAtISO: obj.generatedAtISO, cached: true });
        }
      }
    } catch {
      /* کش در دسترس نیست — محاسبه تازه */
    }
  }

  try {
    const out = await computeScalp(symbol, tf);
    try {
      await setMeta(key, JSON.stringify(out));
    } catch {
      /* کش نشد — مهم نیست */
    }
    return NextResponse.json({ ...out.payload, generatedAtISO: out.generatedAtISO, cached: false });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `محاسبه اسکلپ ناموفق بود: ${(err as Error).message}` }, { status: 502 });
  }
}
