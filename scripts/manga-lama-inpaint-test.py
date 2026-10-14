"""Optional local LaMa adapter contract. No GPU, torch weights or download in tests."""
import base64
import pathlib
import sys
import unittest
from unittest import mock
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
import manga_lama_inpaint as lama
from manga_smart_ocr import SmartOcrError

PNG=(b"\x89PNG\r\n\x1a\n"+b"\x00\x00\x00\x0dIHDR"+
     (300).to_bytes(4,"big")+(200).to_bytes(4,"big")+b"\x08\x06\x00\x00\x00")
URL="data:image/png;base64,"+base64.b64encode(PNG).decode("ascii")

class FakeImage:
    def __init__(self,format="PNG",width=300,height=200):
        self.format=format
        self.size=(width,height)
        self.width=width
        self.height=height
    def convert(self,mode): return self
    def getbbox(self): return (100,60,180,108)
    def getdata(self): return [255]*5000+[0]*55000
    def save(self,out,format):out.write(PNG)

class Tests(unittest.TestCase):
    def tearDown(self): lama._reset_for_tests()

    def test_rejects_invalid_image_before_loading_model(self):
        with mock.patch.object(lama,"get_model",side_effect=AssertionError("never load")):
            with self.assertRaises(SmartOcrError):
                lama.inpaint("data:text/plain;base64,QQ==", URL)
            with self.assertRaises(SmartOcrError):
                lama.inpaint(URL, "data:image/png;base64,invalid")

    @mock.patch.object(lama,"compose_masked",return_value=FakeImage())
    @mock.patch.object(lama,"decode_pair",return_value=(FakeImage(),FakeImage()))
    @mock.patch.object(lama,"get_model",return_value=("lama", lambda image,mask:FakeImage()))
    def test_returned_image_is_explicit_local_preview_only(self,model,decode,compose):
        result=lama.inpaint(URL,URL,engine="lama")
        self.assertEqual(result["engine"],"simple-lama-local")
        self.assertEqual(result["engineName"],"lama")
        self.assertEqual(result["width"],300)
        self.assertEqual(result["height"],200)
        self.assertTrue(result["image"].startswith("data:image/png;base64,"))
        self.assertFalse(result["applied"])
        self.assertFalse(result["verified"])

    @mock.patch.object(lama,"compose_masked",return_value=FakeImage())
    @mock.patch.object(lama,"decode_pair",return_value=(FakeImage(),FakeImage()))
    @mock.patch.object(lama,"get_model",return_value=("lama-manga", lambda image,mask:FakeImage()))
    def test_manga_engine_labeled(self,model,decode,compose):
        result=lama.inpaint(URL,URL,engine="lama-manga")
        self.assertEqual(result["engine"],"simple-lama-manga-local")
        self.assertEqual(result["engineName"],"lama-manga")

    def test_resolve_engine_auto_prefers_cached_manga(self):
        with mock.patch.object(lama,"manga_cached",return_value=True):
            self.assertEqual(lama.resolve_engine("auto"),"lama-manga")
        with mock.patch.object(lama,"manga_cached",return_value=False):
            self.assertEqual(lama.resolve_engine("auto"),"lama")

    def test_rejects_unknown_engine(self):
        with self.assertRaises(SmartOcrError):
            lama.resolve_engine("aot")

    @mock.patch.object(lama.importlib,"import_module",side_effect=ModuleNotFoundError("simple_lama"))
    def test_missing_package_actionable(self,module):
        with self.assertRaises(SmartOcrError) as caught:lama.get_model()
        self.assertEqual(caught.exception.status,503)
        self.assertIn("simple-lama",str(caught.exception))

    def test_lazy_model_initialized_only_once(self):
        class FakeLama:
            initialized=0
            def __init__(self):FakeLama.initialized+=1
            def __call__(self,image,mask):return FakeImage()
        with mock.patch.object(lama.importlib,"import_module",
                               return_value=type("Shim",(),{"SimpleLama":FakeLama})):
            a=lama.get_model(allow_download=True,engine="lama")
            b=lama.get_model(engine="lama")
        self.assertEqual(a[0],"lama")
        self.assertIs(a[1],b[1])
        self.assertEqual(FakeLama.initialized,1)

if __name__=="__main__":unittest.main(verbosity=2)
