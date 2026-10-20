import { NextResponse } from "next/server";
import { getMeta, setMeta } from "@/lib/ff";
import {
  yahooChart,
  aggregateCandles,
  symbolByKey,
  spotBasis,
  shiftPrice,
  type UCandle,
} from "@/lib/market-data";
import { computeThermometer, thermometerReliable } from "@/lib/pressure-thermometer";
import { h4PhaseSec } from "@/lib/scalp-engine";
import {
  fetchTvTechnicals,
  tvRatingToScore,
  tvRatingToDir,
  tvRatingToStateFa,
  type TvTfRating,
} from "@/lib/tv-technicals";

export const dynamic = "force-dynamic";

/**
 * API دماسنج فشار خرید/فروش (/api/pressure?symbol=xau|dji&tf=1d|4h|1h&force=1) — نسخه ۲
 *
 * منبع رأی فنی (طبق درخواست کاربر، پیام ۲۱): تریدینگ‌ویو Technicals
 *   → تلاش اول: scanner عمومی تریدینگ‌ویو (همان منبع صفحه technicals نماد).
 *   → تلاش دوم (فقط اگر TV در دسترس نبود): موتور محلی روی کندل‌های لایه واحد.
 * قیمت نمایشی همیشه از لایه واحد market-data (Yahoo + کالیبراسیون اسپات) می‌آید،
 * بنابراین «یک منبع قیمت» در تمام صفحات حفظ می‌شود؛ TV فقط رأی می‌دهد، قیمت نه.
 * خروجی فقط «نتیجه» است: عدد دماسنج، سه حالت فشار، اجماع و جمله راهنما — بدون فرمول.
 */

const TTL_MS = 15 * 60 * 1000;
const FAIL_BACKOFF_MS = 3 * 60 * 1000;
const MIN_BARS = 60;

const TV_SOURCE_NOTE = "منبع رأی: تریدینگ‌ویو (Technical Rating — نوسانگرها + میانگین‌های متحرک)";
const LOCAL_SOURCE_NOTE = "منبع رأی: موتور محلی ابزار (اجماع ۱۶ اندیکاتور و اسیلاتور روی کندل‌ها) — تریدینگ‌ویو در دسترس نبود";

interface PressurePayload {
  ok: true;
  symbol: { key: string; labelFa: string };
  tvSymbol: string;
  tf: string;
  tfLabel: string;
  score: number;
  zone: string;
  zoneFa: string;
  dir: string;
  consensus: { total: number; buy: number; sell: number; neutral: number; sentenceFa: string };
  indicators: { id: string; nameFa: string; score: number; dir: string }[];
  guidanceFa: string;
  reliable: boolean;
  source: "tradingview" | "local";
  sourceNoteFa: string;
  price: { value: number | null; spotApplied: boolean; source: string };
  generatedAtISO: string;
  disclaimer: string;
}

const TF_DEFS: Record<string, { interval: string; range: string; agg4h: boolean; label: string }> = {
  "1d": { interval: "1d", range: "2y", agg4h: false, label: "روزانه" },
  "4h": { interval: "1h", range: "3mo", agg4h: true, label: "۴ ساعته" },
  "1h": { interval: "1h", range: "1mo", agg4h: false, label: "۱ ساعته" },
};

const TV_TF: Record<string, "1h" | "4h" | "1d"> = { "1h": "1h", "4h": "4h", "1d": "1d" };

/* ---------- سازنده خروجی از رأی تریدینگ‌ویو ---------- */

const ZONES: { min: number; zone: string; zoneFa: string }[] = [
  { min: 80, zone: "heavy-buy", zoneFa: "فشار خرید بسیار قوی" },
  { min: 60, zone: "buy", zoneFa: "فشار خرید" },
  { min: 40, zone: "neutral", zoneFa: "بازار خنثی" },
  { min: 20, zone: "sell", zoneFa: "فشار فروش" },
  { min: 0, zone: "heavy-sell", zoneFa: "فشار فروش بسیار قوی" },
];

function zoneOf(score: number) {
  return ZONES.find((z) => score >= z.min) ?? ZONES[ZONES.length - 1];
}

function tvGuidanceFa(zone: string, tfLabel: string): string {
  switch (zone) {
    case "heavy-buy":
      return `تریدینگ‌ویو اجماع خرید سنگین در تایم‌فریم ${tfLabel} نشان می‌دهد — مسیر کوتاه‌مدت متمایل به صعود است؛ برای ورود خرید، ورود در اصلاح به سمت سطوح حمایتی امن‌تر از تعقیب قیمت است.`;
    case "buy":
      return `تریدینگ‌ویو به خرید متمایل است در تایم‌فریم ${tfLabel} — فشار خرید مثبت اما نه سنگین؛ سیو سود پله‌ای و رعایت حد ضرر برای ادامه مسیر ضروری است.`;
    case "neutral":
      return `تریدینگ‌ویو در تایم‌فریم ${tfLabel} خنثی است — نه فشار خرید و نه فشار فروش غالب است؛ بازار در حال انتخاب مسیر است، معامله در مرزهای محدوده یا صبر برای شکست مشخص، منطقی‌تر است.`;
    case "sell":
      return `تریدینگ‌ویو به فروش متمایل است در تایم‌فریم ${tfLabel} — فشار فروش مثبت اما نه سنگین؛ برای فروش، برگشت‌های قیمت به سمت مقاومت فرصت‌های کم‌ریسک‌تری هستند.`;
    default:
      return `تریدینگ‌ویو اجماع فروش سنگین در تایم‌فریم ${tfLabel} نشان می‌دهد — مسیر کوتاه‌مدت متمایل به نزول است؛ تلاش برای خرید در برابر این فشار پرریسک است.`;
  }
}

function buildTvPayload(
  def: { key: string; labelFa: string; tv: string },
  tf: string,
  tfLabel: string,
  rating: TvTfRating,
  displayPrice: number | null,
  spotApplied: boolean,
  priceSource: string,
  atISO: string
): PressurePayload {
  const score = tvRatingToScore(rating.all);
  const { zone, zoneFa } = zoneOf(score);
  const dir = tvRatingToDir(rating.all);

  const oscDir = tvRatingToDir(rating.other);
  const maDir = tvRatingToDir(rating.ma);
  const buy = (dir === "buy" ? 1 : 0) + (oscDir === "buy" ? 1 : 0) + (maDir === "buy" ? 1 : 0);
  const sell = (dir === "sell" ? 1 : 0) + (oscDir === "sell" ? 1 : 0) + (maDir === "sell" ? 1 : 0);
  const neutral = 3 - buy - sell;

  const sentenceFa =
    `اجماع تریدینگ‌ویو: کل «${tvRatingToStateFa(rating.all)}» · نوسانگرها «${tvRatingToStateFa(rating.other)}» · ` +
    `میانگین‌های متحرک «${tvRatingToStateFa(rating.ma)}»`;

  return {
    ok: true,
    symbol: { key: def.key, labelFa: def.labelFa },
    tvSymbol: def.tv,
    tf,
    tfLabel,
    score,
    zone,
    zoneFa,
    dir,
    consensus: { total: 3, buy, sell, neutral, sentenceFa },
    indicators: [
      { id: "tv-osc", nameFa: "نوسانگرها", score: rating.other, dir: oscDir },
      { id: "tv-ma", nameFa: "میانگین‌های متحرک", score: rating.ma, dir: maDir },
    ],
    guidanceFa: tvGuidanceFa(zone, tfLabel),
    reliable: true,
    source: "tradingview",
    sourceNoteFa: TV_SOURCE_NOTE,
    price: { value: displayPrice, spotApplied, source: priceSource },
    generatedAtISO: atISO,
    disclaimer: "دماسنج فشار، احتمال‌سنج مومنتوم لحظه بازار است — نه پیش‌بینی قطعی و نه توصیه خرید/فروش.",
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symKey = url.searchParams.get("symbol") ?? "xau";
  const tf = url.searchParams.get("tf") ?? "1d";
  const force = url.searchParams.get("force") === "1";

  const def = symbolByKey(symKey);
  const tfDef = TF_DEFS[tf];
  if (!def || !tfDef) {
    return NextResponse.json({ ok: false, error: "نماد یا تایم‌فریم نامعتبر است" }, { status: 400 });
  }

  const cacheKey = `pressure_v2:${symKey}:${tf}`;
  const failKey = `pressure_fail:${symKey}:${tf}`;
  const now = Date.now();

  if (!force) {
    const raw = await getMeta(cacheKey);
    if (raw) {
      try {
        const cached = JSON.parse(raw) as PressurePayload;
        if (cached?.generatedAtISO && now - new Date(cached.generatedAtISO).getTime() < TTL_MS) {
          return NextResponse.json(cached, { headers: { "Cache-Control": "no-store" } });
        }
      } catch {
        /* کش خراب — محاسبه مجدد */
      }
    }
    const lastFail = Number((await getMeta(failKey)) || 0);
    if (lastFail > 0 && now - lastFail < FAIL_BACKOFF_MS) {
      return NextResponse.json(
        { ok: false, error: "دریافت داده لحظه‌ای ناموفق بود — چند دقیقه بعد تلاش کنید" },
        { status: 503 }
      );
    }
  }

  try {
    /* قیمت نمایشی — با همان کالیبراسیون اسپات، تا همه صفحات یک عدد ببینند */
    const fetched = await yahooChart(def.yahoo, tfDef.interval, tfDef.range);
    let candles: UCandle[] = fetched.candles;
    if (tfDef.agg4h) {
      const phase = h4PhaseSec(Math.floor(now / 1000), def.h4Anchor ?? "utc");
      candles = aggregateCandles(candles, 4 * 3600, phase);
    }
    if (candles.length < MIN_BARS) throw new Error(`not enough bars: ${candles.length}`);

    const rawPrice = fetched.price ?? candles[candles.length - 1].c;
    const basis = await spotBasis(def, rawPrice);
    const displayPrice = basis ? shiftPrice(rawPrice, basis) : rawPrice;
    const priceSource = basis
      ? `Yahoo (${fetched.tickerUsed}) + کالیبراسیون اسپات gold-api`
      : `Yahoo (${fetched.tickerUsed})`;
    const atISO = new Date().toISOString();

    /* تلاش اول: رأی فنی تریدینگ‌ویو (منبع دماسنج طبق درخواست کاربر) */
    let payload: PressurePayload | null = null;
    const tvTf = TV_TF[tf];
    if (def.tv && tvTf) {
      const tv = await fetchTvTechnicals(def.tv, [tvTf]);
      const rating = tv?.ratings[tvTf];
      if (rating) {
        payload = buildTvPayload(
          def,
          tf,
          tfDef.label,
          rating,
          displayPrice,
          basis !== null,
          priceSource,
          tv.fetchedAtISO ?? atISO
        );
      }
    }

    /* تلاش دوم: موتور محلی (فقط اگر تریدینگ‌ویو در دسترس نبود) */
    if (!payload) {
      const thermo = computeThermometer(candles);
      payload = {
        ok: true,
        symbol: { key: def.key, labelFa: def.labelFa },
        tvSymbol: def.tv,
        tf,
        tfLabel: tfDef.label,
        score: thermo.score,
        zone: thermo.zone,
        zoneFa: thermo.zoneFa,
        dir: thermo.dir,
        consensus: thermo.consensus,
        indicators: thermo.indicators.map((i) => ({
          id: i.id,
          nameFa: i.nameFa,
          score: i.score,
          dir: i.dir,
        })),
        guidanceFa: thermo.guidanceFa,
        reliable: thermometerReliable(thermo),
        source: "local",
        sourceNoteFa: LOCAL_SOURCE_NOTE,
        price: { value: displayPrice, spotApplied: basis !== null, source: priceSource },
        generatedAtISO: atISO,
        disclaimer: "دماسنج فشار، احتمال‌سنج مومنتوم لحظه بازار است — نه پیش‌بینی قطعی و نه توصیه خرید/فروش.",
      };
    }

    await setMeta(cacheKey, JSON.stringify(payload));
    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    await setMeta(failKey, String(now));
    return NextResponse.json(
      {
        ok: false,
        error:
          e instanceof Error
            ? `دریافت کندل‌ها ناموفق بود: ${e.message}`
            : "دریافت کندل‌ها ناموفق بود",
      },
      { status: 502 }
    );
  }
}
