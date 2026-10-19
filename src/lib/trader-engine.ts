/**
 * موتور محاسباتی «دستیار معامله‌گر» (BIG TRADER)
 * توابع خالص و مستقل از فریم‌ورک — هم در API سرور و هم در رابط کاربری استفاده می‌شود.
 * همه خروجی‌ها اطلاع‌رسانی هستند و توصیه قطعی خرید/فروش محسوب نمی‌شوند.
 */

export type TrendDir = "bullish" | "bearish" | "neutral";
export type Verdict = "strong" | "moderate" | "no-trade";

/* ---------- آماری ---------- */

/** بازده لگاریتمی ساده بین مقادیر متوالی */
export function pctReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    if (a !== 0 && isFinite(a) && isFinite(closes[i])) out.push((closes[i] - a) / a);
  }
  return out;
}

/** ضریب همبستگی پیرسون بین دو سری هم‌طول */
export function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 20) return null;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < n; i++) {
    sa += a[i];
    sb += b[i];
  }
  const ma = sa / n;
  const mb = sb / n;
  let num = 0;
  let da = 0;
  let dbb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    dbb += y * y;
  }
  if (da === 0 || dbb === 0) return null;
  return num / Math.sqrt(da * dbb);
}

/** ATR درصدی (میانگین دامنه واقعی نسبت به قیمت) */
export function atrPct(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14
): number | null {
  const n = closes.length;
  if (n < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < n; i++) {
    trs.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      )
    );
  }
  let a = 0;
  for (let i = trs.length - period; i < trs.length; i++) a += trs[i];
  a /= period;
  return (a / closes[n - 1]) * 100;
}

/** نسبت کارایی (Efficiency Ratio) — معیار رونددار بودن بازار */
export function efficiencyRatio(closes: number[], window = 20): number | null {
  if (closes.length < window + 1) return null;
  const seg = closes.slice(-(window + 1));
  const net = Math.abs(seg[seg.length - 1] - seg[0]);
  let path = 0;
  for (let i = 1; i < seg.length; i++) path += Math.abs(seg[i] - seg[i - 1]);
  if (path === 0) return null;
  return net / path;
}

/* ---------- ویژگی ۱: موتور همگرایی پویا ---------- */

export interface FactorResult {
  score: number;
  label: string;
  detail: string;
}

/**
 * هم‌جهتی تایم‌فریم‌ها (وزن ۴۰)
 * سه تایم‌فریم ۱۵د/۱س/۴س: هر سه هم‌جهت = ۴۰ | دو هم‌جهت + یک خنثی = ۲۰ | تضاد = ۰
 */
export function tfAlignmentFactor(dirs: TrendDir[]): FactorResult {
  const valid = dirs.filter((d) => d !== "neutral");
  const bulls = valid.filter((d) => d === "bullish").length;
  const bears = valid.filter((d) => d === "bearish").length;
  const neutralCount = dirs.filter((d) => d === "neutral").length;
  if (valid.length === 3 && (bulls === 3 || bears === 3)) {
    return {
      score: 40,
      label: "هم‌جهت کامل",
      detail: "هر سه تایم‌فریم ۱۵ دقیقه، ۱ ساعته و ۴ ساعته هم‌جهت‌اند.",
    };
  }
  if (bulls === 0 || bears === 0) {
    return {
      score: 20,
      label: "هم‌جهت نسبی",
      detail: `دو تایم‌فریم هم‌جهت و ${neutralCount > 0 ? "یک تایم‌فریم خنثی" : "یک تایم‌فریم بی‌جهت"} است.`,
    };
  }
  return {
    score: 0,
    label: "تضاد تایم‌فریم‌ها",
    detail: "تایم‌فریم‌ها در تضادند — ساختار کوتاه‌مدت و میان‌مدت هم‌جهت نیستند.",
  };
}

/** خلأ خبری (وزن ۳۰) — فاصله تا نزدیک‌ترین خبر با اهمیت بالا */
export function newsGapFactor(minutesLeft: number | null): FactorResult {
  if (minutesLeft === null) {
    return { score: 30, label: "بدون خبر مهم", detail: "خبر High Impact در صف پیش‌رو نیست." };
  }
  if (minutesLeft < 120) {
    return {
      score: 0,
      label: "خبر نزدیک",
      detail: `خبر مهم تا کمتر از ۲ ساعت دیگر (${Math.round(minutesLeft)} دقیقه) منتشر می‌شود.`,
    };
  }
  if (minutesLeft <= 240) {
    return {
      score: 15,
      label: "خبر میان‌نزدیک",
      detail: `خبر مهم حدود ${Math.round(minutesLeft / 60)} ساعت بعد منتشر می‌شود.`,
    };
  }
  return {
    score: 30,
    label: "خلأ خبری",
    detail: `نزدیک‌ترین خبر مهم بیش از ۴ ساعت فاصله دارد (${Math.round(minutesLeft / 60)} ساعت).`,
  };
}

/**
 * همبستگی با DXY (وزن ۲۰)
 * برای طلا انتظار همبستگی معکوس داریم؛ برای سایر نمادها جهت انتظاری ثابت فرض نمی‌شود.
 */
export function dxyCorrelationFactor(r: number | null, expectInverse: boolean): FactorResult {
  if (r === null) {
    return { score: 0, label: "داده ناکافی", detail: "داده کافی برای محاسبه همبستگی با DXY موجود نیست." };
  }
  const rr = Math.round(r * 100) / 100;
  if (expectInverse) {
    if (r <= -0.6)
      return {
        score: 20,
        label: "معکوس سالم",
        detail: `همبستگی ۳۰ روزه با DXY برابر ${rr} است — رابطه معکوس معمول برقرار است.`,
      };
    if (r < 0.6)
      return {
        score: 10,
        label: "خنثی",
        detail: `همبستگی ۳۰ روزه با DXY برابر ${rr} است — رابطه ضعیف یا مبهم است.`,
      };
    return {
      score: 0,
      label: "واگرایی",
      detail: `همبستگی ۳۰ روزه با DXY برابر ${rr} است — رابطه معکوس معمول شکسته شده است.`,
    };
  }
  return Math.abs(r) >= 0.6
    ? { score: 20, label: "همبستگی مشخص", detail: `همبستگی ۳۰ روزه با DXY برابر ${rr} است.` }
    : { score: 10, label: "همبستگی ضعیف", detail: `همبستگی ۳۰ روزه با DXY برابر ${rr} است.` };
}

/** نوسان‌پذیری ATR (وزن ۱۰) — نوار سالم مخصوص هر نماد بر حسب درصد */
export function atrFactor(
  atrPctValue: number | null,
  healthyBand: [number, number]
): FactorResult {
  if (atrPctValue === null) {
    return { score: 5, label: "داده ناکافی", detail: "ATR محاسبه نشد." };
  }
  const v = Math.round(atrPctValue * 100) / 100;
  if (atrPctValue < healthyBand[0] * 0.5) {
    return {
      score: 5,
      label: "بازار رنج",
      detail: `ATR روزانه ${v}٪ است — نوسان بسیار کم و بازار راکد.`,
    };
  }
  if (atrPctValue > healthyBand[1] * 1.5) {
    return {
      score: 0,
      label: "نوسان افراطی",
      detail: `ATR روزانه ${v}٪ است — نوسان به‌شدت بالاتر از حالت معمول.`,
    };
  }
  if (atrPctValue < healthyBand[0]) {
    return { score: 5, label: "نوسان کم", detail: `ATR روزانه ${v}٪ است — نوسان پایین‌تر از نوار سالم.` };
  }
  if (atrPctValue > healthyBand[1]) {
    return {
      score: 5,
      label: "نوسان بالا",
      detail: `ATR روزانه ${v}٪ است — نوسان بالاتر از نوار سالم ولی افراطی نیست.`,
    };
  }
  return { score: 10, label: "نوسان سالم", detail: `ATR روزانه ${v}٪ است — داخل نوار سالم.` };
}

export interface ConfluenceResult {
  total: number;
  verdict: Verdict;
  factors: { tf: FactorResult; news: FactorResult; dxy: FactorResult; atr: FactorResult };
}

export function verdictOf(total: number): Verdict {
  return total >= 75 ? "strong" : total >= 50 ? "moderate" : "no-trade";
}

export function verdictLabelFa(v: Verdict): string {
  return v === "strong" ? "شرایط قوی" : v === "moderate" ? "شرایط متوسط" : "بدون معامله";
}

export function confluenceScore(factors: ConfluenceResult["factors"]): ConfluenceResult {
  const total = factors.tf.score + factors.news.score + factors.dxy.score + factors.atr.score;
  return { total, verdict: verdictOf(total), factors };
}

/* ---------- رژیم بازار ---------- */

export interface RegimeResult {
  type: "trending" | "range" | "volatile" | "illiquid" | "unknown";
  label: string;
  reason: string;
  er: number | null;
  atrPct: number | null;
}

export function classifyRegime(
  closes: number[],
  atrPctValue: number | null,
  healthyBand: [number, number]
): RegimeResult {
  const er = efficiencyRatio(closes);
  if (atrPctValue === null || er === null) {
    return {
      type: "unknown",
      label: "قابل‌تشخیص نیست",
      reason: "داده کافی برای دسته‌بندی رژیم بازار موجود نیست.",
      er,
      atrPct: atrPctValue,
    };
  }
  if (atrPctValue > healthyBand[1] * 1.5) {
    return {
      type: "volatile",
      label: "پرنوسان",
      reason: `ATR روزانه ${Math.round(atrPctValue * 100) / 100}٪ است — دامنه نوسان به‌شدت بزرگ‌تر از معمول؛ کنترل ریسک اولویت دارد.`,
      er,
      atrPct: atrPctValue,
    };
  }
  if (atrPctValue < healthyBand[0] * 0.5) {
    return {
      type: "illiquid",
      label: "کم‌نوسان/کم‌نقدشونده",
      reason: `ATR روزانه ${Math.round(atrPctValue * 100) / 100}٪ است — حرکت‌ها کوچک و بازار بی‌رمق است.`,
      er,
      atrPct: atrPctValue,
    };
  }
  if (er >= 0.35) {
    return {
      type: "trending",
      label: "رونددار",
      reason: `نسبت کارایی ${Math.round(er * 100)}٪ است — قیمت با مسیر نسبتاً یکنواخت حرکت می‌کند (تداوم روند).`,
      er,
      atrPct: atrPctValue,
    };
  }
  if (er <= 0.15) {
    return {
      type: "range",
      label: "رنج",
      reason: `نسبت کارایی ${Math.round(er * 100)}٪ است — قیمت رفت‌وبرگشتی است و سطوح افقی غالب‌اند.`,
      er,
      atrPct: atrPctValue,
    };
  }
  return {
    type: "range",
    label: "رنج با گرایش",
    reason: `نسبت کارایی ${Math.round(er * 100)}٪ است — بین رفت‌وبرگشت و روند؛ جهت‌گیری مشخص نیست.`,
    er,
    atrPct: atrPctValue,
  };
}

/* ---------- ویژگی ۳: تولیدکننده پلن معامله ---------- */

export interface PlanInput {
  side: "buy" | "sell";
  entry: number;
  balance: number;
  riskPct: number;
  rr: number; // ۲ یا ۳
  slMode: "swing" | "atr";
  swingLevel: number | null; // آخرین سوئینگ مناسب (کف برای خرید / سقف برای فروش)
  atr: number | null; // مقدار ATR (قیمت — نه درصد)
  atrMult: number;
  contractSize: number; // ارزش هر یک واحد حرکت قیمت به ازای هر ۱ لات استاندارد
  symbolLabel: string;
}

export interface PlanOutput {
  ok: boolean;
  error?: string;
  sl: number | null;
  tp: number | null;
  slDist: number | null;
  tpDist: number | null;
  riskAmount: number | null;
  lots: number | null;
  lossAtSL: number | null;
  profitAtTP: number | null;
  copyText: string;
  warnings: string[];
}

export function computeTradePlan(input: PlanInput): PlanOutput {
  const warnings: string[] = [];
  const base: PlanOutput = {
    ok: false,
    sl: null,
    tp: null,
    slDist: null,
    tpDist: null,
    riskAmount: null,
    lots: null,
    lossAtSL: null,
    profitAtTP: null,
    copyText: "",
    warnings,
  };
  const { side, entry, balance, riskPct, rr, slMode, swingLevel, atr, atrMult, contractSize } = input;
  if (!(entry > 0)) return { ...base, error: "قیمت ورود معتبر نیست." };
  if (!(balance > 0)) return { ...base, error: "موجودی حساب معتبر نیست." };
  if (!(riskPct > 0 && riskPct <= 10)) return { ...base, error: "درصد ریسک باید بین صفر و ۱۰ باشد." };
  if (contractSize <= 0)
    return { ...base, error: "اندازه قرارداد نامعتبر است — مشخصات کارگزاری را تأیید کنید." };

  let slDist: number | null = null;
  if (slMode === "swing") {
    if (swingLevel === null || !(swingLevel > 0)) {
      warnings.push("سطح سوئینگ در دسترس نیست — حد ضرر بر اساس ATR پیشنهاد شد.");
    } else {
      slDist = Math.abs(entry - swingLevel);
      if (slDist <= 0) warnings.push("سوئینگ با قیمت ورود برابر است — از حالت ATR استفاده کنید.");
    }
  }
  if (slDist === null) {
    if (atr === null || !(atr > 0)) return { ...base, error: "ATR در دسترس نیست — حد ضرر قابل محاسبه نیست." };
    slDist = atr * atrMult;
  }
  const riskAmount = (balance * riskPct) / 100;
  const lotsRaw = riskAmount / (slDist * contractSize);
  const lots = Math.max(0.01, Math.floor(lotsRaw * 100) / 100);
  const lossAtSL = lots * slDist * contractSize;
  const tpDist = slDist * rr;
  const sl = side === "buy" ? entry - slDist : entry + slDist;
  const tp = side === "buy" ? entry + tpDist : entry - tpDist;
  const profitAtTP = lossAtSL * rr;
  const copyText = `${side === "buy" ? "Buy" : "Sell"} ${input.symbolLabel} @ ${entry} | SL: ${
    Math.round(sl * 100) / 100
  } | TP: ${Math.round(tp * 100) / 100} | Lot: ${lots} (Risk ${riskPct}%)`;
  warnings.push("اندازه قرارداد و ارزش پیپ به کارگزاری بستگی دارد — پیش از استفاده تأیید کنید.");
  warnings.push("این محاسبه تضمین نتیجه یا توصیه معامله نیست.");
  return {
    ok: true,
    sl: Math.round(sl * 100) / 100,
    tp: Math.round(tp * 100) / 100,
    slDist: Math.round(slDist * 100) / 100,
    tpDist: Math.round(tpDist * 100) / 100,
    riskAmount: Math.round(riskAmount * 100) / 100,
    lots,
    lossAtSL: Math.round(lossAtSL * 100) / 100,
    profitAtTP: Math.round(profitAtTP * 100) / 100,
    copyText,
    warnings,
  };
}

/* ---------- ویژگی ۴: ردیاب واگرایی بین‌بازاری ---------- */

export interface DivergenceResult {
  level: "normal" | "weak" | "broken" | "unknown";
  color: "green" | "amber" | "red" | "gray";
  text: string;
  reason: string;
}

/**
 * مقایسه حرکت امروز نماد و DXY + وضعیت همبستگی ۳۰ روزه.
 * برای طلا: رابطه معمول «طلا صعود ↔ دلار نزول» است.
 * خروجی مشاهده است، نه اثبات علت.
 */
export function divergenceStatus(
  symChangePct: number | null,
  dxyChangePct: number | null,
  corr: number | null
): DivergenceResult {
  if (symChangePct === null || dxyChangePct === null) {
    return {
      level: "unknown",
      color: "gray",
      text: "داده لحظه‌ای کامل نیست",
      reason: "قیمت امروز نماد یا DXY در دسترس نیست — وضعیت واگرایی قابل ارزیابی نیست.",
    };
  }
  const s = symChangePct > 0.05 ? 1 : symChangePct < -0.05 ? -1 : 0;
  const d = dxyChangePct > 0.05 ? 1 : dxyChangePct < -0.05 ? -1 : 0;
  const corrTxt = corr === null ? "—" : Math.round(corr * 100) / 100;
  const brokenCorr = corr !== null && corr > 0.6;
  if (s !== 0 && d !== 0 && s === d) {
    return {
      level: brokenCorr ? "broken" : "weak",
      color: brokenCorr ? "red" : "amber",
      text: brokenCorr ? "هشدار: همبستگی شکسته شده!" : "همبستگی ضعیف: احتیاط کنید",
      reason: `نماد و DXY هم‌جهت حرکت کرده‌اند (نماد ${symChangePct > 0 ? "↑" : "↓"} و DXY ${
        dxyChangePct > 0 ? "↑" : "↓"
      } — همبستگی ۳۰ روزه: ${corrTxt}). این خلاف رابطه معمول است؛ احتمال حرکت فریبنده (Fake Breakout) بالاتر می‌رود.`,
    };
  }
  if (s !== 0 && d !== 0 && s !== d) {
    return {
      level: "normal",
      color: "green",
      text: `همبستگی نرمال: نماد ${symChangePct > 0 ? "↑" : "↓"} و DXY ${dxyChangePct > 0 ? "↑" : "↓"}`,
      reason: `رابطه معمول برقرار است (همبستگی ۳۰ روزه: ${corrTxt}) — حرکت‌ها با الگوی تاریخی هم‌خوان‌اند.`,
    };
  }
  return {
    level: "weak",
    color: "amber",
    text: "همبستگی ضعیف: احتیاط کنید",
    reason: `یکی از دو طرف حرکت معنادار ندارد (همبستگی ۳۰ روزه: ${corrTxt}) — سیگنال تأییدی از DXY دریافت نمی‌شود.`,
  };
}

/* ---------- ویژگی ۵: قواعد مربی رفتاری ---------- */

export const NUDGE_RULES = {
  refreshWindowMs: 5 * 60 * 1000,
  refreshMax: 10,
  revengeLockMs: 15 * 60 * 1000,
  maxLossesPerDay: 3,
} as const;

/** شمارش رفرش‌های پنجره ۵ دقیقه اخیر + پیام هشدار */
export function refreshNudge(timestamps: number[], now = Date.now()): { count: number; warn: boolean; message: string } {
  const recent = timestamps.filter((t) => now - t < NUDGE_RULES.refreshWindowMs);
  if (recent.length > NUDGE_RULES.refreshMax) {
    return {
      count: recent.length,
      warn: true,
      message: "بازار پرنوسان است، صبر کنید — بروزرسانی پیاپی تصمیم را بهتر نمی‌کند.",
    };
  }
  return { count: recent.length, warn: false, message: "" };
}

/** بررسی قفل Revenge Trading پس از ثبت ضرر */
export function revengeLock(lastLossAtISO: string | null, now = Date.now()): { locked: boolean; minutesLeft: number } {
  if (!lastLossAtISO) return { locked: false, minutesLeft: 0 };
  const t = new Date(lastLossAtISO).getTime();
  if (!isFinite(t)) return { locked: false, minutesLeft: 0 };
  const left = Math.ceil((t + NUDGE_RULES.revengeLockMs - now) / 60000);
  return left > 0 ? { locked: true, minutesLeft: left } : { locked: false, minutesLeft: 0 };
}

/** سه ضرر متوالی در یک روز → پیشنهاد استراحت */
export function restSuggestion(todayResults: ("win" | "loss" | "be")[]): { suggest: boolean; message: string } {
  const losses = todayResults.filter((r) => r === "loss").length;
  if (losses >= NUDGE_RULES.maxLossesPerDay) {
    return {
      suggest: true,
      message: "امروز ۳ معامله ضررده ثبت شده است — پیشنهاد می‌کنیم تا فردا استراحت کنید و بازار را فقط تماشا کنید.",
    };
  }
  return { suggest: false, message: "" };
}

/* ---------- ارزیابی کیفیت تصمیم (ژورنال) ---------- */

export interface JournalReview {
  followedPlan: boolean;
  riskRespected: boolean;
  slMovedBadly: boolean;
  assumptionViolated: boolean;
}

export function decisionQuality(
  r: JournalReview,
  result: "win" | "loss" | "be"
): { grade: "good" | "lucky" | "bad-execution" | "bad-process" | "neutral"; label: string; note: string } {
  if (r.followedPlan && r.riskRespected && result === "win")
    return { grade: "good", label: "تصمیم خوب + نتیجه مثبت", note: "فرآیند و نتیجه هر دو درست بودند — الگوی قابل تکرار." };
  if (r.followedPlan && r.riskRespected && result === "loss")
    return {
      grade: "neutral",
      label: "تصمیم سالم + نتیجه منفی",
      note: "ضرر بخش طبیعی معامله است؛ نتیجه یک معامله اثبات بدبودن روش نیست.",
    };
  if ((!r.followedPlan || !r.riskRespected) && result === "win")
    return {
      grade: "lucky",
      label: "نتیجه مثبت با فرآیند ناسالم",
      note: "این سود قابل اتکا نیست — احتمالاً شانس بوده؛ قانون‌شکنی جایزه نمی‌گیرد.",
    };
  if (!r.followedPlan || !r.riskRespected)
    return {
      grade: "bad-execution",
      label: "اجرای ناسالم",
      note: r.slMovedBadly
        ? "جابه‌جایی نامناسب حد ضرر یا خارج‌شدن از برنامه — اول اجرای برنامه را درست کنید."
        : "خارج از برنامه معامله شده است — ریسک یا برنامه رعایت نشد.",
    };
  if (r.assumptionViolated)
    return {
      grade: "neutral",
      label: "فرض اولیه نقض شد",
      note: "داده‌های بعدی فرض ورود را نقض کردند — بررسی کنید آیا شرط ابطال به‌موقع فعال شد.",
    };
  return { grade: "neutral", label: "نیازمند بررسی", note: "ترکیب نتیجه و اجرا نیاز به بررسی بیشتری دارد." };
}

/* ---------- تغییرات از آخرین بازدید ---------- */

export interface VisitSnapshot {
  atISO: string;
  trends: Record<string, string>; // کلید "xau:1h" → جهت
  score: number | null;
  divergence: string | null;
  highEventId: string | null;
  price: number | null;
}

export interface VisitChange {
  kind: "trend" | "score" | "divergence" | "event" | "price";
  text: string;
}

export function diffSinceLastVisit(prev: VisitSnapshot, cur: VisitSnapshot): VisitChange[] {
  const out: VisitChange[] = [];
  for (const key of Object.keys(cur.trends)) {
    const before = prev.trends?.[key];
    const after = cur.trends[key];
    if (before && after && before !== after) {
      const [sym, tf] = key.split(":");
      const symFa = sym === "xau" ? "طلا" : "داوجونز";
      const tfFa: Record<string, string> = {
        "15m": "۱۵ دقیقه",
        "1h": "۱ ساعته",
        "4h": "۴ ساعته",
        "1d": "روزانه",
      };
      const dirFa: Record<string, string> = { bullish: "صعودی", bearish: "نزولی", neutral: "خنثی" };
      out.push({
        kind: "trend",
        text: `جهت ساختار ${symFa} در تایم‌فریم ${tfFa[tf] ?? tf} از «${dirFa[before] ?? before}» به «${dirFa[after] ?? after}» تغییر کرد.`,
      });
    }
  }
  if (prev.score !== null && cur.score !== null && Math.abs(cur.score - prev.score) >= 10) {
    out.push({
      kind: "score",
      text: `امتیاز اطمینان از ${prev.score} به ${cur.score} تغییر کرد.`,
    });
  }
  if (prev.divergence && cur.divergence && prev.divergence !== cur.divergence) {
    out.push({
      kind: "divergence",
      text: `وضعیت همبستگی با DXY از «${prev.divergence}» به «${cur.divergence}» تغییر کرد.`,
    });
  }
  if (prev.highEventId && cur.highEventId && prev.highEventId !== cur.highEventId) {
    out.push({ kind: "event", text: "خبر مهم جدیدی به تقویم اضافه یا جایگزین خبر قبلی شد." });
  }
  if (prev.price !== null && cur.price !== null && prev.price > 0) {
    const pct = ((cur.price - prev.price) / prev.price) * 100;
    if (Math.abs(pct) >= 0.5) {
      out.push({
        kind: "price",
        text: `قیمت نماد نسبت به آخرین بازدید ${pct > 0 ? "+" : ""}${Math.round(pct * 100) / 100}٪ تغییر کرده است.`,
      });
    }
  }
  return out;
}

/* ---------- ویژگی ۲: سازنده سناریوهای خبری ---------- */

export interface ScenarioEventInput {
  titleFa: string | null;
  title: string;
  impact: string;
  forecast: string | null;
  previous: string | null;
  xauAbove: TrendDir | "mixed" | null;
  xauBelow: TrendDir | "mixed" | null;
  djiAbove: TrendDir | "mixed" | null;
  djiBelow: TrendDir | "mixed" | null;
}

export interface ScenarioOutput {
  id: string;
  title: string;
  trigger: string;
  xauDir: string | null;
  djiDir: string | null;
  confirm: string;
  invalidate: string;
  limits: string;
}

const DIR_FA: Record<string, string> = {
  bullish: "افزایشی",
  bearish: "کاهشی",
  neutral: "خنثی",
  mixed: "دووجهی",
};

/** ساخت دو سناریوی مشروط برای یک خبر — جهت‌ها از تحلیل هوش مصنوعی فید می‌آیند */
export function buildScenarios(
  ev: ScenarioEventInput,
  structure4h: TrendDir | null,
  levels: { resistance: number | null; support: number | null }
): { scenarios: ScenarioOutput[]; conflict: string | null } {
  const fc = ev.forecast || "—";
  const pv = ev.previous || "—";
  const limits =
    "واکنش بازار به اندازه اختلاف عدد واقعی با پیش‌بینی، شرایط لحظه انتشار و عوامل زمینه‌ای دیگر هم بستگی دارد؛ این سناریوها پیش‌بینی قطعی نیستند.";
  const scenarios: ScenarioOutput[] = [];
  let conflict: string | null = null;

  if (ev.xauAbove === null && ev.xauBelow === null) {
    return {
      conflict: null,
      scenarios: [
        {
          id: "unknown",
          title: "داده جهت‌دار موجود نیست",
          trigger: `برای «${ev.titleFa || ev.title}» تحلیل جهت‌دار ذخیره نشده است.`,
          xauDir: null,
          djiDir: null,
          confirm: "—",
          invalidate: "—",
          limits: "تحلیل فقط مشروط و کیفی نگه داشته می‌شود؛ داده ناقص را با حدس پر نمی‌کنیم.",
        },
      ],
    };
  }

  const aboveDir = ev.xauAbove ?? "neutral";
  const belowDir = ev.xauBelow ?? "neutral";
  scenarios.push({
    id: "better",
    title: "سناریوی اول — داده بهتر از انتظار",
    trigger: `اگر عدد واقعی بالاتر از پیش‌بینی (${fc}) منتشر شود (مقدار قبلی: ${pv})`,
    xauDir: DIR_FA[aboveDir] ?? null,
    djiDir: ev.djiAbove ? DIR_FA[ev.djiAbove] : null,
    confirm: `تأیید رفتاری: پایداری قیمت بالای مقاومت ${levels.resistance ?? "نزدیک"} و تداوم کندل‌های صعودی در تایم‌فریم ۱۵ دقیقه.`,
    invalidate: `ابطال: بازگشت زیر کف ${levels.support ?? "نزدیک"} یا انتشار اظهارنظر خنثی‌کننده پس از خبر.`,
    limits,
  });
  scenarios.push({
    id: "worse",
    title: "سناریوی دوم — داده بدتر از انتظار",
    trigger: `اگر عدد واقعی پایین‌تر از پیش‌بینی (${fc}) منتشر شود (مقدار قبلی: ${pv})`,
    xauDir: DIR_FA[belowDir] ?? null,
    djiDir: ev.djiBelow ? DIR_FA[ev.djiBelow] : null,
    confirm: `تأیید رفتاری: شکست کف ${levels.support ?? "نزدیک"} و تداوم کندل‌های نزولی در تایم‌فریم ۱۵ دقیقه.`,
    invalidate: `ابطال: تثبیت مجدد بالای مقاومت ${levels.resistance ?? "نزدیک"} یا بازگشت سریع V شکل.`,
    limits,
  });

  /* هشدار تضاد: ساختار فعلی در برابر جهت سناریو */
  if (structure4h) {
    const s4h = structure4h;
    if (s4h === "bullish" && aboveDir === "bearish") {
      conflict = `ساختار ۴ ساعته فعلی صعودی است اما سناریوی «بهتر از انتظار» برای طلا کاهشی است — تضاد ریسکی؛ ورود پیش از خبر ریسک بالا دارد.`;
    } else if (s4h === "bearish" && belowDir === "bullish") {
      conflict = `ساختار ۴ ساعته فعلی نزولی است اما سناریوی «بدتر از انتظار» برای طلا افزایشی است — تضاد ریسکی؛ ورود پیش از خبر ریسک بالا دارد.`;
    }
  }
  return { scenarios, conflict };
}

/* ---------- پیش‌مرگ معامله ---------- */

export interface PreMortemInput {
  side: "buy" | "sell" | null;
  structure4h: TrendDir | null;
  tfAlignment: FactorResult;
  newsMinutes: number | null;
  divergence: DivergenceResult;
  regime: RegimeResult;
  rsi: number | null;
}

export function preMortemFactors(input: PreMortemInput): string[] {
  const out: string[] = [];
  const side = input.side;
  if (side) {
    const wanted = side === "buy" ? "bullish" : "bearish";
    if (input.structure4h && input.structure4h !== wanted && input.structure4h !== "neutral") {
      out.push(
        `ساختار ۴ ساعته ${input.structure4h === "bullish" ? "صعودی" : "نزولی"} است و با جهت معامله شما (${side === "buy" ? "خرید" : "فروش"}) مخالف — معامله خلاف جهت روند میان‌مدت است.`
      );
    }
    if (input.tfAlignment.score === 0) {
      out.push("تایم‌فریم‌ها در تضادند — محتمل‌ترین دلیل شکست: ناهماهنگی ساختار کوتاه‌مدت و میان‌مدت.");
    }
  }
  if (input.newsMinutes !== null && input.newsMinutes < 240) {
    out.push(
      `خبر مهم کمتر از ۴ ساعت دیگر منتشر می‌شود — اسپرد و لغزش ممکن است به‌طور موقت چند برابر شود و حد ضرر با گپ اجرا شود.`
    );
  }
  if (input.divergence.level === "broken" || input.divergence.level === "weak") {
    out.push("رابطه معمول با DXY به‌هم ریخته یا ضعیف است — حرکت ممکن است فریبنده (Fake Breakout) باشد.");
  }
  if (input.regime.type === "range" && side) {
    out.push("بازار در رژیم رنج است — شکست‌ها در رنج اغلب برمی‌گردند و استاپ‌خوردن متوالی شایع است.");
  }
  if (input.regime.type === "volatile") {
    out.push("نوسان افراطی است — حد ضرر کوتاه با نوسان معمول بازار حذف می‌شود.");
  }
  if (input.rsi !== null && side === "buy" && input.rsi >= 70) {
    out.push(`RSI روی ${Math.round(input.rsi)} است (اشباع خرید) — ورود خرید در سقف محلی ریسک بالایی دارد.`);
  }
  if (input.rsi !== null && side === "sell" && input.rsi <= 30) {
    out.push(`RSI روی ${Math.round(input.rsi)} است (اشباع فروش) — ورود فروش در کف محلی ریسک بالایی دارد.`);
  }
  if (out.length === 0) {
    out.push("در داده‌های فعلی عامل مخالف برجسته‌ای یافت نشد — با این حال شواهد موافق، تضمین موفقیت نیستند.");
  }
  return out;
}

/* ---------- هشدار جدی رنج فشرده ---------- */

export interface RangeWarning {
  active: boolean;
  /** tight = رنج فشرده (هشدار جدی) | normal = رنج معمولی */
  severity: "tight" | "normal";
  message: string;
  advice: string[];
  metrics: {
    atrPctile: number | null; // صدک ATR14 فعلی در توزیع تاریخی
    er: number | null; // نسبت کارایی ۲۰ دوره‌ای
    boxPctOfAtr: number | null; // ارتفاع جعبه ۲۰ کندل اخیر نسبت به ATR
  };
}

/**
 * تشخیص رنج فشرده: ATR در ناحیه پایین توزیع تاریخی خودش + مسیر بی‌رمق (ER پایین).
 * صدک ATR ≤ ۲۰ و ER ≤ ۰٫۳ → فشرده؛ در غیر این صورت ER ≤ ۰٫۱۵ → رنج معمولی.
 */
export function rangeCompression(
  highs: number[],
  lows: number[],
  closes: number[]
): RangeWarning {
  const mk = (
    active: boolean,
    severity: "tight" | "normal",
    message: string,
    advice: string[],
    atrPctile: number | null,
    er: number | null,
    boxPctOfAtr: number | null
  ): RangeWarning => ({ active, severity, message, advice, metrics: { atrPctile, er, boxPctOfAtr } });

  if (closes.length < 60) {
    return mk(false, "normal", "", [], null, null, null);
  }
  /* سری ATR14 */
  const trs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    trs.push(
      Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      )
    );
  }
  const atrSeries: number[] = [];
  const period = 14;
  for (let i = period; i < trs.length; i++) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += trs[j];
    atrSeries.push(s / period);
  }
  if (atrSeries.length < 60) {
    return mk(false, "normal", "", [], null, efficiencyRatio(closes), null);
  }
  const atrNow = atrSeries[atrSeries.length - 1];
  let below = 0;
  for (const a of atrSeries) if (a <= atrNow) below++;
  const atrPctile = Math.round((below / atrSeries.length) * 100);
  const er = efficiencyRatio(closes);
  /* ارتفاع جعبه ۲۰ کندل اخیر نسبت به ATR */
  const box = highs.slice(-20);
  const boxLo = lows.slice(-20);
  const boxH = Math.max(...box) - Math.min(...boxLo);
  const boxPctOfAtr = atrNow > 0 ? Math.round((boxH / atrNow) * 10) / 10 : null;

  const advice = [
    "تا شکست معتبر صبر کنید: بسته‌شدن کندل خارج از محدوده + پولبک موفق، نه یک کندل شانه‌ای.",
    "شکست‌های کاذب در رنج فشرده شایع‌اند — ورود زودهنگام روی شکست، بالاترین ریسک را دارد.",
    "حد ضرر خیلی نزدیک در این شرایط با کوچک‌ترین نوسان حذف می‌شود — فاصله استاپ را واقع‌بینانه بگیرید.",
    "معامله در میانه رنج نکنید — فقط واکنش به لبه‌ها با تأیید، یا پرهیز کامل تا روشن‌شدن جهت.",
  ];

  if (atrPctile <= 20 && (er ?? 1) <= 0.3) {
    return mk(
      true,
      "tight",
      `هشدار جدی: بازار در رنج فشرده قرار دارد — دامنه نوسان (ATR) در صدک ${atrPctile} توزیع یک‌ساله خودش است و ارتفاع محدوده معاملاتی فقط ${boxPctOfAtr ?? "—"} برابر ATR است. احتمال انفجار قیمتی ناگهانی یا اسپاسم‌های کاذب بالا می‌رود.`,
      advice,
      atrPctile,
      er === null ? null : Math.round(er * 100) / 100,
      boxPctOfAtr
    );
  }
  if ((er ?? 1) <= 0.15) {
    return mk(
      true,
      "normal",
      `بازار در رنج است — نسبت کارایی ${Math.round((er ?? 0) * 100)}٪ و صدک ATR روی ${atrPctile} است؛ سطوح افقی غالب‌اند و شکست‌ها اغلب برمی‌گردند.`,
      advice,
      atrPctile,
      er === null ? null : Math.round(er * 100) / 100,
      boxPctOfAtr
    );
  }
  return mk(false, "normal", "", [], atrPctile, er === null ? null : Math.round(er * 100) / 100, boxPctOfAtr);
}

/* ---------- نواحی ورود مبتنی بر ساختار ---------- */

export interface EntryZone {
  side: "buy" | "sell";
  zoneLo: number;
  zoneHi: number;
  sl: number;
  tp1: number;
  tp2: number;
  activeNow: boolean; // قیمت الان داخل ناحیه است یا ناحیه انتظار است
  basis: string;
  invalidate: string;
}

export interface EntryZoneOutput {
  trend: TrendDir | null;
  trendFa: string;
  zones: EntryZone[];
  note: string;
  rangeWarning: RangeWarning | null;
}

function rp(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * ناحیه ورود خرید/فروش بر اساس ساختار:
 *  - روند صعودی → ناحیه پولبک به حمایت/کف سوئینگ؛ SL زیر کف − ۰٫۵ATR؛ TP با RR ۲ و ۳
 *  - روند نزولی → ناحیه پولبک به مقاومت/سقف سوئینگ؛ آینه‌ای
 *  - رنج پهن → دو ناحیه لبه‌ای با هدف میانه رنج
 *  - رنج فشرده → هیچ ناحیه‌ای پیشنهاد نمی‌شود؛ فقط هشدار جدی
 * خروجی «ناحیه آموزشی مبتنی بر ساختار» است، نه سیگنال قطعی.
 */
export function entryZonesFromStructure(input: {
  trend: TrendDir | null;
  price: number | null;
  support: number | null;
  resistance: number | null;
  atrAbs: number | null;
  range: RangeWarning;
}): EntryZoneOutput {
  const { trend, price, support, resistance, atrAbs, range } = input;
  const out: EntryZoneOutput = {
    trend,
    trendFa: trend === "bullish" ? "صعودی" : trend === "bearish" ? "نزولی" : trend === "neutral" ? "خنثی" : "نامشخص",
    zones: [],
    note: "",
    rangeWarning: range.active ? range : null,
  };

  if (range.active && range.severity === "tight") {
    out.note =
      "به دلیل رنج فشرده، ناحیه ورودی پیشنهاد نمی‌شود — ورود در این شرایط قمار است، نه تحلیل. منتظر شکست معتبر و تثبیت بمانید.";
    return out;
  }
  if (!price || !atrAbs || atrAbs <= 0) {
    out.note = "داده کافی (قیمت یا ATR) برای پیشنهاد ناحیه ورود موجود نیست.";
    return out;
  }

  const pad = 0.25 * atrAbs; // ضخامت ناحیه
  const buf = 0.5 * atrAbs; // فاصله استاپ از لبه

  const buyZone = (lo: number, hi: number, basis: string): EntryZone => {
    const entry = (lo + hi) / 2;
    const sl = lo - buf;
    const risk = entry - sl;
    return {
      side: "buy",
      zoneLo: rp(lo),
      zoneHi: rp(hi),
      sl: rp(sl),
      tp1: rp(entry + 2 * risk),
      tp2: rp(entry + 3 * risk),
      activeNow: price >= lo && price <= hi,
      basis,
      invalidate: `بسته‌شدن کندل زیر ${rp(sl)} ساختار خرید را باطل می‌کند.`,
    };
  };
  const sellZone = (lo: number, hi: number, basis: string): EntryZone => {
    const entry = (lo + hi) / 2;
    const sl = hi + buf;
    const risk = sl - entry;
    return {
      side: "sell",
      zoneLo: rp(lo),
      zoneHi: rp(hi),
      sl: rp(sl),
      tp1: rp(entry - 2 * risk),
      tp2: rp(entry - 3 * risk),
      activeNow: price >= lo && price <= hi,
      basis,
      invalidate: `بسته‌شدن کندل بالای ${rp(sl)} ساختار فروش را باطل می‌کند.`,
    };
  };

  if (trend === "bullish" && support && support < price) {
    const hi = Math.min(support + pad, price);
    out.zones.push(
      buyZone(support, Math.max(hi, support + 0.05 * atrAbs), "پولبک به حمایت/کف سوئینگ در ساختار صعودی — خرید در محدوده سبک‌گیری، نه تعقیب قیمت")
    );
    out.note = "ساختار صعودی است؛ ناحیه زیر «انتظار پولبک» است — اگر قیمت بدون اصلاح برود بالا، تعقیب نکنید.";
    return out;
  }
  if (trend === "bearish" && resistance && resistance > price) {
    const lo = Math.max(resistance - pad, price);
    out.zones.push(
      sellZone(Math.min(lo, resistance - 0.05 * atrAbs), resistance, "پولبک به مقاومت/سقف سوئینگ در ساختار نزولی — فروش در محدوده اصلاح، نه تعقیب سقوط")
    );
    out.note = "ساختار نزولی است؛ ناحیه بالا «انتظار اصلاح» است — اگر قیمت بدون اصلاح سقوط کرد، فروش در کف نکنید.";
    return out;
  }
  if (range.active && range.severity === "normal" && support && resistance && resistance > support) {
    out.zones.push(
      buyZone(support, support + pad, "لبه پایینی رنج پهن — فقط با تأیید کندل بازگشتی؛ هدف اول میانه رنج"),
      sellZone(resistance - pad, resistance, "لبه بالایی رنج پهن — فقط با تأیید کندل بازگشتی؛ هدف اول میانه رنج")
    );
    out.note = "بازار رنج است؛ معامله فقط از لبه‌ها با تأیید، و هدف‌گیری میانه رنج — نه انتظار شکست.";
    return out;
  }
  out.note = "ساختار فعلی جهت‌گیری روشن ندارد (خنثی/داده ناکافی) — ناحیه ورود قابل استخراج نیست و حدس زده نمی‌شود.";
  return out;
}
