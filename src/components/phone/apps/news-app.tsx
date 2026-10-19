"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Inbox,
  Flame,
  Radio,
  Languages,
  CalendarDays,
} from "lucide-react";
import type { NewsEvent } from "@/lib/types";
import { currencyFa } from "@/lib/currency-fa";
import {
  faDigits,
  faDateLong,
  faTime,
  dateKeyInTehran,
  todayKeyInTehran,
  addDaysToKey,
} from "@/lib/tehran";
import { EventCard } from "@/components/dashboard/event-card";
import { useShell } from "../shell-context";
/**
 * اپ «اخبار دلار» — همان تجربه داشبورد قبلی، به‌صورت اپ تمام‌صفحه پوسته موبایل.
 * داده از کانتکست پوسته تامین می‌شود (پولینگ مرکزی).
 */

type TabKey = "today" | "tomorrow" | "week" | "all";
type ImpactFilter = "all" | "High" | "Medium" | "low";

function formatCountdown(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${faDigits(m)} دقیقه دیگر`;
  if (m === 0) return `${faDigits(h)} ساعت دیگر`;
  return `${faDigits(h)} ساعت و ${faDigits(m)} دقیقه دیگر`;
}

function StatCard({
  icon: Icon,
  title,
  value,
  sub,
  accentCls,
}: {
  icon: typeof Flame;
  title: string;
  value: string;
  sub?: string;
  accentCls?: string;
}) {
  return (
    <Card className="border-border/70 bg-card/70">
      <CardContent className="flex items-center gap-2.5 p-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${accentCls ?? "bg-muted/50 border-border text-foreground"}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[10px] text-muted-foreground">{title}</p>
          <p className="truncate text-[13px] font-bold leading-5">{value}</p>
          {sub && <p className="truncate text-[9px] text-muted-foreground/80">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function NewsApp() {
  const {
    news,
    newsLoading,
    newsRefreshing,
    newsError,
    refreshNews,
    settings,
    updateSettings,
    now,
    now30,
  } = useShell();
  const [tab, setTab] = useState<TabKey>("today");
  const [manualFilter, setManualFilter] = useState<ImpactFilter>("all");
  // کلید «فقط مهم» مرکز کنترل روی فیلتر اپ اولویت دارد؛ لمس چیپ دیگر، آن کلید را آزاد می‌کند
  const impactFilter: ImpactFilter = settings.highOnly ? "High" : manualFilter;
  const setImpact = (f: ImpactFilter) => {
    if (settings.highOnly) updateSettings({ highOnly: f === "High" });
    setManualFilter(f);
  };

  const todayKey = useMemo(() => todayKeyInTehran(now30), [now30]);

  const stats = useMemo(() => {
    if (!news) return null;
    const todayEvents = news.events.filter((e) => {
      if (!e.dateISO) return true;
      return dateKeyInTehran(new Date(e.dateISO)) === todayKey;
    });
    const highToday = todayEvents.filter((e) => e.impact === "High");
    const upcoming = news.events
      .filter((e) => e.dateISO && new Date(e.dateISO).getTime() > now.getTime())
      .sort((a, b) => new Date(a.dateISO!).getTime() - new Date(b.dateISO!).getTime());
    const nextHigh = upcoming.find((e) => e.impact === "High") ?? null;
    return { todayCount: todayEvents.length, highTodayCount: highToday.length, nextHigh };
  }, [news, todayKey, now]);

  const groups = useMemo<[string, NewsEvent[]][]>(() => {
    if (!news) return [];
    const impactOk = (e: NewsEvent) => {
      if (impactFilter === "all") return true;
      if (impactFilter === "High") return e.impact === "High";
      if (impactFilter === "Medium") return e.impact === "Medium";
      return e.impact === "Low" || e.impact === "Holiday";
    };
    const map = new Map<string, NewsEvent[]>();
    for (const e of news.events) {
      if (!impactOk(e)) continue;
      const key = e.dateISO ? dateKeyInTehran(new Date(e.dateISO)) : todayKey;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    let entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (tab === "today") entries = entries.filter(([k]) => k === todayKey);
    else if (tab === "tomorrow") entries = entries.filter(([k]) => k === addDaysToKey(todayKey, 1));
    else if (tab === "week") {
      const startKey = addDaysToKey(todayKey, -6);
      const endKey = addDaysToKey(todayKey, 6);
      entries = entries.filter(([k]) => k >= startKey && k <= endKey);
    }
    for (const [, arr] of entries) {
      arr.sort(
        (a, b) =>
          (a.dateISO ? new Date(a.dateISO).getTime() : -1) -
          (b.dateISO ? new Date(b.dateISO).getTime() : -1)
      );
    }
    return entries;
  }, [news, impactFilter, tab, todayKey]);

  const feedMeta = useMemo(() => {
    if (!news) return null;
    const map = {
      live: { label: "بروزرسانی زنده", cls: "text-emerald-400" },
      cached: { label: "داده کش‌شده", cls: "text-amber-400" },
      error: { label: "خطای فید", cls: "text-rose-400" },
    } as const;
    const m = map[news.feedStatus] ?? map.cached;
    const last = news.lastFetchISO
      ? `آخرین دریافت: ${faTime(new Date(news.lastFetchISO))}`
      : "در انتظار اولین دریافت";
    return { ...m, last };
  }, [news]);

  const dayLabel = (key: string) => {
    const d = new Date(
      Number(key.slice(0, 4)),
      Number(key.slice(5, 7)) - 1,
      Number(key.slice(8, 10)),
      12
    );
    if (key === todayKey) return `امروز — ${faDateLong(d)}`;
    if (key === addDaysToKey(todayKey, 1)) return `فردا — ${faDateLong(d)}`;
    return faDateLong(d);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      {newsError && (
        <Card className="border-rose-500/40 bg-rose-500/10">
          <CardContent className="flex flex-col items-center justify-between gap-3 p-3 sm:flex-row">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-xs">{newsError}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refreshNews(false)}>
              تلاش مجدد
            </Button>
          </CardContent>
        </Card>
      )}

      {/* خلاصه روزانه */}
      {newsLoading && (
        <Card className="border-primary/25">
          <CardContent className="flex flex-col gap-3 p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </CardContent>
        </Card>
      )}
      {!newsLoading && news?.digest && (
        <Card className="animate-fade-up border-primary/25 bg-gradient-to-bl from-primary/8 to-transparent">
          <CardContent className="p-3.5">
            <div className="mb-1.5 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-[13px] font-bold text-primary">خلاصه روزانه هوشمند</h2>
            </div>
            <p className="text-xs leading-6 text-foreground/90">{news.digest}</p>
          </CardContent>
        </Card>
      )}

      {/* آمار */}
      {!newsLoading && stats && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <StatCard
            icon={CalendarDays}
            title="اخبار امروز (دلار و ارزهای اصلی)"
            value={`${faDigits(stats.todayCount)} خبر`}
            sub={`${faDigits(stats.highTodayCount)} خبر با اهمیت بالا`}
            accentCls="bg-primary/12 border-primary/30 text-primary"
          />
          <StatCard
            icon={Flame}
            title="تا خبر مهم بعدی"
            value={
              stats.nextHigh
                ? formatCountdown(new Date(stats.nextHigh.dateISO!).getTime() - now.getTime())
                : "خبر مهمی در صف نیست"
            }
            sub={stats.nextHigh ? `${currencyFa(stats.nextHigh.country)} — ${stats.nextHigh.titleFa || stats.nextHigh.title}` : undefined}
            accentCls="bg-amber-500/12 border-amber-500/30 text-amber-400"
          />
          <StatCard
            icon={Radio}
            title="وضعیت داده"
            value={feedMeta?.label ?? "—"}
            sub={feedMeta?.last}
            accentCls={
              feedMeta?.label === "بروزرسانی زنده"
                ? "bg-emerald-500/12 border-emerald-500/30 text-emerald-400"
                : "bg-muted/50 border-border text-foreground"
            }
          />
        </div>
      )}

      {/* تب‌ها و فیلتر */}
      <div className="flex flex-col gap-2.5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="today" className="text-xs">امروز</TabsTrigger>
            <TabsTrigger value="tomorrow" className="text-xs">فردا</TabsTrigger>
            <TabsTrigger value="week" className="text-xs">این هفته</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">همه</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: "all", label: "همه" },
              { key: "High", label: "خیلی مهم" },
              { key: "Medium", label: "متوسط" },
              { key: "low", label: "کم‌اهمیت" },
            ] as { key: ImpactFilter; label: string }[]
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setImpact(f.key)}
              aria-pressed={impactFilter === f.key}
              className={`inline-flex h-8 items-center rounded-full border px-3 text-[11px] transition-colors ${
                impactFilter === f.key
                  ? "border-primary/40 bg-primary/15 font-bold text-primary"
                  : "border-border/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* اعلان ترجمه */}
      {news && news.pendingTranslation > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
          <Languages className="h-4 w-4 shrink-0 animate-soft-pulse" />
          <span>
            {faDigits(news.pendingTranslation)} خبر در نوبت ترجمه هوشمند است؛ چند لحظه دیگر
            ترجمه می‌شود.
          </span>
        </div>
      )}

      {/* لیست اخبار */}
      {newsLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="border-border/70">
              <CardContent className="flex flex-col gap-2.5 p-4">
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-md" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="flex flex-col items-center gap-2.5 p-8 text-center">
            <Inbox className="h-7 w-7 text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">
              {tab === "today"
                ? "برای امروز خبری از دلار و ارزهای اصلی ثبت نشده است (مثلاً روزهای تعطیلی بازار)."
                : "در این بازه خبری برای نمایش نیست. بازه یا فیلتر را تغییر دهید."}
            </p>
            {tab === "today" && (
              <Button variant="outline" size="sm" onClick={() => setTab("week")}>
                <CalendarDays className="ms-1 h-4 w-4" />
                مشاهده این هفته
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        groups.map(([dayKey, events]) => (
          <section key={dayKey} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xs font-bold text-foreground/90">{dayLabel(dayKey)}</h2>
              <div className="h-px flex-1 bg-border/70" />
              <span className="text-[10px] text-muted-foreground">
                {faDigits(events.length)} خبر
              </span>
            </div>
            {events.map((e) => (
              <EventCard key={e.id} event={e} now={now30.getTime()} />
            ))}
          </section>
        ))
      )}

      {/* دکمه بروزرسانی شناور */}
      <Button
        size="sm"
        variant="outline"
        onClick={() => refreshNews(true)}
        disabled={newsRefreshing}
        className="mx-auto rounded-full"
      >
        <RefreshCw className={`ms-1 h-3.5 w-3.5 ${newsRefreshing ? "animate-spin" : ""}`} />
        بروزرسانی اخبار
      </Button>
    </div>
  );
}
