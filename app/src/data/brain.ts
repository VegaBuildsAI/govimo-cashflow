// Simulación del ML Engine (Brain) — demo visual. El ML real llega en Fase 4.

export interface ModelMetric {
  label: string;
  value: string;
  baseline: string; // línea base (motor de reglas) — el ML solo "gana" si la supera
  delta: string;
  spark: number[];
}

export const MODEL_METRICS: ModelMetric[] = [
  {
    label: "MAPE forecast 13 semanas",
    value: "6.8%",
    baseline: "reglas: 11.2%",
    delta: "−39% error",
    spark: [11.2, 10.6, 10.1, 9.4, 8.8, 8.1, 7.6, 7.2, 6.9, 6.8],
  },
  {
    label: "MAE fecha real de cobro",
    value: "2.3 días",
    baseline: "reglas: 5.1 días",
    delta: "−55% error",
    spark: [5.1, 4.8, 4.2, 3.9, 3.4, 3.1, 2.8, 2.6, 2.4, 2.3],
  },
  {
    label: "Precisión de alertas",
    value: "92%",
    baseline: "umbral mínimo: 80%",
    delta: "+12 pts",
    spark: [78, 81, 83, 85, 86, 88, 89, 90, 91, 92],
  },
  {
    label: "Cobertura de predicción",
    value: "87%",
    baseline: "movimientos con predicción",
    delta: "+9 pts/mes",
    spark: [61, 65, 70, 73, 76, 79, 82, 84, 86, 87],
  },
];

// Error semanal % — el ML debe ganarle a las reglas (docx: métrica pre-acordada)
export const ML_VS_BASELINE = Array.from({ length: 13 }, (_, i) => ({
  week: `S${i + 1}`,
  reglas: +(11.4 - i * 0.08 + Math.sin(i * 1.7) * 0.6).toFixed(2),
  ml: +(10.8 - i * 0.36 + Math.sin(i * 2.3) * 0.35).toFixed(2),
}));

export interface LiveKpi {
  id: string;
  label: string;
  unit: string;
  base: number;
  decimals: number;
  jitter: number; // amplitud del movimiento en vivo
  goodWhenDown: boolean;
  sub: string;
}

export const LIVE_KPIS: LiveKpi[] = [
  { id: "dso", label: "DSO", unit: " días", base: 38.4, decimals: 1, jitter: 0.5, goodWhenDown: true, sub: "días promedio de cobro" },
  { id: "ontime", label: "Cobros a tiempo", unit: "%", base: 81.2, decimals: 1, jitter: 0.8, goodWhenDown: false, sub: "últimos 30 días" },
  { id: "fx", label: "Exposición FX", unit: "k USD", base: 318, decimals: 0, jitter: 6, goodWhenDown: true, sub: "no cubierta · CNY+MXN" },
  { id: "runway", label: "Días de caja", unit: " días", base: 64, decimals: 0, jitter: 1.2, goodWhenDown: false, sub: "al ritmo de quema actual" },
];

export const MODEL_HEALTH = [
  { label: "Drift de datos", value: 12, max: 100, display: "0.12 · estable" },
  { label: "AUC detección de anomalías", value: 91, max: 100, display: "0.91" },
  { label: "Ventana de entrenamiento", value: 78, max: 100, display: "18 meses · 14,206 movs" },
  { label: "Confianza media de predicción", value: 84, max: 100, display: "84%" },
];

// ── Feed estilo consola de contenedor ────────────────────────────────────────
export type LogChannel = "ingesta" | "fx" | "predict" | "train" | "alerta" | "sys";

export interface LogLine {
  id: number;
  ts: string;
  channel: LogChannel;
  text: string;
  level: "info" | "ok" | "warn" | "err";
}

const COUNTERPARTIES = [
  "Shenzhen Huaray Tech", "Grupo Lumen MX", "Nortec USA Inc", "Corporación Delta CR",
  "Guangzhou Mercantil", "Ferretería El Norte", "Hacienda CR", "Arrendadora Polanco",
];
const CURS = ["CNY", "USD", "MXN", "CRC"];
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const n = (lo: number, hi: number, d = 0) => (lo + Math.random() * (hi - lo)).toFixed(d);

const GENERATORS: Array<() => Omit<LogLine, "id" | "ts">> = [
  () => ({ channel: "ingesta", level: "info", text: `sync NetSuite SuiteQL · ${n(3, 42)} transacciones nuevas, ${n(0, 4)} actualizadas` }),
  () => ({ channel: "ingesta", level: "ok", text: `estado de cuenta ${pick(["BAC", "BCR", "BBVA México", "Bank of China"])} conciliado · ${n(4, 28)} movimientos` }),
  () => ({ channel: "ingesta", level: "warn", text: `movimiento provisional vía WhatsApp (Federico) → cola de revisión` }),
  () => ({ channel: "fx", level: "info", text: `tasa ${pick(CURS)}→USD actualizada · fuente BCCR · spread ${n(0.1, 0.9, 2)}%` }),
  () => ({ channel: "predict", level: "ok", text: `p(pago a tiempo) ${pick(COUNTERPARTIES)} = ${n(0.42, 0.97, 2)} · fecha probable +${n(0, 14)}d` }),
  () => ({ channel: "predict", level: "info", text: `forecast ${pick(CURS)} recalculado · Δ vs anterior ${n(-2.4, 2.4, 1)}%` }),
  () => ({ channel: "predict", level: "warn", text: `anomalía score ${n(0.71, 0.93, 2)} en ${pick(COUNTERPARTIES)} · monto fuera de patrón` }),
  () => ({ channel: "train", level: "info", text: `backtest ventana móvil · MAPE ${n(6.2, 7.4, 1)}% vs reglas ${n(10.8, 11.6, 1)}%` }),
  () => ({ channel: "train", level: "ok", text: `gradient boosting re-evaluado · ${n(120, 340)} árboles · early stop @${n(40, 90)}` }),
  () => ({ channel: "alerta", level: "warn", text: `pago importante en ${n(2, 9)}d · verificación de efectivo ${pick(CURS)} en curso` }),
  () => ({ channel: "alerta", level: "err", text: `riesgo de faltante ${pick(["CNY", "CRC"])} semana S${n(3, 8)} · cobertura ${n(62, 94)}%` }),
  () => ({ channel: "sys", level: "info", text: `checkpoint persistido · ${n(80, 240)}ms · réplica ok` }),
];

let logSeq = 0;

export function nextLogLine(): LogLine {
  const ts = new Date().toLocaleTimeString("es-CR", { hour12: false });
  return { id: ++logSeq, ts, ...pick(GENERATORS)() };
}

export function seedLogLines(count: number): LogLine[] {
  return Array.from({ length: count }, () => nextLogLine());
}

export function drift(value: number, base: number, jitter: number): number {
  const pull = (base - value) * 0.15; // vuelve hacia la base, sin irse de rango
  return value + pull + (Math.random() - 0.5) * jitter;
}
