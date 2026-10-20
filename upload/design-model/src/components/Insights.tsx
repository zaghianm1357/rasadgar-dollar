import { useMarket } from "@/lib/MarketContext";
import { GOLD_LEVELS, STRUCTURE } from "@/lib/market";
import { fa, fmtPrice } from "@/lib/format";
import { cn } from "@/utils/cn";
import { BiasChip, Card, Container, Reveal, SectionHeading } from "./ui";

const barColor = {
  bull: "bg-bull-500",
  bear: "bg-bear-500",
  flat: "bg-slate-500",
} as const;

export default function Insights() {
  const { quotes } = useMarket();
  const gold = quotes["xauusd"];
  const dow = quotes["dji"];
  const btc = quotes["btcusd"];

  const levels = GOLD_LEVELS.map((l) => ({
    ...l,
    distance: ((l.price - gold.price) / gold.price) * 100,
  }));

  const newsRisk = 78; // simulated risk score

  return (
    <section id="structure" className="relative border-y border-white/6 bg-ink-900/40 py-20">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <Container className="relative">
        <Reveal>
          <SectionHeading
            eyebrow="ساختار بازار"
            title={<>جهت واقعی بازار در هر تایم‌فریم</>}
            desc="ماتریس ساختار، روند غالب طلا و داوجونز را در چهار تایم‌فریم تحلیل می‌کند و قدرت آن را به‌صورت درصدی نشان می‌دهد. بروزرسانی خودکار هر ۱۵ دقیقه."
          />
        </Reveal>

        <div className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <Reveal>
            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[15px] font-bold text-white">ماتریس ساختار</h3>
                <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10.5px] text-slate-400">
                  بروزرسانی هر ۱۵ دقیقه
                </span>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-right">
                  <thead>
                    <tr className="text-[11.5px] text-slate-400">
                      <th className="pb-3 font-medium">تایم‌فریم</th>
                      <th className="pb-3 font-medium">طلا — XAUUSD</th>
                      <th className="pb-3 font-medium">قدرت</th>
                      <th className="pb-3 font-medium">داوجونز — DJI</th>
                      <th className="pb-3 font-medium">قدرت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {STRUCTURE.map((r) => (
                      <tr key={r.tf} className="border-t border-white/6">
                        <td className="py-3.5">
                          <span className="num rounded-lg bg-white/6 px-2 py-1 text-[12px] font-bold text-slate-200">
                            {r.tf}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <BiasChip bias={r.gold} />
                        </td>
                        <td className="w-28 py-3.5">
                          <StrengthBar value={r.goldStrength} bias={r.gold} />
                        </td>
                        <td className="py-3.5">
                          <BiasChip bias={r.dow} />
                        </td>
                        <td className="w-28 py-3.5">
                          <StrengthBar value={r.dowStrength} bias={r.dow} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <MiniStat label="همگرایی صعودی" value={`${fa(2)} تایم‌فریم`} tone="bull" />
                <MiniStat label="واگرایی هشدار" value={`${fa(1)} تایم‌فریم`} tone="bear" />
                <MiniStat label="فاصله تا مقاومت کلیدی" value={`${fa(Math.abs(((GOLD_LEVELS[2].price - gold.price) / gold.price) * 100).toFixed(2))}٪`} tone="gold" />
              </div>

              <p className="mt-4 text-[11.5px] leading-6 text-slate-500">
                جزئیات کامل و پایش لحظه‌ای تمام نمادها در اپ «ساختار بازار» بیگ تردر موجود است.
              </p>
            </Card>
          </Reveal>

          <Reveal delay={100}>
            <Card className="p-5 sm:p-6">
              <h3 className="text-[15px] font-bold text-white">سطح‌های کلیدی طلا</h3>
              <p className="mt-1 text-[11.5px] text-slate-500">
                قیمت جاری: <span className="num text-slate-300">{fmtPrice(gold.price, 2)}</span> دلار
              </p>

              <div className="mt-4 space-y-2">
                {levels.map((l) => {
                  const near = Math.abs(l.distance) < 0.5;
                  return (
                    <div
                      key={l.label}
                      className={cn(
                        "flex items-center justify-between rounded-xl border px-3 py-2.5",
                        near
                          ? "border-gold-400/35 bg-gold-400/8"
                          : l.kind === "res"
                            ? "border-bear-500/18 bg-bear-500/6"
                            : "border-bull-500/18 bg-bull-500/6",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            l.kind === "res" ? "bg-bear-400" : "bg-bull-400",
                          )}
                        />
                        <span className="text-[12px] text-slate-300">{l.label}</span>
                        {near && (
                          <span className="rounded-md bg-gold-400/15 px-1.5 py-0.5 text-[9.5px] font-bold text-gold-200">
                            نزدیک قیمت
                          </span>
                        )}
                      </div>
                      <div className="text-left">
                        <p className="num text-[12.5px] font-bold text-white">{fmtPrice(l.price, 2)}</p>
                        <p className={cn("num text-[10px]", l.distance >= 0 ? "text-bull-400/80" : "text-bear-400/80")}>
                          {l.distance >= 0 ? "+" : "−"}
                          {fa(Math.abs(l.distance).toFixed(2))}٪
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-white/8 bg-ink-900/60 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[13px] font-bold text-white">ریسک خبری امروز</h4>
                  <span className="num text-[12px] font-bold text-bear-400">{fa(newsRisk)} از ۱۰۰</span>
                </div>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-bull-500 via-gold-400 to-bear-500"
                    style={{ width: `${newsRisk}%` }}
                  />
                </div>
                <div className="num mt-2 flex justify-between text-[10px] text-slate-500">
                  <span>آرام</span>
                  <span>متوسط</span>
                  <span>پرتلاطم</span>
                </div>
                <p className="mt-3 text-[11.5px] leading-6 text-slate-400">
                  دو رویداد پراثر در ۶ ساعت آینده تقویم قرار دارد؛ توصیه می‌شود حجم موقعیت‌ها را تا انتشار داده‌ها کاهش
                  دهید.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <CorrTile label="طلا" pct={gold.changePct} />
                <CorrTile label="داوجونز" pct={dow.changePct} />
                <CorrTile label="بیت‌کوین" pct={btc.changePct} />
              </div>
            </Card>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function StrengthBar({ value, bias }: { value: number; bias: "bull" | "bear" | "flat" }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
        <div className={cn("h-full rounded-full", barColor[bias])} style={{ width: `${value}%` }} />
      </div>
      <span className="num w-8 text-[10.5px] text-slate-500">{fa(value)}٪</span>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "bull" | "bear" | "gold" }) {
  const cls =
    tone === "bull" ? "text-bull-400 border-bull-500/20 bg-bull-500/8" : tone === "bear" ? "text-bear-400 border-bear-500/20 bg-bear-500/8" : "text-gold-300 border-gold-400/20 bg-gold-400/8";
  return (
    <div className={cn("rounded-2xl border p-3", cls)}>
      <p className="text-[11px] opacity-80">{label}</p>
      <p className="num mt-1 text-[14px] font-bold">{value}</p>
    </div>
  );
}

function CorrTile({ label, pct }: { label: string; pct: number }) {
  return (
    <div className="rounded-xl border border-white/8 bg-ink-900/60 p-3 text-center">
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={cn("num mt-1 text-[13px] font-bold", pct >= 0 ? "text-bull-400" : "text-bear-400")}>
        {pct >= 0 ? "+" : "−"}
        {fa(Math.abs(pct).toFixed(2))}٪
      </p>
    </div>
  );
}
