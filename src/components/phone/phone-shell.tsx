"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Newspaper,
  Activity,
  Crosshair,
  CandlestickChart,
  Info,
  BellRing,
  SlidersHorizontal,
  SignalHigh,
  Wifi,
  BatteryFull,
  Check,
  Menu,
  ArrowRight,
  X,
  ChevronLeft,
  RefreshCw,
  DollarSign,
  Briefcase,
  Zap,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { faTime } from "@/lib/tehran";
import { PhoneDataProvider, useShell } from "./shell-context";
import {
  PriceWidget,
  CountdownWidget,
  TodayCountWidget,
  DigestMiniWidget,
  StructureGlanceWidget,
  TopNewsWidget,
  GestureHintWidget,
} from "./widgets";
import { NotificationCenter } from "./notification-center";
import { ControlCenter } from "./control-center";
import { TrendChangeBanner } from "@/components/dashboard/trend-change-banner";
import { MarketStructurePanel } from "@/components/dashboard/market-structure-panel";
import { TradeSuggestion } from "@/components/dashboard/trade-suggestion";
import { ScalpPanel } from "@/components/dashboard/scalp-panel";
import { NewsApp } from "./apps/news-app";
import { AboutApp } from "./apps/about-app";
import { ChartApp } from "./apps/chart-app";
import { TraderApp } from "./apps/trader-app";

/* ---------- تعریف اپ‌ها ---------- */

type AppId = "news" | "structure" | "suggestion" | "scalp" | "chart" | "trader" | "about";

const APPS: Record<
  AppId,
  { label: string; icon: typeof Newspaper; cls: string }
> = {
  news: { label: "اخبار دلار", icon: Newspaper, cls: "from-emerald-500 to-teal-700" },
  structure: { label: "ساختار بازار", icon: Activity, cls: "from-sky-500 to-indigo-700" },
  suggestion: { label: "پیشنهاد معامله", icon: Crosshair, cls: "from-violet-500 to-fuchsia-700" },
  scalp: { label: "سیگنال اسکلپ اونس", icon: Zap, cls: "from-rose-500 to-red-700" },
  chart: { label: "چارت تریدینگ‌ویو", icon: CandlestickChart, cls: "from-amber-500 to-orange-700" },
  trader: { label: "دستیار معامله‌گر", icon: Briefcase, cls: "from-yellow-400 to-amber-700" },
  about: { label: "درباره", icon: Info, cls: "from-zinc-500 to-zinc-700" },
};

const DEFAULT_GRID_ORDER: AppId[] = ["news", "structure", "suggestion", "scalp", "chart", "trader", "about"];
const GRID_ORDER_KEY = "home_grid_order_v1";
const SHELL_HINT_KEY = "shell_hint_v1";
const LONG_PRESS_MS = 450;
const PAGES = 2;

function IconVisual({ id, size = 52 }: { id: AppId; size?: number }) {
  const a = APPS[id];
  const Icon = a.icon;
  return (
    <div
      style={{ height: size, width: size }}
      className={`flex items-center justify-center rounded-[15px] bg-gradient-to-br shadow-lg shadow-black/40 ${a.cls}`}
    >
      <Icon className="h-6 w-6 text-white drop-shadow" />
    </div>
  );
}

function buzz() {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* پشتیبانی نمی‌شود */
  }
}

interface AppRect {
  x: number;
  y: number;
  w: number;
  h: number;
  dw: number;
  dh: number;
}

/* ---------- پوسته ---------- */

function Shell() {
  const { ms, msRefreshing, refreshMarket, now } = useShell();

  /* حالت لرزش و جابه‌جایی آیکون‌ها */
  const [wiggle, setWiggle] = useState(false);
  const [gridOrder, setGridOrder] = useState<AppId[]>(DEFAULT_GRID_ORDER);
  const [drag, setDrag] = useState<{ id: AppId; x: number; y: number } | null>(null);

  /* مراکز اعلان و کنترل */
  const [ncOpen, setNcOpen] = useState(false);
  const [ccOpen, setCcOpen] = useState(false);
  const [ncProgress, setNcProgress] = useState(0);
  const [ccProgress, setCcProgress] = useState(0);
  const ncProgRef = useRef(0);
  const ccProgRef = useRef(0);

  /* منوی جانبی */
  const [drawerOpen, setDrawerOpen] = useState(false);

  const setNc = useCallback((v: number) => {
    ncProgRef.current = v;
    setNcProgress(v);
  }, []);
  const setCc = useCallback((v: number) => {
    ccProgRef.current = v;
    setCcProgress(v);
  }, []);

  /* اجرای اپ با انیمیشن بزرگ‌نمایی از موقعیت آیکون (FLIP) */
  const [app, setApp] = useState<{ id: AppId; rect: AppRect } | null>(null);
  const [appPhase, setAppPhase] = useState<"opening" | "open" | "closing">("open");

  /* ---------- لایه‌های تاریخچه — دکمه برگشت خود گوشی ---------- */
  const lastPushedRef = useRef<string | null>(null);
  const pushLayer = useCallback((name: string) => {
    lastPushedRef.current = name;
    try {
      history.pushState({ sd: name }, "");
    } catch {
      lastPushedRef.current = null;
    }
  }, []);

  const closeApp = useCallback(() => {
    setAppPhase("closing");
    setTimeout(() => setApp(null), 420);
  }, []);

  const closeLayerUI = useCallback(
    (name: "app" | "nc" | "cc" | "drawer") => {
      if (lastPushedRef.current === name) {
        lastPushedRef.current = null;
        try {
          history.back();
          return;
        } catch {
          /* fallback زیر */
        }
      }
      if (name === "drawer") setDrawerOpen(false);
      else if (name === "nc") {
        setNcOpen(false);
        setNc(0);
      } else if (name === "cc") {
        setCcOpen(false);
        setCc(0);
      } else closeApp();
    },
    [closeApp, setNc, setCc],
  );

  /* وضعیت جاری برای هندلر popstate (بدون stale closure) */
  const stateRef = useRef({
    drawerOpen: false,
    ncOpen: false,
    ccOpen: false,
    app: null as null | { id: AppId; rect: AppRect },
    appPhase: "open" as "opening" | "open" | "closing",
  });
  useEffect(() => {
    stateRef.current = { drawerOpen, ncOpen, ccOpen, app, appPhase };
  }, [drawerOpen, ncOpen, ccOpen, app, appPhase]);

  useEffect(() => {
    try {
      if (history.state && (history.state as { sd?: string }).sd) history.replaceState(null, "");
    } catch {
      /* بی‌اهمیت */
    }
    const onPop = () => {
      lastPushedRef.current = null;
      const s = stateRef.current;
      if (s.drawerOpen) setDrawerOpen(false);
      else if (s.ncOpen) {
        setNcOpen(false);
        setNc(0);
      } else if (s.ccOpen) {
        setCcOpen(false);
        setCc(0);
      } else if (s.app && s.appPhase !== "closing") closeApp();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [closeApp, setNc, setCc]);

  /* صفحات و پارالاکس */
  const pagesRef = useRef<HTMLDivElement | null>(null);
  const wallRef = useRef<HTMLDivElement | null>(null);
  const deviceRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState(0);

  const onPagesScroll = useCallback(() => {
    const el = pagesRef.current;
    if (!el) return;
    const maxAbs = el.scrollWidth - el.clientWidth;
    const p = maxAbs > 0 ? Math.min(1, Math.abs(el.scrollLeft) / maxAbs) : 0;
    if (wallRef.current) {
      wallRef.current.style.transform = `translateX(${(0.5 - p) * 44}px) scale(1.08)`;
    }
    setPage(Math.round(p * (PAGES - 1)));
  }, []);

  const jumpToPage = (i: number) => {
    const el = pagesRef.current;
    if (!el) return;
    const maxAbs = el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: i === 0 ? 0 : -maxAbs, behavior: "smooth" });
  };

  /* حرکات کشیدن از بالا/پایین */
  const gesture = useRef<{
    type: "nc" | "cc" | "close-app";
    startY: number;
    id: number;
  } | null>(null);

  const onRootPointerDown = (e: React.PointerEvent) => {
    if (wiggle || drag || gesture.current || drawerOpen || ncOpen || ccOpen) return;
    const rect = deviceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    const inApp = !!app && appPhase !== "closing";
    if (y < 46 || y > rect.height - 44) {
      /* لمس دکمه‌ها در نوار وضعیت/نوار خانه → کلیک مستقیم، نه حرکت */
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("button,[role=button],a,select,input,textarea")) return;
    }
    if (y < 46) {
      gesture.current = { type: "nc", startY: e.clientY, id: e.pointerId };
      try {
        deviceRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* بی‌اهمیت */
      }
    } else if (y > rect.height - 44) {
      gesture.current = { type: inApp ? "close-app" : "cc", startY: e.clientY, id: e.pointerId };
      try {
        deviceRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* بی‌اهمیت */
      }
    }
  };

  const onRootPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g || e.pointerId !== g.id) return;
    const dy = e.clientY - g.startY;
    if (g.type === "nc") setNc(Math.max(0, Math.min(1, dy / 150)));
    else if (g.type === "cc") setCc(Math.max(0, Math.min(1, -dy / 170)));
  };

  const onRootPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || e.pointerId !== g.id) return;
    if (g.type === "nc") {
      const open = ncProgRef.current > 0.4;
      if (open) {
        setNcOpen(true);
        setNc(1);
        pushLayer("nc");
      } else setNc(0);
    } else if (g.type === "cc") {
      const open = ccProgRef.current > 0.4;
      if (open) {
        setCcOpen(true);
        setCc(1);
        pushLayer("cc");
      } else setCc(0);
    } else {
      // کشیدن به بالا روی نوار خانه هنگام باز بودن اپ → بستن اپ
      if (e.clientY - g.startY < -36 && app && appPhase !== "closing") closeLayerUI("app");
    }
  };

  const openNC = () => {
    setNcOpen(true);
    setNc(1);
    pushLayer("nc");
  };
  const openCC = () => {
    setCcOpen(true);
    setCc(1);
    pushLayer("cc");
  };
  const openDrawer = () => {
    if (drawerOpen) return;
    if (ncOpen) closeLayerUI("nc");
    if (ccOpen) closeLayerUI("cc");
    setDrawerOpen(true);
    pushLayer("drawer");
  };
  const navFromDrawer = (kind: "app" | "nc" | "cc", id?: AppId) => {
    setDrawerOpen(false);
    try {
      history.replaceState({ sd: kind }, "");
      lastPushedRef.current = kind;
    } catch {
      /* بی‌اهمیت */
    }
    buzz();
    if (kind === "app" && id) launchApp(id, true);
    else if (kind === "nc") {
      setNcOpen(true);
      setNc(1);
    } else {
      setCcOpen(true);
      setCc(1);
    }
  };

  /* ترتیب ذخیره‌شده آیکون‌ها */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = localStorage.getItem(GRID_ORDER_KEY);
        if (raw) {
          const arr = JSON.parse(raw) as AppId[];
          if (Array.isArray(arr)) {
            /* ادغام ترتیب ذخیره‌شده با اپ‌های جدید (اپ جدید به انتها اضافه می‌شود) */
            const known = arr.filter((a) => a in APPS);
            const merged = [...known, ...DEFAULT_GRID_ORDER.filter((d) => !known.includes(d))];
            if (merged.length && alive) setGridOrder(merged);
          }
        }
      } catch {
        /* ترتیب پیش‌فرض */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const persistOrder = (order: AppId[]) => {
    try {
      localStorage.setItem(GRID_ORDER_KEY, JSON.stringify(order));
    } catch {
      /* حالت ناشناس */
    }
  };

  /* لانگ‌پرس → لرزش | در حالت لرزش → کشیدن */
  const pressRef = useRef<{
    id: AppId;
    startX: number;
    startY: number;
    timer: ReturnType<typeof setTimeout> | null;
    longFired: boolean;
  } | null>(null);
  const iconRefs = useRef<Partial<Record<AppId, HTMLButtonElement | null>>>({});

  const cancelLongPress = () => {
    if (pressRef.current?.timer) clearTimeout(pressRef.current.timer);
  };

  const startLongPress = (id: AppId, e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* بی‌اهمیت */
    }
    pressRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      timer: setTimeout(() => {
        setWiggle(true);
        buzz();
        if (pressRef.current) pressRef.current.longFired = true;
      }, LONG_PRESS_MS),
      longFired: false,
    };
  };

  const startDrag = (id: AppId, e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* بی‌اهمیت */
    }
    setDrag({ id, x: e.clientX, y: e.clientY });
  };

  const onIconPointerMove = (id: AppId, e: React.PointerEvent) => {
    if (wiggle) {
      if (!drag || drag.id !== id) return;
      setDrag({ id, x: e.clientX, y: e.clientY });
      const target = gridOrder.findIndex((a) => {
        const el = iconRefs.current[a];
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right;
      });
      if (target >= 0 && target !== gridOrder.indexOf(id)) {
        setGridOrder((prev) => {
          const from = prev.indexOf(id);
          const next = [...prev];
          next.splice(from, 1);
          next.splice(target, 0, id);
          return next;
        });
      }
      return;
    }
    const p = pressRef.current;
    if (p && p.id === id) {
      const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
      if (dist > 10) cancelLongPress();
    }
  };

  const onIconPointerUp = () => {
    cancelLongPress();
    if (drag) {
      persistOrder(gridOrder);
      setDrag(null);
      buzz();
    }
  };

  const launchApp = (id: AppId, noPush = false) => {
    const el = iconRefs.current[id];
    const dRect = deviceRef.current?.getBoundingClientRect();
    if (!dRect) return;
    const r = el?.getBoundingClientRect() ?? dRect;
    buzz();
    setApp({
      id,
      rect: {
        x: r.left - dRect.left,
        y: r.top - dRect.top,
        w: r.width,
        h: r.height,
        dw: dRect.width,
        dh: dRect.height,
      },
    });
    setAppPhase("opening");
    requestAnimationFrame(() => requestAnimationFrame(() => setAppPhase("open")));
    if (!noPush) pushLayer("app");
  };

  const onIconClick = (id: AppId) => {
    if (pressRef.current?.longFired) {
      if (pressRef.current) pressRef.current.longFired = false;
      return;
    }
    if (wiggle) return;
    launchApp(id);
  };

  /* بستن لایه بالایی با Esc */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (drawerOpen) closeLayerUI("drawer");
      else if (ncOpen) closeLayerUI("nc");
      else if (ccOpen) closeLayerUI("cc");
      else if (app) closeLayerUI("app");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, ncOpen, ccOpen, app, closeLayerUI]);

  /* راهنمای اولیه */
  const [hint, setHint] = useState(false);
  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.resolve();
      if (!alive) return;
      try {
        if (!localStorage.getItem(SHELL_HINT_KEY)) {
          if (alive) setHint(true);
          localStorage.setItem(SHELL_HINT_KEY, "1");
        }
      } catch {
        /* حالت ناشناس */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  /* ---------- محتوای اپ‌ها ---------- */

  const appContent = (() => {
    if (!app) return null;
    if (app.id === "news") return <NewsApp />;
    if (app.id === "about") return <AboutApp />;
    if (app.id === "chart") return <ChartApp />;
    if (app.id === "trader") return <TraderApp />;
    if (app.id === "scalp")
      return (
        <div className="p-4">
          <ScalpPanel fixedSymbol="xau" autoRefreshMs={60000} />
        </div>
      );
    if (app.id === "structure")
      return (
        <div className="p-4">
          <MarketStructurePanel
            data={ms}
            refreshing={msRefreshing}
            onExternalRefresh={() => refreshMarket(true)}
          />
        </div>
      );
    return (
      <div className="flex flex-col gap-3 p-4">
        {ms ? <TradeSuggestion data={ms} /> : (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
        <ScalpPanel />
      </div>
    );
  })();

  const sheetTransform =
    app && appPhase !== "open"
      ? `translate(${app.rect.x}px, ${app.rect.y}px) scale(${app.rect.w / app.rect.dw}, ${app.rect.h / app.rect.dh})`
      : "none";

  return (
    <div
      ref={deviceRef}
      onPointerDown={onRootPointerDown}
      onPointerMove={onRootPointerMove}
      onPointerUp={onRootPointerUp}
      onPointerCancel={() => {
        gesture.current = null;
        setNc(ncOpen ? 1 : 0);
        setCc(ccOpen ? 1 : 0);
      }}
      className="relative h-dvh w-full overflow-hidden bg-background select-none sm:h-[840px] sm:max-h-[94dvh] sm:w-[400px] sm:rounded-[3rem] sm:border sm:border-white/10 sm:shadow-[0_40px_90px_-24px_rgba(0,0,0,0.85)]"
    >
      {/* کاغذدیواری با پارالاکس */}
      <div ref={wallRef} className="absolute inset-[-10%] will-change-transform">
        <div className="absolute inset-0 bg-[radial-gradient(120%_85%_at_88%_-8%,oklch(0.34_0.09_168/0.5),transparent_58%),radial-gradient(95%_75%_at_8%_108%,oklch(0.3_0.08_262/0.45),transparent_55%),linear-gradient(180deg,oklch(0.2_0.02_240)_0%,oklch(0.15_0.015_240)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(3px_3px_at_20%_30%,rgba(255,255,255,0.16),transparent),radial-gradient(2px_2px_at_70%_18%,rgba(255,255,255,0.12),transparent),radial-gradient(2px_2px_at_42%_62%,rgba(255,255,255,0.1),transparent),radial-gradient(3px_3px_at_85%_70%,rgba(255,255,255,0.08),transparent)]" />
      </div>

      {/* نوار وضعیت — لمس ساعت: مرکز اعلان‌ها | لمس باتری: مرکز کنترل */}
      <div className="absolute inset-x-0 top-0 z-30 flex h-11 items-center justify-between px-5">
        <button
          type="button"
          onClick={openNC}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[13px] font-extrabold tabular-nums text-foreground/95 transition-colors hover:bg-white/10"
          aria-label="باز کردن مرکز اعلان‌ها"
        >
          {faTime(now)}
        </button>
        <div className="flex items-center gap-1.5 text-foreground/85">
          <SignalHigh className="h-3.5 w-3.5" />
          <Wifi className="h-3.5 w-3.5" />
          <button
            type="button"
            onClick={openCC}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="باز کردن مرکز کنترل"
            className="rounded-full p-0.5 transition-colors hover:bg-white/10"
          >
            <BatteryFull className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={openDrawer}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="باز کردن منوی جانبی"
            className="rounded-full p-1 transition-colors hover:bg-white/10"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* صفحات */}
      <div
        ref={pagesRef}
        onScroll={onPagesScroll}
        className="no-scrollbar absolute inset-x-0 top-11 bottom-[104px] flex snap-x snap-mandatory overflow-x-auto overscroll-contain"
      >
        {/* صفحه ۱ — ویجت‌ها و آیکون‌ها */}
        <section className="no-scrollbar h-full w-full shrink-0 snap-center overflow-y-auto">
          <div className="flex min-h-full flex-col gap-3 px-4 pb-4 pt-3">
            {/* سربرگ اصلی — لوگوی BIG TRADER */}
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2" data-testid="bt-header-logo">
              <div className="flex min-w-0 items-center gap-2">
                <img
                  src="/logo3.png"
                  alt="لوگوی BIG TRADER — نشان شیر و تاج"
                  className="h-9 w-9 flex-none rounded-full shadow-lg shadow-black/40 ring-1 ring-white/20"
                  data-testid="bt-header-logo-img"
                />
                <div className="min-w-0 leading-tight">
                  <p dir="ltr" className="truncate bg-gradient-to-l from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-[17px] font-black tracking-wide text-transparent">
                    BIG TRADER
                  </p>
                  <p className="truncate text-[9px] font-bold text-muted-foreground">دستیار هوشمند معامله‌گری · رصدگر دلار</p>
                </div>
              </div>
              <span className="flex-none rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">پایش زنده</span>
            </div>

            <TrendChangeBanner data={ms} />

            <div className="grid grid-cols-2 gap-2.5">
              <PriceWidget sym={ms?.xau ?? null} title="طلا — XAUUSD" />
              <PriceWidget sym={ms?.dji ?? null} title="داوجونز — DJI" />
              <CountdownWidget />
              <TodayCountWidget />
              <DigestMiniWidget />
            </div>

            {/* آیکون‌های اپ — نگه‌داشتن = لرزش و جابه‌جایی */}
            <div
              className={`mt-1 grid grid-cols-4 gap-2 ${
                wiggle ? "rounded-xl border border-dashed border-white/15 bg-white/5 p-2" : ""
              }`}
            >
              {gridOrder.map((id) => {
                const isDragged = drag?.id === id;
                return (
                  <button
                    key={id}
                    ref={(el) => {
                      iconRefs.current[id] = el;
                    }}
                    type="button"
                    data-app-id={id}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (wiggle) startDrag(id, e);
                      else startLongPress(id, e);
                    }}
                    onPointerMove={(e) => onIconPointerMove(id, e)}
                    onPointerUp={onIconPointerUp}
                    onPointerCancel={onIconPointerUp}
                    onClick={() => onIconClick(id)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl p-1 transition-opacity ${
                      wiggle ? "touch-none" : ""
                    } ${isDragged ? "opacity-25" : ""}`}
                    aria-label={APPS[id].label}
                  >
                    <span className={wiggle && !isDragged ? "wiggling block" : "block"}>
                      <IconVisual id={id} />
                    </span>
                    <span className="text-[10px] font-bold leading-3 text-foreground/90 drop-shadow">
                      {APPS[id].label}
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="text-center text-[9px] text-muted-foreground/60">
              صفحه ۱ از ۲ — برای صفحه بعد به چپ بکشید
            </p>
          </div>
        </section>

        {/* صفحه ۲ — ویجت‌های تحلیلی */}
        <section className="no-scrollbar h-full w-full shrink-0 snap-center overflow-y-auto">
          <div className="grid min-h-full grid-cols-2 content-start gap-2.5 px-4 pb-4 pt-3">
            <StructureGlanceWidget />
            <TopNewsWidget />
            <GestureHintWidget />
          </div>
        </section>
      </div>

      {/* نقطه‌های صفحه */}
      <div className="absolute inset-x-0 bottom-[92px] z-20 flex items-center justify-center gap-1.5">
        {Array.from({ length: PAGES }).map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`صفحه ${i + 1}`}
            onClick={() => jumpToPage(i)}
            onPointerDown={(e) => e.stopPropagation()}
            className={`h-1.5 rounded-full transition-all ${
              page === i ? "w-4 bg-white/85" : "w-1.5 bg-white/30"
            }`}
          />
        ))}
      </div>

      {/* داک */}
      <div className="absolute inset-x-3 bottom-9 z-20">
        <div className="frost flex items-center justify-around rounded-[1.75rem] border border-white/10 px-2 py-2.5">
          <button
            type="button"
            onClick={() => launchApp("news")}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex flex-col items-center"
            aria-label="اخبار دلار"
          >
            <IconVisual id="news" size={46} />
          </button>
          <button
            type="button"
            onClick={() => launchApp("structure")}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex flex-col items-center"
            aria-label="ساختار بازار"
          >
            <IconVisual id="structure" size={46} />
          </button>
          <button
            type="button"
            onClick={() => (ncOpen ? closeLayerUI("nc") : openNC())}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex flex-col items-center"
            aria-label="مرکز اعلان‌ها"
          >
            <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[15px] border border-amber-500/30 bg-amber-500/15 shadow-lg shadow-black/40">
              <BellRing className="h-5 w-5 text-amber-300" />
            </div>
          </button>
          <button
            type="button"
            onClick={() => (ccOpen ? closeLayerUI("cc") : openCC())}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex flex-col items-center"
            aria-label="مرکز کنترل"
          >
            <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[15px] border border-white/15 bg-white/10 shadow-lg shadow-black/40">
              <SlidersHorizontal className="h-5 w-5 text-foreground/90" />
            </div>
          </button>
        </div>
      </div>

      {/* نوار خانه — لمس: اپ باز → بستن | اپ بسته → مرکز کنترل */}
      <div
        role="button"
        tabIndex={0}
        aria-label="نوار خانه"
        onClick={() => (app ? closeLayerUI("app") : ccOpen ? closeLayerUI("cc") : openCC())}
        className="absolute inset-x-0 bottom-0 z-20 flex h-9 cursor-pointer items-start justify-center pt-2"
      >
        <div className="h-1.5 w-28 rounded-full bg-white/45" />
      </div>

      {/* دکمه پایان حالت لرزش */}
      {wiggle && (
        <button
          type="button"
          data-testid="wiggle-done"
          onClick={() => {
            setWiggle(false);
            persistOrder(gridOrder);
          }}
          className="absolute left-1/2 top-[52px] z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-white/15 px-4 py-1.5 text-xs font-extrabold backdrop-blur-md hover:bg-white/25"
        >
          <Check className="h-3.5 w-3.5" />
          پایان
        </button>
      )}

      {/* راهنمای اولیه */}
      {hint && (
        <button
          type="button"
          onClick={() => setHint(false)}
          className="hint-toast absolute inset-x-6 bottom-[104px] z-40 rounded-2xl border border-white/15 bg-black/55 px-3 py-2.5 text-center text-[10px] leading-5 text-foreground/90 backdrop-blur-md"
        >
          دکمه <b>☰</b> (بالا-چپ) منوی جانبی — دکمه <b>→</b> در هر اپ: بازگشت — دکمه برگشت خود گوشی
          هم کار می‌کند
        </button>
      )}

      {/* منوی جانبی */}
      <div
        className={`absolute inset-0 z-[80] ${drawerOpen ? "" : "pointer-events-none"}`}
        data-testid="drawer"
      >
        <div
          onClick={() => closeLayerUI("drawer")}
          className="absolute inset-0 bg-black/50 transition-opacity duration-300"
          style={{ opacity: drawerOpen ? 1 : 0 }}
          aria-hidden="true"
        />
        <div
          className={`frost no-scrollbar absolute inset-y-0 right-0 flex w-[80%] max-w-[304px] flex-col gap-2 overflow-y-auto rounded-l-[26px] border-l border-white/10 p-3.5 transition-transform duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
            drawerOpen ? "translate-x-0" : "translate-x-[108%]"
          }`}
          role="dialog"
          aria-label="منوی جانبی"
          aria-hidden={!drawerOpen}
        >
          <div className="mb-1 flex items-center gap-2.5">
            <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-gradient-to-br from-emerald-500 to-teal-700 shadow-lg shadow-black/40">
              <DollarSign className="h-5.5 w-5.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-extrabold leading-[22px]">رصدگر دلار</p>
              <p className="text-[9px] text-muted-foreground">منوی دسترسی سریع</p>
            </div>
            <button
              type="button"
              onClick={() => closeLayerUI("drawer")}
              aria-label="بستن منو"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-white/15 bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-1 px-1 text-[9px] font-extrabold tracking-wide text-muted-foreground/75">اپ‌ها</p>
          {gridOrder.map((id) => {
            const a = APPS[id];
            const Icon = a.icon;
            return (
              <button
                key={id}
                type="button"
                onClick={() => navFromDrawer("app", id)}
                className="flex w-full items-center gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.04] px-2.5 py-2 text-right transition-transform active:scale-[0.98] active:bg-white/10"
              >
                <div className={`flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl bg-gradient-to-br ${a.cls}`}>
                  <Icon className="h-[18px] w-[18px] text-white" />
                </div>
                <span className="min-w-0 flex-1 truncate text-xs font-bold">{a.label}</span>
                <ChevronLeft className="h-4 w-4 flex-none text-muted-foreground/80" />
              </button>
            );
          })}

          <p className="mt-1 px-1 text-[9px] font-extrabold tracking-wide text-muted-foreground/75">مراکز</p>
          <button
            type="button"
            onClick={() => navFromDrawer("nc")}
            className="flex w-full items-center gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.04] px-2.5 py-2 text-right transition-transform active:scale-[0.98] active:bg-white/10"
          >
            <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15">
              <BellRing className="h-[18px] w-[18px] text-amber-300" />
            </div>
            <span className="min-w-0 flex-1 truncate text-xs font-bold">مرکز اعلان‌ها</span>
            <ChevronLeft className="h-4 w-4 flex-none text-muted-foreground/80" />
          </button>
          <button
            type="button"
            onClick={() => navFromDrawer("cc")}
            className="flex w-full items-center gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.04] px-2.5 py-2 text-right transition-transform active:scale-[0.98] active:bg-white/10"
          >
            <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl border border-white/15 bg-white/10">
              <SlidersHorizontal className="h-[18px] w-[18px] text-foreground/90" />
            </div>
            <span className="min-w-0 flex-1 truncate text-xs font-bold">مرکز کنترل</span>
            <ChevronLeft className="h-4 w-4 flex-none text-muted-foreground/80" />
          </button>

          <p className="mt-1 px-1 text-[9px] font-extrabold tracking-wide text-muted-foreground/75">دسترسی سریع</p>
          <button
            type="button"
            onClick={() => refreshMarket(true)}
            disabled={msRefreshing}
            className="flex w-full items-center gap-2.5 rounded-[14px] border border-white/10 bg-white/[0.04] px-2.5 py-2 text-right transition-transform active:scale-[0.98] active:bg-white/10"
          >
            <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/15">
              <RefreshCw className={`h-[18px] w-[18px] text-emerald-400 ${msRefreshing ? "animate-spin" : ""}`} />
            </div>
            <span className="min-w-0 flex-1 truncate text-xs font-bold">بروزرسانی قیمت‌ها</span>
            <ChevronLeft className="h-4 w-4 flex-none text-muted-foreground/80" />
          </button>
          <p className="mt-1 text-center text-[8px] leading-4 text-muted-foreground/60">
            این ابزار صرفاً اطلاع‌رسانی است و توصیه سرمایه‌گذاری محسوب نمی‌شود.
          </p>
        </div>
      </div>

      {/* مرکز اعلان‌ها و کنترل */}
      <NotificationCenter progress={ncOpen ? 1 : ncProgress} onClose={() => closeLayerUI("nc")} />
      <ControlCenter progress={ccOpen ? 1 : ccProgress} onClose={() => closeLayerUI("cc")} />

      {/* شبح آیکون در حال جابه‌جایی */}
      {drag && (
        <div
          className="pointer-events-none fixed z-[90] flex flex-col items-center gap-1.5"
          style={{ left: drag.x, top: drag.y, transform: "translate(-50%,-50%) scale(1.18)" }}
        >
          <IconVisual id={drag.id} />
          <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold">
            {APPS[drag.id].label}
          </span>
        </div>
      )}

      {/* شیت اپ با انیمیشن بزرگ‌نمایی از آیکون */}
      {app && (
        <div
          className="absolute inset-0 z-[60] overflow-hidden bg-background"
          style={{
            transform: sheetTransform,
            transformOrigin: "top left",
            borderRadius: appPhase === "open" ? "0px" : "22px",
            transition:
              appPhase === "open"
                ? "transform 0.42s cubic-bezier(0.32,0.72,0,1), border-radius 0.42s cubic-bezier(0.32,0.72,0,1)"
                : "none",
          }}
          data-testid="app-sheet"
          data-app-id={app.id}
        >
          {/* نوار بالای اپ — برگشت + عنوان + منو */}
          <div className="absolute inset-x-0 top-0 z-[6] flex h-12 items-center gap-2 px-2.5" data-testid="app-topbar">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background via-background/80 to-transparent" />
            <button
              type="button"
              onClick={() => closeLayerUI("app")}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="بازگشت به صفحه قبل"
              className="relative z-[1] flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full border border-white/15 bg-[rgba(30,38,47,0.88)] backdrop-blur-md transition-colors hover:bg-white/20"
            >
              <ArrowRight className="h-[18px] w-[18px]" />
            </button>
            <span className="relative z-[1] min-w-0 flex-1 truncate text-[13px] font-extrabold drop-shadow">
              {APPS[app.id].label}
            </span>
            <button
              type="button"
              onClick={openDrawer}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="باز کردن منوی جانبی"
              className="relative z-[1] flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full border border-white/15 bg-[rgba(30,38,47,0.88)] backdrop-blur-md transition-colors hover:bg-white/20"
            >
              <Menu className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="no-scrollbar absolute inset-0 overflow-y-auto pb-8 pt-14">
            {appContent}
          </div>
          <div
            role="button"
            tabIndex={0}
            aria-label="بستن اپ"
            onClick={() => closeLayerUI("app")}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-0 flex h-8 cursor-pointer items-start justify-center pt-2.5"
          >
            <div className="h-1.5 w-28 rounded-full bg-white/40" />
          </div>
        </div>
      )}
    </div>
  );
}

export function PhoneShell() {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-[linear-gradient(180deg,oklch(0.13_0.015_240),oklch(0.1_0.01_240))] sm:p-6">
      <PhoneDataProvider>
        <Shell />
      </PhoneDataProvider>
    </div>
  );
}
