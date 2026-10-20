/**
 * منابع تحلیل و پیش‌بینی طلا — لایه جمع‌آوری و خلاصه‌سازی (پیام ۲۱)
 *
 * منابع به ترتیب اولویت (طبق درخواست کاربر):
 *   1) LiteFinance — پیش‌بینی روزانه/فردا/هفتگی طلا:
 *      https://www.litefinance.org/blog/analysts-opinions/gold-price-prediction-forecast/daily-and-weekly/
 *   2) FXStreet — تحلیل‌های تازه طلا + نظرسنجی پیش‌بینی:
 *      https://www.fxstreet.com/commodities/gold
 *   3) تریدینگ‌ویو — رأی فنی روزانه (همان منبع دماسنج، از tv-technicals.ts)
 *
 * این سایت‌ها در برابر ربات‌ها Cloudflare دارند؛ زنجیره دریافت:
 *   مستقیم → codetabs → allorigins → corsproxy → آرشیو Wayback (کهنه‌ترین ولی آخرین پشتوانه)
 * نتیجه در AppMeta کش می‌شود (۳۰ دقیقه) و در صورت قطعی کامل، آخرین نسخه سالم
 * با برچسب «کهنه + سن» ارائه می‌شود. هیچ عددی ساختگی تولید نمی‌شود.
 */

import ZAI from "z-ai-web-dev-sdk";
import { getMeta, setMeta } from "@/lib/ff";
import { fetchTvTechnicals, tvRatingToStateFa } from "@/lib/tv-technicals";
import { ANALYSIS_SNAPSHOT } from "@/lib/analysis-snapshot";

/* ---------- تایپ‌ها ---------- */

export interface LiteForecast {
  ok: boolean;
  via: string;
  /**true = این بخش از اسنپ‌شات داخلی آمده (زنده نبود) */
  snapshot?: boolean;
  reportedAtFa: string | null;
  baseScenario: "long" | "short" | null;
  baseScenarioFa: string | null;
  longAbove: number | null;
  shortBelow: number | null;
  stopLoss: number | null;
  targets: number[];
  tomorrow: { low: number | null; avg: number | null; high: number | null };
  week: { low: number | null; avg: number | null; high: number | null };
  rsi: number | null;
  error?: string;
}

export interface FxstreetPoll {
  periodFa: string;
  avg: number | null;
  mixFa: string | null;
}

export interface FxstreetBrief {
  ok: boolean;
  via: string;
  /**true = این بخش از اسنپ‌شات داخلی آمده (زنده نبود) */
  snapshot?: boolean;
  poll: FxstreetPoll[];
  items: { title: string; titleFa: string | null; url: string }[];
  error?: string;
}

export interface TvBrief {
  ok: boolean;
  stateFa: string | null;
  error?: string;
}

export interface GoldBriefing {
  ok: boolean;
  stale: boolean;
  ageMin: number | null;
  generatedAtISO: string;
  lite: LiteForecast;
  fx: FxstreetBrief;
  tv: TvBrief;
  /** خلاصه نهایی فارسی — جمع‌بندی مختصر و مفید همه منابع */
  summaryFa: string[];
  sourcesNoteFa: string;
}

/* ---------- زنجیره دریافت متن (مستقیم → پروکسی‌ها → آرشیو) ---------- */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const STEP_TIMEOUT_MS = 12_000;
const ARCHIVE_TIMEOUT_MS = 22_000;

function isChallengePage(text: string): boolean {
  return /Just a moment|challenge-platform|cf-browser-verification|Attention Required/i.test(text.slice(0, 4000));
}

async function fetchTextOnce(url: string, timeoutMs = STEP_TIMEOUT_MS): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`http ${res.status}`);
    const text = await res.text();
    if (text.length < 500) throw new Error(`too short (${text.length})`);
    if (isChallengePage(text)) throw new Error("cloudflare challenge");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

export interface ChainResult {
  text: string;
  via: string;
}

async function fetchTextChain(url: string): Promise<ChainResult> {
  const enc = encodeURIComponent(url);
  const steps: { via: string; build: () => string }[] = [
    { via: "مستقیم", build: () => url },
    { via: "پروکسی codetabs", build: () => `https://api.codetabs.com/v1/proxy?quest=${enc}` },
    { via: "پروکسی allorigins", build: () => `https://api.allorigins.win/raw?url=${enc}` },
    { via: "پروکسی corsproxy", build: () => `https://corsproxy.io/?url=${enc}` },
    { via: "آرشیو Wayback", build: () => `https://web.archive.org/web/2/${url}` },
  ];
  let lastErr: unknown = null;
  for (const s of steps) {
    try {
      const isArchive = s.via.includes("Wayback");
      const text = await fetchTextOnce(s.build(), isArchive ? ARCHIVE_TIMEOUT_MS : STEP_TIMEOUT_MS);
      return { text, via: s.via };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(lastErr instanceof Error ? lastErr.message : "chain failed");
}

/* ---------- پارس LiteFinance ---------- */

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8217;|&rsquo;/gi, "'")
    .replace(/\s+/g, " ");
}

function num(v: string | null | undefined): number | null {
  if (!v) return null;
  const n = Number(String(v).replace(/,/g, ""));
  return isFinite(n) && n > 100 ? n : null; // قیمت طلا همیشه > ۱۰۰ است (فیلتر اشتباه‌گیری)
}

interface LiteRow {
  date: string;
  low: number | null;
  avg: number | null;
  high: number | null;
}

/**
 * استخراج سطرهای جدول‌های پیش‌بینی (Low / Average / High) از متن لخت.
 * الگوی واقعی صفحه: «20.10.2026 4,057.82 4,185.74 4,313.67» — سطر هفتگی بازه تاریخ دارد.
 */
function extractForecastRows(text: string): LiteRow[] {
  const rows: LiteRow[] = [];
  const re =
    /(\d{2}\.\d{2}\.\d{4}(?:\s*[–—-]\s*\d{2}\.\d{2}\.\d{4})?)[^0-9]{0,40}([\d.,]{5,})[^0-9]{0,30}([\d.,]{5,})[^0-9]{0,30}([\d.,]{5,})/g;
  for (const m of text.matchAll(re)) {
    const low = num(m[2]);
    const avg = num(m[3]);
    const high = num(m[4]);
    if (low === null || avg === null || high === null) continue;
    rows.push({ date: m[1].trim(), low, avg, high });
    if (rows.length >= 6) break;
  }
  return rows;
}

export function parseLiteFinance(html: string): LiteForecast {
  const text = stripTags(html);
  if (!/XAU\s*\/?\s*USD|Gold/i.test(text)) {
    throw new Error("محتوای LiteFinance قابل شناسایی نبود");
  }

  const dateMatch = text.match(/([A-Z][a-z]+ \d{1,2},? 20\d{2})/);

  /* الگوی عدد آمریکایی: ‎4,254.97‎ یا ‎4202.40‎ — نقطهٔ پایان جمله را نمی‌گیرد */
  const NUM = "(\\d[\\d,]*(?:\\.\\d+)?)";

  /* سناریوی اصلی — الگوی واقعی: «Base scenario: Open long positions (1) on high volume above the $4,202.40 level» */
  const baseKind = text.match(/Base scenario[^.]{0,100}?\b(long|short)\b/i);
  const baseScenario = baseKind ? (baseKind[1].toLowerCase() === "long" ? "long" : "short") : null;
  const longAbove = text.match(new RegExp("long positions[^.]{0,100}?above (?:the )?\\$?\\s*" + NUM, "i"));
  const shortBelow = text.match(new RegExp("short positions[^.]{0,100}?below (?:the )?\\$?\\s*" + NUM, "i"));
  const stopLoss = text.match(new RegExp("Stop Loss(?:\\s*\\(\\d+\\))?:?\\s*\\$?\\s*" + NUM, "i"));

  /* اهداف — الگوی واقعی: «with price targets at $4,254.97, $4,313.67, …» */
  const targets: number[] = [];
  const targetsSeg = text.match(/price targets (?:are )?at\s+([\s\S]{0,220})/i);
  if (targetsSeg) {
    for (const m of targetsSeg[1].matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
      const n = num(m[0]);
      if (n !== null) targets.push(n);
      if (targets.length >= 3) break;
    }
  }

  /* سطرهای پیش‌بینی: ردیف‌های روزانه (تاریخ ساده) + ردیف هفتگی (بازه تاریخ با خط تیره) */
  const rows = extractForecastRows(text);
  const dailyRows = rows.filter((r) => !/[–—-]/.test(r.date));
  const weekRow = rows.find((r) => /[–—-]/.test(r.date)) ?? null;

  /* تشخیص قطعی ردیف امروز/فردا با تاریخ تهران — fallback: ترتیب سطرها */
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", day: "2-digit", month: "2-digit", year: "numeric" });
  const tehranDateStr = (offsetDays: number) => fmt.format(new Date(Date.now() + offsetDays * 86400000)).replace(/\//g, ".");
  const todayStr = tehranDateStr(0);
  const tomorrowStr = tehranDateStr(1);
  const todayRow = dailyRows.find((r) => r.date === todayStr) ?? dailyRows[0] ?? null;
  const tomorrowRow = dailyRows.find((r) => r.date === tomorrowStr) ?? (todayRow && dailyRows[1] && dailyRows[1] !== todayRow ? dailyRows[1] : null);

  const rsiMatch = text.match(/RSI[^.]{0,80}?(?:is|at|of|around|=|:)\s*(\d{1,2}(?:\.\d+)?)/i);
  const rsiVal = rsiMatch ? Number(rsiMatch[1]) : null;

  const hasNumbers = longAbove || shortBelow || tomorrowRow || todayRow || weekRow;
  if (!hasNumbers) {
    throw new Error("اعداد پیش‌بینی در HTML ایستا نبود (بارگذاری پویا) — از اسنپ‌شات/آرشیو استفاده می‌شود");
  }

  const baseScenarioFa =
    baseScenario === "long"
      ? "سناریوی اصلی گزارش: خرید بالای سطح مشخص‌شده"
      : baseScenario === "short"
        ? "سناریوی اصلی گزارش: فروش زیر سطح مشخص‌شده"
        : null;

  return {
    ok: true,
    via: "",
    reportedAtFa: dateMatch ? dateMatch[1] : null,
    baseScenario,
    baseScenarioFa,
    longAbove: longAbove ? num(longAbove[1]) : null,
    shortBelow: shortBelow ? num(shortBelow[1]) : null,
    stopLoss: stopLoss ? num(stopLoss[1]) : null,
    targets,
    tomorrow: {
      low: tomorrowRow?.low ?? null,
      avg: tomorrowRow?.avg ?? null,
      high: tomorrowRow?.high ?? null,
    },
    week: {
      low: weekRow?.low ?? null,
      avg: weekRow?.avg ?? null,
      high: weekRow?.high ?? null,
    },
    rsi: rsiVal !== null && rsiVal >= 0 && rsiVal <= 100 ? rsiVal : null,
  };
}

/* ---------- پارس FXStreet ---------- */

const FX_LINK_RE =
  /<a[^>]+href="(https?:\/\/www\.fxstreet\.com\/(?:analysis|news|markets|commodities|rates-charts)\/[^"#?][^"]*)"[^>]*>([\s\S]{20,220}?)<\/a>/gi;

export function parseFxstreetGold(html: string): FxstreetBrief {
  if (!/FXStreet|Gold|XAU/i.test(html)) throw new Error("محتوای FXStreet قابل شناسایی نبود");

  /* نظرسنجی پیش‌بینی (۱ هفته / ۱ ماه / ۱ سه‌ماه) */
  const poll: FxstreetPoll[] = [];
  const periodDefs: [RegExp, string][] = [
    [/1 Week/i, "هفته آینده"],
    [/1 Month/i, "ماه آینده"],
    [/1 Quarter/i, "سه‌ماه آینده"],
  ];
  for (const [re, periodFa] of periodDefs) {
    const m = html.match(re);
    if (!m || m.index === undefined) continue;
    const seg = stripTags(html.slice(m.index, m.index + 400));
    const avg = seg.match(/Average\s*([\d.,]+)/i);
    const parts: string[] = [];
    for (const pm of seg.matchAll(/(\d{1,3})%\s*(Sideways|Bullish|Bearish)/gi)) {
      const fa = /sideways/i.test(pm[2]) ? "رنج" : /bullish/i.test(pm[2]) ? "صعودی" : "نزولی";
      parts.push(`${pm[1]}٪ ${fa}`);
    }
    poll.push({ periodFa, avg: avg ? num(avg[1]) : null, mixFa: parts.length ? parts.join(" · ") : null });
  }

  /* عناوین تحلیل‌های تازه */
  const items: { title: string; titleFa: string | null; url: string }[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(FX_LINK_RE)) {
    const url = m[1];
    const title = stripTags(m[2]).trim();
    if (title.length < 25 || seen.has(title)) continue;
    seen.add(title);
    items.push({ title, titleFa: null, url });
    if (items.length >= 5) break;
  }

  if (!items.length && !poll.length) throw new Error("عنوان یا نظرسنجی قابل استخراج نبود");
  return { ok: true, via: "", poll, items };
}

/* ---------- ترجمه عناوین با هوش مصنوعی (اختیاری — در خطا، عنوان اصلی می‌ماند) ---------- */

async function translateHeadlines(items: FxstreetBrief["items"]): Promise<void> {
  try {
    if (!items.length) return;
    const zai = await ZAI.create();
    const titles = items.map((i) => i.title);
    const res = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "تو مترجم مالی هستی. برای هر عنوان تحلیل بازار (انگلیسی) یک ترجمه فارسی روان و کوتاه بده. " +
            "اگر عددی در عنوان بود همان عدد را نگه دار (ارقام فارسی لازم نیست). " +
            'پاسخ فقط JSON معتبر: آرایه‌ای از {"i": شماره از صفر, "titleFa": "..."} — بدون هیچ متن اضافه.',
        },
        { role: "user", content: JSON.stringify(titles.map((t, i) => ({ i, t }))) },
      ],
      temperature: 0.2,
      max_tokens: 800,
    });
    const text = res.choices?.[0]?.message?.content ?? "";
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end <= start) return;
    const arr = JSON.parse(text.slice(start, end + 1)) as { i: number; titleFa: string }[];
    for (const r of arr) {
      if (items[r.i] && r.titleFa && r.titleFa.length > 3) items[r.i].titleFa = r.titleFa;
    }
  } catch {
    /* ترجمه اختیاری است — عنوان انگلیسی نمایش داده می‌شود */
  }
}

/* ---------- خلاصه‌ساز فارسی (بدون هوش مصنوعی — قطعی) ---------- */

function faNum(v: number | null): string {
  if (v === null || !isFinite(v)) return "—";
  return v.toLocaleString("fa-IR", { maximumFractionDigits: 2 });
}

export function synthesizeSummaryFa(lite: LiteForecast, fx: FxstreetBrief, tv: TvBrief): string[] {
  const out: string[] = [];

  if (tv.ok && tv.stateFa) {
    out.push(`رأی فنی تریدینگ‌ویو (روزانه): ${tv.stateFa}.`);
  } else {
    out.push("رأی فنی تریدینگ‌ویو در دسترس نبود.");
  }

  if (lite.ok) {
    if (lite.tomorrow.avg !== null || lite.tomorrow.high !== null) {
      out.push(
        `پیش‌بینی LiteFinance برای فردا: بازه ${faNum(lite.tomorrow.low)} تا ${faNum(lite.tomorrow.high)} ` +
          `با میانگین ${faNum(lite.tomorrow.avg)}.`
      );
    } else {
      out.push("پیش‌بینی روزانه LiteFinance قابل استخراج نبود.");
    }
    if (lite.baseScenario === "long" && lite.longAbove !== null) {
      out.push(
        `سناریوی اصلی گزارش: خرید بالای ${faNum(lite.longAbove)}` +
          (lite.stopLoss ? ` با حد ضرر ${faNum(lite.stopLoss)}` : "") +
          (lite.targets.length ? ` و هدف اول ${faNum(lite.targets[0])}.` : ".")
      );
    } else if (lite.baseScenario === "short" && lite.shortBelow !== null) {
      out.push(
        `سناریوی اصلی گزارش: فروش زیر ${faNum(lite.shortBelow)}` +
          (lite.stopLoss ? ` با حد ضرر ${faNum(lite.stopLoss)}` : "") +
          (lite.targets.length ? ` و هدف اول ${faNum(lite.targets[0])}.` : ".")
      );
    }
    if (lite.week.avg !== null) {
      out.push(`چشم‌انداز هفته: میانگین ${faNum(lite.week.avg)} در بازه ${faNum(lite.week.low)} تا ${faNum(lite.week.high)}.`);
    }
  } else {
    out.push("پیش‌بینی LiteFinance در دسترس نبود — برای اعداد به پنل دماسنج و ساختار بازار تکیه کنید.");
  }

  if (fx.ok && fx.poll.length) {
    const p = fx.poll[0];
    if (p.avg !== null || p.mixFa) {
      out.push(`نظرسنجی FXStreet برای ${p.periodFa}: میانگین ${faNum(p.avg)}${p.mixFa ? ` — ترکیب رأی‌ها: ${p.mixFa}` : ""}.`);
    }
  }

  /* جمع‌بندی هم‌راستایی منابع */
  const bullish: string[] = [];
  const bearish: string[] = [];
  if (tv.ok && tv.stateFa) {
    if (tv.stateFa.includes("خرید")) bullish.push("تریدینگ‌ویو");
    else if (tv.stateFa.includes("فروش")) bearish.push("تریدینگ‌ویو");
  }
  if (lite.ok && lite.baseScenario === "long") bullish.push("LiteFinance");
  else if (lite.ok && lite.baseScenario === "short") bearish.push("LiteFinance");
  if (fx.ok && fx.poll.length > 1) {
    const monthPoll = fx.poll[1];
    if (monthPoll.mixFa && /صعودی/.test(monthPoll.mixFa) && !/نزولی/.test(monthPoll.mixFa)) bullish.push("نظرسنجی FXStreet ماهانه");
    else if (monthPoll.mixFa && /نزولی/.test(monthPoll.mixFa) && !/صعودی/.test(monthPoll.mixFa)) bearish.push("نظرسنجی FXStreet ماهانه");
  }

  if (bullish.length && bearish.length) {
    out.push(`جمع‌بندی: منابع هم‌راستا با خرید (${bullish.join("، ")}) و هم‌راستا با فروش (${bearish.join("، ")}) در برابر هم هستند — مسیر تا شکست سطوح کلیدی دوپهلو است.`);
  } else if (bullish.length >= 2) {
    out.push(`جمع‌بندی: ${bullish.join("، ")} هم‌جهت با مسیر صعودی هستند — مراقب برگشت از سطوح مقاومت باشید.`);
  } else if (bearish.length >= 2) {
    out.push(`جمع‌بندی: ${bearish.join("، ")} هم‌جهت با مسیر نزولی هستند — مراقب برگشت از سطوح حمایت باشید.`);
  } else {
    out.push("جمع‌بندی: هم‌راستایی روشن بین منابع نیست — انتظار بازار رنج یا تردید را داشته باشید؛ نقشه مسیر در تب بعدی جزئیات را نشان می‌دهد.");
  }

  return out;
}

/* ---------- خروجی کامل با کش ---------- */

const TTL_MS = 30 * 60 * 1000;
const FAIL_BACKOFF_MS = 10 * 60 * 1000;
const CACHE_KEY = "analysis_gold_v2";
const FAIL_KEY = "analysis_gold_fail";

const SOURCES_NOTE =
  "منابع: LiteFinance (پیش‌بینی روزانه/هفتگی طلا) · FXStreet (تحلیل‌ها و نظرسنجی) · تریدینگ‌ویو (رأی فنی روزانه). " +
  "سایت‌های منبع ممکن است به فاصله چند دقیقه یا با کمک پروکسی/آرشیو خوانده شوند؛ زمان دریافت هر بخش جداگانه ذکر می‌شود.";

export async function getGoldBriefing(force = false): Promise<GoldBriefing> {
  const now = Date.now();
  if (!force) {
    const raw = await getMeta(CACHE_KEY);
    if (raw) {
      try {
        const cached = JSON.parse(raw) as GoldBriefing;
        const age = now - new Date(cached.generatedAtISO).getTime();
        if (age < TTL_MS) return { ...cached, stale: false, ageMin: 0 };
      } catch {
        /* کش خراب */
      }
    }
    const lastFail = Number((await getMeta(FAIL_KEY)) || 0);
    if (lastFail > 0 && now - lastFail < FAIL_BACKOFF_MS) {
      /* در حالت backoff هم آخرین نسخه سالم را (اگر هست) کهنه برگردان */
      if (raw) {
        try {
          const cached = JSON.parse(raw) as GoldBriefing;
          const ageMin = Math.round((now - new Date(cached.generatedAtISO).getTime()) / 60000);
          return { ...cached, stale: true, ageMin };
        } catch {
          /* fallthrough */
        }
      }
    }
  }

  /* دریافت هم‌زمان هر سه منبع — هر کدام مستقل ممکن است شکست بخورد */
  const LITE_URL =
    "https://www.litefinance.org/blog/analysts-opinions/gold-price-prediction-forecast/daily-and-weekly/";
  const FX_URL = "https://www.fxstreet.com/commodities/gold";

  const [liteRes, fxRes, tvRes] = await Promise.allSettled([
    fetchTextChain(LITE_URL),
    fetchTextChain(FX_URL),
    fetchTvTechnicals("OANDA:XAUUSD", ["1d"]),
  ]);

  let lite: LiteForecast = {
    ok: false,
    via: "",
    reportedAtFa: null,
    baseScenario: null,
    baseScenarioFa: null,
    longAbove: null,
    shortBelow: null,
    stopLoss: null,
    targets: [],
    tomorrow: { low: null, avg: null, high: null },
    week: { low: null, avg: null, high: null },
    rsi: null,
  };
  if (liteRes.status === "fulfilled") {
    try {
      const parsed = parseLiteFinance(liteRes.value.text);
      lite = { ...parsed, via: liteRes.value.via };
    } catch (e) {
      lite.error = e instanceof Error ? e.message : "parse error";
    }
  } else {
    lite.error = liteRes.reason instanceof Error ? liteRes.reason.message : "fetch error";
  }

  let fx: FxstreetBrief = { ok: false, via: "", poll: [], items: [] };
  if (fxRes.status === "fulfilled") {
    try {
      const parsed = parseFxstreetGold(fxRes.value.text);
      fx = { ...parsed, via: fxRes.value.via };
    } catch (e) {
      fx.error = e instanceof Error ? e.message : "parse error";
    }
  } else {
    fx.error = fxRes.reason instanceof Error ? fxRes.reason.message : "fetch error";
  }

  let tv: TvBrief = { ok: false, stateFa: null };
  if (tvRes.status === "fulfilled" && tvRes.value) {
    const r = tvRes.value.ratings["1d"];
    if (r) tv = { ok: true, stateFa: tvRatingToStateFa(r.all) };
  }

  /* ترجمه عناوین FXStreet (اختیاری) */
  await translateHeadlines(fx.items);

  /* fallback per-source: هر بخش قطع‌شده از اسنپ‌شات تاریخ‌دار داخلی پر می‌شود */
  if (!lite.ok && ANALYSIS_SNAPSHOT.lite.ok) {
    lite = { ...ANALYSIS_SNAPSHOT.lite, snapshot: true };
  }
  if (!fx.ok && ANALYSIS_SNAPSHOT.fx.ok) {
    fx = { ...ANALYSIS_SNAPSHOT.fx, snapshot: true };
  }

  const anything = lite.ok || fx.ok || tv.ok;
  if (!anything) {
    await setMeta(FAIL_KEY, String(now));
    /* آخرین نسخه سالم را کهنه برگردان */
    const raw = await getMeta(CACHE_KEY);
    if (raw) {
      try {
        const cached = JSON.parse(raw) as GoldBriefing;
        const ageMin = Math.round((now - new Date(cached.generatedAtISO).getTime()) / 60000);
        return { ...cached, stale: true, ageMin };
      } catch {
        /* fallthrough */
      }
    }
    /* هیچ تاریخچه‌ای نیست — اسنپ‌شات داخلی (با برچسب کهنگی و تاریخ گزارش) */
    return {
      ...ANALYSIS_SNAPSHOT,
      stale: true,
      ageMin: null,
      summaryFa: synthesizeSummaryFa(ANALYSIS_SNAPSHOT.lite, ANALYSIS_SNAPSHOT.fx, ANALYSIS_SNAPSHOT.tv),
    };
  }

  const summaryFa = synthesizeSummaryFa(lite, fx, tv);
  const briefing: GoldBriefing = {
    ok: true,
    stale: false,
    ageMin: 0,
    generatedAtISO: new Date().toISOString(),
    lite,
    fx,
    tv,
    summaryFa,
    sourcesNoteFa: SOURCES_NOTE,
  };
  await setMeta(CACHE_KEY, JSON.stringify(briefing));
  return briefing;
}
