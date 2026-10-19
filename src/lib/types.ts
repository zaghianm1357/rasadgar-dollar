export type Direction = "bullish" | "bearish" | "mixed" | "neutral";
export type Impact = "High" | "Medium" | "Low" | "Holiday";

/** برآورد احتمال بر اساس مقایسه پیش‌بینی با مقدار قبلی (درصدها) */
export interface AssetOutlook {
  /** احتمال سناریوی «بالاتر از انتظار» بودن داده — درصد 0..100 */
  pAbove: number | null;
  /** احتمال درصدی افزایش قیمت طلا (XAUUSD) */
  xauUp: number | null;
  /** احتمال درصدی افزایش داو جونز (DJI) */
  djiUp: number | null;
  /** مقایسه پیش‌بینی با مقدار قبلی */
  cmp: "above" | "below" | "equal" | null;
}

export interface NewsEvent {
  id: string;
  title: string;
  titleFa: string | null;
  country: string;
  dateISO: string | null;
  allDay: boolean;
  impact: Impact;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  direction: Direction | null;
  explanationFa: string | null;
  xauAbove: Direction | null;
  xauBelow: Direction | null;
  djiAbove: Direction | null;
  djiBelow: Direction | null;
  outlook: AssetOutlook | null;
}

export interface NewsResponse {
  feedStatus: "live" | "cached" | "error";
  lastFetchISO: string | null;
  digest: string | null;
  translatedNow: number;
  pendingTranslation: number;
  events: NewsEvent[];
}

/* ---------- ساختار بازار چند تایم‌فریمی ---------- */

export type MSTrend = "bullish" | "bearish" | "neutral";
export type MSTimeframe = "5m" | "15m" | "1h" | "4h" | "1d" | "1wk" | "1mo";

/** وضعیت ساختار بازار در یک تایم‌فریم */
export interface MSRow {
  tf: MSTimeframe;
  /** روند کلی ترکیبی — null یعنی داده ناکافی */
  trend: MSTrend | null;
  /** قدرت روند ۰ تا ۱۰۰ */
  strength: number;
  /** مولفه میانگین متحرک (EMA20/EMA50) */
  ma: MSTrend | null;
  /** مولفه سقف/کف‌های سوئینگ (HH/HL در برابر LH/LL) */
  swing: MSTrend | null;
  bars: number;
}

/** وضعیت ساختار یک نماد در همه تایم‌فریم‌ها */
export interface MSSymbol {
  key: "xau" | "dji";
  price: number | null;
  prevClose: number | null;
  changePct: number | null;
  rows: MSRow[];
  okCount: number;
}

/** یک رویداد تغییر جهت روند (مقایسه دو محاسبه متوالی سرور) */
export interface MSTrendChange {
  symbol: "xau" | "dji";
  tf: MSTimeframe;
  /** جهت قبلی — همیشه غیرتهی (از null به جهت، «تغییر جهت» محسوب نمی‌شود) */
  from: MSTrend;
  /** جهت جدید */
  to: MSTrend;
  /** زمان تشخیص تغییر (ISO) */
  atISO: string;
}

export interface MarketStructureResponse {
  status: "live" | "cached" | "stale" | "error";
  updatedAtISO: string | null;
  xau: MSSymbol | null;
  dji: MSSymbol | null;
  /** تغییرات جهت روند اخیر (پنجره ۶ ساعته) — برای اعلان چشمک‌زن بالای صفحه */
  changes?: MSTrendChange[];
}
