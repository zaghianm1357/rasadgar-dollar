/**
 * سرویس رأی فنی تریدینگ‌ویو (TradingView Technicals) — منبع دماسنج فشار خرید/فروش
 *
 * نکته طراحی (طبق درخواست کاربر، پیام ۲۱):
 *   • دماسنج «عوامل کمّی» از رأی فنی تریدینگ‌ویو تغذیه می‌شود — همان page معروف
 *     https://www.tradingview.com/symbols/XAUUSD/technicals/ که از API عمومی
 *     scanner.tradingview.com خوانده می‌شود (بدون کلید، GET، با CORS باز).
 *   • فقط «نتیجه» برمی‌گردد: رأی کل + نوسانگرها + میانگین‌های متحرک در بازه ‎−۱…+۱‎.
 *     هیچ فرمول یا فهرست متغیرها به کاربر نشان داده نمی‌شود.
 *   • قیمت را این سرویس تعیین نمی‌کند؛ قیمت همه صفحات از لایه واحد market-data
 *     (Yahoo + کالیبراسیون اسپات) می‌آید تا «یک منبع داده» حفظ شود.
 */

import { memCacheGet, memCacheSet } from "@/lib/market-data";

const SCANNER_URL = "https://scanner.tradingview.com/symbol";
const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 10 * 60 * 1000; // رأی فنی هر ۱۰ دقیقه تازه شود
const FAIL_BACKOFF_MS = 5 * 60 * 1000;

/** رأی نرمال‌شده تریدینگ‌ویو در یک تایم‌فریم */
export interface TvTfRating {
  /** رأی کل (Recommend.All) — ترکیب نوسانگرها و میانگین‌ها، ‎−۱…+۱‎ */
  all: number;
  /** رأی نوسانگرها/اسیلاتورها (Recommend.Other) */
  other: number;
  /** رأی میانگین‌های متحرک (Recommend.MA) */
  ma: number;
}

export interface TvTechnicalsOut {
  ratings: { "1h"?: TvTfRating; "4h"?: TvTfRating; "1d"?: TvTfRating };
  /** آخرین قیمت منبع تریدینگ‌ویو — فقط برای صحت‌سنجی داخلی، نمایش داده نمی‌شود */
  close: number | null;
  fetchedAtISO: string;
}

type TvTfKey = "1h" | "4h" | "1d";

/** نگاشت تایم‌فریم ابزار → پسوند فیلد اسکنر تریدینگ‌ویو */
const TF_FIELD_SUFFIX: Record<TvTfKey, string> = {
  "1h": "|60",
  "4h": "|240",
  "1d": "", // بدون پسوند = روزانه در endpoint نماد
};

let lastFailAt = 0;

function ratingFromRaw(raw: unknown): number | null {
  if (typeof raw !== "number" || !isFinite(raw)) return null;
  if (raw < -1 || raw > 1) return null;
  return raw;
}

/**
 * دریافت رأی فنی یک نماد از اسکنر عمومی تریدینگ‌ویو.
 * نمادها همان شناسه‌های رسمی TV هستند (مثل OANDA:XAUUSD یا DJ:DJI).
 * خروجی ‎null‎ یعنی منبع در دسترس نیست (تماس‌گیرنده باید به موتور محلی برگردد).
 */
export async function fetchTvTechnicals(
  tvSymbol: string,
  tfs: TvTfKey[] = ["1d"]
): Promise<TvTechnicalsOut | null> {
  const now = Date.now();
  if (now - lastFailAt < FAIL_BACKOFF_MS) return null;

  const cacheKey = `tv_technicals_v1:${tvSymbol}:${tfs.slice().sort().join(",")}`;
  const cached = memCacheGet<TvTechnicalsOut>(cacheKey);
  if (cached) return cached;

  const wanted = tfs.filter((t) => TF_FIELD_SUFFIX[t] !== undefined);
  if (!wanted.length) return null;

  const fields = ["close"];
  for (const tf of wanted) {
    const sfx = TF_FIELD_SUFFIX[tf];
    fields.push(`Recommend.All${sfx}`, `Recommend.Other${sfx}`, `Recommend.MA${sfx}`);
  }

  const url =
    `${SCANNER_URL}?symbol=${encodeURIComponent(tvSymbol)}` +
    `&fields=${encodeURIComponent(fields.join(","))}&no_404=true`;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`tv-scanner http ${res.status}`);
    const raw = (await res.json()) as Record<string, unknown>;

    const close = ratingFromRaw(raw["close"]) === null && typeof raw["close"] === "number" ? (raw["close"] as number) : null;
    const ratings: TvTechnicalsOut["ratings"] = {};
    let any = false;
    for (const tf of wanted) {
      const sfx = TF_FIELD_SUFFIX[tf];
      const all = ratingFromRaw(raw[`Recommend.All${sfx}`]);
      const other = ratingFromRaw(raw[`Recommend.Other${sfx}`]);
      const ma = ratingFromRaw(raw[`Recommend.MA${sfx}`]);
      if (all === null) continue;
      ratings[tf] = { all, other: other ?? 0, ma: ma ?? 0 };
      any = true;
    }
    if (!any) throw new Error("tv-scanner empty ratings");

    const out: TvTechnicalsOut = {
      ratings,
      close: typeof raw["close"] === "number" ? (raw["close"] as number) : close,
      fetchedAtISO: new Date().toISOString(),
    };
    lastFailAt = 0;
    memCacheSet(cacheKey, out, CACHE_TTL_MS);
    return out;
  } catch {
    lastFailAt = Date.now();
    return null;
  }
}

/** تبدیل رأی ‎−۱…+۱‎ به نمره دماسنج ۰…۱۰۰ (هم‌ساز با موتور محلی) */
export function tvRatingToScore(all: number): number {
  return Math.max(0, Math.min(100, Math.round((all + 1) * 50)));
}

/** جهت سه‌حالته از رأی تریدینگ‌ویو — آستانه ۰٫۱ مثل خود تریدینگ‌ویو (Sell/Neutral/Buy) */
export function tvRatingToDir(all: number): "buy" | "sell" | "neutral" {
  if (all >= 0.1) return "buy";
  if (all <= -0.1) return "sell";
  return "neutral";
}

/**
 * تعیین دیده‌بان بودن فشار خرید/فروش در حالت «برای شفاف شدن مسیر معامله‌گری» —
 * فقط سه حالت: فشار خرید / خنثی / فشار فروش (طبق درخواست کاربر: بدون جدول و فرمول)
 */
export function tvRatingToStateFa(all: number): string {
  const d = tvRatingToDir(all);
  return d === "buy" ? "فشار خرید" : d === "sell" ? "فشار فروش" : "خنثی";
}
