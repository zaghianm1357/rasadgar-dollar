/**
 * دماسنج فشار خرید/فروش — موتور اجماع ۱۶ اندیکاتور و اسیلاتور
 * ------------------------------------------------------------------
 * ایده کاربر: به‌جای جداول رگرسیون و آمار پیچیده، فقط «یک نتیجه»
 * نشان داده شود: فشار خرید، فشار فروش یا خنثی — بر اساس رأی
 * ۱۶ اندیکاتور/اسیلاتور کلاسیک مومنتوم و جریان سفارش.
 *
 * اصول طراحی:
 *  - هر اندیکاتور خروجی خود را به امتیاز استاندارد ‎−۱…+۱‎ تبدیل می‌کند
 *  - اندیکاتورهای واحد قیمتی با ATR نرمال می‌شوند (مستقل از نماد و تایم‌فریم)
 *  - اندیکاتورهای حجمی اگر حجم موجود نباشد شفاف کنار گذاشته می‌شوند
 *  - خروجی نهایی: عدد دماسنج ۰…۱۰۰ + ناحیه + جمله راهنمای ساده
 *  - هیچ فرمول و متغیری به معامله‌گر نشان داده نمی‌شود — فقط نتیجه
 */

import type { UCandle } from "@/lib/market-data";

export type PressureDir = "buy" | "sell" | "neutral";

export interface ThermometerIndicator {
  id: string;
  nameFa: string;
  /** ‎−۱…+۱‎ */
  score: number;
  dir: PressureDir;
  /** حجم‌محور — اگر نماد حجم نداشت محاسبه نمی‌شود */
  needsVolume: boolean;
}

export interface ThermometerOut {
  /** عدد دماسنج ۰…۱۰۰ (۵۰ = خنثی) */
  score: number;
  zone: "heavy-sell" | "sell" | "neutral" | "buy" | "heavy-buy";
  zoneFa: string;
  dir: PressureDir;
  consensus: {
    total: number;
    buy: number;
    sell: number;
    neutral: number;
    sentenceFa: string;
  };
  indicators: ThermometerIndicator[];
  /** جمله راهنمای ساده مسیر حرکت — بدون فرمول */
  guidanceFa: string;
  usedVolume: boolean;
  bars: number;
}

export const PRESSURE_DISCLAIMER_FA =
  "دماسنج فشار، احتمال‌سنج مومنتوم لحظه بازار است — نه پیش‌بینی قطعی و نه توصیه خرید/فروش.";

const DIR_THRESHOLD = 0.15; // آستانه رأی صعودی/نزولی هر اندیکاتور
const MIN_INDICATORS = 8; // کمتر از این = دماسنج قابل اعتماد نیست

function clamp(v: number, lo = -1, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}
function rnd(v: number, d = 3): number {
  return Math.round(v * 10 ** d) / 10 ** d;
}

/* ================= ابزارهای پایه سری‌ها ================= */

function sma(src: number[], p: number): (number | null)[] {
  const out: (number | null)[] = new Array(src.length).fill(null);
  let s = 0;
  for (let i = 0; i < src.length; i++) {
    s += src[i];
    if (i >= p) s -= src[i - p];
    if (i >= p - 1) out[i] = s / p;
  }
  return out;
}

function ema(src: number[], p: number): (number | null)[] {
  const out: (number | null)[] = new Array(src.length).fill(null);
  const k = 2 / (p + 1);
  let prev: number | null = null;
  for (let i = 0; i < src.length; i++) {
    if (i === p - 1) {
      let s = 0;
      for (let j = 0; j < p; j++) s += src[j];
      prev = s / p;
      out[i] = prev;
    } else if (prev !== null) {
      prev = src[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

/** True Range + ATR وایلدر */
function atrSeries(c: UCandle[], p = 14): (number | null)[] {
  const n = c.length;
  const tr: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) tr.push(c[i].h - c[i].l);
    else
      tr.push(
        Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c))
      );
  }
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < p + 1) return out;
  let a = 0;
  for (let i = 1; i <= p; i++) a += tr[i];
  a /= p;
  out[p] = a;
  for (let i = p + 1; i < n; i++) {
    a = (a * (p - 1) + tr[i]) / p;
    out[i] = a;
  }
  return out;
}

function rsiSeries(closes: number[], p = 14): (number | null)[] {
  const n = closes.length;
  const out: (number | null)[] = new Array(n).fill(null);
  if (n < p + 1) return out;
  let g = 0,
    l = 0;
  for (let i = 1; i <= p; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) g += d;
    else l -= d;
  }
  let ag = g / p,
    al = l / p;
  out[p] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = p + 1; i < n; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (p - 1) + Math.max(d, 0)) / p;
    al = (al * (p - 1) + Math.max(-d, 0)) / p;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}

function stochastic(c: UCandle[], p = 14, smooth = 3): (number | null)[] {
  const n = c.length;
  const raw: (number | null)[] = new Array(n).fill(null);
  for (let i = p - 1; i < n; i++) {
    let hh = -Infinity,
      ll = Infinity;
    for (let j = i - p + 1; j <= i; j++) {
      if (c[j].h > hh) hh = c[j].h;
      if (c[j].l < ll) ll = c[j].l;
    }
    raw[i] = hh === ll ? 50 : ((c[i].c - ll) / (hh - ll)) * 100;
  }
  const valid = raw.map((v) => v ?? 0);
  const mask = raw.map((v) => v !== null);
  const sm = sma(valid, smooth);
  return sm.map((v, i) => (mask[i] && v !== null ? v : null));
}

function macdHist(closes: number[]): { hist: (number | null)[] } {
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const macdLine = closes.map((_, i) =>
    e12[i] !== null && e26[i] !== null ? (e12[i] as number) - (e26[i] as number) : null
  );
  const valid = macdLine.map((v) => v ?? 0);
  const sig = ema(valid, 9);
  const hist = macdLine.map((v, i) =>
    v !== null && sig[i] !== null ? v - (sig[i] as number) : null
  );
  return { hist };
}

function dmi(c: UCandle[], p = 14): { pdi: number | null; mdi: number | null; adx: number | null } {
  const n = c.length;
  if (n < 2 * p + 2) return { pdi: null, mdi: null, adx: null };
  const trs: number[] = [];
  const pdms: number[] = [];
  const mdms: number[] = [];
  for (let i = 1; i < n; i++) {
    const up = c[i].h - c[i - 1].h;
    const dn = c[i - 1].l - c[i].l;
    pdms.push(up > dn && up > 0 ? up : 0);
    mdms.push(dn > up && dn > 0 ? dn : 0);
    trs.push(Math.max(c[i].h - c[i].l, Math.abs(c[i].h - c[i - 1].c), Math.abs(c[i].l - c[i - 1].c)));
  }
  let trS = 0,
    pS = 0,
    mS = 0;
  for (let i = 0; i < p; i++) {
    trS += trs[i];
    pS += pdms[i];
    mS += mdms[i];
  }
  const dxs: number[] = [];
  let pdi: number | null = null,
    mdi: number | null = null;
  for (let i = p; i < trs.length; i++) {
    trS = trS - trS / p + trs[i];
    pS = pS - pS / p + pdms[i];
    mS = mS - mS / p + mdms[i];
    const pd = trS > 0 ? (pS / trS) * 100 : 0;
    const md = trS > 0 ? (mS / trS) * 100 : 0;
    pdi = pd;
    mdi = md;
    dxs.push(pd + md > 0 ? (Math.abs(pd - md) / (pd + md)) * 100 : 0);
  }
  if (dxs.length < p) return { pdi, mdi, adx: null };
  let adx = 0;
  for (let i = dxs.length - p; i < dxs.length; i++) adx += dxs[i];
  return { pdi, mdi, adx: adx / p };
}

function aroon(c: UCandle[], p = 25): { up: number | null; down: number | null } {
  const n = c.length;
  if (n < p + 1) return { up: null, down: null };
  let hi = -Infinity,
    lo = Infinity,
    hiIdx = 0,
    loIdx = 0;
  for (let j = n - p; j <= n - 1; j++) {
    if (c[j].h >= hi) {
      hi = c[j].h;
      hiIdx = j;
    }
    if (c[j].l <= lo) {
      lo = c[j].l;
      loIdx = j;
    }
  }
  return { up: ((p - (n - 1 - hiIdx)) / p) * 100, down: ((p - (n - 1 - loIdx)) / p) * 100 };
}

function ultimateOsc(c: UCandle[]): number | null {
  const p1 = 7,
    p2 = 14,
    p3 = 28;
  const n = c.length;
  if (n < p3 + 1) return null;
  const bp: number[] = [];
  const tr: number[] = [];
  for (let i = 1; i < n; i++) {
    const tl = Math.min(c[i].l, c[i - 1].c);
    bp.push(c[i].c - tl);
    tr.push(Math.max(c[i].h, c[i - 1].c) - tl);
  }
  const avg = (len: number): number => {
    let b = 0,
      t = 0;
    for (let i = bp.length - len; i < bp.length; i++) {
      b += bp[i];
      t += tr[i];
    }
    return t > 0 ? b / t : 0;
  };
  const a1 = avg(p1),
    a2 = avg(p2),
    a3 = avg(p3);
  return ((4 * a1 + 2 * a2 + a3) / 7) * 100;
}

function tsi(closes: number[], long = 25, short = 13): number | null {
  const n = closes.length;
  if (n < long + short + 2) return null;
  const pc: number[] = [];
  for (let i = 1; i < n; i++) pc.push(closes[i] - closes[i - 1]);
  const e1 = ema(pc, long);
  const valid1 = e1.map((v) => v ?? 0);
  const e2 = ema(valid1, short);
  const absPc = pc.map(Math.abs);
  const ea1 = ema(absPc, long);
  const validA = ea1.map((v) => v ?? 0);
  const ea2 = ema(validA, short);
  const last = pc.length - 1;
  const num = e2[last],
    den = ea2[last];
  if (num === null || den === null || den === 0) return null;
  return (num / den) * 100;
}

/* ================= موتور اصلی ================= */

export function computeThermometer(candles: UCandle[]): ThermometerOut {
  const n = candles.length;
  const closes = candles.map((c) => c.c);
  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const last = n - 1;
  const atrLast = atrSeries(closes.length ? candles : [], 14)[last] ?? null;
  const atr = atrLast !== null && atrLast > 0 ? atrLast : Math.max(closes[last] * 0.005, 1e-9);
  const atrPct = (atr / closes[last]) * 100;

  const hasVol = candles.some((c) => c.v !== null && c.v > 0);
  const ind: ThermometerIndicator[] = [];
  const add = (id: string, nameFa: string, raw: number | null, needsVolume = false) => {
    if (raw === null || !isFinite(raw)) return;
    const s = clamp(raw);
    ind.push({
      id,
      nameFa,
      score: rnd(s),
      dir: s > DIR_THRESHOLD ? "buy" : s < -DIR_THRESHOLD ? "sell" : "neutral",
      needsVolume,
    });
  };

  /* ۱) RSI(14) */
  const rsi = rsiSeries(closes, 14)[last];
  add("rsi", "RSI", rsi === null ? null : (rsi - 50) / 50);

  /* ۲) استوکاستیک %K(14,3) */
  const stoch = stochastic(candles, 14, 3)[last];
  add("stoch", "استوکاستیک", stoch === null ? null : (stoch - 50) / 50);

  /* ۳) استوکاستیک RSI */
  const rsis = rsiSeries(closes, 14);
  {
    const rv = rsis.map((v) => v ?? 50);
    const mask = rsis.map((v) => v !== null);
    let sr: number | null = null;
    const p = 14;
    if (n >= 2 * p + 3) {
      let hh = -Infinity,
        ll = Infinity;
      for (let j = n - p; j < n; j++) {
        if (rv[j] > hh) hh = rv[j];
        if (rv[j] < ll) ll = rv[j];
      }
      sr = hh === ll ? 50 : ((rv[n - 1] - ll) / (hh - ll)) * 100;
      void mask;
    }
    add("stochrsi", "استوکاستیک RSI", sr === null ? null : (sr - 50) / 50);
  }

  /* ۴) CCI(20) */
  {
    const p = 20;
    let cci: number | null = null;
    if (n >= p) {
      const tp: number[] = [];
      for (let i = 0; i < n; i++) tp.push((candles[i].h + candles[i].l + candles[i].c) / 3);
      const smaTp = sma(tp, p);
      const m = smaTp[last];
      if (m !== null) {
        let md = 0;
        for (let j = n - p; j <= last; j++) md += Math.abs(tp[j] - (m as number));
        md /= p;
        cci = md > 0 ? (tp[last] - (m as number)) / (0.015 * md) : 0;
      }
    }
    add("cci", "CCI", cci === null ? null : cci / 150);
  }

  /* ۵) ویلیامز %R(14) */
  {
    let wr: number | null = null;
    if (n >= 14) {
      let hh = -Infinity,
        ll = Infinity;
      for (let j = n - 14; j <= last; j++) {
        if (highs[j] > hh) hh = highs[j];
        if (lows[j] < ll) ll = lows[j];
      }
      wr = hh === ll ? -50 : ((hh - closes[last]) / (hh - ll)) * 100;
    }
    add("willr", "ویلیامز %R", wr === null ? null : (wr + 50) / 50);
  }

  /* ۶) MFI(14) — حجم‌محور */
  if (hasVol) {
    const p = 14;
    let mfi: number | null = null;
    if (n >= p + 1) {
      let pos = 0,
        neg = 0;
      for (let j = n - p + 1; j <= last; j++) {
        const tp0 = (candles[j - 1].h + candles[j - 1].l + candles[j - 1].c) / 3;
        const tp1 = (candles[j].h + candles[j].l + candles[j].c) / 3;
        const v = candles[j].v ?? 0;
        if (tp1 > tp0) pos += tp1 * v;
        else if (tp1 < tp0) neg += tp1 * v;
      }
      mfi = pos + neg > 0 ? 100 - 100 / (1 + pos / neg) : 50;
    }
    add("mfi", "MFI جریان پول", mfi === null ? null : (mfi - 50) / 50, true);
  }

  /* ۷) هیستوگرام MACD — نرمال با ATR */
  {
    const { hist } = macdHist(closes);
    const h = hist[last];
    add("macd", "MACD", h === null ? null : h / (0.35 * atr));
  }

  /* ۸) شیب OBV(20) — حجم‌محور */
  if (hasVol) {
    let obvSlope: number | null = null;
    const p = Math.min(20, n - 1);
    if (n >= 25) {
      let obv = 0;
      const obvs: number[] = [];
      const vols: number[] = [];
      for (let i = 1; i < n; i++) {
        const v = candles[i].v ?? 0;
        obv += candles[i].c > candles[i - 1].c ? v : candles[i].c < candles[i - 1].c ? -v : 0;
        obvs.push(obv);
        vols.push(v);
      }
      const d = obvs[obvs.length - 1] - obvs[obvs.length - 1 - p];
      const vSum = vols.slice(-p).reduce((s, v) => s + v, 0);
      obvSlope = vSum > 0 ? d / vSum : null;
    }
    add("obv", "OBV حجم تعادلی", obvSlope === null ? null : clamp(obvSlope * 1.2), true);
  }

  /* ۹) DMI/ADX(14) — جهت وزن‌دار با قدرت روند */
  {
    const { pdi, mdi, adx } = dmi(candles, 14);
    let score: number | null = null;
    if (pdi !== null && mdi !== null && adx !== null && pdi + mdi > 0) {
      const dirW = (pdi - mdi) / (pdi + mdi);
      const strength = clamp(adx / 25, 0.3, 1);
      score = dirW * strength;
    }
    add("dmi", "DMI / ADX", score);
  }

  /* ۱۰) ROC(10) — نرمال با نوسان */
  {
    let roc: number | null = null;
    if (n >= 11) {
      const base = closes[n - 11];
      roc = base > 0 ? ((closes[last] - base) / base) * 100 : null;
    }
    add("roc", "ROC سرعت قیمت", roc === null || atrPct <= 0 ? null : roc / (3 * atrPct));
  }

  /* ۱۱) CMO(14) */
  {
    let cmo: number | null = null;
    if (n >= 15) {
      let g = 0,
        l = 0;
      for (let j = n - 14; j <= last; j++) {
        const d = closes[j] - closes[j - 1];
        if (d > 0) g += d;
        else l -= d;
      }
      cmo = g + l > 0 ? ((g - l) / (g + l)) * 100 : 0;
    }
    add("cmo", "CMO مومنتوم", cmo === null ? null : cmo / 100);
  }

  /* ۱۲) اسیلاتور فراگیر UO */
  add("uo", "اسیلاتور فراگیر", (() => {
    const uo = ultimateOsc(candles);
    return uo === null ? null : (uo - 50) / 50;
  })());

  /* ۱۳) Awesome Oscillator — نرمال با ATR */
  {
    let ao: number | null = null;
    if (n >= 34) {
      const med = candles.map((c) => (c.h + c.l) / 2);
      const s5 = sma(med, 5);
      const s34 = sma(med, 34);
      if (s5[last] !== null && s34[last] !== null) ao = (s5[last] as number) - (s34[last] as number);
    }
    add("ao", "اسیلاتور شگفت‌انگیز", ao === null ? null : ao / (0.5 * atr));
  }

  /* ۱۴) TSI(25,13) */
  add("tsi", "TSI واقعی", (() => {
    const t = tsi(closes);
    return t === null ? null : t / 40;
  })());

  /* ۱۵) موقعیت باندهای بولینگر %B(20,2) */
  {
    let pb: number | null = null;
    if (n >= 20) {
      const win = closes.slice(-20);
      const m = win.reduce((s, v) => s + v, 0) / 20;
      const sd = Math.sqrt(win.reduce((s, v) => s + (v - m) ** 2, 0) / 20);
      pb = sd > 0 ? ((closes[last] - (m - 2 * sd)) / (4 * sd)) * 100 : 50;
    }
    add("bb", "بولینگر %B", pb === null ? null : (pb - 50) / 50);
  }

  /* ۱۶) پشته EMA20/EMA50 + موقعیت قیمت */
  {
    const e20 = ema(closes, 20);
    const e50 = ema(closes, 50);
    const a = e20[last],
      b = e50[last];
    add(
      "ema",
      "میانگین‌های متحرک",
      a === null || b === null ? null : ((a - b) + (closes[last] - b)) / 2 / (0.5 * atr)
    );
  }

  /* ۱۷) آرون(25) */
  {
    const { up, down } = aroon(candles, 25);
    add("aroon", "آرون", up === null || down === null ? null : (up - down) / 100);
  }

  /* ۱۸) قدرت گاو/خرس الدر — نرمال با ATR */
  {
    const e13 = ema(closes, 13);
    const e = e13[last];
    add(
      "elder",
      "قدرت گاو/خرس",
      e === null ? null : ((highs[last] - e) + (lows[last] - e)) / 2 / (0.5 * atr)
    );
  }

  /* ---------- تجمیع رأی‌ها ---------- */
  const votes = ind.filter((i) => isFinite(i.score));
  const buy = votes.filter((i) => i.dir === "buy").length;
  const sell = votes.filter((i) => i.dir === "sell").length;
  const neutral = votes.length - buy - sell;
  const mean = votes.length ? votes.reduce((s, i) => s + i.score, 0) / votes.length : 0;
  const score = Math.round(clamp((mean + 1) / 2, 0, 1) * 100);

  const zone: ThermometerOut["zone"] =
    score >= 80 ? "heavy-buy" : score >= 60 ? "buy" : score > 40 ? "neutral" : score > 20 ? "sell" : "heavy-sell";
  const zoneFa =
    zone === "heavy-buy"
      ? "فشار خرید سنگین"
      : zone === "buy"
        ? "فشار خرید"
        : zone === "neutral"
          ? "خنثی / متعادل"
          : zone === "sell"
            ? "فشار فروش"
            : "فشار فروش سنگین";
  const dir: PressureDir = score >= 60 ? "buy" : score <= 40 ? "sell" : "neutral";

  const guidanceFa =
    zone === "heavy-buy"
      ? "بازار کاملاً در دست خریداران است — تعقیب قیمت در این ناحیه ریسک اصلاح تند دارد؛ منتظر پولبک بمانید."
      : zone === "buy"
        ? "مومنتوم خرید غالب است — مسیر کوتاه‌مدت به سمت بالا متمایل است؛ پولبک‌ها به حمایت جای پایش ورود هستند."
        : zone === "neutral"
          ? "فشار خرید و فروش تقریباً برابر است — جهت روشن نیست؛ معامله در میانه این ناحیه کم‌بازده و پرریسک است."
          : zone === "sell"
            ? "مومنتوم فروش غالب است — مسیر کوتاه‌مدت به سمت پایین متمایل است؛ برگشت‌ها به مقاومت جای پایش فروش هستند."
            : "بازار کاملاً در دست فروشندگان است — خرید ضدروند در این ناحیه پرریسک است؛ منتظر تثبیت بمانید.";

  const sentenceFa =
    votes.length === 0
      ? "هیچ اندیکاتوری قابل محاسبه نبود."
      : `از ${votes.length} اندیکاتور فعال: ${buy} اندیکاتور فشار خرید، ${sell} اندیکاتور فشار فروش و ${neutral} اندیکاتور خنثی`;

  return {
    score,
    zone,
    zoneFa,
    dir,
    consensus: { total: votes.length, buy, sell, neutral, sentenceFa },
    indicators: votes,
    guidanceFa,
    usedVolume: hasVol,
    bars: n,
  };
}

/** اعتمادپذیری: تعداد رأی کافی؟ */
export function thermometerReliable(t: ThermometerOut): boolean {
  return t.consensus.total >= MIN_INDICATORS;
}
