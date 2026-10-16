"""Perspective sign text: a skewed light board with dark lettering on a mid-grey wall -> board quad found, ink erased."""
import base64, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
try:
    import cv2, numpy as np
except ImportError:
    print("SKIP perspective-text (no opencv)"); sys.exit(0)
import manga_perspective_text as T

img = np.full((400, 600, 3), 120, np.uint8)
quad = np.array([[120, 90], [470, 60], [500, 300], [100, 280]], np.int32)
cv2.fillConvexPoly(img, quad, (235, 235, 235))
for k in range(5):
    x = 170 + k * 60
    cv2.rectangle(img, (x, 150), (x + 30, 220), (20, 20, 20), -1)
ok, buf = cv2.imencode(".png", img)
r = T.perspective_text("data:image/png;base64," + base64.b64encode(buf.tobytes()).decode(), [60, 30, 480, 320])
assert r["ok"] and r["method"] == "board", r["method"]
got = np.array(r["quad"])
assert np.abs(got - quad).max() < 14, got
patch = cv2.imdecode(np.frombuffer(base64.b64decode(r["patch"].split(",")[1]), np.uint8), cv2.IMREAD_COLOR)
inner = patch[150 - 30:220 - 30, 170 - 60:460 - 60]
assert (inner.mean(axis=2) < 80).mean() < 0.02, "lettering erased"
assert r["erasedPixels"] > 0
print("perspective text ok")

# opt-in scene-text erase keeps the default untouched
import manga_page_decompose as D
import inspect
assert inspect.signature(D.decompose_array).parameters["erase_scene_text"].default is False
assert inspect.signature(D.decompose).parameters["erase_scene_text"].default is False
print("scene-text erase opt-in default off ok")
