import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { MOVEMENTS, Movement, fmtMoney, toUSD } from "../data/mock";
import { Card, ImpactBadge, SourceBadge, StatusBadge } from "../components/ui";

type TypeFilter = "todos" | "pago" | "cobro";
type SortMode = "impacto" | "fecha";

const IMPACT_ORDER = { alto: 0, medio: 1, bajo: 2 };

function sortMovements(items: Movement[], mode: SortMode): Movement[] {
  return [...items].sort((a, b) =>
    mode === "impacto"
      ? IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] || a.date.localeCompare(b.date)
      : a.date.localeCompare(b.date),
  );
}

export default function Calendario() {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("todos");
  const [sortMode, setSortMode] = useState<SortMode>("impacto");

  const items = sortMovements(
    MOVEMENTS.filter((m) => typeFilter === "todos" || m.type === typeFilter),
    sortMode,
  );

  const totalPagosUSD = MOVEMENTS.filter((m) => m.type === "pago").reduce(
    (s, m) => s + toUSD(m.amount, m.currency), 0);
  const totalCobrosUSD = MOVEMENTS.filter((m) => m.type === "cobro").reduce(
    (s, m) => s + toUSD(m.amount, m.currency), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Calendario de pagos y cobros</h2>
          <p className="text-sm text-muted">
            Próximas 8 semanas · ordenado por {sortMode} · montos en moneda original
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {(["todos", "pago", "cobro"] as TypeFilter[]).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                  typeFilter === t
                    ? "border-brand bg-brand text-white"
                    : "border-border text-white/60 hover:border-brand/60 hover:text-white"
                }`}
              >
                {t === "todos" ? "Todos" : `${t}s`}
              </button>
            ))}
          </div>
          <span className="text-border">|</span>
          <div className="flex gap-1.5">
            {(["impacto", "fecha"] as SortMode[]).map((s) => (
              <button
                key={s}
                onClick={() => setSortMode(s)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                  sortMode === s
                    ? "border-white/40 bg-white/10 text-white"
                    : "border-border text-white/60 hover:text-white"
                }`}
              >
                Por {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-4 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15">
            <ArrowUpRight size={17} className="text-red-400" />
          </span>
          <div>
            <p className="font-heading text-xl font-bold text-white">
              ≈ ${Math.round(totalPagosUSD).toLocaleString("en-US")}
            </p>
            <p className="text-xs text-muted">
              Pagos programados en el horizonte ({MOVEMENTS.filter((m) => m.type === "pago").length})
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15">
            <ArrowDownLeft size={17} className="text-emerald-400" />
          </span>
          <div>
            <p className="font-heading text-xl font-bold text-white">
              ≈ ${Math.round(totalCobrosUSD).toLocaleString("en-US")}
            </p>
            <p className="text-xs text-muted">
              Cobros esperados en el horizonte ({MOVEMENTS.filter((m) => m.type === "cobro").length})
            </p>
          </div>
        </Card>
      </div>

      {/* Tabla */}
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Contraparte / concepto</th>
              <th className="px-4 py-3 font-medium">Fuente</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Impacto</th>
              <th className="px-4 py-3 text-right font-medium">Monto</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-b border-border/60 last:border-0 hover:bg-white/[0.02]">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">{m.dateLabel}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold ${m.type === "pago" ? "text-red-400" : "text-emerald-400"}`}>
                    {m.type === "pago" ? "Pago" : "Cobro"}
                  </span>
                </td>
                <td className="max-w-xs px-4 py-3">
                  <p className="truncate font-medium text-white/90">{m.counterparty}</p>
                  <p className="truncate text-[11px] text-muted">{m.concept}</p>
                </td>
                <td className="px-4 py-3"><SourceBadge source={m.source} /></td>
                <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                <td className="px-4 py-3"><ImpactBadge impact={m.impact} /></td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <p className={`font-medium ${m.type === "pago" ? "text-red-300" : "text-emerald-300"}`}>
                    {m.type === "pago" ? "−" : "+"}{fmtMoney(m.amount, m.currency)}
                  </p>
                  <p className="text-[11px] text-muted">
                    ≈ ${Math.round(toUSD(m.amount, m.currency)).toLocaleString("en-US")}
                  </p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
