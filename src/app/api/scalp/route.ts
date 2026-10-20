import { NextResponse } from "next/server";
import { getMeta, setMeta } from "@/lib/ff";
import { rangeCompression } from "@/lib/trader-engine";
import { runScalpEngine, h4PhaseSec, type ScalpBar, type H4Anchor } from "@/lib/scalp-engine";
import { SYMBOL_REGISTRY, yahooChart, aggregateCandles, getSpot } from "@/lib/market-data";

export const dynamic = "force-dynamic";

/**
 * API اسکلپ — پورت اندیکاتور کاربر (SBW + OB + ستاپ ۴ساعته + واگرایی)
 * ورودی: نماد + تایم‌فریم اسکلپ (۱/۵/۱۵ دقیقه) → کندل‌های لایه واحد market-data + تجمیع ۴ساعته
 * کش ۳ دقیقه‌ای؛ خروجی اطلاع‌رسانی است، نه سیگنال قطعی.
 */

const TTL_MS = 3 * 60 * 1000;
const MIN_BARS = 80;

/* پیکربندی نمادها از رجیستری واحد market-data — همان منبع همه صفحات */
const SCALP_SYMBOLS: Record<string, { yahoo: string[]; label: string; mono: string; anchor?: H4Anchor; spot?: { url: string; sym: string } }> =
  Object.fromEntries(
    Object.values(SYMBOL_REGISTRY).map((d) => [
      d.key,
      {
        yahoo: d.yahoo,
        label: d.labelFa,
        mono: d.mono,
        anchor: (d.h4Anchor ?? "utc") as H4Anchor,
        ...(d.spot ? { spot: d.spot } : {}),
      },
    ])
  );

const TF_SEC: Record<string, number> = { "1m": 60, "5m": 300, "15m": 900 };

const SCALP_TFS: Record<string, { interval: string; range: string; label: string }> = {
  "1m": { interval: "1m", range: "2d", label: "۱ دقیقه" },
  "5m": { interval: "5m", range: "5d", label: "۵ دقیقه" },
  "15m": { interval: "15m", range: "1mo", label: "۱۵ دقیقه" },
};

/** دریافت کندل از لایه داده واحد (market-data) — تنها نقطه تماس با Yahoo */
async function fetchCandles(symbol: string, interval: string, range: string): Promise<ScalpBar[]> {
  const { candles } = await yahooChart([symbol], interval, range);
  const bars: ScalpBar[] = candles.map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c }));
  if (bars.length < MIN_BARS) throw new Error(`not enough bars: ${bars.length}`);
  return bars;
}

/* قیمت لحظه‌ای اسپات از gold-api — از لایه واحد (همان منبع همه صفحات) */
async function fetchSpot(url: string): Promise<number | null> {
  return getSpot({ url, sym: url.split("/price/")[1] ?? url });
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
  /* پنجرهٔ کندل ملاک هم باید روی بیس اسپات باشد */
  const ref = e.h4Ref as { high: number; low: number } | null | undefined;
  if (ref && typeof ref.high === "number" && typeof ref.low === "number") {
    ref.high = sh(ref.high) as number;
    ref.low = sh(ref.low) as number;
  }
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

async function computeScalp(symbol: string, tf: string, anchor: H4Anchor): Promise<ScalpCache> {
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

  const nowSec = Math.floor(Date.now() / 1000);
  const phase = h4PhaseSec(nowSec, anchor);

  let h4: ScalpBar[] | null = null;
  try {
    const raw1h = await fetchCandles(symSpec.yahoo[0], "1h", "3mo");
    h4 = aggregateCandles(raw1h, 4 * 3600, phase);
  } catch {
    h4 = null;
  }

  const engine = runScalpEngine(bars, h4, tfSpec.label, { nowSec, anchor });
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
      anchor,
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
  const anchorParam = (url.searchParams.get("anchor") ?? "").toLowerCase();
  const anchor: H4Anchor = anchorParam === "utc" || anchorParam === "broker" ? anchorParam : (SCALP_SYMBOLS[symbol]?.anchor ?? "broker");
  const force = url.searchParams.get("force") === "1";
  const key = `scalp_v2:${symbol}:${tf}:${anchor}`;

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
    const out = await computeScalp(symbol, tf, anchor);
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
