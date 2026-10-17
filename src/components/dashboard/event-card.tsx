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
} from "lucide-react";
import type { NewsEvent, Direction } from "@/lib/types";
import { faTime, faDigits } from "@/lib/tehran";

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
        {/* ردیف بالا: زمان + اهمیت + وضعیت */}
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

        {/* عنوان فارسی + انگلیسی */}
        <div className="flex flex-col gap-1">
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
        </div>

        {/* تحلیل تأثیر بر دلار */}
        {event.explanationFa && (
          <div className="rounded-lg border border-border/70 bg-background/50 p-3">
            <p className="text-[13px] leading-6 text-foreground/90">{event.explanationFa}</p>
          </div>
        )}

        {/* مقادیر */}
        {(event.previous || event.forecast || event.actual) && (
          <div className="flex flex-wrap gap-2">
            <ValueChip label="قبلی" value={event.previous} />
            <ValueChip label="پیش‌بینی" value={event.forecast} />
            <ValueChip label="واقعی" value={event.actual} highlight={!!event.actual} />
          </div>
        )}

        {/* یادآوری برای خبرهای مهم منتشرنشده */}
        {!isReleased && isHighOrMedium && eventTime !== null && eventTime - now < 3600_000 && (
          <p className="text-[11px] text-amber-400/90">
            ⚠️ این خبر مهم کمتر از یک ساعت دیگر منتشر می‌شود؛ احتمال نوسان شدید دلار وجود دارد.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export const EventCard = memo(EventCardBase);
