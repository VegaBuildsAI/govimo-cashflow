// Cliente del API Fase 1. `/api` se proxea a localhost:8000 (vite.config.js).

import type { Currency } from "./mock";

export interface ApiPosition {
  currency: Currency;
  balance: number;
  weekDelta: number;
  accounts: string[];
  minBalance: number;
}

export interface PositionsResponse {
  asOf: string;
  baseCurrency: string;
  consolidatedUSD: number;
  positions: ApiPosition[];
  rates: Record<Currency, number>;
}

export async function fetchPositions(): Promise<PositionsResponse> {
  const res = await fetch("/api/positions");
  if (!res.ok) throw new Error(`API /positions respondió ${res.status}`);
  return res.json();
}

// ── Fase 4 · capa de aprendizaje ─────────────────────────────────────────────

export type Modelo = "reglas" | "estadistica" | "ml";

export interface ApiModelMetric {
  modelo: Modelo;
  periodo_desde: string;
  periodo_hasta: string;
  n_predicciones: number;
  mae_dias: number | null;
  sesgo_dias: number | null;
  mae_monto_base: number | null;
  baseline_mae_dias: number | null;
  supera_baseline: boolean | null;
  creado_en: string;
}

export async function fetchModelMetrics(): Promise<ApiModelMetric[]> {
  const res = await fetch("/api/metrics");
  if (!res.ok) throw new Error(`API /metrics respondió ${res.status}`);
  return (await res.json()).metrics;
}
