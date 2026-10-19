"use client";

import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  MoveHorizontal,
  Minus,
  CheckCircle2,
  Hourglass,
  Languages,
  Flame,
  SignalMedium,
  SignalLow,
  CalendarOff,
  Table2,
} from "lucide-react";
import type { NewsEvent, Direction, AssetOutlook } from "@/lib/types";
import { faTime, faDigits } from "@/lib/tehran";
import { currencyFa } from "@/lib/currency-fa";

const DIRECTION_META: Record<
  Direction,
  { label: string; icon: typeof TrendingUp; cls: string }
> = {
  bullish: {
    label: "افزایشی — تقویت دلار",
    icon: TrendingUp,
    cls: "bg-emerald-500/12 text-emerald-400 border-emerald-500/30",
  },
  bearish: {
    label: "کاهشی — تضعیف دلار",
    icon: TrendingDown,
    cls: "bg-rose-500/12 text-rose-400 border-rose-500/30",
  },
  mixed: {
    label: "تأثیر دووجهی",
    icon: MoveHorizontal,
    cls: "bg-amber-500/12 text-amber-400 border-amber-500/30",
  },
  neutral: {
    label: "بدون تأثیر مستقیم",
    icon: Minus,
    cls: "bg-zinc-500/12 text-zinc-400 border-zinc-500/30",
  },
};

const IMPACT_META: Record<
  string,
  { label: string; cls: string; icon: typeof Flame }
> = {
  High: {
    label: "اهمیت بالا",
    cls: "bg-red-500/12 text-red-400 border-red-500/30",
    icon: Flame,
  },
  Medium: {
    label: "اهمیت متوسط",
    cls: "bg-amber-500/12 text-amber-400 border-amber-500/30",
    icon: SignalMedium,
  },
  Low: {
    label: "اهمیت کم",
    cls: "bg-zinc-500/12 text-zinc-400 border-zinc-500/30",
    icon: SignalLow,
  },
  Holiday: {
    label: "تعطیلات",
    cls: "bg-teal-500/12 text-teal-400 border-teal-500/30",
    icon: CalendarOff,
  },
};

/* ---------- چیپ جهت تأثیر هر نماد در جدول ---------- */
function DirChip({ value }: { value: Direction | null }) {
  if (value === "bullish")
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
        <TrendingUp className="h-3 w-3" />
        افزایش
      </span>
    );
  if (value === "bearish")
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/12 px-1.5 py-0.5 text-[10px] font-bold text-rose-400">
        <TrendingDown className="h-3 w-3" />
        کاهش
      </span>
    );
  if (value === "mixed")
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
        <MoveHorizontal className="h-3 w-3" />
        دووجهی
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-zinc-500/30 bg-zinc-500/12 px-1.5 py-0.5 text-[10px] font-bold text-zinc-400">
      <Minus className="h-3 w-3" />
      خنثی
    </span>
  );
}

/* ---------- ردیف احتمال برآوردی بر اساس پیش‌بینی ---------- */
function ProbLine({ label, up, out }: { label: string; up: number | null; out: AssetOutlook }) {
  if (up === null) return null;
  const down = Math.round((1 - up) * 100);
  const upPct = Math.round(up * 100);
  const upWins = upPct >= down;
  return (
    <p className="flex flex-wrap items-center gap-1 text-[10px] leading-4">
      <span className="text-muted-foreground">{label}:</span>
      {upWins ? (
        <>
          <b className="text-emerald-400">افزایش {faDigits(upPct)}٪</b>
          <span className="text-muted-foreground/70">/ کاهش {faDigits(down)}٪</span>
        </>
      ) : (
        <>
          <b className="text-rose-400">کاهش {faDigits(down)}٪</b>
          <span className="text-muted-foreground/70">/ افزایش {faDigits(upPct)}٪</span>
        </>
      )}
    </p>
  );
}

const CMP_TEXT: Record<string, string> = {
  above: "پیش‌بینی بالاتر از مقدار قبلی است → سناریوی «داده قوی‌تر» محتمل‌تر",
  below: "پیش‌بینی پایین‌تر از مقدار قبلی است → سناریوی «داده ضعیف‌تر» محتمل‌تر",
  equal: "پیش‌بینی برابر مقدار قبلی است → دو سناریو هم‌وزن",
};

/* ---------- جدول کوچک تأثیر بر نمادها ---------- */
function AssetImpactTable({ event }: { event: NewsEvent }) {
  const out = event.outlook;
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-background/40">
      <div className="flex items-center gap-1.5 border-b border-border/50 bg-muted/40 px-2.5 py-1.5">
        <Table2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-[11px] font-bold text-foreground/90">تأثیر بر نمادها</span>
      </div>
      <table className="w-full border-collapse text-center">
        <thead>
          <tr className="text-[9px] text-muted-foreground">
            <th className="px-2 py-1.5 text-start font-medium">نماد</th>
            <th className="px-1 py-1.5 font-medium">خبر بالاتر از انتظار</th>
            <th className="px-1 py-1.5 font-medium">خبر پایین‌تر از انتظار</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border/50">
            <td className="px-2 py-2 text-start">
              <div className="text-[11px] font-bold">طلا</div>
              <div dir="ltr" className="text-start font-mono text-[9px] text-muted-foreground">
                XAUUSD
              </div>
            </td>
            <td className="px-1 py-2">
              <DirChip value={event.xauAbove} />
            </td>
            <td className="px-1 py-2">
              <DirChip value={event.xauBelow} />
            </td>
          </tr>
          <tr className="border-t border-border/50">
            <td className="px-2 py-2 text-start">
              <div className="text-[11px] font-bold">داوجونز</div>
              <div dir="ltr" className="text-start font-mono text-[9px] text-muted-foreground">
                DJ30
              </div>
            </td>
            <td className="px-1 py-2">
              <DirChip value={event.djiAbove} />
            </td>
            <td className="px-1 py-2">
              <DirChip value={event.djiBelow} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* احتمال برآوردی بر اساس مقدار پیش‌بینی */}
      <div className="border-t border-border/50 bg-muted/20 px-2.5 py-2">
        {out && out.xauUp !== null && out.djiUp !== null ? (
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-muted-foreground">
              احتمال برآوردی (بر اساس پیش‌بینی)
            </span>
            <ProbLine label="طلا" up={out.xauUp} out={out} />
            <ProbLine label="داوجونز" up={out.djiUp} out={out} />
            {out.cmp && (
              <span className="text-[9px] leading-4 text-muted-foreground/80">
                ⚖️ {CMP_TEXT[out.cmp]} — برآورد تقریبی، نه سیگنال معاملاتی.
              </span>
            )}
          </div>
        ) : (
          <span className="text-[9px] text-muted-foreground/80">
            برای این خبر پیش‌بینی عددی ثبت نشده؛ احتمال‌دهی مقدور نیست.
          </span>
        )}
      </div>
    </div>
  );
}

function ValueChip({ label, value, highlight }: { label: string; value: string | null; highlight?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center rounded-lg border px-3 py-1.5 min-w-[72px] ${
        highlight
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-border bg-muted/40"
      }`}
    >
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span
        dir="ltr"
        className={`text-sm font-semibold tabular-nums ${highlight ? "text-emerald-400" : "text-foreground"}`}
      >
        {faDigits(value)}
      </span>
    </div>
  );
}

function EventCardBase({ event, now }: { event: NewsEvent; now: number }) {
  const dirMeta = event.direction ? DIRECTION_META[event.direction] : null;
  const impactMeta = IMPACT_META[event.impact] ?? IMPACT_META.Low;
  const ImpactIcon = impactMeta.icon;

  const eventTime = event.dateISO ? new Date(event.dateISO).getTime() : null;
  const isReleased = eventTime !== null && eventTime <= now;
  const isHighOrMedium = event.impact === "High" || event.impact === "Medium";

  return (
    <Card className="animate-fade-up border-border/80 bg-card/90 shadow-sm hover:border-ring/40 transition-colors">
      <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
        {/* ردیف بالا: زمان + اهمیت + وضعیت + جهت دلار */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            dir="ltr"
            className="inline-flex items-center rounded-md bg-muted/60 px-2.5 py-1 text-sm font-bold tabular-nums text-foreground"
          >
            {event.dateISO ? faTime(new Date(event.dateISO)) : "هم‌روز"}
          </span>

          <Badge variant="outline" className={`gap-1 ${impactMeta.cls}`}>
            <ImpactIcon className="h-3 w-3" />
            {impactMeta.label}
          </Badge>

          <Badge variant="outline" className="gap-1 border-amber-500/30 bg-amber-500/10 text-amber-300">
            {currencyFa(event.country)}
          </Badge>

          {isReleased ? (
            <Badge variant="outline" className="gap-1 bg-muted/40 text-muted-foreground border-border">
              <CheckCircle2 className="h-3 w-3" />
              منتشر شد
            </Badge>
          ) : (
            eventTime !== null && (
              <Badge variant="outline" className="gap-1 bg-muted/40 text-muted-foreground border-border">
                <Hourglass className="h-3 w-3" />
                در انتظار انتشار
              </Badge>
            )
          )}

          {dirMeta && (
            <Badge variant="outline" className={`gap-1 ms-auto ${dirMeta.cls}`}>
              <dirMeta.icon className="h-3.5 w-3.5" />
              {dirMeta.label}
            </Badge>
          )}
        </div>

        {/* بدنه دو ستونه: محتوای خبر روبروی جدول نمادها */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
          {/* ستون اصلی */}
          <div className="flex flex-col gap-2 min-w-0">
            {event.titleFa ? (
              <h3 className="text-base sm:text-lg font-bold leading-7 text-foreground">
                {event.titleFa}
              </h3>
            ) : (
              <h3 className="text-base sm:text-lg font-bold leading-7 text-muted-foreground flex items-center gap-2">
                <Languages className="h-4 w-4 animate-soft-pulse" />
                در نوبت ترجمه هوشمند...
              </h3>
            )}
            <p dir="ltr" className="text-left text-xs text-muted-foreground/80 font-mono">
              {event.title}
            </p>

            {event.explanationFa && (
              <div className="rounded-lg border border-border/70 bg-background/50 p-3">
                <p className="text-[13px] leading-6 text-foreground/90">{event.explanationFa}</p>
              </div>
            )}

            {(event.previous || event.forecast || event.actual) && (
              <div className="flex flex-wrap gap-2">
                <ValueChip label="قبلی" value={event.previous} />
                <ValueChip label="پیش‌بینی" value={event.forecast} />
                <ValueChip label="واقعی" value={event.actual} highlight={!!event.actual} />
              </div>
            )}
          </div>

          {/* جدول کوچک تأثیر بر XAUUSD و داو جونز — روبروی خبر */}
          <div className="lg:border-s lg:border-border/60 lg:ps-4">
            <AssetImpactTable event={event} />
          </div>
        </div>

        {/* یادآوری برای خبرهای مهم منتشرنشده */}
        {!isReleased && isHighOrMedium && eventTime !== null && eventTime - now < 3600_000 && (
          <p className="text-[11px] text-amber-400/90">
            ⚠️ این خبر مهم کمتر از یک ساعت دیگر منتشر می‌شود؛ احتمال نوسان شدید در دلار، طلا و داو وجود دارد.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export const EventCard = memo(EventCardBase);
