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
