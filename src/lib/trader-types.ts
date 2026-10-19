/** تایپ‌های پاسخ API دستیار معامله‌گر (/api/trader) */
import type { FactorResult, RegimeResult, DivergenceResult, ConfluenceResult, ScenarioOutput, EntryZoneOutput, RangeWarning } from "./trader-engine";
import type { MSRow } from "./types";

export interface SymbolSpecItem {
  label: string;
  value: string;
  needsConfirm: boolean;
}

export interface TraderSymbolData {
  key: "xau" | "dji";
  name: string;
  price: number | null;
  changePct: number | null;
  specs: SymbolSpecItem[];
  healthyAtrBand: [number, number];
  contractSize: number;
  expectInverseDxy: boolean;
}

export interface TraderResponse {
  ok: true;
  generatedAtISO: string;
  dataQuality: {
    structure: string;
    structureAtISO: string | null;
    prices: string;
    events: string;
    correlation: string;
    notes: string[];
  };
  symbol: TraderSymbolData;
  dxy: { price: number | null; changePct: number | null; corr30: number | null; corrWindow: string; updatedAtISO: string | null };
  us10y: { price: number | null; changePct: number | null };
  structure: {
    rows: MSRow[];
    summary: "aligned" | "mixed" | "conflict";
    summaryFa: string;
    detail: string;
    resistance: number | null;
    support: number | null;
  };
  regime: RegimeResult;
  divergence: DivergenceResult;
  newsGap: {
    minutesLeft: number | null;
    event: { id: string; title: string; titleFa: string | null; country: string; dateISO: string | null; impact: string; forecast: string | null; previous: string | null } | null;
  };
  confluence: ConfluenceResult;
  rsi: number | null;
  scenarios: { items: ScenarioOutput[]; conflict: string | null };
  history: {
    available: boolean;
    reason: string | null;
    n: number | null;
    windowDays: number | null;
    method: string | null;
    stats: { avgMovePct: number | null; upPct: number | null; minPct: number | null; maxPct: number | null } | null;
  };
  preMortem: { factors: string[]; balanceNote: string };
  checklistAuto: { newsNear: boolean; tfSummary: string; dxyCompatible: boolean; dataFresh: boolean };
  /** هشدار رنج/رنج فشرده — همیشه برچسب زمانی داده دارد */
  rangeWarning: RangeWarning;
  /** نواحی ورود مبتنی بر ساختار (الگوریتمی) */
  entryZones: EntryZoneOutput;
}
