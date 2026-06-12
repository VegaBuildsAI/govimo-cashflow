import unittest

import govimo_cashflow


class SafetyBoundaryTests(unittest.TestCase):
    def test_package_declares_read_only_money_boundary(self):
        self.assertTrue(govimo_cashflow.READ_ONLY_MONEY_BOUNDARY)


if __name__ == "__main__":
    unittest.main()
