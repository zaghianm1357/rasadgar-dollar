import { getMeta, setMeta } from "@/lib/ff";
import type { MarketStructureResponse, MSRow, MSSymbol, MSTimeframe, MSTrend } from "@/lib/types";

/**
 * موتور تحلیل ساختار بازار چند تایم‌فریمی
 * منبع داده: Yahoo Finance chart API
 *  - طلا: GC=F (فیوچرز COMEX — همبستگی نزدیک به یک با اسپات XAUUSD)
 *  - داو جونز: ^DJI
 * روش تعیین ساختار (ترکیبی، مطابق درخواست کاربر):
 *  ۱) میانگین متحرک نمایی: رابطه EMA20 و EMA50 + موقعیت قیمت نسبت به EMA50
 *  ۲) سقف و کف‌های سوئینگ: مقایسه ۳ سقف و ۳ کف آخر (HH/HL در برابر LH/LL)
 * امتیاز کل = امتیاز MA (±۲) + امتیاز سوئینگ (±۲) → صعودی (≥۲)، نزولی (≤−۲)، خنثی (بین این دو)
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CACHE_KEY = "ms_cache_v1";
const FAIL_KEY = "ms_last_fail";
const TTL_MS = 15 * 60 * 1000; // بروزرسانی هر ۱۵ دقیقه (هم‌تراز با کوچک‌ترین تایم‌فریم)
const FAIL_BACKOFF_MS = 5 * 60 * 1000; // بعد از خطا ۵ دقیقه تلاش مجدد نکن
const FETCH_TIMEOUT_MS = 15_000;
const MIN_BARS = 60; // حداقل کندل برای EMA50 معتبر + سوئینگ‌ها

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

interface FetchResult {
  candles: Candle[];
  price: number | null;
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta?: { regularMarketPrice?: number };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
        }>;
      };
    }> | null;
  };
}

/* ---------- دریافت کندل‌ها از Yahoo ---------- */

function num(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

async function fetchChart(
  symbol: string,
  interval: string,
  range: string
): Promise<FetchResult> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=${interval}&range=${range}&includePrePost=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = (await res.json()) as YahooChartResponse;
  const r = json.chart?.result?.[0];
  if (!r || !Array.isArray(r.timestamp) || r.timestamp.length === 0) {
    throw new Error("empty chart response");
  }
  const q = r.indicators?.quote?.[0] ?? {};
  const candles: Candle[] = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    const o = num(q.open?.[i]);
    const h = num(q.high?.[i]);
    const l = num(q.low?.[i]);
    const c = num(q.close?.[i]);
    if (o === null || h === null || l === null || c === null) continue;
    candles.push({ t: r.timestamp[i], o, h, l, c });
  }
  if (candles.length < MIN_BARS) throw new Error(`not enough bars: ${candles.length}`);

  return { candles, price: num(r.meta?.regularMarketPrice) };
}

/* ---------- تجمیع کندل ۱ ساعته به ۴ ساعته (تراز UTC) ---------- */

function aggregate4h(candles: Candle[]): Candle[] {
  const BUCKET = 4 * 3600;
  const map = new Map<number, Candle>();
  for (const c of candles) {
    const b = Math.floor(c.t / BUCKET) * BUCKET;
    const ex = map.get(b);
    if (!ex) {
      map.set(b, { t: b, o: c.o, h: c.h, l: c.l, c: c.c });
    } else {
      if (c.h > ex.h) ex.h = c.h;
      if (c.l < ex.l) ex.l = c.l;
      ex.c = c.c;
    }
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}

/* ---------- اندیکاتورها ---------- */

/** EMA با بذر SMA — مقدار آخر سری */
function emaLast(values: number[], period: number): number {
  if (values.length < period) return NaN;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
  }
  return prev;
}

/** تشخیص سقف/کف سوئینگ (فراکتال با lookback کندل در هر طرف) */
function findSwings(candles: Candle[], lookback: number): { highs: number[]; lows: number[] } {
  const highs: number[] = [];
  const lows: number[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j === i) continue;
      if (candles[j].h >= candles[i].h) isHigh = false;
      if (candles[j].l <= candles[i].l) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh) highs.push(candles[i].h);
    if (isLow) lows.push(candles[i].l);
  }
  return { highs, lows };
}

/** جهت آخرین گام‌های یک سری (حداکثر ۳ گام آخر: صعودی/نزولی/مخلوط) */
function seqDir(seq: number[]): -1 | 0 | 1 {
  if (seq.length < 2) return 0;
  const n = Math.min(3, seq.length - 1);
  let up = 0;
  let down = 0;
  for (let i = seq.length - n; i < seq.length; i++) {
    if (seq[i] > seq[i - 1]) up++;
    else if (seq[i] < seq[i - 1]) down++;
  }
  if (up > down) return 1;
  if (down > up) return -1;
  return 0;
}

function trendFromScore(score: number): MSTrend {
  return score > 0 ? "bullish" : score < 0 ? "bearish" : "neutral";
}

/* ---------- تحلیل یک تایم‌فریم ---------- */

function analyzeCandles(candles: Candle[], lookback: number): Omit<MSRow, "tf"> {
  const closes = candles.map((c) => c.c);
  const e20 = emaLast(closes, 20);
  const e50 = emaLast(closes, 50);
  const last = closes[closes.length - 1];

  // امتیاز میانگین متحرک: EMA20 نسبت به EMA50 + قیمت نسبت به EMA50 → بازه ±۲
  let maScore = 0;
  if (isFinite(e20) && isFinite(e50)) {
    maScore += e20 > e50 ? 1 : e20 < e50 ? -1 : 0;
    maScore += last > e50 ? 1 : last < e50 ? -1 : 0;
  }

  // امتیاز سوئینگ: جهت سقف‌ها + جهت کف‌ها → بازه ±۲
  const { highs, lows } = findSwings(candles, lookback);
  const swingScore = seqDir(highs) + seqDir(lows);

  const total = maScore + swingScore; // بازه ±۴
  const trend: MSTrend | null =
    maScore === 0 && swingScore === 0 && highs.length < 2
      ? "neutral"
      : total >= 2
        ? "bullish"
        : total <= -2
          ? "bearish"
          : "neutral";

  return {
    trend,
    strength: Math.round((Math.abs(total) / 4) * 100),
    ma: isFinite(e20) && isFinite(e50) ? trendFromScore(maScore) : null,
    swing: highs.length >= 2 && lows.length >= 2 ? trendFromScore(swingScore) : null,
    bars: candles.length,
  };
}

/* ---------- پیکربندی تایم‌فریم‌ها ---------- */

interface TFConfig {
  tf: MSTimeframe;
  fetchId: string;
  lookback: number;
  agg4h?: boolean;
}

const TF_CONFIGS: TFConfig[] = [
  { tf: "15m", fetchId: "15m", lookback: 3 },
  { tf: "1h", fetchId: "1h", lookback: 3 },
  { tf: "4h", fetchId: "1h", lookback: 3, agg4h: true },
  { tf: "1d", fetchId: "1d", lookback: 3 },
  { tf: "1wk", fetchId: "1wk", lookback: 2 },
  { tf: "1mo", fetchId: "1mo", lookback: 2 },
];

const FETCH_SPECS = [
  { id: "15m", interval: "15m", range: "5d" },
  { id: "1h", interval: "1h", range: "3mo" },
  { id: "1d", interval: "1d", range: "1y" },
  { id: "1wk", interval: "1wk", range: "5y" },
  { id: "1mo", interval: "1mo", range: "10y" },
] as const;

interface SymbolSpec {
  key: "xau" | "dji";
  /** نمادهای یدکی به ترتیب — اولی که کار کند استفاده می‌شود */
  yahoo: string[];
}

const SYMBOLS: SymbolSpec[] = [
  { key: "xau", yahoo: ["GC=F", "XAUUSD=X"] },
  { key: "dji", yahoo: ["^DJI", "DJIA"] },
];

/* ---------- تحلیل یک نماد در همه تایم‌فریم‌ها ---------- */

async function analyzeSymbol(spec: SymbolSpec): Promise<MSSymbol | null> {
  for (const yahooSymbol of spec.yahoo) {
    try {
      const results = await Promise.allSettled(
        FETCH_SPECS.map((s) => fetchChart(yahooSymbol, s.interval, s.range))
      );
      const data = new Map<string, FetchResult>();
      results.forEach((r, i) => {
        if (r.status === "fulfilled") data.set(FETCH_SPECS[i].id, r.value);
      });
      if (data.size === 0) throw new Error("all timeframe fetches failed");

      // قیمت لحظه‌ای و بسته‌شدن قبلی (از کندل‌های روزانه: کندل آخر = امروز، یکی مانده به آخر = دیروز)
      const d1 = data.get("1d");
      let price: number | null = null;
      let prevClose: number | null = null;
      if (d1 && d1.candles.length >= 2) {
        price = d1.price ?? d1.candles[d1.candles.length - 1].c;
        prevClose = d1.candles[d1.candles.length - 2].c;
      }

      const rows: MSRow[] = TF_CONFIGS.map((cfg) => {
        const fetched = data.get(cfg.fetchId);
        if (!fetched) {
          return { tf: cfg.tf, trend: null, strength: 0, ma: null, swing: null, bars: 0 };
        }
        const candles = cfg.agg4h ? aggregate4h(fetched.candles) : fetched.candles;
        if (candles.length < MIN_BARS) {
          return { tf: cfg.tf, trend: null, strength: 0, ma: null, swing: null, bars: candles.length };
        }
        return { tf: cfg.tf, ...analyzeCandles(candles, cfg.lookback) };
      });

      const okCount = rows.filter((r) => r.trend !== null).length;
      if (okCount < 3) throw new Error(`only ${okCount} timeframes available`);

      const changePct =
        price !== null && prevClose !== null && prevClose !== 0
          ? ((price - prevClose) / prevClose) * 100
          : null;

      return { key: spec.key, price, prevClose, changePct, rows, okCount };
    } catch (err) {
      console.error(
        `[ms] symbol ${spec.key} via ${yahooSymbol} failed:`,
        (err as Error).message
      );
      // نماد بعدی را امتحان کن
    }
  }
  return null;
}

/* ---------- کش و قفل ---------- */

const msLock: { current: Promise<unknown> } = { current: Promise.resolve() };

function runExclusive<T>(lock: { current: Promise<unknown> }, fn: () => Promise<T>): Promise<T> {
  const p = lock.current.then(fn, fn);
  lock.current = p.catch(() => undefined);
  return p;
}

function safeParseCache(raw: string | null): MarketStructureResponse | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as MarketStructureResponse;
    if (!obj || typeof obj !== "object" || !("xau" in obj) || !("dji" in obj)) return null;
    return obj;
  } catch {
    return null;
  }
}

async function computeAll(): Promise<MarketStructureResponse> {
  const [xau, dji] = await Promise.all([analyzeSymbol(SYMBOLS[0]), analyzeSymbol(SYMBOLS[1])]);
  if (!xau && !dji) throw new Error("both symbols unavailable");
  return {
    status: "live",
    updatedAtISO: new Date().toISOString(),
    xau,
    dji,
  };
}

/**
 * نقطه ورود اصلی — با کش ۱۵ دقیقه‌ای در دیتابیس، backoff خطا و fallback به داده قدیمی‌تر.
 */
export async function getMarketStructure(force = false): Promise<MarketStructureResponse> {
  return runExclusive(msLock, async () => {
    const cached = safeParseCache(await getMeta(CACHE_KEY));
    const now = Date.now();

    if (!force && cached?.updatedAtISO) {
      const age = now - new Date(cached.updatedAtISO).getTime();
      if (age < TTL_MS) return { ...cached, status: "cached" };
    }

    const lastFail = Number((await getMeta(FAIL_KEY)) || 0);
    if (!force && cached && now - lastFail < FAIL_BACKOFF_MS) {
      return { ...cached, status: "stale" };
    }

    try {
      const fresh = await computeAll();
      await setMeta(CACHE_KEY, JSON.stringify(fresh));
      return fresh;
    } catch (err) {
      console.error("[ms] compute failed:", (err as Error).message);
      await setMeta(FAIL_KEY, String(now));
      if (cached) return { ...cached, status: "stale" };
      return { status: "error", updatedAtISO: null, xau: null, dji: null };
    }
  });
}
