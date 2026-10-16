"""RapidOCR solid CJK must skip Tesseract (no opencv needed)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import manga_page_decompose as D

class FakeNP:
    uint8 = "uint8"
    @staticmethod
    def zeros(shape, dtype=None):
        class A(list):
            pass
        # minimal crop slice support via list of lists is too hard; use real numpy if present
        import numpy as np
        return np.zeros(shape, dtype=dtype or np.uint8)
    @staticmethod
    def ascontiguousarray(a):
        import numpy as np
        return np.ascontiguousarray(a)
    @staticmethod
    def rot90(a, k=1):
        import numpy as np
        return np.rot90(a, k)

# Prefer real numpy (usually present even without cv2)
try:
    import numpy as np
except ImportError:
    print("SKIP ocr-rapid-skip (no numpy)"); sys.exit(0)

# Stub _np so read_text vertical fallback can rotate without opencv
D._np = lambda: (None, np)

calls = {"n": 0}
D._rapid_text = lambda crop, vertical: "怎么办没带伞"

def boom(*a, **k):
    calls["n"] += 1
    return "should-not-run", 0

D._tesseract_text = boom
rgb = np.zeros((80, 40, 3), dtype=np.uint8)
text, conf, engine, suspect = D.read_text(rgb, [2, 2, 38, 70], True)
assert engine == "rapidocr" and text.startswith("怎么办"), (engine, text)
assert calls["n"] == 0, "Tesseract should be skipped when RapidOCR score >= 2"

D._rapid_text = lambda crop, vertical: "ab"
D._tesseract_text = lambda *a, **k: ("中文可以了", 80)
text2, _, engine2, _ = D.read_text(rgb, [2, 2, 38, 70], False)
assert engine2 == "tesseract" and text2 == "中文可以了", (engine2, text2)
print("ocr-rapid-skip ok")
