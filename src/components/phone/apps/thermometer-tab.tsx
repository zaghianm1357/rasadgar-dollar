"use client";

import { useMemo } from "react";
import { AlertTriangle, RefreshCw, Thermometer } from "lucide-react";
import { faDigits, faTime } from "@/lib/tehran";

function faNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return faDigits(Number(v.toFixed(digits)).toLocaleString("en-US", { maximumFractionDigits: digits })).replace(/,/g, "٬");
}

/* ---------- تایپ پاسخ /api/pressure ---------- */

export interface PressureIndicator {
  id: string;
  nameFa: string;
  score: number;
  dir: string;
}

export interface PressureResponse {
  ok: true;
  symbol: { key: string; labelFa: string };
  tf: string;
  tfLabel: string;
  score: number;
  zone: string;
  zoneFa: string;
  dir: string;
  consensus: { total: number; buy: number; sell: number; neutral: number; sentenceFa: string };
  indicators: PressureIndicator[];
  guidanceFa: string;
  reliable: boolean;
  price: { value: number | null; spotApplied: boolean; source: string };
  generatedAtISO: string;
  disclaimer: string;
}

export type PressureTf = "1d" | "4h" | "1h";

const TF_LABELS: Record<PressureTf, string> = { "1d": "روزانه", "4h": "۴ ساعته", "1h": "۱ ساعته" };

/* ---------- پالت ناحیه‌ها ---------- */

const ZONE_CLS: Record<string, { text: string; stroke: string; bg: string }> = {
  "heavy-buy": { text: "text-emerald-300", stroke: "#34d399", bg: "bg-emerald-500/10 border-emerald-500/40" },
  buy: { text: "text-emerald-200", stroke: "#6ee7b7", bg: "bg-emerald-500/5 border-emerald-500/25" },
  neutral: { text: "text-zinc-200", stroke: "#a1a1aa", bg: "bg-white/5 border-border/70" },
  sell: { text: "text-rose-200", stroke: "#fda4af", bg: "bg-rose-500/5 border-rose-500/25" },
  "heavy-sell": { text: "text-rose-300", stroke: "#fb7185", bg: "bg-rose-500/10 border-rose-500/40" },
};

const DIR_META: Record<string, { icon: string; cls: string; label: string }> = {
  buy: { icon: "▲", cls: "text-emerald-300", label: "خرید" },
  sell: { icon: "▼", cls: "text-rose-300", label: "فروش" },
  neutral: { icon: "●", cls: "text-zinc-400", label: "خنثی" },
};

/* ---------- گیج نیم‌دایره‌ای ---------- */

function PressureGauge({ score, zone }: { score: number; zone: string }) {
  const zc = ZONE_CLS[zone] ?? ZONE_CLS.neutral;
  /* زاویه ۱۸۰° (چپ = ۰) تا ۰° (راست = ۱۰۰) — RTL: سمت راست دماسنج = فروش */
  const angle = 180 - (Math.max(0, Math.min(100, score)) / 100) * 180;
  const rad = (angle * Math.PI) / 180;
  const cx = 100;
  const cy = 96;
  const r = 76;
  const nx = cx + r * Math.cos(rad);
  const ny = cy - r * Math.sin(rad);

  return (
    <div className="relative flex flex-none flex-col items-center" data-testid="bt-pressure-gauge">
      <svg viewBox="0 0 200 112" className="h-[104px] w-[190px]">
        <defs>
          <linearGradient id="pt-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="35%" stopColor="#f43f5e" />
            <stop offset="50%" stopColor="#a1a1aa" />
            <stop offset="65%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
        <path d="M 16 96 A 84 84 0 0 1 184 96" fill="none" stroke="url(#pt-grad)" strokeWidth="13" strokeLinecap="round" opacity="0.9" />
        {/* خط ۵۰ وسط */}
        <line x1={cx} y1={cy - 88} x2={cx} y2={cy - 74} stroke="#71717a" strokeWidth="2" />
        {/* عقربه */}
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={zc.stroke} strokeWidth="3.5" strokeLinecap="round" />
        <circle cx={cx} cy={cy} r="5.5" fill={zc.stroke} />
        <circle cx={cx} cy={cy} r="2" fill="#09090b" />
      </svg>
      <div className="absolute bottom-0 flex flex-col items-center">
        <span className={`text-xl font-black leading-none ${zc.text}`} dir="ltr" data-testid="bt-pressure-score">
          {faDigits(score)}
        </span>
        <span className="mt-0.5 text-[8px] font-bold text-muted-foreground">دماسنج ۰ تا ۱۰۰</span>
      </div>
    </div>
  );
}

/* ---------- تب دماسنج فشار ---------- */

export function ThermometerTab({
  sym,
  data,
  status,
  error,
  tf,
  onTf,
  onReload,
}: {
  sym: "xau" | "dji";
  data: PressureResponse | null;
  status: "idle" | "loading" | "done" | "error";
  error: string | null;
  tf: PressureTf;
  onTf: (t: PressureTf) => void;
  onReload: () => void;
}) {
  const chips = useMemo(() => data?.indicators ?? [], [data]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <Thermometer className="h-6 w-6 animate-pulse text-violet-300" />
        <p className="text-xs font-bold text-foreground/80">در حال سنجش فشار بازار…</p>
        <p className="text-[10px] text-muted-foreground">اجماع ۱۶ اندیکاتور و اسیلاتور روی کندل‌های {TF_LABELS[tf]}</p>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <AlertTriangle className="h-6 w-6 text-amber-400" />
        <p className="max-w-[280px] text-[11px] leading-5 text-muted-foreground">{error ?? "داده دماسنج در دسترس نیست"}</p>
        <button type="button" onClick={onReload} className="rounded-full border border-violet-500/50 bg-violet-500/15 px-3.5 py-1.5 text-xs font-extrabold text-violet-200">
          تلاش مجدد
        </button>
      </div>
    );
  }

  const zc = ZONE_CLS[data.zone] ?? ZONE_CLS.neutral;
  const priceTxt = data.price.value !== null ? faNum(data.price.value) : "—";

  return (
    <div className="flex flex-col gap-2">
      {/* انتخاب تایم‌فریم */}
      <div className="flex items-center gap-1.5" data-testid="bt-pressure-tfs">
        {(Object.keys(TF_LABELS) as PressureTf[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTf(t)}
            className={`flex-1 rounded-full border px-2 py-1 text-[10px] font-bold transition-colors ${
              tf === t ? "border-violet-500/60 bg-violet-500/20 text-violet-200" : "border-border/70 bg-card/60 text-muted-foreground"
            }`}
          >
            {TF_LABELS[t]}
          </button>
        ))}
        <button
          type="button"
          onClick={onReload}
          aria-label="بروزرسانی دماسنج"
          className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-white/15 bg-white/10"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* دماسنج اصلی */}
      <div className={`rounded-xl border p-3 ${zc.bg}`}>
        <div className="flex items-center gap-2">
          <PressureGauge score={data.score} zone={data.zone} />
          <div className="min-w-0 flex-1">
            <p className={`text-[13px] font-black ${zc.text}`} data-testid="bt-pressure-zone">
              {data.zoneFa}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-foreground/85" data-testid="bt-pressure-consensus">
              {data.consensus.sentenceFa}
            </p>
            <p className="mt-1 text-[9px] text-muted-foreground" dir="ltr">
              {data.symbol.labelFa} · {data.tfLabel}
            </p>
          </div>
        </div>
        <p className="mt-2 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5 text-[10px] leading-4 text-foreground/90" data-testid="bt-pressure-guidance">
          {data.guidanceFa}
        </p>
        {!data.reliable && (
          <p className="mt-1.5 text-[9px] font-bold leading-4 text-amber-300">
            ⚠ تعداد اندیکاتورهای قابل محاسبه کم است — این نتیجه اعتماد پایینی دارد.
          </p>
        )}
        <p className="mt-1 text-[9px] text-muted-foreground">
          قیمت لحظه‌ای: <span dir="ltr">{priceTxt}</span> {data.price.spotApplied ? "(اسپات کالیبره‌شده)" : ""} · آخرین محاسبه: {faTime(new Date(data.generatedAtISO))}
        </p>
      </div>

      {/* رأی تک‌تک اندیکاتورها — فقط نتیجه، بدون فرمول */}
      <div className="rounded-xl border border-border/70 bg-card/60 p-3">
        <p className="mb-2 text-[11px] font-extrabold text-foreground/90">رأی تک‌تک اندیکاتورها</p>
        <div className="flex flex-wrap gap-1" data-testid="bt-pressure-chips">
          {chips.map((i) => {
            const m = DIR_META[i.dir] ?? DIR_META.neutral;
            return (
              <span
                key={i.id}
                className={`inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/50 px-2 py-0.5 text-[9px] font-bold ${m.cls}`}
                title={`${i.nameFa}: ${m.label}`}
              >
                <span aria-hidden>{m.icon}</span>
                {i.nameFa}
              </span>
            );
          })}
        </div>
        <p className="mt-2 text-[9px] leading-4 text-muted-foreground">{data.disclaimer}</p>
      </div>
    </div>
  );
}
