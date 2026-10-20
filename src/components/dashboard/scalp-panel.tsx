"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Crosshair, LoaderCircle, RefreshCw, TrendingDown, TrendingUp, Hourglass } from "lucide-react";
import { faTime, faDigits } from "@/lib/tehran";
import type { RangeWarning } from "@/lib/trader-engine";
import type { ScalpResult } from "@/lib/scalp-engine";

/**
 * پنل پیشنهاد اسکلپ — پورت اندیکاتور کاربر (SBW + OB + ستاپ ۴ساعته + واگرایی)
 * در اپ «پیشنهاد معامله» با انتخاب نماد/تایم‌فریم و در «پنجره مستقل سیگنال اسکلپ اونس»
 * با نماد ثابت طلا استفاده می‌شود. خروجی اطلاع‌رسانی الگوریتمی است، نه سیگنال قطعی.
 */

export interface ScalpResponse {
  ok: boolean;
  error?: string;
  symbol?: string;
  symbolLabel?: string;
  symbolMono?: string;
  tf?: string;
  tfLabel?: string;
  anchor?: string;
  engine?: ScalpResult;
  rangeWarning?: RangeWarning;
  generatedAtISO?: string;
  cached?: boolean;
  basis?: {
    applied: boolean;
    spot?: number;
    futures?: number;
    basis?: number;
    source?: string;
    note?: string;
  } | null;
  freshness?: { lastAgeSec: number; stale: boolean; lastBarISO: string; note: string | null } | null;
  feedNote?: string;
}

const SYMBOLS: { k: string; label: string }[] = [
  { k: "xau", label: "طلا (اونس)" },
  { k: "xag", label: "نقره" },
  { k: "eurusd", label: "یورو/دلار" },
  { k: "dji", label: "داوجونز" },
  { k: "btc", label: "بیت‌کوین" },
];

const TFS: { k: string; label: string }[] = [
  { k: "1m", label: "۱دقیقه" },
  { k: "5m", label: "۵دقیقه" },
  { k: "15m", label: "۱۵دقیقه" },
];

const K_SCALP = "sd_scalp_v1";
const K_SCALP_ANCHOR = "sd_scalp_anchor_v1";

const ANCHORS: { k: "broker" | "utc"; label: string; hint: string }[] = [
  { k: "broker", label: "تراز بروکر/نیویورک", hint: "مرز کندل ۴ساعته مثل چارت OANDA و بروکرهای MT (۱۷:۰۰ نیویورک)" },
  { k: "utc", label: "تراز UTC", hint: "مرز کندل در ۰۰:۰۰، ۰۴:۰۰، … UTC (رفتار قبلی ابزار)" },
];

function fmt(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  const s = v.toLocaleString("en-US", { maximumFractionDigits: digits });
  return faDigits(s).replace(/,/g, "٬");
}

function SetupChip({ label, state }: { label: string; state: "armed" | "retest" | "idle" }) {
  const cls =
    state === "retest"
      ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
      : state === "armed"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-border/70 bg-card/60 text-muted-foreground";
  const txt = state === "retest" ? "در انتظار ریتست" : state === "armed" ? "مسلح" : "غیرفعال";
  return (
    <span className={`rounded-full border px-1.5 py-px text-[9px] font-bold ${cls}`}>
      {label}: {txt}
    </span>
  );
}

export function ScalpPanel({
  fixedSymbol,
  autoRefreshMs = 0,
}: {
  /** اگر ست شود، پنجره مستقل است: نماد ثابت + بروزرسانی خودکار */
  fixedSymbol?: string;
  autoRefreshMs?: number;
}) {
  const [symbol, setSymbol] = useState<string>(fixedSymbol ?? "xau");
  const [tf, setTf] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(K_SCALP);
      if (raw && TFS.some((t) => t.k === raw)) return raw;
    } catch {
      /* پیش‌فرض */
    }
    return "5m";
  });
  /** null = پیش‌فرض سرور (بروکر برای فلزات/فارکس، UTC برای بیت‌کوین) */
  const [anchor, setAnchor] = useState<"broker" | "utc" | null>(() => {
    try {
      const raw = localStorage.getItem(K_SCALP_ANCHOR);
      if (raw === "broker" || raw === "utc") return raw;
    } catch {
      /* پیش‌فرض */
    }
    return null;
  });
  const [data, setData] = useState<ScalpResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const load = useCallback(
    (force: boolean) => {
      if (busy.current) return;
      busy.current = true;
      setLoading(true);
      setError(null);
      fetch(`/api/scalp?symbol=${symbol}&tf=${tf}${anchor ? `&anchor=${anchor}` : ""}${force ? "&force=1" : ""}`)
        .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
        .then(({ ok, j }) => {
          if (ok && j?.ok) setData(j as ScalpResponse);
          else setError(String(j?.error ?? "خطای نامشخص"));
        })
        .catch(() => setError("ارتباط با سرور برقرار نشد"))
        .finally(() => {
          busy.current = false;
          setLoading(false);
        });
    },
    [symbol, tf, anchor],
  );

  useEffect(() => {
    const t = setTimeout(() => load(fixedSymbol ? true : false), 0);
    return () => clearTimeout(t);
  }, [load, fixedSymbol]);

  /* بروزرسانی خودکار پنجره مستقل اونس */
  useEffect(() => {
    if (!fixedSymbol || !autoRefreshMs) return;
    const iv = setInterval(() => load(true), autoRefreshMs);
    return () => clearInterval(iv);
  }, [fixedSymbol, autoRefreshMs, load]);

  const e = data?.engine;
  const sg = e?.suggestion ?? null;
  const at = data?.generatedAtISO ? faTime(new Date(data.generatedAtISO)) : "";

  const applyTf = (k: string) => {
    setTf(k);
    try {
      localStorage.setItem(K_SCALP, k);
    } catch {
      /* حالت ناشناس */
    }
  };

  const applyAnchor = (k: "broker" | "utc") => {
    setAnchor(k);
    try {
      localStorage.setItem(K_SCALP_ANCHOR, k);
    } catch {
      /* حالت ناشناس */
    }
  };

  /* پنجرهٔ کندل ملاک ۴ساعته به وقت تهران — برای صحت‌سنجی کاربر با چارت بروکر */
  const h4Ref = e?.h4Ref ?? null;
  const h4WinFa = h4Ref ? `${faTime(new Date(h4Ref.startT * 1000))} تا ${faTime(new Date(h4Ref.endT * 1000))}` : "";
  const activeAnchor = (data?.anchor as "broker" | "utc" | undefined) ?? anchor ?? "broker";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3" data-testid={fixedSymbol ? "scalp-signal" : "scalp-suggestion"}>
      {/* سربرگ */}
      <div className="flex flex-wrap items-center gap-2">
        <Crosshair className="h-4 w-4 shrink-0 text-amber-300" />
        <span className="text-xs font-extrabold">{fixedSymbol ? "سیگنال اسکلپ اونس — XAUUSD" : "پیشنهاد اسکلپ"}</span>
        <span className="text-[9px] text-muted-foreground">موتور اندیکاتور: SBW موج شکست · اوردر بلاک FVG · ستاپ ۴ساعته · واگرایی ۵ابزاری</span>
      </div>

      {/* انتخاب تایم‌فریم (نماد فقط در حالت غیرمستقل) */}
      <div className="flex flex-wrap items-center gap-1.5">
        {!fixedSymbol && (
          <div className="flex flex-wrap items-center gap-1.5" data-testid="scalp-syms">
            {SYMBOLS.map((s) => (
              <button
                key={s.k}
                type="button"
                onClick={() => setSymbol(s.k)}
                className={`rounded-full border px-2 py-1 text-[10px] font-bold transition-colors ${
                  symbol === s.k ? "border-amber-500/60 bg-amber-500/20 text-amber-200" : "border-border/70 bg-card/60 text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5" data-testid="scalp-tfs">
          {TFS.map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => applyTf(t.k)}
              className={`rounded-full border px-2 py-1 text-[10px] font-bold transition-colors ${
                tf === t.k ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-200" : "border-border/70 bg-card/60 text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* تراز مرز کندل ۴ساعته — مطابق چارت بروکر کاربر */}
        <div className="flex items-center gap-1.5" data-testid="scalp-anchors" title={ANCHORS.find((a) => a.k === activeAnchor)?.hint}>
          {ANCHORS.map((a) => (
            <button
              key={a.k}
              type="button"
              onClick={() => applyAnchor(a.k)}
              className={`rounded-full border px-2 py-1 text-[10px] font-bold transition-colors ${
                activeAnchor === a.k ? "border-violet-500/60 bg-violet-500/20 text-violet-200" : "border-border/70 bg-card/60 text-muted-foreground"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          aria-label="بروزرسانی اسکلپ"
          data-testid="scalp-refresh"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-white/15 bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* حالت‌ها */}
      {loading && !data && (
        <div className="flex flex-col items-center gap-1.5 py-4 text-center">
          <LoaderCircle className="h-6 w-6 animate-spin text-amber-300" />
          <p className="text-xs font-bold text-foreground/85">در حال تحلیل کندل‌ها…</p>
          <p className="text-[10px] text-muted-foreground">موج، اوردر بلاک‌ها و ستاپ ۴ساعته روی داده Yahoo Finance</p>
        </div>
      )}
      {!loading && error && (
        <div className="flex flex-col items-center gap-1.5 py-3 text-center">
          <AlertTriangle className="h-6 w-6 text-amber-400" />
          <p className="text-[11px] leading-5 text-muted-foreground">{error}</p>
          <button type="button" onClick={() => load(true)} className="rounded-full border border-amber-500/50 bg-amber-500/15 px-3.5 py-1.5 text-xs font-extrabold text-amber-200">
            تلاش مجدد
          </button>
        </div>
      )}

      {data?.ok && e && (
        <>
          {/* هشدار تازگی داده — کندل آخر منبع قدیمی است؟ */}
          {data.freshness?.stale && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-2 py-1.5" data-testid="scalp-stale">
              <p className="text-[10.5px] font-black text-amber-200">⚠ دادهٔ منبع به‌روز نیست</p>
              <p className="mt-0.5 text-[9.5px] leading-4 text-foreground/85">{data.freshness.note}</p>
            </div>
          )}
          {/* کالیبراسیون اسپات — هم‌ترازی سطوح با چارت اسپات کاربر */}
          {data.basis && (
            <div
              className={`rounded-lg border px-2 py-1.5 ${data.basis.applied ? "border-sky-500/40 bg-sky-500/10" : "border-amber-500/50 bg-amber-500/10"}`}
              data-testid="scalp-basis"
            >
              <p className={`text-[10px] font-black ${data.basis.applied ? "text-sky-200" : "text-amber-200"}`}>
                {data.basis.applied
                  ? `✓ سطوح با اسپات هم‌تراز شدند (اختلاف آتی↔اسپات لحظه‌ای: ${fmt(data.basis.basis, 2)} دلار)`
                  : "⚠ کالیبراسیون اسپات انجام نشد — سطوح بر اساس بازار آتی‌اند و با چارت اسپات اختلاف دارند"}
              </p>
              <p className="mt-0.5 text-[9px] leading-4 text-foreground/80">{data.basis.note}</p>
            </div>
          )}
          {/* هشدار کیفیت داده */}
          {e.degraded && (
            <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-2 py-1.5" data-testid="scalp-degraded">
              <p className="text-[10.5px] font-black text-amber-200">⚠ کیفیت داده این تایم‌فریم برای موتور اسکلپ کافی نیست</p>
              <p className="mt-0.5 text-[9.5px] leading-4 text-foreground/85">{e.notesFa[0]}</p>
            </div>
          )}
          {/* کارت سیگنال / انتظار */}
          {sg ? (
            <div
              className={`rounded-lg border p-2.5 ${
                sg.side === "buy" ? "border-emerald-500/40 bg-emerald-500/10" : "border-rose-500/40 bg-rose-500/10"
              }`}
              data-testid="scalp-verdict"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1 text-[13px] font-black ${sg.side === "buy" ? "text-emerald-300" : "text-rose-300"}`}>
                  {sg.side === "buy" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {sg.side === "buy" ? "پیشنهاد خرید اسکلپ" : "پیشنهاد فروش اسکلپ"}
                </span>
                <span className="rounded-full bg-black/30 px-1.5 py-px text-[9px] font-bold text-zinc-300">
                  {sg.kind === "setup4h" ? "ستاپ ۴ساعته" : "برخورد اوردر بلاک"} · {faDigits(sg.signalBarsAgo)} کندل پیش
                </span>
              </div>
              {/* وضعیت سیگنال نسبت به قیمت فعلی + فاصلهٔ واقعی تا ناحیه */}
              <div
                className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-md border px-1.5 py-1 text-[9.5px] font-bold ${
                  sg.status === "active"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                    : sg.status === "far"
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                      : "border-rose-500/50 bg-rose-500/10 text-rose-200"
                }`}
                data-testid="scalp-status"
              >
                <span>وضعیت نسبت به قیمت فعلی: {sg.statusFa}</span>
                <span dir="ltr">
                  Δ {fmt(sg.dist, 2)}{sg.distAtr !== null && sg.distAtr !== undefined ? ` (${fmt(sg.distAtr, 2)}×ATR)` : ""}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10.5px] font-bold">
                <p>ناحیه ورود (حدودی): <span dir="ltr">{fmt(sg.entryLo, 2)} – {fmt(sg.entryHi, 2)}</span></p>
                <p>حد ضرر: <span className="text-rose-300" dir="ltr">{fmt(sg.sl, 2)}</span></p>
                <p>هدف ۱: <span className="text-emerald-300" dir="ltr">{fmt(sg.tp1, 2)}</span></p>
                <p>هدف ۲: <span className="text-emerald-300" dir="ltr">{fmt(sg.tp2, 2)}</span></p>
              </div>
              <p className="mt-1 text-[9px] leading-4 text-muted-foreground">{sg.reasonFa}</p>
              <p className="mt-0.5 text-[9px] leading-4 text-amber-300/90">
                ابطال محاسباتی: بسته‌شدن کندل خارج و خلاف ناحیه ورود — اجرا، حجم و ریسک بر عهده خودتان است.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/70 bg-card/50 p-2.5" data-testid="scalp-waiting">
              <div className="flex items-center gap-1.5 text-[12px] font-black text-zinc-200">
                <Hourglass className="h-3.5 w-3.5 text-amber-300" />
                سیگنال تازه‌ای صادر نشده است
              </div>
              <p className="mt-1 text-[9.5px] leading-4 text-muted-foreground">
                اندیکاتور فعلاً ستاپ کامل (برخورد ← شکست ← ریتست ← الگو) یا برخورد تازه به زون OB ندارد؛ این وضعیت «عدم سیگنال» است، نه «عدم داده».
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <SetupChip label="ستاپ فروش" state={e.setup.sell} />
                <SetupChip label="ستاپ خرید" state={e.setup.buy} />
              </div>
              {e.setup.sell === "retest" && e.setup.sellZone && (
                <p className="mt-1 text-[9px] leading-4 text-violet-200">
                  ناحیه ریتست فروش: <span dir="ltr">{fmt(e.setup.sellZone.lo)} – {fmt(e.setup.sellZone.hi)}</span> — اگر قیمت به ناحیه برگردد و الگوی نزولی تأیید شود، سیگنال فروش ثبت می‌شود.
                </p>
              )}
              {e.setup.buy === "retest" && e.setup.buyZone && (
                <p className="mt-1 text-[9px] leading-4 text-violet-200">
                  ناحیه ریتست خرید: <span dir="ltr">{fmt(e.setup.buyZone.lo)} – {fmt(e.setup.buyZone.hi)}</span> — بازگشت به ناحیه + الگوی صعودی = سیگنال خرید.
                </p>
              )}
            </div>
          )}

          {/* هشدار رنج فشرده در تایم‌فریم اسکلپ */}
          {data.rangeWarning?.active && (
            <div className={`rounded-lg border px-2 py-1.5 ${data.rangeWarning.severity === "tight" ? "border-rose-500/60 bg-rose-500/15" : "border-amber-500/50 bg-amber-500/10"}`}>
              <p className={`text-[10.5px] font-black ${data.rangeWarning.severity === "tight" ? "text-rose-200" : "text-amber-200"}`}>
                {data.rangeWarning.severity === "tight" ? "هشدار جدی: رنج فشرده در تایم‌فریم اسکلپ" : "هشدار: بازار رنج است"}
              </p>
              <p className="mt-0.5 text-[9.5px] leading-4 text-foreground/85">{data.rangeWarning.message}</p>
            </div>
          )}

          {/* سطوح مهم */}
          <div className="rounded-lg border border-border/60 bg-background/40 p-2">
            <p className="text-[10px] font-extrabold text-sky-200">سطوح مهم (مقادیر حدودی)</p>
            {h4Ref ? (
              <p className="mt-0.5 text-[9px] font-bold leading-4 text-zinc-300" data-testid="scalp-h4ref">
                کندل ملاک ۴ساعته: {h4WinFa} به وقت تهران (بسته‌شده)
                {h4Ref.gap > 0 ? <span className="text-amber-300"> — گپ فید: کندل بلافصل در داده نبود</span> : null}
              </p>
            ) : (
              <p className="mt-0.5 text-[9px] font-bold text-amber-300">کندل ملاک ۴ساعته در دسترس نیست (تأخیر فید یا تعطیلی بازار)</p>
            )}
            <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[9.5px] font-bold">
              <p>
                سقف کندل ۴ساعتهٔ بسته‌شده: <span className="text-rose-300" dir="ltr">{fmt(e.h4High)}</span>
              </p>
              <p>
                کف کندل ۴ساعتهٔ بسته‌شده: <span className="text-emerald-300" dir="ltr">{fmt(e.h4Low)}</span>
              </p>
              <p>آخرین سقف سوئینگ: <span dir="ltr">{fmt(e.swingHigh)}{e.swingHighBroken ? " (شکسته)" : ""}</span></p>
              <p>آخرین کف سوئینگ: <span dir="ltr">{fmt(e.swingLow)}{e.swingLowBroken ? " (شکسته)" : ""}</span></p>
            </div>
            {(e.supplyZones.length > 0 || e.demandZones.length > 0) && (
              <div className="mt-1.5 flex flex-col gap-1">
                {e.supplyZones.map((z, i) => (
                  <p key={`s${i}`} className="text-[9.5px] font-bold text-rose-200/90">
                    زون فروش OB (زنده): <span dir="ltr">{fmt(z.bot)} – {fmt(z.top)}</span>
                  </p>
                ))}
                {e.demandZones.map((z, i) => (
                  <p key={`d${i}`} className="text-[9.5px] font-bold text-emerald-200/90">
                    زون خرید OB (زنده): <span dir="ltr">{fmt(z.bot)} – {fmt(z.top)}</span>
                  </p>
                ))}
              </div>
            )}
            {e.wave.active && (
              <p className="mt-1 text-[9.5px] leading-4 text-zinc-300">
                موج شکست {e.wave.active === "bear" ? "نزولی" : "صعودی"} فعال است ({faDigits(Math.round((e.wave.nAtr ?? 0) * 100) / 100)} برابر ATR) — سطح پایان موج (اصلاح ۲۳٪): <span dir="ltr">{fmt(e.wave.retrLevel)}</span>
              </p>
            )}
            {e.setup.unavailable && <p className="mt-1 text-[9px] text-amber-300">ستاپ ۴ساعته محاسبه نشد: {e.notesFa[0] ?? "داده ۴ساعته کافی نیست"}</p>}
          </div>

          {/* واگرایی */}
          <p className="rounded-lg border border-border/60 bg-background/40 px-2 py-1.5 text-[9.5px] leading-4 text-zinc-300">
            واگرایی چندابزاری (RSI/MACD/Stoch/CCI/MFI — توافق ۳ از ۵): {e.divergence.noteFa}
          </p>

          {/* سیگنال‌های اخیر */}
          {e.signals.length > 0 && (
            <div className="rounded-lg border border-border/60 bg-background/40 p-2">
              <p className="text-[10px] font-extrabold text-zinc-200">سیگنال‌های اخیر موتور (۶ مورد آخر)</p>
              <div className="mt-1 flex flex-col gap-0.5">
                {[...e.signals].reverse().map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-[9px]">
                    <span className={s.side === "buy" ? "font-bold text-emerald-300" : "font-bold text-rose-300"}>
                      {s.side === "buy" ? "خرید" : "فروش"} — {s.kind === "setup4h" ? "ستاپ ۴ساعته" : "برخورد OB"}
                    </span>
                    <span dir="ltr" className="text-muted-foreground">{fmt(s.zoneLo)} – {fmt(s.zoneHi)}</span>
                    <span className="text-muted-foreground">{faTime(new Date(s.t * 1000))}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-[9px] leading-4 text-muted-foreground/70">
            {data.symbolLabel} · تایم‌فریم {data.tfLabel} · قیمت آخرین کندل بسته‌شده (کالیبره به اسپات): <span dir="ltr">{fmt(e.lastClose)}</span> · ATR۱۴: <span dir="ltr">{fmt(e.atr)}</span>
            {at ? <> · آخرین محاسبه: {at}</> : null}
            <br />
            {data.feedNote} پورت الگوریتمی اندیکاتور کاربر روی کندل‌های Yahoo Finance — سطوح حدودی‌اند و این خروجی سیگنال قطعی یا توصیه خرید/فروش نیست؛ تایم‌فریم‌های کوچک نویز بیشتری دارند.
          </p>
        </>
      )}
    </div>
  );
}
