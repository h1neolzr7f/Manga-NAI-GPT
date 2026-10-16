"""Perspective sign text (opt-in tool): find the sign's quadrilateral in a user box, erase its lettering, and return
the quad so the editor can place an editable 4-corner perspective text layer. CPU only (OpenCV), no model download."""
import base64
import io

from manga_smart_ocr import SmartOcrError, read_image


def _np():
    try:
        import cv2
        import numpy as np
    except ImportError as exc:
        raise SmartOcrError("透视文字需要 numpy + opencv（安装 AI 功能即可）。", 501) from exc
    return cv2, np


def _order(pts):
    """Corners as top-left, top-right, bottom-right, bottom-left."""
    _cv2, np = _np()
    pts = np.array(pts, dtype=np.float32).reshape(4, 2)
    s, d = pts.sum(1), np.diff(pts, axis=1).ravel()
    return np.array([pts[s.argmin()], pts[d.argmin()], pts[s.argmax()], pts[d.argmax()]], dtype=np.float32)


def detect_quad(gray):
    """Largest convex 4-gon covering >=20% of the crop (the sign board); else the min-area rectangle of the ink."""
    cv2, np = _np()
    h, w = gray.shape
    edges = cv2.dilate(cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 40, 120), np.ones((3, 3), np.uint8))
    cnts, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    best, area = None, 0.2 * w * h
    for c in cnts:
        ap = cv2.approxPolyDP(c, 0.03 * cv2.arcLength(c, True), True)
        a = cv2.contourArea(ap)
        if len(ap) == 4 and cv2.isContourConvex(ap) and a > area and a < 0.98 * w * h:
            best, area = ap.reshape(4, 2), a
    if best is not None:
        return _order(best), "board"
    ink = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 31, 15)
    ys, xs = np.nonzero(ink)
    if len(xs) < 20:
        return _order([[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]]), "box"
    box = cv2.boxPoints(cv2.minAreaRect(np.stack([xs, ys], 1).astype(np.float32)))
    c = box.mean(0)
    return _order(np.clip(c + (box - c) * 1.1, [0, 0], [w - 1, h - 1])), "ink"


def erase_in_quad(rgb, quad):
    """Inpaint the lettering inside the quad (ink that differs from the board's median colour)."""
    cv2, np = _np()
    h, w = rgb.shape[:2]
    inside = np.zeros((h, w), np.uint8)
    cv2.fillConvexPoly(inside, quad.astype(np.int32), 1)
    inner = cv2.erode(inside, np.ones((5, 5), np.uint8))
    px = rgb[inner > 0]
    if not len(px):
        return rgb.copy(), 0
    board = np.median(px, axis=0)
    diff = (np.abs(rgb.astype(int) - board).sum(2) > 60).astype(np.uint8) & inner
    mask = cv2.dilate(diff * 255, np.ones((3, 3), np.uint8), iterations=2)
    out = cv2.inpaint(rgb, mask, 3, cv2.INPAINT_TELEA)
    return out, int((mask > 0).sum())


def perspective_text(image_url, box):
    cv2, np = _np()
    from PIL import Image
    raw, w, h = read_image(image_url)
    rgb = np.array(Image.open(io.BytesIO(raw)).convert("RGB"))
    try:
        x, y, bw, bh = [int(round(float(v))) for v in box]
    except Exception as exc:
        raise SmartOcrError("请先框出招牌范围。", 400) from exc
    x, y = max(0, x), max(0, y)
    bw, bh = min(w - x, bw), min(h - y, bh)
    if bw < 16 or bh < 16:
        raise SmartOcrError("框太小了，请框住整块招牌。", 400)
    crop = rgb[y:y + bh, x:x + bw]
    quad, how = detect_quad(cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY))
    erased, px = erase_in_quad(crop, quad)
    buf = io.BytesIO()
    Image.fromarray(erased).save(buf, "PNG")
    q = (quad + [x, y]).round(1).tolist()
    top = float(np.linalg.norm(quad[1] - quad[0])); left = float(np.linalg.norm(quad[3] - quad[0]))
    return {"ok": True, "quad": q, "method": how, "box": [x, y, bw, bh], "erasedPixels": px,
            "patch": "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode(), "aspect": round(top / max(1.0, left), 3)}
