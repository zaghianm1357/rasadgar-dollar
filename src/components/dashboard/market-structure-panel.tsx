"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  MoveHorizontal,
  RefreshCw,
  Minus,
  AlertTriangle,
} from "lucide-react";
import type {
  MarketStructureResponse,
  MSSymbol,
  MSRow,
  MSTimeframe,
  MSTrend,
} from "@/lib/types";
import { faDigits, faTime } from "@/lib/tehran";

const CLIENT_REFRESH_MS = 5 * 60 * 1000; // کلاینت هر ۵ دقیقه می‌پرسد؛ سرور کش ۱۵ دقیقه‌ای دارد

const TF_LABEL: Record<MSTimeframe, string> = {
  "15m": "۱۵ دقیقه",
  "1h": "۱ ساعته",
  "4h": "۴ ساعته",
  "1d": "روزانه",
  "1wk": "هفتگی",
  "1mo": "ماهانه",
};

const TF_ORDER: MSTimeframe[] = ["15m", "1h", "4h", "1d", "1wk", "1mo"];

/* ---------- نشان روند ---------- */
function TrendPill({ trend }: { trend: MSTrend | null }) {
  if (trend === "bullish")
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/12 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
        <TrendingUp className="h-3.5 w-3.5" />
        صعودی
      </span>
    );
  if (trend === "bearish")
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/12 px-2 py-0.5 text-[11px] font-bold text-rose-400">
        <TrendingDown className="h-3.5 w-3.5" />
        نزولی
      </span>
    );
  if (trend === "neutral")
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-zinc-500/30 bg-zinc-500/12 px-2 py-0.5 text-[11px] font-bold text-zinc-400">
        <MoveHorizontal className="h-3.5 w-3.5" />
        خنثی
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
      <Minus className="h-3.5 w-3.5" />
      ناکافی
    </span>
  );
}

function maDesc(ma: MSTrend | null): string {
  if (ma === "bullish") return "EMA صعودی";
  if (ma === "bearish") return "EMA نزولی";
  if (ma === "neutral") return "EMA خنثی";
  return "—";
}

function swingDesc(sw: MSTrend | null): string {
  if (sw === "bullish") return "سقف/کف بالاتر";
  if (sw === "bearish") return "سقف/کف پایین‌تر";
  if (sw === "neutral") return "ساختار مخلوط";
  return "—";
}

/* ---------- سلول هر تایم‌فریم ---------- */
function TFCell({ row }: { row: MSRow }) {
  return (
    <td className="px-1.5 py-2.5 sm:px-3">
      <div className="flex flex-col items-center gap-0.5">
        <TrendPill trend={row.trend} />
        {row.trend && row.trend !== "neutral" && row.strength > 0 ? (
          <span className="text-[9px] font-bold text-muted-foreground">
            قدرت {faDigits(row.strength)}٪
          </span>
        ) : null}
        {row.trend !== null && (
          <span className="text-[9px] leading-3 text-muted-foreground/70">
            {maDesc(row.ma)} · {swingDesc(row.swing)}
          </span>
        )}
      </div>
    </td>
  );
}

/* ---------- سربرگ هر نماد: قیمت + تغییر ---------- */
function SymbolHeader({ title, sym, mono }: { title: string; sym: MSSymbol | null; mono: string }) {
  const price =
    sym?.price != null
      ? faDigits(sym.price.toLocaleString("en-US", { maximumFractionDigits: 2 })).replace(/,/g, "٬")
      : null;
  const ch = sym?.changePct;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/25 px-2.5 py-2">
      <div className="min-w-0">
        <div className="truncate text-[11px] font-bold">{title}</div>
        <div dir="ltr" className="text-start font-mono text-[9px] text-muted-foreground">
          {mono}
        </div>
      </div>
      <div className="flex flex-col items-end">
        {price ? (
          <span dir="ltr" className="text-sm font-bold tabular-nums">
            {price}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
        {ch != null && sym?.price != null && (
          <span
            className={`text-[10px] font-bold tabular-nums ${
              ch > 0 ? "text-emerald-400" : ch < 0 ? "text-rose-400" : "text-zinc-400"
            }`}
          >
            {faDigits(`${ch > 0 ? "+" : ""}${ch.toFixed(2)}%`)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------- جمع‌بندی هر نماد ---------- */
function SummaryLine({ sym }: { sym: MSSymbol | null }) {
  if (!sym) return null;
  const b = sym.rows.filter((r) => r.trend === "bullish").length;
  const s = sym.rows.filter((r) => r.trend === "bearish").length;
  const n = sym.rows.filter((r) => r.trend === "neutral").length;
  if (b + s + n === 0) return null;
  const dominant =
    b + s === 0 ? "بدون روند غالب" : b === s ? "روند مخلوط" : b > s ? "غالب: صعودی" : "غالب: نزولی";
  return (
    <p className="text-[10px] leading-4 text-muted-foreground">
      جمع‌بندی: <b className="text-emerald-400">{faDigits(b)} صعودی</b> ·{" "}
      <b className="text-rose-400">{faDigits(s)} نزولی</b> ·{" "}
      <b className="text-zinc-400">{faDigits(n)} خنثی</b> — {dominant}
    </p>
  );
}

export function MarketStructurePanel() {
  const [data, setData] = useState<MarketStructureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const lastFetchRef = useRef(0);

  const fetchMS = useCallback(async (force: boolean) => {
    if (force) setRefreshing(true);
    try {
      const res = await fetch(force ? "/api/market-structure?force=1" : "/api/market-structure", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as MarketStructureResponse;
      setData(json);
      setFailed(json.status === "error" || (!json.xau && !json.dji));
      lastFetchRef.current = Date.now();
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMS(false);
  }, [fetchMS]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchMS(false);
    }, CLIENT_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchMS]);

  const statusMeta = (() => {
    if (!data) return null;
    if (data.status === "live")
      return { label: "داده زنده", cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" };
    if (data.status === "cached")
      return { label: "کش ۱۵ دقیقه‌ای", cls: "text-amber-400 border-amber-500/30 bg-amber-500/10" };
    return { label: "آخرین داده موجود", cls: "text-amber-400 border-amber-500/30 bg-amber-500/10" };
  })();

  const updated = data?.updatedAtISO ? faTime(new Date(data.updatedAtISO)) : null;
  const rowsByTf = new Map<MSTimeframe, { xau: MSRow | null; dji: MSRow | null }>();
  if (data) {
    for (const tf of TF_ORDER) {
      rowsByTf.set(tf, {
        xau: data.xau?.rows.find((r) => r.tf === tf) ?? null,
        dji: data.dji?.rows.find((r) => r.tf === tf) ?? null,
      });
    }
  }

  return (
    <Card className="animate-fade-up border-border/80 bg-card/90">
      <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
        {/* سربرگ */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/15">
            <Activity className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-extrabold leading-5">ساختار بازار (چند تایم‌فریمی)</h2>
            <p className="text-[10px] text-muted-foreground">
              ترکیب میانگین متحرک EMA۲۰/۵۰ و سقف/کف‌های سوئینگ — ۶ تایم‌فریم
            </p>
          </div>
          {statusMeta && (
            <span
              className={`hidden rounded-full border px-2 py-0.5 text-[10px] font-bold sm:inline-flex ${statusMeta.cls}`}
            >
              {statusMeta.label}
            </span>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchMS(true)}
            disabled={refreshing}
            aria-label="بروزرسانی ساختار بازار"
            className="h-9 w-9 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* حالت خطا */}
        {!loading && failed && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-center">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
            <p className="text-xs text-rose-300">
              دریافت داده‌های بازار (Yahoo Finance) ناموفق بود؛ دوباره تلاش کنید.
            </p>
            <Button variant="outline" size="sm" onClick={() => fetchMS(true)}>
              تلاش مجدد
            </Button>
          </div>
        )}

        {/* حالت بارگذاری */}
        {loading && !failed && (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        )}

        {/* جدول */}
        {!loading && data && !failed && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <SymbolHeader title="طلا" sym={data.xau} mono="XAUUSD · GC=F" />
              <SymbolHeader title="داوجونز" sym={data.dji} mono="DJI · ^DJI" />
            </div>

            <div className="overflow-hidden rounded-lg border border-border/70">
              <table className="w-full border-collapse text-center">
                <thead>
                  <tr className="bg-muted/40 text-[10px] text-muted-foreground">
                    <th className="px-2 py-2 text-start font-bold">تایم‌فریم</th>
                    <th className="px-1 py-2 font-bold">طلا — XAUUSD</th>
                    <th className="px-1 py-2 font-bold">داوجونز — DJI</th>
                  </tr>
                </thead>
                <tbody>
                  {TF_ORDER.map((tf) => {
                    const pair = rowsByTf.get(tf);
                    return (
                      <tr key={tf} className="border-t border-border/50">
                        <td className="px-2 py-2.5 text-start sm:px-3">
                          <span className="text-[11px] font-bold sm:text-xs">
                            {TF_LABEL[tf]}
                          </span>
                        </td>
                        <TFCell row={pair?.xau ?? { tf, trend: null, strength: 0, ma: null, swing: null, bars: 0 }} />
                        <TFCell row={pair?.dji ?? { tf, trend: null, strength: 0, ma: null, swing: null, bars: 0 }} />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-1">
              <SummaryLine sym={data.xau} />
              <SummaryLine sym={data.dji} />
            </div>

            <p className="text-[9px] leading-4 text-muted-foreground/70">
              روش تحلیل: رابطه EMA۲۰ و EMA۵۰ + موقعیت قیمت (امتیاز میانگین متحرک) به‌همراه مقایسه
              آخرین سقف‌ها و کف‌های سوئینگ HH/HL در برابر LH/LL (امتیاز ساختار) — مجموع ≥۲ صعودی،
              ≤−۲ نزولی، بین این دو خنثی. طلا بر مبنای فیوچرز COMEX (همبستگی نزدیک به اسپات
              XAUUSD)؛ آخرین کندل هر تایم‌فریم در حال شکل‌گیری است. بروزرسانی خودکار هر ۱۵ دقیقه
              {updated ? ` — آخرین محاسبه: ${updated}` : ""}. این تحلیل صرفاً اطلاع‌رسانی است و
              سیگنال معاملاتی نیست.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
