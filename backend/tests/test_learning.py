"""Tests de la capa de aprendizaje (Fase 4): predicción → realidad → métricas.

Corre contra el contenedor govimo-postgres en un schema temporal dentro de una
transacción que se revierte; si la DB no está arriba se salta con mensaje.
"""

import unittest
from datetime import date
from decimal import Decimal

from db import learning, repo
from govimo_cashflow.models import Transaction


def _connect_or_skip(test: unittest.TestCase):
    try:
        return repo.connect()
    except Exception as exc:
        test.skipTest(f"Postgres no disponible ({exc}); arranque govimo-postgres")


def _tx(tx_id: str, *, esperada: date, monto: str, estado: str, real=None) -> Transaction:
    return Transaction(
        id=tx_id,
        source="NetSuite",
        type="cobro",
        status=estado,  # type: ignore[arg-type]
        amount=Decimal(monto),
        currency="USD",
        expected_date=esperada,
        counterparty="Cliente A",
        category="ventas",
    )


class LearningTests(unittest.TestCase):
    def setUp(self):
        self.conn = _connect_or_skip(self)
        self.conn.execute("CREATE SCHEMA _test_fase4")
        self.conn.execute("SET search_path TO _test_fase4")
        repo.apply_schema(self.conn)
        # FX mínimo para que upsert_transactions resuelva monto_base.
        repo.upsert_fx_rates(
            self.conn,
            [{"fecha": "2026-06-01", "moneda": "USD", "tasa_a_usd": "1", "fuente": "test"}],
        )

    def tearDown(self):
        if getattr(self, "conn", None) and not self.conn.closed:
            self.conn.rollback()
            self.conn.close()

    def test_record_run_and_outcome_computes_error(self):
        run_id = learning.record_forecast_run(
            self.conn,
            modelo="ml",
            fecha_corte=date(2026, 6, 1),
            horizonte_sem=13,
            predictions=[
                {
                    "transaction_id": None,
                    "moneda": "USD",
                    "pred_fecha": date(2026, 6, 10),
                    "pred_monto": "1000.00",
                    "pred_monto_base": "1000.00",
                }
            ],
        )
        self.assertIsInstance(run_id, int)
        pred_id = self.conn.execute(
            "SELECT id FROM forecast_predictions WHERE run_id = %s", (run_id,)
        ).fetchone()["id"]

        out = learning.record_outcome(
            self.conn, prediction_id=pred_id, fecha_real=date(2026, 6, 13), monto_real="1120.00"
        )
        self.assertEqual(out["error_dias"], 3)              # pagó 3 días tarde
        self.assertEqual(out["error_monto"], Decimal("120.00"))
        self.assertEqual(out["error_monto_base"], Decimal("120.00"))

    def test_reconcile_pulls_from_conciliated_transactions(self):
        # Movimiento conciliado en la realidad: fecha_real = fecha_esperada (modelo del núcleo).
        repo.upsert_transactions(
            self.conn,
            [_tx("tx-1", esperada=date(2026, 6, 10), monto="500.00", estado="conciliado")],
        )
        run_id = learning.record_forecast_run(
            self.conn,
            modelo="ml",
            fecha_corte=date(2026, 6, 1),
            horizonte_sem=13,
            predictions=[
                {
                    "transaction_id": "tx-1",
                    "moneda": "USD",
                    "pred_fecha": date(2026, 6, 8),   # el modelo predijo 2 días antes
                    "pred_monto": "500.00",
                    "pred_monto_base": "500.00",
                }
            ],
        )
        created = learning.reconcile_outcomes(self.conn, run_id=run_id)
        self.assertEqual(created, 1)
        # Segunda pasada no duplica (ya tiene outcome).
        self.assertEqual(learning.reconcile_outcomes(self.conn, run_id=run_id), 0)

        out = self.conn.execute(
            "SELECT error_dias FROM prediction_outcomes"
        ).fetchone()
        self.assertEqual(out["error_dias"], 2)  # fecha_real 06-10 − pred 06-08

    def test_metrics_beats_baseline_when_closer_than_rules(self):
        # Realidad: pagó el 06-15, pero se esperaba (reglas) el 06-10 → base err = 5 días.
        repo.upsert_transactions(
            self.conn,
            [_tx("tx-2", esperada=date(2026, 6, 10), monto="500.00", estado="conciliado")],
        )
        # Forzamos fecha_real distinta a la esperada para que la línea base tenga error.
        self.conn.execute(
            "UPDATE transactions SET fecha_real = %s WHERE id = 'tx-2'", (date(2026, 6, 15),)
        )
        run_id = learning.record_forecast_run(
            self.conn,
            modelo="ml",
            fecha_corte=date(2026, 6, 1),
            horizonte_sem=13,
            predictions=[
                {
                    "transaction_id": "tx-2",
                    "moneda": "USD",
                    "pred_fecha": date(2026, 6, 14),  # ML err = 1 día (mejor que reglas: 5)
                    "pred_monto": "500.00",
                    "pred_monto_base": "500.00",
                }
            ],
        )
        learning.reconcile_outcomes(self.conn, run_id=run_id)
        metrics = learning.compute_metrics(
            self.conn, modelo="ml", periodo_desde=date(2026, 6, 1), periodo_hasta=date(2026, 6, 30)
        )
        self.assertEqual(metrics["n_predicciones"], 1)
        self.assertEqual(metrics["mae_dias"], Decimal("1.00"))
        self.assertEqual(metrics["baseline_mae_dias"], Decimal("5.00"))
        self.assertTrue(metrics["supera_baseline"])
        # Quedó persistida.
        self.assertEqual(
            self.conn.execute("SELECT count(*) AS c FROM model_metrics").fetchone()["c"], 1
        )

    def test_metrics_empty_period_is_safe(self):
        metrics = learning.compute_metrics(
            self.conn,
            modelo="ml",
            periodo_desde=date(2026, 1, 1),
            periodo_hasta=date(2026, 1, 31),
            persist=False,
        )
        self.assertEqual(metrics["n_predicciones"], 0)
        self.assertIsNone(metrics["supera_baseline"])


if __name__ == "__main__":
    unittest.main()
