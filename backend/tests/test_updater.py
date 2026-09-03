import os
import sys
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import updater
from version import __version__

class TestUpdater(unittest.TestCase):
    def test_parse_version(self):
        self.assertEqual(updater.parse_version("2.4.0"), (2, 4, 0))
        self.assertEqual(updater.parse_version("v2.4.1"), (2, 4, 1))
        self.assertEqual(updater.parse_version("3.0.0.1"), (3, 0, 0, 1))
        self.assertTrue(updater.parse_version("2.4.1") > updater.parse_version("2.4.0"))
        self.assertTrue(updater.parse_version("2.10.0") > updater.parse_version("2.9.0"))
        self.assertFalse(updater.parse_version("2.4.0") > updater.parse_version("2.4.0"))

    def test_check_for_update_offline_or_missing(self):
        # 存在しないパスやオフラインでも例外を投げず即座に結果を返すか
        res = updater.check_for_update()
        self.assertIn("current_version", res)
        self.assertEqual(res["current_version"], __version__)
        self.assertIn("update_available", res)
        self.assertIsInstance(res["update_available"], bool)

if __name__ == '__main__':
    unittest.main()
