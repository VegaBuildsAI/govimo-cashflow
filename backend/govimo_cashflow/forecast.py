from datetime import date, timedelta
from decimal import Decimal

from .models import Currency, ForecastWeek, Shortfall, Transaction
from .money import money


def build_weekly_forecast(
    *,
    start: date,
    weeks: int,
    opening_balances: dict[Currency, Decimal],
    transactions: list[Transaction],
    include_provisional: bool = False,
) -> list[ForecastWeek]:
    balances = {currency: money(amount) for currency, amount in opening_balances.items()}
    forecast: list[ForecastWeek] = []

    for index in range(weeks + 1):
        week_start = start + timedelta(days=index * 7)
        week_end = week_start + timedelta(days=6)
        for tx in _transactions_in_week(transactions, week_start, week_end, include_provisional):
            balances[tx.currency] = money(balances.get(tx.currency, Decimal("0")) + tx.signed_amount)
        forecast.append(
            ForecastWeek(
                index=index,
                start=week_start,
                end=week_end,
                balances=dict(balances),
            )
        )
    return forecast


def find_shortfalls(
    forecast: list[ForecastWeek],
    *,
    minimums: dict[Currency, Decimal],
) -> list[Shortfall]:
    shortfalls: list[Shortfall] = []
    already_reported: set[Currency] = set()
    for week in forecast:
        for currency, minimum in minimums.items():
            if currency in already_reported:
                continue
            projected = money(week.balances.get(currency, Decimal("0")))
            if projected < 0:
                shortfalls.append(
                    Shortfall(week.index, currency, projected, money(minimum), "negativo")
                )
                already_reported.add(currency)
            elif projected < minimum:
                shortfalls.append(
                    Shortfall(week.index, currency, projected, money(minimum), "bajo-minimo")
                )
                already_reported.add(currency)
    return shortfalls


def _transactions_in_week(
    transactions: list[Transaction],
    start: date,
    end: date,
    include_provisional: bool,
) -> list[Transaction]:
    return [
        tx
        for tx in transactions
        if start <= tx.expected_date <= end
        and (tx.affects_firm_forecast or include_provisional)
    ]
