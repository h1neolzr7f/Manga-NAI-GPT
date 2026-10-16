"""Synthetic page: 3 framed panels (one slanted), a white bubble with fake glyphs -> panels, erase, hints."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
try:
    import cv2, numpy as np
except ImportError:
    print("SKIP manga-page-decompose (no opencv)"); sys.exit(0)
import manga_page_decompose as D

H, W = 1200, 800
img = np.full((H, W, 3), 255, np.uint8)
cv2.rectangle(img, (40, 40), (760, 400), (0, 0, 0), 4)
cv2.fillPoly(img, [np.array([[40, 440], [500, 440], [380, 1160], [40, 1160]])], (120, 120, 120))
cv2.polylines(img, [np.array([[40, 440], [500, 440], [380, 1160], [40, 1160]])], True, (0, 0, 0), 4)
cv2.fillPoly(img, [np.array([[540, 440], [760, 440], [760, 1160], [420, 1160]])], (90, 90, 90))
cv2.polylines(img, [np.array([[540, 440], [760, 440], [760, 1160], [420, 1160]])], True, (0, 0, 0), 4)
cv2.rectangle(img, (100, 100), (400, 300), (60, 60, 60), -1)          # "art"
cv2.ellipse(img, (580, 200), (130, 90), 0, 0, 360, (255, 255, 255), -1)
cv2.ellipse(img, (580, 200), (130, 90), 0, 0, 360, (0, 0, 0), 3)
mask = np.zeros((H, W), np.uint8)
for i in range(4):                                                      # fake glyph row
    x = 520 + i * 32
    cv2.line(img, (x, 200), (x + 20, 200), (0, 0, 0), 2); cv2.line(img, (x + 10, 185), (x + 10, 215), (0, 0, 0), 2)
    cv2.rectangle(mask, (x - 3, 182), (x + 23, 218), 255, -1)

gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
panels = D.detect_panels(gray)
assert len(panels) == 3, panels
assert panels[0]["bbox"][1] < 60 and panels[1]["bbox"][0] < panels[2]["bbox"][0], [p["bbox"] for p in panels]
assert len(panels[1]["polygon"]) >= 4

D.read_text = lambda rgb, box, vertical, use_manga_ocr=False: ("早上好", 90, "test", False)
res = D.decompose_array(img, mask=mask, hints=["早上好！"])
assert len(res["texts"]) == 1, res["texts"]
t = res["texts"][0]
assert t["isBubble"] and t["erase"] == "bubble-paper" and t["text"] == "早上好！" and t["panel"] == 0, t
c = res["cleaned"]
assert c[185:215, 520:640].min() > 240, "glyphs not erased"
assert c[110:290, 110:390].max() < 80, "art touched"
x, y, w, h = t["bubble"]
assert 440 <= x <= 460 and w > 240, t["bubble"]
assert c[200, 448:454].min() < 80, "bubble outline must survive"

# Non-bubble unreadable mark on art is left alone.
D.read_text = lambda rgb, box, vertical, use_manga_ocr=False: ("", 0, "test", True)
m2 = np.zeros((H, W), np.uint8); cv2.rectangle(m2, (150, 150), (200, 200), 255, -1)
r2 = D.decompose_array(img, mask=m2)
assert r2["texts"][0]["erase"] == "skipped" and (r2["cleaned"] == img).all()

# Borderless fallback
blank = np.full((300, 200), 255, np.uint8); blank[50:250, 50:150] = 30
assert len(D.detect_panels(blank)) == 1
print("manga-page-decompose ok")


def _no_gutter_tiers():
    try:
        import numpy as np, cv2  # noqa: F401
    except ImportError:
        return
    import manga_page_decompose as D
    g = np.full((1216, 832), 255, np.uint8)
    rng = np.random.default_rng(1)
    for i in range(4):   # textured tiers that touch each other, split by thin black lines only
        y0, y1 = i * 304, (i + 1) * 304
        g[y0:y1] = rng.integers(150, 256, (y1 - y0, 832), dtype=np.uint8)
        g[y0:y1:9, ::7] = 240
        cv2.line(g, (0, y1 - 2), (831, y1 - 2), 0, 4)
    g[:, :2] = 0; g[:, -2:] = 0; g[:2] = 0
    assert len(D._line_cells(g)) == 4, len(D._line_cells(g))
    assert len(D._prefer_line_grid(g, [])) == 4
    print("no-gutter tiers ok")


_no_gutter_tiers()


def _cache_by_sha():
    try:
        import numpy as np, cv2  # noqa: F401
        from PIL import Image
    except ImportError:
        return
    import io, base64
    import manga_page_decompose as D
    calls = []
    real = D.decompose_array
    D.decompose_array = lambda rgb, **k: (calls.append(1), {"width": rgb.shape[1], "height": rgb.shape[0], "panels": [], "texts": [], "cleaned": rgb, "mask": None})[1]
    import manga_text_detector as T
    T._get_session, T.text_mask_array = (lambda *_a: None), (lambda rgb, s: (None, None))
    def url(v):
        b = io.BytesIO(); Image.fromarray(np.full((64, 64, 3), v, np.uint8)).save(b, "PNG")
        return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()
    try:
        a = D.decompose(url(200)); b = D.decompose(url(200)); c = D.decompose(url(201)); d = D.decompose(url(200), hints=["x"])
        assert not a["cached"] and b["cached"] and not c["cached"] and not d["cached"] and len(calls) == 3, (calls, a["cached"], b["cached"])
        assert a["sha256"] == b["sha256"] != c["sha256"]
    finally:
        D.decompose_array = real
    print("decompose cache by sha256 ok")


_cache_by_sha()


def _flashback_and_inset():
    try:
        import numpy as np, cv2  # noqa: F401
    except ImportError:
        return
    import manga_page_decompose as D
    # black margins/gutters, three tiers whose art is dark on one side
    g = np.zeros((1216, 832), np.uint8)
    for y0 in (60, 460, 860):
        g[y0:y0 + 320, 50:780] = 200
        g[y0 + 40:y0 + 320, 300:340] = 10   # dark art touching the gutter
    assert len(D.detect_panels(g)) == 3, len(D.detect_panels(g))
    # white page: big panel with an inset in its lower-right corner (white halo + black frame)
    g = np.full((1216, 832), 255, np.uint8)
    cv2.rectangle(g, (40, 40), (790, 860), 0, 4); g[44:857, 44:787] = 90
    g[600:870, 500:832] = 255                                            # halo
    cv2.rectangle(g, (510, 610), (826, 864), 0, 5); g[615:860, 515:821] = 170
    cv2.rectangle(g, (40, 900), (790, 1170), 0, 4)
    n = len(D.detect_panels(g))
    assert n == 3, n
    print("flashback + corner inset ok")


_flashback_and_inset()


def _panels_only_route():
    try:
        import numpy as np, cv2  # noqa: F401
    except ImportError:
        return
    import base64
    import manga_page_decompose as D
    g = np.zeros((1216, 832), np.uint8)
    for y0 in (60, 460, 860):
        g[y0:y0 + 320, 50:780] = 200
    ok, buf = cv2.imencode(".png", g)
    r = D.panels_only("data:image/png;base64," + base64.b64encode(buf.tobytes()).decode(), rtl=True)
    assert r["ok"] and r["width"] == 832 and len(r["panels"]) == 3, r
    assert [p["bbox"][1] < q["bbox"][1] for p, q in zip(r["panels"], r["panels"][1:])] == [True, True]


_panels_only_route()
print("panels-only route ok")
