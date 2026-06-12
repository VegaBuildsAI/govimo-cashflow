"""Tests del motor estadístico (Nivel 2), el loop de evaluación y los endpoints
de Fase 4 (/metrics, /forecast, ingesta→loop).

Corren contra govimo-postgres en schemas temporales; si la DB no está arriba se
saltan con mensaje. El test de ingesta comete (la API hace commit), por lo que
su tearDown dropea el schema explícitamente.
"""

import unittest
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

from db import learning, predict, repo
from govimo_cashflow.models import Transaction

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"


def _connect_or_skip(test: unittest.TestCase):
    try:
        return repo.connect()
    except Exception as exc:
        test.skipTest(f"Postgres no disponible ({exc}); arranque govimo-postgres")


def _tx(
    tx_id: str,
    *,
    esperada: date,
    monto: str = "1000.00",
    estado: str = "conciliado",
    contraparte: str = "Cliente A",
    categoria: str = "ventas",
) -> Transaction:
    return Transaction(
        id=tx_id,
        source="NetSuite",
        type="cobro",
        status=estado,  # type: ignore[arg-type]
        amount=Decimal(monto),
        currency="USD",
        expected_date=esperada,
        counterparty=contraparte,
        category=categoria,
    )


class _SchemaCase(unittest.TestCase):
    SCHEMA = "_test_fase4_pred"

    def setUp(self):
        self.conn = _connect_or_skip(self)
        self.conn.execute(f"DROP SCHEMA IF EXISTS {self.SCHEMA} CASCADE")
        self.conn.execute(f"CREATE SCHEMA {self.SCHEMA}")
        self.conn.execute(f"SET search_path TO {self.SCHEMA}")
        repo.apply_schema(self.conn)
        repo.upsert_fx_rates(
            self.conn,
            [{"fecha": "2026-06-01", "moneda": "USD", "tasa_a_usd": "1", "fuente": "test"}],
        )

    def tearDown(self):
        if getattr(self, "conn", None) and not self.conn.closed:
            self.conn.rollback()
            self.conn.execute(f"DROP SCHEMA IF EXISTS {self.SCHEMA} CASCADE")
            self.conn.commit()
            self.conn.close()

    def _seed_history(self):
        """Conciliados con retraso conocido: Cliente A {+3,+5,+7} (mediana 5),
        Cliente B {0} y categoría 'alquiler' {+2}."""
        delays = {
            "h-1": ("Cliente A", "ventas", date(2026, 5, 1), 3),
            "h-2": ("Cliente A", "ventas", date(2026, 5, 8), 5),
            "h-3": ("Cliente A", "ventas", date(2026, 5, 15), 7),
            "h-4": ("Cliente B", "ventas", date(2026, 5, 10), 0),
            "h-5": ("Arrendadora", "alquiler", date(2026, 5, 5), 2),
        }
        txs = [
            _tx(tx_id, esperada=esperada, contraparte=cp, categoria=cat)
            for tx_id, (cp, cat, esperada, _) in delays.items()
        ]
        repo.upsert_transactions(self.conn, txs)
        for tx_id, (_, _, esperada, delay) in delays.items():
            self.conn.execute(
                "UPDATE transactions SET fecha_real = %s WHERE id = %s",
                (esperada + timedelta(days=delay), tx_id),
            )


class StatisticalForecastTests(_SchemaCase):
    def test_predicts_with_median_delay_and_fallbacks(self):
        self._seed_history()
        pending = [
            # contraparte conocida → mediana de Cliente A = +5
            _tx("p-1", esperada=date(2026, 6, 20), estado="esperado"),
            # contraparte nueva, categoría conocida → mediana de 'alquiler' = +2
            _tx("p-2", esperada=date(2026, 6, 22), estado="programado",
                contraparte="Nuevo Arrendador", categoria="alquiler"),
            # todo nuevo → sin retraso
            _tx("p-3", esperada=date(2026, 6, 25), estado="confirmado",
                contraparte="Desconocido SA", categoria="otros"),
        ]
        repo.upsert_transactions(self.conn, pending)

        result = predict.run_statistical_forecast(self.conn, fecha_corte=date(2026, 6, 12))
        self.assertEqual(result["n_predicciones"], 3)

        preds = {
            r["transaction_id"]: r
            for r in self.conn.execute(
                "SELECT transaction_id, pred_fecha, pred_monto FROM forecast_predictions"
            )
        }
        self.assertEqual(preds["p-1"]["pred_fecha"], date(2026, 6, 25))  # +5
        self.assertEqual(preds["p-2"]["pred_fecha"], date(2026, 6, 24))  # +2
        self.assertEqual(preds["p-3"]["pred_fecha"], date(2026, 6, 25))  # +0
        self.assertEqual(preds["p-1"]["pred_monto"], Decimal("1000.00"))

    def test_ignores_out_of_horizon_and_conciliated(self):
        self._seed_history()
        repo.upsert_transactions(
            self.conn,
            [_tx("far", esperada=date(2027, 1, 15), estado="esperado")],
        )
        result = predict.run_statistical_forecast(self.conn, fecha_corte=date(2026, 6, 12))
        # Ni los conciliados del histórico ni el movimiento fuera del horizonte.
        self.assertEqual(result["n_predicciones"], 0)

    def test_evaluate_models_closes_the_loop(self):
        self._seed_history()
        repo.upsert_transactions(
            self.conn, [_tx("p-1", esperada=date(2026, 6, 20), estado="esperado")]
        )
        predict.run_statistical_forecast(self.conn, fecha_corte=date(2026, 6, 12))
        # La realidad llega: se concilia con 4 días de retraso (modelo predijo +5).
        self.conn.execute(
            "UPDATE transactions SET estado = 'conciliado', fecha_real = %s WHERE id = 'p-1'",
            (date(2026, 6, 24),),
        )
        summary = learning.evaluate_models(self.conn, hasta=date(2026, 6, 12))
        self.assertEqual(summary["outcomes_nuevos"], 1)
        m = summary["metricas"]["estadistica"]
        self.assertEqual(m["n_predicciones"], 1)
        self.assertEqual(m["mae_dias"], Decimal("1.00"))       # pred 06-25 vs real 06-24
        self.assertEqual(m["baseline_mae_dias"], Decimal("4.00"))  # esperada 06-20
        self.assertTrue(m["supera_baseline"])
        # Quedó persistido para GET /metrics.
        self.assertEqual(
            self.conn.execute("SELECT count(*) AS c FROM model_metrics").fetchone()["c"], 1
        )


class Fase4ApiTests(_SchemaCase):
    SCHEMA = "_test_fase4_api"

    def setUp(self):
        super().setUp()
        from fastapi.testclient import TestClient
        from api.main import app, get_conn

        app.dependency_overrides[get_conn] = lambda: self.conn
        self._app = app
        self.client = TestClient(app)

    def tearDown(self):
        if getattr(self, "_app", None):
            self._app.dependency_overrides.clear()
        super().tearDown()

    def test_metrics_and_forecast_endpoints(self):
        self._seed_history()
        repo.upsert_transactions(
            self.conn, [_tx("p-1", esperada=date(2026, 6, 20), estado="esperado")]
        )
        predict.run_statistical_forecast(self.conn, fecha_corte=date(2026, 6, 12))
        self.conn.execute(
            "UPDATE transactions SET estado = 'conciliado', fecha_real = %s WHERE id = 'p-1'",
            (date(2026, 6, 24),),
        )
        learning.evaluate_models(self.conn, hasta=date(2026, 6, 12))

        res = self.client.get("/metrics")
        self.assertEqual(res.status_code, 200)
        metrics = res.json()["metrics"]
        self.assertEqual(len(metrics), 1)
        self.assertEqual(metrics[0]["modelo"], "estadistica")
        self.assertEqual(metrics[0]["mae_dias"], 1.0)
        self.assertTrue(metrics[0]["supera_baseline"])

        res = self.client.get("/forecast")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["run"]["modelo"], "estadistica")
        self.assertEqual(len(body["predictions"]), 1)
        pred = body["predictions"][0]
        self.assertEqual(pred["transaction_id"], "p-1")
        self.assertEqual(pred["pred_fecha"], "2026-06-25")
        self.assertEqual(pred["fecha_real"], "2026-06-24")  # outcome ya unido
        self.assertEqual(pred["error_dias"], -1)

    def test_forecast_empty_and_invalid_model(self):
        self.assertEqual(
            self.client.get("/forecast").json(), {"run": None, "predictions": []}
        )
        self.assertEqual(self.client.get("/forecast?modelo=bogus").status_code, 422)

    def test_ingest_triggers_learning_loop(self):
        # La ingesta real comete; el schema se dropea en tearDown.
        import csv

        with open(FIXTURES / "fx_rates.csv", encoding="utf-8") as fh:
            repo.upsert_fx_rates(self.conn, list(csv.DictReader(fh)))
        csv_bytes = (FIXTURES / "banco_junio.csv").read_bytes()
        res = self.client.post(
            "/ingest/file", files={"file": ("banco_junio.csv", csv_bytes, "text/csv")}
        )
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertGreater(body["ingested"], 0)
        self.assertIsInstance(body["forecast_runs"]["estadistica"], int)
        self.assertIsInstance(body["forecast_runs"]["ml"], int)
        self.assertGreater(body["embeddings_indexados"], 0)
        self.assertIn("outcomes_nuevos", body)
        self.assertIn("metricas", body)
        # Quedaron registradas ambas corridas (estadística + memoria vectorial).
        modelos = {
            r["modelo"] for r in self.conn.execute("SELECT modelo FROM forecast_runs")
        }
        self.assertEqual(modelos, {"estadistica", "ml"})


if __name__ == "__main__":
    unittest.main()
