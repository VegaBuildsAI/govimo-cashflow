# HANDOFF — Fase 4 · Capa de aprendizaje ML (Govimo Cashflow)

Punto de partida para continuar en **Claude Code**. La capa de medición (predicción→realidad→ROI) ya está construida y testeada; falta el modelo que genera las predicciones. Lee `CLAUDE.md` y `PLAN.md` primero — este doc no los repite.

## Estado actual (hecho)

- **Esquema** `backend/db/schema.sql` (apéndice, lo recoge `apply_schema`):
  - `forecast_runs` — una corrida del motor: `modelo` (`reglas|estadistica|ml`), `fecha_corte`, `horizonte_sem`.
  - `forecast_predictions` — lo predicho por movimiento: `transaction_id` (nullable), `pred_fecha`, `pred_monto`, `pred_monto_base`.
  - `prediction_outcomes` — la realidad al conciliar: `error_dias`, `error_monto`, `error_monto_base`.
  - `model_metrics` — agregado por modelo/periodo: `mae_dias`, `sesgo_dias`, `mae_monto_base`, `baseline_mae_dias`, `supera_baseline`.
- **Repo** `backend/db/learning.py`: `record_forecast_run`, `record_outcome`, `reconcile_outcomes`, `compute_metrics`. No hace commit (lo maneja el llamador), igual que `repo.py`.
- **Tests** `backend/tests/test_learning.py`: 5 casos, schema temporal `_test_fase4` con rollback.

### Decisión clave (no re-derivar)
La **línea base de reglas no requiere entrenar nada**: las reglas asumen pago en `fecha_esperada`, así que su error = `fecha_real − fecha_esperada`, ya presente en `transactions`. `compute_metrics` la calcula en el mismo query y marca `supera_baseline = mae_dias < baseline_mae_dias`. Es el criterio del doc §6 ("el ML solo gana si supera a las reglas"). Ese delta **es** el ROI demostrable desde el día uno.

`reconcile_outcomes` auto-mide las predicciones cuyo `transaction_id` ya pasó a `conciliado` y aún no tienen outcome → el sistema aprende de la data que se va guardando sin paso manual.

## Cómo levantar y verificar (host Windows)

```powershell
# Postgres del proyecto: Docker, contenedor govimo-postgres, 127.0.0.1:5434, db/user govimo
# Imagen: pgvector/pgvector:pg16 — la memoria vectorial (db/vector.py) requiere la extensión vector
docker start govimo-postgres   # si no está arriba

# Suite completa (núcleo + repo e2e + API + learning)
$env:PYTHONPATH='backend'; python -m unittest discover backend/tests -v

# Solo la capa nueva
$env:PYTHONPATH='backend'; python -m unittest tests.test_learning -v
```

Los tests con DB se **saltan con mensaje** si el contenedor no está arriba (no fallan). `GOVIMO_DB_URL` sobreescribe la URL por defecto.

> Nota: en el sandbox de Cowork (Linux) estos e2e no corren — no alcanza el Docker del host ni trae psycopg. Aquí solo se validó import limpio, DDL Postgres válido (sqlglot) y lógica de error. La verificación real con DB es en el host.

## Qué sigue (orden sugerido) — 1–3 HECHOS (ver PLAN.md Fase 4); el k-NN vectorial de `db/vector.py` cubre un primer Nivel 3

1. **Motor de predicción Nivel 2 (estadística)** detrás de la misma interfaz que `forecast.py`: por contraparte/categoría, estimar `pred_fecha` (p. ej. mediana de retraso histórico `fecha_real − fecha_esperada`) y `pred_monto`. Cada corrida → `record_forecast_run(modelo="estadistica", …)`.
2. **Loop de evaluación**: tras cada ingesta, `reconcile_outcomes()` + `compute_metrics()` por modelo y periodo. Persistir en `model_metrics`.
3. **Exponer en API** (`backend/api/main.py`): `GET /metrics` (último `model_metrics` por modelo) y `GET /forecast` con predicciones de la última corrida. Conectar la página **ML Engine (Brain)** del front (`app/src/pages/MLEngine.tsx`) a datos reales en vez del feed simulado.
4. **Nivel 3 (ML)**: gradient boosting / series de tiempo sobre tabular (fecha real de pago por cliente, montos variables, anomalías, escenarios). Mismo contrato; solo se promueve a producción si `supera_baseline` en el periodo pre-acordado.

## Contrato de datos para `record_forecast_run`

```python
from datetime import date
from db import repo, learning

conn = repo.connect()
run_id = learning.record_forecast_run(
    conn,
    modelo="estadistica",          # 'reglas' | 'estadistica' | 'ml'
    fecha_corte=date(2026, 6, 12),
    horizonte_sem=13,
    predictions=[
        {
            "transaction_id": "ns-ar-0012",   # o None si aún no existe como tx
            "moneda": "USD",
            "pred_fecha": date(2026, 6, 20),
            "pred_monto": "12500.00",
            "pred_monto_base": "12500.00",     # opcional; habilita mae_monto_base
            "contraparte": "Cliente X",        # opcional
            "categoria": "ventas",             # opcional
        },
    ],
)
learning.reconcile_outcomes(conn, run_id=run_id)
metrics = learning.compute_metrics(
    conn, modelo="estadistica",
    periodo_desde=date(2026, 6, 1), periodo_hasta=date(2026, 6, 30),
)
conn.commit()
```

## Invariante
La app informa y alerta; **nunca mueve dinero**. Esta capa solo lee y mide. Mantener `test_no_money_movement` verde.
