"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Briefcase,
  Check,
  ClipboardCopy,
  Compass,
  Gauge,
  LoaderCircle,
  Newspaper,
  RefreshCw,
  ShieldAlert,
  Sigma,
  SlidersHorizontal,
  Target,
  Trash2,
} from "lucide-react";
import { faTime, faDigits } from "@/lib/tehran";
import { currencyFa } from "@/lib/currency-fa";
import { computeTradePlan, decisionQuality, refreshNudge, restSuggestion, revengeLock } from "@/lib/trader-engine";
import { compositeScore, compositeLabelFa } from "@/lib/factor-quant";
import type { RangeWarning, EntryZone } from "@/lib/trader-engine";
import type { PlanOutput } from "@/lib/trader-engine";
import type { TraderResponse } from "@/lib/trader-types";
import type { FactorQuantResponse, FactorRow } from "@/lib/factor-types";

/* ---------- کلیدهای ذخیره‌سازی ---------- */

const K_JOURNAL = "bt_journal_v1";
const K_VISIT = "bt_visit_v1";
const K_REFRESH = "bt_refresh_v1";
const K_PLAN = "bt_plan_v1";
const K_LASTLOSS = "bt_last_loss_v1";
const K_POSITIONS = "bt_positions_v1";
const K_FWEIGHTS = "bt_fw_v1";

interface JournalEntry {
  id: string;
  atISO: string;
  reason: string;
  scenario: string;
  invalidation: string;
  expectation: string;
  dxyRole: string;
  side: "buy" | "sell" | null;
  entry: string;
  result: "win" | "loss" | "be" | null;
  review: { followedPlan: boolean; riskRespected: boolean; slMovedBadly: boolean; assumptionViolated: boolean } | null;
}

interface Position {
  id: string;
  sym: string;
  side: "buy" | "sell";
  lots: number;
  riskUsd: number;
}

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function lsSet(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* حالت ناشناس */
  }
}

function faNum(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return faDigits(Number(v.toFixed(digits)).toLocaleString("en-US", { maximumFractionDigits: digits })).replace(/,/g, "٬");
}
function faPct(v: number | null | undefined): string {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return (v > 0 ? "+" : "") + faNum(v) + "٪";
}

const TF_FA: Record<string, string> = { "15m": "۱۵ دقیقه", "1h": "۱ ساعته", "4h": "۴ ساعته", "1d": "روزانه" };
const TREND_FA: Record<string, string> = { bullish: "صعودی", bearish: "نزولی", neutral: "خنثی" };
const VERDICT_FA: Record<string, string> = { strong: "شرایط قوی", moderate: "شرایط متوسط", "no-trade": "بدون معامله" };
const DQ_LABEL: Record<string, string> = {
  good: "تصمیم خوب + نتیجه مثبت",
  neutral: "تصمیم سالم",
  lucky: "نتیجه مثبت با فرآیند ناسالم",
  "bad-execution": "اجرای ناسالم",
};

const TABS = [
  { id: "view", label: "نمای بازار", icon: Compass },
  { id: "plan", label: "پلن و ریسک", icon: ShieldAlert },
  { id: "factors", label: "عوامل کمّی", icon: Sigma },
  { id: "news", label: "اخبار", icon: Newspaper },
  { id: "journal", label: "ژورنال", icon: BookOpenCheck },
] as const;

type TabId = (typeof TABS)[number]["id"];

/* ---------- بخش‌های کمکی ---------- */

function Section({ title, icon, children, tone }: { title: string; icon: React.ReactNode; children: React.ReactNode; tone?: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/60 p-3">
      <div className={`mb-2 flex items-center gap-1.5 text-[11px] font-extrabold ${tone ?? "text-foreground/90"}`}>
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function QualityChip({ label, tone }: { label: string; tone: "ok" | "warn" | "bad" }) {
  const cls =
    tone === "ok"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : tone === "warn"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : "border-rose-500/40 bg-rose-500/10 text-rose-200";
  return <span className={`flex-none rounded-full border px-2 py-0.5 text-[9px] font-bold ${cls}`}>{label}</span>;
}

function TrendPill({ t }: { t: string | null }) {
  const cls = t === "bullish" ? "text-emerald-300" : t === "bearish" ? "text-rose-300" : "text-zinc-300";
  return <span className={`text-[10px] font-bold ${cls}`}>{t ? TREND_FA[t] : "—"}</span>;
}

const inputCls =
  "w-full rounded-lg border border-border/70 bg-background/60 px-2 py-1.5 text-[12px] font-bold outline-none focus:border-emerald-500/50";

/* ---------- هشدار جدی رنج فشرده / رنج ---------- */

function RangeBanner({ rw }: { rw: RangeWarning }) {
  const tight = rw.severity === "tight";
  return (
    <div
      data-testid="bt-rangewarn"
      className={`mx-3 mb-1.5 flex-none rounded-xl border px-2.5 py-2 ${
        tight ? "border-rose-500/60 bg-rose-500/15" : "border-amber-500/50 bg-amber-500/10"
      }`}
    >
      <div className="flex items-start gap-1.5">
        <AlertTriangle className={`mt-0.5 h-3.5 w-3.5 flex-none ${tight ? "text-rose-300" : "text-amber-300"}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-black ${tight ? "text-rose-200" : "text-amber-200"}`}>{tight ? "هشدار جدی: رنج فشرده" : "هشدار: بازار رنج است"}</p>
          <p className="mt-0.5 text-[10px] leading-5 text-foreground/85">{rw.message}</p>
          {tight && (
            <ul className="mt-1 flex flex-col gap-0.5">
              {rw.advice.map((a, i) => (
                <li key={i} className="flex items-start gap-1 text-[9px] leading-4 text-rose-200/90">
                  <span className="mt-1 h-1 w-1 flex-none rounded-full bg-rose-400" />
                  {a}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[9px] text-muted-foreground">
            سنجه‌ها: صدک ATR {rw.metrics.atrPctile === null ? "—" : faDigits(rw.metrics.atrPctile)} · نسبت کارایی {rw.metrics.er === null ? "—" : faDigits(rw.metrics.er)} · ارتفاع محدوده {rw.metrics.boxPctOfAtr === null ? "—" : faDigits(rw.metrics.boxPctOfAtr)} برابر ATR
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- اپ دستیار معامله‌گر ---------- */

export function TraderApp() {
  const [tab, setTab] = useState<TabId>("view");
  const [sym, setSym] = useState<"xau" | "dji">("xau");
  const [data, setData] = useState<TraderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visitChanges, setVisitChanges] = useState<{ text: string }[]>([]);
  const [nudgeMsg, setNudgeMsg] = useState<string | null>(null);
  /* داده تب عوامل کمّی — بارگذاری تنبل هنگام باز شدن تب */
  const [fq, setFq] = useState<FactorQuantResponse | null>(null);
  const [fqStatus, setFqStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [fqError, setFqError] = useState<string | null>(null);

  const load = useCallback(
    (force: boolean) => {
    setLoading(true);
    setError(null);
    /* مربی رفتاری: شمارش بروزرسانی‌های پیاپی */
    try {
      const log = lsGet<number[]>(K_REFRESH, []);
      const now = Date.now();
      const fresh = [...log.filter((t) => now - t < 5 * 60 * 1000), now];
      lsSet(K_REFRESH, fresh);
      const n = refreshNudge(fresh, now);
      setNudgeMsg(n.warn ? n.message : null);
    } catch {
      /* بی‌اهمیت */
    }
    fetch(`/api/trader?symbol=${sym}${force ? "&force=1" : ""}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (ok && j?.ok) {
          setData(j as TraderResponse);
          /* مقایسه با آخرین بازدید */
          try {
            const prev = lsGet<{ atISO: string; trends: Record<string, string>; score: number | null; divergence: string | null; highEventId: string | null; price: number | null } | null>(K_VISIT, null);
            const trends: Record<string, string> = {};
            for (const row of j.structure?.rows ?? []) if (row.trend) trends[`${j.symbol.key}:${row.tf}`] = row.trend;
            const cur = {
              atISO: new Date().toISOString(),
              trends,
              score: j.confluence?.total ?? null,
              divergence: j.divergence?.level ?? null,
              highEventId: j.newsGap?.event?.id ?? null,
              price: j.symbol?.price ?? null,
            };
            if (prev) {
              const changes: { text: string }[] = [];
              for (const key of Object.keys(cur.trends)) {
                const before = prev.trends?.[key];
                const after = cur.trends[key];
                if (before && after && before !== after) {
                  const [sk, tf] = key.split(":");
                  changes.push({
                    text: `جهت ساختار ${sk === "xau" ? "طلا" : "داوجونز"} در تایم‌فریم ${TF_FA[tf] ?? tf} از «${TREND_FA[before]}» به «${TREND_FA[after]}» تغییر کرد.`,
                  });
                }
              }
              if (prev.score !== null && cur.score !== null && Math.abs(cur.score - prev.score) >= 10)
                changes.push({ text: `امتیاز اطمینان از ${faDigits(prev.score)} به ${faDigits(cur.score)} تغییر کرد.` });
              if (prev.divergence && cur.divergence && prev.divergence !== cur.divergence)
                changes.push({ text: cur.divergence === "normal" ? "رابطه معمول با DXY دوباره برقرار شد." : "وضعیت همبستگی با DXY تغییر کرد — پنل واگرایی را ببینید." });
              if (prev.highEventId && cur.highEventId && prev.highEventId !== cur.highEventId)
                changes.push({ text: "خبر مهم جدیدی به تقویم اضافه شد." });
              if (prev.price !== null && cur.price !== null && prev.price > 0) {
                const pct = ((cur.price - prev.price) / prev.price) * 100;
                if (Math.abs(pct) >= 0.5) changes.push({ text: `قیمت نسبت به آخرین بازدید ${faPct(pct)} تغییر کرده است.` });
              }
              setVisitChanges(changes);
            }
            lsSet(K_VISIT, cur);
          } catch {
            /* حالت ناشناس */
          }
        } else {
          setError(String(j?.error ?? "خطای نامشخص"));
        }
        setLoading(false);
      })
      .catch(() => {
        setError("ارتباط با سرور برقرار نشد");
        setLoading(false);
      });
    },
    [sym]
  );

  useEffect(() => {
    /* بارگذاری بعد از کامیت — setState همگام داخل اپسن مجاز نیست */
    const t = setTimeout(() => load(false), 0);
    return () => clearTimeout(t);
  }, [load]);

  /* تغییر نماد → داده عوامل قبلی باطل شود (در هندلر انتخاب نماد، نه افکت) */
  const pickSym = (k: "xau" | "dji") => {
    if (k === sym) return;
    setSym(k);
    setFq(null);
    setFqStatus("idle");
  };

  const loadFactors = useCallback(
    (force: boolean) => {
      setFqStatus("loading");
      setFqError(null);
      fetch(`/api/factor-quant?symbol=${sym}${force ? "&force=1" : ""}`)
        .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
        .then(({ ok, j }) => {
          if (ok && j?.ok) {
            setFq(j as FactorQuantResponse);
            setFqStatus("done");
          } else {
            setFqError(String(j?.error ?? "خطای نامشخص"));
            setFqStatus("error");
          }
        })
        .catch(() => {
          setFqError("ارتباط با سرور برقرار نشد");
          setFqStatus("error");
        });
    },
    [sym]
  );

  useEffect(() => {
    if (tab === "factors" && fqStatus === "idle") {
      const t = setTimeout(() => loadFactors(false), 0);
      return () => clearTimeout(t);
    }
  }, [tab, fqStatus, loadFactors]);

  const d = data;
  const verdictCls =
    d?.confluence.verdict === "strong"
      ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
      : d?.confluence.verdict === "moderate"
        ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
        : "text-rose-300 border-rose-500/40 bg-rose-500/10";
  void verdictCls;

  return (
    <div className="flex h-full flex-col">
      {/* سربرگ — لوگوی BIG TRADER */}
      <div className="flex flex-none items-center gap-2 px-3 pb-1.5 pt-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <img
            src="/logo3.png"
            alt="لوگوی BIG TRADER — نشان شیر و تاج"
            className="h-8 w-8 flex-none rounded-full shadow-lg shadow-black/40 ring-1 ring-white/20"
          />
          <div className="min-w-0 leading-tight">
            <p dir="ltr" className="truncate bg-gradient-to-l from-amber-200 via-amber-400 to-orange-400 bg-clip-text text-[15px] font-black tracking-wide text-transparent" data-testid="bt-logo">
              BIG TRADER
            </p>
            <p className="truncate text-[9px] font-bold text-muted-foreground">دستیار هوشمند معامله‌گری — اطلاع‌رسانی، نه توصیه</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          aria-label="بروزرسانی داده دستیار"
          data-testid="bt-refresh"
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-white/15 bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* انتخاب نماد */}
      <div className="flex flex-none items-center gap-1.5 px-3 pb-1.5">
        {(
          [
            { k: "xau", label: "طلا — XAUUSD" },
            { k: "dji", label: "داوجونز — DJI" },
          ] as const
        ).map((p) => (
          <button
            key={p.k}
            type="button"
            onClick={() => pickSym(p.k)}
            className={`flex-1 rounded-full border px-2 py-1 text-[10px] font-bold transition-colors ${
              sym === p.k ? "border-amber-500/60 bg-amber-500/20 text-amber-200" : "border-border/70 bg-card/60 text-muted-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* نوار واگرایی بین‌بازاری — همیشه فعال */}
      {d && (
        <div
          data-testid="bt-divbar"
          className={`mx-3 mb-1.5 flex flex-none items-center gap-2 rounded-xl border px-2.5 py-1.5 ${
            d.divergence.color === "green"
              ? "border-emerald-500/40 bg-emerald-500/10"
              : d.divergence.color === "amber"
                ? "border-amber-500/40 bg-amber-500/10"
                : d.divergence.color === "red"
                  ? "border-rose-500/40 bg-rose-500/10"
                  : "border-border/70 bg-card/60"
          }`}
        >
          <span className="text-[13px] leading-none">{d.divergence.color === "green" ? "🟢" : d.divergence.color === "amber" ? "🟡" : d.divergence.color === "red" ? "🔴" : "⚪"}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-extrabold">{d.divergence.text}</p>
            <p className="truncate text-[9px] text-muted-foreground" title={d.divergence.reason}>
              {d.divergence.reason}
            </p>
          </div>
        </div>
      )}

      {/* ناج مربی رفتاری */}
      {nudgeMsg && (
        <div className="mx-3 mb-1.5 flex flex-none items-start gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-bold leading-5 text-amber-200">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-none" />
          {nudgeMsg}
        </div>
      )}

      {/* هشدار جدی رنج فشرده / رنج — همیشه بالای همه تب‌ها */}
      {d && d.rangeWarning?.active && <RangeBanner rw={d.rangeWarning} />}

      {/* تب‌ها */}
      <div className="flex flex-none items-center gap-1 px-3 pb-1.5" data-testid="bt-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-0.5 rounded-full border px-1 py-1 text-[9px] font-extrabold transition-colors ${
              tab === t.id ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-200" : "border-border/70 bg-card/60 text-muted-foreground"
            }`}
          >
            <t.icon className="h-2.5 w-2.5 flex-none" />
            <span className="truncate">{t.label}</span>
          </button>
        ))}
      </div>

      {/* محتوا */}
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-3" data-testid="bt-content">
        {loading && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <LoaderCircle className="h-7 w-7 animate-spin text-amber-400" />
            <p className="text-xs font-bold text-foreground/80">در حال محاسبه وضعیت بازار…</p>
            <p className="text-[10px] text-muted-foreground">ساختار، DXY، اخبار و امتیاز اطمینان</p>
          </div>
        )}
        {!loading && error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <p className="max-w-[280px] text-[11px] leading-5 text-muted-foreground">{error}</p>
            <button type="button" onClick={() => load(true)} className="rounded-full border border-amber-500/50 bg-amber-500/15 px-4 py-1.5 text-xs font-extrabold text-amber-200">
              تلاش مجدد
            </button>
          </div>
        )}
        {!loading && !error && d && tab === "view" && <ViewTab d={d} visitChanges={visitChanges} />}
        {!loading && !error && d && tab === "plan" && <PlanTab d={d} />}
        {!loading && !error && d && tab === "factors" && (
          <FactorsTab sym={sym} data={fq} status={fqStatus} error={fqError} onReload={() => loadFactors(true)} />
        )}
        {!loading && !error && d && tab === "news" && <NewsTab d={d} />}
        {!loading && !error && d && tab === "journal" && <JournalTab balance={planBalance} />}

        {!loading && !error && d && (
          <p className="pt-2 text-center text-[9px] leading-4 text-muted-foreground/70">
            منبع: ساختار و قیمت Yahoo Finance · اخبار ForexFactory · محاسبات محلی — آخرین بروزرسانی {faTime(new Date(d.generatedAtISO))}
            <br />
            هیچ خروجی این بخش توصیه قطعی خرید/فروش یا اجرای خودکار سفارش نیست.
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------- تب ۱: نمای بازار ---------- */

function ViewTab({ d, visitChanges }: { d: TraderResponse; visitChanges: { text: string }[] }) {
  const c = d.confluence;
  const verdictCls =
    c.verdict === "strong"
      ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
      : c.verdict === "moderate"
        ? "text-amber-300 border-amber-500/40 bg-amber-500/10"
        : "text-rose-300 border-rose-500/40 bg-rose-500/10";
  const rows = [
    { label: "هم‌جهتی تایم‌فریم‌ها", f: c.factors.tf, max: 40 },
    { label: "خلأ خبری", f: c.factors.news, max: 30 },
    { label: "همبستگی با DXY", f: c.factors.dxy, max: 20 },
    { label: "نوسان ATR", f: c.factors.atr, max: 10 },
  ];
  return (
    <div className="flex flex-col gap-2">
      {/* امتیاز اطمینان */}
      <Section title="موتور همگرایی پویا — امتیاز اطمینان" icon={<Gauge className="h-3.5 w-3.5 text-violet-300" />}>
        <div className="flex items-center gap-3">
          <div className={`flex h-16 w-16 flex-none flex-col items-center justify-center rounded-2xl border ${verdictCls}`}>
            <span className="text-xl font-black" data-testid="bt-score">{faDigits(c.total)}</span>
            <span className="text-[8px] font-bold">از ۱۰۰</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-extrabold">{VERDICT_FA[c.verdict]}</p>
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
              ≥۷۵ قوی · ۵۰–۷۴ متوسط · &lt;۵۰ بدون معامله — امتیاز، فرصت را اندازه می‌گیرد، نه نتیجه را تضمین می‌کند.
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-col gap-1.5">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span>{r.label}</span>
                <span className="text-muted-foreground">
                  {faDigits(r.f.score)}/{faDigits(r.max)} — {r.f.label}
                </span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-teal-600" style={{ width: `${(r.f.score / r.max) * 100}%` }} />
              </div>
              <p className="mt-0.5 text-[9px] leading-4 text-muted-foreground">{r.f.detail}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ساختار چندتایم‌فریمی */}
      <Section title={`تحلیل ساختار بازار — جمع‌بندی ${d.structure.summaryFa}`} icon={<Compass className="h-3.5 w-3.5 text-sky-300" />}>
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-0.5 text-start font-bold">تایم‌فریم</th>
              <th className="py-0.5 text-center font-bold">جهت</th>
              <th className="py-0.5 text-center font-bold">قدرت</th>
              <th className="py-0.5 text-center font-bold">EMA / سوئینگ</th>
            </tr>
          </thead>
          <tbody>
            {d.structure.rows.map((r) => (
              <tr key={r.tf} className="border-t border-border/50">
                <td className="py-1 font-bold">{TF_FA[r.tf]}</td>
                <td className="py-1 text-center"><TrendPill t={r.trend} /></td>
                <td className="py-1 text-center text-muted-foreground">{r.trend ? faDigits(r.strength) + "٪" : "—"}</td>
                <td className="py-1 text-center text-[9px] text-muted-foreground">
                  {r.ma ? TREND_FA[r.ma] : "—"} / {r.swing ? TREND_FA[r.swing] : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1.5 text-[10px] leading-5 text-muted-foreground">{d.structure.detail}</p>
        <p className="mt-1 text-[10px] font-bold">
          سطوح ۲۰ روز اخیر — مقاومت: <span className="text-rose-300">{faNum(d.structure.resistance)}</span> · حمایت: <span className="text-emerald-300">{faNum(d.structure.support)}</span>
        </p>
      </Section>

      {/* رژیم بازار + همبستگی */}
      <Section title="رژیم بازار" icon={<ActivityIcon />}>
        <p className="text-[11px] font-extrabold">{d.regime.label}</p>
        <p className="mt-0.5 text-[10px] leading-5 text-muted-foreground">{d.regime.reason}</p>
      </Section>

      <Section title="وابستگی به DXY و US10Y" icon={<ActivityIcon />}>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-lg border border-border/60 bg-background/40 p-1.5">
            <p className="text-[9px] text-muted-foreground">DXY</p>
            <p className="text-[12px] font-extrabold" dir="ltr">{faNum(d.dxy.price)}</p>
            <p className={`text-[9px] font-bold ${d.dxy.changePct != null && d.dxy.changePct > 0 ? "text-emerald-300" : "text-rose-300"}`}>{faPct(d.dxy.changePct)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 p-1.5">
            <p className="text-[9px] text-muted-foreground">US10Y</p>
            <p className="text-[12px] font-extrabold" dir="ltr">{faNum(d.us10y.price)}</p>
            <p className={`text-[9px] font-bold ${d.us10y.changePct != null && d.us10y.changePct > 0 ? "text-emerald-300" : "text-rose-300"}`}>{faPct(d.us10y.changePct)}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/40 p-1.5">
            <p className="text-[9px] text-muted-foreground">همبستگی با DXY</p>
            <p className="text-[12px] font-extrabold" dir="ltr">{d.dxy.corr30 === null ? "—" : faNum(d.dxy.corr30)}</p>
            <p className="text-[9px] text-muted-foreground">{d.dxy.corrWindow}</p>
          </div>
        </div>
        <p className="mt-1.5 text-[9px] leading-4 text-muted-foreground">
          {d.symbol.expectInverseDxy ? "رابطه معمول این نماد با دلار معکوس است؛ " : "جهت رابطه این نماد با دلار ثابت فرض نمی‌شود؛ "}
          حرکت هم‌زمان دلیل علّی نیست و DXY فقط یکی از عوامل زمینه‌ای است.
        </p>
      </Section>

      {/* شناسنامه نماد */}
      <Section title={`شناسنامه نماد — ${d.symbol.name}`} icon={<Briefcase className="h-3.5 w-3.5 text-amber-300" />}>
        <div className="flex flex-col gap-1">
          {d.symbol.specs.map((s) => (
            <div key={s.label} className="flex items-start justify-between gap-2 border-b border-border/40 pb-1 last:border-0">
              <span className="flex-none text-[10px] text-muted-foreground">{s.label}</span>
              <span className="flex items-center gap-1 text-end text-[10px] font-bold">
                {s.value}
                {s.needsConfirm && (
                  <span
                    title="این مقدار به کارگزاری شما بستگی دارد — پیش از محاسبه حجم/ریسک با مشخصات حساب خودتان تطبیق دهید"
                    className="flex-none rounded border border-amber-500/40 bg-amber-500/10 px-1 py-px text-[8px] text-amber-300"
                  >
                    نیازمند تأیید
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[9px] leading-4 text-amber-200/90">
          چرا «نیازمند تأیید»؟ اندازه قرارداد، ارزش پیپ، اسپرد، ساعات معامله و حداقل حجم به کارگزاری و نوع حساب شما بستگی دارد؛ ابزار مقادیر معمول بازار را نشان می‌دهد و از حدس زدن مشخصات حساب شما خودداری می‌کند. پیش از محاسبه حجم و ریسک، این مقادیر را با پنل کارگزاری خود تطبیق دهید — این هشدار مانع محاسبه نیست، جلوی خطای عددی را می‌گیرد.
        </p>
      </Section>

      {/* تغییرات از آخرین بازدید */}
      <Section title="چه چیزی از آخرین بازدید تغییر کرده؟" icon={<RefreshCw className="h-3.5 w-3.5 text-violet-300" />}>
        {visitChanges.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">تغییر قابل‌توجهی نسبت به بازدید قبلی شما ثبت نشده است (یا این اولین بازدید است).</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {visitChanges.map((ch, i) => (
              <li key={i} className="flex items-start gap-1.5 text-[10px] leading-5">
                <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-violet-400" />
                {ch.text}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[9px] text-muted-foreground">فقط تغییر واقعی داده‌ها نمایش داده می‌شود؛ هشدار، دستور ورود یا خروج نیست.</p>
      </Section>
    </div>
  );
}

function ActivityIcon() {
  return <Compass className="h-3.5 w-3.5 text-sky-300" />;
}

/* ---------- تب ۲: پلن و ریسک ---------- */

let planBalance = 1000; // موجودی برای تب ژورنال (درصدهای ریسک تجمیعی)

function PlanTab({ d }: { d: TraderResponse }) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [entry, setEntry] = useState(() => (d.symbol.price ? String(Math.round(d.symbol.price * 100) / 100) : ""));
  const [balance, setBalance] = useState("1000");
  const [riskPct, setRiskPct] = useState("1");
  const [rr, setRr] = useState("2");
  const [slMode, setSlMode] = useState<"swing" | "atr">("atr");
  const [plan, setPlan] = useState<PlanOutput | null>(null);
  const [copied, setCopied] = useState(false);
  const [locked, setLocked] = useState<{ locked: boolean; minutesLeft: number }>(() => revengeLock(lsGet<string | null>(K_LASTLOSS, null)));
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [positions, setPositions] = useState<Position[]>(() => lsGet<Position[]>(K_POSITIONS, []));
  const [preMortemSide, setPreMortemSide] = useState<"buy" | "sell" | null>(null);

  const atrAbs = useMemo(() => {
    if (!d.symbol.price || d.regime.atrPct === null) return null;
    return (d.regime.atrPct / 100) * d.symbol.price;
  }, [d]);

  const generate = () => {
    const swingLevel =
      slMode === "swing"
        ? side === "buy"
          ? d.structure.support
          : d.structure.resistance
        : null;
    const out = computeTradePlan({
      side,
      entry: Number(entry.replace(/[^\d.]/g, "")),
      balance: Number(balance.replace(/[^\d.]/g, "")),
      riskPct: Number(riskPct.replace(/[^\d.]/g, "")),
      rr: Number(rr),
      slMode,
      swingLevel,
      atr: atrAbs,
      atrMult: 1.5,
      contractSize: d.symbol.contractSize,
      symbolLabel: d.symbol.key === "xau" ? "XAUUSD" : "DJI",
    });
    setPlan(out);
    planBalance = Number(balance.replace(/[^\d.]/g, "")) || planBalance;
    setCopied(false);
  };

  const copy = async () => {
    if (!plan?.copyText) return;
    try {
      await navigator.clipboard.writeText(plan.copyText);
      setCopied(true);
    } catch {
      /* دسترسی ندارند */
    }
  };

  /* چک‌لیست: ۴ مورد خودکار از داده + ۳ مورد دستی */
  const autoChecks = [
    { label: "خبر مهم نزدیک است؟", value: d.checklistAuto.newsNear, warn: true },
    { label: `تایم‌فریم‌ها ${d.checklistAuto.tfSummary} هستند؟`, value: d.checklistAuto.tfSummary === "هم‌جهت", warn: false },
    { label: "حرکت DXY با سناریو سازگار است؟", value: d.checklistAuto.dxyCompatible, warn: false },
    { label: "داده‌های لازم موجود و به‌روز هستند؟", value: d.checklistAuto.dataFresh, warn: false },
  ];
  const manualChecks = [
    { key: "reason", label: "دلیل معامله روشن و ثبت شده است؟" },
    { key: "sl", label: "حد ضرر یا شرط ابطال مشخص است؟" },
    { key: "cap", label: "ریسک معامله با سقف ریسک من سازگار است؟" },
  ];
  const doneManual = manualChecks.filter((m) => checks[m.key]).length;
  const ready = doneManual === manualChecks.length;

  const totalRisk = positions.reduce((s, p) => s + p.riskUsd, 0);
  const balanceNum = Number(balance.replace(/[^\d.]/g, "")) || 0;
  const totalRiskPct = balanceNum > 0 ? (totalRisk / balanceNum) * 100 : null;

  return (
    <div className="flex flex-col gap-2">
      {/* قفل Revenge Trading */}
      {locked.locked && (
        <div className="flex items-start gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-[10px] font-bold leading-5 text-rose-200">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-none" />
          احتمالاً در حالت Revenge Trading هستید — یک نفس عمیق بکشید. پیشنهاد معامله تا {faDigits(locked.minutesLeft)} دقیقه قفل است.
        </div>
      )}

      <Section title="تولیدکننده خودکار پلن معامله" icon={<ShieldAlert className="h-3.5 w-3.5 text-violet-300" />}>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="text-[9px] font-bold text-muted-foreground">
            جهت
            <select value={side} onChange={(e) => setSide(e.target.value as "buy" | "sell")} className={inputCls} data-testid="bt-side">
              <option value="buy">خرید (Buy)</option>
              <option value="sell">فروش (Sell)</option>
            </select>
          </label>
          <label className="text-[9px] font-bold text-muted-foreground">
            نقطه ورود
            <input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" dir="ltr" className={inputCls} placeholder="4200" data-testid="bt-entry" />
          </label>
          <label className="text-[9px] font-bold text-muted-foreground">
            موجودی حساب ($)
            <input value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="decimal" dir="ltr" className={inputCls} placeholder="1000" data-testid="bt-balance" />
          </label>
          <label className="text-[9px] font-bold text-muted-foreground">
            ریسک (٪)
            <input value={riskPct} onChange={(e) => setRiskPct(e.target.value)} inputMode="decimal" dir="ltr" className={inputCls} placeholder="1" data-testid="bt-risk" />
          </label>
          <label className="text-[9px] font-bold text-muted-foreground">
            نسبت R/R
            <select value={rr} onChange={(e) => setRr(e.target.value)} className={inputCls}>
              <option value="2">۱ به ۲</option>
              <option value="3">۱ به ۳</option>
            </select>
          </label>
          <label className="text-[9px] font-bold text-muted-foreground">
            مبنای حد ضرر
            <select value={slMode} onChange={(e) => setSlMode(e.target.value as "swing" | "atr")} className={inputCls}>
              <option value="atr">ATR × ۱.۵ (خودکار)</option>
              <option value="swing">آخرین سوئینگ</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={locked.locked}
          className="mt-2 w-full rounded-lg border border-violet-500/50 bg-violet-500/20 py-1.5 text-[11px] font-extrabold text-violet-200 disabled:opacity-50"
          data-testid="bt-generate"
        >
          ساخت پلن
        </button>

        {plan && plan.ok && (
          <div className="mt-2 rounded-lg border border-violet-500/30 bg-violet-500/5 p-2" data-testid="bt-plan-result">
            <div className="grid grid-cols-2 gap-1 text-[10px] font-bold">
              <p>حد ضرر: <span className="text-rose-300" dir="ltr">{plan.sl}</span></p>
              <p>حد سود: <span className="text-emerald-300" dir="ltr">{plan.tp}</span></p>
              <p>حجم: <span className="text-amber-300" dir="ltr">{plan.lots}</span> لات</p>
              <p>ریسک: <span dir="ltr">${plan.riskAmount}</span></p>
              <p>زیان در SL: <span className="text-rose-300" dir="ltr">${plan.lossAtSL}</span></p>
              <p>سود در TP: <span className="text-emerald-300" dir="ltr">${plan.profitAtTP}</span></p>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <code dir="ltr" className="min-w-0 flex-1 truncate rounded bg-black/30 px-1.5 py-1 text-[9px]">{plan.copyText}</code>
              <button type="button" onClick={copy} className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-white/15 bg-white/10" aria-label="کپی خلاصه پلن">
                {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <ClipboardCopy className="h-3 w-3" />}
              </button>
            </div>
            {plan.warnings.map((w, i) => (
              <p key={i} className="mt-1 text-[9px] leading-4 text-amber-300/90">⚠ {w}</p>
            ))}
          </div>
        )}
        {plan && !plan.ok && <p className="mt-2 text-[10px] font-bold text-rose-300">{plan.error}</p>}
      </Section>

      {/* نواحی ورود مبتنی بر ساختار */}
      <Section title="نواحی ورود پیشنهادی بر اساس ساختار (الگوریتمی)" icon={<Target className="h-3.5 w-3.5 text-sky-300" />}>
        {d.entryZones.zones.length === 0 ? (
          <p className="text-[10px] leading-5 text-muted-foreground">{d.entryZones.note}</p>
        ) : (
          <>
            <p className="text-[9px] leading-4 text-muted-foreground">
              ساختار ۴ساعته: {d.entryZones.trendFa} — {d.entryZones.note}
            </p>
            {d.entryZones.zones.map((z, i) => (
              <div key={i} className="mt-1.5 rounded-lg border border-sky-500/25 bg-sky-500/5 p-2" data-testid={`bt-zone-${z.side}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-black ${z.side === "buy" ? "text-emerald-300" : "text-rose-300"}`}>
                    {z.side === "buy" ? "ناحیه خرید" : "ناحیه فروش"}
                  </span>
                  <span className={`rounded-full px-1.5 py-px text-[9px] font-bold ${z.activeNow ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-zinc-300"}`}>
                    {z.activeNow ? "ناحیه فعال (قیمت داخل آن است)" : "ناحیه انتظار پولبک"}
                  </span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] font-bold">
                  <p>ناحیه ورود: <span dir="ltr">{z.zoneLo} – {z.zoneHi}</span></p>
                  <p>حد ضرر: <span className="text-rose-300" dir="ltr">{z.sl}</span></p>
                  <p>هدف ۱ (RR۲): <span className="text-emerald-300" dir="ltr">{z.tp1}</span></p>
                  <p>هدف ۲ (RR۳): <span className="text-emerald-300" dir="ltr">{z.tp2}</span></p>
                </div>
                <p className="mt-1 text-[9px] leading-4 text-muted-foreground">{z.basis}</p>
                <p className="text-[9px] leading-4 text-amber-300/90">{z.invalidate}</p>
                <button
                  type="button"
                  onClick={() => {
                    setSide(z.side);
                    setEntry(String(Math.round(((z.zoneLo + z.zoneHi) / 2) * 100) / 100));
                  }}
                  className="mt-1 w-full rounded-lg border border-violet-500/40 bg-violet-500/10 py-1 text-[10px] font-extrabold text-violet-200"
                >
                  انتقال به فرم پلن
                </button>
              </div>
            ))}
            <p className="mt-1 text-[9px] leading-4 text-muted-foreground">
              نواحی آموزشی و مبتنی بر سوئینگ/ATR هستند — سیگنال قطعی نیستند؛ تأیید کندل داخل ناحیه شرط اجراست و محاسبه حجم جداگانه در فرم پلن انجام می‌شود.
            </p>
          </>
        )}
      </Section>

      {/* چک‌لیست */}
      <Section title="چک‌لیست پیش از معامله" icon={<Check className="h-3.5 w-3.5 text-emerald-300" />}>
        <div className="flex flex-col gap-1">
          {autoChecks.map((a) => (
            <div key={a.label} className="flex items-center justify-between text-[10px]">
              <span className={a.value ? "" : a.warn ? "text-amber-300 font-bold" : "text-rose-300 font-bold"}>{a.label}</span>
              <span className={`rounded-full px-1.5 py-px text-[9px] font-extrabold ${a.value ? "bg-emerald-500/15 text-emerald-300" : a.warn ? "bg-amber-500/15 text-amber-300" : "bg-rose-500/15 text-rose-300"}`}>
                {a.value ? "بله" : "خیر"}
              </span>
            </div>
          ))}
          {manualChecks.map((m) => (
            <label key={m.key} className="flex cursor-pointer items-center justify-between text-[10px]">
              <span>{m.label}</span>
              <input type="checkbox" checked={!!checks[m.key]} onChange={(e) => setChecks((c) => ({ ...c, [m.key]: e.target.checked }))} className="h-3.5 w-3.5 accent-emerald-500" />
            </label>
          ))}
        </div>
        {!ready && <p className="mt-1.5 text-[10px] font-bold text-amber-300">وضعیت: تحلیل ناقص — موارد دستی را تکمیل کنید؛ اطلاعات حدس زده نمی‌شود.</p>}
        {ready && <p className="mt-1.5 text-[10px] font-bold text-emerald-300">چک‌لیست کامل شد — اجرای برنامه همچنان بر عهده خودتان است.</p>}
      </Section>

      {/* پیش‌مرگ */}
      <Section title="اگر این معامله شکست بخورد، محتمل‌ترین دلیل چیست؟" icon={<AlertTriangle className="h-3.5 w-3.5 text-rose-300" />}>
        <div className="mb-1.5 flex gap-1.5">
          <button type="button" onClick={() => setPreMortemSide("buy")} className={`flex-1 rounded-full border px-2 py-1 text-[10px] font-bold ${preMortemSide === "buy" ? "border-emerald-500/60 bg-emerald-500/20 text-emerald-200" : "border-border/70 text-muted-foreground"}`}>سناریوی خرید</button>
          <button type="button" onClick={() => setPreMortemSide("sell")} className={`flex-1 rounded-full border px-2 py-1 text-[10px] font-bold ${preMortemSide === "sell" ? "border-rose-500/60 bg-rose-500/20 text-rose-200" : "border-border/70 text-muted-foreground"}`}>سناریوی فروش</button>
        </div>
        <ul className="flex flex-col gap-1">
          {(preMortemSide
            ? d.preMortem.factors
            : d.preMortem.factors
          ).map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[10px] leading-5 text-foreground/85">
              <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-rose-400" />
              {f}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[9px] text-muted-foreground">{d.preMortem.balanceNote}</p>
      </Section>

      {/* ریسک تجمیعی */}
      <Section title="ریسک تجمیعی پوزیشن‌ها" icon={<ShieldAlert className="h-3.5 w-3.5 text-amber-300" />}>
        {positions.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">پوزیشنی ثبت نشده است. پوزیشن‌های باز خود را اضافه کنید تا مواجهه کلی با دلار بررسی شود.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {positions.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-2 py-1 text-[10px]">
                <span className="font-bold">{p.sym}</span>
                <span className={p.side === "buy" ? "text-emerald-300" : "text-rose-300"}>{p.side === "buy" ? "خرید" : "فروش"}</span>
                <span dir="ltr">{p.lots} lot</span>
                <span dir="ltr">${p.riskUsd}</span>
                <button type="button" aria-label="حذف پوزیشن" onClick={() => { const nx = positions.filter((x) => x.id !== p.id); setPositions(nx); lsSet(K_POSITIONS, nx); }}>
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            ))}
            <p className="text-[10px] font-bold">
              ریسک تجمیعی: <span dir="ltr">${Math.round(totalRisk * 100) / 100}</span>
              {totalRiskPct !== null && <> ({faNum(totalRiskPct)}٪ موجودی)</>}
              {totalRiskPct !== null && totalRiskPct > 5 && <span className="text-rose-300"> — بالاتر از سقف معمول ۵٪؛ هم‌جهت‌بودن پوزیشن‌ها در برابر دلار را بررسی کنید.</span>}
            </p>
          </div>
        )}
        <AddPosition onAdd={(p) => { const nx = [...positions, p]; setPositions(nx); lsSet(K_POSITIONS, nx); }} />
        <p className="mt-1 text-[9px] leading-4 text-muted-foreground">چند نماد متفاوت می‌توانند هم‌زمان تحت‌تأثیر یک عامل مشترک (دلار) باشند؛ همبستگی ثابت فرض نمی‌شود و جمع ریسک، تضمین زیان/سود نیست.</p>
      </Section>
    </div>
  );
}

function AddPosition({ onAdd }: { onAdd: (p: Position) => void }) {
  const [sym, setSym] = useState("XAUUSD");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [lots, setLots] = useState("");
  const [risk, setRisk] = useState("");
  return (
    <div className="mt-1.5 grid grid-cols-4 gap-1">
      <select value={sym} onChange={(e) => setSym(e.target.value)} className={`${inputCls} col-span-1 !text-[10px]`}>
        <option>XAUUSD</option>
        <option>DJI</option>
        <option>EURUSD</option>
        <option>BTCUSDT</option>
      </select>
      <select value={side} onChange={(e) => setSide(e.target.value as "buy" | "sell")} className={`${inputCls} !text-[10px]`}>
        <option value="buy">خرید</option>
        <option value="sell">فروش</option>
      </select>
      <input value={lots} onChange={(e) => setLots(e.target.value)} placeholder="لات" inputMode="decimal" dir="ltr" className={`${inputCls} !text-[10px]`} />
      <div className="flex gap-1">
        <input value={risk} onChange={(e) => setRisk(e.target.value)} placeholder="ریسک $" inputMode="decimal" dir="ltr" className={`${inputCls} !text-[10px]`} />
        <button
          type="button"
          onClick={() => {
            const l = Number(lots);
            const r = Number(risk);
            if (!(l > 0) || !(r > 0)) return;
            onAdd({ id: String(Date.now()), sym, side, lots: l, riskUsd: r });
            setLots("");
            setRisk("");
          }}
          className="flex-none rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-2 text-[11px] font-extrabold text-emerald-200"
          aria-label="افزودن پوزیشن"
        >
          +
        </button>
      </div>
    </div>
  );
}

/* ---------- تب ۳: اخبار و سناریو ---------- */

function NewsTab({ d }: { d: TraderResponse }) {
  const ev = d.newsGap.event;
  const mins = d.newsGap.minutesLeft;
  return (
    <div className="flex flex-col gap-2">
      <Section title="تقویم رویدادها — آمادگی پیش از خبر" icon={<Newspaper className="h-3.5 w-3.5 text-amber-300" />}>
        {ev ? (
          <>
            <div className="flex items-center justify-between gap-1">
              <p className="text-[11px] font-extrabold">{ev.titleFa || ev.title}</p>
              <span className="flex-none rounded-full border border-rose-500/40 bg-rose-500/10 px-1.5 py-px text-[9px] font-extrabold text-rose-300">اهمیت بالا</span>
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              <span className="font-extrabold text-amber-200">ارز: {currencyFa(ev.country)}</span>
              {ev.dateISO ? <> — {faTime(new Date(ev.dateISO))} تهران</> : " — زمان نامشخص"}
              {" — پیش‌بینی: "}<span dir="ltr">{ev.forecast ?? "—"}</span> · قبلی: <span dir="ltr">{ev.previous ?? "—"}</span>
            </p>
            {ev.country !== "USD" && (
              <p className="mt-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[9px] leading-4 text-sky-200">
                این خبر مربوط به دلار آمریکا نیست، اما داده قوی اقتصادهای اصلی از مسیر شاخص دلار، انتظارات نرخ بهره و حس ریسک بر طلا و داو اثر می‌گذارد؛ به همین دلیل در تقویم نمایش داده می‌شود.
              </p>
            )}
            <p className="mt-1 text-[12px] font-black text-amber-300" data-testid="bt-countdown">
              {mins !== null ? `${mins >= 60 ? faDigits(Math.floor(mins / 60)) + " ساعت و " : ""}${faDigits(Math.round(mins % 60))} دقیقه باقی‌مانده` : "—"}
            </p>
            {mins !== null && mins < 240 && (
              <p className="mt-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-bold leading-5 text-amber-200">
                هشدار: خبر مهم نزدیک است — نوسان، اسپرد و لغزش ممکن است به‌طور موقت چند برابر شود. این هشدار دستور ورود/خروج نیست.
              </p>
            )}
            {!ev.dateISO && <p className="mt-1 text-[10px] text-amber-300">زمان انتشار در منبع موجود نیست — حدس زده نمی‌شود.</p>}
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] leading-5 text-muted-foreground">
              در ۷ روز آینده فید، خبری با اهمیت «بالا» از اقتصادهای اصلی (آمریکا، اروپا، انگلیس، ژاپن، کانادا، استرالیا، نیوزیلند) ثبت نشده است.
            </p>
            <p className="text-[9px] leading-4 text-muted-foreground">
              توجه: تقویم ForexFactory فقط هفته جاری را پوشش می‌دهد؛ رویدادهای هفته بعد در ابتدای هفته آینده اضافه می‌شوند. خبرهای «متوسط» هفته (مثل شاخص‌های PMI) در تب اخبار امروز دیده می‌شوند.
            </p>
          </div>
        )}
        <p className="mt-1.5 text-[9px] text-muted-foreground">منبع: ForexFactory (USD کامل + ارزهای اصلی High/Medium) — وضعیت فید: {d.dataQuality.events === "live" ? "زنده" : d.dataQuality.events === "cached" ? "کش‌شده" : "خطا"}</p>
      </Section>

      {/* سناریوها */}
      {d.scenarios.items.length > 0 && (
        <Section title="شبیه‌ساز واکنش به خبر — دو سناریوی مشروط" icon={<Newspaper className="h-3.5 w-3.5 text-violet-300" />}>
          {d.scenarios.conflict && (
            <div className="mb-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[10px] font-bold leading-5 text-rose-200">⚠ هشدار ریسک: {d.scenarios.conflict}</div>
          )}
          <div className="flex flex-col gap-1.5">
            {d.scenarios.items.map((s) => (
              <div key={s.id} className="rounded-lg border border-border/60 bg-background/40 p-2">
                <p className="text-[11px] font-extrabold text-violet-200">{s.title}</p>
                <p className="mt-0.5 text-[10px] leading-5 text-foreground/85">{s.trigger}.</p>
                <p className="mt-0.5 text-[10px] font-bold">طلا: {s.xauDir ?? "—"} {s.djiDir ? <>· داوجونز: {s.djiDir}</> : null}</p>
                <p className="mt-0.5 text-[9px] leading-4 text-muted-foreground">{s.confirm}</p>
                <p className="text-[9px] leading-4 text-muted-foreground">{s.invalidate}</p>
                <p className="text-[9px] leading-4 text-muted-foreground">{s.limits}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* واکنش تاریخی */}
      <Section title="مقایسه با واکنش‌های تاریخی خبر" icon={<Newspaper className="h-3.5 w-3.5 text-sky-300" />}>
        {d.history.available && d.history.stats && d.history.n ? (
          (() => {
            const st = d.history.stats!;
            const avg = st.avgMovePct ?? 0;
            const min = st.minPct ?? 0;
            const max = st.maxPct ?? 0;
            return (
              <>
                <p className="text-[10px] leading-5 text-foreground/85">
                  در {faDigits(d.history.n!)} نمونه مشابه از همین عنوان خبر در {faDigits(d.history.windowDays!)} روز اخیر، میانگین واکنش روزانه طلا{" "}
                  <span className="font-extrabold" dir="ltr">{avg > 0 ? "+" : ""}{avg}٪</span> بوده است
                  (دامنه <span dir="ltr">{min}٪</span> تا <span dir="ltr">+{max}٪</span>؛ در {faDigits(st.upPct ?? 0)}٪ موارد مثبت).
                </p>
                <p className="mt-0.5 text-[9px] leading-4 text-muted-foreground">روش: {d.history.method} — تاریخچه تضمین واکنش آینده نیست و عدم‌قطعیت نمونه کم بالاست.</p>
              </>
            );
          })()
        ) : (
          <p className="text-[10px] leading-5 text-muted-foreground">{d.history.reason ?? "نمونه تاریخی کافی نیست."}</p>
        )}
      </Section>
    </div>
  );
}

/* ---------- تب ۴: ژورنال ---------- */

function JournalTab({ balance }: { balance: number }) {
  const [entries, setEntries] = useState<JournalEntry[]>(() => lsGet<JournalEntry[]>(K_JOURNAL, []));
  const [reason, setReason] = useState("");
  const [scenario, setScenario] = useState("");
  const [invalidation, setInvalidation] = useState("");
  const [expectation, setExpectation] = useState("");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [entry, setEntry] = useState("");
  const [saved, setSaved] = useState(false);

  const todayLosses = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return entries.filter((e) => e.result === "loss" && e.atISO.slice(0, 10) === todayKey).length;
  }, [entries]);

  const rest = restSuggestion(todayLosses === 0 ? [] : Array(todayLosses).fill("loss" as const));
  const lastLoss = lsGet<string | null>(K_LASTLOSS, null);
  const lock = revengeLock(lastLoss);

  const save = () => {
    if (!reason.trim() || !invalidation.trim()) {
      setSaved(false);
      return;
    }
    const e: JournalEntry = {
      id: String(Date.now()),
      atISO: new Date().toISOString(),
      reason,
      scenario,
      invalidation,
      expectation,
      dxyRole: "",
      side,
      entry,
      result: null,
      review: null,
    };
    const nx = [e, ...entries];
    setEntries(nx);
    lsSet(K_JOURNAL, nx);
    setReason("");
    setScenario("");
    setInvalidation("");
    setExpectation("");
    setEntry("");
    setSaved(true);
  };

  const setResult = (id: string, result: JournalEntry["result"]) => {
    const nx = entries.map((e) =>
      e.id === id ? { ...e, result, review: result === "loss" ? e.review ?? { followedPlan: true, riskRespected: true, slMovedBadly: false, assumptionViolated: false } : e.review } : e
    );
    setEntries(nx);
    lsSet(K_JOURNAL, nx);
    if (result === "loss") {
      lsSet(K_LASTLOSS, new Date().toISOString());
      try {
        navigator.vibrate?.(40);
      } catch {
        /* پشتیبانی نمی‌شود */
      }
    }
  };

  const setReview = (id: string, key: keyof NonNullable<JournalEntry["review"]>, v: boolean) => {
    const nx = entries.map((e) => (e.id === id && e.review ? { ...e, review: { ...e.review, [key]: v } } : e));
    setEntries(nx);
    lsSet(K_JOURNAL, nx);
  };

  return (
    <div className="flex flex-col gap-2">
      {lock.locked && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-2 text-[10px] font-bold leading-5 text-rose-200">
          احتمالاً در حالت Revenge Trading هستید — یک نفس عمیق بکشید. پیشنهاد معامله تا {faDigits(lock.minutesLeft)} دقیقه دیگر قفل است.
        </div>
      )}
      {rest.suggest && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[10px] font-bold leading-5 text-amber-200">{rest.message}</div>
      )}

      <Section title="ثبت فرض‌ها — پیش از معامله" icon={<BookOpenCheck className="h-3.5 w-3.5 text-emerald-300" />}>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="text-[9px] font-bold text-muted-foreground">
            جهت
            <select value={side} onChange={(e) => setSide(e.target.value as "buy" | "sell")} className={inputCls}>
              <option value="buy">خرید</option>
              <option value="sell">فروش</option>
            </select>
          </label>
          <label className="text-[9px] font-bold text-muted-foreground">
            ورود (اختیاری)
            <input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" dir="ltr" className={inputCls} />
          </label>
        </div>
        <label className="mt-1.5 block text-[9px] font-bold text-muted-foreground">
          دلیل ورود (اجباری)
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="مثال: بازگشت از حمایت با کندل پوششی در ۱ ساعته" />
        </label>
        <label className="mt-1.5 block text-[9px] font-bold text-muted-foreground">
          سناریوی انتخاب‌شده
          <input value={scenario} onChange={(e) => setScenario(e.target.value)} className={inputCls} placeholder="سناریوی اول / دوم یا توضیح خودتان" />
        </label>
        <label className="mt-1.5 block text-[9px] font-bold text-muted-foreground">
          شرط ابطال (اجباری)
          <textarea value={invalidation} onChange={(e) => setInvalidation(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="مثال: بسته‌شدن کندل زیر 4185" />
        </label>
        <label className="mt-1.5 block text-[9px] font-bold text-muted-foreground">
          انتظار شما از معامله
          <input value={expectation} onChange={(e) => setExpectation(e.target.value)} className={inputCls} placeholder="مثال: رسیدن به TP با RR=۲" />
        </label>
        <button type="button" onClick={save} className="mt-2 w-full rounded-lg border border-emerald-500/50 bg-emerald-500/20 py-1.5 text-[11px] font-extrabold text-emerald-200">
          ثبت در ژورنال
        </button>
        {!saved && <p className="mt-1 text-[9px] text-muted-foreground">بدون دلیل و شرط ابطال، ثبت انجام نمی‌شود — تحلیل ناقص حدس زده نمی‌شود.</p>}
        {saved && <p className="mt-1 text-[9px] font-bold text-emerald-300">ثبت شد.</p>}
      </Section>

      <Section title={`معاملات ثبت‌شده${balance > 0 ? ` — موجودی: $${faNum(balance, 0)}` : ""}`} icon={<BookOpenCheck className="h-3.5 w-3.5 text-sky-300" />}>
        {entries.length === 0 ? (
          <p className="text-[10px] text-muted-foreground">هنوز معامله‌ای ثبت نشده است. کیفیت تصمیم جدا از سود/زیان ارزیابی می‌شود.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {entries.slice(0, 10).map((e) => {
              const dq = e.review && e.result ? decisionQuality({ ...e.review }, e.result) : null;
              return (
                <div key={e.id} className="rounded-lg border border-border/60 bg-background/40 p-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-extrabold">
                      {e.side === "buy" ? "خرید" : "فروش"} {e.entry ? <span dir="ltr">@ {e.entry}</span> : null}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{faTime(new Date(e.atISO))}</p>
                  </div>
                  <p className="mt-0.5 text-[10px] leading-5 text-foreground/85">دلیل: {e.reason}</p>
                  <p className="text-[9px] leading-4 text-muted-foreground">ابطال: {e.invalidation}</p>
                  {dq && <p className="mt-0.5 text-[9px] font-bold text-sky-300">ارزیابی: {DQ_LABEL[dq.grade]} — {dq.note}</p>}
                  <div className="mt-1 flex items-center gap-1">
                    {!e.result ? (
                      <>
                        <span className="text-[9px] text-muted-foreground">نتیجه:</span>
                        <button type="button" onClick={() => setResult(e.id, "win")} className="rounded-full border border-emerald-500/50 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-300">سود</button>
                        <button type="button" onClick={() => setResult(e.id, "loss")} className="rounded-full border border-rose-500/50 bg-rose-500/10 px-2 py-0.5 text-[9px] font-bold text-rose-300">ضرر</button>
                        <button type="button" onClick={() => setResult(e.id, "be")} className="rounded-full border border-border/70 bg-white/5 px-2 py-0.5 text-[9px] font-bold text-muted-foreground">سر‌به‌سر</button>
                      </>
                    ) : (
                      <>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${e.result === "win" ? "bg-emerald-500/15 text-emerald-300" : e.result === "loss" ? "bg-rose-500/15 text-rose-300" : "bg-white/10 text-muted-foreground"}`}>
                          {e.result === "win" ? "سود" : e.result === "loss" ? "ضرر" : "سربه‌سر"}
                        </span>
                        {e.review && (
                          <div className="flex flex-wrap items-center gap-1 text-[8px]">
                            {(
                              [
                                ["followedPlan", "طبق برنامه"],
                                ["riskRespected", "ریسک رعایت شد"],
                                ["slMovedBadly", "SL بد جابه‌جا شد"],
                                ["assumptionViolated", "فرض نقض شد"],
                              ] as const
                            ).map(([k, label]) => (
                              <button
                                key={k}
                                type="button"
                                onClick={() => setReview(e.id, k, !e.review![k])}
                                className={`rounded-full border px-1.5 py-px font-bold ${e.review![k] ? "border-sky-500/50 bg-sky-500/15 text-sky-300" : "border-border/60 text-muted-foreground"}`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-1.5 text-[9px] leading-4 text-muted-foreground">
          نتیجه یک معامله به‌تنهایی اثبات خوب یا بد بودن روش شما نیست؛ از چند نمونه محدود قانون کلی نسازید. ژورنال فقط روی همین دستگاه ذخیره می‌شود.
        </p>
      </Section>
    </div>
  );
}

/* ---------- تب عوامل کمّی: کمّی‌سازی اجباری اثر عوامل بر نماد ---------- */

const EFFECT_CLS: Record<string, string> = {
  supportive: "text-emerald-300",
  restrictive: "text-rose-300",
  neutral: "text-zinc-300",
  conflict: "text-amber-300",
  unknown: "text-muted-foreground",
};

type BetaT = NonNullable<FactorRow["beta"]["h5"]>;

function betaCell(b: BetaT | null): string {
  if (!b) return "—";
  return `${b.beta >= 0 ? "+" : ""}${faNum(b.beta, 3)}`;
}
function betaT(b: BetaT | null): string {
  if (!b) return "";
  return `t=${faNum(b.t, 1)}`;
}

function FactorsTab({
  sym,
  data,
  status,
  error,
  onReload,
}: {
  sym: "xau" | "dji";
  data: FactorQuantResponse | null;
  status: "idle" | "loading" | "done" | "error";
  error: string | null;
  onReload: () => void;
}) {
  const [allOverrides, setAllOverrides] = useState<Record<string, Record<string, number>>>(() =>
    lsGet<Record<string, Record<string, number>>>(K_FWEIGHTS, {})
  );
  const overrides = allOverrides[sym] ?? {};
  const wOf = (id: string, dflt: number) => overrides[id] ?? dflt;
  const setW = (id: string, v: number) => {
    setAllOverrides((prev) => {
      const nx = { ...prev, [sym]: { ...(prev[sym] ?? {}), [id]: isFinite(v) ? Math.max(0, Math.min(1, v)) : 0 } };
      lsSet(K_FWEIGHTS, nx);
      return nx;
    });
  };

  /* امتیاز تجمیعی با وزن‌های کاربر — فقط از عوامل معتبر */
  const localScore = useMemo(() => {
    if (!data) return null;
    const ov = allOverrides[sym] ?? {};
    const items = data.rows
      .filter((r) => r.pressure !== null)
      .map((r) => ({ id: r.id, w: ov[r.id] ?? r.w, p: r.pressure as number }));
    return compositeScore(items);
  }, [data, allOverrides, sym]);

  const sumValidW = useMemo(() => {
    if (!data) return 0;
    const ov = allOverrides[sym] ?? {};
    return data.rows.filter((r) => r.pressure !== null).reduce((s, r) => s + (ov[r.id] ?? r.w), 0);
  }, [data, allOverrides, sym]);

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <LoaderCircle className="h-6 w-6 animate-spin text-violet-300" />
        <p className="text-xs font-bold text-foreground/80">در حال برآورد رگرسیون‌های تاریخی…</p>
        <p className="text-[10px] text-muted-foreground">بازده نماد و عوامل در افق‌های ۱/۵/۲۰ روزه — چند ثانیه</p>
      </div>
    );
  }
  if (status === "error" || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <AlertTriangle className="h-6 w-6 text-amber-400" />
        <p className="max-w-[280px] text-[11px] leading-5 text-muted-foreground">{error ?? "داده عوامل در دسترس نیست"}</p>
        <button type="button" onClick={onReload} className="rounded-full border border-violet-500/50 bg-violet-500/15 px-3.5 py-1.5 text-xs font-extrabold text-violet-200">
          تلاش مجدد
        </button>
      </div>
    );
  }

  const score = localScore ?? data.composite.score;
  const scoreLabel = compositeLabelFa(score);

  return (
    <div className="flex flex-col gap-2">
      {/* شاخص فشار مدل */}
      <Section title="شاخص فشار مدل — Composite" icon={<Sigma className="h-3.5 w-3.5 text-violet-300" />}>
        <div className="flex items-center gap-3">
          <div
            className={`flex h-16 w-16 flex-none flex-col items-center justify-center rounded-2xl border ${
              score === null
                ? "border-border/70 bg-card/60 text-zinc-300"
                : score > 15
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : score < -15
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-300"
            }`}
            data-testid="bt-factors-score"
          >
            <span className="text-lg font-black" dir="ltr">{score === null ? "—" : (score > 0 ? "+" : "") + faDigits(score)}</span>
            <span className="text-[8px] font-bold">−۱۰۰ تا +۱۰۰</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-extrabold">{scoreLabel}</p>
            <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
              مثبت = فشار تاریخی مدل به سمت رشد نماد · منفی = فشار به سمت افت · نزدیک صفر = فشار خالص کم یا عوامل متضاد.
              <br />
              این «شاخص فشار مدل» است — احتمال صعود، بازده مورد انتظار یا تضمین حرکت نیست.
            </p>
          </div>
        </div>
        {data.composite.skipped.length > 0 && (
          <div className="mt-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 px-2 py-1.5">
            <p className="text-[9px] font-bold text-amber-200">عوامل کنارگذاشته‌شده از امتیاز (وزن بقیه بازتنظیم شد — مجموع وزن مؤثر: {faNum(sumValidW)}):</p>
            <ul className="mt-0.5">
              {data.composite.skipped.map((s) => (
                <li key={s.id} className="text-[9px] leading-4 text-amber-200/80">• {s.nameFa}: {s.reason}</li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* جدول عوامل */}
      <Section title="جدول کمّی عوامل — رابطه تاریخی/آماری، نه علّی" icon={<SlidersHorizontal className="h-3.5 w-3.5 text-sky-300" />}>
        <div className="overflow-x-auto" data-testid="bt-factors-table">
          <table className="w-full min-w-[620px] text-[9px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 text-start font-bold">عامل</th>
                <th className="py-1 text-center font-bold">مقدار جاری</th>
                <th className="py-1 text-center font-bold">تغییر ۵روزه</th>
                <th className="py-1 text-center font-bold">Z</th>
                <th className="py-1 text-center font-bold">β افق ۱ر</th>
                <th className="py-1 text-center font-bold">β افق ۵ر</th>
                <th className="py-1 text-center font-bold">β افق ۲۰ر</th>
                <th className="py-1 text-center font-bold">Pressure</th>
                <th className="py-1 text-center font-bold">قابلیت اتکا</th>
                <th className="py-1 text-center font-bold">اثر فعلی بر نماد</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-t border-border/50">
                  <td className="py-1.5 pe-1">
                    <p className="font-bold">{r.nameFa}</p>
                    <p className="text-[8px] text-muted-foreground" dir="ltr">Yahoo: {r.sourceYahoo} · وزن {faNum(wOf(r.id, r.w))}</p>
                  </td>
                  <td className="py-1.5 text-center font-bold" dir="ltr">{faNum(r.current)}</td>
                  <td className="py-1.5 text-center" dir="ltr">{r.change5 === null ? "—" : (r.change5 > 0 ? "+" : "") + faNum(r.change5) + " " + r.unitFa}</td>
                  <td className="py-1.5 text-center" dir="ltr">{r.z === null ? "—" : (r.z > 0 ? "+" : "") + faNum(r.z)}</td>
                  <td className="py-1.5 text-center" dir="ltr" title={r.beta.h1 ? `SE=${faNum(r.beta.h1.se, 3)} | CI: ${faNum(r.beta.h1.ciLo, 2)} تا ${faNum(r.beta.h1.ciHi, 2)} | n=${faDigits(r.beta.h1.n)}` : ""}>
                    {betaCell(r.beta.h1)}
                    <span className="block text-[7px] text-muted-foreground">{betaT(r.beta.h1)}</span>
                  </td>
                  <td className="py-1.5 text-center" dir="ltr" title={r.beta.h5 ? `SE=${faNum(r.beta.h5.se, 3)} | CI: ${faNum(r.beta.h5.ciLo, 2)} تا ${faNum(r.beta.h5.ciHi, 2)} | n=${faDigits(r.beta.h5.n)}` : ""}>
                    {betaCell(r.beta.h5)}
                    <span className="block text-[7px] text-muted-foreground">{betaT(r.beta.h5)}</span>
                  </td>
                  <td className="py-1.5 text-center" dir="ltr" title={r.beta.h20 ? `SE=${faNum(r.beta.h20.se, 3)} | CI: ${faNum(r.beta.h20.ciLo, 2)} تا ${faNum(r.beta.h20.ciHi, 2)} | n=${faDigits(r.beta.h20.n)}` : ""}>
                    {betaCell(r.beta.h20)}
                    <span className="block text-[7px] text-muted-foreground">{betaT(r.beta.h20)}</span>
                  </td>
                  <td className="py-1.5 text-center font-black" dir="ltr">
                    {r.pressure === null ? "نامشخص" : (r.pressure > 0 ? "+" : "") + faNum(r.pressure, 3)}
                  </td>
                  <td className="py-1.5 text-center" dir="ltr">{r.reliability === null ? "—" : faNum(r.reliability)}</td>
                  <td className={`py-1.5 text-center font-extrabold ${EFFECT_CLS[r.effect] ?? ""}`}>{r.effectFa}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* تفسیر به زبان ساده */}
        {data.rows.some((r) => r.interpFa) && (
          <div className="mt-1.5 flex flex-col gap-1">
            {data.rows.filter((r) => r.interpFa).map((r) => (
              <p key={r.id} className="rounded-lg border border-border/50 bg-background/40 px-2 py-1 text-[9px] leading-4 text-foreground/85">{r.interpFa}</p>
            ))}
          </div>
        )}
        {data.rows.filter((r) => !r.reliable5 && r.unreliableReason).map((r) => (
          <p key={r.id} className="mt-1 text-[9px] leading-4 text-amber-300/90">⚠ {r.nameFa}: {r.unreliableReason} — Pressure محاسبه نشد و عدد حدس زده نشد.</p>
        ))}
        {data.overlaps.map((o, i) => (
          <p key={i} className="mt-1 text-[9px] leading-4 text-amber-300/90">⚠ {o.note}</p>
        ))}
      </Section>

      {/* غافلگیری استانداردشده خبری */}
      {data.surprise && (
        <Section title="غافلگیری استانداردشده آخرین داده اقتصادی High" icon={<Newspaper className="h-3.5 w-3.5 text-amber-300" />}>
          <p className="text-[10px] font-bold">{data.surprise.titleFa ?? data.surprise.title}</p>
          <div className="mt-0.5 grid grid-cols-3 gap-1 text-center">
            <div className="rounded-lg border border-border/60 bg-background/40 p-1">
              <p className="text-[8px] text-muted-foreground">واقعی</p>
              <p className="text-[11px] font-extrabold" dir="ltr">{data.surprise.actual}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-1">
              <p className="text-[8px] text-muted-foreground">انتظار</p>
              <p className="text-[11px] font-extrabold" dir="ltr">{data.surprise.forecast ?? "—"}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/40 p-1">
              <p className="text-[8px] text-muted-foreground">Surprise Z</p>
              <p className="text-[11px] font-extrabold" dir="ltr">{data.surprise.surpriseZ === null ? "نامشخص" : (data.surprise.surpriseZ > 0 ? "+" : "") + faNum(data.surprise.surpriseZ)}</p>
            </div>
          </div>
          <p className="mt-1 text-[9px] leading-4 text-muted-foreground">{data.surprise.note}</p>
        </Section>
      )}

      {/* تنظیمات وزن‌ها */}
      <Section title="تنظیمات وزن عوامل (۰ تا ۱)" icon={<SlidersHorizontal className="h-3.5 w-3.5 text-violet-300" />}>
        <div className="flex flex-col gap-1.5">
          {data.rows.map((r) => (
            <label key={r.id} className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[10px] font-bold">{r.nameFa}</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={wOf(r.id, r.w)}
                onChange={(e) => setW(r.id, Number(e.target.value))}
                dir="ltr"
                className="w-16 flex-none rounded-lg border border-border/70 bg-background/60 px-1.5 py-1 text-center text-[11px] font-bold outline-none focus:border-violet-500/50"
                aria-label={`وزن ${r.nameFa}`}
              />
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-[9px] leading-4 text-muted-foreground">
          وزن‌ها در امتیاز تجمیعی همان بالا اعمال می‌شوند. اگر داده عاملی موجود نباشد از امتیاز کنار گذاشته می‌شود و وزن عوامل باقی‌مانده شفاف بازتنظیم می‌شود (مجموع وزن مؤثر فعلی: {faNum(sumValidW)}).
          {data.overlaps.length > 0 && <> عوامل هم‌پوشان بالاتر با وزن ترکیبی بالاتر از یک عامل مستقل حساب می‌شوند — در تنظیم وزن لحاظ کنید.</>}
        </p>
      </Section>

      {/* یادداشت‌های روش */}
      <Section title="روش و محدودیت‌ها" icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}>
        <ul className="flex flex-col gap-1">
          {data.notes.map((n, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[9px] leading-4 text-muted-foreground">
              <span className="mt-1 h-1 w-1 flex-none rounded-full bg-sky-400" />
              {n}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[9px] leading-4 text-muted-foreground/80">
          دوره نمونه: {data.sample.fromISO ? faTime(new Date(data.sample.fromISO)) : "—"} تا {data.sample.toISO ? faTime(new Date(data.sample.toISO)) : "—"} ({faDigits(data.sample.bars ?? 0)} کندل روزانه) · آخرین محاسبه: {faTime(new Date(data.generatedAtISO))}
        </p>
        <p className="mt-1 text-[9px] font-bold leading-4 text-foreground/80">{data.disclaimer}</p>
      </Section>
    </div>
  );
}
