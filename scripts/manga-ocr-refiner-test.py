"""Optional Manga OCR integration tests: no torch, image model or network needed."""
import base64
import pathlib
import sys
import unittest
from types import SimpleNamespace
from unittest import mock
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import manga_smart_ocr as original
import manga_ocr_refiner as refiner

PNG=(b"\x89PNG\r\n\x1a\n"+b"\x00\x00\x00\x0dIHDR"+
     (300).to_bytes(4,"big")+(240).to_bytes(4,"big")+b"\x08\x06\x00\x00\x00")
DATA="data:image/png;base64,"+base64.b64encode(PNG).decode("ascii")

class FakeModel:
    def __init__(self):
        self.calls=0
    def __call__(self,image):
        self.calls+=1
        return "  ありがとう、先生！\n"

class MangaOcrRefinerTest(unittest.TestCase):
    def tearDown(self):
        refiner._reset_for_tests()

    @mock.patch.object(refiner,"decode_image",return_value=object())
    @mock.patch.object(refiner,"get_model",return_value=FakeModel())
    def test_recognizes_selected_region_text_without_fake_boxes(self,model,decode):
        result=refiner.refine_region(DATA)
        self.assertTrue(result["ok"])
        self.assertEqual(result["text"],"ありがとう、先生！")
        self.assertEqual(result["width"],300)
        self.assertEqual(result["height"],240)
        self.assertEqual(result["engine"],"manga-ocr-local")
        self.assertNotIn("regions",result,"recognition must not invent a bounding box")
        self.assertFalse(result["verified"])
        self.assertEqual(model.call_count,1)

    def test_rejects_invalid_data_before_model_load(self):
        with mock.patch.object(refiner,"get_model",side_effect=AssertionError("never load")):
            with self.assertRaises(original.SmartOcrError):
                refiner.refine_region("data:text/html;base64,AAAA")

    @mock.patch.object(refiner,"decode_image",return_value=object())
    @mock.patch.object(refiner,"get_model",return_value=lambda image:"")
    def test_empty_hallucinated_result_does_not_replace_draft(self,model,decode):
        with self.assertRaises(original.SmartOcrError):
            refiner.refine_region(DATA)

    @mock.patch.object(refiner,"decode_image",return_value=object())
    @mock.patch.object(refiner,"get_model",return_value=lambda image: "x"*800)
    def test_limits_oversized_generated_text(self,model,decode):
        with self.assertRaises(original.SmartOcrError):
            refiner.refine_region(DATA)

    @mock.patch.object(refiner.importlib,"import_module",side_effect=ModuleNotFoundError("manga_ocr"))
    def test_missing_dependency_is_actionable_503(self,import_module):
        with self.assertRaises(original.SmartOcrError) as caught:
            refiner.get_model()
        self.assertEqual(caught.exception.status,503)
        self.assertIn("manga-ocr",str(caught.exception))

    def test_caches_model_between_requests(self):
        class Wrapped:
            def __call__(self,img):return "テスト"
        class FakeManga:
            count=0
            def __init__(self):FakeManga.count+=1
            def __call__(self,image):return "テスト"
        with mock.patch.object(refiner.importlib,"import_module",
                               return_value=SimpleNamespace(MangaOcr=FakeManga)):
            first=refiner.get_model(allow_download=True)
            second=refiner.get_model()
        self.assertIs(first,second)
        self.assertEqual(FakeManga.count,1)

    def test_direct_cross_site_request_fails_before_image_decode(self):
        rows=[]
        handler=SimpleNamespace(
            path="/manga-smart/manga-ocr",
            client_address=("127.0.0.1",33333),
            headers={"Host":"127.0.0.1:8000","Origin":"null",
                     "Content-Type":"application/json","Content-Length":"999"},
            close_connection=False,
            _send_json=lambda response,status=200:rows.append((response,status)))
        with mock.patch.object(refiner,"refine_region",side_effect=AssertionError("no calls")):
            self.assertTrue(original.handle_smart_ocr_post(handler))
        self.assertEqual(rows[0][1],403)
        self.assertTrue(handler.close_connection)

class RefinePageRegionsTest(unittest.TestCase):
    def tearDown(self):
        refiner._reset_for_tests()

    def setUp(self):
        try:
            import PIL.Image  # noqa: F401
        except ImportError:
            self.skipTest("Pillow not installed in this CI job")

    def test_pads_and_rewrites_region_text(self):
        from PIL import Image
        img = Image.new("RGB", (200, 120), (255, 255, 255))
        buf = __import__("io").BytesIO(); img.save(buf, format="PNG")
        regions = [{"text": "错字", "x": 40, "y": 30, "width": 60, "height": 40, "confidence": 50}]
        class Model:
            def __call__(self, crop):
                return "  正确文字  "
        with mock.patch.object(refiner, "get_model", return_value=Model()):
            out, n = refiner.refine_page_regions(buf.getvalue(), 200, 120, regions, allow_download=True)
        self.assertEqual(n, 1)
        self.assertEqual(out[0]["text"], "正确文字")
        self.assertEqual(out[0]["originalText"], "错字")
        self.assertEqual(out[0]["recognizer"], "manga-ocr-local")

    def test_keeps_tesseract_text_when_model_returns_empty(self):
        from PIL import Image
        img = Image.new("RGB", (100, 80), (255, 255, 255))
        buf = __import__("io").BytesIO(); img.save(buf, format="PNG")
        regions = [{"text": "保留", "x": 10, "y": 10, "width": 40, "height": 30, "confidence": 80}]
        with mock.patch.object(refiner, "get_model", return_value=lambda image: ""):
            out, n = refiner.refine_page_regions(buf.getvalue(), 100, 80, regions, allow_download=True)
        self.assertEqual(n, 0)
        self.assertEqual(out[0]["text"], "保留")

    def test_package_ready_false_without_import(self):
        with mock.patch.object(refiner.importlib.util, "find_spec", return_value=None):
            self.assertFalse(refiner.package_ready())

if __name__=="__main__":
    unittest.main(verbosity=2)
