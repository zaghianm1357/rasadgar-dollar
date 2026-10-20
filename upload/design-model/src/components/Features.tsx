import { Container, Reveal, SectionHeading, Card } from "./ui";

const FEATURES = [
  {
    icon: "M3 17l6-6 4 4 7-7",
    t: "قیمت لحظه‌ای نمادها",
    d: "طلا، نقره، داوجونز، اس‌اند‌پی، نزدک، نفت، جفت‌ارزها، بیت‌کوین و دلار آزاد تهران در یک داشبورد.",
  },
  {
    icon: "M7 4v16M17 4v16M4 8h16M4 16h16",
    t: "تقویم اقتصادی فارسی",
    d: "رویدادهای ForexFactory با ترجمه فارسی، سطح اهمیت، داده واقعی و پیش‌بینی — بر اساس ساعت تهران.",
  },
  {
    icon: "M4 19h16M6 16v-5M11 16V7M16 16v-8",
    t: "ساختار بازار ۴ تایم‌فریم",
    d: "تشخیص جهت غالب و قدرت روند در تایم‌فریم‌های ۱۵ دقیقه، ۱ ساعت، ۴ ساعت و روزانه.",
  },
  {
    icon: "M12 7v5l3 2M12 3a9 9 0 1 0 9 9",
    t: "شمارش معکوس خبر پراثر",
    d: "تا لحظه انتشار داده‌های مهم زمان‌سنج دقیق فعال است تا قبل از خبر تصمیم بگیرید، نه بعد از آن.",
  },
  {
    icon: "M5 5h14v10H5zM9 19h6",
    t: "خلاصه هوشمند روزانه",
    d: "ترکیب قیمت، ساختار و تقویم در یک بریفینگ کوتاه فارسی با کلیدواژه‌های کلیدی روز.",
  },
  {
    icon: "M15 8a3 3 0 1 0-6 0c0 4-2 5-2 5h10s-2-1-2-5M10 18a2 2 0 0 0 4 0",
    t: "اعلان و هشدار سطح",
    d: "تغییر روند، شکست حمایت و مقاومت و نزدیک شدن خبر، هم در سایت و هم روی گوشی.",
  },
];

const STEPS = [
  { n: "۱", t: "اتصال به منابع داده", d: "فید قیمت و تقویم اقتصادی در کمتر از یک دقیقه همگام می‌شود." },
  { n: "۲", t: "تحلیل خودکار", d: "موتور ساختار بازار، جهت و قدرت روند را در ۴ تایم‌فریم محاسبه می‌کند." },
  { n: "۳", t: "هشدار و اجرا", d: "اعلان‌ها را دریافت می‌کنید و با نقشه سطح‌های کلیدی معامله را اجرا می‌کنید." },
];

export default function Features() {
  return (
    <section className="py-20">
      <Container>
        <Reveal>
          <SectionHeading
            center
            eyebrow="امکانات"
            title={<>ابزارهایی که معامله‌گر حرفه‌ای لازم دارد</>}
            desc="تمام امکانات بیگ تردر برای پاسخ به یک سوال طراحی شده‌اند: الان دقیقاً بازار در چه وضعیتی است و چه چیزی آن را جابه‌جا می‌کند؟"
          />
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.t} delay={i * 60}>
              <Card className="group h-full p-6 transition duration-300 hover:-translate-y-1 hover:border-gold-400/30">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-gold-400/25 bg-gold-400/8 text-gold-300 transition group-hover:bg-gold-400/15">
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d={f.icon} />
                  </svg>
                </div>
                <h3 className="mt-5 text-[15px] font-bold text-white">{f.t}</h3>
                <p className="mt-2 text-[12.5px] leading-7 text-slate-400">{f.d}</p>
              </Card>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120}>
          <div className="mt-14 grid gap-5 rounded-[32px] border border-white/8 bg-gradient-to-l from-white/4 to-transparent p-6 sm:p-8 lg:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-4">
                <span className="num grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-gold-400 to-gold-600 text-[15px] font-extrabold text-ink-950">
                  {s.n}
                </span>
                <div>
                  <h4 className="text-[14px] font-bold text-white">{s.t}</h4>
                  <p className="mt-1 text-[12.5px] leading-6 text-slate-400">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
