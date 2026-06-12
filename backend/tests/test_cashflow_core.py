from datetime import date
from decimal import Decimal
import unittest

from govimo_cashflow.alerts import check_payment_coverage
from govimo_cashflow.forecast import build_weekly_forecast, find_shortfalls
from govimo_cashflow.ingest import parse_transactions_csv
from govimo_cashflow.money import consolidate_to_base, money


class CashflowCoreTests(unittest.TestCase):
    def test_parse_transactions_csv_keeps_canonical_fields(self):
        csv_text = (
            "id,source,type,status,amount,currency,expected_date,counterparty,category\n"
            "ns-1,NetSuite,pago,programado,850000,CNY,2026-07-02,Shenzhen Huaray,Inventario\n"
            "wa-1,WhatsApp,cobro,provisional,2400000,CRC,2026-06-17,Federico,Efectivo\n"
        )

        transactions = parse_transactions_csv(csv_text)

        self.assertEqual(len(transactions), 2)
        self.assertEqual(transactions[0].id, "ns-1")
        self.assertEqual(transactions[0].source, "NetSuite")
        self.assertEqual(transactions[0].type, "pago")
        self.assertEqual(transactions[0].status, "programado")
        self.assertEqual(transactions[0].amount, money("850000"))
        self.assertEqual(transactions[0].currency, "CNY")
        self.assertEqual(transactions[0].expected_date, date(2026, 7, 2))

    def test_consolidate_to_base_converts_by_currency(self):
        balances = {"USD": money("1000"), "CNY": money("7160"), "CRC": money("512000")}
        rates_to_usd = {
            "USD": Decimal("1"),
            "CNY": Decimal("0.1396648044692737430167597765"),
            "CRC": Decimal("0.001953125"),
        }

        total = consolidate_to_base(balances, rates_to_usd, base_currency="USD")

        self.assertEqual(total, money("3000.00"))

    def test_weekly_forecast_excludes_provisional_movements_by_default(self):
        csv_text = (
            "id,source,type,status,amount,currency,expected_date,counterparty,category\n"
            "p1,NetSuite,pago,programado,600000,CNY,2026-07-23,Shenzhen Huaray,Inventario\n"
            "c1,WhatsApp,cobro,provisional,420000,CNY,2026-07-20,Importadora Veragua,Cobro\n"
        )
        transactions = parse_transactions_csv(csv_text)

        forecast = build_weekly_forecast(
            start=date(2026, 7, 17),
            weeks=2,
            opening_balances={"CNY": money("520000")},
            transactions=transactions,
        )

        self.assertEqual(forecast[-1].balances["CNY"], money("-80000.00"))

    def test_shortfalls_detect_currency_under_minimum(self):
        forecast = build_weekly_forecast(
            start=date(2026, 7, 17),
            weeks=2,
            opening_balances={"CNY": money("520000")},
            transactions=parse_transactions_csv(
                "id,source,type,status,amount,currency,expected_date,counterparty,category\n"
                "p1,NetSuite,pago,programado,600000,CNY,2026-07-23,Shenzhen Huaray,Inventario\n"
            ),
        )

        shortfalls = find_shortfalls(forecast, minimums={"CNY": money("300000")})

        self.assertEqual(len(shortfalls), 1)
        self.assertEqual(shortfalls[0].currency, "CNY")
        self.assertEqual(shortfalls[0].severity, "negativo")

    def test_payment_coverage_reports_gap_in_original_currency(self):
        check = check_payment_coverage(
            currency="CNY",
            required=money("600000"),
            projected_available=money("520000"),
        )

        self.assertFalse(check.sufficient)
        self.assertEqual(check.gap, money("80000.00"))
        self.assertEqual(check.coverage_percent, 87)


if __name__ == "__main__":
    unittest.main()
