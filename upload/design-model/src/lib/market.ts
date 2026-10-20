import { dayKey } from "./format";

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-random helpers                                 */
/* ------------------------------------------------------------------ */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ */
/* Instruments                                                         */
/* ------------------------------------------------------------------ */

export type Group = "metal" | "index" | "energy" | "fx" | "crypto" | "iran";

export interface Instrument {
  id: string;
  symbol: string;
  fa: string;
  group: Group;
  base: number;
  decimals: number;
  unit: string;
  vol: number; // relative volatility per tick
  drift: number;
  seed: number;
}

export const GROUP_LABELS: Record<Group, string> = {
  metal: "فلزات گران‌بها",
  index: "شاخص‌های سهام",
  energy: "انرژی",
  fx: "جفت‌ارزها",
  crypto: "رمزارزها",
  iran: "بازار تهران",
};

export const INSTRUMENTS: Instrument[] = [
  { id: "xauusd", symbol: "XAUUSD", fa: "طلا (انس)", group: "metal", base: 4182.4, decimals: 2, unit: "دلار", vol: 0.00045, drift: 0.00004, seed: 11 },
  { id: "xagusd", symbol: "XAGUSD", fa: "نقره (انس)", group: "metal", base: 53.18, decimals: 2, unit: "دلار", vol: 0.0009, drift: 0.00006, seed: 23 },
  { id: "dji", symbol: "DJI", fa: "داوجونز", group: "index", base: 48632, decimals: 2, unit: "واحد", vol: 0.00028, drift: 0.00003, seed: 31 },
  { id: "spx", symbol: "SPX500", fa: "اس‌اند‌پی ۵۰۰", group: "index", base: 6418.7, decimals: 2, unit: "واحد", vol: 0.00026, drift: 0.00002, seed: 41 },
  { id: "ndx", symbol: "NAS100", fa: "نزدک ۱۰۰", group: "index", base: 24873, decimals: 2, unit: "واحد", vol: 0.00034, drift: 0.00004, seed: 53 },
  { id: "usoil", symbol: "USOIL", fa: "نفت وست تگزاس", group: "energy", base: 71.86, decimals: 2, unit: "دلار", vol: 0.0008, drift: -0.00005, seed: 61 },
  { id: "eurusd", symbol: "EURUSD", fa: "یورو / دلار", group: "fx", base: 1.0942, decimals: 4, unit: "دلار", vol: 0.0002, drift: 0.00001, seed: 71 },
  { id: "usdjpy", symbol: "USDJPY", fa: "دلار / ین ژاپن", group: "fx", base: 153.42, decimals: 2, unit: "ین", vol: 0.00025, drift: -0.00002, seed: 83 },
  { id: "btcusd", symbol: "BTCUSD", fa: "بیت‌کوین", group: "crypto", base: 98462, decimals: 0, unit: "دلار", vol: 0.0013, drift: 0.00008, seed: 97 },
  { id: "usdirt", symbol: "USD/IRT", fa: "دلار آزاد تهران", group: "iran", base: 128400, decimals: 0, unit: "تومان", vol: 0.0004, drift: 0.00012, seed: 103 },
];

/* ------------------------------------------------------------------ */
/* Series generation                                                   */
/* ------------------------------------------------------------------ */

export interface Point {
  t: number;
  v: number;
}

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export const TIMEFRAMES = [
  { id: "m15", label: "۱۵ دقیقه", minutes: 15, bars: 64, seed: 5 },
  { id: "h1", label: "۱ ساعت", minutes: 60, bars: 60, seed: 7 },
  { id: "h4", label: "۴ ساعت", minutes: 240, bars: 56, seed: 9 },
  { id: "d1", label: "روزانه", minutes: 1440, bars: 52, seed: 13 },
] as const;

export type TimeframeId = (typeof TIMEFRAMES)[number]["id"];

/** Random walk that is anchored to end on `end` value. */
export function genSeries(seed: number, n: number, end: number, vol: number, stepMs: number): Point[] {
  const rnd = mulberry32(seed);
  const raw: number[] = [0];
  for (let i = 1; i < n; i++) {
    const shock = (rnd() - 0.5) * 2 + Math.sin(i / 6) * 0.35;
    raw.push(raw[i - 1] + shock * vol * 3);
  }
  const last = raw[raw.length - 1] || 1;
  const now = Date.now();
  return raw.map((r, i) => ({
    t: now - (n - 1 - i) * stepMs,
    v: end * (1 + (r - last) * 0.9),
  }));
}

export function genCandles(seed: number, bars: number, end: number, vol: number, stepMs: number): Candle[] {
  const rnd = mulberry32(seed * 7919);
  const closes: number[] = [];
  let cur = 0;
  for (let i = 0; i < bars; i++) {
    cur += (rnd() - 0.48) * vol * 4 + Math.sin(i / 7) * vol * 0.8;
    closes.push(cur);
  }
  const last = closes[closes.length - 1] || 1;
  const now = Date.now();
  return closes.map((c, i) => {
    const price = end * (1 + (c - last) * 0.9);
    const prev = i === 0 ? price * (1 - vol) : closes[i - 1] === undefined ? price : end * (1 + (closes[i - 1] - last) * 0.9);
    const o = prev;
    const spread = Math.abs(price - o) + end * vol * (0.4 + rnd() * 1.4);
    const h = Math.max(o, price) + spread * 0.45;
    const l = Math.min(o, price) - spread * 0.45;
    return { t: now - (bars - 1 - i) * stepMs, o, h, l, c: price, v: 0.35 + rnd() };
  });
}

export function pctChange(series: Point[]): number {
  if (series.length < 2) return 0;
  const first = series[0].v;
  const last = series[series.length - 1].v;
  return ((last - first) / first) * 100;
}

/* ------------------------------------------------------------------ */
/* Economic calendar (ForexFactory style, Persian)                     */
/* ------------------------------------------------------------------ */

export type Impact = "high" | "medium" | "low";

export interface NewsEvent {
  id: string;
  ts: number;
  currency: string;
  flag: string;
  impact: Impact;
  title: string;
  actual?: string;
  forecast?: string;
  previous?: string;
}

const MIN = 60_000;

export const NEWS_EVENTS: NewsEvent[] = [
  { id: "e1", ts: Date.now() - 215 * MIN, currency: "USD", flag: "🇺🇸", impact: "medium", title: "شاخص مدیران خرید (PMI) بخش خدمات", actual: "۵۲٫۴", forecast: "۵۱٫۸", previous: "۵۱٫۲" },
  { id: "e2", ts: Date.now() - 152 * MIN, currency: "USD", flag: "🇺🇸", impact: "medium", title: "موجودی نفت خام آمریکا (EIA)", actual: "−۱٫۲ میلیون", forecast: "−۰٫۸ میلیون", previous: "+۲٫۱ میلیون" },
  { id: "e3", ts: Date.now() - 96 * MIN, currency: "EUR", flag: "🇪🇺", impact: "low", title: "شاخص اعتماد اقتصادی منطقه یورو", actual: "۹۵٫۱", forecast: "۹۵٫۶", previous: "۹۵٫۳" },
  { id: "e4", ts: Date.now() - 42 * MIN, currency: "USD", flag: "🇺🇸", impact: "high", title: "سخنرانی رئیس فدرال رزرو", actual: "برگزار شد", forecast: "—", previous: "—" },
  { id: "e5", ts: Date.now() + 17 * MIN, currency: "USD", flag: "🇺🇸", impact: "high", title: "تورم هسته‌ای PCE (سالانه)", forecast: "۲٫۶٪", previous: "۲٫۷٪" },
  { id: "e6", ts: Date.now() + 54 * MIN, currency: "USD", flag: "🇺🇸", impact: "medium", title: "سفارشات کارخانه‌ای (ماهانه)", forecast: "۰٫۴٪", previous: "۰٫۲٪" },
  { id: "e7", ts: Date.now() + 133 * MIN, currency: "CAD", flag: "🇨🇦", impact: "medium", title: "تغییرات اشتغال غیرکشاورزی", forecast: "۲۳٫۵ هزار", previous: "۱۹٫۱ هزار" },
  { id: "e8", ts: Date.now() + 246 * MIN, currency: "JPY", flag: "🇯🇵", impact: "high", title: "تصمیم نرخ بهره بانک ژاپن", forecast: "۰٫۵٪", previous: "۰٫۵٪" },
  { id: "e9", ts: Date.now() + 368 * MIN, currency: "USD", flag: "🇺🇸", impact: "medium", title: "ادعای بیمه بیکاری هفتگی", forecast: "۲۲۵ هزار", previous: "۲۱۸ هزار" },
  { id: "e10", ts: Date.now() + 470 * MIN, currency: "GBP", flag: "🇬🇧", impact: "low", title: "شاخص قیمت مسکن نشنال‌واید", forecast: "۰٫۲٪", previous: "۰٫۱٪" },
  { id: "e11", ts: Date.now() + 19 * 60 * MIN, currency: "CNY", flag: "🇨🇳", impact: "medium", title: "رشد صنعتی و خرده‌فروشی چین", forecast: "۵٫۴٪", previous: "۵٫۱٪" },
  { id: "e12", ts: Date.now() + 21 * 60 * MIN, currency: "USD", flag: "🇺🇸", impact: "high", title: "شاخص قیمت مصرف‌کننده (CPI) آمریکا", forecast: "۲٫۹٪", previous: "۳٫۰٪" },
  { id: "e13", ts: Date.now() + 27 * 60 * MIN, currency: "USD", flag: "🇺🇸", impact: "medium", title: "ذخایر طلا و ارز بانک‌های مرکزی", forecast: "—", previous: "+۶ تن" },
  { id: "e14", ts: Date.now() + 33 * 60 * MIN, currency: "EUR", flag: "🇪🇺", impact: "high", title: "تصمیم نرخ بهره بانک مرکزی اروپا", forecast: "۲٫۱۵٪", previous: "۲٫۱۵٪" },
];

export const IMPACT_LABEL: Record<Impact, string> = {
  high: "مهم",
  medium: "متوسط",
  low: "کم",
};

export function nextImportantEvent(now: number): NewsEvent | undefined {
  return NEWS_EVENTS.filter((e) => e.impact === "high" && e.ts > now).sort((a, b) => a.ts - b.ts)[0];
}

export function groupEventsByDay(events: NewsEvent[]): { key: string; ts: number; items: NewsEvent[] }[] {
  const map = new Map<string, { key: string; ts: number; items: NewsEvent[] }>();
  for (const e of events) {
    const k = dayKey(e.ts);
    if (!map.has(k)) map.set(k, { key: k, ts: e.ts, items: [] });
    map.get(k)!.items.push(e);
  }
  return [...map.values()].sort((a, b) => a.ts - b.ts);
}

/* ------------------------------------------------------------------ */
/* Market structure                                                    */
/* ------------------------------------------------------------------ */

export type Bias = "bull" | "bear" | "flat";

export interface StructureRow {
  tf: string;
  full: string;
  gold: Bias;
  goldStrength: number;
  dow: Bias;
  dowStrength: number;
}

export const STRUCTURE: StructureRow[] = [
  { tf: "۱۵د", full: "۱۵ دقیقه", gold: "bull", goldStrength: 72, dow: "flat", dowStrength: 48 },
  { tf: "۱س", full: "۱ ساعت", gold: "bull", goldStrength: 81, dow: "bear", dowStrength: 57 },
  { tf: "۴س", full: "۴ ساعت", gold: "bull", goldStrength: 66, dow: "flat", dowStrength: 51 },
  { tf: "روز", full: "روزانه", gold: "flat", goldStrength: 54, dow: "bull", dowStrength: 63 },
];

export const BIAS_LABEL: Record<Bias, string> = {
  bull: "صعودی",
  bear: "نزولی",
  flat: "خنثی",
};

export interface Level {
  label: string;
  price: number;
  kind: "res" | "sup";
}

export const GOLD_LEVELS: Level[] = [
  { label: "مقاومت سوم", price: 4268.0, kind: "res" },
  { label: "مقاومت دوم", price: 4231.5, kind: "res" },
  { label: "مقاومت کلیدی", price: 4204.8, kind: "res" },
  { label: "حمایت کلیدی", price: 4148.2, kind: "sup" },
  { label: "حمایت دوم", price: 4112.6, kind: "sup" },
  { label: "حمایت اصلی", price: 4076.0, kind: "sup" },
];

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export interface Notice {
  id: string;
  kind: "trend" | "news" | "system";
  title: string;
  body: string;
  ts: number;
}

export const NOTICES: Notice[] = [
  {
    id: "n1",
    kind: "trend",
    title: "تغییر جهت بازار",
    body: "ساختار طلا در تایم‌فریم ۱ ساعت به صعودی تغییر کرد؛ سقف قبلی ۴۱۷۶٫۴ شکسته شد.",
    ts: Date.now() - 12 * MIN,
  },
  {
    id: "n2",
    kind: "news",
    title: "خبر پراثر در ۱۵ دقیقه آینده",
    body: "تورم هسته‌ای PCE آمریکا منتشر می‌شود. انتظار نوسان بالا در طلا و داوجونز.",
    ts: Date.now() - 26 * MIN,
  },
  {
    id: "n3",
    kind: "system",
    title: "فید اخبار ForexFactory",
    body: "اتصال برقرار است. آخرین همگام‌سازی ۲۸ ثانیه پیش انجام شد.",
    ts: Date.now() - 48 * MIN,
  },
  {
    id: "n4",
    kind: "trend",
    title: "شکست سطح کلیدی",
    body: "دلار آزاد تهران از کانال صعودی خارج شد؛ هدف بعدی ۱۳۰٬۲۰۰ تومان.",
    ts: Date.now() - 96 * MIN,
  },
  {
    id: "n5",
    kind: "system",
    title: "ساختار بازار به‌روزرسانی شد",
    body: "ماتریس ۴ تایم‌فریمی برای طلا و داوجونز بازمحاسبه شد (هر ۱۵ دقیقه).",
    ts: Date.now() - 148 * MIN,
  },
];

/* ------------------------------------------------------------------ */
/* Smart summary variants                                              */
/* ------------------------------------------------------------------ */

export const SUMMARY_VARIANTS: { headline: string; bullets: string[] }[] = [
  {
    headline: "طلا در مسیر صعودی، شاخص‌ها محتاط",
    bullets: [
      "ساختار طلا در تایم‌فریم‌های ۱۵ دقیقه و ۱ ساعت صعودی است؛ نگه‌داشتن ناحیه ۴۱۴۸ دلار ادامه رشد تا ۴۲۰۵ را محتمل می‌کند.",
      "داوجونز در تایم‌فریم ۱ ساعت فشار فروش دارد، اما روند روزانه همچنان مثبت است؛ سناریوی اصلاح موقت برتری دارد.",
      "ریسک اصلی روز، انتشار تورم هسته‌ای PCE است؛ پیش از خبر، حجم موقعیت‌ها را کم کنید.",
    ],
  },
  {
    headline: "فشار دلاری کاهش یافته، فلزات گران‌بها تقویت می‌شوند",
    bullets: [
      "بازگشت قیمت به بالای میانگین متحرک ۵۰ ساعته، سیگنال تقاضای مجدد خریداران در طلاست.",
      "نقره با نوسان بالاتر از طلا حرکت می‌کند؛ مدیریت حد ضرر در این نماد ضروری‌تر است.",
      "تا پیش از خبر ساعت ۱۶:۱۷ تهران، احتمال ادامه نوسان رنج در شاخص‌های سهام بالاست.",
    ],
  },
  {
    headline: "روز پر از داده: اول خبر، بعد معامله",
    bullets: [
      "دو رویداد پراثر در ۶ ساعت آینده تقویم اقتصادی قرار دارد؛ بهترین استراتژی، معامله پس از تأیید جهت است.",
      "ماتریس ساختار بازار همگرایی صعودی در تایم‌فریم کوتاه و خنثی در تایم‌فریم روزانه نشان می‌دهد.",
      "طلا و بیت‌کوین هم‌زمان تقویت شده‌اند؛ این همبستگی معمولاً نشانه ورود پول حاشیه‌ای به دارایی‌های ریسکی است.",
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Simulated live quote model                                          */
/* ------------------------------------------------------------------ */

export interface Quote {
  id: string;
  price: number;
  open: number;
  changePct: number;
  change: number;
  history: Point[];
  tick: number;
}

export function initialQuotes(): Record<string, Quote> {
  const out: Record<string, Quote> = {};
  for (const ins of INSTRUMENTS) {
    const history = genSeries(ins.seed, 48, ins.base, ins.vol, 90_000);
    const open = history[0].v;
    out[ins.id] = {
      id: ins.id,
      price: ins.base,
      open,
      change: ins.base - open,
      changePct: ((ins.base - open) / open) * 100,
      history,
      tick: 0,
    };
  }
  return out;
}

export function stepQuotes(prev: Record<string, Quote>): Record<string, Quote> {
  const out: Record<string, Quote> = {};
  for (const ins of INSTRUMENTS) {
    const q = prev[ins.id];
    const shock = (Math.random() - 0.5) * 2 * ins.vol * q.price * 1.6 + ins.drift * q.price;
    const price = Math.max(q.price + shock, ins.base * 0.5);
    const history = [...q.history.slice(-95), { t: Date.now(), v: price }];
    out[q.id] = {
      ...q,
      price,
      change: price - q.open,
      changePct: ((price - q.open) / q.open) * 100,
      history,
      tick: q.tick + 1,
    };
  }
  return out;
}
