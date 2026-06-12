import { useEffect, useRef, useState } from "react";
import { BrainCircuit, Cpu, Gauge, Pause, Play, TerminalSquare } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  LIVE_KPIS,
  ML_VS_BASELINE,
  MODEL_HEALTH,
  MODEL_METRICS,
  drift,
  nextLogLine,
  seedLogLines,
  type LogChannel,
  type LogLine,
} from "../data/brain";
import {
  fetchForecast,
  fetchModelMetrics,
  type ApiForecastRun,
  type ApiModelMetric,
  type Modelo,
} from "../data/api";
import { Card } from "../components/ui";

const MODELO_LABEL: Record<Modelo, string> = {
  reglas: "Reglas (línea base)",
  estadistica: "Estadística · Nivel 2",
  ml: "ML · Nivel 3",
};

const CHANNEL_STYLES: Record<LogChannel, string> = {
  ingesta: "text-sky-300/80",
  fx: "text-[#8B7FF0]",
  predict: "text-emerald-400",
  train: "text-brand",
  alerta: "text-amber-400",
  sys: "text-muted",
};

const LEVEL_TEXT: Record<LogLine["level"], string> = {
  info: "text-white/65",
  ok: "text-white/80",
  warn: "text-amber-300/90",
  err: "text-red-400",
};

const TOOLTIP_STYLE = {
  background: "#1A1A1A",
  border: "1px solid #262626",
  borderRadius: 8,
  fontSize: 12,
} as const;

function Spark({ data, up }: { data: number[]; up: boolean }) {
  const series = data.map((v, i) => ({ i, v }));
  const color = up ? "#34d399" : "#5447E4";
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={series} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`spark-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#spark-${color})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function MLEngine() {
  const [logs, setLogs] = useState<LogLine[]>(() => seedLogLines(18));
  const [paused, setPaused] = useState(false);
  const [kpis, setKpis] = useState<number[]>(LIVE_KPIS.map((k) => k.base));
  const [cpu, setCpu] = useState<number[]>(() => Array.from({ length: 40 }, () => 24 + Math.random() * 14));
  const [mem, setMem] = useState<number[]>(() => Array.from({ length: 40 }, () => 470 + Math.random() * 40));
  const [uptime, setUptime] = useState(4 * 3600 + 12 * 60 + 37);
  const [realMetrics, setRealMetrics] = useState<ApiModelMetric[] | null>(null);
  const [realRun, setRealRun] = useState<ApiForecastRun | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchModelMetrics()
      .then(setRealMetrics)
      .catch(() => setRealMetrics(null));
    // Última corrida del motor (k-NN sobre la memoria vectorial pgvector):
    // sus predicciones reales se inyectan a la consola, marcadas [real].
    fetchForecast("ml")
      .then(({ run, predictions }) => {
        if (!run) return;
        setRealRun(run);
        const ts = new Date(run.creado_en).toLocaleTimeString("es-CR", { hour12: false });
        const realLines: LogLine[] = predictions.slice(0, 14).map((p, i) => ({
          id: -(i + 2),
          ts,
          channel: "predict",
          level: p.error_dias !== null ? "ok" : "info",
          text:
            `[real] ${p.contraparte ?? p.transaction_id} · ${p.moneda} ${p.pred_monto.toLocaleString("en-US")}` +
            ` → fecha probable ${p.pred_fecha}` +
            (p.error_dias !== null ? ` · medido: err ${p.error_dias}d` : " · pendiente de conciliar"),
        }));
        const header: LogLine = {
          id: -1,
          ts,
          channel: "sys",
          level: "ok",
          text: `[real] corrida #${run.id} modelo=${run.modelo} · corte ${run.fecha_corte} · horizonte ${run.horizonte_sem} sem · memoria vectorial pgvector`,
        };
        // ids negativos = líneas reales; filtra previas para ser idempotente
        // ante el doble montaje de StrictMode.
        setLogs((xs) => [header, ...realLines, ...xs.filter((l) => l.id >= 0)]);
      })
      .catch(() => setRealRun(null));
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setUptime((s) => s + 1.4);
      setCpu((xs) => [...xs.slice(1), Math.min(96, Math.max(8, drift(xs[xs.length - 1], 30, 14)))]);
      setMem((xs) => [...xs.slice(1), Math.max(380, drift(xs[xs.length - 1], 490, 22))]);
      setKpis((vals) => vals.map((v, i) => drift(v, LIVE_KPIS[i].base, LIVE_KPIS[i].jitter)));
      if (!paused) {
        setLogs((xs) => [...xs.slice(-90), nextLogLine()]);
      }
    }, 1400);
    return () => clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    const el = consoleRef.current;
    if (el && !paused) el.scrollTop = el.scrollHeight;
  }, [logs, paused]);

  const cpuNow = cpu[cpu.length - 1];
  const memNow = mem[mem.length - 1];
  const hh = Math.floor(uptime / 3600);
  const mm = Math.floor((uptime % 3600) / 60);
  const ss = Math.floor(uptime % 60);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand/40 bg-brand-tint text-brand"
          style={{ boxShadow: "0 0 36px -8px rgba(84,71,228,0.55)" }}
        >
          <BrainCircuit size={22} />
        </span>
        <div className="flex-1">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold text-white">
            ML Engine
            <span className="rounded-full border border-brand/40 bg-brand-tint px-2.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-[#A79DF5]">
              BRAIN v0.4
            </span>
            {realMetrics && realMetrics.length > 0 ? (
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
                medición real conectada · paneles inferiores simulados
              </span>
            ) : (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] font-medium text-muted">
                simulación · sin corridas medidas aún (Fase 4)
              </span>
            )}
          </h2>
          <p className="text-sm text-muted">
            Rendimiento del modelo, KPIs y actividad del motor en tiempo real
          </p>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          EN LÍNEA
        </span>
      </div>

      {/* Medición real: model_metrics vía GET /metrics (Fase 4) */}
      {realMetrics && realMetrics.length > 0 && (
        <div>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-white">Medición real · predicción vs realidad</h3>
            <p className="text-xs text-muted">
              Último corte por modelo desde la capa de aprendizaje · el modelo solo gana si su MAE supera a las reglas
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {realMetrics.map((m) => (
              <Card key={m.modelo} className="relative overflow-hidden p-4">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                    {MODELO_LABEL[m.modelo]}
                  </p>
                  {m.supera_baseline !== null && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        m.supera_baseline
                          ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                          : "border border-amber-500/40 bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {m.supera_baseline ? "supera línea base" : "no supera línea base"}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <p className="font-heading text-2xl font-bold tracking-tight text-white">
                    {m.mae_dias !== null ? `${m.mae_dias.toFixed(1)} días` : "—"}
                  </p>
                  <span className="text-xs text-muted">MAE fecha</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted">
                  reglas: {m.baseline_mae_dias !== null ? `${m.baseline_mae_dias.toFixed(1)} días` : "—"}
                  {" · "}
                  {m.n_predicciones} predicciones medidas
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  periodo {m.periodo_desde} → {m.periodo_hasta}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Rendimientos del modelo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MODEL_METRICS.map((m, i) => (
          <Card key={m.label} className="relative overflow-hidden p-4">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/70 to-transparent" />
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{m.label}</p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <p className="font-heading text-2xl font-bold tracking-tight text-white">{m.value}</p>
              <span className="text-xs font-semibold text-emerald-400">{m.delta}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted">{m.baseline}</p>
            <div className="mt-2">
              <Spark data={m.spark} up={i >= 2} />
            </div>
          </Card>
        ))}
      </div>

      {/* ML vs línea base + salud del modelo */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">ML vs línea base (reglas)</h3>
              <p className="text-xs text-muted">Error de forecast semanal · el ML solo gana si supera a las reglas</p>
            </div>
            <Gauge size={16} className="text-brand" />
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={ML_VS_BASELINE} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#262626" strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="week" stroke="#797979" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#797979" fontSize={11} tickLine={false} axisLine={false} unit="%" />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: "#797979" }} formatter={(v: number, name: string) => [`${v}%`, name === "ml" ? "ML (Brain)" : "Reglas"]} />
              <Line type="monotone" dataKey="reglas" stroke="#797979" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
              <Line type="monotone" dataKey="ml" stroke="#5447E4" strokeWidth={2.5} dot={false} style={{ filter: "drop-shadow(0 0 6px rgba(84,71,228,0.6))" }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-white">Salud del modelo</h3>
          <p className="mb-4 text-xs text-muted">Último reentrenamiento: hoy 03:00 · próximo: dom 03:00</p>
          <div className="space-y-4">
            {MODEL_HEALTH.map((h) => (
              <div key={h.label}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="text-white/70">{h.label}</span>
                  <span className="font-mono text-[11px] text-white/90">{h.display}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-tint to-brand"
                    style={{ width: `${(h.value / h.max) * 100}%`, boxShadow: "0 0 8px rgba(84,71,228,0.6)" }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* KPIs en vivo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LIVE_KPIS.map((k, i) => {
          const v = kpis[i];
          const delta = v - k.base;
          const good = k.goodWhenDown ? delta <= 0 : delta >= 0;
          return (
            <Card key={k.id} className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{k.label}</p>
                <span className={`font-mono text-[10px] ${good ? "text-emerald-400" : "text-amber-400"}`}>
                  {delta >= 0 ? "+" : ""}{delta.toFixed(k.decimals)}
                </span>
              </div>
              <p className="mt-1.5 font-heading text-2xl font-bold tracking-tight text-white tabular-nums">
                {v.toFixed(k.decimals)}
                <span className="text-sm font-medium text-muted">{k.unit}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted">{k.sub}</p>
            </Card>
          );
        })}
      </div>

      {/* Consola live estilo contenedor */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-sidebar px-4 py-2.5">
          <span className="flex items-center gap-2 font-mono text-xs text-white/85">
            <TerminalSquare size={14} className="text-brand" />
            {realRun ? `govimo/brain-engine:0.5 · corrida #${realRun.id} (${realRun.modelo})` : "govimo/brain-engine:0.4-sim"}
          </span>
          <span className="rounded-full border border-emerald-500/40 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-emerald-400">
            running
          </span>
          <span className="font-mono text-[11px] text-muted">
            uptime {hh}h {String(mm).padStart(2, "0")}m {String(ss).padStart(2, "0")}s
          </span>
          <div className="ml-auto flex items-center gap-4">
            <span className="flex items-center gap-2 font-mono text-[11px] text-muted">
              <Cpu size={12} className="text-brand" /> CPU
              <span className="w-10 text-right text-white/85 tabular-nums">{cpuNow.toFixed(1)}%</span>
              <span className="hidden h-6 w-24 sm:block">
                <Spark data={cpu} up={false} />
              </span>
            </span>
            <span className="flex items-center gap-2 font-mono text-[11px] text-muted">
              MEM
              <span className="w-14 text-right text-white/85 tabular-nums">{memNow.toFixed(0)} MB</span>
              <span className="hidden h-6 w-24 sm:block">
                <Spark data={mem} up={false} />
              </span>
            </span>
            <button
              onClick={() => setPaused((p) => !p)}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-[11px] font-medium text-white/75 transition-colors hover:border-brand/60 hover:text-white"
            >
              {paused ? <Play size={11} /> : <Pause size={11} />}
              {paused ? "Reanudar" : "Pausar"}
            </button>
          </div>
        </div>
        <div
          ref={consoleRef}
          className="h-72 overflow-y-auto bg-[#0A0A0A] px-4 py-3 font-mono text-[11.5px] leading-relaxed"
          style={{ backgroundImage: "radial-gradient(rgba(84,71,228,0.05) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        >
          {logs.map((l) => (
            <p key={l.id} className="whitespace-pre-wrap">
              <span className="text-muted">{l.ts}</span>{" "}
              <span className={CHANNEL_STYLES[l.channel]}>[{l.channel}]</span>{" "}
              <span className={LEVEL_TEXT[l.level]}>{l.text}</span>
            </p>
          ))}
          {!paused && (
            <p className="text-brand">
              ▮<span className="animate-pulse">▮</span>
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
