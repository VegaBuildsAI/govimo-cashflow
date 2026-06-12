import { AlertTriangle, Bell, CheckCircle2, Clock, Sparkles, XCircle } from "lucide-react";
import type { Alert } from "../data/mock";
import { ALERTS, CURRENCY_META, fmtMoney } from "../data/mock";
import { Card, SEVERITY_META, SeverityBadge } from "../components/ui";

const KIND_ICON = {
  faltante: AlertTriangle,
  pago_proximo: Bell,
  cobro_atrasado: Clock,
  anomalia: Sparkles,
  revision: Clock,
};

function CashCheckBlock({ alert }: { alert: Alert }) {
  const check = alert.check;
  if (!check) return null;
  const meta = CURRENCY_META[check.currency];
  const pct = Math.min((check.projectedAvailable / check.required) * 100, 100);
  return (
    <div className="mt-3 rounded-lg border border-border bg-bg p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Verificación de efectivo · ¿hay {check.currency} disponible?
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[11px] text-muted">Requerido</p>
          <p className="font-heading text-lg font-bold text-white">
            {fmtMoney(check.required, check.currency)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted">Proyectado disponible a la fecha</p>
          <p className="font-heading text-lg font-bold" style={{ color: meta.color }}>
            {fmtMoney(check.projectedAvailable, check.currency)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {check.sufficient ? (
            <>
              <CheckCircle2 size={20} className="text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">Cubierto</span>
            </>
          ) : (
            <>
              <XCircle size={20} className="text-red-400" />
              <span className="text-sm font-semibold text-red-400">
                Faltan {fmtMoney(check.required - check.projectedAvailable, check.currency)}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-2 rounded-full ${check.sufficient ? "bg-emerald-400" : "bg-red-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Cobertura: {Math.round((check.projectedAvailable / check.required) * 100)}% del pago
      </p>
      {check.suggestion && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-brand-tint/60 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-white/85">{check.suggestion}</p>
          <button className="rounded-full border border-brand px-3.5 py-1 text-xs font-medium text-white transition-colors hover:bg-brand">
            Marcar como gestionado
          </button>
        </div>
      )}
    </div>
  );
}

export default function Alertas() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Centro de alertas</h2>
        <p className="text-sm text-muted">
          La herramienta informa y alerta; nunca mueve dinero. Umbrales configurables (KPIs de Felipe).
        </p>
      </div>

      <div className="space-y-3">
        {ALERTS.map((a) => {
          const Icon = KIND_ICON[a.kind];
          const sev = SEVERITY_META[a.severity];
          return (
            <Card key={a.id} className={`border ${sev.border} p-5`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5">
                  <Icon size={16} className="text-white/70" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{a.title}</h3>
                    <SeverityBadge severity={a.severity} />
                    {a.tag && (
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand">
                        {a.tag}
                      </span>
                    )}
                    {a.daysAway !== undefined && (
                      <span className="text-[11px] text-muted">en {a.daysAway} días</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-white/60">{a.detail}</p>
                  <CashCheckBlock alert={a} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
