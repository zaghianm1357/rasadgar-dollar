"use client";

import { memo, useMemo } from "react";
import {
  Flame,
  Newspaper,
  Activity,
  Sparkles,
  TrendingUp,
  TrendingDown,
  MoveHorizontal,
  Clock3,
  DollarSign,
  CalendarDays,
} from "lucide-react";
import type { MSSymbol, MSRow, MSTimeframe } from "@/lib/types";
import { faDigits } from "@/lib/tehran";
import { useShell } from "./shell-context";
import { trendText } from "@/components/dashboard/trend-change-banner";

/**
 * ویجت‌های صفحه اصلی — با پالس ملایم هنگام تغییر داده
 * ترفند پالس: تغییر key باعث remount و پخش دوباره انیمیشن animate-widget-pulse می‌شود.
 */

const TF_LABEL: Record<MSTimeframe, string> = {
  "5m": "۵د",
  "15m": "۱۵د",
  "1h": "۱س",
  "4h": "۴س",
  "1d": "روز",
  "1wk": "هفته",
  "1mo": "ماه",
};

function WidgetShell({
  pulseKey,
  className = "",
  children,
}: {
  pulseKey: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      key={pulseKey}
      className={`animate-widget-pulse flex flex-col gap-1 rounded-2xl border border-border/70 bg-card/75 p-3 backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}

function TrendDot({ row }: { row: MSRow | null | undefined }) {
  const t = row?.trend ?? null;
  const cls =
    t === "bullish"
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : t === "bearish"
        ? "text-rose-400 border-rose-500/30 bg-rose-500/10"
        : t === "neutral"
          ? "text-zinc-400 border-zinc-500/30 bg-zinc-500/10"
          : "text-muted-foreground border-border bg-muted/30";
  const Icon = t === "bullish" ? TrendingUp : t === "bearish" ? TrendingDown : MoveHorizontal;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded border px-1 py-px text-[9px] font-bold ${cls}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {t ? trendText(t) : "—"}
    </span>
  );
}

/* ---------- ویجت قیمت (طلا / داو) ---------- */

export function PriceWidget({ sym, title }: { sym: MSSymbol | null; title: string }) {
  const price = sym?.price;
  const ch = sym?.changePct;
  const row1h = sym?.rows.find((r) => r.tf === "1h") ?? null;
  const pulseKey = price != null ? `${title}:${price}` : `${title}:null`;
  return (
    <WidgetShell pulseKey={pulseKey} className="min-h-[86px] justify-between">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] font-bold text-muted-foreground">{title}</span>
        <TrendDot row={row1h} />
      </div>
      {price != null ? (
        <span dir="ltr" className="text-start text-lg font-extrabold tabular-nums leading-6">
          {faDigits(price.toLocaleString("en-US", { maximumFractionDigits: 2 })).replace(/,/g, "٬")}
        </span>
      ) : (
        <span className="text-lg font-extrabold text-muted-foreground">—</span>
      )}
      <span
        className={`text-[10px] font-bold tabular-nums ${
          ch == null ? "text-muted-foreground" : ch > 0 ? "text-emerald-400" : ch < 0 ? "text-rose-400" : "text-zinc-400"
        }`}
      >
        {ch != null
          ? `${ch > 0 ? "+" : ""}${faDigits(ch.toFixed(2))}٪ امروز`
          : "در انتظار داده"}
      </span>
    </WidgetShell>
  );
}

/* ---------- ویجت شمارش معکوس تا خبر مهم ---------- */

function formatCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${faDigits(m)} دقیقه`;
  if (m === 0) return `${faDigits(h)} ساعت`;
  return `${faDigits(h)}:${faDigits(String(m).padStart(2, "0"))}`;
}

export function CountdownWidget() {
  const { news, now30 } = useShell();
  const nextHigh = useMemo(() => {
    const upcoming = (news?.events ?? [])
      .filter((e) => e.dateISO && new Date(e.dateISO).getTime() > now30.getTime())
      .sort((a, b) => new Date(a.dateISO!).getTime() - new Date(b.dateISO!).getTime());
    return upcoming.find((e) => e.impact === "High") ?? null;
  }, [news, now30]);

  const left = nextHigh?.dateISO
    ? new Date(nextHigh.dateISO).getTime() - now30.getTime()
    : null;

  return (
    <WidgetShell pulseKey={nextHigh?.id ?? "none"} className="min-h-[86px] justify-between">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] font-bold text-muted-foreground">تا خبر مهم</span>
        <Flame className="h-3.5 w-3.5 shrink-0 text-amber-400" />
      </div>
      <span className="text-lg font-extrabold leading-6">
        {left != null ? formatCountdown(left) : "—"}
      </span>
      <span className="truncate text-[10px] text-muted-foreground/80" title={nextHigh?.titleFa ?? nextHigh?.title}>
        {nextHigh ? nextHigh.titleFa || nextHigh.title : "خبر مهمی در صف نیست"}
      </span>
    </WidgetShell>
  );
}

/* ---------- ویجت اخبار امروز ---------- */

export function TodayCountWidget() {
  const { news } = useShell();
  const { count, high, pulseKey } = useMemo(() => {
    const todayKey = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Tehran",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const today = (news?.events ?? []).filter(
      (e) => !e.dateISO || e.dateISO.slice(0, 10) === todayKey
    );
    const high = today.filter((e) => e.impact === "High").length;
    return { count: today.length, high, pulseKey: `today:${today.length}:${high}` };
  }, [news]);

  return (
    <WidgetShell pulseKey={pulseKey} className="min-h-[86px] justify-between">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] font-bold text-muted-foreground">اخبار امروز</span>
        <Newspaper className="h-3.5 w-3.5 shrink-0 text-primary" />
      </div>
      <span className="text-lg font-extrabold leading-6">
        {faDigits(count)} <span className="text-xs font-bold text-muted-foreground">خبر</span>
      </span>
      <span className="text-[10px] font-bold text-amber-400/90">
        {faDigits(high)} خبر با اهمیت بالا
      </span>
    </WidgetShell>
  );
}

/* ---------- ویجت خلاصه روزانه ---------- */

export function DigestMiniWidget() {
  const { news } = useShell();
  return (
    <WidgetShell pulseKey={`digest:${news?.digest ?? "none"}`} className="col-span-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-[10px] font-extrabold text-primary">خلاصه روزانه هوشمند</span>
      </div>
      <p className="line-clamp-3 text-[11px] leading-5 text-foreground/85">
        {news?.digest ?? "پس از دریافت اخبار، خلاصه هوشمند اینجا نمایش داده می‌شود."}
      </p>
    </WidgetShell>
  );
}

/* ---------- ویجت نگاه اجمالی به ساختار بازار (صفحه دوم) ---------- */

const GLANCE_TFS: MSTimeframe[] = ["15m", "1h", "4h", "1d"];

export function StructureGlanceWidget() {
  const { ms } = useShell();
  const pulseKey = useMemo(() => {
    const pick = (s: MSSymbol | null) =>
      GLANCE_TFS.map((tf) => s?.rows.find((r) => r.tf === tf)?.trend ?? "-").join("");
    return `glance:${pick(ms?.xau ?? null)}|${pick(ms?.dji ?? null)}`;
  }, [ms]);

  return (
    <WidgetShell pulseKey={pulseKey} className="col-span-2">
      <div className="flex items-center gap-1.5">
        <Activity className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-[10px] font-extrabold">نگاه اجمالی — ساختار بازار</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border/60">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr className="bg-muted/40 text-[9px] text-muted-foreground">
              <th className="px-1.5 py-1 text-start font-bold">تایم‌فریم</th>
              <th className="px-1 py-1 font-bold">طلا</th>
              <th className="px-1 py-1 font-bold">داو</th>
            </tr>
          </thead>
          <tbody>
            {GLANCE_TFS.map((tf) => (
              <tr key={tf} className="border-t border-border/50">
                <td className="px-1.5 py-1 text-start text-[9px] font-bold text-muted-foreground">
                  {TF_LABEL[tf]}
                </td>
                <td className="px-1 py-1">
                  <TrendDot row={ms?.xau?.rows.find((r) => r.tf === tf)} />
                </td>
                <td className="px-1 py-1">
                  <TrendDot row={ms?.dji?.rows.find((r) => r.tf === tf)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[9px] text-muted-foreground/70">
        جزئیات کامل در اپ «ساختار بازار» — بروزرسانی هر ۱۵ دقیقه
      </p>
    </WidgetShell>
  );
}

/* ---------- ویجت خبرهای پیش‌رو (صفحه دوم) ---------- */

export function TopNewsWidget() {
  const { news, now30 } = useShell();
  const upcoming = useMemo(() => {
    return (news?.events ?? [])
      .filter((e) => e.dateISO && new Date(e.dateISO).getTime() > now30.getTime())
      .sort((a, b) => new Date(a.dateISO!).getTime() - new Date(b.dateISO!).getTime())
      .slice(0, 3);
  }, [news, now30]);
  const pulseKey = `top:${upcoming.map((e) => e.id).join(",")}`;

  return (
    <WidgetShell pulseKey={pulseKey} className="col-span-2">
      <div className="flex items-center gap-1.5">
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-[10px] font-extrabold">خبرهای پیش‌رو</span>
      </div>
      {upcoming.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">خبر آینده‌ای در فید نیست.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {upcoming.map((e) => (
            <div key={e.id} className="flex items-center gap-2">
              <Clock3 className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span dir="ltr" className="shrink-0 text-[10px] font-bold tabular-nums text-muted-foreground">
                {e.dateISO ? faDigits(new Intl.DateTimeFormat("fa-IR", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(e.dateISO))) : "—"}
              </span>
              <span className="truncate text-[11px]">{e.titleFa || e.title}</span>
              {e.impact === "High" && <Flame className="h-3 w-3 shrink-0 text-amber-400" />}
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

/* ---------- کارت راهنمای حرکات (صفحه دوم) ---------- */

export function GestureHintWidget() {
  return (
    <WidgetShell pulseKey="hints" className="col-span-2 gap-1.5">
      <div className="flex items-center gap-1.5">
        <DollarSign className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="text-[10px] font-extrabold">راهنمای حرکات</span>
      </div>
      <ul className="flex flex-col gap-1 text-[10px] leading-4 text-muted-foreground">
        <li>• نگه‌داشتن آیکون‌ها → حالت لرزش برای جابه‌جایی</li>
        <li>• کشیدن انگشت به چپ/راست → جابه‌جایی صفحات (کاغذدیواری پارالاکس)</li>
        <li>• کشیدن از بالا → مرکز اعلان‌ها | از پایین → مرکز کنترل</li>
        <li>• لمس آیکون اپ → باز شدن با انیمیشن بزرگ‌نمایی</li>
      </ul>
    </WidgetShell>
  );
}
