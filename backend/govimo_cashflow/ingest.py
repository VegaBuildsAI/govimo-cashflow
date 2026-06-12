import csv
from datetime import date
from decimal import Decimal
from io import StringIO

from .models import Currency, MovementStatus, MovementType, Source, Transaction
from .money import money

REQUIRED_COLUMNS = {
    "id",
    "source",
    "type",
    "status",
    "amount",
    "currency",
    "expected_date",
    "counterparty",
    "category",
}


def parse_transactions_csv(csv_text: str) -> list[Transaction]:
    reader = csv.DictReader(StringIO(csv_text.strip()))
    missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(sorted(missing))}")

    transactions: list[Transaction] = []
    for row_number, row in enumerate(reader, start=2):
        try:
            transactions.append(
                Transaction(
                    id=_clean(row["id"]),
                    source=_clean(row["source"]),  # type: ignore[arg-type]
                    type=_clean(row["type"]),  # type: ignore[arg-type]
                    status=_clean(row["status"]),  # type: ignore[arg-type]
                    amount=money(Decimal(_clean(row["amount"]))),
                    currency=_clean(row["currency"]),  # type: ignore[arg-type]
                    expected_date=date.fromisoformat(_clean(row["expected_date"])),
                    counterparty=_clean(row["counterparty"]),
                    category=_clean(row["category"]),
                )
            )
        except (KeyError, ValueError) as exc:
            raise ValueError(f"Invalid transaction row {row_number}: {exc}") from exc
    return transactions


def _clean(value: str | None) -> str:
    return (value or "").strip()
