import { useMarket } from "@/lib/MarketContext";
import { INSTRUMENTS, STRUCTURE, nextImportantEvent } from "@/lib/market";
import { countdown, fa, fmtClock, fmtInt, fmtPrice, pad2 } from "@/lib/format";
import { cn } from "@/utils/cn";
import { BiasChip, Card, Container, Delta, Reveal, SectionHeading } from "./ui";

const GESTURES = [
  { icon: "👆", t: "نگه‌داشتن آیکون‌ها", d: "حالت لرزش برای جابه‌جایی ویجت‌ها روی صفحه." },
  { icon: "👈", t: "کشیدن به چپ و راست", d: "جابه‌جایی بین صفحات با افکت پارالاکس کاغذدیواری." },
  { icon: "⬇️", t: "کشیدن از بالا", d: "باز شدن مرکز اعلان‌ها با ساعت و تاریخ شمسی." },
  { icon: "⬆️", t: "کشیدن از پایین", d: "دسترسی سریع به مرکز کنترل و تنظیمات پایش." },
];

const APP_ICONS = [
  { label: "داشبورد", grad: "from-gold-400 to-gold-600", glyph: "📊" },
  { label: "تقویم", grad: "from-sky-400 to-blue-600", glyph: "🗓" },
  { label: "ساختار", grad: "from-emerald-400 to-teal-600", glyph: "🧭" },
  { label: "اعلان‌ها", grad: "from-rose-400 to-red-600", glyph: "🔔" },
];

export default function AppShowcase() {
  const { quotes, now } = useMarket();
  const gold = quotes["xauusd"];
  const dow = quotes["dji"];
  const next = nextImportantEvent(now);
  const cd = next ? countdown(next.ts, now) : null;

  return (
    <section id="app" className="py-20">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="اپلیکیشن موبایل"
            title={<>همان داشبورد، روی صفحه اصلی گوشی شما</>}
            desc="بیگ تردر به‌صورت یک صفحه اصلی هوشمند طراحی شده است: ویجت‌های قیمت، شمارش معکوس خبر، مرکز اعلان‌ها و مرکز کنترل — همه با یک حرکت انگشت."
          />
        </Reveal>

        <div className="mt-12 grid items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <Reveal className="order-2 lg:order-1">
            <div className="relative mx-auto w-[290px] sm:w-[320px]">
              <div className="absolute -inset-8 rounded-[60px] bg-gold-500/10 blur-3xl" />
              <div className="relative rounded-[46px] border border-white/12 bg-ink-900 p-2.5 shadow-[0_50px_100px_-40px_rgba(0,0,0,0.95)]">
                <div className="relative h-[600px] overflow-hidden rounded-[38px] bg-gradient-to-b from-[#111a2e] via-[#0a1020] to-[#05070c]">
                  <div className="grid-bg absolute inset-0 opacity-40" />
                  <div className="absolute -top-10 right-0 h-48 w-48 rounded-full bg-gold-500/18 blur-[70px]" />
                  <div className="absolute bottom-10 left-0 h-40 w-40 rounded-full bg-bull-500/12 blur-[60px]" />

                  {/* status bar */}
                  <div className="relative flex items-center justify-between px-5 pt-3 text-[11px] text-white/85">
                    <span className="num font-semibold">{fmtClock(now)}</span>
                    <span className="h-5 w-20 rounded-full bg-black/70" />
                    <span className="num flex items-center gap-1">
                      <span className="text-[9px]">▮▮▮</span> {fa(92)}٪
                    </span>
                  </div>

                  {/* widgets */}
                  <div className="relative space-y-3 p-3.5">
                    <div className="grid grid-cols-2 gap-3">
                      <Widget title="طلا — XAUUSD">
                        <p className="num text-[19px] font-extrabold text-white">{fmtPrice(gold.price, 2)}</p>
                        <div className="mt-1">
                          <Delta value={gold.changePct} showArrow={false} className="text-[10px]" />
                        </div>
                      </Widget>
                      <Widget title="داوجونز — DJI">
                        <p className="num text-[19px] font-extrabold text-white">{fmtPrice(dow.price, 2)}</p>
                        <div className="mt-1">
                          <Delta value={dow.changePct} showArrow={false} className="text-[10px]" />
                        </div>
                      </Widget>
                      <Widget title="تا خبر مهم">
                        {cd ? (
                          <div dir="ltr" className="num flex items-center gap-1">
                            {[cd.h, cd.m, cd.s].map((v, i) => (
                              <span key={i} className="rounded-md bg-white/10 px-1.5 py-0.5 text-[13px] font-bold text-white">
                                {pad2(v)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400">خبر مهمی نیست</p>
                        )}
                        <p className="mt-1.5 truncate text-[9px] text-slate-400">{next?.title ?? "—"}</p>
                      </Widget>
                      <Widget title="اخبار امروز">
                        <p className="num text-[19px] font-extrabold text-white">
                          {fa(14)} <span className="text-[11px] font-normal text-slate-400">خبر</span>
                        </p>
                        <p className="num mt-1 text-[9.5px] text-bear-400">{fa(5)} خبر با اهمیت بالا</p>
                      </Widget>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/6 p-3 backdrop-blur">
                      <p className="text-[10px] text-slate-300">خلاصه روزانه هوشمند</p>
                      <p className="mt-1.5 text-[10.5px] leading-5 text-slate-400">
                        ساختار طلا صعودی است؛ پیش از خبر PCE حجم معاملات را کم کنید.
                      </p>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-white/6 p-3 backdrop-blur">
                      <p className="text-[10px] text-slate-300">نگاه اجمالی — ساختار بازار</p>
                      <div className="mt-2 space-y-1.5">
                        {STRUCTURE.map((r) => (
                          <div key={r.tf} className="flex items-center gap-2">
                            <span className="num w-7 text-[9.5px] text-slate-400">{r.tf}</span>
                            <div className="min-w-0 flex-1">
                              <BiasChip bias={r.gold} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <BiasChip bias={r.dow} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {APP_ICONS.map((a) => (
                        <div key={a.label} className="text-center">
                          <div
                            className={cn(
                              "mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-[18px] shadow-lg",
                              a.grad,
                            )}
                          >
                            {a.glyph}
                          </div>
                          <p className="mt-1 text-[8.5px] text-white/70">{a.label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-center gap-1.5 pt-1">
                      <span className="h-1.5 w-4 rounded-full bg-white/80" />
                      <span className="h-1.5 w-1.5 rounded-full bg-white/30" />
                    </div>
                    <p className="text-center text-[8.5px] text-white/45">صفحه ۱ از ۲ — برای صفحه بعد به چپ بکشید</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="order-1 space-y-4 lg:order-2">
            {[
              {
                t: "ویجت‌های زنده روی صفحه اصلی",
                d: "قیمت طلا، داوجونز، دلار آزاد تهران و شمارش معکوس خبر پراثر، بدون باز کردن اپ.",
                icon: "🪙",
              },
              {
                t: "مرکز اعلان‌ها با ساعت شمسی",
                d: "تغییر جهت بازار، شکست سطح‌ها و وضعیت سامانه در یک پنل شیشه‌ای.",
                icon: "🔔",
              },
              {
                t: "مرکز کنترل معامله‌گر",
                d: "توقف/ادامه پایش، حالت صوتی هشدارها و حالت فشرده برای صفحه‌های کوچک.",
                icon: "⚙️",
              },
              {
                t: "نصب بدون فروشگاه اپ",
                d: "کافیست صفحه را به صفحه اصلی گوشی اضافه کنید؛ بدون حجم اضافه و همیشه بروز.",
                icon: "📲",
              },
            ].map((f, i) => (
              <Reveal key={f.t} delay={i * 70}>
                <Card className="flex items-start gap-4 p-5">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 text-[18px]">
                    {f.icon}
                  </span>
                  <div>
                    <h4 className="text-[14px] font-bold text-white">{f.t}</h4>
                    <p className="mt-1 text-[12.5px] leading-6 text-slate-400">{f.d}</p>
                  </div>
                </Card>
              </Reveal>
            ))}

            <Reveal delay={300}>
              <Card className="p-5">
                <h4 className="text-[14px] font-bold text-white">راهنمای حرکات</h4>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {GESTURES.map((g) => (
                    <div key={g.t} className="rounded-2xl border border-white/6 bg-ink-900/60 p-3">
                      <p className="text-[12.5px] font-bold text-slate-100">
                        {g.icon} {g.t}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-slate-400">{g.d}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <a
                    href="#markets"
                    className="rounded-xl bg-gradient-to-l from-gold-500 to-gold-300 px-4 py-2.5 text-[12.5px] font-bold text-ink-950 transition hover:brightness-110"
                  >
                    افزودن به صفحه اصلی
                  </a>
                  <span className="num text-[11px] text-slate-500">
                    {fa(INSTRUMENTS.length)} نماد · {fmtInt(48)} ویجت آماده
                  </span>
                </div>
              </Card>
            </Reveal>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Widget({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/6 p-3 backdrop-blur">
      <p className="truncate text-[9.5px] text-slate-300">{title}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
