import { useMemo, useState } from "react";
import { cn } from "@/utils/cn";
import { useMarket } from "@/lib/MarketContext";
import {
  IMPACT_LABEL,
  NEWS_EVENTS,
  groupEventsByDay,
  nextImportantEvent,
  type Impact,
  type NewsEvent,
} from "@/lib/market";
import { countdown, fa, fmtShortDate, fmtTime, pad2 } from "@/lib/format";
import { Card, Container, Reveal, SectionHeading } from "./ui";

const IMPACT_STYLE: Record<Impact, string> = {
  high: "bg-bear-500/14 text-bear-400 border-bear-500/30",
  medium: "bg-gold-400/12 text-gold-300 border-gold-400/25",
  low: "bg-white/6 text-slate-400 border-white/12",
};

const IMPACT_DOTS: Record<Impact, string> = {
  high: "bg-bear-500",
  medium: "bg-gold-400",
  low: "bg-slate-500",
};

export default function Calendar() {
  const { now } = useMarket();
  const [dayIdx, setDayIdx] = useState(0);
  const [impacts, setImpacts] = useState<Impact[]>(["high", "medium", "low"]);

  const days = useMemo(() => groupEventsByDay(NEWS_EVENTS), []);
  const activeDay = days[Math.min(dayIdx, days.length - 1)];
  const next = nextImportantEvent(now);
  const cd = next ? countdown(next.ts, now) : null;

  const rows = activeDay.items
    .filter((e) => impacts.includes(e.impact))
    .sort((a, b) => a.ts - b.ts);

  const toggleImpact = (imp: Impact) =>
    setImpacts((prev) => (prev.includes(imp) ? prev.filter((p) => p !== imp) : [...prev, imp]));

  return (
    <section id="calendar" className="py-20">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="تقویم اقتصادی"
            title={<>اخبار اقتصادی به فارسی، دقیقه‌ای و دسته‌بندی‌شده</>}
            desc="تمام رویدادهای پراثر بازار از فید ForexFactory با ترجمه فارسی، ساعت تهران و سطح اهمیت. پیش از هر خبر، شمارش معکوس فعال است."
          />
        </Reveal>

        {next && cd && (
          <Reveal delay={60}>
            <Card glow className="mt-9 overflow-hidden">
              <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-full border border-bear-500/30 bg-bear-500/12 px-2.5 py-1 text-[11px] font-bold text-bear-400">
                      <span className={cn("h-1.5 w-1.5 animate-pulse rounded-full", IMPACT_DOTS.high)} />
                      خبر پراثر پیش‌رو
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                      {next.flag} {next.currency}
                    </span>
                    <span className="num rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                      ساعت {fmtTime(next.ts)}
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-extrabold text-white sm:text-2xl">{next.title}</h3>

                  <div className="mt-4 flex flex-wrap gap-3 text-[12px]">
                    <Info label="پیش‌بینی" value={next.forecast ?? "—"} />
                    <Info label="داده قبلی" value={next.previous ?? "—"} />
                    <Info label="ارزش دارایی‌های متاثر" value="طلا، دلار، شاخص‌ها" />
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-ink-900/70 p-5 text-center">
                  <p className="text-[11.5px] text-slate-400">شمارش معکوس تا انتشار</p>
                  <div dir="ltr" className="num mt-3 flex items-center justify-center gap-2">
                    {cd.d > 0 && <Unit value={pad2(cd.d)} label="روز" />}
                    <Unit value={pad2(cd.h)} label="ساعت" />
                    <span className="text-lg text-slate-600">:</span>
                    <Unit value={pad2(cd.m)} label="دقیقه" />
                    <span className="text-lg text-slate-600">:</span>
                    <Unit value={pad2(cd.s)} label="ثانیه" />
                  </div>
                  <button className="mt-4 w-full rounded-xl bg-gradient-to-l from-gold-500 to-gold-300 px-4 py-2.5 text-[12.5px] font-bold text-ink-950 transition hover:brightness-110">
                    فعال‌سازی هشدار
                  </button>
                </div>
              </div>
            </Card>
          </Reveal>
        )}

        <Reveal delay={110}>
          <Card className="mt-5 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 p-4">
              <div className="flex items-center gap-1.5">
                {days.map((d, i) => (
                  <button
                    key={d.key}
                    onClick={() => setDayIdx(i)}
                    className={cn(
                      "rounded-xl px-3 py-2 text-[12px] font-semibold transition",
                      i === dayIdx ? "bg-gold-400/15 text-gold-200 ring-1 ring-gold-400/30" : "text-slate-400 hover:bg-white/5",
                    )}
                  >
                    {i === 0 ? "امروز · " : i === 1 ? "فردا · " : ""}
                    <span className="num">{fmtShortDate(d.ts)}</span>
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                {(["high", "medium", "low"] as Impact[]).map((imp) => (
                  <button
                    key={imp}
                    onClick={() => toggleImpact(imp)}
                    className={cn(
                      "rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition",
                      impacts.includes(imp) ? IMPACT_STYLE[imp] : "border-white/8 bg-transparent text-slate-500",
                    )}
                  >
                    اهمیت {IMPACT_LABEL[imp]}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-right">
                <thead>
                  <tr className="border-b border-white/8 text-[11px] text-slate-400">
                    <th className="px-4 py-3 font-medium">ساعت</th>
                    <th className="px-4 py-3 font-medium">ارز</th>
                    <th className="px-4 py-3 font-medium">اهمیت</th>
                    <th className="px-4 py-3 font-medium">رویداد اقتصادی</th>
                    <th className="px-4 py-3 font-medium">واقعی</th>
                    <th className="px-4 py-3 font-medium">پیش‌بینی</th>
                    <th className="px-4 py-3 font-medium">قبلی</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <Row key={e.id} e={e} now={now} />
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-[13px] text-slate-500">
                        رویدادی با این فیلترها در این روز وجود ندارد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 px-4 py-3 text-[11px] text-slate-500">
              <span>منبع داده: فید اقتصادی ForexFactory · تمام ساعات بر اساس وقت تهران (GMT+3:30)</span>
              <span className="num">
                {fa(rows.length)} رویداد در {fmtShortDate(activeDay.ts)}
              </span>
            </div>
          </Card>
        </Reveal>
      </Container>
    </section>
  );
}

function Row({ e, now }: { e: NewsEvent; now: number }) {
  const past = e.ts < now;
  return (
    <tr className={cn("border-b border-white/5 transition hover:bg-white/3", past && "opacity-55")}>
      <td className="num px-4 py-3.5 text-[12.5px] font-bold text-slate-200">{fmtTime(e.ts)}</td>
      <td className="px-4 py-3.5 text-[12.5px] whitespace-nowrap text-slate-300">
        {e.flag} <span dir="ltr" className="num">{e.currency}</span>
      </td>
      <td className="px-4 py-3.5">
        <span className={cn("rounded-lg border px-2 py-0.5 text-[10.5px] font-bold", IMPACT_STYLE[e.impact])}>
          {IMPACT_LABEL[e.impact]}
        </span>
      </td>
      <td className="px-4 py-3.5 text-[13px] font-medium text-slate-100">
        {e.title}
        {!past && e.impact === "high" && (
          <span className="mr-2 rounded-md bg-bear-500/12 px-1.5 py-0.5 text-[9.5px] font-bold text-bear-400">
            در انتظار
          </span>
        )}
      </td>
      <td className="num px-4 py-3.5 text-[12.5px] font-bold text-gold-200">{e.actual ?? "—"}</td>
      <td className="num px-4 py-3.5 text-[12.5px] text-slate-400">{e.forecast ?? "—"}</td>
      <td className="num px-4 py-3.5 text-[12.5px] text-slate-500">{e.previous ?? "—"}</td>
    </tr>
  );
}

function Unit({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-[52px] rounded-xl border border-white/10 bg-white/5 px-2 py-2">
      <p className="num text-xl font-extrabold text-white">{value}</p>
      <p className="mt-0.5 text-[9.5px] text-slate-500">{label}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-ink-900/60 px-3 py-2">
      <p className="text-[10.5px] text-slate-500">{label}</p>
      <p className="num mt-0.5 text-[12.5px] font-bold text-slate-200">{value}</p>
    </div>
  );
}
