"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CandlestickChart,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { faTime, faDigits } from "@/lib/tehran";
import type { EntryZoneOutput, RangeWarning } from "@/lib/trader-engine";

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

  /* ---------- تحلیل هوش مصنوعی ---------- */
  const [aiOpen, setAiOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [aiText, setAiText] = useState("");
  const [aiAt, setAiAt] = useState<string | null>(null);
  const [aiKey, setAiKey] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiZones, setAiZones] = useState<EntryZoneOutput | null>(null);
  const [aiRw, setAiRw] = useState<RangeWarning | null>(null);

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

  /* تحلیل هوشمند: داده همان نماد/تایم‌فریم → سرور → LLM (با کش ۱۵ دقیقه‌ای) */
  const runAnalysis = useCallback((force: boolean) => {
    setAiOpen(true);
    setAiStatus("loading");
    setAiError(null);
    const sym = symRef.current;
    const itv = tfRef.current;
    fetch(
      `/api/chart-analysis?symbol=${encodeURIComponent(sym)}&interval=${itv}${force ? "&force=1" : ""}`,
    )
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (ok && j?.ok) {
          setAiText(String(j.analysis ?? ""));
          setAiAt(j.generatedAtISO ? String(j.generatedAtISO) : null);
          setAiKey(`${sym}@${itv}`);
          setAiZones((j.zones as EntryZoneOutput | null) ?? null);
          setAiRw((j.rangeWarning as RangeWarning | null) ?? null);
          setAiStatus("done");
        } else {
          setAiError(String(j?.error ?? "خطای نامشخص"));
          setAiStatus("error");
        }
      })
      .catch(() => {
        setAiError("ارتباط با سرور برقرار نشد");
        setAiStatus("error");
      });
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
          onClick={() => runAnalysis(false)}
          disabled={aiStatus === "loading"}
          aria-label="تحلیل هوش مصنوعی از وضعیت چارت در تایم‌فریم فعلی"
          data-testid="chart-ai-btn"
          className="flex flex-none items-center gap-1 rounded-full border border-violet-500/50 bg-violet-500/15 px-2.5 py-1 text-[10px] font-extrabold text-violet-200 transition-colors hover:bg-violet-500/25 disabled:opacity-60"
        >
          {aiStatus === "loading" ? (
            <LoaderCircle className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          تحلیل هوشمند
        </button>
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

      {/* پنل تحلیل هوش مصنوعی */}
      {aiOpen && (
        <div
          className="mt-1.5 flex h-[38%] max-h-[340px] flex-none flex-col overflow-hidden rounded-xl border border-violet-500/30 bg-card/60"
          data-testid="chart-ai-panel"
        >
          <div className="flex flex-none items-center gap-1.5 border-b border-border/60 px-2.5 py-1.5">
            <Sparkles className="h-3.5 w-3.5 flex-none text-violet-300" />
            <span className="min-w-0 flex-1 truncate text-[11px] font-extrabold">
              تحلیل هوش مصنوعی — {symbol} · {INTERVAL_PRESETS.find((p) => p.value === interval)?.label}
            </span>
            {aiStatus === "done" && aiAt && (
              <span className="flex-none text-[9px] text-muted-foreground/80">{faTime(new Date(aiAt))}</span>
            )}
            <button
              type="button"
              onClick={() => runAnalysis(true)}
              disabled={aiStatus === "loading"}
              aria-label="بروزرسانی تحلیل"
              className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-white/15 bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${aiStatus === "loading" ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => setAiOpen(false)}
              aria-label="بستن پنل تحلیل"
              className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-white/15 bg-white/10"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {aiStatus === "loading" && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <LoaderCircle className="h-6 w-6 animate-spin text-violet-300" />
                <p className="text-xs font-bold text-foreground/85">در حال تحلیل چارت…</p>
                <p className="text-[10px] text-muted-foreground">معمولاً ۵ تا ۱۵ ثانیه طول می‌کشد</p>
              </div>
            )}
            {aiStatus === "error" && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
                <p className="max-w-[280px] text-[11px] leading-5 text-muted-foreground">{aiError}</p>
                <button
                  type="button"
                  onClick={() => runAnalysis(true)}
                  className="mt-0.5 flex items-center gap-1.5 rounded-full border border-violet-500/50 bg-violet-500/15 px-3.5 py-1.5 text-xs font-extrabold text-violet-200 transition-colors hover:bg-violet-500/25"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  تلاش مجدد
                </button>
              </div>
            )}
            {aiStatus === "done" && (
              <div className="flex flex-col gap-1.5">
                {aiKey !== null && aiKey !== `${symbol}@${interval}` && (
                  <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-center text-[10px] font-bold text-amber-200">
                    این تحلیل مربوط به نماد/تایم‌فریم قبلی است — دکمه «تحلیل هوشمند» را دوباره بزنید
                  </p>
                )}
                {aiRw?.active && (
                  <div
                    className={`rounded-lg border px-2 py-1.5 ${aiRw.severity === "tight" ? "border-rose-500/60 bg-rose-500/15" : "border-amber-500/50 bg-amber-500/10"}`}
                    data-testid="chart-rangewarn"
                  >
                    <p className={`text-[10.5px] font-black ${aiRw.severity === "tight" ? "text-rose-200" : "text-amber-200"}`}>
                      {aiRw.severity === "tight" ? "هشدار جدی: رنج فشرده" : "هشدار: بازار رنج است"}
                    </p>
                    <p className="mt-0.5 text-[9.5px] leading-4 text-foreground/85">{aiRw.message}</p>
                    {aiRw.severity === "tight" && (
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {aiRw.advice.slice(0, 3).map((a, i) => (
                          <li key={i} className="flex items-start gap-1 text-[9px] leading-4 text-rose-200/90">
                            <span className="mt-1 h-1 w-1 flex-none rounded-full bg-rose-400" />
                            {a}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1 text-[8.5px] text-muted-foreground">
                      سنجه‌ها: صدک ATR {aiRw.metrics.atrPctile === null ? "—" : faDigits(aiRw.metrics.atrPctile)} · نسبت کارایی {aiRw.metrics.er === null ? "—" : faDigits(aiRw.metrics.er)}
                    </p>
                  </div>
                )}
                <p className="whitespace-pre-wrap text-[11px] leading-6 text-foreground/90">{aiText}</p>
                {aiZones && (
                  <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-2 py-1.5" data-testid="chart-zones">
                    <p className="text-[10.5px] font-black text-sky-200">نواحی ورود مبتنی بر ساختار (الگوریتمی)</p>
                    <p className="mt-0.5 text-[9px] leading-4 text-muted-foreground">ساختار این تایم‌فریم: {aiZones.trendFa} — {aiZones.note}</p>
                    {aiZones.zones.map((z, i) => (
                      <div key={i} className="mt-1 rounded-lg border border-border/60 bg-background/40 p-1.5">
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-black ${z.side === "buy" ? "text-emerald-300" : "text-rose-300"}`}>
                            {z.side === "buy" ? "ناحیه خرید" : "ناحیه فروش"}
                          </span>
                          <span className={`rounded-full px-1.5 py-px text-[8.5px] font-bold ${z.activeNow ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-zinc-300"}`}>
                            {z.activeNow ? "فعال" : "انتظار پولبک"}
                          </span>
                        </div>
                        <div className="mt-0.5 grid grid-cols-2 gap-x-2 text-[9px] font-bold">
                          <p>ناحیه: <span dir="ltr">{z.zoneLo} – {z.zoneHi}</span></p>
                          <p>SL: <span className="text-rose-300" dir="ltr">{z.sl}</span></p>
                          <p>TP۱ (RR۲): <span className="text-emerald-300" dir="ltr">{z.tp1}</span></p>
                          <p>TP۲ (RR۳): <span className="text-emerald-300" dir="ltr">{z.tp2}</span></p>
                        </div>
                        <p className="mt-0.5 text-[8.5px] leading-4 text-amber-300/90">{z.invalidate}</p>
                      </div>
                    ))}
                    <p className="mt-1 text-[8.5px] leading-4 text-muted-foreground">
                      نواحی آموزشی مبتنی بر سوئینگ/ATR هستند — سیگنال قطعی نیستند؛ تأیید کندل داخل ناحیه شرط اجراست.
                    </p>
                  </div>
                )}
                <p className="pt-0.5 text-center text-[9px] text-muted-foreground/70">
                  تحلیل صرفاً اطلاع‌رسانی است و توصیه معاملاتی محسوب نمی‌شود — منبع داده: Yahoo Finance
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <p className="flex items-center justify-center gap-1 pt-1.5 text-center text-[9px] leading-4 text-muted-foreground/70">
        <CandlestickChart className="h-3 w-3 flex-none" />
        رسم‌ها و اندیکاتورهای داخل ویجت ذخیره نمی‌شوند — برای ذخیره با حساب خودتان از دکمه «ورود به حساب» استفاده کنید
      </p>
    </div>
  );
}
