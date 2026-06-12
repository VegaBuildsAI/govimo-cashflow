"""API Fase 1 sobre el núcleo govimo_cashflow. Solo lectura frente al dinero.

Arranque: PYTHONPATH=backend uvicorn api.main:app --port 8000
"""

from datetime import date
from decimal import Decimal

import psycopg
from fastapi import Depends, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from db import learning, predict, repo, vector
from govimo_cashflow.ingest import parse_transactions_csv

app = FastAPI(title="Govimo Cashflow API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5180", "http://127.0.0.1:5180"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_conn():
    try:
        conn = repo.connect()
    except psycopg.OperationalError as exc:
        raise HTTPException(status_code=503, detail=f"Base de datos no disponible: {exc}")
    try:
        yield conn
    finally:
        conn.close()


def _plain(value):
    """Decimal/date → tipos JSON simples, recursivo."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _plain(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_plain(v) for v in value]
    return value


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/positions")
def get_positions(conn: psycopg.Connection = Depends(get_conn)):
    return _plain(repo.positions(conn, date.today()))


@app.get("/transactions")
def get_transactions(
    currency: str | None = None,
    tipo: str | None = None,
    limit: int = 200,
    conn: psycopg.Connection = Depends(get_conn),
):
    rows = repo.list_transactions(conn, currency=currency, tipo=tipo, limit=limit)
    return {"transactions": _plain(rows)}


@app.get("/fx")
def get_fx(conn: psycopg.Connection = Depends(get_conn)):
    return {"baseCurrency": repo.BASE_CURRENCY, "rates": _plain(repo.latest_rates(conn))}


@app.get("/metrics")
def get_metrics(conn: psycopg.Connection = Depends(get_conn)):
    """Último model_metrics por modelo — la evidencia de si supera la línea base."""
    rows = conn.execute(
        """
        SELECT DISTINCT ON (modelo) *
        FROM model_metrics ORDER BY modelo, creado_en DESC
        """
    ).fetchall()
    return {"metrics": _plain(rows)}


@app.get("/forecast")
def get_forecast(modelo: str | None = None, conn: psycopg.Connection = Depends(get_conn)):
    """Predicciones de la última corrida (opcionalmente filtrada por modelo)."""
    if modelo is not None and modelo not in ("reglas", "estadistica", "ml"):
        raise HTTPException(status_code=422, detail="modelo debe ser reglas|estadistica|ml")
    query = "SELECT * FROM forecast_runs"
    params: dict = {}
    if modelo:
        query += " WHERE modelo = %(modelo)s"
        params["modelo"] = modelo
    query += " ORDER BY creado_en DESC, id DESC LIMIT 1"
    run = conn.execute(query, params).fetchone()
    if run is None:
        return {"run": None, "predictions": []}
    predictions = conn.execute(
        """
        SELECT p.id, p.transaction_id, p.moneda, p.pred_fecha, p.pred_monto,
               p.pred_monto_base, p.contraparte, p.categoria,
               o.fecha_real, o.monto_real, o.error_dias, o.error_monto
        FROM forecast_predictions p
        LEFT JOIN prediction_outcomes o ON o.prediction_id = p.id
        WHERE p.run_id = %s
        ORDER BY p.pred_fecha, p.id
        """,
        (run["id"],),
    ).fetchall()
    return {"run": _plain(run), "predictions": _plain(predictions)}


@app.post("/ingest/file")
async def ingest_file(file: UploadFile, conn: psycopg.Connection = Depends(get_conn)):
    try:
        text = (await file.read()).decode("utf-8-sig")
        transactions = parse_transactions_csv(text)
        count = repo.upsert_transactions(conn, transactions, raw_ref=file.filename)
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    # Loop de aprendizaje: corrida estadística + corrida k-NN (memoria vectorial)
    # sobre lo pendiente, auto-medición de lo conciliado y métricas por modelo.
    today = date.today()
    notas = f"post-ingesta {file.filename}"
    estadistica = predict.run_statistical_forecast(conn, fecha_corte=today, notas=notas)
    knn = vector.run_knn_forecast(conn, fecha_corte=today, notas=notas)
    evaluation = learning.evaluate_models(conn, hasta=today)
    conn.commit()
    return {
        "ingested": count,
        "file": file.filename,
        "forecast_runs": {"estadistica": estadistica["run_id"], "ml": knn["run_id"]},
        "predicciones": {
            "estadistica": estadistica["n_predicciones"],
            "ml": knn["n_predicciones"],
        },
        "embeddings_indexados": knn["n_indexados"],
        "outcomes_nuevos": evaluation["outcomes_nuevos"],
        "metricas": _plain(evaluation["metricas"]),
    }
