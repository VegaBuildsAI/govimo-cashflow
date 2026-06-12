import { LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export default function Topbar() {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-sidebar px-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-white/70">jueves 11 de junio de 2026</span>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted">
          Moneda base: USD
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-2 text-[11px] text-muted">
          <RefreshCw size={12} />
          Ultima sincronizacion: hoy 06:00 · NetSuite + Banco
        </span>
        <button className="rounded-full border border-brand px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand">
          Cargar datos
        </button>
        <span className="text-sm text-white/70">
          {user?.name} · {user?.organization}
        </span>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-brand hover:text-white"
        >
          <LogOut size={13} />
          Salir
        </button>
      </div>
    </header>
  );
}
