"use client";

/* بخش‌های اطلاعاتی: تقویم اقتصادی + تحلیل و پیش‌بینی + امکانات + اپ‌شوکیس + دریافت */

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Container, LiveDot, SectionHead, Skeleton, Unavailable } from "./ui";
import { fa, fmtEventTime, fmtPrice, type GoldAnalysis, type MarketStructure, type NewsEvent } from "./site-data";
import version from "../../../version.json";

/* ---------- تقویم اقتصادی ---------- */

const IMPACT_CLS: Record<string, string> = {
  High: "border-bt-bear-500/30 bg-bt-bear-500/10 text-bt-bear-400",
  Medium: "border-bt-gold-500/30 bg-bt-gold-500/10 text-bt-gold-300",
  Low: "border-white/12 bg-white/5 text-slate-400",
};
const IMPACT_FA: Record<string, string> = { High: "مهم", Medium: "متوسط", Low: "کم" };

const FLAG_FA: Record<string, string> = {
  USD: "دلار آمریکا",
  EUR: "یورو",
  GBP: "پوند",
  JPY: "ین ژاپن",
  CAD: "دلار کانادا",
  AUD: "دلار استرالیا",
  CHF: "فرانک سوئیس",
  CNY: "یوان چین",
  NZD: "دلار نیوزیلند",
  ALL: "همه",
};

export function Calendar({ events }: { events: NewsEvent[] | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!events) {
    return (
      <section id="calendar" className="scroll-mt-32 py-16">
        <Container>
          <SectionHead kicker="تقویم اقتصادی" title={<>رویدادهای پراثر دلار — ترجمهٔ فارسی و تحلیل تأثیر</>} />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </Container>
      </section>
    );
  }

  const upcoming = events
    .filter((e) => new Date(e.dateISO).getTime() > now - 3 * 3600_000)
    .sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime())
    .slice(0, 8);
  const high = upcoming.filter((e) => e.impact === "High").length;

  return (
    <section id="calendar" className="scroll-mt-32 py-16">
      <Container>
        <SectionHead
          kicker="تقویم اقتصادی"
          title={<>رویدادهای پراثر دلار — ترجمهٔ فارسی و تحلیل تأثیر</>}
          desc={`فید ForexFactory با ترجمهٔ هوش مصنوعی و برآورد جهت تأثیر بر طلا و دلار — ${fa(high)} رویداد مهم در پیش رو.`}
        />
        <div className="overflow-hidden rounded-3xl border border-white/8 bg-bt-ink-900/60">
          {upcoming.length === 0 ? (
            <div className="p-5">
              <Unavailable label="رویداد پیش‌روی مهمی ثبت نشده" />
            </div>
          ) : (
            <ul className="divide-y divide-white/6">
              {upcoming.map((e) => {
                const past = new Date(e.dateISO).getTime() < now;
                const mins = Math.round((new Date(e.dateISO).getTime() - now) / 60_000);
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 transition hover:bg-white/3 sm:px-5">
                    <span className={cn("shrink-0 rounded-lg border px-2 py-0.5 text-[10.5px] font-bold", IMPACT_CLS[e.impact] || IMPACT_CLS.Low)}>
                      {IMPACT_FA[e.impact] || e.impact}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-slate-100">{e.titleFa || e.title}</p>
                      <p className="mt-0.5 text-[10.5px] text-slate-500">
                        {FLAG_FA[e.country] || e.country} · {fmtEventTime(e.dateISO)} تهران
                        {past ? " · منتشر شد" : mins < 60 ? ` · ${fa(mins)} دقیقه بعد` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-[11px]">
                      {e.forecast ? (
                        <span className="text-slate-400">
                          پیش‌بینی <span className="bt-num text-slate-200">{e.forecast}</span>
                        </span>
                      ) : null}
                      {e.previous ? (
                        <span className="hidden text-slate-500 sm:inline">
                          پیشین <span className="bt-num">{e.previous}</span>
                        </span>
                      ) : null}
                      {e.actual ? (
                        <span className="bt-num rounded-lg bg-white/8 px-2 py-0.5 font-bold text-white">واقعی {e.actual}</span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          نسخهٔ کامل با ترجمه، تحلیل تأثیر و سناریوی خبری داخل <a href="?view=tool" className="text-bt-gold-300 hover:underline">ابزار رصدگر دلار</a> موجود است.
        </p>
      </Container>
    </section>
  );
}

/* ---------- تحلیل و پیش‌بینی ---------- */

export function Analysis({ analysis }: { analysis: { data: GoldAnalysis | null; error: boolean; loading: boolean } }) {
  const a = analysis.data;
  const lite = a?.lite;

  return (
    <section id="analysis" className="scroll-mt-32 border-y border-white/6 bg-bt-ink-900/40 py-16">
      <Container>
        <SectionHead
          kicker="تحلیل و پیش‌بینی"
          title={<>جمع‌بندی مختصر هر روز — LiteFinance، FXStreet و تریدینگ‌ویو</>}
          desc="پنجرهٔ تحلیل و پیش‌بینی ابزار، گزارش روزانهٔ پیش‌بینی طلا، نظرسنجی تحلیلگران و رأی فنی را به یک بریفینگ فارسی و نقشهٔ مسیر با سه سناریو تبدیل می‌کند؛ منبع هر عدد برچسب دارد."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {/* بریفینگ */}
          <div className="bt-glass rounded-3xl p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-[12.5px] font-bold text-slate-200">بریفینگ امروز</p>
              {a ? (
                <span
                  className={cn(
                    "rounded-lg border px-2 py-0.5 text-[10px] font-bold",
                    a.stale ? "border-bt-bear-500/30 bg-bt-bear-500/10 text-bt-bear-400" : "border-bt-bull-500/30 bg-bt-bull-500/10 text-bt-bull-400",
                  )}
                >
                  {a.stale ? `کهنه — ${fa(Math.round(a.ageMin))} دقیقه` : "تازه"} {lite?.snapshot ? "· اسنپ‌شات" : "· زنده"}
                </span>
              ) : null}
            </div>
            {a?.summaryFa?.length ? (
              <ul className="mt-3 space-y-2.5">
                {a.summaryFa.map((line, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] leading-6 text-slate-300">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bt-gold-400" />
                    {line}
                  </li>
                ))}
              </ul>
            ) : analysis.error ? (
              <div className="mt-3">
                <Unavailable label="بریفینگ در دسترس نیست" />
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            )}
            {a?.sourcesNoteFa ? <p className="mt-4 border-t border-white/6 pt-3 text-[10.5px] leading-5 text-slate-500">{a.sourcesNoteFa}</p> : null}
          </div>

          {/* پیش‌بینی فردا و هفته */}
          <div className="flex flex-col gap-4">
            <div className="rounded-3xl border border-white/8 bg-bt-ink-900/60 p-5">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold text-slate-200">پیش‌بینی فردا (LiteFinance)</p>
                <LiveDot paused={!lite?.ok} />
              </div>
              {lite?.tomorrow ? (
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    ["کف", lite.tomorrow.low],
                    ["میانگین", lite.tomorrow.avg],
                    ["سقف", lite.tomorrow.high],
                  ].map(([label, v]) => (
                    <div key={String(label)} className="rounded-2xl border border-white/8 bg-white/4 p-2.5">
                      <p className="text-[10px] text-slate-500">{label as string}</p>
                      <p className="bt-num mt-1 text-[14px] font-extrabold text-white">{fmtPrice(Number(v), 2)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <Skeleton className="mt-3 h-16 w-full" />
              )}
              {lite?.week ? (
                <p className="bt-num mt-3 text-[10.5px] text-slate-500">
                  هفته: {fmtPrice(lite.week.low, 0)} — {fmtPrice(lite.week.high, 0)} دلار
                </p>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/8 bg-bt-ink-900/60 p-5">
              <p className="text-[12px] font-bold text-slate-200">نظرسنجی تحلیلگران (FXStreet)</p>
              {a?.fx?.poll?.length ? (
                <ul className="mt-3 space-y-2.5">
                  {a.fx.poll.map((p, i) => (
                    <li key={i} className="flex items-center justify-between text-[11.5px]">
                      <span className="text-slate-400">{p.periodFa}</span>
                      <span className="text-slate-300">{p.mixFa}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <Skeleton className="mt-3 h-14 w-full" />
              )}
              {a?.tv?.stateFa ? (
                <p className="mt-3 border-t border-white/6 pt-2.5 text-[11px] text-slate-400">
                  رأی فنی تریدینگ‌ویو: <span className="font-bold text-bt-gold-300">{a.tv.stateFa}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------- امکانات ---------- */

const FEATURES = [
  {
    icon: "📊",
    title: "ساختار بازار ۶ تایم‌فریم",
    desc: "ترکیب EMA ۲۰/۵۰ و سقف/کف‌های سوئینگ از ۵ دقیقه تا ماهانه، با ثبت خودکار تغییر جهت‌ها.",
  },
  {
    icon: "🌡️",
    title: "دماسنج فشار خرید/فروش",
    desc: "رأی فنی تریدینگ‌ویو در ۳ تایم‌فریم + پشتیبان محلی ۱۶ اندیکاتور — فقط نتیجهٔ سه‌حالته، بدون فرمول.",
  },
  {
    icon: "🔮",
    title: "تحلیل و پیش‌بینی طلا",
    desc: "گزارش روزانهٔ LiteFinance (فردا و هفته + پلن معاملاتی) و نظرسنجی FXStreet در یک بریفینگ فارسی.",
  },
  {
    icon: "🗺️",
    title: "نقشهٔ مسیر امروز",
    desc: "تلفیق ۷ منبع ابزار در سه سناریوی صعودی/نزولی/رنج با محرک، ابطال و هدف + ساعت‌های حساس اخبار.",
  },
  {
    icon: "⚡",
    title: "سیگنال اسکلپ اونس",
    desc: "پورت اندیکاتور SBW + اوردر بلاک FVG + ستاپ ۴ ساعته + واگرایی روی کندل‌های زنده.",
  },
  {
    icon: "🤝",
    title: "دستیار معامله‌گر BIG TRADER",
    desc: "امتیاز اطمینان، ماشین‌حساب حجم و حد ضرر/سود، سناریوی خبری و واگرایی دلار.",
  },
  {
    icon: "📈",
    title: "چارت رسمی تریدینگ‌ویو",
    desc: "چارت پیشرفته با چند نماد و تایم‌فریم + تحلیل هوشمند الگوریتمی همان نماد و تایم‌فریم.",
  },
  {
    icon: "📁",
    title: "فایل مستقل تک‌فایلی",
    desc: "خروجی HTML که با ایمیل یا پیام‌رسان منتقل می‌شود و روی هر گوشی بدون نصب باز می‌شود.",
  },
  {
    icon: "🔌",
    title: "افزونهٔ وردپرس",
    desc: "اجرای ابزار داخل سایت خودتان با یک شورت‌کد — بدون دیتابیس، بدون تنظیمات پیچیده.",
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-32 py-16">
      <Container>
        <SectionHead
          kicker="امکانات"
          title={<>هرچه برای معاملهٔ آگاهانه لازم دارید، در یک ابزار فارسی</>}
          desc="بیگ تردر مجموعه‌ای ماژولار است: هر بخش کار خودش را انجام می‌دهد و همه از یک منبع داده تغذیه می‌شوند تا اعداد همیشه با هم سازگار باشند."
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-3xl border border-white/8 bg-bt-ink-900/60 p-5 transition hover:border-bt-gold-400/30 hover:bg-white/4"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-xl" aria-hidden>
                {f.icon}
              </span>
              <h3 className="mt-3.5 text-[14px] font-extrabold text-white">{f.title}</h3>
              <p className="mt-2 text-[12px] leading-6 text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ---------- اپ‌شوکیس ---------- */

export function Showcase({ ms, onOpenTool }: { ms: MarketStructure | null; onOpenTool: () => void }) {
  return (
    <section id="app" className="scroll-mt-32 border-y border-white/6 bg-bt-ink-900/40 py-16">
      <Container className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionHead
            kicker="اپلیکیشن"
            title={<>پوستهٔ موبایل لمسی، حس اپ بومی</>}
            desc="ابزار به‌شکل پوستهٔ موبایل طراحی شده: صفحات سوایپی با پارالاکس، مرکز اعلان‌ها و مرکز کنترل شیشه‌ای، مرتب‌سازی آیکون‌ها با کشیدن و انیمیشن اجرای اپ — همه با دادهٔ زنده."
          />
          <ul className="space-y-2.5 text-[12.5px] leading-6 text-slate-300">
            {[
              "۸ اپ مستقل: اخبار، ساختار بازار، پیشنهاد معامله، اسکلپ، چارت، دستیار، تحلیل و پیش‌بینی، دماسنج",
              "مرکز اعلان‌ها برای تغییر جهت بازار و خبرهای پراثر پیش‌رو",
              "کالیبراسیون قیمت با اسپات تا همهٔ صفحات یک عدد واحد نشان دهند",
              "حالت تمام‌صفحه در وردپرس و فایل مستقل برای استفادهٔ روزمره",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bt-gold-400" />
                {t}
              </li>
            ))}
          </ul>
          <button
            onClick={onOpenTool}
            className="mt-7 rounded-2xl bg-gradient-to-l from-bt-gold-500 to-bt-gold-300 px-6 py-3.5 text-[14px] font-bold text-bt-ink-950 shadow-[0_18px_40px_-16px] shadow-bt-gold-500/60 transition hover:brightness-110"
          >
            همین حالا امتحان کنید
          </button>
        </div>

        {/* ماکت گوشی */}
        <div className="relative mx-auto w-full max-w-[320px]">
          <div className="absolute -inset-8 rounded-[56px] bg-bt-gold-500/8 blur-3xl" aria-hidden />
          <div className="relative rounded-[44px] border border-white/12 bg-bt-ink-950 p-3 shadow-[0_50px_100px_-40px_rgba(0,0,0,0.95)]">
            <div className="overflow-hidden rounded-[34px] border border-white/8 bg-bt-ink-900">
              <div className="flex items-center justify-between px-4 pt-3 text-[10px] text-slate-500">
                <span className="bt-num">۱۲:۳۰</span>
                <span>BIG TRADER</span>
                <span className="bt-num">۱۰۰٪</span>
              </div>
              <div className="px-4 pb-4 pt-2">
                <div className="rounded-2xl border border-white/8 bg-bt-ink-850 p-3">
                  <p className="text-[10px] text-slate-500">طلا — XAUUSD</p>
                  <p className="bt-num mt-0.5 text-xl font-extrabold text-white">
                    {ms?.xau ? fmtPrice(ms.xau.price, 1) : "—"}
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    {["۵د", "۱۵د", "۱س", "۴س", "روز"].map((t, i) => (
                      <span
                        key={t}
                        className={cn(
                          "rounded-md border px-1.5 py-0.5 text-[9px] font-bold",
                          i < 2 ? "border-bt-bull-500/30 bg-bt-bull-500/10 text-bt-bull-400" : i < 4 ? "border-bt-bear-500/30 bg-bt-bear-500/10 text-bt-bear-400" : "border-white/12 bg-white/5 text-slate-400",
                        )}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {["📈", "🌡️", "🔮", "🗺️", "⚡", "🤝", "🔔", "⚙️"].map((ic, i) => (
                    <div key={i} className="grid aspect-square place-items-center rounded-2xl border border-white/8 bg-bt-ink-850 text-base">
                      {ic}
                    </div>
                  ))}
                </div>
                <div className="mt-2 rounded-2xl border border-white/8 bg-bt-ink-850 p-3">
                  <p className="text-[10px] text-slate-500">دماسنج فشار — روزانه</p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/8">
                    <div className="h-full w-[38%] rounded-full bg-gradient-to-l from-bt-bull-400 via-slate-400 to-bt-bear-400" />
                  </div>
                  <p className="mt-1.5 text-[9px] text-slate-400">نمایش ظاهری رابط — اعداد واقعی در خود ابزار</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

/* ---------- دریافت ---------- */

const GET_CARDS = [
  {
    icon: "🌐",
    title: "نسخهٔ وب",
    desc: "همین ابزار به‌شکل پوستهٔ موبایل با دادهٔ زنده — بدون نصب، مستقیم در مرورگر.",
    cta: "ورود به ابزار",
    action: "tool" as const,
  },
  {
    icon: "📁",
    title: "فایل مستقل HTML",
    desc: "تک‌فایل قابل ارسال با ایمیل و پیام‌رسان؛ از صفحهٔ Releases مخزن پروژه دانلود کنید.",
    cta: "دانلود از گیت‌هاب",
    href: "https://github.com/zaghianm1357/rasadgar-dollar/releases",
  },
  {
    icon: "🔌",
    title: "افزونهٔ وردپرس",
    desc: "بستهٔ rasadgar-dollar-wp.zip را در وردپرس نصب کنید و با شورت‌کد منتشر کنید.",
    cta: "دانلود بستهٔ وردپرس",
    href: "https://github.com/zaghianm1357/rasadgar-dollar/releases",
  },
];

export function Get({ onOpenTool }: { onOpenTool: () => void }) {
  return (
    <section id="get" className="scroll-mt-32 py-16">
      <Container>
        <SectionHead
          kicker="دریافت ابزار"
          title={<>سه راه برای استفاده از رصدگر دلار</>}
          desc={`نسخهٔ فعلی: v${fa(version.version)} — همهٔ بسته‌ها در صفحهٔ Releases مخزن گیت‌هاب پروژه منتشر می‌شوند.`}
        />
        <div className="grid gap-4 md:grid-cols-3">
          {GET_CARDS.map((c) => (
            <div key={c.title} className="bt-glass flex flex-col rounded-3xl p-5">
              <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-xl" aria-hidden>
                {c.icon}
              </span>
              <h3 className="mt-3.5 text-[15px] font-extrabold text-white">{c.title}</h3>
              <p className="mt-2 flex-1 text-[12px] leading-6 text-slate-400">{c.desc}</p>
              {c.action === "tool" ? (
                <button
                  onClick={onOpenTool}
                  className="mt-4 rounded-2xl bg-gradient-to-l from-bt-gold-500 to-bt-gold-300 px-5 py-3 text-[13px] font-bold text-bt-ink-950 transition hover:brightness-110"
                >
                  {c.cta}
                </button>
              ) : (
                <a
                  href={c.href}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 rounded-2xl border border-white/14 bg-white/5 px-5 py-3 text-center text-[13px] font-semibold text-slate-100 transition hover:border-bt-gold-400/40 hover:text-bt-gold-200"
                >
                  {c.cta}
                </a>
              )}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
