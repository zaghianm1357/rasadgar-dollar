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
