import { FormEvent, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { SHARED_PASSWORD, USERS } from "../auth/session";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedUser, setSelectedUser] = useState(USERS[0].name);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (user) return <Navigate to={from} replace />;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!login(selectedUser, password)) {
      setError("Usuario o contraseña incorrectos.");
      return;
    }
    navigate(from, { replace: true });
  };

  return (
    <main className="min-h-screen bg-bg text-white">
      <div className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden border-r border-border bg-sidebar p-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="font-heading text-xl font-bold tracking-tight">
              govimo<span className="text-brand">.</span>
            </p>
            <p className="mt-2 text-sm text-muted">Business. Technology. Simplified.</p>
          </div>

          <div className="max-w-sm">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-tint text-brand">
              <ShieldCheck size={24} />
            </div>
            <h1 className="font-heading text-4xl font-bold tracking-tight">
              Tesorería predictiva, en modo demo.
            </h1>
            <p className="mt-4 text-sm leading-6 text-white/60">
              Acceso controlado para revisar caja multimoneda, forecast de 13 semanas,
              calendario de movimientos y alertas de disponibilidad por moneda.
            </p>
          </div>

          <p className="text-xs text-muted">
            Demo local · la app informa y alerta; nunca mueve dinero.
          </p>
        </section>

        <section className="flex items-center justify-center px-6 py-10">
          <form
            onSubmit={submit}
            className="w-full max-w-md rounded-2xl border border-border bg-panel p-6 shadow-2xl shadow-black/30"
          >
            <div className="mb-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white">
                <LockKeyhole size={18} />
              </div>
              <h2 className="font-heading text-2xl font-bold tracking-tight">
                Iniciar sesión
              </h2>
              <p className="mt-1 text-sm text-muted">
                Selecciona un usuario demo y usa la contraseña compartida.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">
                Usuario
              </label>
              <div className="grid gap-2 sm:grid-cols-3">
                {USERS.map((demoUser) => (
                  <button
                    key={demoUser.id}
                    type="button"
                    onClick={() => setSelectedUser(demoUser.name)}
                    className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                      selectedUser === demoUser.name
                        ? "border-brand bg-brand-tint text-white"
                        : "border-border bg-bg text-white/60 hover:border-brand/60 hover:text-white"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{demoUser.name}</span>
                    <span className="mt-1 block text-[11px] text-muted">
                      {demoUser.organization}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <label className="mt-5 block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                Contraseña
              </span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                className="mt-2 w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-muted focus:border-brand"
                placeholder="Ingresa la contraseña demo"
                autoComplete="current-password"
              />
            </label>

            <div className="mt-3 rounded-xl border border-brand/30 bg-brand-tint/50 px-3 py-2 text-xs text-white/70">
              Password demo: <span className="font-semibold text-white">{SHARED_PASSWORD}</span>
            </div>

            {error && (
              <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              className="mt-5 w-full rounded-full border border-brand bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand/85"
            >
              Entrar al dashboard
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
