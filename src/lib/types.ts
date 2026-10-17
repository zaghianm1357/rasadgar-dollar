export type Direction = "bullish" | "bearish" | "mixed" | "neutral";
export type Impact = "High" | "Medium" | "Low" | "Holiday";

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
}

export interface NewsResponse {
  feedStatus: "live" | "cached" | "error";
  lastFetchISO: string | null;
  digest: string | null;
  translatedNow: number;
  pendingTranslation: number;
  events: NewsEvent[];
}
