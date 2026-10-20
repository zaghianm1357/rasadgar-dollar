"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  LineChart,
  Map as MapIcon,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { faDigits, faTime } from "@/lib/tehran";
import { buildPathMap, type PathMapInput, type PathMapOut } from "@/lib/path-map";
import type { GoldBriefing } from "@/lib/analysis-sources";
import type { NewsEvent, NewsResponse } from "@/lib/types";
import type { TraderResponse } from "@/lib/trader-types";
import type { PressureResponse } from "./thermometer-tab";

/* ---------- ابزار نمایش ---------- */

function faNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return faDigits(
    Number(v.toFixed(digits)).toLocaleString("en-US", { maximumFractionDigits: digits })
  ).replace(/,/g, "٬");
}

const DIR_ICON: Record<string, { icon: string; cls: string }> = {
  buy: { icon: "▲", cls: "text-emerald-300" },
  sell: { icon: "▼", cls: "text-rose-300" },
  neutral: { icon: "●", cls: "text-zinc-400" },
};

type SubTab = "brief" | "path";

/* ---------- نرخ اخبار مهم حل‌شده (برای رأی اخبار در نقشه مسیر) ---------- */

function numFrom(s: string | null): number | null {
  if (!s) return null;
  const n = Number(String(s).replace(/[,%\s]/g, "").replace(/[KM]$/i, ""));
  return isFinite(n) ? n : null;
}

function newsBiasFromEvents(events: NewsEvent[]): { dir: "buy" | "sell" | "neutral"; detailFa: string } | null {
  const now = Date.now();
  let buy = 0;
  let sell = 0;
  let resolved = 0;
  for (const e of events) {
    if (e.impact !== "High") continue;
    if (!e.dateISO || !e.actual || !e.forecast) continue;
    const t = new Date(e.dateISO).getTime();
    if (!isFinite(t) || t < now - 36 * 3600_000 || t > now + 36 * 3600_000) continue;
    const a = numFrom(e.actual);
    const f = numFrom(e.forecast);
    if (a === null || f === null || a === f) continue;
    const d = a > f ? e.xauAbove : e.xauBelow; // جهت واقعی طلا بر اساس مقایسه با پیش‌بینی
    if (!d) continue;
    resolved++;
    if (d === "bullish") buy++;
    else if (d === "bearish") sell++;
  }
  if (resolved === 0) return null;
  const dir = buy > sell ? "buy" : sell > buy ? "sell" : "neutral";
  const detailFa =
    dir === "neutral"
      ? `${faDigits(resolved)} خبر مهم امروز/فردا منتشر شد — اثر خنثی یا دووجهی بر طلا`
      : `${faDigits(resolved)} خبر مهم حل‌شده — بیشترشان متمایل به ${dir === "buy" ? "تقویت" : "تضعیف"} طلا بود`;
  return { dir, detailFa };
}

function hotEventsFa(events: NewsEvent[]): { timeFa: string; titleFa: string; impact: string }[] {
  const now = Date.now();
  return events
    .filter((e) => e.impact === "High" && e.dateISO)
    .map((e) => ({ e, t: new Date(e.dateISO as string).getTime() }))
    .filter(({ t }) => isFinite(t) && t > now - 6 * 3600_000 && t < now + 36 * 3600_000)
    .sort((a, b) => a.t - b.t)
    .slice(0, 4)
    .map(({ e, t }) => ({
      timeFa: faTime(new Date(t)),
      titleFa: e.titleFa || e.title,
      impact: e.impact,
    }));
}

/* ---------- اپ تحلیل و پیش‌بینی ---------- */

export function AnalysisApp() {
  const [subTab, setSubTab] = useState<SubTab>("brief");

  /* داده بریفینگ */
  const [brief, setBrief] = useState<GoldBriefing | null>(null);
  const [briefStatus, setBriefStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [briefErr, setBriefErr] = useState<string | null>(null);

  /* داده نقشه مسیر */
  const [trader, setTrader] = useState<TraderResponse | null>(null);
  const [pt1d, setPt1d] = useState<PressureResponse | null>(null);
  const [pt4h, setPt4h] = useState<PressureResponse | null>(null);
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [pathStatus, setPathStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [pathErr, setPathErr] = useState<string | null>(null);

  const loadBrief = useCallback(async (force: boolean) => {
    setBriefStatus("loading");
    setBriefErr(null);
    try {
      const res = await fetch(`/api/analysis/gold${force ? "?force=1" : ""}`, { cache: "no-store" });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "خطا در دریافت تحلیل‌ها");
      setBrief(j as GoldBriefing);
      setBriefStatus("done");
    } catch (e) {
      setBriefErr(e instanceof Error ? e.message : "خطای نامشخص");
      setBriefStatus("error");
    }
  }, []);

  const loadPath = useCallback(async () => {
    setPathStatus("loading");
    setPathErr(null);
    const grab = async <T,>(url: string): Promise<T | null> => {
      try {
        const r = await fetch(url, { cache: "no-store" });
        const j = await r.json();
        return r.ok ? (j as T) : null;
      } catch {
        return null;
      }
    };
    const [t, p1, p4, n] = await Promise.all([
      grab<TraderResponse>("/api/trader?symbol=xau"),
      grab<PressureResponse>("/api/pressure?symbol=xau&tf=1d"),
      grab<PressureResponse>("/api/pressure?symbol=xau&tf=4h"),
      grab<NewsResponse>("/api/news"),
    ]);
    setTrader(t);
    setPt1d(p1);
    setPt4h(p4);
    setNews(n);
    if (!t && !p1 && !p4) {
      setPathErr("هیچ‌یک از منابع داخلی (ساختار/دماسنج) در دسترس نبود — اتصال را بررسی کنید");
      setPathStatus("error");
      return;
    }
    /* بریفینگ هم برای رأی LiteFinance لازم است — اگر از قبل نیست، بگیر */
    if (!brief) void loadBrief(false);
    setPathStatus("done");
  }, [brief, loadBrief]);

  /* بارگذاری تنبل هر تب */
  useEffect(() => {
    if (subTab === "brief" && briefStatus === "idle") void loadBrief(false);
    if (subTab === "path" && pathStatus === "idle") void loadPath();
  }, [subTab, briefStatus, pathStatus, loadBrief, loadPath]);

  /* محاسبه نقشه مسیر — تلفیق ۷ منبع */
  const pathMap: PathMapOut | null = useMemo(() => {
    if (!trader && !pt1d && !pt4h) return null;
    const row4h = trader?.structure.rows.find((r) => r.tf === "4h") ?? null;
    const row1d = trader?.structure.rows.find((r) => r.tf === "1d") ?? null;
    const resolvedNews = news ? newsBiasFromEvents(news.events) : null;
    const input: PathMapInput = {
      price: trader?.symbol.price ?? pt1d?.price.value ?? null,
      support: trader?.structure.support ?? null,
      resistance: trader?.structure.resistance ?? null,
      structure4h: row4h ? row4h.trend : null,
      structure1d: row1d ? row1d.trend : null,
      rangeActive: trader?.rangeWarning.active ?? false,
      rangeSeverity: trader?.rangeWarning.severity ?? null,
      thermo1d: pt1d ? { dir: pt1d.dir, zoneFa: pt1d.zoneFa, score: pt1d.score } : null,
      thermo4h: pt4h ? { dir: pt4h.dir, zoneFa: pt4h.zoneFa, score: pt4h.score } : null,
      tvDailyStateFa: brief?.tv.ok ? brief.tv.stateFa : null,
      lite:
        brief?.lite.ok && brief.lite.baseScenario
          ? {
              baseScenario: brief.lite.baseScenario,
              tomorrowHigh: brief.lite.tomorrow.high,
              tomorrowLow: brief.lite.tomorrow.low,
            }
          : null,
      newsResolved: resolvedNews,
    };
    return buildPathMap(input);
  }, [trader, pt1d, pt4h, news, brief]);

  const hotHours = useMemo(() => (news ? hotEventsFa(news.events) : []), [news]);

  return (
    <div className="flex flex-col gap-3" data-testid="an-root">
      {/* سوییچ زیرتب */}
      <div className="flex items-center gap-1.5" data-testid="an-tabs">
        <button
          type="button"
          onClick={() => setSubTab("brief")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-2 py-1.5 text-[11px] font-bold transition-colors ${
            subTab === "brief"
              ? "border-cyan-500/60 bg-cyan-500/20 text-cyan-200"
              : "border-border/70 bg-card/60 text-muted-foreground"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          تحلیل و پیش‌بینی
        </button>
        <button
          type="button"
          onClick={() => setSubTab("path")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-2 py-1.5 text-[11px] font-bold transition-colors ${
            subTab === "path"
              ? "border-violet-500/60 bg-violet-500/20 text-violet-200"
              : "border-border/70 bg-card/60 text-muted-foreground"
          }`}
        >
          <MapIcon className="h-3.5 w-3.5" />
          نقشهٔ مسیر امروز
        </button>
      </div>

      {subTab === "brief" ? (
        <BriefTab
          brief={brief}
          status={briefStatus}
          error={briefErr}
          onReload={() => loadBrief(true)}
        />
      ) : (
        <PathTab
          pathMap={pathMap}
          status={pathStatus}
          error={pathErr}
          hotHours={hotHours}
          onReload={() => void loadPath()}
        />
      )}
    </div>
  );
}

/* ---------- تب ۱: بریفینگ تحلیل و پیش‌بینی ---------- */

function BriefTab({
  brief,
  status,
  error,
  onReload,
}: {
  brief: GoldBriefing | null;
  status: "idle" | "loading" | "done" | "error";
  error: string | null;
  onReload: () => void;
}) {
  if (status === "idle" || status === "loading") {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2">
        <LineChart className="h-6 w-6 animate-pulse text-cyan-300" />
        <p className="text-xs font-bold text-foreground/80">در حال خواندن تحلیل‌های تازه از LiteFinance، FXStreet و تریدینگ‌ویو…</p>
        <p className="text-[10px] text-muted-foreground">سایت‌های منبع محافظت ابری دارند — ممکن است تا نیم دقیقه طول بکشد</p>
      </div>
    );
  }
  if (status === "error" || !brief) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
        <AlertTriangle className="h-6 w-6 text-amber-400" />
        <p className="max-w-[280px] text-[11px] leading-5 text-muted-foreground">{error ?? "تحلیل‌ها در دسترس نیست"}</p>
        <button type="button" onClick={onReload} className="rounded-full border border-cyan-500/50 bg-cyan-500/15 px-3.5 py-1.5 text-xs font-extrabold text-cyan-200">
          تلاش مجدد
        </button>
      </div>
    );
  }

  const lite = brief.lite;
  const fx = brief.fx;

  return (
    <div className="flex flex-col gap-2" data-testid="an-brief">
      {/* نوار وضعیت داده */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {brief.stale && (
            <span className="rounded-full border border-amber-500/50 bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold text-amber-300">
              {brief.ageMin !== null ? `داده ${faDigits(brief.ageMin)} دقیقه‌ای — منابع زنده در دسترس نبود` : "حالت اسنپ‌شات — منابع زنده در دسترس نبود"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onReload}
          aria-label="بروزرسانی تحلیل‌ها"
          className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-white/15 bg-white/10"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* جمع‌بندی مختصر همه منابع */}
      {brief.summaryFa.length > 0 && (
        <div className="rounded-xl border border-sky-500/40 bg-sky-500/10 p-3" data-testid="an-summary">
          <p className="mb-1.5 text-[12px] font-black text-sky-200">جمع‌بندی مختصر تحلیل و پیش‌بینی</p>
          <ul className="flex flex-col gap-1">
            {brief.summaryFa.map((s, i) => (
              <li key={i} className="flex gap-1.5 text-[10.5px] leading-5 text-foreground/90">
                <span aria-hidden className="mt-0.5 text-sky-400">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* LiteFinance */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[12px] font-black text-amber-200">پیش‌بینی قیمت طلا — LiteFinance</p>
          <span className="text-[8.5px] text-muted-foreground">
            {lite.snapshot && <span className="ml-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold text-amber-300">اسنپ‌شات</span>}
            {lite.via || (lite.ok ? "—" : "در دسترس نبود")}
          </span>
        </div>
        {lite.ok ? (
          <div className="flex flex-col gap-1.5">
            {lite.reportedAtFa && (
              <p className="text-[9px] text-muted-foreground">تاریخ گزارش: <span dir="ltr">{lite.reportedAtFa}</span></p>
            )}
            {(lite.baseScenario === "long" && lite.longAbove !== null) || (lite.baseScenario === "short" && lite.shortBelow !== null) ? (
              <p className="text-[10.5px] leading-5 text-foreground/90">
                {lite.baseScenario === "long" && lite.longAbove !== null && (
                  <>
                    سناریوی اصلی: <b className="text-emerald-300">خرید</b> بالای <b dir="ltr">{faNum(lite.longAbove)}</b>
                    {lite.stopLoss !== null && <> — حد ضرر <b dir="ltr">{faNum(lite.stopLoss)}</b></>}
                    {lite.targets.length > 0 && <> — اهداف: <b dir="ltr">{lite.targets.slice(0, 3).map((t) => faNum(t)).join(" · ")}</b></>}
                  </>
                )}
                {lite.baseScenario === "short" && lite.shortBelow !== null && (
                  <>
                    سناریوی اصلی: <b className="text-rose-300">فروش</b> زیر <b dir="ltr">{faNum(lite.shortBelow)}</b>
                    {lite.stopLoss !== null && <> — حد ضرر <b dir="ltr">{faNum(lite.stopLoss)}</b></>}
                    {lite.targets.length > 0 && <> — اهداف: <b dir="ltr">{lite.targets.slice(0, 3).map((t) => faNum(t)).join(" · ")}</b></>}
                  </>
                )}
              </p>
            ) : null}
            {lite.tomorrow.avg !== null || lite.tomorrow.high !== null ? (
              <p className="text-[10.5px] leading-5 text-foreground/90">
                پیش‌بینی <b>فردا</b>: کف <b dir="ltr">{faNum(lite.tomorrow.low)}</b> · میانگین <b dir="ltr">{faNum(lite.tomorrow.avg)}</b> · سقف <b dir="ltr">{faNum(lite.tomorrow.high)}</b>
              </p>
            ) : null}
            {lite.week.avg !== null ? (
              <p className="text-[10.5px] leading-5 text-foreground/90">
                پیش‌بینی <b>هفته</b>: کف <b dir="ltr">{faNum(lite.week.low)}</b> · میانگین <b dir="ltr">{faNum(lite.week.avg)}</b> · سقف <b dir="ltr">{faNum(lite.week.high)}</b>
              </p>
            ) : null}
            {lite.rsi !== null && (
              <p className="text-[9.5px] leading-4 text-muted-foreground">RSI گزارش: {faNum(lite.rsi, 0)}</p>
            )}
          </div>
        ) : (
          <p className="text-[10px] leading-5 text-muted-foreground">
            دریافت زنده LiteFinance ناموفق بود {lite.error ? `(${lite.error})` : ""} — اعداد این بخش بدون منبع نمایش داده نمی‌شوند.
          </p>
        )}
      </div>

      {/* FXStreet */}
      <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="text-[12px] font-black text-cyan-200">تحلیل‌ها و نظرسنجی — FXStreet</p>
          <span className="text-[8.5px] text-muted-foreground">
            {fx.snapshot && <span className="ml-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[8px] font-bold text-amber-300">اسنپ‌شات</span>}
            {fx.via || (fx.ok ? "—" : "در دسترس نبود")}
          </span>
        </div>
        {fx.ok ? (
          <div className="flex flex-col gap-1.5">
            {fx.poll.length > 0 && (
              <div className="flex flex-col gap-1">
                {fx.poll.map((p, i) => (
                  <p key={i} className="text-[10.5px] leading-5 text-foreground/90">
                    نظرسنجی <b>{p.periodFa}</b>: میانگین <b dir="ltr">{faNum(p.avg)}</b>
                    {p.mixFa && <> — <span className="text-muted-foreground">{p.mixFa}</span></>}
                  </p>
                ))}
              </div>
            )}
            {fx.items.length > 0 && (
              <ul className="flex flex-col gap-1">
                {fx.items.map((it, i) => (
                  <li key={i}>
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-1 text-[10px] leading-5 text-cyan-300/90 underline decoration-cyan-500/30 underline-offset-2"
                    >
                      <ExternalLink className="mt-1 h-3 w-3 flex-none" />
                      <span>{it.titleFa || it.title}</span>
                    </a>
                  </li>
                ))}
                {fx.items.some((i) => !i.titleFa) && (
                  <li className="text-[8.5px] text-muted-foreground">عنوان‌های بدون ترجمه فارسی، به انگلیسی منبع نمایش داده شده‌اند.</li>
                )}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-[10px] leading-5 text-muted-foreground">دریافت زنده FXStreet ناموفق بود {fx.error ? `(${fx.error})` : ""}.</p>
        )}
      </div>

      {/* تریدینگ‌ویو */}
      <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
        <p className="mb-1 text-[12px] font-black text-violet-200">رأی فنی روزانه — تریدینگ‌ویو</p>
        {brief.tv.ok && brief.tv.stateFa ? (
          <p className="text-[10.5px] leading-5 text-foreground/90">
            اجماع فنی تریدینگ‌ویو برای XAUUSD (روزانه): <b className="text-violet-300">{brief.tv.stateFa}</b> — تفکیک کامل در تب «دماسنج فشار».
          </p>
        ) : (
          <p className="text-[10px] leading-5 text-muted-foreground">رأی فنی تریدینگ‌ویو در دسترس نبود — تب «دماسنج فشار» را بررسی کنید.</p>
        )}
      </div>

      <p className="text-center text-[9px] leading-4 text-muted-foreground/80">
        {brief.sourcesNoteFa}
        <br />
        آخرین جمع‌آوری: {faTime(new Date(brief.generatedAtISO))} — خلاصه‌سازی خودکار محتوای منابع است، نه توصیه خرید/فروش.
      </p>
    </div>
  );
}

/* ---------- تب ۲: نقشهٔ مسیر امروز (ایدهٔ خلاقانه) ---------- */

function PathTab({
  pathMap,
  status,
  error,
  hotHours,
  onReload,
}: {
  pathMap: PathMapOut | null;
  status: "idle" | "loading" | "done" | "error";
  error: string | null;
  hotHours: { timeFa: string; titleFa: string; impact: string }[];
  onReload: () => void;
}) {
  if (status === "idle" || status === "loading") {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2">
        <MapIcon className="h-6 w-6 animate-pulse text-violet-300" />
        <p className="text-xs font-bold text-foreground/80">در حال ترسیم نقشهٔ مسیر از همهٔ منابع…</p>
        <p className="text-[10px] text-muted-foreground">دماسنج + ساختار + تریدینگ‌ویو + LiteFinance + اخبار</p>
      </div>
    );
  }
  if (status === "error" || !pathMap) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
        <AlertTriangle className="h-6 w-6 text-amber-400" />
        <p className="max-w-[280px] text-[11px] leading-5 text-muted-foreground">{error ?? "نقشه مسیر قابل ساخت نیست"}</p>
        <button type="button" onClick={onReload} className="rounded-full border border-violet-500/50 bg-violet-500/15 px-3.5 py-1.5 text-xs font-extrabold text-violet-200">
          تلاش مجدد
        </button>
      </div>
    );
  }

  const { dominant, alignment } = pathMap;
  const dominantCls =
    dominant === "bull"
      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
      : dominant === "bear"
        ? "border-rose-500/50 bg-rose-500/10 text-rose-200"
        : "border-zinc-500/50 bg-zinc-500/10 text-zinc-200";
  const scenarioCls: Record<string, string> = {
    bull: "border-emerald-500/40 bg-emerald-500/5",
    bear: "border-rose-500/40 bg-rose-500/5",
    range: "border-zinc-500/40 bg-zinc-500/5",
  };
  const scenarioTitleCls: Record<string, string> = {
    bull: "text-emerald-300",
    bear: "text-rose-300",
    range: "text-zinc-300",
  };

  return (
    <div className="flex flex-col gap-2" data-testid="an-path">
      {/* مسیر غالب */}
      <div className={`rounded-xl border p-3 text-center ${dominantCls}`} data-testid="an-path-dominant">
        <p className="text-[13px] font-black">{pathMap.dominantFa}</p>
        <p className="mt-0.5 text-[10px] text-foreground/85">{pathMap.confidenceFa}</p>
        <p className="mt-1 text-[9.5px] text-muted-foreground">
          {faDigits(alignment.buy)} رأی خرید · {faDigits(alignment.sell)} رأی فروش · {faDigits(alignment.neutral)} خنثی — از {faDigits(alignment.total)} منبع
        </p>
      </div>

      {/* رأی منابع — فقط نتیجه */}
      <div className="rounded-xl border border-border/70 bg-card/60 p-3">
        <p className="mb-2 text-[11px] font-extrabold text-foreground/90">رأی هر منبع (فقط نتیجه)</p>
        <div className="flex flex-col gap-1">
          {pathMap.sources.map((s) => {
            const m = DIR_ICON[s.dir] ?? DIR_ICON.neutral;
            return (
              <div key={s.id} className={`flex items-center justify-between gap-2 rounded-lg border border-border/40 bg-background/40 px-2 py-1.5 ${s.available ? "" : "opacity-50"}`}>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-foreground/90">{s.labelFa}</p>
                  <p className="truncate text-[8.5px] text-muted-foreground">{s.detailFa}</p>
                </div>
                <span className={`flex-none text-[11px] font-black ${m.cls}`}>
                  {s.available ? m.icon : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* سه سناریوی مسیر */}
      {pathMap.scenarios.map((sc) => (
        <div key={sc.id} className={`rounded-xl border p-3 ${scenarioCls[sc.id]}`} data-testid={`an-path-${sc.id}`}>
          <div className="flex items-center justify-between gap-2">
            <p className={`text-[12px] font-black ${scenarioTitleCls[sc.id]}`}>{sc.titleFa}</p>
            {dominant === sc.id && (
              <span className="rounded-full border border-white/20 bg-white/10 px-1.5 py-0.5 text-[8px] font-bold">مسیر غالب</span>
            )}
          </div>
          <p className="mt-1 text-[9.5px] text-muted-foreground">{sc.strengthFa}</p>
          <div className="mt-1.5 flex flex-col gap-1 text-[10px] leading-5 text-foreground/90">
            <p>محرر فعال‌سازی: <b>{sc.triggerFa}</b></p>
            <p>ابطال: <b>{sc.invalidateFa}</b></p>
            {sc.targetsFa && <p>هدف: <b dir="auto">{sc.targetsFa}</b></p>}
          </div>
          <p className="mt-1.5 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5 text-[9.5px] leading-4 text-foreground/90">{sc.noteFa}</p>
        </div>
      ))}

      {/* ساعت‌های حساس امروز/فردا */}
      {hotHours.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="mb-1.5 flex items-center gap-1 text-[11px] font-extrabold text-amber-200">
            <Clock className="h-3.5 w-3.5" /> ساعت‌های حساس امروز/فردا (به وقت تهران)
          </p>
          <ul className="flex flex-col gap-1">
            {hotHours.map((h, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[10px] leading-5 text-foreground/90">
                <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[8.5px] font-bold text-amber-300" dir="ltr">{h.timeFa}</span>
                <span className="min-w-0 truncate">{h.titleFa}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-center">
        <button
          type="button"
          onClick={onReload}
          className="flex items-center gap-1.5 rounded-full border border-violet-500/50 bg-violet-500/15 px-3.5 py-1.5 text-xs font-extrabold text-violet-200"
        >
          <RefreshCw className="h-3 w-3" /> ترسیم مجدد نقشه
        </button>
      </div>

      <p className="text-center text-[9px] leading-4 text-muted-foreground/80">{pathMap.noteFa}</p>
    </div>
  );
}
