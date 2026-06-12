"""Persistencia Fase 1: psycopg directo sobre el schema canónico.

Las funciones no hacen commit; el llamador maneja la transacción.
"""

import os
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from govimo_cashflow.models import Transaction
from govimo_cashflow.money import consolidate_to_base, money

DEFAULT_DB_URL = "postgresql://govimo:govimo_dev_2026@127.0.0.1:5434/govimo"
SCHEMA_PATH = Path(__file__).with_name("schema.sql")
BASE_CURRENCY = "USD"


def db_url() -> str:
    return os.environ.get("GOVIMO_DB_URL", DEFAULT_DB_URL)


def connect() -> psycopg.Connection:
    return psycopg.connect(db_url(), row_factory=dict_row)


def apply_schema(conn: psycopg.Connection) -> None:
    conn.execute(SCHEMA_PATH.read_text(encoding="utf-8"))


# ── FX ────────────────────────────────────────────────────────────────────────

def upsert_fx_rates(conn: psycopg.Connection, rows: list[dict]) -> int:
    for r in rows:
        conn.execute(
            """
            INSERT INTO fx_rates (fecha, moneda, tasa_a_usd, fuente)
            VALUES (%(fecha)s, %(moneda)s, %(tasa_a_usd)s, %(fuente)s)
            ON CONFLICT (fecha, moneda)
            DO UPDATE SET tasa_a_usd = EXCLUDED.tasa_a_usd, fuente = EXCLUDED.fuente
            """,
            r,
        )
    return len(rows)


def fx_history(conn: psycopg.Connection) -> dict[str, list[tuple[date, Decimal]]]:
    """Historial por moneda, ordenado por fecha ascendente."""
    history: dict[str, list[tuple[date, Decimal]]] = {}
    for row in conn.execute(
        "SELECT fecha, moneda, tasa_a_usd FROM fx_rates ORDER BY moneda, fecha"
    ):
        history.setdefault(row["moneda"], []).append((row["fecha"], row["tasa_a_usd"]))
    return history


def resolve_rate(
    history: dict[str, list[tuple[date, Decimal]]], currency: str, on_date: date
) -> tuple[date, Decimal]:
    """Última tasa con fecha <= on_date; si no hay anterior, la más antigua disponible."""
    rates = history.get(currency)
    if not rates:
        raise ValueError(f"Sin tasa FX para {currency}; cargue fx_rates primero")
    chosen = rates[0]
    for fecha, tasa in rates:
        if fecha > on_date:
            break
        chosen = (fecha, tasa)
    return chosen


def latest_rates(conn: psycopg.Connection) -> dict[str, Decimal]:
    return {
        row["moneda"]: row["tasa_a_usd"]
        for row in conn.execute(
            """
            SELECT DISTINCT ON (moneda) moneda, tasa_a_usd
            FROM fx_rates ORDER BY moneda, fecha DESC
            """
        )
    }


# ── Cuentas y mínimos ─────────────────────────────────────────────────────────

def upsert_accounts(conn: psycopg.Connection, rows: list[dict]) -> int:
    for r in rows:
        conn.execute(
            """
            INSERT INTO accounts (id, banco, alias, moneda, saldo_inicial, fecha_corte)
            VALUES (%(id)s, %(banco)s, %(alias)s, %(moneda)s, %(saldo_inicial)s, %(fecha_corte)s)
            ON CONFLICT (id) DO UPDATE SET
                banco = EXCLUDED.banco, alias = EXCLUDED.alias, moneda = EXCLUDED.moneda,
                saldo_inicial = EXCLUDED.saldo_inicial, fecha_corte = EXCLUDED.fecha_corte
            """,
            r,
        )
    return len(rows)


def upsert_currency_settings(conn: psycopg.Connection, rows: list[dict]) -> int:
    for r in rows:
        conn.execute(
            """
            INSERT INTO currency_settings (moneda, minimo_operativo)
            VALUES (%(moneda)s, %(minimo_operativo)s)
            ON CONFLICT (moneda) DO UPDATE SET minimo_operativo = EXCLUDED.minimo_operativo
            """,
            r,
        )
    return len(rows)


# ── Transacciones ─────────────────────────────────────────────────────────────

def upsert_transactions(
    conn: psycopg.Connection, txs: list[Transaction], *, raw_ref: str | None = None
) -> int:
    """Persiste transacciones canónicas resolviendo FX (monto_base en USD).

    fecha_real = fecha_esperada cuando el movimiento ya está conciliado
    (los estados de cuenta traen la fecha en que ocurrió).
    """
    history = fx_history(conn)
    missing = sorted({t.currency for t in txs} - set(history))
    if missing:
        raise ValueError(f"Sin tasa FX para: {', '.join(missing)}")

    for t in txs:
        fx_fecha, fx_tasa = resolve_rate(history, t.currency, t.expected_date)
        conn.execute(
            """
            INSERT INTO transactions (
                id, fuente, tipo, estado, monto, moneda, fx_tasa, fx_fecha, monto_base,
                fecha_esperada, fecha_real, contraparte, categoria, raw_ref
            ) VALUES (
                %(id)s, %(fuente)s, %(tipo)s, %(estado)s, %(monto)s, %(moneda)s,
                %(fx_tasa)s, %(fx_fecha)s, %(monto_base)s,
                %(fecha_esperada)s, %(fecha_real)s, %(contraparte)s, %(categoria)s, %(raw_ref)s
            )
            ON CONFLICT (id) DO UPDATE SET
                fuente = EXCLUDED.fuente, tipo = EXCLUDED.tipo, estado = EXCLUDED.estado,
                monto = EXCLUDED.monto, moneda = EXCLUDED.moneda,
                fx_tasa = EXCLUDED.fx_tasa, fx_fecha = EXCLUDED.fx_fecha,
                monto_base = EXCLUDED.monto_base,
                fecha_esperada = EXCLUDED.fecha_esperada, fecha_real = EXCLUDED.fecha_real,
                contraparte = EXCLUDED.contraparte, categoria = EXCLUDED.categoria,
                raw_ref = EXCLUDED.raw_ref, actualizado_en = now()
            """,
            {
                "id": t.id,
                "fuente": t.source,
                "tipo": t.type,
                "estado": t.status,
                "monto": t.amount,
                "moneda": t.currency,
                "fx_tasa": fx_tasa,
                "fx_fecha": fx_fecha,
                "monto_base": money(t.amount * fx_tasa),
                "fecha_esperada": t.expected_date,
                "fecha_real": t.expected_date if t.status == "conciliado" else None,
                "contraparte": t.counterparty,
                "categoria": t.category,
                "raw_ref": raw_ref,
            },
        )
    return len(txs)


def list_transactions(
    conn: psycopg.Connection,
    *,
    currency: str | None = None,
    tipo: str | None = None,
    limit: int = 200,
) -> list[dict]:
    query = "SELECT * FROM transactions WHERE TRUE"
    params: dict = {"limit": limit}
    if currency:
        query += " AND moneda = %(moneda)s"
        params["moneda"] = currency
    if tipo:
        query += " AND tipo = %(tipo)s"
        params["tipo"] = tipo
    query += " ORDER BY fecha_esperada, id LIMIT %(limit)s"
    return list(conn.execute(query, params))


# ── Posición de caja ──────────────────────────────────────────────────────────

def positions(conn: psycopg.Connection, today: date) -> dict:
    """Posición por moneda: saldo_inicial (corte) + movimientos conciliados posteriores.

    weekDelta = neto conciliado de los últimos 7 días.
    """
    by_currency: dict[str, dict] = {}
    for row in conn.execute(
        """
        SELECT moneda, SUM(saldo_inicial) AS saldo, MAX(fecha_corte) AS corte,
               array_agg(alias ORDER BY id) AS cuentas
        FROM accounts GROUP BY moneda
        """
    ):
        by_currency[row["moneda"]] = {
            "currency": row["moneda"],
            "balance": row["saldo"],
            "corte": row["corte"],
            "accounts": row["cuentas"],
            "weekDelta": Decimal("0"),
            "minBalance": Decimal("0"),
        }

    for row in conn.execute(
        """
        SELECT moneda,
               SUM(CASE WHEN tipo = 'pago' THEN -monto ELSE monto END) AS neto,
               SUM(CASE WHEN fecha_real > %(week_ago)s
                        THEN CASE WHEN tipo = 'pago' THEN -monto ELSE monto END
                        ELSE 0 END) AS neto_semana
        FROM transactions t
        WHERE estado = 'conciliado'
          AND fecha_real <= %(today)s
          AND fecha_real > COALESCE(
                (SELECT MAX(fecha_corte) FROM accounts a WHERE a.moneda = t.moneda),
                '1900-01-01'::date)
        GROUP BY moneda
        """,
        {"today": today, "week_ago": today - timedelta(days=7)},
    ):
        pos = by_currency.get(row["moneda"])
        if pos is None:
            continue
        pos["balance"] += row["neto"]
        pos["weekDelta"] = row["neto_semana"]

    for row in conn.execute("SELECT moneda, minimo_operativo FROM currency_settings"):
        if row["moneda"] in by_currency:
            by_currency[row["moneda"]]["minBalance"] = row["minimo_operativo"]

    rates = latest_rates(conn)
    balances = {c: p["balance"] for c, p in by_currency.items()}
    consolidated = (
        consolidate_to_base(balances, rates, base_currency=BASE_CURRENCY)
        if balances
        else Decimal("0")
    )
    return {
        "asOf": today.isoformat(),
        "baseCurrency": BASE_CURRENCY,
        "consolidatedUSD": consolidated,
        "positions": sorted(by_currency.values(), key=lambda p: p["currency"]),
        "rates": rates,
    }
