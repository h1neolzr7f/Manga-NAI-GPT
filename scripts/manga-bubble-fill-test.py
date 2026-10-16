"""Unit tests for deterministic bubble paper fill (no neural net)."""
import base64
import io
import pathlib
import sys
import unittest
try:
    from PIL import Image, ImageDraw
except ImportError:  # CI legs without Pillow (offline-contract / legacy) skip like the other image tests
    print('SKIP manga-bubble-fill (no Pillow)')
    sys.exit(0)

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import manga_bubble_fill as bf
import manga_lama_inpaint as lama
from manga_smart_ocr import SmartOcrError


def png_url(im):
    buf = io.BytesIO()
    im.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


class BubbleFillTests(unittest.TestCase):
    def test_fills_white_bubble_text(self):
        # White oval bubble on dark art; black vertical text inside.
        src = Image.new("RGB", (200, 180), (30, 30, 40))
        d = ImageDraw.Draw(src)
        d.ellipse((20, 20, 120, 160), fill=(255, 255, 255), outline=(10, 10, 10), width=3)
        d.rectangle((55, 45, 75, 130), fill=(20, 20, 20))  # fake glyph column
        mask = Image.new("L", (200, 180), 0)
        ImageDraw.Draw(mask).rectangle((54, 44, 76, 131), fill=255)  # tight on glyph
        out, meta = bf.detect_and_fill(src, mask)
        self.assertIsNotNone(out, meta)
        self.assertTrue(meta["ok"])
        self.assertEqual(out.getpixel((60, 80)), tuple(meta["paper"]))
        # Outline preserved (dark ring outside original mask)
        self.assertLess(sum(out.getpixel((20, 90))) / 3, 40)

    def test_rejects_text_on_art(self):
        src = Image.new("RGB", (120, 80), (90, 70, 50))
        ImageDraw.Draw(src).rectangle((30, 20, 90, 60), fill=(20, 20, 20))
        mask = Image.new("L", (120, 80), 0)
        ImageDraw.Draw(mask).rectangle((30, 20, 90, 60), fill=255)
        out, meta = bf.detect_and_fill(src, mask)
        self.assertIsNone(out)
        self.assertIn(meta["reason"], ("no-paper-seed", "mask-outside-bubble", "few-paper-samples", "paper-not-uniform", "paper-too-dark"))

    def test_auto_prefers_bubble_then_lama(self):
        src = Image.new("RGB", (160, 120), (255, 255, 255))
        ImageDraw.Draw(src).rectangle((60, 30, 90, 90), fill=(15, 15, 15))
        mask = Image.new("L", (160, 120), 0)
        ImageDraw.Draw(mask).rectangle((58, 28, 92, 92), fill=255)
        result = lama.inpaint(png_url(src), png_url(mask), engine="auto")
        self.assertEqual(result["engineName"], "bubble")
        self.assertEqual(result["engine"], "bubble-fill-local")

    def test_bubble_engine_errors_when_inapplicable(self):
        src = Image.new("RGB", (80, 60), (40, 40, 40))
        mask = Image.new("L", (80, 60), 0)
        ImageDraw.Draw(mask).rectangle((10, 10, 50, 40), fill=255)
        with self.assertRaises(SmartOcrError) as caught:
            lama.inpaint(png_url(src), png_url(mask), engine="bubble")
        self.assertEqual(caught.exception.status, 422)


if __name__ == "__main__":
    unittest.main(verbosity=2)
