"""Capa de aprendizaje (Fase 4): registra predicciones, mide error contra la
realidad y agrega métricas que prueban si un modelo supera la línea base de reglas.

Las funciones no hacen commit; el llamador maneja la transacción (igual que repo).
"""

from datetime import date, timedelta
from decimal import Decimal

import psycopg

from govimo_cashflow.money import money

Modelo = str  # 'reglas' | 'estadistica' | 'ml'


# ── Registrar una corrida y sus predicciones ────────────────────────────────────

def record_forecast_run(
    conn: psycopg.Connection,
    *,
    modelo: Modelo,
    fecha_corte: date,
    horizonte_sem: int,
    predictions: list[dict],
    notas: str | None = None,
) -> int:
    """Crea una corrida y persiste sus predicciones. Devuelve el run_id.

    Cada predicción: transaction_id (opcional), moneda, pred_fecha, pred_monto,
    pred_monto_base (opcional), contraparte (opcional), categoria (opcional).
    """
    run_id = conn.execute(
        """
        INSERT INTO forecast_runs (modelo, fecha_corte, horizonte_sem, notas)
        VALUES (%(modelo)s, %(fecha_corte)s, %(horizonte_sem)s, %(notas)s)
        RETURNING id
        """,
        {
            "modelo": modelo,
            "fecha_corte": fecha_corte,
            "horizonte_sem": horizonte_sem,
            "notas": notas,
        },
    ).fetchone()["id"]

    for p in predictions:
        conn.execute(
            """
            INSERT INTO forecast_predictions (
                run_id, transaction_id, moneda, pred_fecha, pred_monto,
                pred_monto_base, contraparte, categoria
            ) VALUES (
                %(run_id)s, %(transaction_id)s, %(moneda)s, %(pred_fecha)s, %(pred_monto)s,
                %(pred_monto_base)s, %(contraparte)s, %(categoria)s
            )
            """,
            {
                "run_id": run_id,
                "transaction_id": p.get("transaction_id"),
                "moneda": p["moneda"],
                "pred_fecha": p["pred_fecha"],
                "pred_monto": money(p["pred_monto"]),
                "pred_monto_base": (
                    money(p["pred_monto_base"]) if p.get("pred_monto_base") is not None else None
                ),
                "contraparte": p.get("contraparte"),
                "categoria": p.get("categoria"),
            },
        )
    return run_id


# ── Medir la realidad ───────────────────────────────────────────────────────────

def _error_monto_base(
    pred_monto: Decimal, pred_monto_base: Decimal | None, error_monto: Decimal
) -> Decimal | None:
    """Lleva el error de monto a USD usando el FX implícito de la predicción."""
    if pred_monto_base is None or pred_monto == 0:
        return None
    return money(error_monto * (pred_monto_base / pred_monto))


def record_outcome(
    conn: psycopg.Connection,
    *,
    prediction_id: int,
    fecha_real: date,
    monto_real: Decimal | str | float | int,
) -> dict:
    """Registra lo que realmente ocurrió para una predicción y calcula su error."""
    pred = conn.execute(
        "SELECT pred_fecha, pred_monto, pred_monto_base FROM forecast_predictions WHERE id = %s",
        (prediction_id,),
    ).fetchone()
    if pred is None:
        raise ValueError(f"No existe forecast_prediction {prediction_id}")

    monto_real = money(monto_real)
    error_dias = (fecha_real - pred["pred_fecha"]).days
    error_monto = money(monto_real - pred["pred_monto"])
    error_base = _error_monto_base(pred["pred_monto"], pred["pred_monto_base"], error_monto)

    return conn.execute(
        """
        INSERT INTO prediction_outcomes (
            prediction_id, fecha_real, monto_real, error_dias, error_monto, error_monto_base
        ) VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (prediction_id) DO UPDATE SET
            fecha_real = EXCLUDED.fecha_real, monto_real = EXCLUDED.monto_real,
            error_dias = EXCLUDED.error_dias, error_monto = EXCLUDED.error_monto,
            error_monto_base = EXCLUDED.error_monto_base, medido_en = now()
        RETURNING *
        """,
        (prediction_id, fecha_real, monto_real, error_dias, error_monto, error_base),
    ).fetchone()


def reconcile_outcomes(conn: psycopg.Connection, *, run_id: int | None = None) -> int:
    """Auto-mide predicciones cuyo movimiento ya está conciliado y aún no tienen
    outcome. Esto es lo que hace que el sistema 'aprenda de la data que se va
    guardando' sin intervención manual. Devuelve cuántos outcomes nuevos creó.
    """
    query = """
        SELECT p.id
        FROM forecast_predictions p
        JOIN transactions t ON t.id = p.transaction_id
        LEFT JOIN prediction_outcomes o ON o.prediction_id = p.id
        WHERE t.estado = 'conciliado' AND t.fecha_real IS NOT NULL AND o.prediction_id IS NULL
    """
    params: dict = {}
    if run_id is not None:
        query += " AND p.run_id = %(run_id)s"
        params["run_id"] = run_id

    pending = [r["id"] for r in conn.execute(query, params)]
    for pred_id in pending:
        tx = conn.execute(
            """
            SELECT t.fecha_real, t.monto
            FROM forecast_predictions p JOIN transactions t ON t.id = p.transaction_id
            WHERE p.id = %s
            """,
            (pred_id,),
        ).fetchone()
        record_outcome(conn, prediction_id=pred_id, fecha_real=tx["fecha_real"], monto_real=tx["monto"])
    return len(pending)


# ── Agregar métricas y comparar contra la línea base ────────────────────────────

def compute_metrics(
    conn: psycopg.Connection,
    *,
    modelo: Modelo,
    periodo_desde: date,
    periodo_hasta: date,
    persist: bool = True,
) -> dict:
    """Agrega el error del modelo sobre el periodo y lo compara con la línea base
    de reglas (error = fecha_real − fecha_esperada, intrínseco a transactions).

    El modelo solo 'gana' si su MAE en días es estrictamente menor que el de las
    reglas para el mismo conjunto de movimientos. Devuelve el resumen y, si
    persist, lo guarda en model_metrics.
    """
    agg = conn.execute(
        """
        SELECT
            count(*)                                            AS n,
            avg(abs(o.error_dias))                              AS mae_dias,
            avg(o.error_dias)                                   AS sesgo_dias,
            avg(abs(o.error_monto_base))                        AS mae_monto_base,
            avg(abs(t.fecha_real - t.fecha_esperada))           AS baseline_mae_dias
        FROM forecast_runs r
        JOIN forecast_predictions p ON p.run_id = r.id
        JOIN prediction_outcomes o  ON o.prediction_id = p.id
        JOIN transactions t         ON t.id = p.transaction_id
        WHERE r.modelo = %(modelo)s
          AND r.fecha_corte BETWEEN %(desde)s AND %(hasta)s
        """,
        {"modelo": modelo, "desde": periodo_desde, "hasta": periodo_hasta},
    ).fetchone()

    n = agg["n"] or 0

    def _round(value, places: str) -> Decimal | None:
        return None if value is None else Decimal(str(value)).quantize(Decimal(places))

    mae_dias = _round(agg["mae_dias"], "0.01")
    baseline = _round(agg["baseline_mae_dias"], "0.01")
    supera = None if (mae_dias is None or baseline is None) else mae_dias < baseline

    result = {
        "modelo": modelo,
        "periodo_desde": periodo_desde,
        "periodo_hasta": periodo_hasta,
        "n_predicciones": n,
        "mae_dias": mae_dias,
        "sesgo_dias": _round(agg["sesgo_dias"], "0.01"),
        "mae_monto_base": _round(agg["mae_monto_base"], "0.01"),
        "baseline_mae_dias": baseline,
        "supera_baseline": supera,
    }

    if persist:
        result["id"] = conn.execute(
            """
            INSERT INTO model_metrics (
                modelo, periodo_desde, periodo_hasta, n_predicciones, mae_dias,
                sesgo_dias, mae_monto_base, baseline_mae_dias, supera_baseline
            ) VALUES (
                %(modelo)s, %(periodo_desde)s, %(periodo_hasta)s, %(n_predicciones)s, %(mae_dias)s,
                %(sesgo_dias)s, %(mae_monto_base)s, %(baseline_mae_dias)s, %(supera_baseline)s
            ) RETURNING id
            """,
            result,
        ).fetchone()["id"]
    return result


# ── Loop de evaluación (post-ingesta) ───────────────────────────────────────────

def evaluate_models(
    conn: psycopg.Connection, *, hasta: date, ventana_dias: int = 90
) -> dict:
    """Cierra el loop tras cada ingesta: auto-mide outcomes pendientes y agrega
    métricas por cada modelo con corridas en la ventana. Devuelve el resumen.
    """
    nuevos = reconcile_outcomes(conn)
    desde = hasta - timedelta(days=ventana_dias)
    modelos = [
        r["modelo"]
        for r in conn.execute(
            "SELECT DISTINCT modelo FROM forecast_runs WHERE fecha_corte BETWEEN %s AND %s",
            (desde, hasta),
        )
    ]
    return {
        "outcomes_nuevos": nuevos,
        "metricas": {
            m: compute_metrics(conn, modelo=m, periodo_desde=desde, periodo_hasta=hasta)
            for m in modelos
        },
    }
