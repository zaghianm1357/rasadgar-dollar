/**
 * موتور اسکلپ — پورت منطق اندیکاتور Pine «SBW + OB xATR + 4H Setup + Div»
 * (فایل ارسالی کاربر: SBW_OB_4H_Setup_Div_v6.pine) به TypeScript خالص.
 *
 * اجزا (با مقادیر پیش‌فرض خود اندیکاتور):
 *  ۱) سوئینگ‌ها (پیوت ۵ کندلی) و موج شکست (Swing Break Wave) نرمال‌شده با ATR
 *  ۲) اوردر بلاک‌ها با فیلتر FVG (جابه‌جایی پرقدرت) و قاعده Mitigation با Close
 *  ۳) ستاپ ۴ساعته: برخورد به سقف/کف کندل بسته‌شدهٔ ۴ساعته → شکست ساختار (پیوت ۳ کندلی)
 *     → بازگشت به ناحیهٔ شکست (Retest) → تأیید الگوی کندلی (انگالف یا دوجی+کی‌بار)
 *  ۴) واگرایی چندابزاری (RSI/MACD/Stoch/CCI/MFI — توافق حداقل ۳ از ۵)
 *
 * خروجی: سیگنال‌ها + وضعیت ستاپ + سطوح مهم — فقط اطلاع‌رسانی محاسبه‌شده از داده،
 * نه سیگنال قطعی و نه توصیه معاملاتی.
 */

export interface ScalpBar {
  t: number; // ثانیهٔ یونیکس
  o: number;
  h: number;
  l: number;
  c: number;
}

/* ---------- پارامترها (مطابق ورودی‌های پیش‌فرض اندیکاتور) ---------- */
const SWING_LEN = 5; // Pivot Length (Left/Right) برای سوئینگ/موج
const PIVOT_LEN = 3; // طول پیوت ۱دقیقه‌ای → پیوت تایم‌فریم ورود برای شکست ساختار
const RETR_PCT = 23; // درصد اصلاح پایان موج
const ATR_LEN = 14;
const OB_LOOK = 20; // جستجوی کندل OB
const OB_FVG_REQ = true; // الزام FVG پس از OB
const OB_MAX_ZONES = 12; // حداکثر زون در هر سمت
const DOJI_BODY_PCT = 10; // حداکثر بدنهٔ دوجی (٪ دامنه)
const KEYBAR_BODY_PCT = 70; // حداقل بدنهٔ کی‌بار (٪ دامنه)
const KEYBAR_ATR_MULT = 1; // حداقل بدنهٔ کی‌بار برابر ATR
const H4_SEC = 4 * 3600;
/** سیگنال تا این تعداد کندلِ بسته‌شدهٔ آخر «تازه» محسوب می‌شود */
export const SCALP_FRESH_BARS = 3;

export interface ScalpZone {
  side: "supply" | "demand";
  top: number;
  bot: number;
  live: boolean;
  createdIdx: number;
  tappedIdx: number | null;
  fadedIdx: number | null;
}

export interface ScalpSignal {
  side: "buy" | "sell";
  kind: "setup4h" | "ob-tap";
  idx: number;
  t: number;
  price: number;
  zoneLo: number;
  zoneHi: number;
  obConfluence: boolean;
  patternFa: string;
}

export interface ScalpDivergence {
  recentBull: boolean;
  recentBear: boolean;
  lastSide: "bull" | "bear" | null;
  lastVotes: number | null;
  lastHidden: boolean;
  lastBarsAgo: number | null;
  noteFa: string;
}

export interface ScalpLevel {
  label: string;
  value: number;
  kind: "resistance" | "support" | "zone";
  zoneLo?: number;
  zoneHi?: number;
}

export interface ScalpSuggestion {
  side: "buy" | "sell";
  entryLo: number;
  entryHi: number;
  sl: number;
  tp1: number;
  tp2: number;
  kind: "setup4h" | "ob-tap";
  reasonFa: string;
  signalBarsAgo: number;
}

export interface ScalpResult {
  ok: true;
  bars: number;
  lastClose: number;
  lastT: number;
  atr: number | null;
  atrPct: number | null;
  /** سقف/کف آخرین کندل بسته‌شدهٔ ۴ساعته */
  h4High: number | null;
  h4Low: number | null;
  swingHigh: number | null;
  swingLow: number | null;
  swingHighBroken: boolean;
  swingLowBroken: boolean;
  /** وضعیت ستاپ ۴ساعته */
  setup: {
    sell: "armed" | "retest" | "idle";
    buy: "armed" | "retest" | "idle";
    sellZone: { lo: number; hi: number } | null;
    buyZone: { lo: number; hi: number } | null;
    /** true = دادهٔ ۴ساعته کافی نبود و ستاپ محاسبه نشد */
    unavailable: boolean;
  };
  wave: {
    active: "bear" | "bull" | null;
    nAtr: number | null;
    retrLevel: number | null;
  };
  supplyZones: ScalpZone[]; // زون‌های فروش زنده (نزدیک‌ترین اول)
  demandZones: ScalpZone[];
  signals: ScalpSignal[]; // زمان‌مرتب — آخرین در انتها
  divergence: ScalpDivergence;
  suggestion: ScalpSuggestion | null;
  /** کیفیت بدنهٔ کندل‌ها پایین است (open=close) — خروجی‌های مبتنی بر بدنه نامعتبرند */
  degraded: boolean;
  notesFa: string[];
}

/* ---------- ابزارهای پایه ---------- */

function atrSeries(bars: ScalpBar[], len: number): number[] {
  const out: number[] = new Array(bars.length).fill(NaN);
  if (bars.length < len + 1) return out;
  const trs: number[] = [bars[0].h - bars[0].l];
  for (let i = 1; i < bars.length; i++) {
    trs.push(
      Math.max(
        bars[i].h - bars[i].l,
        Math.abs(bars[i].h - bars[i - 1].c),
        Math.abs(bars[i].l - bars[i - 1].c),
      ),
    );
  }
  let a = 0;
  for (let i = 0; i < len; i++) a += trs[i];
  out[len] = a / len;
  for (let i = len + 1; i < bars.length; i++) {
    a = (a * (len - 1) + trs[i]) / len;
    out[i] = a;
  }
  return out;
}

function rma(values: number[], len: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  let sum = 0;
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    if (i < len) {
      sum += values[i];
      if (i === len - 1) {
        prev = sum / len;
        out[i] = prev;
      }
    } else {
      prev = (prev * (len - 1) + values[i]) / len;
      out[i] = prev;
    }
  }
  return out;
}

function rsiSeries(c: number[], len = 14): number[] {
  const ch: number[] = [0];
  for (let i = 1; i < c.length; i++) ch.push(c[i] - c[i - 1]);
  const gains = ch.map((d) => (d > 0 ? d : 0));
  const losses = ch.map((d) => (d < 0 ? -d : 0));
  const ag = rma(gains, len);
  const al = rma(losses, len);
  const out: number[] = c.map(() => NaN);
  for (let i = 0; i < c.length; i++) {
    if (isNaN(ag[i]) || isNaN(al[i])) continue;
    out[i] = al[i] === 0 ? (ag[i] === 0 ? 50 : 100) : 100 - 100 / (1 + ag[i] / al[i]);
  }
  return out;
}

function macdHistSeries(c: number[], fast = 12, slow = 26, sig = 9): number[] {
  const ema = (len: number): number[] => {
    const k = 2 / (len + 1);
    const out: number[] = [];
    let e = c[0];
    for (let i = 0; i < c.length; i++) {
      e = i === 0 ? c[0] : c[i] * k + e * (1 - k);
      out.push(e);
    }
    return out;
  };
  const f = ema(fast);
  const s = ema(slow);
  const line = f.map((v, i) => v - s[i]);
  const k = 2 / (sig + 1);
  let se = line[0];
  return line.map((v, i) => {
    se = i === 0 ? v : v * k + se * (1 - k);
    return v - se;
  });
}

function stochSeries(bars: ScalpBar[], len = 14): number[] {
  const out: number[] = bars.map(() => NaN);
  for (let i = len - 1; i < bars.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - len + 1; j <= i; j++) {
      if (bars[j].h > hh) hh = bars[j].h;
      if (bars[j].l < ll) ll = bars[j].l;
    }
    out[i] = hh === ll ? 50 : ((bars[i].c - ll) / (hh - ll)) * 100;
  }
  return out;
}

function cciSeries(bars: ScalpBar[], len = 20): number[] {
  const tp = bars.map((b) => (b.h + b.l + b.c) / 3);
  const out: number[] = bars.map(() => NaN);
  for (let i = len - 1; i < bars.length; i++) {
    let mean = 0;
    for (let j = i - len + 1; j <= i; j++) mean += tp[j];
    mean /= len;
    let dev = 0;
    for (let j = i - len + 1; j <= i; j++) dev += Math.abs(tp[j] - mean);
    dev /= len;
    out[i] = dev === 0 ? 0 : (tp[i] - mean) / (0.015 * dev);
  }
  return out;
}

function mfiSeries(bars: ScalpBar[], len = 14): number[] {
  const tp = bars.map((b) => (b.h + b.l + b.c) / 3);
  const out: number[] = bars.map(() => NaN);
  for (let i = len; i < bars.length; i++) {
    let pos = 0;
    let neg = 0;
    for (let j = i - len + 1; j <= i; j++) {
      const flow = tp[j] * bars[j].c;
      if (tp[j] > tp[j - 1]) pos += flow;
      else if (tp[j] < tp[j - 1]) neg += flow;
    }
    out[i] = neg === 0 ? 100 : pos === 0 ? 0 : 100 - 100 / (1 + pos / neg);
  }
  return out;
}

interface Pivot {
  idx: number; // اندیس کندل پیوت
  price: number;
}

/** پیوت‌های تأییدشده — پیوت در کندل idx وقتی تأیید می‌شود که idx+right پردازش شود */
function pivots(highs: number[], lows: number[], left: number, right: number) {
  const highsP: Pivot[] = [];
  const lowsP: Pivot[] = [];
  for (let i = left; i < highs.length - right; i++) {
    let isH = true;
    let isL = true;
    for (let k = 1; k <= left; k++) {
      if (highs[i - k] >= highs[i]) isH = false;
      if (lows[i - k] <= lows[i]) isL = false;
    }
    for (let k = 1; k <= right; k++) {
      if (highs[i + k] >= highs[i]) isH = false;
      if (lows[i + k] <= lows[i]) isL = false;
    }
    if (isH) highsP.push({ idx: i, price: highs[i] });
    if (isL) lowsP.push({ idx: i, price: lows[i] });
  }
  return { highsP, lowsP };
}

function rp(v: number): number {
  if (!isFinite(v)) return 0;
  if (v >= 1000) return Math.round(v * 100) / 100;
  if (v >= 10) return Math.round(v * 100) / 100;
  return Math.round(v * 100000) / 100000;
}

/* ---------- موتور اصلی ---------- */

export function runScalpEngine(
  bars: ScalpBar[],
  h4bars: ScalpBar[] | null,
  tfLabel = "",
): ScalpResult {
  const notesFa: string[] = [];
  const n = bars.length;
  const high = bars.map((b) => b.h);
  const low = bars.map((b) => b.l);
  const close = bars.map((b) => b.c);
  const open = bars.map((b) => b.o);
  const atr = atrSeries(bars, ATR_LEN);

  /* --- ۴ساعته: نگاشت bucket → سقف/کف کندلِ بسته‌شدهٔ قبلی --- */
  const h4Map = new Map<number, { h: number; l: number }>();
  if (h4bars && h4bars.length >= 2) {
    for (const b of h4bars) {
      const k = Math.floor(b.t / H4_SEC);
      const ex = h4Map.get(k);
      if (!ex) h4Map.set(k, { h: b.h, l: b.l });
      else {
        ex.h = Math.max(ex.h, b.h);
        ex.l = Math.min(ex.l, b.l);
      }
    }
  }
  const h4Ready = h4Map.size >= 2;
  if (!h4Ready) notesFa.push("دادهٔ کندل‌های ۴ساعته کافی نبود؛ ستاپ ۴ساعته محاسبه نشد و فقط موج/OB/واگرایی فعال‌اند.");

  /* --- پیوت‌ها برای واگرایی و شکست ساختار --- */
  const { highsP: divPivotHighs, lowsP: divPivotLows } = pivots(high, low, 5, 5);
  const { highsP: stPivotHighs, lowsP: stPivotLows } = pivots(high, low, PIVOT_LEN, PIVOT_LEN);
  let stLowPtr = 0;
  let stHighPtr = 0;
  let lastPivotLow: number | null = null;
  let lastPivotHigh: number | null = null;

  /* --- وضعیت سوئینگ/موج --- */
  let swingHigh: number | null = null;
  let swingLow: number | null = null;
  let hiBroken = false;
  let loBroken = false;
  let swPtr = 0;
  let slPtr = 0;

  interface WaveState {
    active: boolean;
    brkLvl: number;
    atrAtBrk: number;
    extreme: number;
    startIdx: number;
  }
  let bear: WaveState | null = null;
  let bull: WaveState | null = null;

  /* --- زون‌های OB --- */
  const supply: ScalpZone[] = [];
  const demand: ScalpZone[] = [];
  const overlap = (arr: ScalpZone[], t: number, b: number) =>
    arr.some((z) => z.live && z.top > b && t > z.bot);

  /* --- ستاپ ۴ساعته --- */
  let curBucket: number | null = null;
  let sellArmed = false;
  let buyArmed = false;
  let sellWaiting = false;
  let buyWaiting = false;
  let sellZone: { lo: number; hi: number } | null = null;
  let buyZone: { lo: number; hi: number } | null = null;
  let h4HighNow: number | null = null;
  let h4LowNow: number | null = null;

  /* --- واگرایی: سری‌های ابزارها --- */
  const rsi = rsiSeries(close, 14);
  const macdH = macdHistSeries(close);
  const stoch = stochSeries(bars, 14);
  const cci = cciSeries(bars, 20);
  const mfi = mfiSeries(bars, 14);

  const signals: ScalpSignal[] = [];
  let lastDiv: { side: "bull" | "bear"; votes: number; hidden: boolean; idx: number } | null = null;
  let lastBullDivIdx: number | null = null;
  let lastBearDivIdx: number | null = null;

  const oscVotesAt = (idx: number, prevIdx: number, dir: "bull" | "bear" | "hiddenBull" | "hiddenBear") => {
    const pairs: [number, number][] = [
      [rsi[idx], rsi[prevIdx]],
      [macdH[idx], macdH[prevIdx]],
      [stoch[idx], stoch[prevIdx]],
      [cci[idx], cci[prevIdx]],
      [mfi[idx], mfi[prevIdx]],
    ];
    let votes = 0;
    for (const [a, b] of pairs) {
      if (isNaN(a) || isNaN(b)) continue;
      if ((dir === "bull" && a > b) || (dir === "bear" && a < b) || (dir === "hiddenBull" && a < b) || (dir === "hiddenBear" && a > b)) votes++;
    }
    return votes;
  };

  /* ================= حلقهٔ اصلی کندل‌ها ================= */
  for (let i = 0; i < n; i++) {
    const bar = bars[i];
    const atrVal = atr[i];

    /* --- ۱) پیوت‌های سوئینگ (تأیید SWING_LEN کندل بعد) --- */
    while (swPtr < divPivotHighs.length && divPivotHighs[swPtr].idx + SWING_LEN <= i) {
      swingHigh = divPivotHighs[swPtr].price;
      hiBroken = false;
      swPtr++;
    }
    while (slPtr < divPivotLows.length && divPivotLows[slPtr].idx + SWING_LEN <= i) {
      swingLow = divPivotLows[slPtr].price;
      loBroken = false;
      slPtr++;
    }

    /* --- ۲) پیوت‌های شکست ساختار (PIVOT_LEN) --- */
    while (stHighPtr < stPivotHighs.length && stPivotHighs[stHighPtr].idx + PIVOT_LEN <= i) {
      lastPivotHigh = stPivotHighs[stHighPtr].price;
      stHighPtr++;
    }
    while (stLowPtr < stPivotLows.length && stPivotLows[stLowPtr].idx + PIVOT_LEN <= i) {
      lastPivotLow = stPivotLows[stLowPtr].price;
      stLowPtr++;
    }

    /* --- ۳) نگهداری زون‌های OB (لمس/تخفیف) — قبل از منطق شکست، مثل ترتیب Pine --- */
    let tapSellZone: ScalpZone | null = null;
    let tapBuyZone: ScalpZone | null = null;
    for (const z of supply) {
      if (!z.live) continue;
      const wickIn = bar.h >= z.bot;
      if (z.tappedIdx === null && wickIn) {
        z.tappedIdx = i;
        tapSellZone = z;
      }
      const mit = close[i] >= z.bot; // obMitRule = Close — مطابق Pine: بسته‌شدن بالای کفِ زون فروش
      if (mit) {
        z.live = false;
        z.fadedIdx = i;
      }
    }
    for (const z of demand) {
      if (!z.live) continue;
      const wickIn = bar.l <= z.top;
      if (z.tappedIdx === null && wickIn) {
        z.tappedIdx = i;
        tapBuyZone = z;
      }
      const mit = close[i] <= z.top; // بسته‌شدن زیر سقفِ زون خرید
      if (mit) {
        z.live = false;
        z.fadedIdx = i;
      }
    }
    if (tapSellZone)
      signals.push({ side: "sell", kind: "ob-tap", idx: i, t: bar.t, price: bar.c, zoneLo: tapSellZone.bot, zoneHi: tapSellZone.top, obConfluence: true, patternFa: "برخورد اول قیمت به زون فروش (OB)" });
    if (tapBuyZone)
      signals.push({ side: "buy", kind: "ob-tap", idx: i, t: bar.t, price: bar.c, zoneLo: tapBuyZone.bot, zoneHi: tapBuyZone.top, obConfluence: true, patternFa: "برخورد اول قیمت به زون خرید (OB)" });

    /* --- ۴) ماشین حالت موج شکست --- */
    let loBreakAny = false;
    let hiBreakAny = false;
    if (swingLow !== null && !isNaN(atrVal) && atrVal > 0) {
      if (loBroken && close[i] > swingLow) loBroken = false;
      if (close[i] < swingLow) {
        if (!loBroken) {
          loBreakAny = true;
          if (!bear) bear = { active: true, brkLvl: swingLow, atrAtBrk: atrVal, extreme: bar.l, startIdx: i };
        }
        loBroken = true;
      }
    }
    if (swingHigh !== null && !isNaN(atrVal) && atrVal > 0) {
      if (hiBroken && close[i] < swingHigh) hiBroken = false;
      if (close[i] > swingHigh) {
        if (!hiBroken) {
          hiBreakAny = true;
          if (!bull) bull = { active: true, brkLvl: swingHigh, atrAtBrk: atrVal, extreme: bar.h, startIdx: i };
        }
        hiBroken = true;
      }
    }
    if (bear && bear.active) {
      if (bar.l < bear.extreme) bear.extreme = bar.l;
      if (i > bear.startIdx) {
        const rng = bear.brkLvl - bear.extreme;
        const retr = bear.extreme + rng * (RETR_PCT / 100);
        if (close[i] > retr) bear = null; // موج نزولی پایان یافت
      }
    }
    if (bull && bull.active) {
      if (bar.h > bull.extreme) bull.extreme = bar.h;
      if (i > bull.startIdx) {
        const rng = bull.extreme - bull.brkLvl;
        const retr = bull.extreme - rng * (RETR_PCT / 100);
        if (close[i] < retr) bull = null;
      }
    }

    /* --- ۵) ساخت OB روی شکست تازهٔ سوئینگ --- */
    if (loBreakAny) {
      let oB: number | null = null;
      for (let k = 1; k <= OB_LOOK && i - k >= 0; k++) {
        if (close[i - k] > open[i - k]) {
          oB = k;
          break;
        }
      }
      if (oB !== null) {
        const zt = high[i - oB];
        const zb = low[i - oB];
        let fvg = !OB_FVG_REQ;
        if (OB_FVG_REQ && oB >= 2) {
          for (let a = 0; a <= oB - 2; a++) {
            if (low[i - a - 2] > high[i - a]) {
              fvg = true;
              break;
            }
          }
        }
        let left = false;
        let preMit = false;
        for (let k2 = oB - 1; k2 >= 0; k2--) {
          if (!left) {
            if (close[i - k2] < zb) left = true;
          } else if (close[i - k2] >= zb) {
            preMit = true;
            break;
          }
        }
        if (fvg && left && !preMit && !overlap(supply, zt, zb)) {
          supply.push({ side: "supply", top: zt, bot: zb, live: true, createdIdx: i, tappedIdx: null, fadedIdx: null });
          if (supply.length > OB_MAX_ZONES) supply.shift();
        }
      }
    }
    if (hiBreakAny) {
      let oU: number | null = null;
      for (let k = 1; k <= OB_LOOK && i - k >= 0; k++) {
        if (close[i - k] < open[i - k]) {
          oU = k;
          break;
        }
      }
      if (oU !== null) {
        const zt = high[i - oU];
        const zb = low[i - oU];
        let fvg = !OB_FVG_REQ;
        if (OB_FVG_REQ && oU >= 2) {
          for (let a = 0; a <= oU - 2; a++) {
            if (high[i - a - 2] < low[i - a]) {
              fvg = true;
              break;
            }
          }
        }
        let left = false;
        let preMit = false;
        for (let k2 = oU - 1; k2 >= 0; k2--) {
          if (!left) {
            if (close[i - k2] > zt) left = true;
          } else if (close[i - k2] <= zt) {
            preMit = true;
            break;
          }
        }
        if (fvg && left && !preMit && !overlap(demand, zt, zb)) {
          demand.push({ side: "demand", top: zt, bot: zb, live: true, createdIdx: i, tappedIdx: null, fadedIdx: null });
          if (demand.length > OB_MAX_ZONES) demand.shift();
        }
      }
    }

    /* --- ۶) ستاپ ۴ساعته: برخورد ← شکست ← ریتست ← الگو --- */
    const ocBuy = demand.some((z) => z.live && bar.l <= z.top && bar.h >= z.bot);
    const ocSell = supply.some((z) => z.live && bar.l <= z.top && bar.h >= z.bot);

    if (h4Ready) {
      const bucket = Math.floor(bar.t / H4_SEC);
      if (curBucket === null) curBucket = bucket;
      if (bucket !== curBucket) {
        // کندل ۴ساعتهٔ جدید → ریست وضعیت (مطابق new4h در Pine)
        curBucket = bucket;
        sellArmed = false;
        buyArmed = false;
        sellWaiting = false;
        buyWaiting = false;
        sellZone = null;
        buyZone = null;
      }
      // آخرین کندل ۴ساعتهٔ «بسته‌شده» قبل از bucket فعلی
      for (let b = bucket - 1; b >= bucket - 12; b--) {
        const e = h4Map.get(b);
        if (e) {
          h4HighNow = e.h;
          h4LowNow = e.l;
          break;
        }
      }
      /* مطابق Pine: وضعیت «مسلح» پیش از کندل فعلی ملاک شکست است (sellWasArmed) */
      const sellWasArmed = sellArmed;
      const buyWasArmed = buyArmed;
      if (h4HighNow !== null && bar.h >= h4HighNow) {
        sellArmed = true;
        sellWaiting = false;
        sellZone = null;
      }
      if (h4LowNow !== null && bar.l <= h4LowNow) {
        buyArmed = true;
        buyWaiting = false;
        buyZone = null;
      }
      // شکست ساختار با Close زیر آخرین پیوت کف (پیش از ریتست)
      if (sellWasArmed && !sellWaiting && lastPivotLow !== null && close[i] < lastPivotLow) {
        sellZone = { lo: bar.l, hi: bar.h };
        sellWaiting = true;
        sellArmed = false;
      }
      if (buyWasArmed && !buyWaiting && lastPivotHigh !== null && close[i] > lastPivotHigh) {
        buyZone = { lo: bar.l, hi: bar.h };
        buyWaiting = true;
        buyArmed = false;
      }
    }

    /* --- ۷) الگوهای کندلی --- */
    const rng = bar.h - bar.l;
    const body = Math.abs(bar.c - bar.o);
    const prevBar = i > 0 ? bars[i - 1] : null;
    const isDojiPrev = prevBar
      ? prevBar.h - prevBar.l > 0 &&
        Math.abs(prevBar.c - prevBar.o) <= ((prevBar.h - prevBar.l) * DOJI_BODY_PCT) / 100
      : false;
    const bearEngulf = bar.c < bar.o && i > 0 && close[i - 1] > open[i - 1] && bar.o >= close[i - 1] && bar.c <= open[i - 1];
    const bullEngulf = bar.c > bar.o && i > 0 && close[i - 1] < open[i - 1] && bar.o <= close[i - 1] && bar.c >= open[i - 1];
    const isKeyBar = rng > 0 && body >= (rng * KEYBAR_BODY_PCT) / 100 && !isNaN(atrVal) && body >= atrVal * KEYBAR_ATR_MULT;
    const bullKey = isKeyBar && bar.c > bar.o;
    const bearKey = isKeyBar && bar.c < bar.o;
    const bullPattern = bullEngulf || (isDojiPrev && bullKey); // دوجیِ کندل قبل + کی‌بار فعلی (مطابق Pine)
    const bearPattern = bearEngulf || (isDojiPrev && bearKey);
    const bullPatternFa = bullEngulf ? "انگالف صعودی" : "دوجی + کی‌بار صعودی";
    const bearPatternFa = bearEngulf ? "انگالف نزولی" : "دوجی + کی‌بار نزولی";

    /* --- ۸) ریتست + سیگنال ۴ساعته --- */
    if (sellWaiting && sellZone && bar.l <= sellZone.hi && bar.h >= sellZone.lo) {
      if (bearPattern) {
        signals.push({ side: "sell", kind: "setup4h", idx: i, t: bar.t, price: bar.c, zoneLo: sellZone.lo, zoneHi: sellZone.hi, obConfluence: ocSell, patternFa: bearPatternFa + (ocSell ? " + هم‌پوشانی OB" : "") });
        sellWaiting = false;
      }
    }
    if (buyWaiting && buyZone && bar.l <= buyZone.hi && bar.h >= buyZone.lo) {
      if (bullPattern) {
        signals.push({ side: "buy", kind: "setup4h", idx: i, t: bar.t, price: bar.c, zoneLo: buyZone.lo, zoneHi: buyZone.hi, obConfluence: ocBuy, patternFa: bullPatternFa + (ocBuy ? " + هم‌پوشانی OB" : "") });
        buyWaiting = false;
      }
    }

    /* --- ۹) واگرایی (توافق ≥۳ از ۵ ابزار) --- */
    for (const p of divPivotHighs) {
      if (p.idx + 5 !== i) continue;
      const prev = [...divPivotHighs].reverse().find((q) => q.idx < p.idx);
      if (!prev) continue;
      const gap = p.idx - prev.idx;
      if (gap < 5 || gap > 60) continue;
      if (high[p.idx] > high[prev.idx]) {
        const votes = oscVotesAt(p.idx, prev.idx, "bear");
        if (votes >= 3) {
          lastDiv = { side: "bear", votes, hidden: false, idx: i };
          lastBearDivIdx = i;
        }
      } else {
        const votes = oscVotesAt(p.idx, prev.idx, "hiddenBear");
        if (votes >= 3) {
          lastDiv = { side: "bear", votes, hidden: true, idx: i };
          lastBearDivIdx = i;
        }
      }
    }
    for (const p of divPivotLows) {
      if (p.idx + 5 !== i) continue;
      const prev = [...divPivotLows].reverse().find((q) => q.idx < p.idx);
      if (!prev) continue;
      const gap = p.idx - prev.idx;
      if (gap < 5 || gap > 60) continue;
      if (low[p.idx] < low[prev.idx]) {
        const votes = oscVotesAt(p.idx, prev.idx, "bull");
        if (votes >= 3) {
          lastDiv = { side: "bull", votes, hidden: false, idx: i };
          lastBullDivIdx = i;
        }
      } else {
        const votes = oscVotesAt(p.idx, prev.idx, "hiddenBull");
        if (votes >= 3) {
          lastDiv = { side: "bull", votes, hidden: true, idx: i };
          lastBullDivIdx = i;
        }
      }
    }
  }

  /* ================= جمع‌بندی خروجی ================= */
  const last = bars[n - 1];
  const lastAtr = isNaN(atr[n - 1]) ? null : atr[n - 1];

  /* گیت کیفیت داده: کندل‌های بدون بدنه (open=close) → موتور OB/الگو/موج روی این داده معنا ندارد */
  const tail = bars.slice(-200);
  const bodyless = tail.filter((b) => b.o === b.c).length / tail.length;
  const degraded = bodyless > 0.6;
  if (degraded) {
    notesFa.push(
      `کیفیت داده: ${Math.round(bodyless * 100)}٪ از ۲۰۰ کندل اخیر این تایم‌فریم از منبع بدون بدنه‌اند (open=close) — زون‌های OB، الگوهای کندلی و موج روی این داده قابل محاسبه نیستند؛ تایم‌فریم بزرگ‌تر (۵ یا ۱۵ دقیقه) را انتخاب کنید.`,
    );
  }
  const lastDivIdx = lastDiv ? lastDiv.idx : null;
  const divRecent = lastDivIdx !== null && n - 1 - lastDivIdx <= 10;

  const liveSupply = supply.filter((z) => z.live && z.bot > last.c).sort((a, b) => a.bot - b.bot).slice(0, 3);
  const liveDemand = demand.filter((z) => z.live && z.top < last.c).sort((a, b) => b.top - a.top).slice(0, 3);

  let waveOut: ScalpResult["wave"] = { active: null, nAtr: null, retrLevel: null };
  if (bear && bear.active) {
    const rngB = bear.brkLvl - bear.extreme;
    waveOut = { active: "bear", nAtr: bear.atrAtBrk > 0 ? rngB / bear.atrAtBrk : null, retrLevel: bear.extreme + rngB * (RETR_PCT / 100) };
  } else if (bull && bull.active) {
    const rngU = bull.extreme - bull.brkLvl;
    waveOut = { active: "bull", nAtr: bull.atrAtBrk > 0 ? rngU / bull.atrAtBrk : null, retrLevel: bull.extreme - rngU * (RETR_PCT / 100) };
  }

  /* پیشنهاد حدودی بر اساس تازه‌ترین سیگنال */
  let suggestion: ScalpSuggestion | null = null;
  const fresh = signals.filter((s) => n - 1 - s.idx <= SCALP_FRESH_BARS);
  const latest = fresh.length ? fresh[fresh.length - 1] : null;
  if (latest && lastAtr && lastAtr > 0) {
    const mid = (latest.zoneLo + latest.zoneHi) / 2;
    const slBuf = 0.5 * lastAtr;
    const risk = latest.side === "buy" ? mid - (latest.zoneLo - slBuf) : latest.zoneHi + slBuf - mid;
    if (risk > 0) {
      const pickTp = (dir: 1 | -1, minDist: number): number => {
        // نزدیک‌ترین سطح مخالف حداقل به فاصلهٔ minDist
        const cands: number[] = [];
        if (dir === 1) {
          for (const z of liveSupply) cands.push(z.bot, z.top);
          if (swingHigh !== null) cands.push(swingHigh);
          if (h4HighNow !== null) cands.push(h4HighNow);
          const ok = cands.filter((v) => v >= mid + minDist).sort((a, b) => a - b);
          return ok.length ? ok[0] : mid + 2 * minDist;
        }
        for (const z of liveDemand) cands.push(z.bot, z.top);
        if (swingLow !== null) cands.push(swingLow);
        if (h4LowNow !== null) cands.push(h4LowNow);
        const ok = cands.filter((v) => v <= mid - minDist).sort((a, b) => b - a);
        return ok.length ? ok[0] : mid - 2 * minDist;
      };
      const tp1 = pickTp(latest.side === "buy" ? 1 : -1, risk);
      const tp2 = pickTp(latest.side === "buy" ? 1 : -1, 2 * risk);
      suggestion = {
        side: latest.side,
        entryLo: rp(latest.zoneLo),
        entryHi: rp(latest.zoneHi),
        sl: rp(latest.side === "buy" ? latest.zoneLo - slBuf : latest.zoneHi + slBuf),
        tp1: rp(tp1),
        tp2: rp(tp2),
        kind: latest.kind,
        reasonFa:
          (latest.kind === "setup4h"
            ? `ستاپ ۴ساعته (${latest.patternFa}${latest.obConfluence ? " + هم‌پوشانی OB" : ""})`
            : latest.patternFa) +
          ` — سطوح و اهداف حدودی‌اند (ATR۱۴ تایم‌فریم: ${rp(lastAtr)})`,
        signalBarsAgo: n - 1 - latest.idx,
      };
    }
  }

  let divNote = "واگرایی تازه‌ای در ۱۰ کندل اخیر ثبت نشده است.";
  if (lastDiv && divRecent) {
    const sideFa = lastDiv.side === "bull" ? "صعودی" : "نزولی";
    divNote = `واگرایی ${lastDiv.hidden ? "مخفی " : ""}${sideFa} با توافق ${lastDiv.votes}/۵ ابزار، ${n - 1 - lastDiv.idx} کندل پیش ثبت شده است.`;
  }

  return {
    ok: true,
    bars: n,
    lastClose: last.c,
    lastT: last.t,
    atr: lastAtr,
    atrPct: lastAtr ? (lastAtr / last.c) * 100 : null,
    h4High: h4HighNow,
    h4Low: h4LowNow,
    swingHigh,
    swingLow,
    swingHighBroken: hiBroken,
    swingLowBroken: loBroken,
    setup: {
      sell: sellWaiting ? "retest" : sellArmed ? "armed" : "idle",
      buy: buyWaiting ? "retest" : buyArmed ? "armed" : "idle",
      sellZone,
      buyZone,
      unavailable: !h4Ready,
    },
    wave: waveOut,
    supplyZones: liveSupply.map((z) => ({ ...z, top: rp(z.top), bot: rp(z.bot) })),
    demandZones: liveDemand.map((z) => ({ ...z, top: rp(z.top), bot: rp(z.bot) })),
    signals: signals.slice(-6),
    divergence: {
      recentBull: divRecent && lastDiv?.side === "bull",
      recentBear: divRecent && lastDiv?.side === "bear",
      lastSide: lastDiv ? lastDiv.side : null,
      lastVotes: lastDiv ? lastDiv.votes : null,
      lastHidden: lastDiv ? lastDiv.hidden : false,
      lastBarsAgo: lastDivIdx !== null ? n - 1 - lastDivIdx : null,
      noteFa: divNote,
    },
    suggestion,
    degraded,
    notesFa,
  };
}

/** برچسب فارسی وضعیت ستاپ برای کارت سیگنال */
export function setupStateFa(state: "armed" | "retest" | "idle", side: "buy" | "sell"): string {
  const sideFa = side === "buy" ? "خرید" : "فروش";
  if (state === "armed") return `ستاپ ${sideFa} مسلح شد — منتظر شکست ساختار`;
  if (state === "retest") return `شکست ثبت شد — در انتظار بازگشت به ناحیه و الگوی تأیید`;
  return "ستاپ فعالی در جریان نیست";
}
