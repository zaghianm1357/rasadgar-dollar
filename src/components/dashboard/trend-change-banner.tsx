"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X, BellRing } from "lucide-react";
import type {
  MarketStructureResponse,
  MSTrendChange,
  MSTimeframe,
  MSTrend,
} from "@/lib/types";
import { faDigits, faTime } from "@/lib/tehran";

/**
 * اعلان چشمک‌زن «تغییر جهت بازار» — بالای صفحه اصلی.
 * وقتی جهت روند یک تایم‌فریم ساختاری (۱۵m تا ماهانه) برای طلا یا داو بین دو محاسبه
 * متوالی سرور عوض شود، این اعلان به‌صورت چشمک‌زن نمایش داده می‌شود.
 * کاربر می‌تواند آن را ببندد؛ با تغییر جدید دوباره ظاهر می‌شود.
 */

const CLIENT_REFRESH_MS = 5 * 60 * 1000; // هم‌تراز با پولینگ پنل ساختار بازار
const DISMISS_KEY = "trend_banner_dismissed_v1";
const MAX_ROWS = 3; // حداکثر ردیف قابل نمایش — بقیه به‌صورت «+N تغییر دیگر»

const TF_LABEL: Record<MSTimeframe, string> = {
  "5m": "۵ دقیقه",
  "15m": "۱۵ دقیقه",
  "1h": "۱ ساعته",
  "4h": "۴ ساعته",
  "1d": "روزانه",
  "1wk": "هفتگی",
  "1mo": "ماهانه",
};

const SYMBOL_LABEL: Record<MSTrendChange["symbol"], string> = {
  xau: "طلا",
  dji: "داوجونز",
};

function trendText(t: MSTrend): string {
  return t === "bullish" ? "صعودی" : t === "bearish" ? "نزولی" : "خنثی";
}

function trendCls(t: MSTrend): string {
  return t === "bullish"
    ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-400"
    : t === "bearish"
      ? "border-rose-500/35 bg-rose-500/12 text-rose-400"
      : "border-zinc-500/35 bg-zinc-500/12 text-zinc-400";
}

/** امضای فهرست تغییرات — برای تشخیص «تغییر جدید» بعد از بستن اعلان */
function changesSignature(changes: MSTrendChange[]): string {
  return changes
    .map((c) => `${c.symbol}:${c.tf}:${c.from}>${c.to}:${c.atISO}`)
    .join("|");
}

function ChangeRow({ change }: { change: MSTrendChange }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border/60 bg-background/50 px-2.5 py-1.5">
      <span className="text-[11px] font-extrabold">{SYMBOL_LABEL[change.symbol]}</span>
      <span className="text-[10px] text-muted-foreground">{TF_LABEL[change.tf]}</span>
      <span className="mx-1 hidden h-3 w-px bg-border sm:inline-block" />
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${trendCls(change.from)}`}
      >
        {trendText(change.from)}
      </span>
      <span aria-hidden className="text-[11px] font-bold text-muted-foreground">
        ←
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${trendCls(change.to)}`}
      >
        {trendText(change.to)}
      </span>
      <span className="ms-auto text-[9px] tabular-nums text-muted-foreground/80">
        ساعت {faTime(new Date(change.atISO))}
      </span>
    </div>
  );
}

export function TrendChangeBanner() {
  const [changes, setChanges] = useState<MSTrendChange[] | null>(null);
  // خواندن تنبل localStorage — تنها پس از لود تغییرها اثرگذار است (رندر اول همیشه null است)
  const [dismissedSig, setDismissedSig] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  const fetchChanges = useCallback(async () => {
    try {
      const res = await fetch("/api/market-structure", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as MarketStructureResponse;
      setChanges(json.changes ?? []);
    } catch {
      /* خطای شبکه — اعلان قبلی حفظ می‌شود */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/market-structure", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as MarketStructureResponse;
        if (alive) setChanges(json.changes ?? []);
      } catch {
        /* خطای شبکه — اعلان قبلی حفظ می‌شود */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchChanges();
    }, CLIENT_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchChanges]);

  const visible = useMemo(() => {
    if (!changes || changes.length === 0) return false;
    if (!dismissedSig) return true;
    return changesSignature(changes) !== dismissedSig;
  }, [changes, dismissedSig]);

  const dismiss = () => {
    if (!changes) return;
    const sig = changesSignature(changes);
    try {
      localStorage.setItem(DISMISS_KEY, sig);
    } catch {
      /* حالت ناشناس — فقط در همین جلسه بسته می‌ماند */
    }
    setDismissedSig(sig);
  };

  if (!visible || !changes || changes.length === 0) return null;
  const shown = changes.slice(0, MAX_ROWS);
  const extra = changes.length - shown.length;

  return (
    <div
      role="alert"
      className="animate-fade-up animate-alert-blink rounded-xl border border-amber-500/60 bg-amber-500/5 p-3 sm:p-4"
    >
      {/* سربرگ اعلان */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/15">
          <BellRing className="animate-soft-pulse h-4 w-4 text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-extrabold leading-5 text-amber-300">
            تغییر جهت بازار!
          </h2>
          <p className="text-[10px] leading-4 text-muted-foreground">
            جهت روند ساختار در {faDigits(changes.length)} مورد تغییر کرد —{" "}
            {changes.length > 1 ? "موارد زیر جدیدترین‌اند" : "جزئیات زیر"}.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="بستن اعلان تغییر جهت"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* فهرست تغییرات — جدیدترین اول */}
      <div className="mt-2.5 flex flex-col gap-1.5">
        {shown.map((c) => (
          <ChangeRow key={`${c.symbol}:${c.tf}:${c.atISO}`} change={c} />
        ))}
        {extra > 0 && (
          <p className="px-1 text-[10px] font-bold text-amber-400/90">
            + {faDigits(extra)} تغییر دیگر در ۶ ساعت گذشته
          </p>
        )}
      </div>

      <p className="mt-2 px-1 text-[9px] leading-4 text-muted-foreground/70">
        مقایسه دو محاسبه متوالی ساختار بازار (هر ۱۵ دقیقه)؛ تغییرهای واقعی جهت —
        نه ظاهر شدن روند از حالت ناکافی. بروزرسانی خودکار هر ۵ دقیقه.
      </p>
    </div>
  );
}
