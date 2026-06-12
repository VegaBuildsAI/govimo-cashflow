from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal

Currency = Literal["CNY", "USD", "MXN", "CRC"]
MovementType = Literal["pago", "cobro", "entrada"]
MovementStatus = Literal["esperado", "programado", "confirmado", "conciliado", "provisional"]
Source = Literal["NetSuite", "Banco", "SINPE", "WhatsApp", "Archivo"]

FINAL_STATUSES: set[MovementStatus] = {"esperado", "programado", "confirmado", "conciliado"}


@dataclass(frozen=True)
class Transaction:
    id: str
    source: Source
    type: MovementType
    status: MovementStatus
    amount: Decimal
    currency: Currency
    expected_date: date
    counterparty: str
    category: str

    @property
    def signed_amount(self) -> Decimal:
        if self.type == "pago":
            return -self.amount
        return self.amount

    @property
    def affects_firm_forecast(self) -> bool:
        return self.status in FINAL_STATUSES


@dataclass(frozen=True)
class ForecastWeek:
    index: int
    start: date
    end: date
    balances: dict[Currency, Decimal]


@dataclass(frozen=True)
class Shortfall:
    week_index: int
    currency: Currency
    projected: Decimal
    minimum: Decimal
    severity: Literal["negativo", "bajo-minimo"]


@dataclass(frozen=True)
class CashCoverage:
    currency: Currency
    required: Decimal
    projected_available: Decimal
    sufficient: bool
    gap: Decimal
    coverage_percent: int
