/**
 * موتور کمّی‌سازی اجباری اثر عوامل بر نماد (ویژگی ۸)
 * ——— همه محاسبات آماری خالص و بدون فریم‌ورک ———
 *
 * الف) اندازه و جهت اثر تاریخی:
 *   بازده نماد (افق ۱/۵/۲۰ روزه) = α + β × تغییر عامل + خطا
 *   β با OLS و خطای استاندارد با تصحیح Newey-West (چون نمونه‌های افق‌های >۱ هم‌پوشان‌اند)
 *   خروجی «رابطه تاریخی/آماری» است، نه اثر علّی.
 *
 * ب) امتیاز جهت و شدت فعلی:
 *   Z = (مقدار جاری − میانگین تاریخی) / انحراف معیار تاریخی
 *   Surprise Z = (Actual − Consensus) / انحراف معیار تاریخی غافلگیری‌ها (ساخت در API)
 *   Pressure_i = sign(β_i) × Z_i × Reliability_i  (اگر β قابل اتکا نباشد → null)
 *   Composite = 100 × tanh(Σ(w_i × Pressure_i) / Σ(w_i)) فقط از عوامل معتبر
 *
 * هیچ خروجی‌ای احتمال صعود، بازده مورد انتظار یا تضمین حرکت نیست — «شاخص فشار مدل» است.
 */

export interface BetaOut {
  /** شیب — تغییر ٪ نماد به ازای ۱ واحد تغییر عامل */
  beta: number;
  se: number;
  t: number;
  ciLo: number;
  ciHi: number;
  n: number;
  r2: number;
}

export type EffectKind = "supportive" | "restrictive" | "neutral" | "conflict" | "unknown";

export const EFFECT_FA: Record<EffectKind, string> = {
  supportive: "حمایتی",
  restrictive: "بازدارنده",
  neutral: "خنثی",
  conflict: "متناقض",
  unknown: "نامشخص",
};

/* ---------- OLS با تصحیح Newey-West ---------- */

/**
 * رگرسیون ساده y = α + βx با HAC(Newey-West، پنجره یکنواخت lag L) برای SE.
 * x و y باید هم‌طول و بدون مقدار نامعتبر باشند.
 */
export function olsNW(x: number[], y: number[], lag = 0): BetaOut | null {
  const n = Math.min(x.length, y.length);
  if (n < 25) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i];
    sy += y[i];
    sxx += x[i] * x[i];
    sxy += x[i] * y[i];
    syy += y[i] * y[i];
  }
  const mx = sx / n;
  const my = sy / n;
  const vx = sxx / n - mx * mx;
  const vy = syy / n - my * my;
  if (!(vx > 1e-12)) return null;
  const beta = (sxy / n - mx * my) / vx;
  const alpha = my - beta * mx;

  /* باقیمانده‌ها */
  const u: number[] = new Array(n);
  let ssr = 0;
  for (let i = 0; i < n; i++) {
    u[i] = y[i] - (alpha + beta * x[i]);
    ssr += u[i] * u[i];
  }

  /* Sxx */
  let sxxC = 0;
  for (let i = 0; i < n; i++) sxxC += (x[i] - mx) * (x[i] - mx);

  /* واریانس NW: (Sxx)⁻² × [Σ(xu)² + 2Σ_l Σ_i (x_i u_i)(x_{i+l} u_{i+l})] */
  let long = 0;
  for (let i = 0; i < n; i++) long += (x[i] - mx) * (x[i] - mx) * u[i] * u[i];
  const L = Math.min(lag, n - 2);
  for (let l = 1; l <= L; l++) {
    for (let i = l; i < n; i++) {
      long += 2 * (x[i] - mx) * u[i] * (x[i - l] - mx) * u[i - l];
    }
  }
  let se = NaN;
  if (sxxC > 1e-12 && long >= 0) {
    const nwVar = long / (sxxC * sxxC);
    if (isFinite(nwVar) && nwVar > 0) se = Math.sqrt(nwVar);
  }
  if (!isFinite(se)) {
    /* fallback: SE کلاسیک OLS */
    const dof = n - 2;
    if (dof <= 0) return null;
    const s2 = ssr / dof;
    se = Math.sqrt(s2 / sxxC);
  }
  if (!isFinite(se) || se <= 0) return null;
  const t = beta / se;
  const ci = 1.96 * se;
  const rSq = vy > 1e-12 ? (sxy / n - mx * my) * (sxy / n - mx * my) / (vx * vy) : 0;
  return {
    beta: r3(beta),
    se: r4(se),
    t: r2(t),
    ciLo: r3(beta - ci),
    ciHi: r3(beta + ci),
    n,
    r2: r3(rSq),
  };
}

/* ---------- سری‌های افق‌دار ---------- */

export interface DatePoint {
  t: number; // epoch seconds
  c: number;
}

/**
 * جفت‌سازی بازده نماد و تغییر عامل در افق h روز معاملاتی:
 *   y = بازده ٪ نماد از t تا t+h
 *   x = تغییر عامل از t تا t+h (pct: ٪ | delta: واحد خام — بازده/امتیاز)
 * تاریخ‌ها بر اساس کلید روز UTC تراز می‌شوند.
 */
export function horizonPairs(
  sym: DatePoint[],
  fac: DatePoint[],
  h: number,
  mode: "pct" | "delta"
): { x: number[]; y: number[] } {
  const dayKey = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
  const fMap = new Map<string, number>();
  for (const p of fac) fMap.set(dayKey(p.t), p.c);
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i + h < sym.length; i++) {
    const a = sym[i];
    const b = sym[i + h];
    const fa = fMap.get(dayKey(a.t));
    const fb = fMap.get(dayKey(b.t));
    if (fa === undefined || fb === undefined || !isFinite(fa) || !isFinite(fb)) continue;
    if (!(a.c > 0) || !isFinite(b.c)) continue;
    const fx = mode === "pct" ? ((fb - fa) / fa) * 100 : fb - fa;
    const fy = ((b.c - a.c) / a.c) * 100;
    if (!isFinite(fx) || !isFinite(fy)) continue;
    x.push(fx);
    y.push(fy);
  }
  return { x, y };
}

/** تقسیم جفت‌ها به دو نیمه برای بررسی ثبات علامت β */
export function splitHalfAgree(x: number[], y: number[], mode: "pct" | "delta" = "pct"): boolean | null {
  const n = Math.min(x.length, y.length);
  if (n < 40) return null;
  const mid = Math.floor(n / 2);
  const b1 = olsNW(x.slice(0, mid), y.slice(0, mid), 0);
  const b2 = olsNW(x.slice(mid), y.slice(mid), 0);
  if (!b1 || !b2) return null;
  return Math.sign(b1.beta) === Math.sign(b2.beta);
}

/* ---------- Z و آمار توصیفی ---------- */

export function meanStd(v: number[]): { mean: number; std: number } | null {
  const n = v.length;
  if (n < 30) return null;
  let s = 0;
  for (const x of v) s += x;
  const m = s / n;
  let ss = 0;
  for (const x of v) ss += (x - m) * (x - m);
  const std = Math.sqrt(ss / n);
  if (!(std > 1e-12)) return null;
  return { mean: m, std };
}

/** Z سطح جاری نسبت به توزیع تاریخی (پیش‌فرض ۲۵۲ مشاهده آخر) */
export function zScore(current: number, hist: number[]): number | null {
  const tail = hist.slice(-252);
  const ms = meanStd(tail);
  if (!ms) return null;
  return r2((current - ms.mean) / ms.std);
}

/** صدک مقدار فعلی در توزیع تاریخی (۰ تا ۱۰۰) */
export function percentileOf(current: number, hist: number[]): number | null {
  if (hist.length < 30) return null;
  let below = 0;
  for (const v of hist) if (v <= current) below++;
  return r0((below / hist.length) * 100);
}

/* ---------- قابلیت اتکا (۰ تا ۱) ---------- */

export interface ReliabilityInput {
  n: number;
  t: number;
  /** نسبت افق‌های معنادار هم‌علامت با β5 (۱ / ۰٫۶ / ۰٫۳) */
  signConsistency: number;
  /** علامت β در دو نیمه نمونه یکسان؟ */
  splitAgree: boolean | null;
  /** ۱ = داده زنده، ۰٫۵ = تأخیر/منبع دوم */
  freshness: number;
}

export function reliability(inp: ReliabilityInput): number {
  const dataScore = Math.min(inp.n / 150, 1);
  const at = Math.abs(inp.t);
  const sigScore = at >= 2 ? 1 : Math.max(0, (at - 0.5) / 1.5);
  const stability = 0.5 * inp.signConsistency + 0.5 * (inp.splitAgree === null ? 0.5 : inp.splitAgree ? 1 : 0);
  const rel = (0.35 * dataScore + 0.35 * sigScore + 0.3 * stability) * inp.freshness;
  return r2(Math.max(0, Math.min(1, rel)));
}

/* ---------- فشار و امتیاز تجمیعی ---------- */

/** Pressure = sign(β) × Z × Reliability */
export function pressureOf(betaSign: number, z: number, rel: number): number {
  return r3(Math.sign(betaSign) * z * rel);
}

export interface WeightedPressure {
  id: string;
  w: number;
  p: number;
}

/** Composite = 100 × tanh(Σ(w·P)/Σw) — فقط از عوامل معتبر */
export function compositeScore(items: WeightedPressure[]): number | null {
  if (items.length === 0) return null;
  const sw = items.reduce((s, e) => s + e.w, 0);
  if (!(sw > 0)) return null;
  const num = items.reduce((s, e) => s + e.w * e.p, 0);
  return r1(100 * Math.tanh(num / sw));
}

export function compositeLabelFa(score: number | null): string {
  if (score === null) return "بدون امتیاز معتبر";
  if (score > 15) return "فشار صعودی";
  if (score < -15) return "فشار نزولی";
  return "فشار خنثی/متعادل";
}

/* ---------- گرد کردن ---------- */

export function r1(v: number): number {
  return Math.round(v * 10) / 10;
}
export function r2(v: number): number {
  return Math.round(v * 100) / 100;
}
export function r3(v: number): number {
  return Math.round(v * 1000) / 1000;
}
export function r4(v: number): number {
  return Math.round(v * 10000) / 10000;
}
export function r0(v: number): number {
  return Math.round(v);
}
