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

export const dynamic = "force-dynamic";

/**
 * API دماسنج فشار خرید/فروش (/api/pressure?symbol=xau|dji&tf=1d|4h|1h&force=1)
 * منبع داده: لایه واحد market-data — همان منبع همه صفحات و موتورهای ابزار.
 * خروجی فقط «نتیجه» است: عدد دماسنج، ناحیه، اجماع اندیکاتورها و جمله راهنما.
 */

const TTL_MS = 15 * 60 * 1000;
const FAIL_BACKOFF_MS = 3 * 60 * 1000;
const MIN_BARS = 60;

interface PressurePayload {
  ok: true;
  symbol: { key: string; labelFa: string };
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
  price: { value: number | null; spotApplied: boolean; source: string };
  generatedAtISO: string;
  disclaimer: string;
}

const TF_DEFS: Record<string, { interval: string; range: string; agg4h: boolean; label: string }> = {
  "1d": { interval: "1d", range: "2y", agg4h: false, label: "روزانه" },
  "4h": { interval: "1h", range: "3mo", agg4h: true, label: "۴ ساعته" },
  "1h": { interval: "1h", range: "1mo", agg4h: false, label: "۱ ساعته" },
};

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

  const cacheKey = `pressure_v1:${symKey}:${tf}`;
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
    const fetched = await yahooChart(def.yahoo, tfDef.interval, tfDef.range);
    let candles: UCandle[] = fetched.candles;
    if (tfDef.agg4h) {
      const phase = h4PhaseSec(Math.floor(Date.now() / 1000), def.h4Anchor ?? "utc");
      candles = aggregateCandles(candles, 4 * 3600, phase);
    }
    if (candles.length < MIN_BARS) throw new Error(`not enough bars: ${candles.length}`);

    const thermo = computeThermometer(candles);

    /* قیمت نمایشی — با همان کالیبراسیون اسپات پنل اسکلپ، تا همه صفحات یک عدد ببینند */
    const rawPrice = fetched.price ?? candles[candles.length - 1].c;
    const basis = await spotBasis(def, rawPrice);
    const displayPrice = basis ? shiftPrice(rawPrice, basis) : rawPrice;

    const payload: PressurePayload = {
      ok: true,
      symbol: { key: def.key, labelFa: def.labelFa },
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
      price: {
        value: displayPrice,
        spotApplied: basis !== null,
        source: basis
          ? `Yahoo (${fetched.tickerUsed}) + کالیبراسیون اسپات gold-api`
          : `Yahoo (${fetched.tickerUsed})`,
      },
      generatedAtISO: new Date().toISOString(),
      disclaimer: "دماسنج فشار، احتمال‌سنج مومنتوم لحظه بازار است — نه پیش‌بینی قطعی و نه توصیه خرید/فروش.",
    };

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
