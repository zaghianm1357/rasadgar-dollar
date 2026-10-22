import { NextResponse } from "next/server";
import { SYMBOL_REGISTRY, yahooChart } from "@/lib/market-data";

export const dynamic = "force-dynamic";

/**
 * API کندل خام — لایه واحد market-data (همان منبع همه صفحات)
 * ورودی: symbol (کلید رجیستری) + tf (15m | 1h)
 * کاربرد: اسنپ‌شات ساختِ فایل مستقل (fallback آفلاین اپ «سبک‌های اسکلپ»)
 * کش ۳ دقیقه‌ای؛ خروجی فقط کندل است — هیچ توصیه‌ای ندارد.
 */

const TTL_MS = 3 * 60 * 1000;

const TF_CFG: Record<string, { interval: string; range: string }> = {
  "15m": { interval: "15m", range: "5d" },
  "1h": { interval: "1h", range: "3mo" },
};

type BarsCache = { at: number; data: Record<string, unknown> };
const cache = new Map<string, BarsCache>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = (url.searchParams.get("symbol") ?? "xau").toLowerCase();
  const tf = url.searchParams.get("tf") ?? "15m";

  const def = SYMBOL_REGISTRY[key];
  if (!def) return NextResponse.json({ ok: false, error: "unknown-symbol" }, { status: 400 });
  const cfg = TF_CFG[tf];
  if (!cfg) return NextResponse.json({ ok: false, error: "unknown-tf" }, { status: 400 });

  const ck = `${key}:${tf}`;
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json({ ...hit.data, cached: true });
  }

  try {
    const { candles } = await yahooChart(def.yahoo, cfg.interval, cfg.range);
    if (!candles.length) throw new Error("empty");
    const data = {
      ok: true,
      symbol: key,
      label: def.labelFa,
      tf,
      generatedAtISO: new Date().toISOString(),
      bars: candles.map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c })),
    };
    cache.set(ck, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch-failed" },
      { status: 502 }
    );
  }
}
