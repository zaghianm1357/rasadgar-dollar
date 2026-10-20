/** تایپ‌های پاسخ API کمّی‌سازی عوامل (/api/factor-quant) */
import type { BetaOut, EffectKind } from "./factor-quant";

export interface FactorRow {
  id: string;
  nameFa: string;
  roleFa: string;
  sourceYahoo: string;
  unitFa: string;
  current: number | null;
  currentZPctile: number | null;
  change5: number | null;
  z: number | null;
  beta: { h1: BetaOut | null; h5: BetaOut | null; h20: BetaOut | null };
  reliable5: boolean;
  unreliableReason: string | null;
  pressure: number | null;
  reliability: number | null;
  effect: EffectKind;
  effectFa: string;
  w: number;
  interpFa: string | null;
}

export interface FactorQuantResponse {
  ok: true;
  symbol: "xau" | "dji";
  generatedAtISO: string;
  sample: { fromISO: string | null; toISO: string | null; bars: number | null };
  rows: FactorRow[];
  surprise: {
    title: string;
    titleFa: string | null;
    dateISO: string | null;
    actual: string;
    forecast: string | null;
    surpriseZ: number | null;
    n: number;
    note: string;
  } | null;
  composite: {
    score: number | null;
    label: string;
    used: { id: string; nameFa: string; w: number; p: number }[];
    skipped: { id: string; nameFa: string; reason: string }[];
  };
  overlaps: { a: string; b: string; r: number; combinedW: number; note: string }[];
  notes: string[];
  disclaimer: string;
}
