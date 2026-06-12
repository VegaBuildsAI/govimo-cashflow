"""API Fase 1 sobre el núcleo govimo_cashflow. Solo lectura frente al dinero.

Arranque: PYTHONPATH=backend uvicorn api.main:app --port 8000
"""

from datetime import date
from decimal import Decimal

import psycopg
from fastapi import Depends, FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from db import repo
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


@app.post("/ingest/file")
async def ingest_file(file: UploadFile, conn: psycopg.Connection = Depends(get_conn)):
    try:
        text = (await file.read()).decode("utf-8-sig")
        transactions = parse_transactions_csv(text)
        count = repo.upsert_transactions(conn, transactions, raw_ref=file.filename)
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    conn.commit()
    return {"ingested": count, "file": file.filename}
