/**
 * لایه داده واحد — تک‌منبع همه داده‌های قیمتی ابزار رصدگر دلار
 * ------------------------------------------------------------------
 * هر صفحه، هر ویجت، هر موتور تحلیل (ساختار بازار، دستیار معامله‌گر،
 * دماسنج فشار، تحلیل هوشمند و اسکلپ) باید داده خود را فقط از همین
 * ماژول بگیرد. هیچ route یا lib دیگری نباید مستقیماً به Yahoo تماس بزند.
 *
 * اجزای این لایه:
 *  ۱) SYMBOL_REGISTRY — تنها تعریف نمادها در کل پروژه (برچسب فارسی،
 *     نماد TradingView، زنجیره تیکرهای Yahoo، منبع اسپات برای کالیبراسیون)
 *  ۲) yahooChart — تنها نقطه تماس سرور با Yahoo Finance (دریافت + پارس کندل)
 *  ۳) aggregateCandles — تجمیع کندل (۴ساعته و ...) با فاز قابل تنظیم
 *  ۴) getSpot / spotBasis — قیمت لحظه‌ای اسپات (gold-api) و اختلاف آتی↔اسپات
 *     تا همه صفحات «یک عدد» نشان دهند، نه قیمت‌های پراکنده فیوچرز
 *  ۵) memCache — کش درون‌حافظه‌ای ساده با TTL برای تماس‌های پرتکرار
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 15_000;

/* ---------- ۱) رجیستری نمادها — تنها تعریف نماد در کل پروژه ---------- */

export interface SpotSource {
  url: string;
  sym: string;
}

export interface SymbolDef {
  key: string;
  /** برچسب فارسی نمایشی */
  labelFa: string;
  /** برچسب کوتاه فارسی برای فضاهای تنگ (تیتر تحلیل و ...) */
  shortFa: string;
  mono: string;
  /** نماد TradingView برای ویجت چارت */
  tv: string;
  /** زنجیره تیکر Yahoo — اولی اصلی، بقیه جایگزین در صورت خطا */
  yahoo: string[];
  /** عوامل کلان مرتبط (DXY/US10Y/...) برای ماژول‌های تحلیلی */
  factorYahoo?: string[];
  /** منبع قیمت اسپات برای کالیبراسیون آتی↔اسپات (طلا/نقره) */
  spot?: SpotSource;
  /** مرز کندل ۴ساعته: مثل چارت بروکر (۱۷:۰۰ نیویورک) یا UTC */
  h4Anchor?: "broker" | "utc";
}

export const SYMBOL_REGISTRY: Record<string, SymbolDef> = {
  xau: {
    key: "xau",
    labelFa: "طلا (اونس) — XAUUSD",
    shortFa: "طلا (XAUUSD)",
    mono: "XAUUSD",
    tv: "OANDA:XAUUSD",
    yahoo: ["GC=F", "XAUUSD=X"],
    factorYahoo: ["DX-Y.NYB", "^TNX", "^GSPC"],
    spot: { url: "https://api.gold-api.com/price/XAU", sym: "XAU" },
    h4Anchor: "broker",
  },
  xag: {
    key: "xag",
    labelFa: "نقره — XAGUSD",
    shortFa: "نقره (XAGUSD)",
    mono: "XAGUSD",
    tv: "OANDA:XAGUSD",
    yahoo: ["SI=F"],
    factorYahoo: ["DX-Y.NYB"],
    spot: { url: "https://api.gold-api.com/price/XAG", sym: "XAG" },
    h4Anchor: "broker",
  },
  dji: {
    key: "dji",
    labelFa: "داوجونز — DJI",
    shortFa: "داوجونز (DJI)",
    mono: "DJI · ^DJI",
    tv: "DJ:DJI",
    yahoo: ["^DJI", "YM=F"],
    factorYahoo: ["^TNX", "^VIX", "DX-Y.NYB"],
    h4Anchor: "broker",
  },
  eurusd: {
    key: "eurusd",
    labelFa: "یورو/دلار — EURUSD",
    shortFa: "یورو/دلار (EURUSD)",
    mono: "EURUSD",
    tv: "OANDA:EURUSD",
    yahoo: ["EURUSD=X"],
    factorYahoo: ["DX-Y.NYB"],
    h4Anchor: "broker",
  },
  btc: {
    key: "btc",
    labelFa: "بیت‌کوین — BTC",
    shortFa: "بیت‌کوین (BTCUSDT)",
    mono: "BTCUSDT · BTC-USD",
    tv: "BINANCE:BTCUSDT",
    yahoo: ["BTC-USD"],
    h4Anchor: "utc",
  },
};

/** نگارش معکوس: نماد TradingView → کلید رجیستری */
const TV_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.values(SYMBOL_REGISTRY).map((s) => [s.tv, s.key])
);

export function symbolByKey(key: string): SymbolDef | null {
  return SYMBOL_REGISTRY[key] ?? null;
}

export function symbolByTv(tv: string): SymbolDef | null {
  const k = TV_TO_KEY[tv];
  return k ? SYMBOL_REGISTRY[k] : null;
}

/* ---------- ۲) دریافت کندل — تنها نقطه تماس با Yahoo ---------- */

export interface UCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  /** حجم معاملات — ممکن است موجود نباشد (شماری از نمادها/بازارها) */
  v: number | null;
}

export interface ChartFetch {
  candles: UCandle[];
  /** آخرین قیمت معتبر از متادیتای Yahoo (لحظه‌ای) */
  price: number | null;
  /** تیکری که واقعاً استفاده شد */
  tickerUsed: string;
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
          volume?: (number | null)[];
        }>;
      };
    }> | null;
  };
}

function num(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

async function fetchOneTicker(
  ticker: string,
  interval: string,
  range: string
): Promise<ChartFetch> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?interval=${interval}&range=${range}&includePrePost=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as YahooChartResponse;
  const r = json.chart?.result?.[0];
  const ts = r?.timestamp;
  if (!r || !Array.isArray(ts) || ts.length === 0) throw new Error("empty chart response");
  const q = r.indicators?.quote?.[0] ?? {};
  const candles: UCandle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = num(q.open?.[i]);
    const h = num(q.high?.[i]);
    const l = num(q.low?.[i]);
    const c = num(q.close?.[i]);
    if (o === null || h === null || l === null || c === null) continue;
    candles.push({ t: ts[i], o, h, l, c, v: num(q.volume?.[i]) });
  }
  if (candles.length === 0) throw new Error("no valid bars");
  return { candles, price: num(r.meta?.regularMarketPrice), tickerUsed: ticker };
}

/**
 * دریافت کندل با پیمایش زنجیره تیکرها:
 * تیکر اصلی → در صورت خطا تیکرهای جایگزین تعریف‌شده در رجیستری.
 */
export async function yahooChart(
  symbol: string | string[],
  interval: string,
  range: string
): Promise<ChartFetch> {
  const chain = Array.isArray(symbol) ? symbol : [symbol];
  let lastErr: unknown = null;
  for (const ticker of chain) {
    try {
      return await fetchOneTicker(ticker, interval, range);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("all tickers failed");
}

/* ---------- ۳) تجمیع کندل (۴ساعته و ...) با فاز قابل تنظیم ---------- */

/**
 * تجمیع کندل‌های کوچک‌تر به باکت‌های زمانی بزرگ‌تر.
 * phase بر حسب ثانیه — برای مرز «بروکری» (۱۷:۰۰ نیویورک) محاسبه می‌شود؛
 * phase = 0 یعنی تراز UTC.
 */
export interface AggInputCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number | null;
}

export function aggregateCandles<T extends AggInputCandle>(
  candles: T[],
  bucketSec: number,
  phaseSec = 0
): T[] {
  const map = new Map<number, T>();
  for (const c of candles) {
    const idx = Math.floor((c.t - phaseSec) / bucketSec);
    const k = idx * bucketSec + phaseSec;
    const ex = map.get(k);
    if (!ex) {
      map.set(k, { ...c, t: k });
    } else {
      if (c.h > ex.h) ex.h = c.h;
      if (c.l < ex.l) ex.l = c.l;
      ex.c = c.c;
      if (c.v != null && ex.v != null) ex.v = ex.v + c.v;
    }
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}

/* ---------- ۴) اسپات و کالیبراسیون آتی↔اسپات ---------- */

interface SpotCacheEntry {
  at: number;
  price: number | null;
}

const SPOT_TTL_MS = 60_000;
const spotCache = new Map<string, SpotCacheEntry>();

/**
 * قیمت لحظه‌ای اسپات از gold-api (بدون کلید، CORS باز).
 * این «همان» منبعی است که پنل اسکلپ استفاده می‌کند — تا همه صفحات
 * یک عدد نشان دهند. خطا را قورت می‌دهد و null برمی‌گرداند.
 */
export async function getSpot(spot: SpotSource): Promise<number | null> {
  const hit = spotCache.get(spot.sym);
  if (hit && Date.now() - hit.at < SPOT_TTL_MS) return hit.price;
  let price: number | null = null;
  try {
    const res = await fetch(spot.url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (res.ok) {
      const j = (await res.json()) as { price?: number | string };
      const p = typeof j.price === "number" ? j.price : parseFloat(String(j.price));
      if (isFinite(p) && p > 0) price = p;
    }
  } catch {
    /* بی‌صدا — داده اسپات حیاتی نیست */
  }
  spotCache.set(spot.sym, { at: Date.now(), price });
  return price;
}

export interface SpotBasis {
  spot: number;
  futures: number;
  /** spot − futures → همه سطوح مطلق با همین مقدار جابه‌جا می‌شوند */
  delta: number;
}

/**
 * اختلاف آتی↔اسپات برای کالیبراسیون نمایش.
 * اگر اسپات در دسترس نباشد null — در این حالت هیچ صفحه‌ای نباید
 * عدد ساختگی نشان دهد؛ همان قیمت فیوچرز با برچسب شفاف نمایش داده می‌شود.
 */
export async function spotBasis(
  def: SymbolDef,
  futuresPrice: number | null
): Promise<SpotBasis | null> {
  if (!def.spot || futuresPrice === null || !(futuresPrice > 0)) return null;
  const spot = await getSpot(def.spot);
  if (spot === null || !(spot > 0)) return null;
  return { spot, futures: futuresPrice, delta: Math.round((spot - futuresPrice) * 100) / 100 };
}

/** جابه‌جایی یک سطح مطلق با اختلاف آتی↔اسپات */
export function shiftPrice(v: number, basis: SpotBasis | null): number {
  if (!basis) return v;
  return Math.round((v + basis.delta) * 100) / 100;
}

/* ---------- ۵) کش درون‌حافظه با TTL ---------- */

const memStore = new Map<string, { at: number; ttl: number; value: unknown }>();

/**
 * کش سبک برای داده‌های پرتکرار (اسپات، کندل مشترک و ...).
 * wrapper های سطح route برای خود payload نهایی کش سنگین‌تر (AppMeta) دارند.
 */
export function memCacheGet<T>(key: string): T | null {
  const e = memStore.get(key);
  if (!e) return null;
  if (Date.now() - e.at > e.ttl) {
    memStore.delete(key);
    return null;
  }
  return e.value as T;
}

export function memCacheSet<T>(key: string, value: T, ttlMs: number): void {
  memStore.set(key, { at: Date.now(), ttl: ttlMs, value });
}

/** اگر کش تازه بود برگردان؛ وگرنه fn را اجرا و نتیجه را کش کن */
export async function memCacheWrap<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const hit = memCacheGet<T>(key);
  if (hit !== null) return hit;
  const v = await fn();
  memCacheSet(key, v, ttlMs);
  return v;
}
