import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { fa, fmtPct } from "@/lib/format";
import type { Bias } from "@/lib/market";
import logoUrl from "@/assets/logo.png";

export function Logo({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-gold-400/25 bg-ink-900 shadow-[0_0_28px_-8px] shadow-gold-500/50",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img src={logoUrl} alt="بیگ تردر" className="h-full w-full scale-[1.06] object-cover" />
    </div>
  );
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function Card({
  children,
  className,
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass relative rounded-3xl",
        glow && "shadow-[0_30px_80px_-40px_rgba(214,159,43,0.45)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  desc,
  center = false,
}: {
  eyebrow: string;
  title: ReactNode;
  desc?: string;
  center?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/25 bg-gold-400/8 px-3 py-1 text-[11px] font-medium tracking-wide text-gold-300">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
        {eyebrow}
      </span>
      <h2 className="mt-4 text-2xl leading-tight font-extrabold text-white sm:text-3xl lg:text-[2.4rem]">{title}</h2>
      {desc && <p className="mt-3 text-sm leading-7 text-slate-400 sm:text-[15px]">{desc}</p>}
    </div>
  );
}

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("transition-all duration-700 ease-out", shown ? "opacity-100" : "translate-y-6 opacity-0", className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export function Delta({
  value,
  decimals = 2,
  className,
  showArrow = true,
}: {
  value: number;
  decimals?: number;
  className?: string;
  showArrow?: boolean;
}) {
  const up = value >= 0;
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-xs font-semibold",
        up ? "bg-bull-500/12 text-bull-400" : "bg-bear-500/12 text-bear-400",
        className,
      )}
    >
      {showArrow && <span className="text-[10px]">{up ? "▲" : "▼"}</span>}
      {fmtPct(value, decimals)}
    </span>
  );
}

const biasStyles: Record<Bias, string> = {
  bull: "bg-bull-500/14 text-bull-400 border-bull-500/25",
  bear: "bg-bear-500/14 text-bear-400 border-bear-500/25",
  flat: "bg-white/6 text-slate-300 border-white/12",
};

const biasDot: Record<Bias, string> = {
  bull: "bg-bull-400",
  bear: "bg-bear-400",
  flat: "bg-slate-400",
};

export function BiasChip({ bias, strength }: { bias: Bias; strength?: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        biasStyles[bias],
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", biasDot[bias])} />
      {bias === "bull" ? "صعودی" : bias === "bear" ? "نزولی" : "خنثی"}
      {strength !== undefined && <span className="num opacity-70">{fa(strength)}٪</span>}
    </span>
  );
}

export function Sparkline({
  data,
  up,
  className,
  strokeWidth = 2,
}: {
  data: number[];
  up: boolean;
  className?: string;
  strokeWidth?: number;
}) {
  if (data.length < 2) return <div className={className} />;
  const w = 120;
  const h = 38;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const id = `sp-${up ? "u" : "d"}-${data.length}-${Math.round(min * 100)}`;
  const stroke = up ? "#34d99a" : "#ff7076";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-10 w-full", className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${pts.join(" ")} ${w},${h}`} fill={`url(#${id})`} />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function LiveDot({ paused = false }: { paused?: boolean }) {
  return (
    <span className="relative grid h-2.5 w-2.5 place-items-center">
      {!paused && <span className="absolute h-2.5 w-2.5 animate-pulse-ring rounded-full bg-bull-400/60" />}
      <span className={cn("h-1.5 w-1.5 rounded-full", paused ? "bg-gold-400" : "bg-bull-400")} />
    </span>
  );
}
