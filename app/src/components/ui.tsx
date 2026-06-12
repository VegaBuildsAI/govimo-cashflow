import type { ReactNode } from "react";
import type { Impact, MovStatus, Severity, Source } from "../data/mock";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-panel ${className}`}>
      {children}
    </div>
  );
}

const IMPACT_STYLES: Record<Impact, string> = {
  alto: "bg-red-500/15 text-red-400",
  medio: "bg-amber-500/15 text-amber-400",
  bajo: "bg-white/5 text-muted",
};

export function ImpactBadge({ impact }: { impact: Impact }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${IMPACT_STYLES[impact]}`}>
      {impact}
    </span>
  );
}

const STATUS_STYLES: Record<MovStatus, string> = {
  programado: "border-brand/50 text-white/80",
  esperado: "border-border text-white/60",
  provisional: "border-amber-500/40 text-amber-400",
  confirmado: "border-emerald-500/40 text-emerald-400",
};

export function StatusBadge({ status }: { status: MovStatus }) {
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

export function SourceBadge({ source }: { source: Source }) {
  return (
    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-muted">
      {source}
    </span>
  );
}

export const SEVERITY_META: Record<Severity, { label: string; dot: string; border: string }> = {
  critica: { label: "Crítica", dot: "bg-red-500", border: "border-red-500/40" },
  alta: { label: "Alta", dot: "bg-amber-400", border: "border-amber-500/40" },
  media: { label: "Media", dot: "bg-brand", border: "border-brand/40" },
  info: { label: "Info", dot: "bg-white/30", border: "border-border" },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const m = SEVERITY_META[severity];
  return (
    <span className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-[10px] font-semibold text-white/70">
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}
