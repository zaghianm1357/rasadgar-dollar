"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Crosshair,
  TrendingUp,
  TrendingDown,
  Hourglass,
  Minus,
} from "lucide-react";
import type {
  MarketStructureResponse,
  MSRow,
  MSTimeframe,
  MSTrend,
} from "@/lib/types";

/**
 * پیشنهاد معامله بر اساس ترکیب دو تایم‌فریم:
 *  - تایم‌فریم ساختار (مثلاً ۱ ساعته) و تایم‌فریم ورود (مثلاً ۵ دقیقه)
 *  - هر دو صعودی → پیشنهاد خرید | هر دو نزولی → پیشنهاد فروش | غیر این صورت → صبر کنید
 * تایم‌فریم ورود نمی‌تواند از تایم‌فریم ساختار بزرگ‌تر باشد.
 */

const TF_MINUTES: Record<MSTimeframe, number> = {
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "1d": 1440,
  "1wk": 10080,
  "1mo": 43200,
};

const TF_LABEL: Record<MSTimeframe, string> = {
  "5m": "۵ دقیقه",
  "15m": "۱۵ دقیقه",
  "1h": "۱ ساعته",
  "4h": "۴ ساعته",
  "1d": "روزانه",
  "1wk": "هفتگی",
  "1mo": "ماهانه",
};

/** تایم‌فریم‌های مجاز برای ساختار (همان‌های جدول) */
const STRUCTURE_TFS: MSTimeframe[] = ["15m", "1h", "4h", "1d", "1wk", "1mo"];
/** تایم‌فریم‌های مجاز برای ورود (کوچک‌تر یا مساوی ساختار اعمال می‌شود) */
const ENTRY_TFS: MSTimeframe[] = ["5m", "15m", "1h", "4h"];

type VerdictKey = "buy" | "sell" | "wait";

interface Verdict {
  key: VerdictKey;
  reason: string;
}

function getVerdict(st: MSTrend | null, en: MSTrend | null): Verdict {
  if (st === null || en === null)
    return { key: "wait", reason: "داده یکی از دو تایم‌فریم ناکافی است" };
  if (st === "bullish" && en === "bullish")
    return { key: "buy", reason: "ساختار و ورود هر دو صعودی‌اند" };
  if (st === "bearish" && en === "bearish")
    return { key: "sell", reason: "ساختار و ورود هر دو نزولی‌اند" };
  if (st === "neutral" || en === "neutral")
    return { key: "wait", reason: "یکی از دو تایم‌فریم خنثی است" };
  return { key: "wait", reason: "جهت ساختار و ورود مخالف هم است" };
}

const VERDICT_META: Record<
  VerdictKey,
  { label: string; cls: string; icon: typeof TrendingUp }
> = {
  buy: {
    label: "پیشنهاد خرید",
    icon: TrendingUp,
    cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
  },
  sell: {
    label: "پیشنهاد فروش",
    icon: TrendingDown,
    cls: "bg-rose-500/15 text-rose-400 border-rose-500/40",
  },
  wait: {
    label: "صبر کنید",
    icon: Hourglass,
    cls: "bg-amber-500/15 text-amber-400 border-amber-500/40",
  },
};

function TrendChip({ label, trend }: { label: string; trend: MSTrend | null }) {
  const cls =
    trend === "bullish"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      : trend === "bearish"
        ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
        : trend === "neutral"
          ? "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
          : "border-border bg-muted/40 text-muted-foreground";
  const Icon =
    trend === "bullish" ? TrendingUp : trend === "bearish" ? TrendingDown : Minus;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold ${cls}`}
    >
      <Icon className="h-3 w-3" />
      {label}:{" "}
      {trend === "bullish"
        ? "صعودی"
        : trend === "bearish"
          ? "نزولی"
          : trend === "neutral"
            ? "خنثی"
            : "ناکافی"}
    </span>
  );
}

function SymbolSuggestion({
  name,
  mono,
  structureRow,
  entryRow,
  structureTf,
  entryTf,
}: {
  name: string;
  mono: string;
  structureRow: MSRow | null;
  entryRow: MSRow | null;
  structureTf: MSTimeframe;
  entryTf: MSTimeframe;
}) {
  const verdict = getVerdict(
    structureRow?.trend ?? null,
    entryRow?.trend ?? null
  );
  const meta = VERDICT_META[verdict.key];
  const VerdictIcon = meta.icon;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/40 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-bold">{name}</div>
          <div dir="ltr" className="text-start font-mono text-[9px] text-muted-foreground">
            {mono}
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-extrabold ${meta.cls}`}
        >
          <VerdictIcon className="h-3.5 w-3.5" />
          {meta.label}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <TrendChip
          label={`ساختار ${TF_LABEL[structureTf]}`}
          trend={structureRow?.trend ?? null}
        />
        <TrendChip label={`ورود ${TF_LABEL[entryTf]}`} trend={entryRow?.trend ?? null} />
      </div>
      <p className="text-[9px] leading-4 text-muted-foreground">{verdict.reason}</p>
    </div>
  );
}

export function TradeSuggestion({ data }: { data: MarketStructureResponse }) {
  const [structureTf, setStructureTf] = useState<MSTimeframe>("1h");
  const [entryTf, setEntryTf] = useState<MSTimeframe>("5m");

  // تایم‌فریم ورود نباید از ساختار بزرگ‌تر باشد
  const validEntries = useMemo(
    () => ENTRY_TFS.filter((tf) => TF_MINUTES[tf] <= TF_MINUTES[structureTf]),
    [structureTf]
  );
  const effectiveEntry = validEntries.includes(entryTf)
    ? entryTf
    : validEntries[validEntries.length - 1];

  const onStructureChange = (v: string) => {
    const st = v as MSTimeframe;
    setStructureTf(st);
    if (!validEntries.includes(entryTf)) {
      // ورود نامعتبر → بزرگ‌ترین تایم‌فریم ورود مجاز
      const ok = ENTRY_TFS.filter((tf) => TF_MINUTES[tf] <= TF_MINUTES[st]);
      setEntryTf(ok[ok.length - 1]);
    }
  };

  const getRow = (sym: "xau" | "dji", tf: MSTimeframe): MSRow | null =>
    data[sym]?.rows.find((r) => r.tf === tf) ?? null;

  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-primary/25 bg-primary/5 p-3">
      {/* سربرگ */}
      <div className="flex flex-wrap items-center gap-2">
        <Crosshair className="h-4 w-4 shrink-0 text-primary" />
        <span className="text-xs font-extrabold">پیشنهاد معامله</span>
        <span className="text-[9px] text-muted-foreground">
          ترکیب تایم‌فریم ساختار و تایم‌فریم ورود
        </span>
      </div>

      {/* انتخاب تایم‌فریم‌ها */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-muted-foreground">
            تایم‌فریم ساختار
          </span>
          <Select value={structureTf} onValueChange={onStructureChange}>
            <SelectTrigger className="h-8 w-full text-xs" aria-label="تایم‌فریم ساختار">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STRUCTURE_TFS.map((tf) => (
                <SelectItem key={tf} value={tf} className="text-xs">
                  {TF_LABEL[tf]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] font-bold text-muted-foreground">
            تایم‌فریم ورود
          </span>
          <Select
            value={effectiveEntry}
            onValueChange={(v) => setEntryTf(v as MSTimeframe)}
          >
            <SelectTrigger className="h-8 w-full text-xs" aria-label="تایم‌فریم ورود">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {validEntries.map((tf) => (
                <SelectItem key={tf} value={tf} className="text-xs">
                  {TF_LABEL[tf]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* منطق پیشنهاد */}
      <p className="text-[9px] leading-4 text-muted-foreground/80">
        هر دو هم‌جهت صعودی ← خرید | هر دو هم‌جهت نزولی ← فروش | مخالف یا خنثی ←
        صبر کنید
      </p>

      {/* کارت هر نماد */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <SymbolSuggestion
          name="طلا"
          mono="XAUUSD"
          structureRow={getRow("xau", structureTf)}
          entryRow={getRow("xau", effectiveEntry)}
          structureTf={structureTf}
          entryTf={effectiveEntry}
        />
        <SymbolSuggestion
          name="داوجونز"
          mono="DJI"
          structureRow={getRow("dji", structureTf)}
          entryRow={getRow("dji", effectiveEntry)}
          structureTf={structureTf}
          entryTf={effectiveEntry}
        />
      </div>
    </div>
  );
}
