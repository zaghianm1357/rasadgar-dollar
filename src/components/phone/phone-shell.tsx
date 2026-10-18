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
  Info,
  BellRing,
  SlidersHorizontal,
  SignalHigh,
  Wifi,
  BatteryFull,
  Check,
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
import { NewsApp } from "./apps/news-app";
import { AboutApp } from "./apps/about-app";

/* ---------- تعریف اپ‌ها ---------- */

type AppId = "news" | "structure" | "suggestion" | "about";

const APPS: Record<
  AppId,
  { label: string; icon: typeof Newspaper; cls: string }
> = {
  news: { label: "اخبار دلار", icon: Newspaper, cls: "from-emerald-500 to-teal-700" },
  structure: { label: "ساختار بازار", icon: Activity, cls: "from-sky-500 to-indigo-700" },
  suggestion: { label: "پیشنهاد معامله", icon: Crosshair, cls: "from-violet-500 to-fuchsia-700" },
  about: { label: "درباره", icon: Info, cls: "from-zinc-500 to-zinc-700" },
};

const DEFAULT_GRID_ORDER: AppId[] = ["news", "structure", "suggestion", "about"];
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

  const setNc = useCallback((v: number) => {
    ncProgRef.current = v;
    setNcProgress(v);
  }, []);
  const setCc = useCallback((v: number) => {
    ccProgRef.current = v;
    setCcProgress(v);
  }, []);

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

  /* اجرای اپ با انیمیشن بزرگ‌نمایی از موقعیت آیکون (FLIP) */
  const [app, setApp] = useState<{ id: AppId; rect: AppRect } | null>(null);
  const [appPhase, setAppPhase] = useState<"opening" | "open" | "closing">("open");

  const closeApp = useCallback(() => {
    setAppPhase("closing");
    setTimeout(() => setApp(null), 420);
  }, []);

  /* حرکات کشیدن از بالا/پایین */
  const gesture = useRef<{
    type: "nc" | "cc" | "close-app";
    startY: number;
    id: number;
  } | null>(null);

  const onRootPointerDown = (e: React.PointerEvent) => {
    if (wiggle || drag || gesture.current || ncOpen || ccOpen) return;
    const rect = deviceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    const inApp = !!app && appPhase !== "closing";
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
      setNcOpen(open);
      setNc(open ? 1 : 0);
    } else if (g.type === "cc") {
      const open = ccProgRef.current > 0.4;
      setCcOpen(open);
      setCc(open ? 1 : 0);
    } else {
      // کشیدن به بالا روی نوار خانه هنگام باز بودن اپ → بستن اپ
      if (e.clientY - g.startY < -36 && app && appPhase !== "closing") closeApp();
    }
  };

  const openNC = () => {
    setNcOpen(true);
    setNc(1);
  };
  const openCC = () => {
    setCcOpen(true);
    setCc(1);
  };
  const closeNC = () => {
    setNcOpen(false);
    setNc(0);
  };
  const closeCC = () => {
    setCcOpen(false);
    setCc(0);
  };

  /* ترتیب ذخیره‌شده آیکون‌ها */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = localStorage.getItem(GRID_ORDER_KEY);
        if (raw) {
          const arr = JSON.parse(raw) as AppId[];
          if (Array.isArray(arr) && arr.every((a) => a in APPS) && alive) {
            setGridOrder(arr);
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

  const launchApp = (id: AppId) => {
    const el = iconRefs.current[id];
    const dRect = deviceRef.current?.getBoundingClientRect();
    if (!el || !dRect) return;
    const r = el.getBoundingClientRect();
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
  };

  const onIconClick = (id: AppId) => {
    if (pressRef.current?.longFired) {
      if (pressRef.current) pressRef.current.longFired = false;
      return;
    }
    if (wiggle) return;
    launchApp(id);
  };

  /* بستن اپ با Esc */
  useEffect(() => {
    if (!app) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeApp();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [app, closeApp]);

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
      <div className="p-4">
        {ms ? (
          <TradeSuggestion data={ms} />
        ) : (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}
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
            onClick={() => (ncOpen ? closeNC() : openNC())}
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
            onClick={() => (ccOpen ? closeCC() : openCC())}
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

      {/* نوار خانه — کشیدن به بالا: اپ باز → بستن | اپ بسته → مرکز کنترل */}
      <div
        role="button"
        tabIndex={0}
        aria-label="نوار خانه"
        onClick={() => (app ? closeApp() : ccOpen ? closeCC() : openCC())}
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
          از <b>بالای صفحه</b> بکشید: مرکز اعلان‌ها — از <b>پایین</b>: مرکز کنترل — نگه‌داشتن
          آیکون‌ها: مرتب‌سازی
        </button>
      )}

      {/* مرکز اعلان‌ها و کنترل */}
      <NotificationCenter progress={ncOpen ? 1 : ncProgress} onClose={closeNC} />
      <ControlCenter progress={ccOpen ? 1 : ccProgress} onClose={closeCC} />

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
          <div className="no-scrollbar absolute inset-0 overflow-y-auto pb-8 pt-10">
            {appContent}
          </div>
          <div
            role="button"
            tabIndex={0}
            aria-label="بستن اپ"
            onClick={closeApp}
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
