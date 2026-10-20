import { useMemo, useState } from "react";
import { cn } from "@/utils/cn";
import { useMarket } from "@/lib/MarketContext";
import {
  GROUP_LABELS,
  INSTRUMENTS,
  TIMEFRAMES,
  genCandles,
  type Candle,
  type Group,
  type TimeframeId,
} from "@/lib/market";
import { fa, fmtPrice, fmtShortDate, fmtTime } from "@/lib/format";
import { Card, Container, Delta, Reveal, SectionHeading, Sparkline } from "./ui";

const FILTERS: ("all" | Group)[] = ["all", "metal", "index", "fx", "energy", "crypto", "iran"];

const W = 900;
const H = 340;
const PAD_R = 8;
const PAD_T = 16;
const PAD_B = 46;

export default function Markets() {
  const { quotes } = useMarket();
  const [selectedId, setSelectedId] = useState("xauusd");
  const [tfId, setTfId] = useState<TimeframeId>("h1");
  const [filter, setFilter] = useState<"all" | Group>("all");
  const [hover, setHover] = useState<number | null>(null);

  const ins = INSTRUMENTS.find((i) => i.id === selectedId)!;
  const quote = quotes[selectedId];
  const tf = TIMEFRAMES.find((t) => t.id === tfId)!;

  const baseCandles: Candle[] = useMemo(
    () => genCandles(ins.seed + tf.seed, tf.bars, ins.base, ins.vol * 26, tf.minutes * 60_000),
    [ins, tf],
  );

  // candles stay stable while the live price only reshapes the last bar
  const candles: Candle[] = useMemo(() => {
    const arr = baseCandles.slice();
    const i = arr.length - 1;
    const prevClose = arr[i - 1].c;
    const p = quote.price;
    arr[i] = {
      ...arr[i],
      c: p,
      h: Math.max(arr[i].h, p, prevClose),
      l: Math.min(arr[i].l, p, prevClose),
      v: 0.75,
    };
    return arr;
  }, [baseCandles, quote.price]);

  const shown = hover !== null ? candles[hover] : candles[candles.length - 1];
  const last = candles[candles.length - 1];
  const high = Math.max(...candles.map((c) => c.h));
  const low = Math.min(...candles.map((c) => c.l));

  const min = low - (high - low) * 0.08;
  const max = high + (high - low) * 0.08;
  const yOf = (v: number) => PAD_T + (1 - (v - min) / (max - min)) * (H - PAD_T - PAD_B);
  const slot = (W - PAD_R) / candles.length;
  const bodyW = Math.max(2.5, slot * 0.55);

  const up = shown.c >= shown.o;
  const gridLines = 5;

  const visible = INSTRUMENTS.filter((i) => filter === "all" || i.group === filter);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width; // oldest on the left, newest on the right
    const idx = Math.round(ratio * (candles.length - 1));
    setHover(Math.min(candles.length - 1, Math.max(0, idx)));
  };

  return (
    <section id="markets" className="relative py-20">
      <Container>
        <Reveal>
          <SectionHeading
            eyebrow="بازار زنده"
            title={<>چارت، قیمت و نوسان — در یک نگاه</>}
            desc="نماد مورد نظر خود را انتخاب کنید، تایم‌فریم را عوض کنید و روی چارت حرکت کنید تا جزئیات هر کندل را ببینید. داده‌ها به‌صورت شبیه‌سازی‌شده و لحظه‌ای بروزرسانی می‌شوند."
          />
        </Reveal>

        <div className="mt-10 grid gap-5 lg:grid-cols-[300px_1fr]">
          <Reveal className="order-2 lg:order-1">
            <Card className="p-4">
              <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "shrink-0 rounded-xl px-2.5 py-1.5 text-[11.5px] font-semibold transition",
                      filter === f
                        ? "bg-gold-400/15 text-gold-200 ring-1 ring-gold-400/30"
                        : "bg-white/5 text-slate-400 hover:text-slate-200",
                    )}
                  >
                    {f === "all" ? "همه" : GROUP_LABELS[f]}
                  </button>
                ))}
              </div>

              <div className="max-h-[430px] space-y-1.5 overflow-y-auto pl-1">
                {visible.map((i) => {
                  const q = quotes[i.id];
                  const active = i.id === selectedId;
                  return (
                    <button
                      key={i.id}
                      onClick={() => {
                        setSelectedId(i.id);
                        setHover(null);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl border p-2.5 text-right transition",
                        active
                          ? "border-gold-400/35 bg-gold-400/8"
                          : "border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/4",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-[13px] font-bold", active ? "text-gold-200" : "text-slate-100")}>
                          {i.fa}
                        </p>
                        <p dir="ltr" className="num text-[10.5px] text-slate-500">
                          {i.symbol}
                        </p>
                      </div>
                      <div className="w-16 shrink-0">
                        <Sparkline data={q.history.map((p) => p.v)} up={q.changePct >= 0} className="h-8" strokeWidth={1.6} />
                      </div>
                      <div className="shrink-0 text-left">
                        <p className="num text-[12.5px] font-bold text-white">{fmtPrice(q.price, i.decimals)}</p>
                        <Delta value={q.changePct} showArrow={false} className="mt-0.5 px-1 text-[10.5px]" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={90} className="order-1 lg:order-2">
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 p-5">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-bold text-white">{ins.fa}</h3>
                      <span dir="ltr" className="num rounded-md bg-white/6 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {ins.symbol}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-end gap-3">
                      <span className="num text-3xl font-extrabold text-white">{fmtPrice(quote.price, ins.decimals)}</span>
                      <span className="pb-1 text-[11px] text-slate-500">{ins.unit}</span>
                      <Delta value={quote.changePct} className="mb-1" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 rounded-2xl border border-white/8 bg-ink-900/60 p-1">
                  {TIMEFRAMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setTfId(t.id)}
                      className={cn(
                        "rounded-xl px-3 py-1.5 text-[12px] font-semibold transition",
                        tfId === t.id ? "bg-gold-400/15 text-gold-200" : "text-slate-400 hover:text-slate-200",
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                className="relative px-2 pt-2"
                onMouseMove={onMove}
                onMouseLeave={() => setHover(null)}
                onMouseEnter={() => setHover(null)}
              >
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[300px] w-full sm:h-[360px]">
                  {Array.from({ length: gridLines }).map((_, i) => {
                    const v = min + ((max - min) * i) / (gridLines - 1);
                    const y = yOf(v);
                    return (
                      <g key={i}>
                        <line x1={0} x2={W} y1={y} y2={y} stroke="rgba(255,255,255,0.055)" strokeWidth={1} />
                        <text x={4} y={y - 5} fill="rgba(226,232,240,0.45)" fontSize={11} textAnchor="start">
                          {fmtPrice(v, ins.decimals)}
                        </text>
                      </g>
                    );
                  })}

                  {candles.map((c, i) => {
                    const x = PAD_R + (i + 0.5) * slot;
                    const isUp = c.c >= c.o;
                    const color = isUp ? "#16b877" : "#e6404b";
                    const top = yOf(Math.max(c.o, c.c));
                    const bottom = yOf(Math.min(c.o, c.c));
                    return (
                      <g key={i} opacity={hover === null || hover === i ? 1 : 0.55}>
                        <line x1={x} x2={x} y1={yOf(c.h)} y2={yOf(c.l)} stroke={color} strokeWidth={1.2} />
                        <rect
                          x={x - bodyW / 2}
                          y={top}
                          width={bodyW}
                          height={Math.max(1.4, bottom - top)}
                          fill={color}
                          opacity={isUp ? 0.95 : 0.9}
                          rx={1}
                        />
                        <rect
                          x={x - bodyW / 2}
                          y={H - 26 - c.v * 18}
                          width={bodyW}
                          height={c.v * 18}
                          fill={color}
                          opacity={0.35}
                          rx={1}
                        />
                      </g>
                    );
                  })}

                  <line
                    x1={0}
                    x2={W}
                    y1={yOf(last.c)}
                    y2={yOf(last.c)}
                    stroke="#e8bc5c"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    opacity={0.75}
                  />
                  <rect x={W - 78} y={yOf(last.c) - 10} width={78} height={20} rx={5} fill="#e8bc5c" />
                  <text x={W - 70} y={yOf(last.c) + 4} fontSize={11.5} fontWeight="700" fill="#04060b">
                    {fmtPrice(last.c, ins.decimals)}
                  </text>

                  {hover !== null && (
                    <line
                      x1={PAD_R + (hover + 0.5) * slot}
                      x2={PAD_R + (hover + 0.5) * slot}
                      y1={PAD_T}
                      y2={H - 26}
                      stroke="rgba(255,255,255,0.28)"
                      strokeWidth={1}
                      strokeDasharray="3 4"
                    />
                  )}
                </svg>

                <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-xl border border-white/10 bg-ink-950/85 px-3 py-2 text-[11px] backdrop-blur">
                  <div className="num grid grid-cols-2 gap-x-4 gap-y-1">
                    <span className="text-slate-500">زمان</span>
                    <span className="text-slate-200">{fmtTime(shown.t)}</span>
                    <span className="text-slate-500">باز</span>
                    <span className="text-slate-200">{fmtPrice(shown.o, ins.decimals)}</span>
                    <span className="text-slate-500">بالا</span>
                    <span className="text-bull-400">{fmtPrice(shown.h, ins.decimals)}</span>
                    <span className="text-slate-500">پایین</span>
                    <span className="text-bear-400">{fmtPrice(shown.l, ins.decimals)}</span>
                    <span className="text-slate-500">بسته</span>
                    <span className={up ? "text-bull-400" : "text-bear-400"}>{fmtPrice(shown.c, ins.decimals)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-px border-t border-white/8 bg-white/5 sm:grid-cols-4">
                <Stat label="بیشترین تایم‌فریم" value={fmtPrice(high, ins.decimals)} />
                <Stat label="کمترین تایم‌فریم" value={fmtPrice(low, ins.decimals)} />
                <Stat label="کندل‌ها" value={`${fa(candles.length)} کندل`} />
                <Stat label="آخرین بروزرسانی" value={fmtTime(quote.history[quote.history.length - 1].t)} />
              </div>
            </Card>

            <p className="mt-3 text-center text-[11px] text-slate-500">
              بازه نمایش: {tf.label} · تاریخ آخرین کندل: {fmtShortDate(last.t)} · برای مشاهده جزئیات، نشانگر را روی چارت
              حرکت دهید
            </p>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-ink-900/70 px-4 py-3">
      <p className="text-[10.5px] text-slate-500">{label}</p>
      <p className="num mt-0.5 text-[13px] font-bold text-slate-100">{value}</p>
    </div>
  );
}
