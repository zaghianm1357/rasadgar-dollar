"use client";

/* اصول مشترک رابط سایت BIG TRADER — الهام‌گرفته از مدل ارسالی، با دادهٔ واقعی */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BIAS_LABEL, fa, fmtPct, type Bias } from "./site-data";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)}>{children}</div>;
}

export function SectionHead({
  kicker,
  title,
  desc,
}: {
  kicker: string;
  title: ReactNode;
  desc?: string;
}) {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="text-[12px] font-bold tracking-wide text-bt-gold-400">{kicker}</p>
      <h2 className="mt-2 text-2xl font-extrabold leading-snug text-white sm:text-3xl">{title}</h2>
      {desc ? <p className="mt-3 text-[13.5px] leading-7 text-slate-400">{desc}</p> : null}
    </div>
  );
}

export function LiveDot({ paused, className }: { paused?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex h-2 w-2", className)}>
      <span
        className={cn(
          "relative inline-flex h-2 w-2 rounded-full",
          paused ? "bg-slate-500" : "bg-bt-bull-400 text-bt-bull-400 bt-pulse-ring",
        )}
      />
    </span>
  );
}

export function Delta({ value, className }: { value: number | undefined | null; className?: string }) {
  const up = (value ?? 0) >= 0;
  return (
    <span
      className={cn(
        "bt-num inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold",
        up ? "bg-bt-bull-500/12 text-bt-bull-400" : "bg-bt-bear-500/12 text-bt-bear-400",
        className,
      )}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {fmtPct(value)}
    </span>
  );
}

export function BiasChip({ bias, compact }: { bias: Bias; compact?: boolean }) {
  const cls =
    bias === "bullish"
      ? "border-bt-bull-500/30 bg-bt-bull-500/10 text-bt-bull-400"
      : bias === "bearish"
        ? "border-bt-bear-500/30 bg-bt-bear-500/10 text-bt-bear-400"
        : "border-white/12 bg-white/5 text-slate-400";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10.5px] font-bold", cls)}>
      <span aria-hidden>{bias === "bullish" ? "▲" : bias === "bearish" ? "▼" : "●"}</span>
      {compact ? null : BIAS_LABEL[bias]}
    </span>
  );
}

export function StrengthBar({ bias, strength }: { bias: Bias; strength: number }) {
  const pct = Math.max(4, Math.min(100, strength));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700",
          bias === "bullish" ? "bg-bt-bull-400" : bias === "bearish" ? "bg-bt-bear-400" : "bg-slate-500",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/6", className)} />;
}

export function Unavailable({ label = "داده موقتاً در دسترس نیست" }: { label?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/4 px-3 py-2.5 text-[11.5px] text-slate-400">
      {label} — اتصال به منبع داده برقرار نشد؛ بدون عدد ساختگی.
    </div>
  );
}

export function CountBox({ v }: { v: number }) {
  return (
    <span className="bt-num rounded-lg bg-white/8 px-1.5 py-0.5 text-[15px] font-bold text-white">
      {fa(String(v).padStart(2, "0"))}
    </span>
  );
}
