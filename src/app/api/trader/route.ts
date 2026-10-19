import { NextResponse } from "next/server";
import { getMeta, setMeta, refreshFeed } from "@/lib/ff";
import { getMarketStructure } from "@/lib/market-structure";
import type { MSRow, MSTrend, MSTimeframe } from "@/lib/types";
import {
  tfAlignmentFactor,
  newsGapFactor,
  dxyCorrelationFactor,
  atrFactor,
  confluenceScore,
  classifyRegime,
  divergenceStatus,
  buildScenarios,
  preMortemFactors,
  atrPct,
  pearson,
} from "@/lib/trader-engine";
import type { TrendDir, ScenarioEventInput } from "@/lib/trader-engine";
import type { TraderResponse, SymbolSpecItem } from "@/lib/trader-types";

export const dynamic = "force-dynamic";

/**
 * API دستیار معامله‌گر (BIG TRADER)
 * ترکیب: ساختار بازار چندتایم‌فریمی + DXY و US10Y از Yahoo + تقویم خبری + موتور همگرایی
 * همه خروجی‌ها اطلاع‌رسانی‌اند؛ هیچ سفارشی اجرا یا توصیه قطعی تولید نمی‌شود.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const TTL_MS = 5 * 60 * 1000;

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

function num(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

async function fetchChart(symbol: string, interval: string, range: string): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=${interval}&range=${range}&includePrePost=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: {
          quote?: Array<{
            open?: (number | null)[];
            high?: (number | null)[];
            low?: (number | null)[];
            close?: (number | null)[];
          }>;
        };
      }> | null;
    };
  };
  const r = json.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0] ?? {};
  const ts = r?.timestamp;
  if (!r || !Array.isArray(ts) || ts.length === 0) throw new Error("empty chart");
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = num(q.open?.[i]);
    const h = num(q.high?.[i]);
    const l = num(q.low?.[i]);
    const c = num(q.close?.[i]);
    if (o === null || h === null || l === null || c === null) continue;
    candles.push({ t: ts[i], o, h, l, c });
  }
  if (candles.length < 30) throw new Error("thin series");
  return candles;
}

function rsiLast(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d;
    else loss -= d;
  }
  let ag = gain / period;
  let al = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (al === 0) return ag === 0 ? 50 : 100;
  return 100 - 100 / (1 + ag / al);
}

function lastSwing(candles: Candle[], side: "high" | "low"): number | null {
  const lb = 2;
  const vals: number[] = [];
  for (let i = lb; i < candles.length - lb; i++) {
    let ok = true;
    for (let j = i - lb; j <= i + lb; j++) {
      if (j === i) continue;
      if (side === "high" && candles[j].h >= candles[i].h) ok = false;
      if (side === "low" && candles[j].l <= candles[i].l) ok = false;
      if (!ok) break;
    }
    if (ok) vals.push(side === "high" ? candles[i].h : candles[i].l);
  }
  return vals.length ? vals[vals.length - 1] : null;
}

/* ---------- تنظیمات نماد ---------- */

interface SymbolConf {
  key: "xau" | "dji";
  yahoo: string;
  name: string;
  healthyAtrBand: [number, number];
  contractSize: number;
  expectInverseDxy: boolean;
  specs: SymbolSpecItem[];
}

const SYMBOLS: Record<"xau" | "dji", SymbolConf> = {
  xau: {
    key: "xau",
    yahoo: "GC=F",
    name: "طلا — XAUUSD",
    healthyAtrBand: [0.7, 1.6],
    contractSize: 100,
    expectInverseDxy: true,
    specs: [
      { label: "بازار", value: "فارکس/فلزات گران‌بها (اسپات یا CFD)", needsConfirm: false },
      { label: "نوع دارایی", value: "جفت‌ارز فلز — XAU/USD", needsConfirm: false },
      { label: "ساعات معامله", value: "حدود ۲۳ ساعت در روز، ۵ روز در هفته (بسته به کارگزاری)", needsConfirm: true },
      { label: "اندازه قرارداد", value: "۱ لات استاندارد = ۱۰۰ اونس (معمول)", needsConfirm: true },
      { label: "ارزش هر پیپ (۰.۱ دلار حرکت)", value: "۱ دلار به ازای هر ۰.۱ لات", needsConfirm: true },
      { label: "حداقل حجم", value: "معمولاً ۰.۰۱ لات", needsConfirm: true },
      { label: "اسپرد معمول", value: "۱.۵ تا ۳.۵ سنت (وابسته به کارگزاری و زمان)", needsConfirm: true },
    ],
  },
  dji: {
    key: "dji",
    yahoo: "^DJI",
    name: "داوجونز — DJI",
    healthyAtrBand: [0.5, 1.3],
    contractSize: 1,
    expectInverseDxy: false,
    specs: [
      { label: "بازار", value: "شاخص سهام آمریکا (CFD یا فیوچرز YM)", needsConfirm: false },
      { label: "نوع دارایی", value: "شاخص — داوجونز صنعتی", needsConfirm: false },
      { label: "ساعات معامله", value: "CFD: حدود ۲۳ ساعته | فیوچرز: تقریباً ۲۳ ساعته با وقفه", needsConfirm: true },
      { label: "ارزش هر امتیاز", value: "در CFD معمول: ۱ دلار به ازای هر امتیاز به ازای هر ۱ لات", needsConfirm: true },
      { label: "حداقل حجم", value: "معمولاً ۰.۱ لات", needsConfirm: true },
    ],
  },
};

/* ---------- رویداد خبری ---------- */

interface NewsEventRow {
  id: string;
  title: string;
  titleFa: string | null;
  dateISO: string | null;
  impact: string;
  forecast: string | null;
  previous: string | null;
  xauAbove: TrendDir | "mixed" | null;
  xauBelow: TrendDir | "mixed" | null;
  djiAbove: TrendDir | "mixed" | null;
  djiBelow: TrendDir | "mixed" | null;
}

let newsFeedStatus = "cached";

async function dbEvents(): Promise<NewsEventRow[]> {
  const { db } = await import("@/lib/db");
  const from = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const rows = await db.economicEvent.findMany({
    where: { date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
    take: 120,
  });
  return rows.map((e) => ({
    id: e.eventKey,
    title: e.title,
    titleFa: e.titleFa,
    dateISO: e.date ? e.date.toISOString() : null,
    impact: e.impact,
    forecast: e.forecast,
    previous: e.previous,
    xauAbove: (e.xauAbove as NewsEventRow["xauAbove"]) ?? null,
    xauBelow: (e.xauBelow as NewsEventRow["xauBelow"]) ?? null,
    djiAbove: (e.djiAbove as NewsEventRow["djiAbove"]) ?? null,
    djiBelow: (e.djiBelow as NewsEventRow["djiBelow"]) ?? null,
  }));
}

/* ---------- واکنش تاریخی همان عنوان خبر ---------- */

async function computeHistory(title: string | null): Promise<TraderResponse["history"]> {
  if (!title) {
    return {
      available: false,
      reason: "خبر انتخابی برای مقایسه تاریخی وجود ندارد.",
      n: 0,
      windowDays: null,
      method: null,
      stats: null,
    };
  }
  try {
    const { db } = await import("@/lib/db");
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const past = await db.economicEvent.findMany({
      where: { title, actual: { not: null }, forecast: { not: null }, date: { lt: new Date(), gte: cutoff } },
      orderBy: { date: "desc" },
      take: 12,
    });
    if (past.length < 3) {
      return {
        available: false,
        reason: "نمونه تاریخی کافی نیست — تحلیل صرفاً کیفی و مشروط نگه داشته می‌شود.",
        n: past.length,
        windowDays: 30,
        method: null,
        stats: null,
      };
    }
    const gc = await fetchChart("GC=F", "1d", "1y").catch(() => null);
    if (!gc) {
      return {
        available: false,
        reason: "داده قیمت تاریخی نماد در دسترس نیست.",
        n: past.length,
        windowDays: 30,
        method: null,
        stats: null,
      };
    }
    const byDate = new Map<string, number>();
    for (const c of gc) byDate.set(new Date(c.t * 1000).toISOString().slice(0, 10), c.c);
    const dates = [...byDate.keys()].sort();
    const moves: number[] = [];
    for (const e of past) {
      if (!e.date) continue;
      const key = new Date(e.date).toISOString().slice(0, 10);
      const idx = dates.indexOf(key);
      if (idx < 1) continue;
      const prevClose = byDate.get(dates[idx - 1]);
      const postClose = byDate.get(dates[idx]) ?? byDate.get(dates[idx + 1]);
      if (!prevClose || !postClose) continue;
      moves.push(((postClose - prevClose) / prevClose) * 100);
    }
    if (moves.length < 3) {
      return {
        available: false,
        reason: "نمونه تاریخی کافی نیست (نمونه‌های قابل‌اتصال به قیمت کمتر از ۳ مورد است).",
        n: moves.length,
        windowDays: 30,
        method: null,
        stats: null,
      };
    }
    const avg = moves.reduce((s, v) => s + v, 0) / moves.length;
    const up = moves.filter((v) => v > 0).length;
    return {
      available: true,
      reason: null,
      n: moves.length,
      windowDays: 30,
      method: "تغییر درصدی بسته‌شدن روز خبر نسبت به بسته‌شدن روز قبل — فیوچرز GC=F",
      stats: {
        avgMovePct: Math.round(avg * 100) / 100,
        upPct: Math.round((up / moves.length) * 100),
        minPct: Math.round(Math.min(...moves) * 100) / 100,
        maxPct: Math.round(Math.max(...moves) * 100) / 100,
      },
    };
  } catch {
    return {
      available: false,
      reason: "خواندن تاریخچه از پایگاه داده ناموفق بود.",
      n: null,
      windowDays: null,
      method: null,
      stats: null,
    };
  }
}

/* ---------- محاسبه اصلی ---------- */

async function computeTrader(symbolKey: "xau" | "dji", newsEvents: NewsEventRow[]): Promise<TraderResponse> {
  const conf = SYMBOLS[symbolKey];
  const notes: string[] = [];

  const [ms, symDaily, dxyDaily, tnxDaily] = await Promise.all([
    getMarketStructure(),
    fetchChart(conf.yahoo, "1d", "1y").catch(() => null),
    fetchChart("DX-Y.NYB", "1d", "3mo").catch(() => null),
    fetchChart("^TNX", "1d", "1mo").catch(() => null),
  ]);

  const symData = ms[symbolKey];
  const dxyLast = dxyDaily?.[dxyDaily.length - 1];
  const dxyPrev = dxyDaily?.[dxyDaily.length - 2];
  const dxyChangePct = dxyLast && dxyPrev ? ((dxyLast.c - dxyPrev.c) / dxyPrev.c) * 100 : null;
  const tnxLast = tnxDaily?.[tnxDaily.length - 1];
  const tnxPrev = tnxDaily?.[tnxDaily.length - 2];
  const tnxChangePct = tnxLast && tnxPrev ? ((tnxLast.c - tnxPrev.c) / tnxPrev.c) * 100 : null;

  /* همبستگی ۳۰ بازده اخیر نماد و DXY با تراز تاریخ */
  let corr30: number | null = null;
  if (symDaily && dxyDaily) {
    const byDate = new Map<string, number>();
    for (const c of dxyDaily) byDate.set(new Date(c.t * 1000).toISOString().slice(0, 10), c.c);
    const a: number[] = [];
    const b: number[] = [];
    for (let i = 1; i < symDaily.length; i++) {
      const d0 = new Date(symDaily[i - 1].t * 1000).toISOString().slice(0, 10);
      const d1 = new Date(symDaily[i].t * 1000).toISOString().slice(0, 10);
      const y0 = byDate.get(d0);
      const y1 = byDate.get(d1);
      if (y0 === undefined || y1 === undefined || symDaily[i - 1].c === 0) continue;
      a.push((symDaily[i].c - symDaily[i - 1].c) / symDaily[i - 1].c);
      b.push((y1 - y0) / y0);
    }
    corr30 = pearson(a, b);
  }

  /* ساختار چندتایم‌فریمی */
  const rows: MSRow[] = symData?.rows ?? [];
  const pick = (tf: MSTimeframe): MSTrend | null => rows.find((r) => r.tf === tf)?.trend ?? null;
  const dirs: TrendDir[] = [pick("15m") ?? "neutral", pick("1h") ?? "neutral", pick("4h") ?? "neutral"];
  const tfFactor = tfAlignmentFactor(dirs);
  const structure4h = pick("4h");
  const trendFa = (t: MSTrend | null) =>
    t === "bullish" ? "صعودی" : t === "bearish" ? "نزولی" : t === "neutral" ? "خنثی" : "—";
  const summaryFa = tfFactor.score >= 40 ? "هم‌جهت" : tfFactor.score > 0 ? "مختلط" : "متضاد";
  const detail =
    tfFactor.score >= 40
      ? `تایم‌فریم‌های ۱۵ دقیقه (${trendFa(dirs[0])})، ۱ ساعته (${trendFa(dirs[1])}) و ۴ ساعته (${trendFa(dirs[2])}) هم‌جهت‌اند — برداشت تداوم مشروط به حفظ سطوح است، نه تضمین.`
      : tfFactor.score > 0
        ? `دو تایم‌فریم هم‌جهت و یک تایم‌فریم خنثی است (۱۵د: ${trendFa(dirs[0])} | ۱س: ${trendFa(dirs[1])} | ۴س: ${trendFa(dirs[2])}) — برداشت از وضعیت تأییدشده جداست.`
        : `تایم‌فریم‌ها متضادند (۱۵د: ${trendFa(dirs[0])} | ۱س: ${trendFa(dirs[1])} | ۴س: ${trendFa(dirs[2])}) — در تضاد ساختاری، سیگنال کوتاه‌مدت پایداری کمتری دارد.`;

  /* اندیکاتورهای روزانه + سطوح */
  const closes = symDaily?.map((c) => c.c) ?? [];
  const highs = symDaily?.map((c) => c.h) ?? [];
  const lows = symDaily?.map((c) => c.l) ?? [];
  const atrPctDaily = closes.length > 20 ? atrPct(highs, lows, closes) : null;
  const regime = classifyRegime(closes.slice(-60), atrPctDaily, conf.healthyAtrBand);
  const rsi = closes.length > 20 ? rsiLast(closes) : null;
  const recent = symDaily?.slice(-20) ?? [];
  const resistance = recent.length ? Math.max(...recent.map((c) => c.h)) : null;
  const support = recent.length ? Math.min(...recent.map((c) => c.l)) : null;

  /* خلأ خبری */
  const now = Date.now();
  let nextHigh: NewsEventRow | null = null;
  for (const e of newsEvents) {
    if (!e.dateISO || e.impact !== "High") continue;
    const t = new Date(e.dateISO).getTime();
    if (t <= now) continue;
    if (!nextHigh || t < new Date(nextHigh.dateISO!).getTime()) nextHigh = e;
  }
  const minutesLeft = nextHigh ? (new Date(nextHigh.dateISO!).getTime() - now) / 60000 : null;
  const newsFactor = newsGapFactor(minutesLeft);

  /* موتور همگرایی + واگرایی */
  const dxyFactor = dxyCorrelationFactor(corr30, conf.expectInverseDxy);
  const atrF = atrFactor(atrPctDaily, conf.healthyAtrBand);
  const confluence = confluenceScore({ tf: tfFactor, news: newsFactor, dxy: dxyFactor, atr: atrF });
  const divergence = divergenceStatus(symData?.changePct ?? null, dxyChangePct, corr30);

  /* سناریوهای خبری مشروط */
  let scenarios: TraderResponse["scenarios"] = { items: [], conflict: null };
  if (nextHigh) {
    const ev: ScenarioEventInput = {
      titleFa: nextHigh.titleFa,
      title: nextHigh.title,
      impact: nextHigh.impact,
      forecast: nextHigh.forecast,
      previous: nextHigh.previous,
      xauAbove: nextHigh.xauAbove,
      xauBelow: nextHigh.xauBelow,
      djiAbove: nextHigh.djiAbove,
      djiBelow: nextHigh.djiBelow,
    };
    const built = buildScenarios(ev, structure4h, {
      resistance: resistance !== null ? Math.round(resistance * 100) / 100 : null,
      support: support !== null ? Math.round(support * 100) / 100 : null,
    });
    scenarios = { items: built.scenarios, conflict: built.conflict };
  }

  const history = await computeHistory(nextHigh?.title ?? null);

  const preMortem = preMortemFactors({
    side: null,
    structure4h,
    tfAlignment: tfFactor,
    newsMinutes: minutesLeft,
    divergence,
    regime,
    rsi,
  });

  if (symData === null) notes.push("ساختار بازار این نماد در محاسبه آخر سرور در دسترس نبود.");
  if (dxyDaily === null) notes.push("داده DXY دریافت نشد — پنل همبستگی غیرفعال است.");

  return {
    ok: true,
    generatedAtISO: new Date().toISOString(),
    dataQuality: {
      structure: ms.status,
      structureAtISO: ms.updatedAtISO,
      prices: "live",
      events: newsFeedStatus,
      correlation: corr30 !== null ? "live" : "missing",
      notes: [
        ...notes,
        "قیمت نماد از فیوچرز/شاخص Yahoo Finance خوانده می‌شود — همبستگی نزدیک ولی نه برابر نماد اسپات.",
        "همبستگی تاریخی به‌معنای رابطه علّی یا تضمین حرکت آینده نیست.",
      ],
    },
    symbol: {
      key: conf.key,
      name: conf.name,
      price: symData?.price ?? (closes.length ? closes[closes.length - 1] : null),
      changePct: symData?.changePct ?? null,
      specs: conf.specs,
      healthyAtrBand: conf.healthyAtrBand,
      contractSize: conf.contractSize,
      expectInverseDxy: conf.expectInverseDxy,
    },
    dxy: {
      price: dxyLast?.c ?? null,
      changePct: dxyChangePct,
      corr30: corr30 !== null ? Math.round(corr30 * 100) / 100 : null,
      corrWindow: "۳۰ بازده روزانه آخر",
      updatedAtISO: dxyLast ? new Date(dxyLast.t * 1000).toISOString() : null,
    },
    us10y: { price: tnxLast?.c ?? null, changePct: tnxChangePct },
    structure: {
      rows: rows.filter((r) => ["15m", "1h", "4h", "1d"].includes(r.tf)),
      summary: summaryFa === "هم‌جهت" ? "aligned" : summaryFa === "مختلط" ? "mixed" : "conflict",
      summaryFa,
      detail,
      resistance: resistance !== null ? Math.round(resistance * 100) / 100 : null,
      support: support !== null ? Math.round(support * 100) / 100 : null,
    },
    regime,
    divergence,
    newsGap: {
      minutesLeft: minutesLeft !== null ? Math.round(minutesLeft) : null,
      event: nextHigh
        ? {
            id: nextHigh.id,
            title: nextHigh.title,
            titleFa: nextHigh.titleFa,
            dateISO: nextHigh.dateISO,
            impact: nextHigh.impact,
            forecast: nextHigh.forecast,
            previous: nextHigh.previous,
          }
        : null,
    },
    confluence,
    rsi,
    scenarios,
    history,
    preMortem: {
      factors: preMortem,
      balanceNote: "شواهد موافق و مخالف با هم نمایش داده می‌شوند؛ ابزار صرفاً نظر اولیه شما را تأیید نمی‌کند.",
    },
    checklistAuto: {
      newsNear: minutesLeft !== null && minutesLeft < 240,
      tfSummary: summaryFa,
      dxyCompatible: divergence.level === "normal",
      dataFresh: ms.status === "live" || ms.status === "cached",
    },
  };
}

/* ---------- قفل، کش و Route ---------- */

const traderLock: { current: Promise<unknown> } = { current: Promise.resolve() };
function runExclusive<T>(lock: { current: Promise<unknown> }, fn: () => Promise<T>): Promise<T> {
  const p = lock.current.then(fn, fn);
  lock.current = p.catch(() => undefined);
  return p;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbolKey = (url.searchParams.get("symbol") || "xau") as "xau" | "dji";
  const force = url.searchParams.get("force") === "1";
  if (!SYMBOLS[symbolKey]) {
    return NextResponse.json({ ok: false, error: "نماد پشتیبانی نمی‌شود" }, { status: 400 });
  }
  const cacheKey = `trader_cache_v1:${symbolKey}`;

  try {
    const feed = await refreshFeed();
    newsFeedStatus = feed.status;
    const events = await dbEvents();

    if (!force) {
      const cached = await getMeta(cacheKey);
      if (cached) {
        try {
          const obj = JSON.parse(cached) as TraderResponse & { _cacheAt: number };
          if (obj._cacheAt && Date.now() - obj._cacheAt < TTL_MS) {
            return NextResponse.json({ ...obj, cached: true }, { headers: { "Cache-Control": "no-store" } });
          }
        } catch {
          /* کش نامعتبر */
        }
      }
    }

    const resp = await runExclusive(traderLock, async () => computeTrader(symbolKey, events));
    await setMeta(cacheKey, JSON.stringify({ ...resp, _cacheAt: Date.now() }));
    return NextResponse.json(resp, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[trader] failed:", (err as Error).message);
    return NextResponse.json(
      { ok: false, error: "دریافت داده دستیار معامله‌گر ناموفق بود — کمی بعد دوباره تلاش کنید." },
      { status: 502 }
    );
  }
}
