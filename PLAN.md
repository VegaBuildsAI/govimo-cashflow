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

## Fase 1 · Cimientos (sem 3–6)
Backend FastAPI + PostgreSQL sobre el núcleo `backend/govimo_cashflow`, modelo canónico de transacción (id/fuente, tipo, estado, monto/moneda, fx_tasa/fecha, monto_base, fechas, contraparte, categoría), ingesta por archivos reales (Excel/CSV Federico, estados de cuenta) + NetSuite (SuiteTalk/SuiteQL o CSV plan B), tabla FX histórica. Listo: posición de caja real consolidada multimoneda en la app.

## Fase 2 · Proyección (sem 6–9)
Motor de reglas determinístico: posición actual + cobros/pagos conocidos por fecha esperada + recurrentes (nómina, alquileres, impuestos). Forecast 13 semanas real en dashboard. Listo: forecast se actualiza con cada carga de datos.

## Fase 3 · Alertas (sem 9–12)
Motor de señales sobre la proyección: pago importante próximo (umbral + N días), riesgo de faltante por moneda, cobro atrasado. Umbrales configurables (Felipe). Canales: WhatsApp (Twilio) + email + dashboard. Cola de revisión de movimientos provisionales (WhatsApp/archivos). Listo: alertas accionables con usuarios reales.

## Fase 4 · Inteligencia ML (sem 12–18)
Gradient boosting / series de tiempo sobre tabular: fecha real de pago por cliente, montos variables, anomalías, escenarios. Misma interfaz que el motor de reglas; solo gana si supera la línea base en error pre-acordado. Listo: ML en producción + reporte de precisión.

## Notas
- La app informa y alerta; nunca mueve dinero. Solo lectura frente al dinero.
- Conflicto UI: repo-actas manda estructura/UX; govimo manda color/marca.
