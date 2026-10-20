import { getMeta, setMeta } from "@/lib/ff";
import {
  yahooChart,
  aggregateCandles,
  symbolByKey,
  spotBasis,
  shiftPrice,
} from "@/lib/market-data";
import { h4PhaseSec } from "@/lib/scalp-engine";
import type {
  MarketStructureResponse,
  MSTrendChange,
  MSRow,
  MSSymbol,
  MSTimeframe,
  MSTrend,
} from "@/lib/types";

/**
 * موتور تحلیل ساختار بازار چند تایم‌فریمی
 * منبع داده: Yahoo Finance chart API
 *  - طلا: GC=F (فیوچرز COMEX — همبستگی نزدیک به یک با اسپات XAUUSD)
 *  - داو جونز: ^DJI
 * روش تعیین ساختار (ترکیبی، مطابق درخواست کاربر):
 *  ۱) میانگین متحرک نمایی: رابطه EMA20 و EMA50 + موقعیت قیمت نسبت به EMA50
 *  ۲) سقف و کف‌های سوئینگ: مقایسه ۳ سقف و ۳ کف آخر (HH/HL در برابر LH/LL)
 * امتیاز کل = امتیاز MA (±۲) + امتیاز سوئینگ (±۲) → صعودی (≥۲)، نزولی (≤−۲)، خنثی (بین این دو)
 * تایم‌فریم ۵ دقیقه صرفاً برای «پیشنهاد معامله» (ورود) استفاده می‌شود و در جدول ساختار نمایش داده نمی‌شود.
 */

const CACHE_KEY = "ms_cache_v2";
const FAIL_KEY = "ms_last_fail";
const TTL_MS = 15 * 60 * 1000; // بروزرسانی هر ۱۵ دقیقه (هم‌تراز با کوچک‌ترین تایم‌فریم)
const FAIL_BACKOFF_MS = 5 * 60 * 1000; // بعد از خطا ۵ دقیقه تلاش مجدد نکن
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

/* ---------- دریافت کندل از لایه داده واحد (market-data) ---------- */

/**
 * تنها مسیر دریافت کندل در این ماژول — پارس و منطق مشترک در market-data
 * انجام می‌شود و اینجا فقط نگاشت به نوع داخلی و اعتبارسنجی حداقل کندل است.
 */
async function fetchChart(
  symbol: string,
  interval: string,
  range: string
): Promise<FetchResult> {
  const { candles, price } = await yahooChart([symbol], interval, range);
  const mapped: Candle[] = candles.map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c }));
  if (mapped.length < MIN_BARS) throw new Error(`not enough bars: ${mapped.length}`);
  return { candles: mapped, price };
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
  { tf: "5m", fetchId: "5m", lookback: 3 },
  { tf: "15m", fetchId: "15m", lookback: 3 },
  { tf: "1h", fetchId: "1h", lookback: 3 },
  { tf: "4h", fetchId: "1h", lookback: 3, agg4h: true },
  { tf: "1d", fetchId: "1d", lookback: 3 },
  { tf: "1wk", fetchId: "1wk", lookback: 2 },
  { tf: "1mo", fetchId: "1mo", lookback: 2 },
];

const FETCH_SPECS = [
  { id: "5m", interval: "5m", range: "5d" },
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
  { key: "xau", yahoo: symbolByKey("xau")?.yahoo ?? ["GC=F", "XAUUSD=X"] },
  { key: "dji", yahoo: symbolByKey("dji")?.yahoo ?? ["^DJI", "YM=F"] },
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
        /* تجمیع ۴ساعته با همان مرز کندل بروکری (۱۷:۰۰ نیویورک) که پنل اسکلپ استفاده می‌کند */
        const candles = cfg.agg4h
          ? aggregateCandles(
              fetched.candles,
              4 * 3600,
              h4PhaseSec(Math.floor(Date.now() / 1000), symbolByKey(spec.key)?.h4Anchor ?? "utc")
            )
          : fetched.candles;
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

      /* کالیبراسیون اسپات — همان منبع پنل اسکلپ تا همه صفحات یک عدد ببینند */
      const def = symbolByKey(spec.key);
      if (def && price !== null) {
        const basis = await spotBasis(def, price);
        if (basis) price = shiftPrice(price, basis);
      }

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

/* ---------- تشخیص تغییر جهت روند (اعلان چشمک‌زن بالای صفحه) ---------- */

const SNAPSHOT_KEY = "ms_trend_snapshot_v1"; // جهت روند هر تایم‌فریم در آخرین محاسبه موفق
const CHANGES_KEY = "ms_trend_changes_v1"; // فهرست تغییرات اخیر
const CHANGE_WINDOW_MS = 6 * 60 * 60 * 1000; // تغییرات ۶ ساعت نگه داشته می‌شوند
const CHANGES_CAP = 30; // سقف تعداد رکوردها
/** فقط تایم‌فریم‌های ساختار — ۵ دقیقه مخصوص ورود است و نوسانش اعلان تولید می‌کرد */
const CHANGE_TFS: MSTimeframe[] = ["15m", "1h", "4h", "1d", "1wk", "1mo"];

interface TrendSnapshot {
  atISO: string;
  xau: Partial<Record<MSTimeframe, MSTrend>>;
  dji: Partial<Record<MSTimeframe, MSTrend>>;
}

function extractTrends(resp: MarketStructureResponse): TrendSnapshot {
  const pick = (sym: MSSymbol | null): Partial<Record<MSTimeframe, MSTrend>> => {
    const out: Partial<Record<MSTimeframe, MSTrend>> = {};
    for (const row of sym?.rows ?? []) {
      if (row.trend) out[row.tf] = row.trend;
    }
    return out;
  };
  return { atISO: resp.updatedAtISO ?? new Date().toISOString(), xau: pick(resp.xau), dji: pick(resp.dji) };
}

function diffTrends(prev: TrendSnapshot, next: TrendSnapshot): MSTrendChange[] {
  const changes: MSTrendChange[] = [];
  for (const sym of ["xau", "dji"] as const) {
    for (const tf of CHANGE_TFS) {
      const from = prev[sym][tf];
      const to = next[sym][tf];
      // فقط تغییر واقعی جهت (هر دو طرف موجود و متفاوت) — ظاهر شدن از «ناکافی» تغییر جهت نیست
      if (from && to && from !== to) {
        changes.push({ symbol: sym, tf, from, to, atISO: next.atISO });
      }
    }
  }
  return changes;
}

function isTrendChangeArray(v: unknown): v is MSTrendChange[] {
  return (
    Array.isArray(v) &&
    v.every(
      (c) =>
        c &&
        typeof c === "object" &&
        ((c as MSTrendChange).symbol === "xau" || (c as MSTrendChange).symbol === "dji") &&
        typeof (c as MSTrendChange).tf === "string" &&
        typeof (c as MSTrendChange).from === "string" &&
        typeof (c as MSTrendChange).to === "string" &&
        typeof (c as MSTrendChange).atISO === "string"
    )
  );
}

/** خواندن تغییرات اخیر + حذف موارد خارج از پنجره ۶ ساعته + مرتب‌سازی نزولی زمان */
async function readChanges(): Promise<MSTrendChange[]> {
  try {
    const raw = await getMeta(CHANGES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isTrendChangeArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .filter((c) => now - new Date(c.atISO).getTime() < CHANGE_WINDOW_MS)
      .sort((a, b) => new Date(b.atISO).getTime() - new Date(a.atISO).getTime())
      .slice(0, CHANGES_CAP);
  } catch {
    return [];
  }
}

async function safeParseSnapshot(raw: string | null): Promise<TrendSnapshot | null> {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as TrendSnapshot;
    if (!obj || typeof obj !== "object" || !("xau" in obj) || !("dji" in obj)) return null;
    return obj;
  } catch {
    return null;
  }
}

/**
 * مقایسه نتیجه تازه با اسنپ‌شات قبلی؛ تغییرهای جهت واقعی را ثبت و فهرست به‌روزشده را برمی‌گرداند.
 * در اولین اجرا (بدون اسنپ‌شات) فقط مبنا ذخیره می‌شود و تغییری اعلام نمی‌شود.
 */
async function recordTrendChanges(fresh: MarketStructureResponse): Promise<MSTrendChange[]> {
  const next = extractTrends(fresh);
  const prev = await safeParseSnapshot(await getMeta(SNAPSHOT_KEY));
  let changes = await readChanges();
  if (prev) {
    const freshChanges = diffTrends(prev, next);
    if (freshChanges.length > 0) changes = [...freshChanges, ...changes];
  }
  changes = changes
    .filter((c) => Date.now() - new Date(c.atISO).getTime() < CHANGE_WINDOW_MS)
    .sort((a, b) => new Date(b.atISO).getTime() - new Date(a.atISO).getTime())
    .slice(0, CHANGES_CAP);
  await setMeta(SNAPSHOT_KEY, JSON.stringify(next));
  await setMeta(CHANGES_KEY, JSON.stringify(changes));
  return changes;
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
 * در همه مسیرها فهرست «تغییرات اخیر جهت روند» نیز ضمیمه می‌شود (برای اعلان چشمک‌زن).
 */
export async function getMarketStructure(force = false): Promise<MarketStructureResponse> {
  return runExclusive(msLock, async () => {
    const cached = safeParseCache(await getMeta(CACHE_KEY));
    const now = Date.now();

    if (!force && cached?.updatedAtISO) {
      const age = now - new Date(cached.updatedAtISO).getTime();
      if (age < TTL_MS) {
        return { ...cached, status: "cached", changes: await readChanges() };
      }
    }

    const lastFail = Number((await getMeta(FAIL_KEY)) || 0);
    if (!force && cached && now - lastFail < FAIL_BACKOFF_MS) {
      return { ...cached, status: "stale", changes: await readChanges() };
    }

    try {
      const fresh = await computeAll();
      const changes = await recordTrendChanges(fresh);
      const withChanges = { ...fresh, changes };
      await setMeta(CACHE_KEY, JSON.stringify(withChanges));
      return withChanges;
    } catch (err) {
      console.error("[ms] compute failed:", (err as Error).message);
      await setMeta(FAIL_KEY, String(now));
      if (cached) return { ...cached, status: "stale", changes: await readChanges() };
      return {
        status: "error",
        updatedAtISO: null,
        xau: null,
        dji: null,
        changes: await readChanges(),
      };
    }
  });
}
