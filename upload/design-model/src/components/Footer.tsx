import { cn } from "@/utils/cn";
import { useMarket } from "@/lib/MarketContext";
import { Container, LiveDot, Logo } from "./ui";

const COLUMNS = [
  {
    title: "محصول",
    links: ["داشبورد بازار زنده", "تقویم اقتصادی فارسی", "ساختار بازار", "خلاصه هوشمند", "ویجت‌های موبایل"],
  },
  {
    title: "بازارها",
    links: ["طلا و نقره", "شاخص‌های سهام", "نفت و انرژی", "جفت‌ارزها", "دلار آزاد تهران"],
  },
  {
    title: "بیگ تردر",
    links: ["درباره ما", "تماس با پشتیبانی", "مستندات API", "وبلاگ آموزشی", "همکاری با ما"],
  },
];

export default function Footer() {
  return (
    <>
      <section className="py-16">
        <Container>
          <div className="glass relative overflow-hidden rounded-[32px] px-6 py-12 text-center sm:px-12">
            <div className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-gold-500/15 blur-[100px]" />
            <div className="relative">
              <h2 className="text-2xl leading-relaxed font-extrabold text-white sm:text-3xl">
                آماده‌اید بازار را <span className="gold-text">دقیق‌تر</span> ببینید؟
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[13.5px] leading-7 text-slate-400">
                داشبورد زنده بیگ تردر را باز کنید؛ قیمت لحظه‌ای، ساختار بازار و تقویم اقتصادی، همه در یک صفحه و کاملاً
                فارسی.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a
                  href="#markets"
                  className="rounded-2xl bg-gradient-to-l from-gold-500 to-gold-300 px-6 py-3.5 text-[14px] font-bold text-ink-950 shadow-[0_18px_40px_-16px] shadow-gold-500/60 transition hover:brightness-110"
                >
                  ورود به داشبورد
                </a>
                <a
                  href="#calendar"
                  className="rounded-2xl border border-white/14 bg-white/5 px-6 py-3.5 text-[14px] font-semibold text-slate-100 transition hover:border-gold-400/40 hover:text-gold-200"
                >
                  دیدن خبرهای امروز
                </a>
              </div>
            </div>
          </div>
        </Container>
      </section>

      <footer className="border-t border-white/8 bg-ink-950">
        <Container className="py-14">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_2fr]">
            <div>
              <div className="flex items-center gap-3">
                <Logo size={46} />
                <div>
                  <p dir="ltr" className="text-[15px] font-extrabold tracking-[0.18em] text-white">
                    BIG TRADER
                  </p>
                  <p className="text-[11.5px] text-slate-400">دستیار هوشمند معامله‌گری · رصدگر دلار</p>
                </div>
              </div>
              <p className="mt-5 max-w-sm text-[12.5px] leading-7 text-slate-400">
                پلتفرم فارسی رصد بازارهای مالی: قیمت لحظه‌ای، تقویم اقتصادی، ساختار بازار و خلاصه تحلیلی هوشمند برای
                معامله‌گران ایرانی.
              </p>
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-white/8 bg-white/4 px-3 py-2">
                <LiveDot />
                <span className="text-[11.5px] text-slate-300">سامانه فعال و در حال پایش بازار</span>
              </div>
            </div>

            <div className="grid gap-8 sm:grid-cols-3">
              {COLUMNS.map((c) => (
                <div key={c.title}>
                  <h4 className="text-[13px] font-bold text-white">{c.title}</h4>
                  <ul className="mt-4 space-y-2.5">
                    {c.links.map((l) => (
                      <li key={l}>
                        <a href="#top" className="text-[12.5px] text-slate-400 transition hover:text-gold-200">
                          {l}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 rounded-2xl border border-white/8 bg-white/3 p-4">
            <p className="text-[11.5px] leading-7 text-slate-500">
              <span className="font-bold text-slate-300">هشدار ریسک:</span> معامله در بازارهای مالی با اهرم، ریسک بالای
              از دست دادن سرمایه دارد. داده‌های نمایش داده شده در این نسخه نمایشی به‌صورت شبیه‌سازی‌شده بروزرسانی می‌شوند
              و توصیه سرمایه‌گذاری محسوب نمی‌شوند. مسئولیت نهایی تصمیم معاملاتی بر عهده کاربر است.
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/8 pt-6 sm:flex-row">
            <p className="num text-[11.5px] text-slate-500">© ۱۴۰۴ بیگ تردر · تمامی حقوق محفوظ است</p>
            <div className="flex items-center gap-4 text-[11.5px] text-slate-500">
              <a href="#top" className="transition hover:text-slate-300">
                قوانین استفاده
              </a>
              <a href="#top" className="transition hover:text-slate-300">
                حریم خصوصی
              </a>
              <span className="hidden sm:block">ساخته‌شده بر پایه ابزار BIG TRADER</span>
            </div>
          </div>
        </Container>
      </footer>
    </>
  );
}

export function ControlDock({ onOpenNotifications }: { onOpenNotifications: () => void }) {
  const { paused, sound, togglePause, toggleSound } = useMarket();

  return (
    <div className="fixed bottom-5 left-4 z-40 flex flex-col gap-2 sm:bottom-8 sm:left-8">
      <div className="glass flex items-center gap-1 rounded-2xl p-1.5 shadow-2xl shadow-black/50">
        <DockButton
          label={paused ? "ادامه پایش" : "توقف پایش"}
          onClick={togglePause}
          active={!paused}
          icon={
            paused ? (
              <path d="M8 5l11 7-11 7z" strokeLinejoin="round" />
            ) : (
              <path d="M9 5v14M15 5v14" strokeLinecap="round" />
            )
          }
        />
        <DockButton
          label={sound ? "صدا فعال" : "صدا خاموش"}
          onClick={toggleSound}
          active={sound}
          icon={
            sound ? (
              <path d="M11 5L6 9H3v6h3l5 4zM16 9a4 4 0 0 1 0 6" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M11 5L6 9H3v6h3l5 4zM17 9l4 6M21 9l-4 6" strokeLinecap="round" strokeLinejoin="round" />
            )
          }
        />
        <DockButton
          label="مرکز اعلان‌ها"
          onClick={onOpenNotifications}
          icon={<path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" />}
        />
        <DockButton
          label="بالا"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          icon={<path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />}
        />
      </div>
      <div
        className={cn(
          "glass flex items-center justify-center gap-2 rounded-2xl px-3 py-1.5 text-[10.5px] font-semibold",
          paused ? "text-gold-300" : "text-bull-400",
        )}
      >
        <LiveDot paused={paused} />
        {paused ? "پایش متوقف است" : "داده‌ها زنده است"}
      </div>
    </div>
  );
}

function DockButton({
  label,
  icon,
  onClick,
  active = true,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "group relative grid h-10 w-10 place-items-center rounded-xl transition",
        active ? "bg-gold-400/12 text-gold-300" : "bg-white/5 text-slate-400 hover:text-slate-100",
      )}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        {icon}
      </svg>
      <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-lg border border-white/10 bg-ink-950/95 px-2 py-1 text-[10px] whitespace-nowrap text-slate-200 opacity-0 transition group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}
