"""Memoria vectorial (Fase 4 · Nivel 3) — modelo 'ml' por vecinos más cercanos.

Cada movimiento se proyecta a un embedding determinístico de 16 rasgos
(contraparte, categoría, moneda, escala de monto, calendario, tipo) que vive en
movement_embeddings (pgvector). El modelo predice el retraso probable de un
movimiento pendiente como la mediana del retraso real de sus k vecinos
conciliados más parecidos. Sin servicios externos: el embedding no requiere API.

Cada corrida se registra vía learning.record_forecast_run (modelo 'ml'), así que
queda medida contra la realidad y contra la línea base igual que la estadística.
No hace commit; el llamador maneja la transacción. Solo lee y registra.
"""

import hashlib
import math
from datetime import date, timedelta
from decimal import Decimal
from statistics import median

import psycopg

from db import learning

DIM = 16
CURRENCIES = ("CNY", "USD", "MXN", "CRC")


def _hash_floats(text: str, n: int) -> list[float]:
    """n floats estables en [-1, 1] derivados del texto (md5 por bloques)."""
    out: list[float] = []
    block = 0
    while len(out) < n:
        digest = hashlib.md5(f"{text}|{block}".encode()).digest()
        for i in range(0, 16, 2):
            if len(out) == n:
                break
            out.append(round(int.from_bytes(digest[i : i + 2], "big") / 32767.5 - 1, 6))
        block += 1
    return out


def embed_movement(
    *,
    contraparte: str,
    categoria: str,
    moneda: str,
    monto: Decimal | float,
    fecha_esperada: date,
    tipo: str,
) -> list[float]:
    """Embedding de rasgos del movimiento. La identidad de la contraparte pesa
    más (6 dims) que la categoría (3): pagadores parecidos ≈ retrasos parecidos.
    """
    vec = _hash_floats(contraparte.strip().lower(), 6)
    vec += _hash_floats(categoria.strip().lower(), 3)
    vec += [1.0 if moneda == c else 0.0 for c in CURRENCIES]
    vec.append(round(math.log10(max(float(monto), 1.0)) / 9, 6))  # escala de monto
    vec.append(round(fecha_esperada.day / 31, 6))                 # estacionalidad mensual
    vec.append(1.0 if tipo == "pago" else -1.0 if tipo == "cobro" else 0.0)
    return vec


def _as_pgvector(vec: list[float]) -> str:
    return "[" + ",".join(repr(v) for v in vec) + "]"


def upsert_embeddings(conn: psycopg.Connection) -> int:
    """(Re)indexa todos los movimientos en movement_embeddings. Idempotente."""
    rows = conn.execute(
        "SELECT id, contraparte, categoria, moneda, monto, fecha_esperada, tipo FROM transactions"
    ).fetchall()
    for r in rows:
        vec = embed_movement(
            contraparte=r["contraparte"],
            categoria=r["categoria"],
            moneda=r["moneda"],
            monto=r["monto"],
            fecha_esperada=r["fecha_esperada"],
            tipo=r["tipo"],
        )
        conn.execute(
            """
            INSERT INTO movement_embeddings (transaction_id, embedding)
            VALUES (%s, %s::public.vector)
            ON CONFLICT (transaction_id)
            DO UPDATE SET embedding = EXCLUDED.embedding, actualizado_en = now()
            """,
            (r["id"], _as_pgvector(vec)),
        )
    return len(rows)


def run_knn_forecast(
    conn: psycopg.Connection,
    *,
    fecha_corte: date,
    horizonte_sem: int = 13,
    k: int = 5,
    notas: str | None = None,
) -> dict:
    """Corre el modelo k-NN sobre los movimientos firmes pendientes y registra
    la corrida. Devuelve {run_id, n_predicciones, n_indexados}.
    """
    indexados = upsert_embeddings(conn)

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
        vecinos = conn.execute(
            """
            SELECT (tx.fecha_real - tx.fecha_esperada) AS retraso
            FROM movement_embeddings e
            JOIN transactions tx ON tx.id = e.transaction_id
            WHERE tx.estado = 'conciliado' AND tx.fecha_real IS NOT NULL
            ORDER BY e.embedding OPERATOR(public.<->) (
                SELECT embedding FROM movement_embeddings WHERE transaction_id = %s
            )
            LIMIT %s
            """,
            (t["id"], k),
        ).fetchall()
        retraso = round(median(v["retraso"] for v in vecinos)) if vecinos else 0
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
        modelo="ml",
        fecha_corte=fecha_corte,
        horizonte_sem=horizonte_sem,
        predictions=predictions,
        notas=notas,
    )
    return {"run_id": run_id, "n_predicciones": len(predictions), "n_indexados": indexados}
