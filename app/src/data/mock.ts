// Datos ficticios para el mock navegable — Fase 0. Nada de esto es real.

export type Currency = "CNY" | "USD" | "MXN" | "CRC";

export const BASE_CURRENCY = "USD";

export const RATES_TO_USD: Record<Currency, number> = {
  CNY: 1 / 7.16,
  USD: 1,
  MXN: 1 / 18.42,
  CRC: 1 / 512,
};

export const CURRENCY_META: Record<
  Currency,
  { name: string; symbol: string; color: string }
> = {
  CNY: { name: "Yuan chino", symbol: "¥", color: "#E4B547" },
  USD: { name: "Dólar EE.UU.", symbol: "$", color: "#5447E4" },
  MXN: { name: "Peso mexicano", symbol: "MX$", color: "#47C9E4" },
  CRC: { name: "Colón costarricense", symbol: "₡", color: "#6FE48B" },
};

export function toUSD(amount: number, currency: Currency): number {
  return amount * RATES_TO_USD[currency];
}

export function fmtMoney(amount: number, currency: Currency, compact = false): string {
  const { symbol } = CURRENCY_META[currency];
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  if (compact) {
    if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(0)}k`;
    return `${sign}${symbol}${abs.toFixed(0)}`;
  }
  return `${sign}${symbol}${abs.toLocaleString("es-CR", { maximumFractionDigits: 0 })}`;
}

// ── Posición actual (11 jun 2026) ────────────────────────────────────────────
export interface Position {
  currency: Currency;
  balance: number;
  weekDelta: number; // variación vs semana anterior, en moneda original
  accounts: string[];
  minBalance: number; // mínimo operativo definido (mock, "lo configura Felipe")
}

export const POSITIONS: Position[] = [
  {
    currency: "CNY",
    balance: 1_240_000,
    weekDelta: -86_000,
    accounts: ["Bank of China · 6841"],
    minBalance: 300_000,
  },
  {
    currency: "USD",
    balance: 486_500,
    weekDelta: 31_200,
    accounts: ["BAC · 2210", "Banco Nacional · 9034"],
    minBalance: 150_000,
  },
  {
    currency: "MXN",
    balance: 2_150_000,
    weekDelta: 118_000,
    accounts: ["BBVA México · 5572"],
    minBalance: 600_000,
  },
  {
    currency: "CRC",
    balance: 168_000_000,
    weekDelta: -12_400_000,
    accounts: ["BAC · 8801", "BCR · 1145 (SINPE)"],
    minBalance: 75_000_000,
  },
];

export const consolidatedUSD = POSITIONS.reduce(
  (sum, p) => sum + toUSD(p.balance, p.currency),
  0,
);

// ── Forecast 13 semanas ──────────────────────────────────────────────────────
// Saldo proyectado al cierre de cada semana, por moneda. Índice 0 = hoy (S0).
export interface ForecastWeek {
  week: string; // "S0" … "S13"
  date: string; // fin de semana proyectada
  balances: Record<Currency, number>;
}

const WEEK_DATES = [
  "11 jun", "19 jun", "26 jun", "3 jul", "10 jul", "17 jul", "24 jul",
  "31 jul", "7 ago", "14 ago", "21 ago", "28 ago", "4 sep", "11 sep",
];

const CNY_W = [1240, 1180, 1205, 355, 410, 520, -80, 340, 410, 580, 720, 690, 810, 860].map((v) => v * 1000);
const USD_W = [486.5, 502, 471, 455, 510, 533, 548, 521, 560, 587, 565, 602, 618, 640].map((v) => v * 1000);
const MXN_W = [2150, 2080, 1950, 2210, 2150, 1890, 1820, 2350, 2280, 2190, 2050, 2400, 2330, 2510].map((v) => v * 1000);
const CRC_W = [168, 142, 155, 128, 141, 119, 132, 98, 112, 84, 96, 71, 88, 64].map((v) => v * 1_000_000);

export const FORECAST: ForecastWeek[] = WEEK_DATES.map((date, i) => ({
  week: `S${i}`,
  date,
  balances: { CNY: CNY_W[i], USD: USD_W[i], MXN: MXN_W[i], CRC: CRC_W[i] },
}));

export function forecastConsolidatedUSD(w: ForecastWeek): number {
  return (Object.keys(w.balances) as Currency[]).reduce(
    (sum, c) => sum + toUSD(w.balances[c], c),
    0,
  );
}

// Puntos de faltante: saldo proyectado bajo el mínimo operativo (o negativo).
export interface Shortfall {
  weekIndex: number;
  currency: Currency;
  projected: number;
  severity: "negativo" | "bajo-minimo";
}

export const SHORTFALLS: Shortfall[] = (() => {
  const out: Shortfall[] = [];
  const mins = Object.fromEntries(POSITIONS.map((p) => [p.currency, p.minBalance]));
  FORECAST.forEach((w, i) => {
    (Object.keys(w.balances) as Currency[]).forEach((c) => {
      const v = w.balances[c];
      if (v < 0) out.push({ weekIndex: i, currency: c, projected: v, severity: "negativo" });
      else if (v < (mins[c] as number))
        out.push({ weekIndex: i, currency: c, projected: v, severity: "bajo-minimo" });
    });
  });
  return out;
})();

// ── Calendario de pagos y cobros ─────────────────────────────────────────────
export type Impact = "alto" | "medio" | "bajo";
export type MovType = "pago" | "cobro";
export type MovStatus = "programado" | "esperado" | "provisional" | "confirmado";
export type Source = "NetSuite" | "Banco" | "SINPE" | "WhatsApp" | "Archivo";

export interface Movement {
  id: string;
  date: string; // ISO
  dateLabel: string;
  type: MovType;
  counterparty: string;
  concept: string;
  currency: Currency;
  amount: number;
  impact: Impact;
  status: MovStatus;
  source: Source;
}

export const MOVEMENTS: Movement[] = [
  { id: "m01", date: "2026-06-13", dateLabel: "sáb 13 jun", type: "pago", counterparty: "Planilla quincenal", concept: "Salarios + cargas CCSS", currency: "CRC", amount: 14_800_000, impact: "alto", status: "programado", source: "Archivo" },
  { id: "m02", date: "2026-06-15", dateLabel: "lun 15 jun", type: "cobro", counterparty: "Distribuidora del Pacífico S.A.", concept: "Factura NS-2241", currency: "MXN", amount: 480_000, impact: "medio", status: "esperado", source: "NetSuite" },
  { id: "m03", date: "2026-06-16", dateLabel: "mar 16 jun", type: "pago", counterparty: "Oracle NetSuite", concept: "Licencias anuales", currency: "USD", amount: 38_400, impact: "medio", status: "programado", source: "NetSuite" },
  { id: "m04", date: "2026-06-17", dateLabel: "mié 17 jun", type: "cobro", counterparty: "Cobro en efectivo (reporte Federico)", concept: "Venta mostrador — por validar", currency: "CRC", amount: 2_400_000, impact: "bajo", status: "provisional", source: "WhatsApp" },
  { id: "m05", date: "2026-06-19", dateLabel: "vie 19 jun", type: "pago", counterparty: "Flete marítimo COSCO", concept: "BL-88412 Shenzhen→Caldera", currency: "USD", amount: 21_700, impact: "medio", status: "programado", source: "Archivo" },
  { id: "m06", date: "2026-06-22", dateLabel: "lun 22 jun", type: "cobro", counterparty: "Grupo Lumen MX", concept: "Factura NS-2198 · vencida hace 6 días", currency: "MXN", amount: 580_000, impact: "alto", status: "esperado", source: "NetSuite" },
  { id: "m07", date: "2026-06-25", dateLabel: "jue 25 jun", type: "pago", counterparty: "Hacienda — IVA", concept: "Declaración D-104 mayo", currency: "CRC", amount: 9_300_000, impact: "alto", status: "programado", source: "Archivo" },
  { id: "m08", date: "2026-06-26", dateLabel: "vie 26 jun", type: "cobro", counterparty: "Ferretería Central S.A.", concept: "Transferencia SINPE", currency: "CRC", amount: 5_650_000, impact: "medio", status: "esperado", source: "SINPE" },
  { id: "m09", date: "2026-06-28", dateLabel: "dom 28 jun", type: "pago", counterparty: "Planilla quincenal", concept: "Salarios + cargas CCSS", currency: "CRC", amount: 14_800_000, impact: "alto", status: "programado", source: "Archivo" },
  { id: "m10", date: "2026-07-02", dateLabel: "jue 2 jul", type: "pago", counterparty: "Shenzhen Huaray Tech Co.", concept: "OC-1180 · 40% anticipo contenedores", currency: "CNY", amount: 850_000, impact: "alto", status: "programado", source: "NetSuite" },
  { id: "m11", date: "2026-07-06", dateLabel: "lun 6 jul", type: "cobro", counterparty: "Comercial Andina Ltda.", concept: "Factura NS-2255", currency: "USD", amount: 64_000, impact: "medio", status: "esperado", source: "NetSuite" },
  { id: "m12", date: "2026-07-08", dateLabel: "mié 8 jul", type: "pago", counterparty: "Alquiler bodega Alajuela", concept: "Canon mensual julio", currency: "CRC", amount: 4_200_000, impact: "bajo", status: "programado", source: "Archivo" },
  { id: "m13", date: "2026-07-10", dateLabel: "vie 10 jul", type: "cobro", counterparty: "Distribuidora del Pacífico S.A.", concept: "Factura NS-2260", currency: "MXN", amount: 720_000, impact: "medio", status: "esperado", source: "NetSuite" },
  { id: "m14", date: "2026-07-15", dateLabel: "mié 15 jul", type: "pago", counterparty: "Seguros INS", concept: "Póliza carga internacional", currency: "CRC", amount: 3_100_000, impact: "bajo", status: "programado", source: "NetSuite" },
  { id: "m15", date: "2026-07-23", dateLabel: "jue 23 jul", type: "pago", counterparty: "Shenzhen Huaray Tech Co.", concept: "OC-1180 · 60% contra embarque", currency: "CNY", amount: 600_000, impact: "alto", status: "programado", source: "NetSuite" },
  { id: "m16", date: "2026-07-27", dateLabel: "lun 27 jul", type: "cobro", counterparty: "Importadora Veragua S.A.", concept: "Factura NS-2263", currency: "CNY", amount: 420_000, impact: "alto", status: "esperado", source: "NetSuite" },
  { id: "m17", date: "2026-07-30", dateLabel: "jue 30 jul", type: "cobro", counterparty: "Grupo Lumen MX", concept: "Factura NS-2270", currency: "MXN", amount: 940_000, impact: "alto", status: "esperado", source: "NetSuite" },
  { id: "m18", date: "2026-08-04", dateLabel: "mar 4 ago", type: "pago", counterparty: "Hacienda — IVA", concept: "Declaración D-104 junio", currency: "CRC", amount: 8_700_000, impact: "alto", status: "programado", source: "Archivo" },
];

// ── Centro de alertas ────────────────────────────────────────────────────────
export type Severity = "critica" | "alta" | "media" | "info";

export interface CashCheck {
  currency: Currency;
  required: number;
  projectedAvailable: number; // caja proyectada en esa moneda a la fecha del pago
  sufficient: boolean;
  suggestion?: string;
}

export interface Alert {
  id: string;
  severity: Severity;
  kind: "pago_proximo" | "faltante" | "cobro_atrasado" | "anomalia" | "revision";
  title: string;
  detail: string;
  daysAway?: number;
  check?: CashCheck;
  tag?: string;
}

export const ALERTS: Alert[] = [
  {
    id: "a1",
    severity: "critica",
    kind: "faltante",
    title: "Pago importante sin cobertura — Shenzhen Huaray (60%)",
    detail:
      "Pago de ¥600,000 programado para el jue 23 jul (OC-1180, contra embarque). La caja proyectada en CNY a esa fecha no alcanza.",
    daysAway: 42,
    check: {
      currency: "CNY",
      required: 600_000,
      projectedAvailable: 520_000,
      sufficient: false,
      suggestion:
        "Faltan ¥80,000 (≈ $11,200). Opciones: convertir USD→CNY antes del 20 jul, o adelantar el cobro de Importadora Veragua (¥420,000, esperado 27 jul).",
    },
  },
  {
    id: "a2",
    severity: "alta",
    kind: "pago_proximo",
    title: "Pago importante próximo — Shenzhen Huaray (40% anticipo)",
    detail:
      "Pago de ¥850,000 programado para el jue 2 jul (OC-1180, anticipo de contenedores).",
    daysAway: 21,
    check: {
      currency: "CNY",
      required: 850_000,
      projectedAvailable: 1_205_000,
      sufficient: true,
    },
  },
  {
    id: "a3",
    severity: "alta",
    kind: "faltante",
    title: "Riesgo de faltante en CRC hacia la semana 12",
    detail:
      "La proyección de colones cae bajo el mínimo operativo (₡75M) a partir del 28 ago por IVA + planillas acumuladas. Sin cobros nuevos, cierra el 11 sep en ₡64M.",
    daysAway: 78,
    check: {
      currency: "CRC",
      required: 75_000_000,
      projectedAvailable: 64_000_000,
      sufficient: false,
      suggestion:
        "Adelantar facturación de agosto o programar conversión MXN→CRC (caja MXN proyectada con holgura: MX$2.3M).",
    },
  },
  {
    id: "a4",
    severity: "media",
    kind: "cobro_atrasado",
    title: "Cobro atrasado — Grupo Lumen MX",
    detail:
      "Factura NS-2198 por MX$580,000 venció hace 6 días. Patrón histórico del cliente: paga en promedio 12 días tarde.",
  },
  {
    id: "a5",
    severity: "info",
    kind: "revision",
    title: "Movimiento provisional pendiente de revisión",
    detail:
      "Cobro en efectivo por ₡2,400,000 reportado por Federico vía WhatsApp (17 jun). No afecta la proyección hasta que se valide.",
  },
  {
    id: "a6",
    severity: "info",
    kind: "anomalia",
    title: "Anomalía detectada (demo · Fase 4)",
    detail:
      "Débito bancario USD por $4,820 sin contraparte conocida en NetSuite. El modelo lo marca como fuera del patrón de los últimos 6 meses.",
    tag: "ML",
  },
];

// ── KPIs (mock — los define Felipe en Discovery) ─────────────────────────────
export const KPIS = [
  { label: "Días de caja", value: "38", sub: "consolidado, a ritmo de gasto actual" },
  { label: "Pagos próximos 7 días", value: "3", sub: "₡29.1M + $38.4k equivalentes" },
  { label: "Cobros esperados 30 días", value: "$214k", sub: "equivalente USD, 6 facturas" },
  { label: "Exposición CNY", value: "16%", sub: "de la caja total · pagos OC-1180 en jul" },
];
