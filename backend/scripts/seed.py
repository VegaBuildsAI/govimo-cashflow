"""Aplica el schema y carga los fixtures por el pipeline de ingesta canónico.

Uso: PYTHONPATH=backend python backend/scripts/seed.py
"""

import csv
from datetime import date
from pathlib import Path

from db import repo
from govimo_cashflow.ingest import parse_transactions_csv

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"


def read_rows(name: str) -> list[dict]:
    with open(FIXTURES / name, encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def main() -> None:
    with repo.connect() as conn:
        repo.apply_schema(conn)
        n_fx = repo.upsert_fx_rates(conn, read_rows("fx_rates.csv"))
        n_acc = repo.upsert_accounts(conn, read_rows("accounts.csv"))
        n_set = repo.upsert_currency_settings(conn, read_rows("currency_settings.csv"))

        n_tx = 0
        for name in ("banco_junio.csv", "netsuite_ap_ar.csv"):
            text = (FIXTURES / name).read_text(encoding="utf-8")
            n_tx += repo.upsert_transactions(
                conn, parse_transactions_csv(text), raw_ref=name
            )
        conn.commit()

        print(f"fx={n_fx} accounts={n_acc} settings={n_set} transactions={n_tx}")
        snapshot = repo.positions(conn, date.today())
        print(f"consolidado USD: {snapshot['consolidatedUSD']}")
        for p in snapshot["positions"]:
            print(f"  {p['currency']}: {p['balance']} (delta7d {p['weekDelta']})")


if __name__ == "__main__":
    main()
