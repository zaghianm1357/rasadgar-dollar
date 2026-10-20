import { useState } from "react";
import { cn } from "@/utils/cn";
import { Card, Container, Reveal, SectionHeading } from "./ui";

const PLANS = [
  {
    name: "پایه",
    price: "رایگان",
    period: "برای همیشه",
    desc: "برای شروع رصد روزانه بازار",
    features: [
      "قیمت لحظه‌ای ۴ نماد منتخب",
      "تقویم اقتصادی امروز (فارسی)",
      "شمارش معکوس خبر پراثر",
      "خلاصه هوشمند روزانه",
    ],
    cta: "شروع بدون کارت بانکی",
    highlight: false,
  },
  {
    name: "حرفه‌ای",
    price: "۲۹۰",
    unit: "هزار تومان / ماه",
    desc: "برای معامله‌گر فعال روزانه",
    features: [
      "تمام ۱۰ نماد + جستجوی نامحدود",
      "ماتریس ساختار بازار ۴ تایم‌فریم",
      "سطح‌های کلیدی حمایت و مقاومت",
      "هشدار تغییر روند و شکست سطح",
      "بریفینگ صوتی هر صبح",
      "پشتیبانی اولویت‌دار",
    ],
    cta: "فعال‌سازی اشتراک حرفه‌ای",
    highlight: true,
  },
  {
    name: "سازمانی",
    price: "سفارشی",
    period: "قیمت توافقی",
    desc: "برای تیم‌ها و اتاق معاملات",
    features: [
      "اتصال API به سامانه داخلی",
      "ویجت اختصاصی برند شما",
      "گزارش‌گیری دوره‌ای تیم",
      "مدیر حساب اختصاصی",
    ],
    cta: "تماس با تیم فروش",
    highlight: false,
  },
];

const FAQ = [
  {
    q: "داده‌های قیمت از کجا تامین می‌شود؟",
    a: "قیمت نمادها از چند منبع متخصص بازار دریافت و میانگین‌گیری می‌شود و تقویم اقتصادی بر پایه فید ForexFactory با ترجمه فارسی و تبدیل ساعت به وقت تهران نمایش داده می‌شود.",
  },
  {
    q: "ساختار بازار چگونه محاسبه می‌شود؟",
    a: "موتور تحلیل، سقف و کف‌های هر تایم‌فریم را می‌سنجد و با الگوی سقف بالاتر/کف بالاتر یا سقف پایین‌تر/کف پایین‌تر، جهت غالب و قدرت آن را به‌صورت درصدی گزارش می‌کند.",
  },
  {
    q: "آیا بیگ تردر سیگنال خرید و فروش می‌دهد؟",
    a: "خیر. بیگ تردر یک ابزار رصد و تحلیل است؛ سطح‌ها و ساختار بازار را نشان می‌دهد اما تصمیم و مسئولیت معامله بر عهده خود شماست.",
  },
  {
    q: "روی گوشی هم قابل استفاده است؟",
    a: "بله. سایت به‌صورت PWA طراحی شده و می‌توانید آن را به صفحه اصلی گوشی اضافه کنید تا دقیقاً مانند یک اپ با ویجت‌ها و مرکز اعلان‌ها کار کند.",
  },
  {
    q: "امکان لغو اشتراک وجود دارد؟",
    a: "بله، اشتراک ماهانه است و هر زمان می‌توانید لغو کنید؛ تا پایان دوره پرداخت‌شده دسترسی شما حفظ می‌شود.",
  },
];

export default function Plans() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="plans" className="border-t border-white/6 bg-ink-900/40 py-20">
      <Container>
        <Reveal>
          <SectionHeading
            center
            eyebrow="اشتراک"
            title={<>پلن مناسب سبک معاملاتی خود را انتخاب کنید</>}
            desc="بدون قرارداد بلندمدت. هر زمان می‌توانید پلن را ارتقا دهید یا لغو کنید."
          />
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 80}>
              <Card
                glow={p.highlight}
                className={cn(
                  "relative h-full p-6",
                  p.highlight && "border-gold-400/35 bg-gradient-to-b from-gold-400/8 to-transparent",
                )}
              >
                {p.highlight && (
                  <span className="absolute -top-3 right-6 rounded-full bg-gradient-to-l from-gold-500 to-gold-300 px-3 py-1 text-[10.5px] font-bold text-ink-950">
                    پیشنهاد بیگ تردر
                  </span>
                )}
                <h3 className="text-[15px] font-bold text-white">{p.name}</h3>
                <p className="mt-1 text-[12px] text-slate-400">{p.desc}</p>
                <div className="mt-5 flex items-end gap-2">
                  <span className="num text-3xl font-extrabold text-white">{p.price}</span>
                  <span className="pb-1.5 text-[11.5px] text-slate-400">{p.unit ?? p.period}</span>
                </div>
                <ul className="mt-6 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[12.5px] leading-6 text-slate-300">
                      <span className="mt-1.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-bull-500/15 text-[9px] text-bull-400">
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  className={cn(
                    "mt-7 w-full rounded-2xl px-4 py-3 text-[13px] font-bold transition",
                    p.highlight
                      ? "bg-gradient-to-l from-gold-500 to-gold-300 text-ink-950 hover:brightness-110"
                      : "border border-white/12 bg-white/5 text-slate-100 hover:border-gold-400/40 hover:text-gold-200",
                  )}
                >
                  {p.cta}
                </button>
              </Card>
            </Reveal>
          ))}
        </div>

        <div className="mt-20 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal>
            <SectionHeading eyebrow="سوالات متداول" title={<>چیزهایی که لازم است بدانید</>} />
          </Reveal>

          <Reveal delay={80}>
            <div className="space-y-3">
              {FAQ.map((f, i) => {
                const isOpen = open === i;
                return (
                  <div
                    key={f.q}
                    className={cn(
                      "glass overflow-hidden rounded-2xl transition",
                      isOpen && "border-gold-400/25",
                    )}
                  >
                    <button
                      onClick={() => setOpen(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-right"
                    >
                      <span className={cn("text-[13.5px] font-bold", isOpen ? "text-gold-200" : "text-slate-100")}>
                        {f.q}
                      </span>
                      <span
                        className={cn(
                          "grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/12 text-[12px] text-slate-300 transition",
                          isOpen && "rotate-45 border-gold-400/40 text-gold-300",
                        )}
                      >
                        +
                      </span>
                    </button>
                    <div
                      className={cn(
                        "grid transition-all duration-300",
                        isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <p className="overflow-hidden px-5 pb-4 text-[12.5px] leading-7 text-slate-400">{f.a}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
