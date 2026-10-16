"""Full-page decomposition: panels + bubbles + text -> editable layer plan.

Own implementation (classical CV + the bundled comic-text-detector). Input is one
page image; output is JSON the editor turns into panel/image/text layers:

  panels: [{polygon:[[x,y]...], bbox:[x,y,w,h]}]   reading order (right-to-left optional)
  texts:  [{bbox, bubble, vertical, text, suspect, fontSize, erase}]
  cleaned: data URL of the page with text erased (bubble fill -> LaMa -> cv2 fallback)
"""
import base64
import io
import subprocess

from manga_smart_ocr import SmartOcrError

MAX_PIXELS = 4_200_000


def _np():
    try:
        import cv2
        import numpy as np
    except ImportError as exc:  # pragma: no cover
        raise SmartOcrError("整页拆解需要 numpy + opencv（安装 AI 功能即可）。", 501) from exc
    return cv2, np


# ---------------------------------------------------------------- panels
def detect_panels(gray, min_area_ratio=0.015):
    """gray: HxW uint8. Returns list of {polygon,bbox} sorted top->bottom, left->right."""
    cv2, np = _np()
    h, w = gray.shape
    white = (gray >= 225).astype(np.uint8)
    # Gutter = white pixels connected to the page margin. Pad so every margin pixel connects.
    pad = np.pad(white, 2, constant_values=1)
    n, lab = cv2.connectedComponents(pad, connectivity=4)
    gutter = (lab == lab[0, 0]).astype(np.uint8)[2:-2, 2:-2]
    # Close thin white leaks between nearby frames: thicken gutter a little, then panels = rest.
    content = (1 - gutter).astype(np.uint8)
    k = max(3, int(min(h, w) * 0.004) | 1)
    content = cv2.morphologyEx(content, cv2.MORPH_OPEN, np.ones((k, k), np.uint8))
    cnts, _ = cv2.findContours(content, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    panels = []
    page_area = float(h * w)
    for c in cnts:
        area = cv2.contourArea(c)
        x, y, bw, bh = cv2.boundingRect(c)
        if area < page_area * min_area_ratio or bw < w * 0.08 or bh < h * 0.04:
            continue
        hull = cv2.convexHull(c)
        poly = cv2.approxPolyDP(hull, 0.012 * cv2.arcLength(hull, True), True).reshape(-1, 2)
        # Mostly-rectangular blobs become clean rectangles.
        if area / float(bw * bh) > 0.93 or len(poly) < 3:
            poly = np.array([[x, y], [x + bw, y], [x + bw, y + bh], [x, y + bh]])
        panels.append({"polygon": poly.astype(int).tolist(), "bbox": [int(x), int(y), int(bw), int(bh)],
                       "fill": round(area / float(bw * bh), 3)})
    panels = _drop_contained(panels)
    panels = _prefer_line_grid(gray, panels)
    if not panels:  # borderless page: single panel covering the content
        ys, xs = np.where(gray < 225)
        if len(xs):
            x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())
        else:
            x0, y0, x1, y1 = 0, 0, w - 1, h - 1
        panels = [{"polygon": [[x0, y0], [x1, y0], [x1, y1], [x0, y1]],
                   "bbox": [x0, y0, x1 - x0 + 1, y1 - y0 + 1], "fill": 1.0, "borderless": True}]
    return order_panels(panels)


def _line_cells(gray):
    """Cells bounded by thin straight dark frame lines (for pages without white gutters)."""
    cv2, np = _np()
    h, w = gray.shape
    d = (gray < 110).astype(np.uint8)

    def thin_lines(kl, horiz):
        k = cv2.getStructuringElement(cv2.MORPH_RECT, (kl, 1) if horiz else (1, kl))
        kt = cv2.getStructuringElement(cv2.MORPH_RECT, (kl, 14) if horiz else (14, kl))
        thick = cv2.dilate(cv2.morphologyEx(d, cv2.MORPH_OPEN, kt), np.ones((5, 5), np.uint8))
        return cv2.morphologyEx(d, cv2.MORPH_OPEN, k) & (1 - thick)
    lines = cv2.dilate(thin_lines(int(w * 0.2), True) | thin_lines(int(h * 0.12), False), np.ones((5, 5), np.uint8))
    n, _lab, st, _c = cv2.connectedComponentsWithStats(1 - lines, connectivity=4)
    cells = []
    for i in range(1, n):
        x, y, bw, bh, a = (int(v) for v in st[i])
        if a < 0.03 * h * w or bh < 0.06 * h or a / float(bw * bh) < 0.85:
            continue
        cells.append({"polygon": [[x, y], [x + bw, y], [x + bw, y + bh], [x, y + bh]], "bbox": [x, y, bw, bh],
                      "fill": round(a / float(bw * bh), 3), "lineGrid": True})
    return cells


def _prefer_line_grid(gray, panels):
    """Use the line grid only when it explains clearly more of the page with clean rectangles."""
    h, w = gray.shape
    cells = _line_cells(gray)
    good = lambda ps: sum(p["bbox"][2] * p["bbox"][3] for p in ps if p["fill"] >= 0.85) / float(h * w)
    if len(cells) > len(panels) and good(cells) > good(panels) + 0.15:
        return cells
    return panels


def _contains(a, b, slack=4):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return bx >= ax - slack and by >= ay - slack and bx + bw <= ax + aw + slack and by + bh <= ay + bh + slack + (ah - bh)


def _drop_contained(panels):
    """A blob fully inside another panel's box is a hole left by a white leak, not a panel."""
    out = []
    for i, p in enumerate(panels):
        if any(j != i and q["bbox"][2] * q["bbox"][3] > p["bbox"][2] * p["bbox"][3] and _contains(q["bbox"], p["bbox"])
               for j, q in enumerate(panels)):
            continue
        out.append(p)
    return out


def order_panels(panels, rtl=False):
    """Row-band reading order: group by vertical overlap, then sort each row horizontally."""
    rest = sorted(panels, key=lambda p: p["bbox"][1])
    rows = []
    for p in rest:
        x, y, w, h = p["bbox"]
        for row in rows:
            ry0, ry1 = row["y0"], row["y1"]
            if min(y + h, ry1) - max(y, ry0) > 0.5 * min(h, ry1 - ry0):
                row["items"].append(p)
                row["y0"], row["y1"] = min(ry0, y), max(ry1, y + h)
                break
        else:
            rows.append({"y0": y, "y1": y + h, "items": [p]})
    out = []
    for row in rows:
        out += sorted(row["items"], key=lambda p: -p["bbox"][0] if rtl else p["bbox"][0])
    return out


# ---------------------------------------------------------------- text
def _group_text(mask, boxes, w, h):
    """Merge CTD mask blobs into text blocks; returns [[x0,y0,x1,y1]]."""
    cv2, np = _np()
    k = max(5, int(min(w, h) * 0.012))
    merged = cv2.dilate(mask, np.ones((k, k), np.uint8))
    n, lab, stats, _ = cv2.connectedComponentsWithStats((merged > 0).astype(np.uint8))
    blocks = []
    for i in range(1, n):
        x, y, bw, bh, area = stats[i]
        sub = mask[y:y + bh, x:x + bw]
        if (sub > 0).sum() < 30 or (min(bw, bh) < 10 and max(bw, bh) < 24):
            continue
        ys, xs = np.where(sub > 0)
        blocks.append([int(x + xs.min()), int(y + ys.min()), int(x + xs.max() + 1), int(y + ys.max() + 1)])
    return blocks


def _has_cjk(text):
    return any(("\u3040" <= ch <= "\u30ff") or ("\u3400" <= ch <= "\u9fff") or ("\uac00" <= ch <= "\ud7af") for ch in text or "")


def is_garbled(text):
    """Mostly non-CJK OCR output (leaked prompt English, symbol soup) must never become a text layer."""
    compact = "".join((text or "").split())
    if not compact:
        return True
    cjk = sum(1 for ch in compact if _has_cjk(ch))
    latin = sum(1 for ch in compact if ch.isalnum() and not _has_cjk(ch))   # punctuation (……！——) is neutral
    return cjk == 0 or latin / float(cjk + latin) > 0.3


def find_bubble(gray, box):
    """White region enclosing a text box -> (bbox, is_bubble, paper_level)."""
    cv2, np = _np()
    h, w = gray.shape
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    m = int(max(bw, bh) * 1.2) + 10
    cx0, cy0, cx1, cy1 = max(0, x0 - m), max(0, y0 - m), min(w, x1 + m), min(h, y1 + m)
    crop = gray[cy0:cy1, cx0:cx1]
    light = (crop >= 238).astype(np.uint8)
    # Thicken thin anti-aliased outlines so paper does not leak out, then glyphs count as paper.
    light = cv2.erode(light, np.ones((3, 3), np.uint8))
    light[y0 - cy0:y1 - cy0, x0 - cx0:x1 - cx0] = 1
    n, lab, stats, _ = cv2.connectedComponentsWithStats(light, connectivity=4)
    sid = lab[(y0 + y1) // 2 - cy0, (x0 + x1) // 2 - cx0]
    if sid == 0:
        return [x0, y0, bw, bh], False
    bx, by, bbw, bbh, area = stats[sid]
    touches = bx == 0 or by == 0 or bx + bbw >= crop.shape[1] or by + bbh >= crop.shape[0]
    comp = (lab == sid).astype(np.uint8)
    cs, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    hull_area = cv2.contourArea(cv2.convexHull(max(cs, key=cv2.contourArea))) if cs else 0
    solidity = area / hull_area if hull_area else 0
    ink = float((gray[y0:y1, x0:x1] < 128).mean()) if bw and bh else 1
    ok = (not touches) and area < bw * bh * 12 and solidity > 0.7 and ink < 0.35 and area > bw * bh * 1.3
    if not ok:
        return [x0, y0, bw, bh], False
    return [int(cx0 + bx), int(cy0 + by), int(bbw), int(bbh)], True


def bubble_interior(gray, box, bubble):
    """Filled bubble interior (minus a safety ring) as a page-sized bool slice tuple + mask."""
    cv2, np = _np()
    x, y, w, h = bubble
    crop = gray[y:y + h, x:x + w]
    light = cv2.erode((crop >= 238).astype(np.uint8), np.ones((3, 3), np.uint8))
    x0, y0, x1, y1 = box
    light[max(0, y0 - y):y1 - y, max(0, x0 - x):x1 - x] = 1
    n, lab = cv2.connectedComponents(light, connectivity=4)
    sid = lab[min(h - 1, (y0 + y1) // 2 - y), min(w - 1, (x0 + x1) // 2 - x)]
    comp = (lab == sid).astype(np.uint8)
    # fill holes (glyph counters, punctuation) by flooding the outside
    pad = np.pad(1 - comp, 1, constant_values=1)
    ff = pad.copy()
    cv2.floodFill(ff, None, (0, 0), 2)
    filled = ((ff[1:-1, 1:-1] != 2)).astype(np.uint8)
    inner = cv2.erode(filled, np.ones((5, 5), np.uint8))
    return inner


def _tesseract_text(rgb_crop, vertical, lang="chi_sim", psm=None):
    from manga_smart_ocr import find_tesseract
    exe = find_tesseract()
    if not exe:
        return "", 0
    from PIL import Image
    buf = io.BytesIO()
    im = Image.fromarray(rgb_crop).convert("L")
    scale = max(1.0, 90.0 / max(1, min(im.width, im.height)))
    if scale > 1:
        im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    im.save(buf, "PNG")
    langs = lang
    psm = psm or ("5" if vertical else "6")
    try:
        out = subprocess.run([exe, "stdin", "stdout", "-l", langs, "--psm", psm, "tsv"], input=buf.getvalue(),
                             capture_output=True, timeout=30).stdout.decode("utf-8", "ignore")
    except Exception:
        return "", 0
    words, confs = [], []
    for line in out.splitlines()[1:]:
        p = line.split("\t")
        if len(p) >= 12 and p[11].strip() and float(p[10]) >= 0:
            words.append(p[11].strip())
            confs.append(float(p[10]))
    return "".join(words), (sum(confs) / len(confs) if confs else 0)


_rapid = None


def _rapid_text(crop, vertical):
    """RapidOCR (PP-OCRv3 Chinese, Apache-2.0, ~14 MB bundled with the pip wheel). '' when unavailable."""
    global _rapid
    cv2, np = _np()
    try:
        if _rapid is None:
            from rapidocr_onnxruntime import RapidOCR
            _rapid = RapidOCR()
    except Exception:
        _rapid = False
    if not _rapid:
        return ""
    # Vertical columns: rotate counter-clockwise so the right-most column becomes the first row.
    c = np.ascontiguousarray(np.rot90(crop, 1)) if vertical else crop
    c = cv2.copyMakeBorder(c, 16, 16, 16, 16, cv2.BORDER_CONSTANT, value=(255, 255, 255))
    try:
        res, _ = _rapid(c)
    except Exception:
        return ""
    if not res:
        return ""
    res = sorted(res, key=lambda r: (r[0][0][1], r[0][0][0]))
    return "".join(r[1] for r in res)


def _ocr_score(text):
    cjk = sum(1 for ch in text or "" if _has_cjk(ch))
    latin = sum(1 for ch in text or "" if ch.isascii() and ch.isalnum())
    return cjk - 2 * latin


def read_text(rgb, box, vertical, use_manga_ocr=False):
    x0, y0, x1, y1 = box
    p = 4
    crop = rgb[max(0, y0 - p):y1 + p, max(0, x0 - p):x1 + p]
    engine = "tesseract"
    text, conf = _tesseract_text(crop, vertical, "jpn_vert" if vertical else "chi_sim")
    if not text.strip():  # short single line / tiny column: retry as one line
        from PIL import Image as _I
        import numpy as _np2
        c2 = crop if not vertical else _np2.array(_I.fromarray(crop))
        text, conf = _tesseract_text(c2, False, "chi_sim", psm="7" if not vertical else "5")
    r_text = _rapid_text(crop, vertical)
    if r_text and _ocr_score(r_text) >= _ocr_score(text):
        text, conf, engine = r_text, 0, "rapidocr"
    if use_manga_ocr:
        try:
            from manga_ocr_refiner import get_model
            from PIL import Image
            t2 = get_model(False)(Image.fromarray(crop))
            if t2 and t2.strip():
                text, conf, engine = t2.strip(), 0, "manga-ocr"
        except Exception:
            pass
    from manga_ocr_refiner import _looks_suspect
    return text, conf, engine, _looks_suspect(text, conf, vertical)


def apply_hints(texts, hints):
    """Generated pages: we know the intended dialogue. Snap OCR to the closest hint.

    Greedy by similarity (difflib on compact strings); leftover empty/garbage blocks take
    leftover hints in reading order only when counts match exactly.
    """
    import difflib
    hints = [h.strip() for h in (hints or []) if h and h.strip()]
    if not hints:
        return texts
    norm = lambda s: "".join(ch for ch in (s or "") if not ch.isspace())
    pairs = []
    for i, t in enumerate(texts):
        for j, h in enumerate(hints):
            a, b = norm(t["text"]), norm(h)
            score = difflib.SequenceMatcher(None, a, b).ratio() if a else 0
            if a and b in a or (a and a in b and len(a) >= 2):
                score = max(score, 0.75)
            pairs.append((score, i, j))
    used_t, used_h = set(), set()
    for score, i, j in sorted(pairs, reverse=True):
        if score < 0.3 or i in used_t or j in used_h:
            continue
        texts[i].update(text=hints[j], ocrText=texts[i]["text"], suspect=False, ocr="hint", hintScore=round(score, 2), hintIndex=j)
        used_t.add(i)
        used_h.add(j)
    # Remaining script lines go to remaining bubbles, monotonic in reading order between matched anchors.
    left_h = [j for j in range(len(hints)) if j not in used_h]
    for j in left_h:
        prev_t = max([i for i in used_t if texts[i].get("hintIndex", -1) < j] or [-1])
        nxt = [i for i in used_t if texts[i].get("hintIndex", 1 << 30) > j]
        next_t = min(nxt) if nxt else len(texts)
        cand = [i for i in range(prev_t + 1, next_t) if i not in used_t and texts[i].get("isBubble")]
        if cand:
            i = cand[0]
            texts[i].update(text=hints[j], ocrText=texts[i]["text"], ocr="hint-order", suspect=True, hintIndex=j)
            used_t.add(i)
    for i, t in enumerate(texts):   # generated page: a bubble with no script line is not ours to rewrite
        if i not in used_t:
            t.update(unmatched=True)
    return texts


# ---------------------------------------------------------------- erase
def erase_block(rgb, mask, bubble, is_bubble, use_lama=True):
    """Erase text inside `bubble` bbox in-place; returns engine name."""
    cv2, np = _np()
    from PIL import Image
    x, y, bw, bh = bubble
    pad = 6
    h, w = mask.shape
    X0, Y0, X1, Y1 = max(0, x - pad), max(0, y - pad), min(w, x + bw + pad), min(h, y + bh + pad)
    src = rgb[Y0:Y1, X0:X1]
    m = mask[Y0:Y1, X0:X1]
    if (m > 0).sum() < 4:
        return "none"
    if is_bubble:
        from manga_bubble_fill import detect_and_fill
        out, meta = detect_and_fill(Image.fromarray(src), Image.fromarray(m))
        if out is not None:
            rgb[Y0:Y1, X0:X1] = np.array(out)
            return "bubble-fill"
    if use_lama:
        try:
            from manga_lama_inpaint import get_model, compose_masked, manga_cached
            if manga_cached():
                _name, model = get_model(False, "auto")
                gen = model(Image.fromarray(src), Image.fromarray(m))
                rgb[Y0:Y1, X0:X1] = np.array(compose_masked(Image.fromarray(src), gen, Image.fromarray(m)))
                return "lama-manga"
        except Exception:
            pass
    rgb[Y0:Y1, X0:X1] = cv2.inpaint(np.ascontiguousarray(src), m, 5, cv2.INPAINT_TELEA)
    return "opencv-telea"


def safe_rect(gray, box, bubble):
    """Largest-ish axis-aligned rectangle inside the bubble interior (grown from the deepest point)."""
    cv2, np = _np()
    inner = bubble_interior(gray, box, bubble)
    if inner.sum() < 16:
        return None
    dist = cv2.distanceTransform(inner, cv2.DIST_L2, 3)
    cy, cx = np.unravel_index(int(dist.argmax()), dist.shape)
    x0 = x1 = int(cx); y0 = y1 = int(cy)
    H, W = inner.shape
    grew = True
    while grew:
        grew = False
        if x0 > 0 and inner[y0:y1 + 1, x0 - 1].all(): x0 -= 1; grew = True
        if x1 < W - 1 and inner[y0:y1 + 1, x1 + 1].all(): x1 += 1; grew = True
        if y0 > 0 and inner[y0 - 1, x0:x1 + 1].all(): y0 -= 1; grew = True
        if y1 < H - 1 and inner[y1 + 1, x0:x1 + 1].all(): y1 += 1; grew = True
    bx, by = bubble[0], bubble[1]
    pad = 3
    return [int(bx + x0 + pad), int(by + y0 + pad), int(max(4, x1 - x0 - 2 * pad)), int(max(4, y1 - y0 - 2 * pad))]


def order_texts(texts, panels, rtl=False):
    def key(t):
        x, y, w, h = t["bbox"]
        return (t["panel"] if t["panel"] >= 0 else 999, y // 40, -x if rtl else x)
    return sorted(texts, key=key)


def fit_font(text, bubble, vertical):
    n = max(1, len("".join((text or "").split())))
    x, y, w, h = bubble
    iw, ih = w, h
    long_side, short_side = (ih, iw) if vertical else (iw, ih)
    best = 12
    for s in range(12, 80):
        per_line = max(1, int(long_side // s))
        lines = -(-n // per_line)
        if lines * s * 1.15 > short_side:
            break
        best = s
    return best


# ---------------------------------------------------------------- page
def decompose_array(rgb, mask=None, session=None, use_manga_ocr=False, use_lama=True, rtl=False, hints=None, use_lama_for_art=False):
    cv2, np = _np()
    h, w = rgb.shape[:2]
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    panels = detect_panels(gray)
    if rtl:
        panels = order_panels(panels, rtl=True)
    if mask is None:
        from manga_text_detector import text_mask_array
        mask, _boxes = text_mask_array(rgb, session)
    blocks = _group_text(mask, None, w, h)
    texts = []
    for b in blocks:   # pass 1: detect + read, nothing written yet
        bw, bh = b[2] - b[0], b[3] - b[1]
        vertical = bh > bw * 1.4
        bubble, is_bubble = find_bubble(gray, b)
        text, conf, engine, suspect = read_text(rgb, b, vertical, use_manga_ocr)
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        pi = next((i for i, p in enumerate(panels)
                   if cv2.pointPolygonTest(np.array(p["polygon"], np.int32), (cx, cy), False) >= 0), -1)
        safe = safe_rect(gray, b, bubble) if is_bubble else None
        texts.append({"bbox": [b[0], b[1], bw, bh], "_box": b, "bubble": bubble, "safe": safe, "isBubble": bool(is_bubble),
                      "vertical": bool(vertical), "text": text, "confidence": round(conf, 1), "ocr": engine,
                      "suspect": bool(suspect), "panel": pi})
    texts = order_texts(texts, panels, rtl)
    if hints:
        apply_hints(texts, hints)
    # Protect mask: panel frame lines (never repainted).
    protect = np.zeros((h, w), np.uint8)
    for p in panels:
        cv2.polylines(protect, [np.array(p["polygon"], np.int32)], True, 1, max(5, int(min(h, w) * 0.008)))
    protect &= (gray < 200).astype(np.uint8)
    cleaned = rgb.copy()
    for t in texts:   # pass 2: erase only what will be re-lettered
        b, bubble = t.pop("_box"), t["bubble"]
        keep = (t.get("unmatched") or is_garbled(t["text"]) or (t["suspect"] and t["ocr"] not in ("hint", "hint-order")))
        if keep and not (t["isBubble"] and not hints and not is_garbled(t["text"])):
            t["erase"] = "skipped"   # garbled / non-CJK / unmatched: leave the art untouched, no text layer
            continue
        if t["isBubble"]:
            inner = bubble_interior(gray, b, bubble)
            x, y, bw2, bh2 = bubble
            region = cleaned[y:y + bh2, x:x + bw2]
            g = gray[y:y + bh2, x:x + bw2]
            paper_px = region[(inner > 0) & (g >= 238)]
            paper = np.median(paper_px, axis=0) if len(paper_px) else np.array([255, 255, 255])
            near = np.zeros_like(inner)
            px0, py0 = max(0, b[0] - x - 4), max(0, b[1] - y - 4)
            near[py0:b[3] - y + 4, px0:b[2] - x + 4] = 1
            # only repaint ink (incl. anti-aliased edges); paper pixels stay byte-identical
            region[(inner > 0) & (near > 0) & (np.abs(region.astype(int) - paper).sum(2) > 12)] = paper.astype(np.uint8)
            t["erase"] = "bubble-paper"
        elif use_lama_for_art or (not t["suspect"] and sum(1 for ch in t["text"] if _has_cjk(ch)) >= 2):
            sub = np.zeros_like(mask)
            sub[b[1]:b[3], b[0]:b[2]] = mask[b[1]:b[3], b[0]:b[2]]
            t["erase"] = erase_block(cleaned, sub, bubble, False, use_lama)
        else:
            t["erase"] = "skipped"
    changed = (cleaned != rgb).any(2) & (protect > 0)
    cleaned[changed] = rgb[changed]
    for t in texts:
        t["layer"] = t["erase"] != "skipped" and not is_garbled(t["text"])
        t["fontSize"] = fit_font(t["text"], t["safe"] or (t["bubble"] if t["isBubble"] else t["bbox"]), t["vertical"])
    return {"width": w, "height": h, "panels": panels, "texts": texts, "cleaned": cleaned, "mask": mask}


from collections import OrderedDict
_CACHE = OrderedDict()


def decompose(image_url, allow_download=False, use_manga_ocr=None, rtl=False, hints=None):
    from manga_smart_ocr import read_image
    from manga_model_guard import exclusive, manga_ocr_cached
    from PIL import Image
    _cv2, np = _np()
    raw, w, h = read_image(image_url)
    if w * h > MAX_PIXELS:
        raise SmartOcrError("整页拆解最多 420 万像素，请先缩小图片。", 413)
    # Cache by image SHA-256 + parameters: an edited image never reuses an old result.
    import hashlib, json
    key = hashlib.sha256(raw + json.dumps([bool(use_manga_ocr), bool(rtl), list(hints or [])], ensure_ascii=False).encode("utf-8")).hexdigest()
    if key in _CACHE:
        _CACHE.move_to_end(key)
        return dict(_CACHE[key], cached=True)
    rgb = np.array(Image.open(io.BytesIO(raw)).convert("RGB"))
    from manga_text_detector import _get_session, text_mask_array
    with exclusive("ctd", wait=90):
        mask, _ = text_mask_array(rgb, _get_session(allow_download))
    if use_manga_ocr is None:
        use_manga_ocr = False
    res = decompose_array(rgb, mask=mask, use_manga_ocr=bool(use_manga_ocr and manga_ocr_cached()), rtl=rtl, hints=hints)
    buf = io.BytesIO()
    Image.fromarray(res.pop("cleaned")).save(buf, "PNG")
    res.pop("mask")
    res["cleaned"] = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
    res["ok"] = True
    res["warning"] = "自动拆解结果需人工确认：黄色标记的文字可能识别错误。"
    res["sha256"] = key
    _CACHE[key] = res
    while len(_CACHE) > 6:
        _CACHE.popitem(last=False)
    return dict(res, cached=False)
