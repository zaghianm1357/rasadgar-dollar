"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  RefreshCw,
  Sparkles,
  AlertTriangle,
  Inbox,
  Flame,
  Clock3,
  Radio,
  Languages,
  CalendarDays,
  ExternalLink,
} from "lucide-react";
import type { NewsResponse, NewsEvent } from "@/lib/types";
import {
  faClock,
  faDateLong,
  faDigits,
  faTime,
  dateKeyInTehran,
  todayKeyInTehran,
  addDaysToKey,
} from "@/lib/tehran";
import { EventCard } from "./event-card";
import { MarketStructurePanel } from "./market-structure-panel";

type TabKey = "today" | "tomorrow" | "week" | "all";
type ImpactFilter = "all" | "High" | "Medium" | "low";

const AUTO_REFRESH_MS = 120 * 1000;

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
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${accentCls ?? "bg-muted/50 border-border text-foreground"}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] text-muted-foreground">{title}</p>
          <p className="truncate text-sm font-bold leading-6">{value}</p>
          {sub && <p className="truncate text-[10px] text-muted-foreground/80">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("today");
  const [impactFilter, setImpactFilter] = useState<ImpactFilter>("all");
  const [clock, setClock] = useState("");
  const [nowSec, setNowSec] = useState<number>(() => Date.now());
  const [now30, setNow30] = useState<number>(() => Date.now());
  const lastFetchRef = useRef(0);

  const fetchNews = useCallback(async (silent: boolean) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch("/api/news", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as NewsResponse;
      setData(json);
      setError(null);
      lastFetchRef.current = Date.now();
    } catch {
      if (!silent) setError("دریافت اخبار ناموفق بود. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(false);
  }, [fetchNews]);

  useEffect(() => {
    const id = setInterval(() => fetchNews(true), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchNews]);

  useEffect(() => {
    const onVis = () => {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastFetchRef.current > 60_000
      ) {
        fetchNews(true);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [fetchNews]);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(faClock(d));
      setNowSec(d.getTime());
      if (d.getSeconds() === 0 || d.getSeconds() === 30) setNow30(d.getTime());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const todayKey = useMemo(() => todayKeyInTehran(new Date(now30)), [now30]);

  const stats = useMemo(() => {
    if (!data) return null;
    const todayEvents = data.events.filter((e) => {
      if (!e.dateISO) return true;
      return dateKeyInTehran(new Date(e.dateISO)) === todayKey;
    });
    const highToday = todayEvents.filter((e) => e.impact === "High");
    const upcoming = data.events
      .filter((e) => e.dateISO && new Date(e.dateISO).getTime() > nowSec)
      .sort(
        (a, b) => new Date(a.dateISO!).getTime() - new Date(b.dateISO!).getTime()
      );
    const nextHigh = upcoming.find((e) => e.impact === "High") ?? null;
    return {
      todayCount: todayEvents.length,
      highTodayCount: highToday.length,
      nextHigh,
      upcomingCount: upcoming.length,
    };
  }, [data, todayKey, nowSec]);

  const groups = useMemo<[string, NewsEvent[]][]>(() => {
    if (!data) return [];
    const impactOk = (e: NewsEvent) => {
      if (impactFilter === "all") return true;
      if (impactFilter === "High") return e.impact === "High";
      if (impactFilter === "Medium") return e.impact === "Medium";
      return e.impact === "Low" || e.impact === "Holiday";
    };

    const map = new Map<string, NewsEvent[]>();
    for (const e of data.events) {
      if (!impactOk(e)) continue;
      const key = e.dateISO ? dateKeyInTehran(new Date(e.dateISO)) : todayKey;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }

    let entries = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    if (tab === "today") entries = entries.filter(([k]) => k === todayKey);
    else if (tab === "tomorrow")
      entries = entries.filter(([k]) => k === addDaysToKey(todayKey, 1));
    else if (tab === "week") {
      // پنجره غلتان: از ۶ روز قبل تا ۶ روز بعد — تا در مرز هفته‌ها هم خالی نماند
      const startKey = addDaysToKey(todayKey, -6);
      const endKey = addDaysToKey(todayKey, 6);
      entries = entries.filter(([k]) => k >= startKey && k <= endKey);
    }

    for (const [, arr] of entries) {
      arr.sort((a, b) => {
        const ta = a.dateISO ? new Date(a.dateISO).getTime() : -1;
        const tb = b.dateISO ? new Date(b.dateISO).getTime() : -1;
        return ta - tb;
      });
    }
    return entries;
  }, [data, impactFilter, tab, todayKey]);

  const feedMeta = useMemo(() => {
    if (!data) return null;
    const map = {
      live: { label: "بروزرسانی زنده", dot: "bg-emerald-400", cls: "text-emerald-400" },
      cached: { label: "داده کش‌شده", dot: "bg-amber-400", cls: "text-amber-400" },
      error: { label: "خطای فید — داده محلی", dot: "bg-rose-400", cls: "text-rose-400" },
    } as const;
    const m = map[data.feedStatus] ?? map.cached;
    const last = data.lastFetchISO
      ? `آخرین دریافت: ${faTime(new Date(data.lastFetchISO))}`
      : "در انتظار اولین دریافت";
    return { ...m, last };
  }, [data]);

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
    <div className="flex min-h-screen flex-col">
      {/* هدر */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/15">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold leading-6">رصدگر دلار</h1>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground">
                اخبار اقتصادی USD از ForexFactory — ترجمه و تحلیل فارسی
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span dir="ltr" className="text-sm font-bold tabular-nums leading-5">
                {clock || "--:--:--"}
              </span>
              <span className="text-[10px] text-muted-foreground">ساعت تهران</span>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchNews(true)}
              disabled={refreshing}
              aria-label="بروزرسانی دستی"
              className="h-10 w-10"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-5 flex flex-col gap-5">
        {error && (
          <Card className="border-rose-500/40 bg-rose-500/10">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchNews(false)}>
                تلاش مجدد
              </Button>
            </CardContent>
          </Card>
        )}

        {/* خلاصه روزانه هوشمند */}
        {loading && (
          <Card className="border-primary/25">
            <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-11/12" />
              <Skeleton className="h-3 w-2/3" />
            </CardContent>
          </Card>
        )}
        {!loading && data?.digest && (
          <Card className="animate-fade-up border-primary/25 bg-gradient-to-bl from-primary/8 to-transparent">
            <CardContent className="p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-primary">خلاصه روزانه هوشمند</h2>
                <Badge variant="outline" className="ms-auto gap-1 bg-muted/40 text-[10px] text-muted-foreground border-border">
                  <Clock3 className="h-3 w-3" />
                  به‌روزرسانی خودکار روزانه
                </Badge>
              </div>
              <p className="text-[13px] sm:text-sm leading-7 text-foreground/90">{data.digest}</p>
            </CardContent>
          </Card>
        )}

        {/* کارت‌های آمار */}
        {!loading && stats && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              icon={CalendarDays}
              title="اخبار امروز (USD)"
              value={`${faDigits(stats.todayCount)} خبر`}
              sub={`${faDigits(stats.highTodayCount)} خبر با اهمیت بالا`}
              accentCls="bg-primary/12 border-primary/30 text-primary"
            />
            <StatCard
              icon={Flame}
              title="تا خبر مهم بعدی"
              value={
                stats.nextHigh
                  ? formatCountdown(new Date(stats.nextHigh.dateISO!).getTime() - nowSec)
                  : "امروز خبر مهمی نیست"
              }
              sub={stats.nextHigh ? stats.nextHigh.titleFa || stats.nextHigh.title : undefined}
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

        {/* تب‌ها و فیلتر اهمیت */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <TabsList className="grid w-full grid-cols-4 sm:w-auto">
              <TabsTrigger value="today" className="text-xs sm:text-sm">
                امروز
              </TabsTrigger>
              <TabsTrigger value="tomorrow" className="text-xs sm:text-sm">
                فردا
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs sm:text-sm">
                این هفته
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs sm:text-sm">
                همه
              </TabsTrigger>
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
              <Button
                key={f.key}
                variant={impactFilter === f.key ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setImpactFilter(f.key)}
                className={`h-8 rounded-full border px-3 text-xs ${
                  impactFilter === f.key
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border/70 text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {/* اعلان ترجمه در صف */}
        {data && data.pendingTranslation > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Languages className="h-4 w-4 shrink-0 animate-soft-pulse" />
            <span>
              {faDigits(data.pendingTranslation)} خبر در نوبت ترجمه هوشمند است؛ چند لحظه دیگر به‌صورت خودکار ترجمه می‌شود.
            </span>
          </div>
        )}

        {/* لیست اخبار */}
        {loading ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="border-border/70">
                <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
                  <div className="flex gap-2">
                    <Skeleton className="h-7 w-16 rounded-md" />
                    <Skeleton className="h-7 w-20 rounded-full" />
                    <Skeleton className="h-7 w-24 rounded-full" />
                  </div>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-14 w-full rounded-lg" />
                </CardContent>
              </Card>
            ))}
            <p className="text-center text-xs text-muted-foreground">
              در حال دریافت اخبار از ForexFactory و ترجمه هوشمند... (بارگذاری اول ممکن است تا یک دقیقه طول بکشد)
            </p>
          </div>
        ) : groups.length === 0 ? (
          <Card className="border-dashed border-border/70">
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">
                {tab === "today"
                  ? "برای امروز خبر USD ثبت نشده است (مثلاً روزهای تعطیلی بازار)."
                  : "در این بازه خبری برای نمایش نیست. بازه زمانی یا فیلتر اهمیت را تغییر دهید."}
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
            <section key={dayKey} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-bold text-foreground/90">{dayLabel(dayKey)}</h2>
                <div className="h-px flex-1 bg-border/70" />
                <span className="text-[10px] text-muted-foreground">
                  {faDigits(events.length)} خبر
                </span>
              </div>
              {events.map((e) => (
                <EventCard key={e.id} event={e} now={now30} />
              ))}
            </section>
          ))
        )}

        {/* جدول ساختار بازار — انتهای صفحه */}
        <MarketStructurePanel />
      </main>

      {/* فوتر چسبیده به پایین */}
      <footer className="mt-auto border-t border-border/60 bg-card/40">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-2 px-4 py-4 sm:flex-row">
          <a
            href="https://www.forexfactory.com/calendar"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-primary"
          >
            منبع داده: ForexFactory
            <ExternalLink className="h-3 w-3" />
          </a>
          <p className="text-[10px] text-muted-foreground/70">
            ترجمه و تحلیل با هوش مصنوعی — این ابزار صرفاً اطلاع‌رسانی است و توصیه سرمایه‌گذاری محسوب نمی‌شود.
          </p>
        </div>
      </footer>
    </div>
  );
}
