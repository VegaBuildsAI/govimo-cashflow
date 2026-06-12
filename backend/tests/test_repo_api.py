"""Tests de persistencia y API Fase 1.

Los que tocan Postgres corren contra el contenedor govimo-postgres en un schema
temporal dentro de una transacción que se revierte; si la DB no está arriba se
saltan con mensaje.
"""

import csv
import unittest
from datetime import date
from decimal import Decimal
from pathlib import Path

from db import repo
from govimo_cashflow.ingest import parse_transactions_csv

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
TODAY = date(2026, 6, 12)


def _rows(name: str) -> list[dict]:
    with open(FIXTURES / name, encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def _connect_or_skip(test: unittest.TestCase):
    try:
        return repo.connect()
    except Exception as exc:  # OperationalError u otros fallos de conexión
        test.skipTest(f"Postgres no disponible ({exc}); arranque govimo-postgres")


class ResolveRateTests(unittest.TestCase):
    def test_resolve_rate_picks_latest_on_or_before_date(self):
        history = {
            "CNY": [
                (date(2026, 6, 1), Decimal("0.139")),
                (date(2026, 6, 10), Decimal("0.140")),
            ]
        }
        self.assertEqual(
            repo.resolve_rate(history, "CNY", date(2026, 6, 9)),
            (date(2026, 6, 1), Decimal("0.139")),
        )
        self.assertEqual(
            repo.resolve_rate(history, "CNY", date(2026, 6, 10)),
            (date(2026, 6, 10), Decimal("0.140")),
        )
        # Fecha anterior a todo el historial: usa la tasa más antigua.
        self.assertEqual(
            repo.resolve_rate(history, "CNY", date(2026, 5, 1)),
            (date(2026, 6, 1), Decimal("0.139")),
        )

    def test_resolve_rate_missing_currency(self):
        with self.assertRaises(ValueError):
            repo.resolve_rate({}, "CNY", TODAY)


class RepoEndToEndTests(unittest.TestCase):
    """Ingesta de fixtures → posición, en schema temporal con rollback."""

    def setUp(self):
        self.conn = _connect_or_skip(self)
        self.conn.execute("CREATE SCHEMA _test_fase1")
        self.conn.execute("SET search_path TO _test_fase1")
        repo.apply_schema(self.conn)

    def tearDown(self):
        if getattr(self, "conn", None) and not self.conn.closed:
            self.conn.rollback()
            self.conn.close()

    def _seed(self):
        repo.upsert_fx_rates(self.conn, _rows("fx_rates.csv"))
        repo.upsert_accounts(self.conn, _rows("accounts.csv"))
        repo.upsert_currency_settings(self.conn, _rows("currency_settings.csv"))
        for name in ("banco_junio.csv", "netsuite_ap_ar.csv"):
            text = (FIXTURES / name).read_text(encoding="utf-8")
            repo.upsert_transactions(
                self.conn, parse_transactions_csv(text), raw_ref=name
            )

    def test_positions_from_fixtures(self):
        self._seed()
        snapshot = repo.positions(self.conn, TODAY)
        by_cur = {p["currency"]: p for p in snapshot["positions"]}

        self.assertEqual(by_cur["CNY"]["balance"], Decimal("1240000.00"))
        self.assertEqual(by_cur["USD"]["balance"], Decimal("486500.00"))
        self.assertEqual(by_cur["MXN"]["balance"], Decimal("2150000.00"))
        self.assertEqual(by_cur["CRC"]["balance"], Decimal("168000000.00"))
        self.assertEqual(by_cur["CNY"]["weekDelta"], Decimal("-86000.00"))
        self.assertEqual(by_cur["USD"]["minBalance"], Decimal("150000.00"))
        self.assertEqual(snapshot["consolidatedUSD"], Decimal("1104531.13"))
        # Solo lo conciliado mueve la posición: los esperados/programados no.
        self.assertEqual(len(by_cur), 4)

    def test_upsert_is_idempotent_and_records_fx(self):
        self._seed()
        text = (FIXTURES / "banco_junio.csv").read_text(encoding="utf-8")
        repo.upsert_transactions(
            self.conn, parse_transactions_csv(text), raw_ref="banco_junio.csv"
        )  # segunda pasada: mismo id, sin duplicar
        rows = repo.list_transactions(self.conn)
        self.assertEqual(len(rows), 18)
        cny = next(r for r in rows if r["id"] == "bnk-cny-0609")
        self.assertEqual(cny["fx_fecha"], date(2026, 6, 1))
        self.assertEqual(cny["monto_base"], Decimal("11997.00"))  # 86000 * 0.1395
        self.assertEqual(cny["fecha_real"], date(2026, 6, 9))  # conciliado

    def test_ingest_without_fx_rates_fails(self):
        repo.upsert_accounts(self.conn, _rows("accounts.csv"))
        text = (FIXTURES / "banco_junio.csv").read_text(encoding="utf-8")
        with self.assertRaises(ValueError):
            repo.upsert_transactions(self.conn, parse_transactions_csv(text))


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.conn = _connect_or_skip(self)
        self.conn.execute("CREATE SCHEMA _test_fase1")
        self.conn.execute("SET search_path TO _test_fase1")
        repo.apply_schema(self.conn)
        repo.upsert_fx_rates(self.conn, _rows("fx_rates.csv"))
        repo.upsert_accounts(self.conn, _rows("accounts.csv"))
        repo.upsert_currency_settings(self.conn, _rows("currency_settings.csv"))

        from fastapi.testclient import TestClient
        from api.main import app, get_conn

        app.dependency_overrides[get_conn] = lambda: self.conn
        self._app = app
        self.client = TestClient(app)

    def tearDown(self):
        if getattr(self, "conn", None) and not self.conn.closed:
            self._app.dependency_overrides.clear()
            self.conn.rollback()
            self.conn.close()

    def test_positions_endpoint_shape(self):
        res = self.client.get("/positions")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["baseCurrency"], "USD")
        self.assertEqual(len(body["positions"]), 4)
        usd = next(p for p in body["positions"] if p["currency"] == "USD")
        # Shape alineado al Position del frontend (mock.ts)
        for key in ("currency", "balance", "weekDelta", "accounts", "minBalance"):
            self.assertIn(key, usd)
        self.assertIsInstance(body["consolidatedUSD"], float)

    def test_health(self):
        self.assertEqual(self.client.get("/health").json(), {"status": "ok"})
