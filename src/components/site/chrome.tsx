"use client";

/* اسکلت سایت: تیکر زنده + هدر چسبان + فوتر */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Container, LiveDot } from "./ui";
import { fa, fmtClock, fmtPct, fmtPrice, nextHighImpact, type MarketStructure, type NewsEvent } from "./site-data";
import version from "../../../version.json";

const NAV = [
  { href: "#markets", label: "بازار زنده" },
  { href: "#thermometer", label: "دماسنج فشار" },
  { href: "#calendar", label: "تقویم اقتصادی" },
  { href: "#analysis", label: "تحلیل و پیش‌بینی" },
  { href: "#features", label: "امکانات" },
  { href: "#get", label: "دریافت" },
];

/* ---------- تیکر نوار متحرک ---------- */

export function TickerTape({ ms }: { ms: MarketStructure | null }) {
  const items: { fa_: string; price?: number; pct?: number; dec: number }[] = [
    { fa_: "طلا — XAUUSD", price: ms?.xau.price, pct: ms?.xau.changePct, dec: 2 },
    { fa_: "داوجونز — DJI", price: ms?.dji.price, pct: ms?.dji.changePct, dec: 2 },
  ];
  const row = [...items, ...items, ...items, ...items];
  return (
    <div className="relative overflow-hidden border-b border-white/8 bg-bt-ink-900/80 backdrop-blur">
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-bt-ink-900 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-bt-ink-900 to-transparent" />
      <div className="bt-marquee-paused flex w-max items-center gap-8 py-2">
        <div className="bt-animate-marquee flex w-max items-center gap-8">
          {row.map((it, i) => (
            <div key={i} className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[12px]">
              <span className="font-semibold text-slate-300">{it.fa_}</span>
              <span className="text-slate-600">|</span>
              <span className="bt-num text-slate-100">{fmtPrice(it.price, it.dec)}</span>
              <span className={cn("bt-num text-[11px] font-semibold", (it.pct ?? 0) >= 0 ? "text-bt-bull-400" : "text-bt-bear-400")}>
                {it.pct === undefined || it.pct === null ? "—" : fmtPct(it.pct)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- هدر ---------- */

export function SiteHeader({
  ms,
  events,
  onOpenTool,
}: {
  ms: MarketStructure | null;
  events: NewsEvent[] | null;
  onOpenTool: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [next, setNext] = useState<NewsEvent | null>(null);

  useEffect(() => {
    const tick = () => {
      setNow(new Date());
      setNext(nextHighImpact(events));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [events]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const cd = next
    ? (() => {
        const diff = Math.max(0, new Date(next.dateISO).getTime() - (now?.getTime() || 0));
        const s = Math.floor(diff / 1000);
        return { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60) };
      })()
    : null;

  return (
    <header className="sticky top-0 z-50">
      <TickerTape ms={ms} />
      <div
        className={cn(
          "border-b transition-all duration-300",
          scrolled ? "border-white/8 bg-bt-ink-950/85 backdrop-blur-xl" : "border-transparent bg-bt-ink-950/40 backdrop-blur-md",
        )}
      >
        <Container className="flex h-16 items-center justify-between gap-4">
          <a href="#top" className="flex shrink-0 items-center gap-3">
            <img src="/logo3.png" alt="لوگوی BIG TRADER" className="h-10 w-10 rounded-xl object-contain" />
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span dir="ltr" className="text-[15px] font-extrabold tracking-[0.18em] text-white">
                  BIG TRADER
                </span>
                <span className="hidden rounded-md border border-bt-gold-400/30 bg-bt-gold-400/10 px-1.5 py-0.5 text-[9px] font-bold text-bt-gold-300 sm:block">
                  v{fa(version.version)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">دستیار هوشمند معامله‌گری · رصدگر دلار</p>
            </div>
          </a>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-xl px-3 py-2 text-[13px] font-medium text-slate-300 transition hover:bg-white/6 hover:text-white"
              >
                {n.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {next && cd ? (
              <div className="hidden items-center gap-2 rounded-full border border-bt-bear-500/30 bg-bt-bear-500/8 px-3 py-1.5 md:flex" title={next.titleFa || next.title}>
                <LiveDot />
                <span className="bt-num text-[11px] font-bold text-bt-bear-400">
                  خبر مهم تا {fa(cd.h)}:{fa(String(cd.m).padStart(2, "0"))}
                </span>
              </div>
            ) : (
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-1.5 md:flex">
                <LiveDot />
                <span className="text-[11px] font-medium text-slate-300">{now ? fmtClock(now) : ""} تهران</span>
              </div>
            )}

            <button
              onClick={onOpenTool}
              className="rounded-xl bg-gradient-to-l from-bt-gold-500 to-bt-gold-300 px-4 py-2.5 text-[13px] font-bold text-bt-ink-950 shadow-lg shadow-bt-gold-600/25 transition hover:brightness-110"
            >
              ورود به ابزار
            </button>

            <button
              onClick={() => setOpen((o) => !o)}
              aria-label="منو"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/4 text-slate-200 lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                {open ? (
                  <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </Container>

        {open && (
          <div className="border-t border-white/8 bg-bt-ink-950/95 lg:hidden">
            <Container className="grid grid-cols-2 gap-2 py-4">
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-center text-[13px] font-medium text-slate-200"
                >
                  {n.label}
                </a>
              ))}
            </Container>
          </div>
        )}
      </div>
    </header>
  );
}

/* ---------- فوتر ---------- */

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/8 bg-bt-ink-900/60">
      <Container className="grid gap-8 py-10 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <img src="/logo3.png" alt="لوگوی BIG TRADER" className="h-10 w-10 rounded-xl object-contain" />
            <div>
              <p dir="ltr" className="text-[14px] font-extrabold tracking-[0.18em] text-white">
                BIG TRADER
              </p>
              <p className="text-[11px] text-slate-400">رصدگر دلار — نسخه {fa(version.version)}</p>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-[12px] leading-6 text-slate-400">
            ابزار فارسی پایش اخبار اقتصادی دلار، ساختار بازار طلا و داوجونز، دماسنج فشار خرید و فروش و
            تحلیل و پیش‌بینی روزانه — با نسخهٔ وب، فایل مستقل تک‌فایلی و افزونهٔ وردپرس.
          </p>
        </div>
        <div>
          <p className="text-[12.5px] font-bold text-slate-200">بخش‌ها</p>
          <ul className="mt-3 space-y-2 text-[12px] text-slate-400">
            {NAV.slice(0, 4).map((n) => (
              <li key={n.href}>
                <a href={n.href} className="transition hover:text-bt-gold-300">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[12.5px] font-bold text-slate-200">منابع داده</p>
          <ul className="mt-3 space-y-2 text-[12px] leading-6 text-slate-400">
            <li>اخبار اقتصادی: ForexFactory</li>
            <li>کندل‌ها: Yahoo Finance + کالیبراسیون اسپات</li>
            <li>دماسنج فشار: TradingView Technicals</li>
            <li>تحلیل و پیش‌بینی: LiteFinance · FXStreet</li>
          </ul>
        </div>
      </Container>
      <div className="border-t border-white/6">
        <Container className="flex flex-col items-center justify-between gap-3 py-4 text-[11px] text-slate-500 sm:flex-row">
          <p>این ابزار صرفاً اطلاع‌رسانی محاسبه‌شده از دادهٔ عمومی است و توصیهٔ سرمایه‌گذاری محسوب نمی‌شود.</p>
          <a
            href="https://github.com/zaghianm1357/rasadgar-dollar"
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-slate-300"
          >
            مخزن گیت‌هاب پروژه ↗
          </a>
        </Container>
      </div>
    </footer>
  );
}
