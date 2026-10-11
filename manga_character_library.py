"""Character library (2.0 #1): name recurring characters once, recognise them on any page, score consistency.

Idea from Magiv2's chapter-wide character bank (arXiv:2408.00298): a small bank of exemplar images per
character, every character found on a page is matched to its nearest bank entry. Instead of Magiv2's
transformer we reuse the CPU models already shipped for 换角色: YOLOv8 anime-face detection + CCIP
(deepghs) identity features on a head-and-shoulders crop around each face. No segmentation, so it is fast
(about 0.3 s per face on CPU).

All inputs/outputs are plain JSON; the library itself lives in the browser (IndexedDB), the server keeps
nothing.
"""
import base64
import io

import manga_character_detect as mcd
from manga_smart_ocr import SmartOcrError, read_image

MATCH = mcd.CCIP_SAME      # 0.178: CCIP's own F1-optimal "same character" difference
POSSIBLE = 0.20            # shown as "可能是…", never auto-applied (cats measured 0.203–0.245 vs people)
MAX_FACES = 24


def head_box(face, W, H):
    """Head + shoulders around a face box: CCIP was trained on character crops, not tight faces."""
    x0, y0, x1, y1 = face[:4]
    w, h = x1 - x0, y1 - y0
    cx = (x0 + x1) / 2
    side = max(w, h) * 2.4
    bx0, by0 = cx - side / 2, y0 - h * 0.6
    return [int(max(0, bx0)), int(max(0, by0)), int(min(W, bx0 + side)), int(min(H, by0 + side))]


def _feat(rgb, box, extra):
    import numpy as np
    m = np.ones(rgb.shape[:2], bool)
    return mcd.ccip_embed(rgb, m, box, extra["ccip"])


def palette(rgb, box, k=4):
    """Main colours of a crop (k-means in Lab, ignoring near-white paper and pure black ink).
    Returns [] for grayscale pages: colour carries no identity there."""
    import cv2
    import numpy as np
    x0, y0, x1, y1 = box
    crop = rgb[y0:y1, x0:x1]
    if crop.size == 0:
        return []
    small = cv2.resize(crop, (64, 64), interpolation=cv2.INTER_AREA).reshape(-1, 3).astype(np.float32)
    sat = small.max(1) - small.min(1)
    if float(np.percentile(sat, 90)) < 18:        # grayscale manga
        return []
    lum = small.mean(1)
    keep = small[(lum < 235) & (lum > 25)]
    if len(keep) < k * 8:
        return []
    lab = cv2.cvtColor(keep.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    _c, labels, centers = cv2.kmeans(lab, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0), 3, cv2.KMEANS_PP_CENTERS)
    counts = np.bincount(labels.ravel(), minlength=k)
    order = np.argsort(-counts)
    rgbc = cv2.cvtColor(centers[order].reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_LAB2RGB).reshape(-1, 3)
    return [{"rgb": "#%02x%02x%02x" % tuple(int(v) for v in c), "share": round(float(counts[i]) / len(lab), 3),
             "lab": [round(float(v), 1) for v in centers[i]]} for c, i in zip(rgbc, order)]


def palette_distance(a, b):
    """Share-weighted nearest-colour ΔE (CIE76 on OpenCV Lab) between two palettes; None if either is empty."""
    if not a or not b:
        return None
    import math

    def one(p, q):
        return sum(x["share"] * min(math.dist(x["lab"], y["lab"]) for y in q) for x in p) / max(1e-6, sum(x["share"] for x in p))
    return round((one(a, b) + one(b, a)) / 2, 2)


def _encode(feat):
    import numpy as np
    return base64.b64encode(np.asarray(feat, np.float32).tobytes()).decode()


def _decode(s):
    import numpy as np
    return np.frombuffer(base64.b64decode(s), np.float32)


def _rgb(payload):
    import numpy as np
    from PIL import Image
    raw, _w, _h = read_image(payload.get("image"))
    return np.array(Image.open(io.BytesIO(raw)).convert("RGB"))


def embed(payload):
    """Reference image (optionally a box on it) -> {feature, palette, face, box}. Picks the largest face."""
    extra = mcd._get_extra(payload.get("allow_download") is True)
    rgb = _rgb(payload)
    H, W = rgb.shape[:2]
    box = payload.get("box")
    region = rgb
    off = (0, 0)
    if box:
        x0, y0, x1, y1 = [int(v) for v in box]
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
        if x1 - x0 < 16 or y1 - y0 < 16:
            raise SmartOcrError("选的范围太小了。")
        region, off = rgb[y0:y1, x0:x1], (x0, y0)
    fs = sorted(mcd.faces(region, extra["face"]), key=lambda f: -(f[2] - f[0]) * (f[3] - f[1]))
    if fs:
        f = fs[0]
        face = [f[0] + off[0], f[1] + off[1], f[2] + off[0], f[3] + off[1]]
        crop = head_box(face, W, H)
    else:
        if not box:
            raise SmartOcrError("这张图里没有找到人脸。请换一张能看清脸的参考图，或在图上框出人物。", 422)
        face, crop = None, [off[0], off[1], off[0] + region.shape[1], off[1] + region.shape[0]]
    return {"ok": True, "feature": _encode(_feat(rgb, crop, extra)), "palette": palette(rgb, crop),
            "face": face, "box": crop}


def _panel_of(face, panels):
    cx, cy = (face[0] + face[2]) / 2, (face[1] + face[3]) / 2
    for i, p in enumerate(panels or []):
        x0, y0, x1, y1 = p["box"] if isinstance(p, dict) else p
        if x0 <= cx <= x1 and y0 <= cy <= y1:
            return i
    return -1


def score(diff, pal_d=None):
    """0-100: 100 = CCIP says identical, 50 = exactly at the same-character threshold, 0 = clearly different.
    Colour (when both palettes exist) can only lower it: ΔE above 25 costs up to 20 points."""
    s = max(0.0, min(1.0, 1 - diff / (2 * MATCH))) * 100
    if pal_d is not None:
        s -= max(0.0, min(20.0, (pal_d - 25) * 0.8))
    return int(round(max(0, s)))


def identify(payload):
    """Page + library -> each face with its best library character, the difference, a status and a score.
    library: [{"id", "name", "features": [b64...], "palette": [...]}]. Two faces in one panel never get the
    same character (assignment by increasing difference)."""
    import numpy as np
    extra = mcd._get_extra(payload.get("allow_download") is True)
    lib = [e for e in (payload.get("library") or []) if e.get("features")]
    rgb = _rgb(payload)
    H, W = rgb.shape[:2]
    panels = payload.get("panels") or []
    fs = mcd.faces(rgb, extra["face"])[:MAX_FACES]
    faces = []
    for f in fs:
        crop = head_box(f, W, H)
        faces.append({"face": f[:4], "conf": f[4], "box": crop, "panel": _panel_of(f, panels),
                      "feat": _feat(rgb, crop, extra), "palette": palette(rgb, crop)})
    lib_feats, owner = [], []
    for li, e in enumerate(lib):
        for s in e["features"][:8]:
            lib_feats.append(_decode(s))
            owner.append(li)
    D = None
    if faces and lib_feats:
        allf = [x["feat"] for x in faces] + lib_feats
        M = np.array(mcd.ccip_difference(allf, extra["ccipm"]))
        D = M[:len(faces), len(faces):]
    cand = []
    for fi, x in enumerate(faces):
        x["best"] = []
        if D is None:
            continue
        per = {}
        for j, li in enumerate(owner):
            per[li] = min(per.get(li, 9), float(D[fi, j]))
        x["best"] = sorted(per.items(), key=lambda kv: kv[1])[:3]
        for li, d in per.items():
            cand.append((d, fi, li))
    taken = set()
    assigned = {}
    for d, fi, li in sorted(cand):
        if fi in assigned or d > POSSIBLE:
            continue
        p = faces[fi]["panel"]
        if (p, li) in taken and p >= 0:
            continue
        assigned[fi] = (li, d)
        taken.add((p, li))
    out = []
    for fi, x in enumerate(faces):
        r = {"face": x["face"], "box": x["box"], "panel": x["panel"], "conf": x["conf"], "palette": x["palette"]}
        if fi in assigned:
            li, d = assigned[fi]
            pd = palette_distance(x["palette"], lib[li].get("palette"))
            r.update({"id": lib[li]["id"], "name": lib[li].get("name", ""), "difference": round(d, 4),
                      "status": "match" if d <= MATCH else "possible", "score": score(d, pd), "paletteDelta": pd})
        else:
            r.update({"id": None, "status": "unknown",
                      "nearest": ({"id": lib[x["best"][0][0]]["id"], "difference": round(x["best"][0][1], 4)} if x["best"] else None)})
        if payload.get("return_features"):
            r["feature"] = _encode(x["feat"])
        out.append(r)
    per_panel = {}
    for r in out:
        if r["status"] != "unknown":
            per_panel.setdefault(r["panel"], []).append(r["score"])
    return {"ok": True, "width": W, "height": H, "faces": out, "threshold": MATCH, "possible": POSSIBLE,
            "panelScores": {str(k): min(v) for k, v in per_panel.items()}}
