import { Bell, CalendarDays, LayoutDashboard, TrendingUp } from "lucide-react";
import { NavLink } from "react-router-dom";
import { ALERTS } from "../data/mock";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/forecast", icon: TrendingUp, label: "Forecast 13 semanas" },
  { to: "/calendario", icon: CalendarDays, label: "Calendario" },
  { to: "/alertas", icon: Bell, label: "Alertas" },
];

const urgentCount = ALERTS.filter(
  (a) => a.severity === "critica" || a.severity === "alta",
).length;

export default function Sidebar() {
  return (
    <aside className="flex h-full w-60 flex-col border-r border-border bg-sidebar">
      <div className="flex h-16 items-center gap-2 px-6">
        <span className="font-heading text-base font-bold tracking-tight text-white">
          govimo<span className="text-brand">.</span>
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted">
          cashflow
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-brand-tint text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white/90"
              }`
            }
          >
            <Icon size={16} />
            <span className="flex-1">{label}</span>
            {to === "/alertas" && urgentCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
                {urgentCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-6 py-4">
        <p className="text-[11px] leading-relaxed text-muted">
          Demo · datos ficticios
          <br />
          Business. Technology. Simplified.
        </p>
      </div>
    </aside>
  );
}
