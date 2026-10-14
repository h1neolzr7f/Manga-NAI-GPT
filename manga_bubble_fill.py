"""Fast deterministic speech-bubble text removal (no neural net).

When lettering sits on a near-uniform bubble interior, flood-fill the paper,
dilate the text mask, and paint the median paper colour. Bubble outlines and
artwork outside the bubble are left untouched. Callers fall back to LaMa when
this returns None (SFX on art, textured / shaded bubbles, etc.).
"""
import io
from collections import deque

from manga_smart_ocr import SmartOcrError

# Paper must be this bright (luma) to count as bubble fill.
PAPER_MIN_LUMA = 210
# Max channel stddev of non-ink paper samples inside the bubble.
PAPER_MAX_STD = 14.0
# Flood-fill accepts pixels within this luma distance of the seed paper.
PAPER_LUMA_SLACK = 28
# At least this share of the user mask must land on / next to bubble paper.
MASK_IN_BUBBLE_MIN = 0.55
# Dilate the ink mask by this many pixels before painting.
INK_DILATE = 2
# Skip dark outline / screentone when sampling paper (luma below this).
INK_LUMA = 170


def _luma(r, g, b):
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def _median_rgb(samples):
    if not samples:
        return None
    samples = sorted(samples)
    mid = len(samples) // 2
    if len(samples) % 2:
        return samples[mid]
    a, b = samples[mid - 1], samples[mid]
    return tuple((a[i] + b[i]) // 2 for i in range(3))


def _stddev_rgb(samples, mean):
    if len(samples) < 2:
        return 0.0
    acc = 0.0
    for s in samples:
        for i in range(3):
            d = s[i] - mean[i]
            acc += d * d
    return (acc / (len(samples) * 3)) ** 0.5


def _dilate_mask(mask, radius, w, h):
    if radius <= 0:
        return bytearray(mask)
    out = bytearray(mask)
    for y in range(h):
        for x in range(w):
            if not mask[y * w + x]:
                continue
            for yy in range(max(0, y - radius), min(h, y + radius + 1)):
                for xx in range(max(0, x - radius), min(w, x + radius + 1)):
                    out[yy * w + xx] = 1
    return out


def detect_and_fill(source, mask):
    """Try bubble-paper fill.

    source: PIL RGB Image
    mask: PIL L Image (white = erase)
    Returns (RGB Image, meta) on success, or (None, reason_dict).
    """
    try:
        from PIL import Image
    except ImportError as exc:
        raise SmartOcrError("气泡去字需要 Pillow。", 503) from exc

    source = source.convert("RGB")
    mask = mask.convert("L")
    if source.size != mask.size:
        return None, {"ok": False, "reason": "size-mismatch"}
    w, h = source.size
    if w * h > 3_000_000:
        return None, {"ok": False, "reason": "too-large"}

    src = source.load()
    mdata = mask.load()
    mask_bin = bytearray(w * h)
    mask_count = 0
    for y in range(h):
        for x in range(w):
            if mdata[x, y] >= 128:
                mask_bin[y * w + x] = 1
                mask_count += 1
    if mask_count < 4:
        return None, {"ok": False, "reason": "empty-mask"}

    # Seeds: bright unmasked pixels adjacent to the mask (bubble paper next to ink).
    seeds = []
    for y in range(h):
        for x in range(w):
            i = y * w + x
            if not mask_bin[i]:
                continue
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if nx < 0 or ny < 0 or nx >= w or ny >= h:
                    continue
                j = ny * w + nx
                if mask_bin[j]:
                    continue
                r, g, b = src[nx, ny]
                if _luma(r, g, b) >= PAPER_MIN_LUMA:
                    seeds.append((nx, ny))
    if len(seeds) < 8:
        return None, {"ok": False, "reason": "no-paper-seed", "seeds": len(seeds)}

    # Seed paper colour = median of seed pixels.
    seed_colors = [src[x, y] for x, y in seeds]
    paper0 = _median_rgb(seed_colors)
    paper_luma = _luma(*paper0)

    # Keep the paper flood near the text mask so bright rain/sfx outside the bubble cannot
    # leak the fill across the page (crop often has white rain touching the oval).
    mx0 = my0 = 10**9
    mx1 = my1 = 0
    for y in range(h):
        for x in range(w):
            if mask_bin[y * w + x]:
                mx0 = min(mx0, x); my0 = min(my0, y)
                mx1 = max(mx1, x); my1 = max(my1, y)
    pad = max(24, int(0.35 * max(mx1 - mx0 + 1, my1 - my0 + 1)))
    bx0, by0 = max(0, mx0 - pad), max(0, my0 - pad)
    bx1, by1 = min(w - 1, mx1 + pad), min(h - 1, my1 + pad)

    # Flood-fill paper region from seeds (4-connected, luma near paper, not dark ink).
    bubble = bytearray(w * h)
    q = deque()
    seen = bytearray(w * h)
    for x, y in seeds:
        j = y * w + x
        if seen[j]:
            continue
        seen[j] = 1
        q.append((x, y))
    while q:
        x, y = q.popleft()
        j = y * w + x
        r, g, b = src[x, y]
        lum = _luma(r, g, b)
        # Masked (ink) pixels are treated as holes inside the bubble — mark them
        # as bubble-covered so the fill stays enclosed, but do not expand through them.
        if mask_bin[j]:
            bubble[j] = 1
            continue
        if lum < PAPER_MIN_LUMA - 15 or abs(lum - paper_luma) > PAPER_LUMA_SLACK:
            continue
        # Reject strong chromatic deviation from seed paper (keeps out tinted art).
        if abs(r - paper0[0]) > 36 or abs(g - paper0[1]) > 36 or abs(b - paper0[2]) > 36:
            continue
        bubble[j] = 1
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < bx0 or ny < by0 or nx > bx1 or ny > by1:
                continue
            k = ny * w + nx
            if not seen[k]:
                seen[k] = 1
                q.append((nx, ny))

    # Ink is a hole in the paper: flood through the mask from edges that already touch
    # paper, but ONLY through dark ink / near-paper AA — never through midtone art the
    # user accidentally included in a loose mask (trees, screentone, etc.).
    hq = deque()
    for y in range(h):
        for x in range(w):
            j = y * w + x
            if mask_bin[j] and bubble[j]:
                hq.append((x, y))
    while hq:
        x, y = hq.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if nx < 0 or ny < 0 or nx >= w or ny >= h:
                continue
            k = ny * w + nx
            if not mask_bin[k] or bubble[k]:
                continue
            r, g, b = src[nx, ny]
            lum = _luma(r, g, b)
            near_paper = abs(lum - paper_luma) <= PAPER_LUMA_SLACK and abs(r - paper0[0]) <= 36
            if lum <= INK_LUMA or near_paper:
                bubble[k] = 1
                hq.append((nx, ny))

    bubble_count = sum(bubble)
    if bubble_count < max(30, mask_count // 2):
        return None, {"ok": False, "reason": "bubble-too-small", "bubble": bubble_count}

    # Share of mask that is really on bubble paper / ink (not dark trees covered by a loose mask).
    in_bubble = 0
    for y in range(h):
        for x in range(w):
            j = y * w + x
            if not mask_bin[j] or not bubble[j]:
                continue
            lum = _luma(*src[x, y])
            if lum >= PAPER_MIN_LUMA - 15 or lum <= INK_LUMA:
                # dark: require a paper neighbour within 3px
                if lum <= INK_LUMA:
                    ok = False
                    for yy in range(max(0, y - 8), min(h, y + 9)):
                        for xx in range(max(0, x - 8), min(w, x + 9)):
                            jj = yy * w + xx
                            if bubble[jj] and not mask_bin[jj] and _luma(*src[xx, yy]) >= PAPER_MIN_LUMA - 15:
                                ok = True; break
                        if ok: break
                    if not ok:
                        continue
                in_bubble += 1
    ratio = in_bubble / float(mask_count)
    if ratio < MASK_IN_BUBBLE_MIN:
        return None, {"ok": False, "reason": "mask-outside-bubble", "ratio": round(ratio, 3)}

    # Sample non-ink paper inside bubble for median + uniformity.
    samples = []
    for y in range(h):
        for x in range(w):
            j = y * w + x
            if not bubble[j] or mask_bin[j]:
                continue
            r, g, b = src[x, y]
            if _luma(r, g, b) < INK_LUMA:
                continue  # outline / screentone
            samples.append((r, g, b))
    if len(samples) < 30:
        return None, {"ok": False, "reason": "few-paper-samples", "n": len(samples)}
    paper = _median_rgb(samples)
    std = _stddev_rgb(samples, paper)
    if std > PAPER_MAX_STD:
        return None, {"ok": False, "reason": "paper-not-uniform", "std": round(std, 2)}
    if _luma(*paper) < PAPER_MIN_LUMA:
        return None, {"ok": False, "reason": "paper-too-dark"}

    # Paint: dilated mask ∩ bubble, but never overwrite dark outline pixels that
    # were not in the original mask (keep the bubble stroke).
    # Precompute which pixels sit next to bubble paper (not ink holes).
    near_paper_pix = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            j = y * w + x
            if not bubble[j] or mask_bin[j]:
                continue
            if _luma(*src[x, y]) < PAPER_MIN_LUMA - 15:
                continue
            for yy in range(max(0, y - 8), min(h, y + 9)):
                for xx in range(max(0, x - 8), min(w, x + 9)):
                    near_paper_pix[yy * w + xx] = 1

    paint = _dilate_mask(mask_bin, INK_DILATE, w, h)
    out = source.copy()
    px = out.load()
    painted = 0
    for y in range(h):
        for x in range(w):
            j = y * w + x
            if not paint[j] or not bubble[j]:
                continue
            r, g, b = src[x, y]
            lum = _luma(r, g, b)
            # Preserve unmasked dark outline / art accidentally covered by dilate.
            if not mask_bin[j] and lum < INK_LUMA:
                continue
            paperish = abs(lum - _luma(*paper)) <= PAPER_LUMA_SLACK
            # Dark ink only if it sits next to bubble paper — dark trees in a loose mask do not.
            if not paperish and not (lum <= INK_LUMA and near_paper_pix[j]):
                continue
            px[x, y] = paper
            painted += 1
    if painted < 4:
        return None, {"ok": False, "reason": "nothing-painted"}
    # Loose masks that mostly cover art: we skipped painting trees, so little was fixed —
    # fall back to LaMa rather than return a near-no-op "success".
    if painted < max(20, int(0.25 * mask_count)):
        return None, {"ok": False, "reason": "too-little-painted", "painted": painted, "mask": mask_count}

    meta = {
        "ok": True,
        "engine": "bubble-fill-local",
        "engineName": "bubble",
        "paper": list(paper),
        "paperStd": round(std, 2),
        "maskInBubble": round(ratio, 3),
        "painted": painted,
        "bubblePixels": bubble_count,
    }
    return out, meta


def fill_data_urls(image_url, mask_url):
    """Same contract as manga_lama_inpaint.inpaint, without a neural net."""
    import base64
    from manga_smart_ocr import read_image
    from manga_lama_inpaint import decode_pair, MAX_CROP_PIXELS, MAX_MASK_PERCENT

    raw, w, h = read_image(image_url)
    mask_raw, mw, mh = read_image(mask_url)
    if w != mw or h != mh or w * h > MAX_CROP_PIXELS:
        raise SmartOcrError("气泡去字：原图和蒙版尺寸必须一致且不超过 300 万像素。", 413)
    source, mask = decode_pair(raw, mask_raw, w, h)
    covered = sum(v >= 128 for v in mask.getdata())
    if covered < 4 or covered / (w * h) > MAX_MASK_PERCENT:
        raise SmartOcrError("去字蒙版为空或超过区域的 66%，请缩小蒙版。")
    result, meta = detect_and_fill(source, mask)
    if result is None:
        return {"ok": False, "fallback": True, **meta}
    out = io.BytesIO()
    result.save(out, format="PNG")
    return {
        "ok": True,
        "engine": "bubble-fill-local",
        "engineName": "bubble",
        "width": w,
        "height": h,
        "image": "data:image/png;base64," + base64.b64encode(out.getvalue()).decode("ascii"),
        "applied": False,
        "verified": False,
        "paper": meta.get("paper"),
        "paperStd": meta.get("paperStd"),
        "maskInBubble": meta.get("maskInBubble"),
        "warning": "气泡填底色预览未修改原画。纯色气泡内的字已涂成气泡纸色；描边保留。请人工确认后再添加图层。",
    }
