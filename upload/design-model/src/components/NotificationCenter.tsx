import { useEffect } from "react";
import { cn } from "@/utils/cn";
import { useMarket } from "@/lib/MarketContext";
import { NOTICES, nextImportantEvent } from "@/lib/market";
import { countdown, fa, fmtClock, fmtFullDate, fmtTime, pad2, timeAgo } from "@/lib/format";
import { LiveDot } from "./ui";

const KIND_META = {
  trend: { label: "تغییر روند", cls: "text-bull-400 bg-bull-500/12 border-bull-500/25" },
  news: { label: "خبر پراثر", cls: "text-bear-400 bg-bear-500/12 border-bear-500/25" },
  system: { label: "وضعیت سامانه", cls: "text-gold-300 bg-gold-400/10 border-gold-400/25" },
} as const;

export default function NotificationCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { now, quotes } = useMarket();
  const next = nextImportantEvent(now);
  const cd = next ? countdown(next.ts, now) : null;
  const gold = quotes["xauusd"];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-100 transition-opacity duration-300",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-md" onClick={onClose} />
      <div
        className={cn(
          "absolute inset-x-0 top-0 mx-auto max-w-3xl px-3 pt-3 transition-transform duration-500 sm:px-4 sm:pt-5",
          open ? "translate-y-0" : "-translate-y-[115%]",
        )}
      >
        <div className="glass overflow-hidden rounded-[28px] shadow-2xl shadow-black/60">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <div>
              <p className="num text-2xl font-bold text-white">{fmtClock(now)}</p>
              <p className="text-[12px] text-slate-400">{fmtFullDate(now)}</p>
            </div>
            <button
              onClick={onClose}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:text-white"
              aria-label="بستن"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="max-h-[62vh] space-y-3 overflow-y-auto px-4 py-4">
            {cd && next && (
              <div className="rounded-2xl border border-bear-500/25 bg-bear-500/8 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold text-bear-400">خبر پراثر پیش‌رو</p>
                    <p className="mt-1 text-[14px] font-bold text-white">{next.title}</p>
                  </div>
                  <div dir="ltr" className="num flex items-center gap-1 text-white">
                    {[cd.h, cd.m, cd.s].map((v, i) => (
                      <span key={i} className="rounded-lg bg-white/8 px-2 py-1 text-sm font-bold">
                        {pad2(v)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {NOTICES.map((n) => {
              const meta = KIND_META[n.kind];
              return (
                <div key={n.id} className="rounded-2xl border border-white/8 bg-white/4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={cn("rounded-lg border px-2 py-0.5 text-[10px] font-bold", meta.cls)}>
                        {meta.label}
                      </span>
                      <p className="mt-2 text-[14px] font-bold text-white">{n.title}</p>
                      <p className="mt-1 text-[12.5px] leading-6 text-slate-400">{n.body}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-500">{timeAgo(n.ts, now)}</span>
                  </div>
                </div>
              );
            })}

            <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
              <p className="text-[13px] font-bold text-white">وضعیت سامانه</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <StatusRow label="فید اخبار ForexFactory" value="متصل · همگام‌سازی شده" ok />
                <StatusRow label="داده‌های ساختار بازار" value="بروزرسانی هر ۱۵ دقیقه" ok />
                <StatusRow label="قیمت لحظه‌ای طلا" value={`XAUUSD ${fa(gold.price.toFixed(2))}`} ok />
                <StatusRow label="اعلان‌های فعال" value={`${fa(NOTICES.length)} اعلان`} ok={false} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 border-t border-white/8 px-5 py-3 text-[11px] text-slate-500">
            <LiveDot />
            برای بستن، پس‌زمینه را لمس کنید یا کلید Esc را بزنید
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/6 bg-ink-900/60 px-3 py-2">
      <span className="text-[12px] text-slate-400">{label}</span>
      <span className={cn("flex items-center gap-1.5 text-[12px] font-semibold", ok ? "text-bull-400" : "text-gold-300")}>
        <span className={cn("h-1.5 w-1.5 rounded-full", ok ? "bg-bull-400" : "bg-gold-400")} />
        {value}
      </span>
    </div>
  );
}

export function NextEventTimerInline({ now }: { now: number }) {
  const next = nextImportantEvent(now);
  if (!next) return null;
  const cd = countdown(next.ts, now);
  return (
    <span className="num text-slate-400">
      {fmtTime(next.ts)} · {pad2(cd.h)}:{pad2(cd.m)}:{pad2(cd.s)}
    </span>
  );
}
