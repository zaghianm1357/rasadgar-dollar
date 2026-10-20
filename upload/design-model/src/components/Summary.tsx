import { useEffect, useState } from "react";
import { useMarket } from "@/lib/MarketContext";
import { SUMMARY_VARIANTS } from "@/lib/market";
import { fa, fmtFullDate, fmtPrice, fmtTime } from "@/lib/format";
import { cn } from "@/utils/cn";
import { Card, Container, Delta, Reveal, SectionHeading } from "./ui";

export default function Summary() {
  const { quotes, now } = useMarket();
  const gold = quotes["xauusd"];
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  const variant = SUMMARY_VARIANTS[idx];

  useEffect(() => {
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % SUMMARY_VARIANTS.length);
    }, 14000);
    return () => window.clearInterval(t);
  }, []);

  const regenerate = () => {
    setLoading(true);
    window.setTimeout(() => {
      setIdx((i) => (i + 1) % SUMMARY_VARIANTS.length);
      setLoading(false);
    }, 850);
  };

  const bullets = [...variant.bullets];
  bullets[0] = `${bullets[0]} (قیمت لحظه‌ای: ${fmtPrice(gold.price, 2)} دلار)`;

  return (
    <section id="summary" className="border-y border-white/6 bg-ink-900/40 py-20">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="خلاصه هوشمند"
            title={<>هر روز یک بریفینگ تحلیلی، آماده برای تصمیم</>}
            desc="موتور تحلیل بیگ تردر داده‌های قیمت، ساختار بازار و تقویم اقتصادی را ترکیب می‌کند و یک خلاصه کوتاه و قابل‌اجرا تولید می‌کند."
          />
        </Reveal>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Reveal>
            <Card className="relative h-full overflow-hidden p-6">
              <div className="absolute -top-24 -left-16 h-56 w-56 rounded-full bg-gold-500/12 blur-[90px]" />
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/25 bg-gold-400/8 px-2.5 py-1 text-[10.5px] font-bold text-gold-300">
                    ✨ تولید خودکار با هوش مصنوعی
                  </span>
                  <h3 className="mt-3 text-lg font-extrabold text-white sm:text-xl">{variant.headline}</h3>
                  <p className="num mt-1.5 text-[11.5px] text-slate-500">
                    {fmtFullDate(now)} · ساعت {fmtTime(now)}
                  </p>
                </div>
                <button
                  onClick={regenerate}
                  className={cn(
                    "rounded-xl border border-white/12 bg-white/5 px-3.5 py-2 text-[12px] font-semibold text-slate-200 transition hover:border-gold-400/40 hover:text-gold-200",
                    loading && "animate-pulse",
                  )}
                >
                  {loading ? "در حال تحلیل…" : "تولید خلاصه جدید"}
                </button>
              </div>

              <div className="relative mt-6 space-y-3">
                {bullets.map((b, i) => (
                  <div
                    key={`${idx}-${i}`}
                    className={cn(
                      "flex gap-3 rounded-2xl border border-white/8 bg-ink-900/60 p-4 transition-all duration-500",
                      loading ? "opacity-30" : "opacity-100",
                    )}
                    style={{ transitionDelay: `${i * 90}ms` }}
                  >
                    <span className="num mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gold-400/15 text-[11px] font-bold text-gold-300">
                      {fa(i + 1)}
                    </span>
                    <p className="text-[13px] leading-7 text-slate-300">{b}</p>
                  </div>
                ))}
              </div>

              <div className="relative mt-5 flex flex-wrap gap-2">
                {["طلا", "ساختار صعودی", "PCE", "داوجونز", "مدیریت ریسک", "تایم‌فریم ۱ ساعت"].map((t) => (
                  <span key={t} className="rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[10.5px] text-slate-400">
                    #{t}
                  </span>
                ))}
              </div>
            </Card>
          </Reveal>

          <div className="grid gap-5">
            <Reveal delay={80}>
              <Card className="p-5">
                <h4 className="text-[14px] font-bold text-white">نگاه سریع به بازار</h4>
                <div className="mt-4 space-y-3">
                  {["xauusd", "dji", "btcusd", "usdirt"].map((id) => {
                    const ins = { xauusd: "طلا (انس)", dji: "داوجونز", btcusd: "بیت‌کوین", usdirt: "دلار آزاد تهران" }[id]!;
                    const q = quotes[id];
                    const dec = id === "usdirt" || id === "btcusd" ? 0 : 2;
                    return (
                      <div key={id} className="flex items-center justify-between rounded-xl border border-white/6 bg-ink-900/60 px-3 py-2.5">
                        <span className="text-[12.5px] text-slate-300">{ins}</span>
                        <div className="flex items-center gap-2">
                          <span className="num text-[12.5px] font-bold text-white">{fmtPrice(q.price, dec)}</span>
                          <Delta value={q.changePct} showArrow={false} className="text-[10.5px]" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Reveal>

            <Reveal delay={140}>
              <Card className="p-5">
                <h4 className="text-[14px] font-bold text-white">سه گام تا تصمیم دقیق</h4>
                <ol className="mt-4 space-y-4">
                  {[
                    { t: "رصد قیمت و ساختار", d: "چارت زنده و ماتریس تایم‌فریم‌ها جهت غالب را مشخص می‌کند." },
                    { t: "بررسی تقویم اقتصادی", d: "رویدادهای پراثر ساعت تهران و سطح اهمیت آن‌ها." },
                    { t: "اجرای برنامه معاملاتی", d: "سطح‌های کلیدی و حجم پیشنهادی بر اساس ریسک خبری." },
                  ].map((s, i) => (
                    <li key={s.t} className="flex gap-3">
                      <span className="num grid h-7 w-7 shrink-0 place-items-center rounded-full border border-gold-400/30 bg-gold-400/10 text-[11px] font-bold text-gold-300">
                        {fa(i + 1)}
                      </span>
                      <div>
                        <p className="text-[13px] font-bold text-slate-100">{s.t}</p>
                        <p className="mt-0.5 text-[11.5px] leading-6 text-slate-400">{s.d}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}
