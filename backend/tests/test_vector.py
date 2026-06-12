"""Tests de la memoria vectorial (Fase 4 · Nivel 3): embeddings determinísticos
en pgvector y modelo k-NN medible contra la línea base.

Corren contra govimo-postgres (imagen pgvector) en un schema temporal con
rollback; si la DB no está arriba se saltan con mensaje.
"""

import unittest
from datetime import date, timedelta
from decimal import Decimal

from db import learning, repo, vector
from govimo_cashflow.models import Transaction


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


class EmbeddingTests(unittest.TestCase):
    def test_embedding_is_deterministic_and_dim_16(self):
        kwargs = dict(
            contraparte="Cliente A",
            categoria="ventas",
            moneda="USD",
            monto=Decimal("1000.00"),
            fecha_esperada=date(2026, 6, 20),
            tipo="cobro",
        )
        a = vector.embed_movement(**kwargs)
        b = vector.embed_movement(**kwargs)
        self.assertEqual(a, b)
        self.assertEqual(len(a), vector.DIM)

    def test_same_counterparty_shares_identity_dims(self):
        base = dict(
            categoria="ventas", moneda="USD", monto=Decimal("1000.00"),
            fecha_esperada=date(2026, 6, 20), tipo="cobro",
        )
        a1 = vector.embed_movement(contraparte="Cliente A", **base)
        a2 = vector.embed_movement(contraparte="cliente a ", **base)  # normaliza
        b = vector.embed_movement(contraparte="Cliente B", **base)
        self.assertEqual(a1[:6], a2[:6])
        self.assertNotEqual(a1[:6], b[:6])


class KnnForecastTests(unittest.TestCase):
    SCHEMA = "_test_fase4_vec"

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
            self.conn.close()

    def _seed_history(self):
        """Cliente A concilia con retrasos {+3,+5,+7}; otros con 0 y +20."""
        delays = {
            "h-1": ("Cliente A", "ventas", date(2026, 5, 1), 3),
            "h-2": ("Cliente A", "ventas", date(2026, 5, 8), 5),
            "h-3": ("Cliente A", "ventas", date(2026, 5, 15), 7),
            "h-4": ("Cliente B", "ventas", date(2026, 5, 10), 0),
            "h-5": ("Arrendadora", "alquiler", date(2026, 5, 5), 20),
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

    def test_knn_predicts_from_nearest_conciliated_neighbors(self):
        self._seed_history()
        repo.upsert_transactions(
            self.conn, [_tx("p-1", esperada=date(2026, 6, 20), estado="esperado")]
        )
        result = vector.run_knn_forecast(
            self.conn, fecha_corte=date(2026, 6, 12), k=3
        )
        self.assertEqual(result["n_predicciones"], 1)
        self.assertEqual(result["n_indexados"], 6)  # 5 histórico + 1 pendiente

        pred = self.conn.execute(
            "SELECT pred_fecha FROM forecast_predictions WHERE transaction_id = 'p-1'"
        ).fetchone()
        # Los 3 vecinos más cercanos son los movimientos de Cliente A → mediana +5.
        self.assertEqual(pred["pred_fecha"], date(2026, 6, 25))

        run = self.conn.execute("SELECT modelo FROM forecast_runs").fetchone()
        self.assertEqual(run["modelo"], "ml")

    def test_knn_loop_measures_against_baseline(self):
        self._seed_history()
        repo.upsert_transactions(
            self.conn, [_tx("p-1", esperada=date(2026, 6, 20), estado="esperado")]
        )
        vector.run_knn_forecast(self.conn, fecha_corte=date(2026, 6, 12), k=3)
        # La realidad: concilia 4 días tarde (k-NN predijo +5; reglas erraban por 4).
        self.conn.execute(
            "UPDATE transactions SET estado = 'conciliado', fecha_real = %s WHERE id = 'p-1'",
            (date(2026, 6, 24),),
        )
        summary = learning.evaluate_models(self.conn, hasta=date(2026, 6, 12))
        m = summary["metricas"]["ml"]
        self.assertEqual(m["mae_dias"], Decimal("1.00"))
        self.assertEqual(m["baseline_mae_dias"], Decimal("4.00"))
        self.assertTrue(m["supera_baseline"])

    def test_knn_without_history_predicts_expected_date(self):
        repo.upsert_transactions(
            self.conn, [_tx("p-1", esperada=date(2026, 6, 20), estado="esperado")]
        )
        vector.run_knn_forecast(self.conn, fecha_corte=date(2026, 6, 12))
        pred = self.conn.execute(
            "SELECT pred_fecha FROM forecast_predictions WHERE transaction_id = 'p-1'"
        ).fetchone()
        self.assertEqual(pred["pred_fecha"], date(2026, 6, 20))  # sin vecinos → +0


if __name__ == "__main__":
    unittest.main()
