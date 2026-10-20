/**
 * نقشهٔ مسیر معامله — ایدهٔ خلاقانهٔ ابزار (پیام ۲۱، «پنجرهٔ مجزا»)
 *
 * هدف: شفاف شدن مسیر معامله‌گری. به‌جای نمایش فرمول و متغیر، همهٔ منابع موجود
 * (دماسنج دو تایم‌فریم، ساختار بازار، رأی تریدینگ‌ویو، پیش‌بینی LiteFinance،
 * اخبار مهم حل‌شده) را به یک رأی سه‌حالته تبدیل می‌کند و سه سناریوی مسیر
 * (صعودی / نزولی / رنج) با محرک و ابطال مشخص می‌سازد.
 *
 * صداقت داده: فقط منابعی که واقعاً در دسترس‌اند رأی می‌دهند؛ منبع قطع‌شده
 * با برچسب «در دسترس نبود» نمایش داده می‌شود. هیچ عددی حدس زده نمی‌شود.
 */

export type PathDir = "buy" | "sell" | "neutral";

export interface PathSource {
  id: string;
  labelFa: string;
  dir: PathDir;
  detailFa: string;
  available: boolean;
}

export interface PathScenario {
  id: "bull" | "bear" | "range";
  titleFa: string;
  strengthFa: string;
  triggerFa: string;
  invalidateFa: string;
  targetsFa: string | null;
  noteFa: string;
}

export interface PathMapOut {
  sources: PathSource[];
  alignment: { buy: number; sell: number; neutral: number; total: number };
  dominant: "bull" | "bear" | "range";
  dominantFa: string;
  confidenceFa: string;
  scenarios: PathScenario[];
  noteFa: string;
}

export interface PathMapInput {
  price: number | null;
  support: number | null;
  resistance: number | null;
  structure4h: "bullish" | "bearish" | "neutral" | null;
  structure1d: "bullish" | "bearish" | "neutral" | null;
  rangeActive: boolean;
  rangeSeverity: "tight" | "normal" | null;
  thermo1d: { dir: string; zoneFa: string; score: number } | null;
  thermo4h: { dir: string; zoneFa: string; score: number } | null;
  tvDailyStateFa: string | null;
  lite: { baseScenario: "long" | "short" | null; tomorrowHigh: number | null; tomorrowLow: number | null } | null;
  newsResolved: { dir: PathDir; detailFa: string } | null;
}

const DIR_FA: Record<PathDir, string> = { buy: "خرید", sell: "فروش", neutral: "خنثی" };

function faNum(v: number | null | undefined): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return v.toLocaleString("fa-IR", { maximumFractionDigits: 2 });
}

function trendDir(t: string | null | undefined): PathDir {
  return t === "bullish" ? "buy" : t === "bearish" ? "sell" : "neutral";
}

export function buildPathMap(inp: PathMapInput): PathMapOut {
  /* ---------- رأی هر منبع (فقط نتیجه) ---------- */
  const sources: PathSource[] = [];

  if (inp.thermo1d) {
    sources.push({
      id: "thermo1d",
      labelFa: "دماسنج فشار — روزانه (تریدینگ‌ویو)",
      dir: (inp.thermo1d.dir as PathDir) ?? "neutral",
      detailFa: `${inp.thermo1d.zoneFa} · عدد ${faNum(inp.thermo1d.score)}`,
      available: true,
    });
  } else {
    sources.push({ id: "thermo1d", labelFa: "دماسنج فشار — روزانه (تریدینگ‌ویو)", dir: "neutral", detailFa: "در دسترس نبود", available: false });
  }

  if (inp.thermo4h) {
    sources.push({
      id: "thermo4h",
      labelFa: "دماسنج فشار — ۴ ساعته (تریدینگ‌ویو)",
      dir: (inp.thermo4h.dir as PathDir) ?? "neutral",
      detailFa: `${inp.thermo4h.zoneFa} · عدد ${faNum(inp.thermo4h.score)}`,
      available: true,
    });
  } else {
    sources.push({ id: "thermo4h", labelFa: "دماسنج فشار — ۴ ساعته (تریدینگ‌ویو)", dir: "neutral", detailFa: "در دسترس نبود", available: false });
  }

  if (inp.structure4h) {
    sources.push({
      id: "struct4h",
      labelFa: "ساختار بازار — ۴ ساعته",
      dir: trendDir(inp.structure4h),
      detailFa: `روند ${inp.structure4h === "bullish" ? "صعودی" : inp.structure4h === "bearish" ? "نزولی" : "خنثی"}`,
      available: true,
    });
  } else {
    sources.push({ id: "struct4h", labelFa: "ساختار بازار — ۴ ساعته", dir: "neutral", detailFa: "در دسترس نبود", available: false });
  }

  if (inp.structure1d) {
    sources.push({
      id: "struct1d",
      labelFa: "ساختار بازار — روزانه",
      dir: trendDir(inp.structure1d),
      detailFa: `روند ${inp.structure1d === "bullish" ? "صعودی" : inp.structure1d === "bearish" ? "نزولی" : "خنثی"}`,
      available: true,
    });
  } else {
    sources.push({ id: "struct1d", labelFa: "ساختار بازار — روزانه", dir: "neutral", detailFa: "در دسترس نبود", available: false });
  }

  if (inp.tvDailyStateFa) {
    const dir: PathDir = inp.tvDailyStateFa.includes("خرید") ? "buy" : inp.tvDailyStateFa.includes("فروش") ? "sell" : "neutral";
    sources.push({ id: "tv", labelFa: "رأی فنی تریدینگ‌ویو — روزانه", dir, detailFa: inp.tvDailyStateFa, available: true });
  } else {
    sources.push({ id: "tv", labelFa: "رأی فنی تریدینگ‌ویو — روزانه", dir: "neutral", detailFa: "در دسترس نبود", available: false });
  }

  if (inp.lite && inp.lite.baseScenario) {
    sources.push({
      id: "lite",
      labelFa: "پیش‌بینی LiteFinance",
      dir: inp.lite.baseScenario === "long" ? "buy" : "sell",
      detailFa: inp.lite.baseScenario === "long" ? "سناریوی اصلی گزارش: خرید" : "سناریوی اصلی گزارش: فروش",
      available: true,
    });
  } else {
    sources.push({ id: "lite", labelFa: "پیش‌بینی LiteFinance", dir: "neutral", detailFa: "در دسترس نبود", available: false });
  }

  if (inp.newsResolved) {
    sources.push({ id: "news", labelFa: "اخبار مهم امروز/فردا", dir: inp.newsResolved.dir, detailFa: inp.newsResolved.detailFa, available: true });
  } else {
    sources.push({ id: "news", labelFa: "اخبار مهم امروز/فردا", dir: "neutral", detailFa: "خبر حل‌شده‌ای که جهت طلا را روشن کند نبود", available: false });
  }

  /* ---------- شمارش و تعیین مسیر غالب ---------- */
  const buy = sources.filter((s) => s.available && s.dir === "buy").length;
  const sell = sources.filter((s) => s.available && s.dir === "sell").length;
  const neutral = sources.filter((s) => s.available && s.dir === "neutral").length;
  const total = sources.length;

  let dominant: "bull" | "bear" | "range";
  if (inp.rangeActive || (neutral >= buy && neutral >= sell && buy === sell)) dominant = "range";
  else if (buy > sell) dominant = "bull";
  else if (sell > buy) dominant = "bear";
  else dominant = "range";

  const dominantVotes = dominant === "bull" ? buy : dominant === "bear" ? sell : neutral;
  const confidenceFa =
    dominantVotes >= 5 ? "هم‌راستایی قوی" : dominantVotes >= 4 ? "هم‌راستایی متوسط" : "هم‌راستایی ضعیف — مسیر دوپهلوست";

  const dominantFa = dominant === "bull" ? "مسیر غالب: صعودی" : dominant === "bear" ? "مسیر غالب: نزولی" : "مسیر غالب: رنج/انتظار";

  /* ---------- سه سناریوی مسیر ---------- */
  const res = inp.resistance;
  const sup = inp.support;
  const liteHigh = inp.lite?.tomorrowHigh ?? null;
  const liteLow = inp.lite?.tomorrowLow ?? null;

  const bullStrength = dominant === "bull" ? `${confidenceFa} (${buy} از ${total} منبع با خرید هم‌راستا)` : `هم‌راستایی ضعیف (${buy} از ${total} منبع)`;
  const bearStrength = dominant === "bear" ? `${confidenceFa} (${sell} از ${total} منبع با فروش هم‌راستا)` : `هم‌راستایی ضعیف (${sell} از ${total} منبع)`;
  const rangeStrength =
    inp.rangeActive && inp.rangeSeverity === "tight"
      ? "هشدار رنج فشرده فعال است — آمار نوسان پایین است"
      : `${neutral + (inp.rangeActive ? 0 : 1)} نشانهٔ خنثی/رنج از ${total} منبع`;

  const scenarios: PathScenario[] = [
    {
      id: "bull",
      titleFa: "مسیر صعودی",
      strengthFa: bullStrength,
      triggerFa: res !== null ? `تثبیت یک کندل بالای مقاومت ${faNum(res)}` : "تثبیت بالای سقف محدودهٔ اخیر",
      invalidateFa: sup !== null ? `شکست و تثبیت زیر حمایت ${faNum(sup)}` : "شکست کف محدودهٔ اخیر",
      targetsFa: liteHigh !== null ? `هدف مسیر (پیش‌بینی LiteFinance برای فردا): ${faNum(liteHigh)}` : null,
      noteFa:
        dominant === "bull"
          ? "بیشتر منابع با خرید هم‌راستا هستند — در این سناریو خرید در اصلاح به سمت حمایت/ناحیهٔ ورود، کم‌ریسک‌تر از تعقیب قیمت است."
          : "این سناریو فعال می‌شود فقط اگر محرک بالا رخ دهد — پیش از تثبیت، پیش‌دستی نکنید.",
    },
    {
      id: "bear",
      titleFa: "مسیر نزولی",
      strengthFa: bearStrength,
      triggerFa: sup !== null ? `شکست و تثبیت زیر حمایت ${faNum(sup)}` : "شکست کف محدودهٔ اخیر",
      invalidateFa: res !== null ? `برگشت و تثبیت بالای مقاومت ${faNum(res)}` : "برگشت بالای سقف محدودهٔ اخیر",
      targetsFa: liteLow !== null ? `هدف مسیر (پیش‌بینی LiteFinance برای فردا): ${faNum(liteLow)}` : null,
      noteFa:
        dominant === "bear"
          ? "بیشتر منابع با فروش هم‌راستا هستند — در این سناریو فروش در برگشت به سمت مقاومت، کم‌ریسک‌تر از فروش در کف است."
          : "این سناریو فعال می‌شود فقط اگر محرک بالا رخ دهد — پیش از شکست واقعی، فروش نکنید.",
    },
    {
      id: "range",
      titleFa: "مسیر رنج / تردید",
      strengthFa: rangeStrength,
      triggerFa: sup !== null && res !== null ? `نوسان بین ${faNum(sup)} و ${faNum(res)} ادامه یابد` : "بازار در محدودهٔ اخیر بماند",
      invalidateFa: sup !== null && res !== null ? `شکست هر یک از دو مرز ${faNum(sup)} یا ${faNum(res)} با کندل قوی` : "خروج قوی از محدودهٔ اخیر",
      targetsFa: sup !== null && res !== null ? `لبه‌های محدوده: کف ${faNum(sup)} — سقف ${faNum(res)}` : null,
      noteFa:
        inp.rangeActive && inp.rangeSeverity === "tight"
          ? "رنج فشرده معمولاً پیش از حرکت بزرگ است — ورود وسط محدوده توصیه نمی‌شود؛ صبر کنید بازار مسیر را انتخاب کند."
          : "در رنج، خرید نزدیک کف و فروش نزدیک سقف (با تثبیت برگشتی) منطقی است؛ وسط محدوده معامله نکنید.",
    },
  ];

  return {
    sources,
    alignment: { buy, sell, neutral, total },
    dominant,
    dominantFa,
    confidenceFa,
    scenarios,
    noteFa:
      "نقشهٔ مسیر، هم‌راستایی منابع ابزار را در سه سناریو خلاصه می‌کند — پیش‌بینی قطعی نیست و توصیهٔ خرید/فروش نیست؛ محرک و ابطال هر سناریو را در چارت خودتان بررسی کنید.",
  };
}
