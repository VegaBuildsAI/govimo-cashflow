from decimal import Decimal, ROUND_HALF_UP

from .models import CashCoverage, Currency
from .money import money


def check_payment_coverage(
    *,
    currency: Currency,
    required: Decimal,
    projected_available: Decimal,
) -> CashCoverage:
    required_amount = money(required)
    available_amount = money(projected_available)
    gap = money(max(required_amount - available_amount, Decimal("0")))
    coverage = 100
    if required_amount != 0:
        coverage = int(
            ((available_amount / required_amount) * 100).quantize(
                Decimal("1"), rounding=ROUND_HALF_UP
            )
        )
    return CashCoverage(
        currency=currency,
        required=required_amount,
        projected_available=available_amount,
        sufficient=available_amount >= required_amount,
        gap=gap,
        coverage_percent=coverage,
    )
