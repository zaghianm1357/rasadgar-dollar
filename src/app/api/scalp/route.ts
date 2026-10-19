import { NextResponse } from "next/server";
import { getMeta, setMeta } from "@/lib/ff";
import { rangeCompression } from "@/lib/trader-engine";
import { runScalpEngine, type ScalpBar } from "@/lib/scalp-engine";

export const dynamic = "force-dynamic";

/**
 * API اسکلپ — پورت اندیکاتور کاربر (SBW + OB + ستاپ ۴ساعته + واگرایی)
 * ورودی: نماد + تایم‌فریم اسکلپ (۱/۵/۱۵ دقیقه) → کندل‌های Yahoo + تجمیع ۴ساعته
 * کش ۳ دقیقه‌ای؛ خروجی اطلاع‌رسانی است، نه سیگنال قطعی.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TTL_MS = 3 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const MIN_BARS = 80;

const SCALP_SYMBOLS: Record<string, { yahoo: string[]; label: string; mono: string }> = {
  xau: { yahoo: ["GC=F", "XAUUSD=X"], label: "طلا (اونس) — XAUUSD", mono: "XAUUSD · GC=F" },
  dji: { yahoo: ["^DJI", "YM=F"], label: "داوجونز — DJI", mono: "DJI · ^DJI" },
  xag: { yahoo: ["SI=F"], label: "نقره — XAGUSD", mono: "XAGUSD · SI=F" },
  eurusd: { yahoo: ["EURUSD=X"], label: "یورو/دلار — EURUSD", mono: "EURUSD" },
  btc: { yahoo: ["BTC-USD"], label: "بیت‌کوین — BTC", mono: "BTCUSDT · BTC-USD" },
};

const SCALP_TFS: Record<string, { interval: string; range: string; label: string }> = {
  "1m": { interval: "1m", range: "2d", label: "۱ دقیقه" },
  "5m": { interval: "5m", range: "5d", label: "۵ دقیقه" },
  "15m": { interval: "15m", range: "1mo", label: "۱۵ دقیقه" },
};

function num(v: unknown): number | null {
  return typeof v === "number" && isFinite(v) ? v : null;
}

async function fetchCandles(symbol: string, interval: string, range: string): Promise<ScalpBar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=${interval}&range=${range}&includePrePost=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        indicators?: { quote?: Array<{ open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }> | null };
      }> | null;
    };
  };
  const r = json.chart?.result?.[0];
  const q = r?.indicators?.quote?.[0] ?? {};
  const ts = r?.timestamp;
  if (!r || !Array.isArray(ts) || ts.length === 0) throw new Error("empty chart response");
  const bars: ScalpBar[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = num(q.open?.[i]);
    const h = num(q.high?.[i]);
    const l = num(q.low?.[i]);
    const c = num(q.close?.[i]);
    if (o === null || h === null || l === null || c === null) continue;
    bars.push({ t: ts[i], o, h, l, c });
  }
  if (bars.length < MIN_BARS) throw new Error(`not enough bars: ${bars.length}`);
  return bars;
}

function aggregate4h(bars: ScalpBar[]): ScalpBar[] {
  const BUCKET = 4 * 3600;
  const map = new Map<number, ScalpBar>();
  for (const b of bars) {
    const k = Math.floor(b.t / BUCKET) * BUCKET;
    const ex = map.get(k);
    if (!ex) map.set(k, { t: k, o: b.o, h: b.h, l: b.l, c: b.c });
    else {
      if (b.h > ex.h) ex.h = b.h;
      if (b.l < ex.l) ex.l = b.l;
      ex.c = b.c;
    }
  }
  return [...map.values()].sort((a, b) => a.t - b.t);
}

interface ScalpCache {
  generatedAtISO: string;
  payload: Record<string, unknown>;
}

async function computeScalp(symbol: string, tf: string): Promise<ScalpCache> {
  const symSpec = SCALP_SYMBOLS[symbol];
  const tfSpec = SCALP_TFS[tf];
  if (!symSpec || !tfSpec) throw new Error("unsupported symbol/tf");

  let bars: ScalpBar[] | null = null;
  let lastErr: Error | null = null;
  for (const y of symSpec.yahoo) {
    try {
      bars = await fetchCandles(y, tfSpec.interval, tfSpec.range);
      break;
    } catch (err) {
      lastErr = err as Error;
    }
  }
  if (!bars) throw new Error(`yahoo failed: ${lastErr?.message ?? "unknown"}`);

  let h4: ScalpBar[] | null = null;
  try {
    const raw1h = await fetchCandles(symSpec.yahoo[0], "1h", "3mo");
    h4 = aggregate4h(raw1h);
  } catch {
    h4 = null;
  }

  const engine = runScalpEngine(bars, h4, tfSpec.label);
  const range = rangeCompression(bars.map((b) => b.h), bars.map((b) => b.l), bars.map((b) => b.c));

  return {
    generatedAtISO: new Date().toISOString(),
    payload: {
      ok: true,
      symbol,
      symbolLabel: symSpec.label,
      symbolMono: symSpec.mono,
      tf,
      tfLabel: tfSpec.label,
      engine: engine as unknown as Record<string, unknown>,
      rangeWarning: range,
    },
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") ?? "xau").toLowerCase();
  const tf = (url.searchParams.get("tf") ?? "5m").toLowerCase();
  const force = url.searchParams.get("force") === "1";
  const key = `scalp_v1:${symbol}:${tf}`;

  if (!force) {
    try {
      const raw = await getMeta(key);
      if (raw) {
        const obj = JSON.parse(raw) as ScalpCache;
        if (obj?.payload && Date.now() - new Date(obj.generatedAtISO).getTime() < TTL_MS) {
          return NextResponse.json({ ...obj.payload, generatedAtISO: obj.generatedAtISO, cached: true });
        }
      }
    } catch {
      /* کش در دسترس نیست — محاسبه تازه */
    }
  }

  try {
    const out = await computeScalp(symbol, tf);
    try {
      await setMeta(key, JSON.stringify(out));
    } catch {
      /* کش نشد — مهم نیست */
    }
    return NextResponse.json({ ...out.payload, generatedAtISO: out.generatedAtISO, cached: false });
  } catch (err) {
    return NextResponse.json({ ok: false, error: `محاسبه اسکلپ ناموفق بود: ${(err as Error).message}` }, { status: 502 });
  }
}
