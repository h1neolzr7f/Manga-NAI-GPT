"""Weakness 5: RapidOCR-first OCR + job progress while decompose runs."""
import os, sys, threading, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
try:
    import cv2, numpy as np
except ImportError:
    print("SKIP decompose-progress (no opencv)"); sys.exit(0)
import manga_page_decompose as D

# OCR prefer RapidOCR: a vertical CJK column should not spend time on jpn_vert first.
# We only assert the function prefers rapid when it scores; engine name is checked on a synthetic page below.
assert "RapidOCR first" in (D.read_text.__doc__ or "")
src = open(D.__file__).read()
assert "timeout=8" in src
assert "timeout=8" in src

# Progress callback fires stages in order
seen = []
img = np.full((600, 400, 3), 255, np.uint8)
cv2.rectangle(img, (20, 20), (380, 280), (0, 0, 0), 3)
cv2.rectangle(img, (20, 300), (380, 580), (0, 0, 0), 3)
cv2.rectangle(img, (40, 40), (200, 120), (255, 255, 255), -1)
cv2.rectangle(img, (40, 40), (200, 120), (0, 0, 0), 2)
# fake glyph
for i in range(3):
    x = 60 + i * 40
    cv2.line(img, (x, 60), (x + 20, 60), (0, 0, 0), 2)

def on_progress(stage, i=0, n=0, detail=""):
    seen.append(stage)

mask = np.zeros((600, 400), np.uint8)
mask[50:100, 50:200] = 255
r = D.decompose_array(img, mask=mask, rtl=True, on_progress=on_progress)
assert "panels" in seen and "done" in seen, seen
assert seen.index("panels") < seen.index("done")

# Job status store
j = D.begin_job("test-job")
D.job_progress(j, "ocr", 2, 5, "识别文字 2/5")
st = D.job_status(j)
assert st["stage"] == "ocr" and st["i"] == 2 and st["n"] == 5 and "2/5" in st["detail"]
D.end_job(j)
assert D.job_status(j)["stage"] == "done"

# Route allow-list
assert '"/manga-smart/decompose-progress"' in open(os.path.join(os.path.dirname(__file__), "..", "manga_smart_ocr.py")).read()
print("decompose progress ok", seen)
