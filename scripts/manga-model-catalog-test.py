"""Catalog listing + download consent (no network)."""
import pathlib
import sys
import unittest
from unittest import mock

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import manga_model_catalog as cat
from manga_smart_ocr import SmartOcrError


class CatalogTests(unittest.TestCase):
    def test_list_includes_bundle_and_download_policies(self):
        data = cat.list_models()
        self.assertTrue(data["ok"])
        ids = {m["id"]: m for m in data["models"]}
        self.assertIn("ctd", ids)
        self.assertEqual(ids["ctd"]["bundlePolicy"], "installer")
        self.assertEqual(ids["manga-ocr"]["bundlePolicy"], "download")
        self.assertEqual(ids["lama-manga"]["bundlePolicy"], "download")
        self.assertEqual(ids["sam2"]["bundlePolicy"], "download")
        self.assertLess(ids["ctd"]["sizeBytes"], 100_000_000)
        self.assertGreater(ids["manga-ocr"]["sizeBytes"], 400_000_000)

    def test_download_requires_consent(self):
        with self.assertRaises(SmartOcrError) as caught:
            cat.download("lama-manga", allow_download=False)
        self.assertEqual(caught.exception.status, 428)

    def test_unknown_model(self):
        with self.assertRaises(SmartOcrError):
            cat.download("nope", allow_download=True)

    def test_already_cached_short_circuits(self):
        with mock.patch.object(cat, "_cached", return_value=True):
            with mock.patch.object(cat, "_cache_target", return_value="/tmp/fake.pt"):
                r = cat.download("lama-manga", allow_download=True)
        self.assertTrue(r["already"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
