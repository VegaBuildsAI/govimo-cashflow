import { AlertTriangle, ArrowDownRight, ArrowUpRight, ChevronRight, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import {
  CURRENCY_META,
  FORECAST,
  KPIS,
  MOVEMENTS,
  POSITIONS,
  consolidatedUSD,
  fmtMoney,
  forecastConsolidatedUSD,
  toUSD,
} from "../data/mock";
import { Card, ImpactBadge } from "../components/ui";

const sparkData = FORECAST.map((w) => ({
  date: w.date,
  usd: Math.round(forecastConsolidatedUSD(w)),
}));

const upcoming = [...MOVEMENTS]
  .filter((m) => m.date <= "2026-06-26")
  .sort((a, b) => (a.impact === b.impact ? a.date.localeCompare(b.date) : a.impact === "alto" ? -1 : 1))
  .slice(0, 5);

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Posición de caja</h2>
        <p className="text-sm text-muted">
          Consolidada y por moneda · fuentes: NetSuite, banco/SINPE, WhatsApp, archivos
        </p>
      </div>

      {/* Banners */}
      <div className="space-y-2">
        <Link
          to="/alertas"
          className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3.5 transition-colors hover:bg-red-500/15"
        >
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-300">
              Faltante proyectado en CNY — semana del 24 jul
            </p>
            <p className="mt-0.5 text-xs text-red-300/70">
              El pago de ¥600,000 a Shenzhen Huaray (23 jul) excede la caja proyectada en yuanes. Faltan ¥80,000.
            </p>
          </div>
          <ChevronRight size={16} className="mt-1 shrink-0 text-red-400/60" />
        </Link>
        <Link
          to="/alertas"
          className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3.5 transition-colors hover:bg-amber-500/15"
        >
          <Clock size={20} className="mt-0.5 shrink-0 text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-300">
              Cobro atrasado — Grupo Lumen MX (MX$580,000, 6 días)
            </p>
            <p className="mt-0.5 text-xs text-amber-300/70">
              Patrón histórico del cliente: paga 12 días tarde. Afecta la semana del 26 jun en MXN.
            </p>
          </div>
          <ChevronRight size={16} className="mt-1 shrink-0 text-amber-400/60" />
        </Link>
      </div>

      {/* Consolidado + sparkline */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Caja consolidada (USD)
            </p>
            <p className="mt-1 font-heading text-3xl font-bold tracking-tight text-white">
              ${Math.round(consolidatedUSD).toLocaleString("en-US")}
            </p>
            <div className="mt-3 flex h-2 w-72 overflow-hidden rounded-full">
              {POSITIONS.map((p) => (
                <div
                  key={p.currency}
                  style={{
                    width: `${(toUSD(p.balance, p.currency) / consolidatedUSD) * 100}%`,
                    backgroundColor: CURRENCY_META[p.currency].color,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex gap-4">
              {POSITIONS.map((p) => (
                <span key={p.currency} className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: CURRENCY_META[p.currency].color }}
                  />
                  {p.currency} {Math.round((toUSD(p.balance, p.currency) / consolidatedUSD) * 100)}%
                </span>
              ))}
            </div>
          </div>
          <div className="h-24 w-full max-w-md flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5447E4" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#5447E4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <Tooltip
                  contentStyle={{ background: "#1A1A1A", border: "1px solid #262626", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#797979" }}
                  formatter={(v: number) => [`$${v.toLocaleString("en-US")}`, "Consolidado"]}
                />
                <Area type="monotone" dataKey="usd" stroke="#5447E4" strokeWidth={2} fill="url(#spark)" />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-right text-[11px] text-muted">Proyección consolidada 13 semanas</p>
          </div>
        </div>
      </Card>

      {/* Posición por moneda */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {POSITIONS.map((p) => {
          const meta = CURRENCY_META[p.currency];
          const up = p.weekDelta >= 0;
          return (
            <Card key={p.currency} className="p-4">
              <div className="flex items-center justify-between">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold"
                  style={{ backgroundColor: `${meta.color}1f`, color: meta.color }}
                >
                  {meta.symbol.slice(0, 1)}
                </span>
                <span className={`flex items-center gap-1 text-xs font-medium ${up ? "text-emerald-400" : "text-red-400"}`}>
                  {up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  {fmtMoney(Math.abs(p.weekDelta), p.currency, true)}
                </span>
              </div>
              <p className="mt-3 font-heading text-xl font-bold tracking-tight text-white">
                {fmtMoney(p.balance, p.currency)}
              </p>
              <p className="mt-0.5 text-xs font-medium text-white/80">
                {p.currency} · {meta.name}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                ≈ ${Math.round(toUSD(p.balance, p.currency)).toLocaleString("en-US")} · {p.accounts.join(" · ")}
              </p>
            </Card>
          );
        })}
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <Card key={k.label} className="p-4">
            <p className="font-heading text-2xl font-bold tracking-tight text-white">{k.value}</p>
            <p className="mt-0.5 text-xs font-medium text-white/80">{k.label}</p>
            <p className="mt-1 text-[11px] leading-snug text-muted">{k.sub}</p>
          </Card>
        ))}
      </div>

      {/* Próximos movimientos */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Próximos movimientos · 2 semanas</h3>
          <Link to="/calendario" className="flex items-center gap-1 text-xs font-medium text-brand hover:underline">
            Ver calendario <ChevronRight size={12} />
          </Link>
        </div>
        <div className="space-y-2.5">
          {upcoming.map((m) => (
            <div key={m.id} className="flex items-center gap-3 text-sm">
              <span className="w-24 shrink-0 text-xs text-muted">{m.dateLabel}</span>
              <span className={`w-12 shrink-0 text-xs font-semibold ${m.type === "pago" ? "text-red-400" : "text-emerald-400"}`}>
                {m.type === "pago" ? "Pago" : "Cobro"}
              </span>
              <span className="min-w-0 flex-1 truncate text-white/80">{m.counterparty}</span>
              <ImpactBadge impact={m.impact} />
              <span className="w-32 shrink-0 text-right font-medium text-white">
                {m.type === "pago" ? "−" : "+"}
                {fmtMoney(m.amount, m.currency)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
