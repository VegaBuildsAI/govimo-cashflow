from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")


def money(value: str | int | float | Decimal) -> Decimal:
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def consolidate_to_base(
    balances: dict[str, Decimal],
    rates_to_base: dict[str, Decimal],
    *,
    base_currency: str,
) -> Decimal:
    total = Decimal("0")
    for currency, amount in balances.items():
        if currency not in rates_to_base:
            raise ValueError(f"Missing FX rate for {currency}->{base_currency}")
        total += amount * rates_to_base[currency]
    return money(total)
