"use client";

/**
 * لایه دادهٔ سایت BIG TRADER — فقط دادهٔ واقعی از APIهای همان ابزار رصدگر دلار.
 * هیچ عدد ساختگی تولید نمی‌شود؛ در نبود داده، حالت «در دسترس نیست» نشان داده می‌شود.
 */
import { useCallback, useEffect, useRef, useState } from "react";

/* ---------- انواع پاسخ‌های واقعی API ---------- */

export type Bias = "bullish" | "bearish" | "neutral";

export interface StructureRow {
  tf: string;
  trend: Bias;
  strength: number;
  ma: string;
  swing: string;
  bars: number;
}

export interface SymbolMs {
  key: string;
  price: number;
  prevClose: number;
  changePct: number;
  rows: StructureRow[];
  okCount: number;
}

export interface TrendChange {
  symbol: string;
  tf: string;
  from: Bias;
  to: Bias;
  atISO: string;
}

export interface MarketStructure {
  status: string;
  updatedAtISO: string;
  xau: SymbolMs;
  dji: SymbolMs;
  changes: TrendChange[];
}

export interface NewsEvent {
  id: string;
  title: string;
  titleFa: string;
  country: string;
  dateISO: string;
  allDay: boolean;
  impact: "High" | "Medium" | "Low";
  forecast?: string | null;
  previous?: string | null;
  actual?: string | null;
  direction?: string;
}

export interface NewsFeed {
  feedStatus?: string;
  lastFetchISO?: string;
  events: NewsEvent[];
}

export interface PressureIndicator {
  key: string;
  labelFa?: string;
  vote?: number;
  [k: string]: unknown;
}

export interface Pressure {
  ok: boolean;
  tvSymbol: string;
  tf: string;
  tfLabel: string;
  score: number;
  zone: "buy" | "sell" | "neutral";
  zoneFa: string;
  consensus: Record<string, unknown>;
  indicators: PressureIndicator[];
  guidanceFa: string;
  reliable: boolean;
  source: string;
  sourceNoteFa: string;
  generatedAtISO: string;
  disclaimer: string;
}

export interface GoldAnalysis {
  ok: boolean;
  stale: boolean;
  ageMin: number;
  generatedAtISO: string;
  lite: {
    ok: boolean;
    via?: string;
    baseScenarioFa?: string;
    longAbove?: number;
    shortBelow?: number;
    stopLoss?: number;
    targets?: number[];
    tomorrow?: { low: number; avg: number; high: number };
    week?: { low: number; avg: number; high: number };
    rsi?: number;
    snapshot?: boolean;
  };
  fx: {
    ok: boolean;
    via?: string;
    poll?: { periodFa: string; avg: number; mixFa: string }[];
    items?: { title: string; titleFa: string; url: string }[];
    snapshot?: boolean;
  };
  tv: { ok: boolean; stateFa?: string };
  summaryFa: string[];
  sourcesNoteFa: string;
}

/* ---------- هوک عمومی fetch + poll ---------- */

interface Slot<T> {
  data: T | null;
  error: boolean;
  loading: boolean;
}

function usePolled<T>(url: string, intervalMs: number): Slot<T> {
  const [state, setState] = useState<Slot<T>>({ data: null, error: false, loading: true });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const json = (await res.json()) as T;
      setState({ data: json, error: false, loading: false });
    } catch {
      setState((s) => ({ data: s.data, error: true, loading: false }));
    }
  }, [url]);

  useEffect(() => {
    load();
    timer.current = setInterval(load, intervalMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load, intervalMs]);

  return state;
}

/* ---------- هوک اصلی سایت ---------- */

export type PressureTf = "1d" | "4h" | "1h";

export function useSiteData() {
  const ms = usePolled<MarketStructure>("/api/market-structure", 30_000);
  const news = usePolled<NewsFeed>("/api/news", 60_000);
  const [tf, setTf] = useState<PressureTf>("1d");
  const pressure = usePolled<Pressure>(`/api/pressure?tf=${tf}`, 5 * 60_000);
  const analysis = usePolled<GoldAnalysis>("/api/analysis/gold", 10 * 60_000);
  return { ms, news, pressure, analysis, tf, setTf };
}

/* ---------- کمکی‌ها ---------- */

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function fa(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function fmtPrice(v: number | undefined | null, decimals = 2): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return v.toLocaleString("fa-IR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPct(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return (v >= 0 ? "+" : "−") + fa(Math.abs(v).toFixed(2)) + "٪";
}

export function fmtClock(d: Date): string {
  return fa(
    d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Tehran" }),
  );
}

export function fmtEventTime(iso: string): string {
  const d = new Date(iso);
  return fa(
    d.toLocaleString("fa-IR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" }),
  );
}

export function nextHighImpact(events: NewsEvent[] | null, now = Date.now()): NewsEvent | null {
  if (!events) return null;
  return (
    events
      .filter((e) => e.impact === "High" && new Date(e.dateISO).getTime() > now)
      .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime())[0] || null
  );
}

export function countdownParts(targetISO: string, now = Date.now()): { h: number; m: number; s: number } {
  const diff = Math.max(0, new Date(targetISO).getTime() - now);
  const s = Math.floor(diff / 1000);
  return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export const BIAS_LABEL: Record<Bias, string> = {
  bullish: "صعودی",
  bearish: "نزولی",
  neutral: "خنثی",
};
