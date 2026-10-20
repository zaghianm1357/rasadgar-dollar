import heroBg from "@/assets/hero-bg.jpg";
import { useMarket } from "@/lib/MarketContext";
import { NEWS_EVENTS, STRUCTURE, nextImportantEvent } from "@/lib/market";
import { countdown, dayKey, fa, fmtInt, fmtPrice, fmtTime, pad2 } from "@/lib/format";
import { BiasChip, Container, Delta, LiveDot, Sparkline } from "./ui";

const STATS = [
  { value: "۱۰+", label: "نماد فعال و شاخص کلیدی" },
  { value: "۲۵۰+", label: "رویداد اقتصادی در ماه" },
  { value: "۴", label: "تایم‌فریم پایش هم‌زمان" },
  { value: "۹۹٫۹٪", label: "پایداری فید داده" },
];

export default function Hero() {
  const { quotes, now } = useMarket();
  const gold = quotes["xauusd"];
  const dow = quotes["dji"];
  const next = nextImportantEvent(now);
  const cd = next ? countdown(next.ts, now) : null;
  const todayKey = dayKey(now);
  const todayEvents = NEWS_EVENTS.filter((e) => dayKey(e.ts) === todayKey);
  const todayHigh = todayEvents.filter((e) => e.impact === "high").length;

  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroBg} alt="" className="h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/70 via-ink-950/85 to-ink-950" />
        <div className="grid-bg absolute inset-0 opacity-60" />
        <div className="absolute -top-40 right-1/4 h-96 w-96 rounded-full bg-gold-500/12 blur-[120px]" />
        <div className="absolute bottom-0 left-1/5 h-72 w-72 rounded-full bg-bull-500/8 blur-[120px]" />
      </div>

      <Container className="relative grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-[12px] text-slate-300">
            <LiveDot />
            داده‌های زنده بازار · همگام با تقویم اقتصادی ForexFactory
          </div>

          <h1 className="mt-6 text-[2.1rem] leading-[1.25] font-extrabold text-white sm:text-5xl sm:leading-[1.2]">
            بازار را <span className="gold-text">با چشم باز</span> معامله کنید
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-8 text-slate-300">
            بیگ تردر قیمت لحظه‌ای طلا، شاخص‌های سهام و دلار را با ساختار بازار در چهار تایم‌فریم رصد می‌کند، خبرهای پراثر
            را شمارش معکوس می‌زند و هر صبح یک خلاصه هوشمند تحلیلی به شما می‌دهد.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#markets"
              className="rounded-2xl bg-gradient-to-l from-gold-500 to-gold-300 px-6 py-3.5 text-[14px] font-bold text-ink-950 shadow-[0_18px_40px_-16px] shadow-gold-500/60 transition hover:brightness-110"
            >
              مشاهده داشبورد زنده
            </a>
            <a
              href="#calendar"
              className="rounded-2xl border border-white/14 bg-white/5 px-6 py-3.5 text-[14px] font-semibold text-slate-100 transition hover:border-gold-400/40 hover:text-gold-200"
            >
              تقویم اقتصادی امروز
            </a>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="border-r border-white/10 pr-4">
                <p className="num text-xl font-extrabold text-white">{s.value}</p>
                <p className="mt-1 text-[11.5px] leading-5 text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative animate-fade-up [animation-delay:160ms]">
          <div className="absolute -inset-6 rounded-[42px] bg-gold-500/8 blur-3xl" />
          <div className="glass relative rounded-[32px] p-5 shadow-[0_40px_90px_-50px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-slate-400">طلا — XAUUSD</p>
                <div className="mt-1 flex items-end gap-3">
                  <span className="num text-4xl font-extrabold text-white">{fmtPrice(gold.price, 2)}</span>
                  <span className="text-[11px] text-slate-500">دلار</span>
                </div>
              </div>
              <div className="text-left">
                <Delta value={gold.changePct} />
                <p className="num mt-2 text-[11px] text-slate-500">
                  تغییر روز: {gold.change >= 0 ? "+" : "−"}
                  {fa(Math.abs(gold.change).toFixed(2))}
                </p>
              </div>
            </div>

            <div className="mt-4 -mx-1">
              <Sparkline data={gold.history.map((p) => p.v)} up={gold.changePct >= 0} className="h-24" strokeWidth={2.2} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniTile
                title="داوجونز — DJI"
                value={fmtPrice(dow.price, 2)}
                sub={fmtInt(Math.abs(dow.change))}
                pct={dow.changePct}
              />
              <div className="rounded-2xl border border-white/8 bg-ink-900/60 p-3">
                <p className="text-[11px] text-slate-400">تا خبر مهم</p>
                {cd ? (
                  <>
                    <div dir="ltr" className="num mt-1.5 flex items-center gap-1">
                      {[cd.h, cd.m, cd.s].map((v, i) => (
                        <span key={i} className="rounded-lg bg-white/8 px-1.5 py-0.5 text-[15px] font-bold text-white">
                          {pad2(v)}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 truncate text-[10.5px] text-bear-400">{next!.title}</p>
                  </>
                ) : (
                  <p className="mt-2 text-[12px] text-slate-500">خبر مهمی در صف نیست</p>
                )}
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/8 bg-ink-900/60 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-slate-400">نگاه اجمالی — ساختار بازار</p>
                <p className="text-[10px] text-slate-600">بروزرسانی هر ۱۵ دقیقه</p>
              </div>
              <div className="mt-2 grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-1.5 text-[11px]">
                <span className="text-slate-500">تایم‌فریم</span>
                <span className="text-slate-400">طلا</span>
                <span className="text-slate-400">داو</span>
                {STRUCTURE.map((r) => (
                  <div key={r.tf} className="col-span-3 grid grid-cols-[auto_1fr_1fr] items-center gap-x-3">
                    <span className="num w-8 text-slate-500">{r.tf}</span>
                    <BiasChip bias={r.gold} />
                    <BiasChip bias={r.dow} />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/8 bg-ink-900/60 px-3 py-2.5">
              <span className="text-[11px] text-slate-400">اخبار امروز</span>
              <span className="num text-[11px] text-slate-300">
                {fa(todayEvents.length)} رویداد · {fa(todayHigh)} خبر مهم · بررسی {fmtTime(now)}
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function MiniTile({ title, value, sub, pct }: { title: string; value: string; sub: string; pct: number }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-ink-900/60 p-3">
      <p className="text-[11px] text-slate-400">{title}</p>
      <p className="num mt-1 text-[18px] font-bold text-white">{value}</p>
      <div className="mt-1 flex items-center justify-between">
        <Delta value={pct} />
        <span className="num text-[10px] text-slate-500">{sub}</span>
      </div>
    </div>
  );
}
