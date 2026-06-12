# PLAN.md — Govimo Cashflow (vivo)

Fuentes: 3 docx (plan/arquitectura/SOW) + repo-actas (UX). Moneda base de reporte: USD (tentativo, docx dice "USD o CRC").

## Fase 0 · Discovery — EN CURSO
- [x] Leer docx + repo-actas, clasificar fases.
- [x] **Mock UI navegable (entregable actual)** — `app/`, Vite+React18+TS+Tailwind3+react-router+lucide+recharts. Sin backend ni auth, datos falsos en `src/data/mock.ts`. Corre con `npm.cmd run dev` desde `app/` (puerto 5180). Verificado contra brief por subagente fresco: 6/6 criterios cumplen.
  - Listo cuando `npm run dev` corre y navega entre 4 pantallas on-brand (dark #0A0A0A, acento #5447E4, DM Sans/Outfit, botones pill):
    - **Dashboard**: posición por moneda (CNY/USD/MXN/CRC) + consolidada USD, banners de alerta, resumen próximos movimientos.
    - **Forecast 13 semanas**: curva consolidada + por moneda, puntos de faltante marcados, escenarios.
    - **Calendario**: pagos/cobros ordenados por impacto, fuente (NetSuite/Banco/WhatsApp/Archivo), estado.
    - **Alertas**: centro de alertas con flujo "pago próximo → ¿hay efectivo en esa moneda?" (caso suficiente ✓ y caso faltante ✗ con sugerencia FX).
  - Verificar contra brief con subagente de contexto fresco. **Parar y mostrar.**
- [x] Repo de referencia `repo-actas-solidaristas/` presente. El mock conserva el patrón base: sidebar fija, topbar, `main` scrollable, navegación con `NavLink`, spacing `p-6`.
- [x] Baseline local inicializado con Git y `.gitignore`; `node_modules`, `dist`, cache TS y temporales Office quedan fuera.
- [x] Scripts frontend fijados: `dev`, `typecheck`, `build`, `preview`.
- [x] `vite.config.js` usado para evitar fallos de build por transpile de config TS en el sandbox.
- [x] Login demo agregado: usuarios `Michael`, `Felipe`, `Federico`; password comun `govimo2026`; rutas protegidas con sesion local.
- [x] Núcleo backend testeable creado en `backend/govimo_cashflow`: ingesta CSV canónica, consolidación FX, forecast semanal, detección de faltantes y verificación de cobertura de pago. Pruebas: `PYTHONPATH=backend python -m unittest discover backend/tests -v`.
- [ ] (Post-mock, con cliente) Mapa de fuentes, modelo de datos validado, KPIs v1 de Felipe.

## Fase 1 · Cimientos — HECHO (infra local, a falta de datos reales)
- [x] PostgreSQL 16 en Docker: contenedor `govimo-postgres`, puerto 127.0.0.1:5434, db/user `govimo` (5432/5433 ocupados por otros proyectos).
- [x] Schema canónico (`backend/db/schema.sql`): `transactions` (modelo del docx + raw_ref para auditabilidad), `fx_rates` histórica, `accounts` (saldo a fecha de corte), `currency_settings` (mínimos por moneda).
- [x] Repo psycopg (`backend/db/repo.py`): upsert idempotente, resolución FX por fecha (monto_base USD), posición = corte + conciliados posteriores; weekDelta = neto 7 días.
- [x] API FastAPI (`backend/api/main.py`): `POST /ingest/file` (CSV canónico, plan B NetSuite), `GET /positions|/transactions|/fx|/health`. Arranque: `$env:PYTHONPATH='backend'; python -m uvicorn api.main:app --port 8000`.
- [x] Fixtures + `backend/scripts/seed.py` (carga por el pipeline de ingesta; posición resultante = la del mock para continuidad visual).
- [x] Dashboard consume `/positions` vía `app/src/data/api.ts` + proxy Vite `/api`; tag "datos en vivo · corte"; fallback visible "API no disponible" → mock. Forecast/Calendario/Alertas siguen con mock (Fases 2–3).
- [x] Tests 13/13 (núcleo + repo e2e en schema temporal con rollback + API TestClient; skip con mensaje si la DB no está).
- [ ] (Con cliente) Archivos reales de Federico/estados de cuenta → parsers por banco; NetSuite SuiteTalk/SuiteQL; confirmar moneda base USD.

## Fase 2 · Proyección (sem 6–9)
Motor de reglas determinístico: posición actual + cobros/pagos conocidos por fecha esperada + recurrentes (nómina, alquileres, impuestos). Forecast 13 semanas real en dashboard. Listo: forecast se actualiza con cada carga de datos.

## Fase 3 · Alertas (sem 9–12)
Motor de señales sobre la proyección: pago importante próximo (umbral + N días), riesgo de faltante por moneda, cobro atrasado. Umbrales configurables (Felipe). Canales: WhatsApp (Twilio) + email + dashboard. Cola de revisión de movimientos provisionales (WhatsApp/archivos). Listo: alertas accionables con usuarios reales.

## Fase 4 · Inteligencia ML (sem 12–18)
- [x] (Adelanto visual) Página **ML Engine (Brain)** en la app bajo Alertas: rendimientos del modelo vs línea base, KPIs en vivo y consola estilo contenedor con feed simulado (`app/src/pages/MLEngine.tsx` + `app/src/data/brain.ts`). Todo simulación etiquetada; el modelo real es de esta fase.
- [x] **Capa de aprendizaje (esquema + repo + tests)** — cierra el loop predicción→realidad→error→ROI. `schema.sql`: `forecast_runs` (corrida del motor), `forecast_predictions` (lo predicho por tx), `prediction_outcomes` (error medido al conciliar), `model_metrics` (MAE días/monto vs línea base; `supera_baseline`). Repo `db/learning.py`: `record_forecast_run`, `record_outcome`, `reconcile_outcomes` (auto-mide desde tx conciliadas — "aprende de la data que se va guardando"), `compute_metrics`. Línea base = `fecha_real − fecha_esperada` (intrínseca a `transactions`). Tests `tests/test_learning.py` (schema temporal `_test_fase4`, rollback). **Falta:** los modelos que generan las predicciones (gradient boosting / series de tiempo) y conectar el feed real a esta capa.
Gradient boosting / series de tiempo sobre tabular: fecha real de pago por cliente, montos variables, anomalías, escenarios. Misma interfaz que el motor de reglas; solo gana si supera la línea base en error pre-acordado. Listo: ML en producción + reporte de precisión.

## Notas
- La app informa y alerta; nunca mueve dinero. Solo lectura frente al dinero.
- Conflicto UI: repo-actas manda estructura/UX; govimo manda color/marca.
