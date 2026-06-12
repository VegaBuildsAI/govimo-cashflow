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
