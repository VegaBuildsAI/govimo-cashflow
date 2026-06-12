import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CURRENCY_META,
  Currency,
  FORECAST,
  POSITIONS,
  SHORTFALLS,
  fmtMoney,
  forecastConsolidatedUSD,
} from "../data/mock";
import { Card } from "../components/ui";

type View = "CONS" | Currency;

const VIEWS: { id: View; label: string }[] = [
  { id: "CONS", label: "Consolidado USD" },
  { id: "CNY", label: "CNY" },
  { id: "USD", label: "USD" },
  { id: "MXN", label: "MXN" },
  { id: "CRC", label: "CRC" },
];

function buildData(view: View) {
  return FORECAST.map((w, i) => ({
    idx: i,
    label: `${w.week} · ${w.date}`,
    date: w.date,
    value: view === "CONS" ? Math.round(forecastConsolidatedUSD(w)) : w.balances[view],
  }));
}

export default function Forecast() {
  const [view, setView] = useState<View>("CONS");
  const data = buildData(view);
  const color = view === "CONS" ? "#5447E4" : CURRENCY_META[view].color;
  const minLine =
    view === "CONS" ? null : POSITIONS.find((p) => p.currency === view)?.minBalance ?? null;
  const dots = view === "CONS" ? [] : SHORTFALLS.filter((s) => s.currency === view);
  const fmt = (v: number) =>
    view === "CONS" ? `$${(v / 1000).toFixed(0)}k` : fmtMoney(v, view, true);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Forecast 13 semanas</h2>
          <p className="text-sm text-muted">
            Proyección por reglas (Fase 2) · saldo al cierre de cada semana · puntos rojos = faltante
          </p>
        </div>
        <div className="flex gap-1.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                view === v.id
                  ? "border-brand bg-brand text-white"
                  : "border-border text-white/60 hover:border-brand/60 hover:text-white"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Curva principal */}
      <Card className="p-5">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="fc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: "#797979", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#262626" }} />
              <YAxis tickFormatter={fmt} tick={{ fill: "#797979", fontSize: 11 }} tickLine={false} axisLine={false} width={70} />
              <Tooltip
                contentStyle={{ background: "#1A1A1A", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#797979" }}
                formatter={(v: number) => [
                  view === "CONS" ? `$${v.toLocaleString("en-US")}` : fmtMoney(v, view),
                  view === "CONS" ? "Consolidado USD" : view,
                ]}
              />
              <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.6} />
              {minLine !== null && (
                <ReferenceLine
                  y={minLine}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeOpacity={0.7}
                  label={{ value: "mínimo operativo", fill: "#f59e0b", fontSize: 10, position: "insideTopRight" }}
                />
              )}
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill="url(#fc)" />
              {dots.map((s) => (
                <ReferenceDot
                  key={`${s.currency}-${s.weekIndex}`}
                  x={data[s.weekIndex].date}
                  y={s.projected}
                  r={5}
                  fill="#ef4444"
                  stroke="#0A0A0A"
                  strokeWidth={2}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Faltantes detectados */}
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-white">Puntos de faltante en el horizonte</h3>
        {SHORTFALLS.length === 0 ? (
          <p className="text-sm text-muted">Sin faltantes proyectados.</p>
        ) : (
          <div className="space-y-2">
            {SHORTFALLS.map((s) => {
              const w = FORECAST[s.weekIndex];
              return (
                <button
                  key={`${s.currency}-${s.weekIndex}`}
                  onClick={() => setView(s.currency)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition-colors hover:border-red-500/50"
                >
                  <AlertTriangle
                    size={15}
                    className={s.severity === "negativo" ? "text-red-400" : "text-amber-400"}
                  />
                  <span className="w-24 shrink-0 text-xs text-muted">
                    {w.week} · {w.date}
                  </span>
                  <span className="flex-1 text-sm text-white/80">
                    {s.currency} proyectado en{" "}
                    <span className={s.severity === "negativo" ? "font-semibold text-red-400" : "font-semibold text-amber-400"}>
                      {fmtMoney(s.projected, s.currency)}
                    </span>
                    {s.severity === "negativo" ? " — saldo negativo" : " — bajo el mínimo operativo"}
                  </span>
                  <span className="text-[11px] text-muted">ver curva →</span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* Mini-múltiplos por moneda */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {POSITIONS.map((p) => {
          const d = buildData(p.currency);
          const meta = CURRENCY_META[p.currency];
          const hasShortfall = SHORTFALLS.some((s) => s.currency === p.currency);
          return (
            <Card key={p.currency} className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-white/80">{p.currency}</span>
                {hasShortfall && <AlertTriangle size={13} className="text-red-400" />}
              </div>
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={d} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
                    <defs>
                      <linearGradient id={`mini-${p.currency}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={meta.color} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <ReferenceLine y={0} stroke="#ef4444" strokeOpacity={0.4} strokeDasharray="3 3" />
                    <Area type="monotone" dataKey="value" stroke={meta.color} strokeWidth={1.5} fill={`url(#mini-${p.currency})`} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1.5 text-[11px] text-muted">
                {fmtMoney(d[0].value, p.currency, true)} hoy → {fmtMoney(d[13].value, p.currency, true)} en S13
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
