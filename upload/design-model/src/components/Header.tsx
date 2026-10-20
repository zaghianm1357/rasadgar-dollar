import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";
import { useMarket } from "@/lib/MarketContext";
import { INSTRUMENTS } from "@/lib/market";
import { fa, fmtPct, fmtPrice } from "@/lib/format";
import { Container, Delta, LiveDot, Logo } from "./ui";

const NAV = [
  { href: "#markets", label: "بازار زنده" },
  { href: "#structure", label: "ساختار بازار" },
  { href: "#calendar", label: "تقویم اقتصادی" },
  { href: "#summary", label: "خلاصه هوشمند" },
  { href: "#app", label: "اپلیکیشن" },
  { href: "#plans", label: "اشتراک" },
];

export function TickerTape() {
  const { quotes } = useMarket();
  const items = INSTRUMENTS.map((ins) => ({ ins, q: quotes[ins.id] }));
  const row = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-b border-white/8 bg-ink-900/80 backdrop-blur">
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-ink-900 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-ink-900 to-transparent" />
      <div className="group flex w-max animate-marquee items-center gap-8 py-2 hover:[animation-play-state:paused]">
        {row.map(({ ins, q }, i) => (
          <div key={`${ins.id}-${i}`} className="flex shrink-0 items-center gap-2 text-[12px] whitespace-nowrap">
            <span className="font-semibold text-slate-300">{ins.fa}</span>
            <span className="text-slate-600">|</span>
            <span className="num text-slate-100">{fmtPrice(q.price, ins.decimals)}</span>
            <span className={cn("num text-[11px] font-semibold", q.changePct >= 0 ? "text-bull-400" : "text-bear-400")}>
              {fmtPct(q.changePct)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Header({ onOpenNotifications }: { onOpenNotifications: () => void }) {
  const { paused } = useMarket();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      <TickerTape />
      <div
        className={cn(
          "border-b transition-all duration-300",
          scrolled ? "border-white/8 bg-ink-950/85 backdrop-blur-xl" : "border-transparent bg-ink-950/40 backdrop-blur-md",
        )}
      >
        <Container className="flex h-16 items-center justify-between gap-4">
          <a href="#top" className="flex items-center gap-3">
            <Logo size={42} />
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span dir="ltr" className="text-[15px] font-extrabold tracking-[0.18em] text-white">
                  BIG TRADER
                </span>
                <span className="hidden rounded-md border border-gold-400/30 bg-gold-400/10 px-1.5 py-0.5 text-[9px] font-bold text-gold-300 sm:block">
                  PRO
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
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3 py-1.5 md:flex">
              <LiveDot paused={paused} />
              <span className="text-[11px] font-medium text-slate-300">
                {paused ? "پایش متوقف" : "پایش زنده"}
              </span>
            </div>

            <button
              onClick={onOpenNotifications}
              aria-label="مرکز اعلان‌ها"
              className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/4 text-slate-200 transition hover:border-gold-400/40 hover:text-gold-300"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.7">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" strokeLinecap="round" />
                <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" />
              </svg>
              <span className="absolute -top-1 -left-1 grid h-4 w-4 place-items-center rounded-full bg-bear-500 text-[9px] font-bold text-white">
                {fa(3)}
              </span>
            </button>

            <a
              href="#plans"
              className="hidden rounded-xl bg-gradient-to-l from-gold-500 to-gold-300 px-4 py-2.5 text-[13px] font-bold text-ink-950 shadow-lg shadow-gold-600/25 transition hover:brightness-110 sm:block"
            >
              شروع رایگان
            </a>

            <button
              onClick={() => setOpen((o) => !o)}
              aria-label="منو"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/4 text-slate-200 lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                {open ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />}
              </svg>
            </button>
          </div>
        </Container>

        {open && (
          <div className="border-t border-white/8 bg-ink-950/95 lg:hidden">
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

export function MiniDeltaRow({ changePct, change }: { changePct: number; change: number }) {
  return (
    <div className="flex items-center gap-2">
      <Delta value={changePct} />
      <span className={cn("num text-[11px]", change >= 0 ? "text-bull-400/80" : "text-bear-400/80")}>
        {change >= 0 ? "+" : "−"}
        {Math.abs(change).toFixed(2)}
      </span>
    </div>
  );
}
