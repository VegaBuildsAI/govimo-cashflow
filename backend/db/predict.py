"""Motor de predicción Nivel 2 (estadística) — Fase 4.

Estima el retraso típico por contraparte (fallback: categoría; fallback: 0) como
la mediana de fecha_real − fecha_esperada en movimientos conciliados, y predice
fecha y monto de los movimientos firmes aún no conciliados dentro del horizonte.
Cada corrida queda registrada vía learning.record_forecast_run (modelo
'estadistica'), lo que la hace medible contra la línea base de reglas.

No hace commit; el llamador maneja la transacción. Solo lee y registra.
"""

from datetime import date, timedelta

import psycopg

from db import learning

HORIZONTE_SEMANAS = 13


def _median_delays(conn: psycopg.Connection, group_col: str) -> dict[str, int]:
    """Mediana de retraso en días por grupo, redondeada a entero."""
    rows = conn.execute(
        f"""
        SELECT {group_col} AS grupo,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY fecha_real - fecha_esperada) AS retraso
        FROM transactions
        WHERE estado = 'conciliado' AND fecha_real IS NOT NULL
        GROUP BY {group_col}
        """
    )
    return {r["grupo"]: round(r["retraso"]) for r in rows}


def run_statistical_forecast(
    conn: psycopg.Connection,
    *,
    fecha_corte: date,
    horizonte_sem: int = HORIZONTE_SEMANAS,
    notas: str | None = None,
) -> dict:
    """Corre el modelo estadístico sobre los movimientos firmes pendientes y
    registra la corrida. Devuelve {run_id, n_predicciones}.
    """
    por_contraparte = _median_delays(conn, "contraparte")
    por_categoria = _median_delays(conn, "categoria")

    pendientes = conn.execute(
        """
        SELECT id, moneda, monto, monto_base, fecha_esperada, contraparte, categoria
        FROM transactions
        WHERE estado IN ('esperado', 'programado', 'confirmado')
          AND fecha_esperada BETWEEN %(desde)s AND %(hasta)s
        ORDER BY fecha_esperada, id
        """,
        {"desde": fecha_corte, "hasta": fecha_corte + timedelta(weeks=horizonte_sem)},
    ).fetchall()

    predictions = []
    for t in pendientes:
        retraso = por_contraparte.get(
            t["contraparte"], por_categoria.get(t["categoria"], 0)
        )
        predictions.append(
            {
                "transaction_id": t["id"],
                "moneda": t["moneda"],
                "pred_fecha": t["fecha_esperada"] + timedelta(days=retraso),
                "pred_monto": t["monto"],
                "pred_monto_base": t["monto_base"],
                "contraparte": t["contraparte"],
                "categoria": t["categoria"],
            }
        )

    run_id = learning.record_forecast_run(
        conn,
        modelo="estadistica",
        fecha_corte=fecha_corte,
        horizonte_sem=horizonte_sem,
        predictions=predictions,
        notas=notas,
    )
    return {"run_id": run_id, "n_predicciones": len(predictions)}
