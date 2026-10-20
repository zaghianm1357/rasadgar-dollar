"use client";

/* بخش‌های اصلی: هیرو + بازار زنده + دماسنج فشار — همه با دادهٔ واقعی ابزار */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BiasChip, Container, CountBox, Delta, LiveDot, SectionHead, Skeleton, StrengthBar, Unavailable } from "./ui";
import {
  BIAS_LABEL,
  countdownParts,
  fa,
  fmtClock,
  fmtEventTime,
  fmtPrice,
  nextHighImpact,
  type MarketStructure,
  type NewsEvent,
  type Pressure,
  type PressureTf,
  type StructureRow,
} from "./site-data";

/* ---------- هیرو ---------- */

const STATS = [
  { value: "۶", label: "تایم‌فریم پایش هم‌زمان ساختار" },
  { value: "۱۸", label: "اندیکاتور دماسنج فشار" },
  { value: "۲۵۰+", label: "رویداد اقتصادی در ماه" },
  { value: "۷", label: "منبع تلفیق‌شده در نقشه مسیر" },
];

export function Hero({
  ms,
  events,
  onOpenTool,
}: {
  ms: MarketStructure | null;
  events: NewsEvent[] | null;
  onOpenTool: () => void;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const t0 = setTimeout(() => setNow(new Date()), 0);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);

  const gold = ms?.xau;
  const next = nextHighImpact(events, now?.getTime());
  const cd = next && now ? countdownParts(next.dateISO, now.getTime()) : null;
  const todayKey = now ? new Date().toDateString() : "";
  const todayEvents = (events || []).filter((e) => new Date(e.dateISO).toDateString() === todayKey);
  const todayHigh = todayEvents.filter((e) => e.impact === "High").length;

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-bt-ink-950/70 via-bt-ink-950/85 to-bt-ink-950" />
        <div className="bt-grid-bg absolute inset-0 opacity-60" />
        <div className="absolute -top-40 right-1/4 h-96 w-96 rounded-full bg-bt-gold-500/12 blur-[120px]" />
        <div className="absolute bottom-0 left-1/5 h-72 w-72 rounded-full bg-bt-bull-500/8 blur-[120px]" />
      </div>

      <Container className="relative grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div className="bt-animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] text-slate-300">
            <LiveDot />
            قیمت کالیبره‌شده با اسپات · تقویم ForexFactory · رأی تریدینگ‌ویو
          </div>

          <h1 className="mt-6 text-[2.1rem] font-extrabold leading-[1.25] text-white sm:text-5xl sm:leading-[1.2]">
            بازار را <span className="bt-gold-text">با چشم باز</span> معامله کنید
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-8 text-slate-300">
            بیگ تردر قیمت لحظه‌ای طلا و داوجونز را با ساختار بازار در شش تایم‌فریم رصد می‌کند، فشار خرید و فروش را با
            دماسنج تریدینگ‌ویو می‌سنجد، خبرهای پراثر را شمارش معکوس می‌زند و هر روز یک بریفینگ تحلیلی و نقشهٔ مسیر
            به شما می‌دهد.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenTool}
              className="rounded-2xl bg-gradient-to-l from-bt-gold-500 to-bt-gold-300 px-6 py-3.5 text-[14px] font-bold text-bt-ink-950 shadow-[0_18px_40px_-16px] shadow-bt-gold-500/60 transition hover:brightness-110"
            >
              ورود به داشبورد زنده
            </button>
            <a
              href="#calendar"
              className="rounded-2xl border border-white/14 bg-white/5 px-6 py-3.5 text-[14px] font-semibold text-slate-100 transition hover:border-bt-gold-400/40 hover:text-bt-gold-200"
            >
              تقویم اقتصادی امروز
            </a>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="border-r border-white/10 pr-4">
                <p className="bt-num text-xl font-extrabold text-white">{s.value}</p>
                <p className="mt-1 text-[11.5px] leading-5 text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative bt-animate-fade-up [animation-delay:160ms]">
          <div className="absolute -inset-6 rounded-[42px] bg-bt-gold-500/8 blur-3xl" />
          <div className="bt-glass relative rounded-[32px] p-5 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-slate-400">طلا — XAUUSD</p>
                <div className="mt-1 flex items-end gap-3">
                  {gold ? (
                    <span className="bt-num text-4xl font-extrabold text-white">{fmtPrice(gold.price, 2)}</span>
                  ) : (
                    <Skeleton className="h-10 w-40" />
                  )}
                  <span className="text-[11px] text-slate-500">دلار</span>
                </div>
              </div>
              <div className="text-left">
                <Delta value={gold?.changePct} />
                <p className="num mt-2 text-[11px] text-slate-500">
                  بستهٔ پیشین: {fmtPrice(gold?.prevClose, 2)}
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-bt-ink-900/60 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-400">ساختار بازار طلا — شش تایم‌فریم</p>
                <p className="text-[10px] text-slate-600">بروزرسانی خودکار</p>
              </div>
              {gold ? (
                <div className="mt-2.5 space-y-2">
                  {gold.rows.slice(0, 6).map((r) => (
                    <div key={r.tf} className="grid grid-cols-[52px_74px_1fr] items-center gap-x-2.5">
                      <span className="text-[10.5px] text-slate-500">{TF_FA[r.tf] || r.tf}</span>
                      <BiasChip bias={r.trend} />
                      <StrengthBar bias={r.trend} strength={r.strength} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2.5 space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-5 w-full" />
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/8 bg-bt-ink-900/60 p-3">
                <p className="text-[11px] text-slate-400">داوجونز — DJI</p>
                {ms?.dji ? (
                  <>
                    <p className="bt-num mt-1 text-[18px] font-bold text-white">{fmtPrice(ms.dji.price, 2)}</p>
                    <div className="mt-1">
                      <Delta value={ms.dji.changePct} />
                    </div>
                  </>
                ) : (
                  <Skeleton className="mt-1 h-9 w-24" />
                )}
              </div>
              <div className="rounded-2xl border border-white/8 bg-bt-ink-900/60 p-3">
                <p className="text-[11px] text-slate-400">تا خبر مهم بعدی</p>
                {cd ? (
                  <>
                    <div dir="ltr" className="mt-1.5 flex items-center gap-1">
                      <CountBox v={cd.h} />
                      <span className="text-slate-500">:</span>
                      <CountBox v={cd.m} />
                      <span className="text-slate-500">:</span>
                      <CountBox v={cd.s} />
                    </div>
                    <p className="mt-2 truncate text-[10.5px] text-bt-bear-400">{next?.titleFa || next?.title}</p>
                  </>
                ) : (
                  events ? (
                    <p className="mt-2 text-[12px] text-slate-500">خبر مهمی در صف نیست</p>
                  ) : (
                    <Skeleton className="mt-2 h-6 w-28" />
                  )
                )}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/8 bg-bt-ink-900/60 px-3 py-2.5">
              <span className="text-[11px] text-slate-400">اخبار امروز</span>
              <span className="bt-num text-[11px] text-slate-300">
                {events
                  ? `${fa(todayEvents.length)} رویداد · ${fa(todayHigh)} خبر مهم${now ? ` · ساعت ${fmtClock(now)}` : ""}`
                  : "—"}
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

const TF_FA: Record<string, string> = {
  "5m": "۵ دقیقه",
  "15m": "۱۵ دقیقه",
  "30m": "۳۰ دقیقه",
  "1h": "۱ ساعت",
  "4h": "۴ ساعت",
  "1d": "روزانه",
  "1w": "هفتگی",
  "1M": "ماهانه",
};

/* ---------- بازار زنده ---------- */

export function Markets({ ms, changes }: { ms: MarketStructure | null; changes: MarketStructure["changes"] }) {
  const cards = [
    { key: "xau", fa_: "طلا (انس)", sym: "XAUUSD", s: ms?.xau },
    { key: "dji", fa_: "داوجونز", sym: "DJI", s: ms?.dji },
  ];
  return (
    <section id="markets" className="scroll-mt-32 py-16">
      <Container>
        <SectionHead
          kicker="بازار زنده"
          title={<>قیمت کالیبره‌شده، همان عددی که در ابزار می‌بینید</>}
          desc="قیمت طلا با اسپات بازار کالیبره می‌شود تا در همهٔ صفحات ابزار یک عدد واحد ببینید؛ ساختار روند از ترکیب میانگین‌های متحرک و سقف/کف‌های سوئینگ در شش تایم‌فریم ساخته می‌شود."
        />
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map((c) => (
            <div key={c.key} className="bt-glass rounded-3xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[13px] font-bold text-slate-200">{c.fa_}</p>
                  <p dir="ltr" className="mt-0.5 text-[10.5px] tracking-wider text-slate-500">
                    {c.sym}
                  </p>
                </div>
                <Delta value={c.s?.changePct} />
              </div>
              <div className="mt-3 flex items-end gap-2">
                {c.s ? (
                  <>
                    <span className="bt-num text-3xl font-extrabold text-white">{fmtPrice(c.s.price, 2)}</span>
                    <span className="pb-1 text-[10.5px] text-slate-500">دلار</span>
                  </>
                ) : (
                  <Skeleton className="h-9 w-36" />
                )}
              </div>
              <div className="mt-4 space-y-2 border-t border-white/6 pt-3">
                {(c.s?.rows || []).slice(0, 6).map((r: StructureRow) => (
                  <div key={r.tf} className="grid grid-cols-[64px_70px_1fr] items-center gap-x-2.5">
                    <span className="text-[10.5px] text-slate-500">{TF_FA[r.tf] || r.tf}</span>
                    <BiasChip bias={r.trend} />
                    <StrengthBar bias={r.trend} strength={r.strength} />
                  </div>
                ))}
                {!c.s && <Unavailable label="ساختار بازار در دسترس نیست" />}
              </div>
            </div>
          ))}
        </div>

        {changes && changes.length > 0 ? (
          <div className="mt-4 rounded-3xl border border-white/8 bg-bt-ink-900/60 p-4">
            <p className="text-[12px] font-bold text-slate-200">آخرین تغییر جهت‌ها</p>
            <div className="mt-3 flex gap-2 overflow-x-auto bt-no-scrollbar pb-1">
              {changes.slice(0, 8).map((ch, i) => (
                <div key={i} className="shrink-0 rounded-2xl border border-white/8 bg-white/4 px-3 py-2 text-[11px]">
                  <span className="text-slate-300">{ch.symbol === "xau" ? "طلا" : ch.symbol === "dji" ? "داو" : ch.symbol}</span>
                  <span className="mx-1.5 text-slate-600">·</span>
                  <span className="text-slate-500">{TF_FA[ch.tf] || ch.tf}</span>
                  <span className="mx-1.5 text-slate-600">·</span>
                  <span className={cn("font-bold", ch.to === "bullish" ? "text-bt-bull-400" : ch.to === "bearish" ? "text-bt-bear-400" : "text-slate-400")}>
                    {BIAS_LABEL[ch.to]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Container>
    </section>
  );
}

/* ---------- دماسنج فشار ---------- */

export function Thermometer({
  pressure,
  tf,
  setTf,
}: {
  pressure: { data: Pressure | null; error: boolean; loading: boolean };
  tf: PressureTf;
  setTf: (t: PressureTf) => void;
}) {
  const p = pressure.data;
  const zoneColor =
    p?.zone === "buy"
      ? { stroke: "#34d99a", text: "text-bt-bull-400", bg: "bg-bt-bull-500/10 border-bt-bull-500/30" }
      : p?.zone === "sell"
        ? { stroke: "#ff7076", text: "text-bt-bear-400", bg: "bg-bt-bear-500/10 border-bt-bear-500/30" }
        : { stroke: "#94a3b8", text: "text-slate-300", bg: "bg-white/5 border-white/12" };

  const TFS: { id: PressureTf; label: string }[] = [
    { id: "1d", label: "روزانه" },
    { id: "4h", label: "۴ ساعت" },
    { id: "1h", label: "۱ ساعت" },
  ];

  // قوس نیم‌دایره گیج
  const score = p?.score ?? 0;
  const angle = Math.PI * (1 - score / 100);
  const cx = 130;
  const cy = 120;
  const r = 92;
  const nx = cx + r * Math.cos(angle);
  const ny = cy - r * Math.sin(angle);
  const large = score > 50 ? 0 : 0;

  return (
    <section id="thermometer" className="scroll-mt-32 border-y border-white/6 bg-bt-ink-900/40 py-16">
      <Container>
        <SectionHead
          kicker="دماسنج فشار"
          title={<>فشار خرید و فروش بازار — فقط نتیجه، بدون فرمول</>}
          desc="دماسنج، رأی فنی تریدینگ‌ویو (نوسانگرها + میانگین‌های متحرک) را در سه تایم‌فریم به یک عدد ۰ تا ۱۰۰ تبدیل می‌کند؛ در نبود تریدینگ‌ویو، اجماع ۱۶ اندیکاتور محلی روی کندل‌های واقعی جایگزین می‌شود."
        />
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bt-glass rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-slate-400">
                XAUUSD · {p ? p.tfLabel : "—"}
              </p>
              <div className="flex gap-1 rounded-xl border border-white/10 bg-white/4 p-1">
                {TFS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTf(t.id)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-bold transition",
                      tf === t.id ? "bg-bt-gold-400/15 text-bt-gold-300" : "text-slate-400 hover:text-slate-200",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 flex justify-center">
              {p ? (
                <svg viewBox="0 0 260 140" className="w-full max-w-[300px]" role="img" aria-label={`دماسنج فشار: ${p.zoneFa} — امتیاز ${score}`}>
                  <defs>
                    <linearGradient id="btGauge" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#ff7076" />
                      <stop offset="50%" stopColor="#94a3b8" />
                      <stop offset="100%" stopColor="#34d99a" />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
                    fill="none"
                    stroke="url(#btGauge)"
                    strokeWidth="14"
                    strokeLinecap="round"
                    opacity="0.9"
                  />
                  <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#e9edf5" strokeWidth="3" strokeLinecap="round" />
                  <circle cx={cx} cy={cy} r="6" fill="#e9edf5" />
                  <text x={cx - r} y={cy + 22} textAnchor="middle" className="fill-bt-bear-400" fontSize="10">
                    فروش
                  </text>
                  <text x={cx + r} y={cy + 22} textAnchor="middle" className="fill-bt-bull-400" fontSize="10">
                    خرید
                  </text>
                  <text x={cx} y={cy - 18} textAnchor="middle" className="fill-white" fontSize="34" fontWeight="800">
                    {fa(Math.round(score))}
                  </text>
                  {/* large برای مسیر قوس ثابت است */}
                  <desc>{`large-arc=${large}`}</desc>
                </svg>
              ) : (
                <Skeleton className="h-[140px] w-[260px]" />
              )}
            </div>

            {p ? (
              <>
                <div className={cn("mx-auto flex w-fit items-center gap-2 rounded-xl border px-3 py-1.5 text-[13px] font-extrabold", zoneColor.bg, zoneColor.text)}>
                  {p.zone === "buy" ? "▲" : p.zone === "sell" ? "▼" : "●"} {p.zoneFa}
                </div>
                <p className="mt-3 text-center text-[11px] text-slate-500">{p.sourceNoteFa}</p>
              </>
            ) : (
              <div className="mt-3">
                <Unavailable label="دماسنج در دسترس نیست" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-3xl border border-white/8 bg-bt-ink-900/60 p-5">
              <p className="text-[12px] font-bold text-slate-200">راهنمای لحظه بازار</p>
              {p ? (
                <p className="mt-2 text-[13px] leading-7 text-slate-300">{p.guidanceFa}</p>
              ) : (
                <Skeleton className="mt-2 h-12 w-full" />
              )}
              {p?.disclaimer ? <p className="mt-3 text-[10.5px] leading-5 text-slate-500">{p.disclaimer}</p> : null}
            </div>

            <div className="rounded-3xl border border-white/8 bg-bt-ink-900/60 p-5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold text-slate-200">رأی اندیکاتورها</p>
                {p ? (
                  <p className="text-[10.5px] text-slate-500">
                    {typeof p.consensus === "object" && p.consensus
                      ? Object.entries(p.consensus)
                          .filter(([, v]) => typeof v === "number")
                          .slice(0, 3)
                          .map(([k, v]) => `${fa(k)}: ${fa(v as number)}`)
                          .join(" · ")
                      : ""}
                  </p>
                ) : null}
              </div>
              {p ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(p.indicators || []).slice(0, 18).map((ind, i) => {
                    const v = Number(ind.vote ?? 0);
                    return (
                      <span
                        key={ind.key || i}
                        title={ind.labelFa || ind.key}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10.5px] font-bold",
                          v > 0
                            ? "border-bt-bull-500/30 bg-bt-bull-500/10 text-bt-bull-400"
                            : v < 0
                              ? "border-bt-bear-500/30 bg-bt-bear-500/10 text-bt-bear-400"
                              : "border-white/12 bg-white/5 text-slate-400",
                        )}
                      >
                        {v > 0 ? "▲" : v < 0 ? "▼" : "●"}
                        <span className="text-slate-300">{ind.labelFa || ind.key}</span>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-7 w-20" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
