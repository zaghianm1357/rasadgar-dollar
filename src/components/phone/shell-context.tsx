"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MarketStructureResponse, NewsResponse } from "@/lib/types";

/**
 * کانتکست پوسته موبایل — تنها منبع داده برای ویجت‌ها و اپ‌ها
 * (پولینگ اخبار هر ۲ دقیقه و ساختار بازار هر ۵ دقیقه، قابل خاموش/روشن از مرکز کنترل)
 */

export interface CCSettings {
  autoNews: boolean;
  autoMarket: boolean;
  highOnly: boolean;
}

const DEFAULT_SETTINGS: CCSettings = { autoNews: true, autoMarket: true, highOnly: false };
const SETTINGS_KEY = "cc_settings_v1";

const NEWS_AUTO_MS = 120 * 1000;
const MARKET_AUTO_MS = 5 * 60 * 1000;

interface ShellCtx {
  news: NewsResponse | null;
  newsLoading: boolean;
  newsRefreshing: boolean;
  newsError: string | null;
  refreshNews: (force?: boolean) => Promise<void>;
  ms: MarketStructureResponse | null;
  msRefreshing: boolean;
  refreshMarket: (force?: boolean) => Promise<void>;
  settings: CCSettings;
  updateSettings: (patch: Partial<CCSettings>) => void;
  /** زمان جاری (هر ثانیه) */
  now: Date;
  /** زمان با گام ۳۰ ثانیه — برای شمارش معکوس‌ها */
  now30: Date;
}

const Ctx = createContext<ShellCtx | null>(null);

export function useShell(): ShellCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useShell must be used within PhoneDataProvider");
  return v;
}

export function PhoneDataProvider({ children }: { children: React.ReactNode }) {
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsRefreshing, setNewsRefreshing] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [ms, setMs] = useState<MarketStructureResponse | null>(null);
  const [msRefreshing, setMsRefreshing] = useState(false);
  const [settings, setSettings] = useState<CCSettings>(DEFAULT_SETTINGS);
  const [now, setNow] = useState<Date>(() => new Date());
  const [now30, setNow30] = useState<Date>(() => new Date());
  const newsFetchRef = useRef(0);

  const refreshNews = useCallback(async (force = false) => {
    if (force) setNewsRefreshing(true);
    try {
      const res = await fetch("/api/news", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as NewsResponse;
      setNews(json);
      setNewsError(null);
      newsFetchRef.current = Date.now();
    } catch {
      setNewsError("دریافت اخبار ناموفق بود. اتصال اینترنت را بررسی کنید.");
    } finally {
      setNewsLoading(false);
      setNewsRefreshing(false);
    }
  }, []);

  const refreshMarket = useCallback(async (force = false) => {
    if (force) setMsRefreshing(true);
    try {
      const res = await fetch(
        force ? "/api/market-structure?force=1" : "/api/market-structure",
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as MarketStructureResponse;
      setMs(json);
    } catch {
      /* داده قبلی حفظ می‌شود */
    } finally {
      setMsRefreshing(false);
    }
  }, []);

  // بارگذاری تنظیمات ذخیره‌شده + فچ اولیه (IIFE — خارج از بدنه همگام اثر)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as CCSettings) });
    } catch {
      /* پیش‌فرض */
    }
    (async () => {
      await Promise.all([refreshNews(false), refreshMarket(false)]);
    })();
  }, [refreshNews, refreshMarket]);

  // پولینگ خودکار — بر اساس تنظیمات مرکز کنترل
  useEffect(() => {
    if (!settings.autoNews) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refreshNews(false);
    }, NEWS_AUTO_MS);
    return () => clearInterval(id);
  }, [settings.autoNews, refreshNews]);

  useEffect(() => {
    if (!settings.autoMarket) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refreshMarket(false);
    }, MARKET_AUTO_MS);
    return () => clearInterval(id);
  }, [settings.autoMarket, refreshMarket]);

  // فچ مجدد هنگام بازگشت به تب
  useEffect(() => {
    const onVis = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - newsFetchRef.current > 60_000
      ) {
        refreshNews(false);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshNews]);

  // ساعت زنده
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNow(d);
      if (d.getSeconds() === 0 || d.getSeconds() === 30) setNow30(d);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const updateSettings = useCallback((patch: Partial<CCSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* حالت ناشناس */
      }
      return next;
    });
  }, []);

  const value = useMemo<ShellCtx>(
    () => ({
      news,
      newsLoading,
      newsRefreshing,
      newsError,
      refreshNews,
      ms,
      msRefreshing,
      refreshMarket,
      settings,
      updateSettings,
      now,
      now30,
    }),
    [
      news,
      newsLoading,
      newsRefreshing,
      newsError,
      refreshNews,
      ms,
      msRefreshing,
      refreshMarket,
      settings,
      updateSettings,
      now,
      now30,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
