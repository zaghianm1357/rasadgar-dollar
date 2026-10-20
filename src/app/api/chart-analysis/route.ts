import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { getMeta, setMeta } from "@/lib/ff";
import { yahooChart, aggregateCandles, SYMBOL_REGISTRY } from "@/lib/market-data";
import { rangeCompression, entryZonesFromStructure } from "@/lib/trader-engine";
import type { EntryZoneOutput, RangeWarning } from "@/lib/trader-engine";

export const dynamic = "force-dynamic";

/**
 * تحلیل هوش مصنوعی چارت — بر اساس داده کندل همان نماد/تایم‌فریم از Yahoo Finance
 * (ویجت رایگان TradingView داده نمی‌دهد؛ همین نماد و همین تایم‌فریم از منبع داده دریافت می‌شود)
 * کش ۱۵ دقیقه‌ای در AppMeta برای جلوگیری از هزینه تکراری LLM.
 */

const TTL_MS = 15 * 60 * 1000;
const MIN_BARS = 60;

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

/* نگاشت نماد TradingView → زنجیره Yahoo — از رجیستری واحد market-data */
const SYMBOL_MAP: Record<string, { yahoo: string[]; label: string }> = Object.fromEntries(
  Object.values(SYMBOL_REGISTRY).map((d) => [d.tv, { yahoo: d.yahoo, label: d.shortFa }])
);

const INTERVAL_MAP: Record<string, { yahooInterval: string; range: string; agg4h?: boolean; label: string }> = {
  "5": { yahooInterval: "5m", range: "5d", label: "۵ دقیقه" },
  "15": { yahooInterval: "15m", range: "5d", label: "۱۵ دقیقه" },
  "60": { yahooInterval: "1h", range: "3mo", label: "۱ ساعته" },
  "240": { yahooInterval: "1h", range: "3mo", agg4h: true, label: "۴ ساعته" },
  D: { yahooInterval: "1d", range: "1y", label: "روزانه" },
};

/* ---------- دریافت کندل از لایه داده واحد (market-data) ---------- */

async function fetchChart(
  symbol: string,
  interval: string,
  range: string
): Promise<Candle[]> {
  const { candles } = await yahooChart([symbol], interval, range);
  const mapped = candles.map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c }));
  if (mapped.length < MIN_BARS) throw new Error(`not enough bars: ${mapped.length}`);
  return mapped;
}

/* ---------- اندیکاتورهای خلاصه ---------- */

function emaLast(values: number[], period: number): number {
  if (values.length < period) return NaN;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) prev = values[i] * k + prev * (1 - k);
  return prev;
}

function rsiLast(closes: number[], period = 14): number {
  if (closes.length < period + 1) return NaN;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  let ag = gain / period;
  let al = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

function atrLast(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return NaN;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i - 1].c),
      Math.abs(candles[i].l - candles[i - 1].c)
    );
    sum += tr;
  }
  return sum / period;
}

function findSwings(candles: Candle[], lookback = 2): { highs: number[]; lows: number[] } {
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

function roundPrice(v: number): number {
  if (!isFinite(v)) return 0;
  if (v >= 1) return Math.round(v * 100) / 100;
  return Math.round(v * 100000) / 100000;
}

/* ---------- پرامپت تحلیلگر ---------- */

const ANALYST_SYSTEM = `تو یک تحلیلگر حرفه‌ای بازارهای مالی هستی؛ متخصص پرایس اکشن، ساختار بازار و سبک SMC/ICT.
کاربر در ابزار یک چارت TradingView را می‌بیند و تو خلاصه اندیکاتورهای «همان نماد و همان تایم‌فریم» را از منبع داده دریافت می‌کنی.
یک تحلیل فنی فشرده، حرفه‌ای و مستقیم به زبان فارسی بنویس (حداکثر حدود ۲۰۰ کلمه) با دقیقاً این چهار خط و همین برچسب‌ها:

جمع‌بندی: (روند، ساختار و مومنتوم؛ در صورت صراحت از اصطلاح‌های انگلیسی BOS، CHoCH، OB، FVG، EQH/EQL استفاده کن)
سطوح کلیدی: مقاومت‌ها: ... | حمایت‌ها: ... (اعداد را فقط از داده بگیر و قیمت‌ها را رُند کن)
سناریوها: ادامه روند در صورت ... | شکست/تغییر جهت در صورت ...
ریسک: (یک جمله کوتاه)

قوانین: فقط از داده‌های داده‌شده استفاده کن؛ عدد از خودت نساز؛ اگر داده برای تحلیل قطعی کافی نیست صادقانه بگو. اصطلاح‌های تخصصی انگلیسی بازار (BOS، CHoCH، OB، FVG، EQH/EQL و نام نماد) را همان‌طور انگلیسی بنویس، ولی برای هر واژه دیگر فقط معادل فارسی بنویس — هیچ واژه‌ای از چینی، روسی، اسپانیایی یا سایر زبان‌ها ننویس. بدون markdown، بدون جدول، بدون فهرست گلوله‌ای و بدون سلام و تعارف. تحلیل تو اطلاع‌رسانی است، نه توصیه خرید/فروش — جمله توصیه صریح ننویس.

نمونه ساختار و زبان خروجی (اعداد فقط نمونه‌اند — تو از داده واقعی استفاده کن):
جمع‌بندی: روند صعودی کوتاه‌مدت؛ قیمت بالای EMA50 و ساختار HH/HL. مومنتوم مثبت (RSI=58).
سطوح کلیدی: مقاومت‌ها: 4208.4 | حمایت‌ها: 4193.2
سناریوها: ادامه روند در صورت تثبیت بالای 4208.4 | تغییر جهت در صورت شکست 4193.2
ریسک: نزدیک انتشار داده‌های مهم آمریکا، نوسان شدید محتمل است.`;

/* ---------- قفل و کش ---------- */

const aiLock: { current: Promise<unknown> } = { current: Promise.resolve() };

function runExclusive<T>(lock: { current: Promise<unknown> }, fn: () => Promise<T>): Promise<T> {
  const p = lock.current.then(fn, fn);
  lock.current = p.catch(() => undefined);
  return p;
}

interface AiCacheEntry {
  symbol: string;
  interval: string;
  analysis: string;
  generatedAtISO: string;
  price: number | null;
  /** نواحی ورود مبتنی بر ساختار — الگوریتمی و مستقل از LLM */
  zones: EntryZoneOutput | null;
  /** هشدار رنج فشرده در تایم‌فریم تحلیل‌شده */
  rangeWarning: RangeWarning | null;
}

function cacheKey(symbol: string, interval: string): string {
  return `chart_ai_v1:${symbol}:${interval}`;
}

async function readCache(key: string): Promise<AiCacheEntry | null> {
  try {
    const raw = await getMeta(key);
    if (!raw) return null;
    const obj = JSON.parse(raw) as AiCacheEntry;
    if (!obj || typeof obj.analysis !== "string" || !obj.analysis) return null;
    return { ...obj, zones: obj.zones ?? null, rangeWarning: obj.rangeWarning ?? null };
  } catch {
    return null;
  }
}

/* ---------- محاسبه خلاصه و تولید تحلیل ---------- */

async function computeAnalysis(symbol: string, interval: string): Promise<AiCacheEntry> {
  const symSpec = SYMBOL_MAP[symbol];
  const itvSpec = INTERVAL_MAP[interval];
  if (!symSpec || !itvSpec) throw new Error("unsupported symbol/interval");

  let candles: Candle[] | null = null;
  let lastErr: Error | null = null;
  for (const y of symSpec.yahoo) {
    try {
      const raw = await fetchChart(y, itvSpec.yahooInterval, itvSpec.range);
      candles = itvSpec.agg4h
        ? aggregateCandles(raw, 4 * 3600)
        : raw;
      break;
    } catch (err) {
      lastErr = err as Error;
    }
  }
  if (!candles) throw new Error(`yahoo failed: ${lastErr?.message ?? "unknown"}`);

  const closes = candles.map((c) => c.c);
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2] ?? last;
  const e20 = emaLast(closes, 20);
  const e50 = emaLast(closes, 50);
  const rsi = rsiLast(closes);
  const atr = atrLast(candles);
  const { highs, lows } = findSwings(candles);
  const recent = candles.slice(-20);
  const recentHigh = Math.max(...recent.map((c) => c.h));
  const recentLow = Math.min(...recent.map((c) => c.l));
  const bullRatio = Math.round((recent.filter((c) => c.c > c.o).length / recent.length) * 100);
  const last12 = candles.slice(-12).map((c) => [roundPrice(c.o), roundPrice(c.h), roundPrice(c.l), roundPrice(c.c)]);

  const payload = {
    symbol: symSpec.label,
    interval: itvSpec.label,
    price: roundPrice(last),
    dailyChangePct: prev !== 0 ? Math.round(((last - prev) / prev) * 10000) / 100 : null,
    bars: candles.length,
    ema20: roundPrice(e20),
    ema50: roundPrice(e50),
    priceVsEma50: isFinite(e50) ? (last > e50 ? "above" : "below") : null,
    ema20VsEma50: isFinite(e20) && isFinite(e50) ? (e20 > e50 ? "above" : "below") : null,
    rsi14: isFinite(rsi) ? Math.round(rsi * 10) / 10 : null,
    atr14: isFinite(atr) ? roundPrice(atr) : null,
    atrPct: isFinite(atr) ? Math.round((atr / last) * 10000) / 100 : null,
    recentSwingHighs: highs.slice(-4).map(roundPrice),
    recentSwingLows: lows.slice(-4).map(roundPrice),
    recent20High: roundPrice(recentHigh),
    recent20Low: roundPrice(recentLow),
    bullCandleRatioPct: bullRatio,
    last12CandlesOHLC: last12,
  };

  /* جهت ساختار همین تایم‌فریم: EMA20/50 + موقعیت قیمت + جهت سوئینگ‌ها */
  let trendScore = 0;
  if (isFinite(e20) && isFinite(e50)) trendScore += e20 > e50 ? 1 : -1;
  if (isFinite(e50)) trendScore += last > e50 ? 1 : -1;
  if (highs.length >= 2) trendScore += highs[highs.length - 1] > highs[highs.length - 2] ? 1 : -1;
  if (lows.length >= 2) trendScore += lows[lows.length - 1] > lows[lows.length - 2] ? 1 : -1;
  const trend = trendScore >= 2 ? ("bullish" as const) : trendScore <= -2 ? ("bearish" as const) : ("neutral" as const);

  /* هشدار رنج فشرده + نواحی ورود الگوریتمی — مستقل از خروجی LLM */
  const rangeWarning = rangeCompression(
    candles.map((c) => c.h),
    candles.map((c) => c.l),
    closes
  );
  const zones = entryZonesFromStructure({
    trend,
    price: last,
    support: recentLow,
    resistance: recentHigh,
    atrAbs: isFinite(atr) ? atr : null,
    range: rangeWarning,
  });

  const zai = await ZAI.create();
  const askLLM = () =>
    zai.chat.completions.create({
      messages: [
        { role: "assistant", content: ANALYST_SYSTEM },
        { role: "user", content: JSON.stringify(payload) },
      ],
      thinking: { type: "disabled" },
    });

  /* اگر مدل الفبای غیر فارسی/انگلیسی نوشت یک‌بار دیگر تلاش کن */
  const BAD_SCRIPT = /[\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/;
  let text = ((await askLLM()).choices[0]?.message?.content || "").trim();
  if (!text) throw new Error("empty LLM response");
  if (BAD_SCRIPT.test(text)) {
    try {
      const second = ((await askLLM()).choices[0]?.message?.content || "").trim();
      if (second && !BAD_SCRIPT.test(second)) text = second;
    } catch {
      /* از نتیجه اول استفاده می‌شود */
    }
  }
  /* اصلاح قطعی لغزش‌های شناخته‌شده مدل */
  text = text.replace(/در\s*caso/g, "در صورت").replace(/\bcaso\b/g, "صورت");

  return {
    symbol,
    interval,
    analysis: text,
    generatedAtISO: new Date().toISOString(),
    price: roundPrice(last),
    zones,
    rangeWarning,
  };
}

/* ---------- Route ---------- */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = url.searchParams.get("symbol") || "OANDA:XAUUSD";
  const interval = url.searchParams.get("interval") || "15";
  const force = url.searchParams.get("force") === "1";

  if (!SYMBOL_MAP[symbol]) {
    return NextResponse.json({ ok: false, error: "نماد پشتیبانی نمی‌شود" }, { status: 400 });
  }
  if (!INTERVAL_MAP[interval]) {
    return NextResponse.json({ ok: false, error: "تایم‌فریم پشتیبانی نمی‌شود" }, { status: 400 });
  }

  const key = cacheKey(symbol, interval);

  try {
    if (!force) {
      const cached = await readCache(key);
      if (cached && Date.now() - new Date(cached.generatedAtISO).getTime() < TTL_MS) {
        return NextResponse.json({ ok: true, ...cached, cached: true });
      }
    }

    const entry = await runExclusive(aiLock, async () => {
      /* بررسی مجدد کش داخل قفل — دو درخواست همزمان دوبار LLM صدا نزنند */
      if (!force) {
        const cached = await readCache(key);
        if (cached && Date.now() - new Date(cached.generatedAtISO).getTime() < TTL_MS) return cached;
      }
      const fresh = await computeAnalysis(symbol, interval);
      await setMeta(key, JSON.stringify(fresh));
      return fresh;
    });

    return NextResponse.json({ ok: true, ...entry, cached: false });
  } catch (err) {
    const msg = (err as Error).message || "";
    const friendly = msg.startsWith("yahoo failed")
      ? "دریافت داده بازار ناموفق بود — اتصال سرور به Yahoo Finance را بررسی کنید"
      : "تولید تحلیل ناموفق بود — کمی بعد دوباره تلاش کنید";
    console.error("[chart-analysis] failed:", msg);
    return NextResponse.json({ ok: false, error: friendly }, { status: 502 });
  }
}
