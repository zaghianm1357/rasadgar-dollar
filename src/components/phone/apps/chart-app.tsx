"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CandlestickChart, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";

/* ---------- تنظیمات چارت ---------- */

const TV_SRC = "https://s3.tradingview.com/tv.js";
const CHART_PREF_KEY = "sd_chart_v1";
const DEFAULT_SYMBOL = "OANDA:XAUUSD";
const DEFAULT_INTERVAL = "15";

/** فقط نمادهایی که روی ویجت رایگان TradingView رندر می‌شوند */
const SYMBOL_PRESETS: { label: string; symbol: string }[] = [
  { label: "طلا", symbol: "OANDA:XAUUSD" },
  { label: "نقره", symbol: "OANDA:XAGUSD" },
  { label: "یورو/دلار", symbol: "OANDA:EURUSD" },
  { label: "بیت‌کوین", symbol: "BINANCE:BTCUSDT" },
];

const INTERVAL_PRESETS: { label: string; value: string }[] = [
  { label: "۵دقیقه", value: "5" },
  { label: "۱۵دقیقه", value: "15" },
  { label: "۱ساعت", value: "60" },
  { label: "۴ساعت", value: "240" },
  { label: "روزانه", value: "D" },
];

const VALID_INTERVALS = new Set(INTERVAL_PRESETS.map((i) => i.value));

/* ---------- تایپ‌های TradingView ---------- */

interface TvWidgetOptions {
  container_id: string;
  symbol: string;
  interval: string;
  autosize?: boolean;
  theme?: string;
  timezone?: string;
  locale?: string;
  allow_symbol_change?: boolean;
  hide_side_toolbar?: boolean;
}

interface TvWindow {
  TradingView?: { widget?: new (opts: TvWidgetOptions) => unknown };
  loadChart?: (symbol?: string, interval?: string) => void;
}

/* ---------- بارگذاری یک‌باره اسکریپت رسمی TradingView ---------- */

let tvPromise: Promise<void> | null = null;

function tvReady(): boolean {
  return !!(window as unknown as TvWindow).TradingView?.widget;
}

function ensureTVScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no-window"));
  if (tvReady()) return Promise.resolve();
  if (tvPromise) return tvPromise;
  tvPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = TV_SRC;
    s.async = true;
    const fail = () => {
      tvPromise = null; /* اجازه تلاش مجدد */
      s.remove();
      reject(new Error("tv-load-failed"));
    };
    s.onload = () => (tvReady() ? resolve() : fail());
    s.onerror = fail;
    document.head.appendChild(s);
    /* اگر شبکه کند بود و پاسخی نیامد */
    setTimeout(() => {
      if (!tvReady()) fail();
    }, 15000);
  });
  return tvPromise;
}

/* ---------- اپ چارت تریدینگ‌ویو ---------- */

export function ChartApp() {
  /* پیش‌فرض‌ها + بازیابی انتخاب قبلی از همین دستگاه */
  const [symbol, setSymbol] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(CHART_PREF_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { symbol?: string; interval?: string };
        if (p.symbol && p.symbol.includes(":")) return p.symbol;
      }
    } catch {
      /* پیش‌فرض */
    }
    return DEFAULT_SYMBOL;
  });
  const [interval, setIntervalTf] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(CHART_PREF_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { symbol?: string; interval?: string };
        if (p.interval && VALID_INTERVALS.has(p.interval)) return p.interval;
      }
    } catch {
      /* پیش‌فرض */
    }
    return DEFAULT_INTERVAL;
  });
  const [loading, setLoading] = useState(true);
  const [tvError, setTvError] = useState(false);

  /* ref برای دسترسی بدون stale closure */
  const symRef = useRef(symbol);
  const tfRef = useRef(interval);

  /** ساخت ویجت رسمی Advanced Chart داخل #tv_chart (همیشه با پاک‌سازی قبلی) */
  const buildWidget = useCallback((sym: string, itv: string) => {
    const w = window as unknown as TvWindow;
    const el = document.getElementById("tv_chart");
    if (!w.TradingView?.widget || !el) return;
    el.innerHTML = "";
    new w.TradingView.widget({
      container_id: "tv_chart",
      symbol: sym,
      interval: itv,
      autosize: true,
      theme: "dark",
      timezone: "Asia/Tehran",
      locale: "en",
      allow_symbol_change: true,
      hide_side_toolbar: false,
    });
  }, []);

  /** تغییر نماد/تایم‌فریم + ذخیره + بازسازی چارت */
  const applyChange = useCallback(
    (sym: string, itv: string) => {
      symRef.current = sym;
      tfRef.current = itv;
      setSymbol(sym);
      setIntervalTf(itv);
      try {
        localStorage.setItem(CHART_PREF_KEY, JSON.stringify({ symbol: sym, interval: itv }));
      } catch {
        /* حالت ناشناس */
      }
      buildWidget(sym, itv);
    },
    [buildWidget],
  );

  /* بارگذاری اولیه: اسکریپت رسمی → ساخت ویجت؛ خطا → پیام فارسی */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await ensureTVScript();
        if (!alive) return;
        setLoading(false);
        buildWidget(symRef.current, tfRef.current);
      } catch {
        if (!alive) return;
        setLoading(false);
        setTvError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [buildWidget]);

  /* loadChart سراسری — قابل فراخوانی از هر جای ابزار: window.loadChart('OANDA:EURUSD','60') */
  useEffect(() => {
    const w = window as unknown as TvWindow;
    w.loadChart = (sym?: string, itv?: string) => {
      const s = typeof sym === "string" && sym.trim() ? sym.trim() : symRef.current;
      const i = typeof itv === "string" && VALID_INTERVALS.has(itv) ? itv : tfRef.current;
      applyChange(s, i);
    };
    return () => {
      delete w.loadChart;
    };
  }, [applyChange]);

  const retry = useCallback(() => {
    setTvError(false);
    setLoading(true);
    ensureTVScript()
      .then(() => {
        setLoading(false);
        buildWidget(symRef.current, tfRef.current);
      })
      .catch(() => {
        setLoading(false);
        setTvError(true);
      });
  }, [buildWidget]);

  /* ورود به حساب تریدینگ‌ویو — ویجت رایگان لاگین ندارد؛ سایت اصلی با همان نماد باز می‌شود */
  const openWithAccount = useCallback(() => {
    const url = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symRef.current)}`;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      /* پاپ‌آپ بلاک شده */
    }
  }, []);

  return (
    <div className="flex h-full flex-col px-3 pb-1.5">
      {/* انتخاب نماد */}
      <div
        dir="ltr"
        className="no-scrollbar flex flex-none items-center gap-1.5 overflow-x-auto py-1.5"
        data-testid="chart-symbols"
      >
        {SYMBOL_PRESETS.map((p) => (
          <button
            key={p.symbol}
            type="button"
            onClick={() => applyChange(p.symbol, tfRef.current)}
            className={`flex-none rounded-full border px-3 py-1 text-[10px] font-bold transition-colors ${
              symbol === p.symbol
                ? "border-amber-500/60 bg-amber-500/20 text-amber-200"
                : "border-border/70 bg-card/60 text-muted-foreground hover:bg-white/10"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* انتخاب تایم‌فریم + ورود به حساب (دکمه همیشه قابل دیدن) */}
      <div className="flex flex-none items-center gap-1.5 pb-2">
        <div
          className="no-scrollbar flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto"
          data-testid="chart-intervals"
        >
          {INTERVAL_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => applyChange(symRef.current, p.value)}
              className={`flex-none rounded-full border px-2.5 py-1 text-[10px] font-bold transition-colors ${
                interval === p.value
                  ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-200"
                  : "border-border/70 bg-card/60 text-muted-foreground hover:bg-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={openWithAccount}
          aria-label="باز کردن چارت کامل تریدینگ‌ویو در تب جدید برای ورود به حساب کاربری"
          title="ویجت داخلی لاگین ندارد — با حساب خودتان در سایت اصلی وارد شوید"
          data-testid="chart-login"
          className="flex flex-none items-center gap-1 rounded-full border border-sky-500/50 bg-sky-500/15 px-2.5 py-1 text-[10px] font-extrabold text-sky-200 transition-colors hover:bg-sky-500/25"
        >
          <ExternalLink className="h-3 w-3" />
          ورود به حساب
        </button>
      </div>

      {/* ناحیه چارت — پر کردن کل فضای باقی‌مانده بدون اسکرول اضافه */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border/70 bg-card/60">
        <div id="tv_chart" className="absolute inset-0" data-testid="tv_chart" />

        {loading && !tvError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80">
            <LoaderCircle className="h-7 w-7 animate-spin text-amber-400" />
            <p className="text-xs font-bold text-foreground/80">در حال بارگذاری چارت…</p>
          </div>
        )}

        {tvError && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 bg-background/90 px-6 text-center">
            <AlertTriangle className="h-9 w-9 text-amber-400" />
            <p className="text-sm font-extrabold">اتصال به TradingView برقرار نشد</p>
            <p className="max-w-[280px] text-[11px] leading-5 text-muted-foreground">
              برای نمایش چارت به اینترنت نیاز است. اتصال اینترنت یا VPN خود را بررسی کنید و
              دوباره تلاش کنید.
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-1 flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/15 px-4 py-1.5 text-xs font-extrabold text-amber-200 transition-colors hover:bg-amber-500/25"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              تلاش مجدد
            </button>
          </div>
        )}
      </div>

      <p className="flex items-center justify-center gap-1 pt-1.5 text-center text-[9px] leading-4 text-muted-foreground/70">
        <CandlestickChart className="h-3 w-3 flex-none" />
        رسم‌ها و اندیکاتورهای داخل ویجت ذخیره نمی‌شوند — برای ذخیره با حساب خودتان از دکمه «ورود به حساب» استفاده کنید
      </p>
    </div>
  );
}
