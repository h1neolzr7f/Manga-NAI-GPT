"""Opt-in local LaMa inpainting with a user-visible mask and preview.

Upstream: enesmsahin/simple-lama-inpainting (PyPI ``simple-lama-inpainting``, module
``simple_lama_inpainting``), documented SimpleLama()(PIL image, PIL L mask).

Engines:
* ``bubble`` — deterministic speech-bubble paper fill (no neural net).
* ``lama`` — stock big-lama.pt (~200MB), default SimpleLama download.
* ``lama-manga`` — anime/manga-finetuned TorchScript weights (df1412/anime-big-lama,
  MIT; ~196MB), SHA-256 pinned, downloaded only after allow_download consent.
* ``auto`` — try bubble fill first; on failure prefer lama-manga when cached, else stock lama.

No external API credentials or editable filesystem path from the HTTP caller.
Heavy optional model only initialized on the first explicit preview request.
"""
import base64
import hashlib
import importlib
import io
import os
import threading
import urllib.request

from manga_smart_ocr import read_image, SmartOcrError
from manga_model_guard import exclusive, require_download_consent

# The PyPI package is simple-lama-inpainting; "simple_lama" kept for older local installs.
LAMA_MODULES = ("simple_lama_inpainting", "simple_lama")

# Anime/manga-finetuned Big-LaMa TorchScript (MIT). Same interface as big-lama.pt.
MANGA_MODEL_URL = "https://huggingface.co/df1412/anime-big-lama/resolve/main/anime-manga-big-lama.pt"
MANGA_MODEL_SHA256 = "479d3afdcb7ed2fd944ed4ebcc39ca45b33491f0f2e43eb1000bd623cfb41823"
MANGA_MODEL_BYTES = 205717870

MAX_CROP_PIXELS = 3_000_000
MAX_MASK_PERCENT = .66
_models = {}  # engine -> SimpleLama instance
_lock = threading.RLock()

ENGINES = frozenset(("lama", "lama-manga", "auto", "bubble"))


def _import_upstream():
    last = None
    for name in LAMA_MODULES:
        try:
            return importlib.import_module(name)
        except (ImportError, OSError) as exc:
            last = exc
    raise SmartOcrError(
        "未安装本地 LaMa。请在启动程序的 Python 环境中运行 "
        "pip install simple-lama-inpainting；首次使用需确认后下载约 200MB 模型。", 503
    ) from last


def manga_weights_path():
    from manga_bundle import bundled_file, prefer
    explicit = (os.environ.get("LAMA_MANGA_MODEL") or "").strip()
    torch_home = os.environ.get("TORCH_HOME") or os.path.join(
        os.environ.get("XDG_CACHE_HOME") or os.path.join("~", ".cache"), "torch")
    cache = os.path.abspath(os.path.expanduser(
        os.path.join(torch_home, "hub", "checkpoints", "anime-manga-big-lama.pt")))
    return prefer(explicit, bundled_file("anime-manga-big-lama.pt"), cache)


def manga_cached():
    path = manga_weights_path()
    return os.path.isfile(path) and os.path.getsize(path) == MANGA_MODEL_BYTES


def _sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download_manga(url=MANGA_MODEL_URL, opener=urllib.request.urlopen):
    target = manga_weights_path()
    os.makedirs(os.path.dirname(target), exist_ok=True)
    tmp = target + ".part"
    try:
        with opener(url, timeout=180) as r, open(tmp, "wb") as f:
            from manga_model_guard import tracked_copy
            tracked_copy(r, f, os.path.basename(target))
        if _sha256(tmp) != MANGA_MODEL_SHA256:
            raise SmartOcrError("漫画 LaMa 模型下载内容校验失败（SHA-256 不符），已删除，没有使用。", 502)
        if os.path.getsize(tmp) != MANGA_MODEL_BYTES:
            raise SmartOcrError("漫画 LaMa 模型大小不符，已删除，没有使用。", 502)
        os.replace(tmp, target)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    return target


def resolve_engine(engine):
    name = (engine or "auto").strip().lower()
    if name not in ENGINES:
        raise SmartOcrError("不支持的 LaMa 引擎：" + str(engine))
    if name == "auto":
        return "lama-manga" if manga_cached() else "lama"
    return name


def _load_simple_lama(weights_path=None):
    """Instantiate upstream SimpleLama, optionally pointing at a local TorchScript file."""
    upstream = _import_upstream()
    if not weights_path:
        return upstream.SimpleLama()
    old = os.environ.get("LAMA_MODEL")
    os.environ["LAMA_MODEL"] = weights_path
    try:
        return upstream.SimpleLama()
    finally:
        if old is None:
            os.environ.pop("LAMA_MODEL", None)
        else:
            os.environ["LAMA_MODEL"] = old


def get_model(allow_download=False, engine="lama"):
    chosen = resolve_engine(engine)
    with _lock:
        if chosen in _models and _models[chosen] is not None:
            return chosen, _models[chosen]
        # Importability before consent: missing pip package must be 503, not a download prompt.
        _import_upstream()
        if chosen == "lama-manga":
            require_download_consent("lama-manga", False, allow_download)
            if not manga_cached():
                download_manga()
            elif _sha256(manga_weights_path()) != MANGA_MODEL_SHA256:
                raise SmartOcrError(
                    "本机的漫画 LaMa 模型文件校验不通过，请删除后重新下载：" + manga_weights_path(), 500)
            try:
                _models[chosen] = _load_simple_lama(manga_weights_path())
            except SmartOcrError:
                raise
            except Exception as exc:
                raise SmartOcrError("漫画 LaMa 模型初始化失败；请检查依赖、模型缓存和可用内存。", 503) from exc
        else:
            require_download_consent("lama", False, allow_download)
            try:
                from manga_bundle import bundled_file
                bundled = bundled_file("big-lama.pt")
                use = bundled if bundled and not (os.environ.get("LAMA_MODEL") or "").strip() else None
                _models[chosen] = _load_simple_lama(use)
            except SmartOcrError:
                raise
            except Exception as exc:
                raise SmartOcrError("LaMa 模型初始化失败；请检查依赖、模型缓存和可用内存。", 503) from exc
        return chosen, _models[chosen]


def decode_pair(image_bytes, mask_bytes, width, height):
    try:
        im = importlib.import_module("PIL.Image")
    except (ImportError, OSError) as exc:
        raise SmartOcrError("本地 LaMa 需要 Pillow，请先安装 Pillow。", 503) from exc
    try:
        source = im.open(io.BytesIO(image_bytes))
        mask = im.open(io.BytesIO(mask_bytes))
        if source.format != "PNG" or mask.format != "PNG" or source.size != (width, height) or mask.size != (width, height):
            raise SmartOcrError("LaMa 原图和蒙版必须是相同尺寸的 PNG。")
        source.load()
        mask.load()
        source = source.convert("RGB")
        mask = mask.convert("L")
    except (OSError, ValueError) as exc:
        if isinstance(exc, SmartOcrError):
            raise
        raise SmartOcrError("LaMa 原图或蒙版无法解码。") from exc
    return source, mask


def compose_masked(source, generated, mask):
    im = importlib.import_module("PIL.Image")
    gw, gh = generated.size
    sw, sh = source.size
    # simple-lama-inpainting pads bottom/right to a multiple of 8 and returns the padded
    # result; crop that padding back off. Any other size mismatch is still rejected.
    if (gw, gh) != (sw, sh) and sw <= gw < sw + 8 and sh <= gh < sh + 8:
        generated = generated.crop((0, 0, sw, sh))
    if generated.size != source.size:
        raise SmartOcrError("LaMa 修复图尺寸不一致，已拒绝。", 502)
    generated = match_tone(source, generated.convert("RGB"), mask)
    # Even if the model alters every pixel, restore everything outside mask.
    return im.composite(generated, source, mask)


MAX_TONE_SHIFT = 24
SNAP_TOLERANCE = 6


def match_tone(source, generated, mask):
    """Remove the model's global tone drift (real LaMa: 253/254 on pure white bubbles,
    a faint visible box). Measured on a ring just OUTSIDE the mask, where the model
    should reproduce the source; ignored when the shift exceeds MAX_TONE_SHIFT."""
    filt = importlib.import_module("PIL.ImageFilter")
    chops = importlib.import_module("PIL.ImageChops")
    stat = importlib.import_module("PIL.ImageStat")
    hard = mask.point(lambda v: 255 if v >= 128 else 0)
    ring = chops.subtract(hard.filter(filt.MaxFilter(9)), hard)
    if not ring.getbbox():
        return generated
    ring_stat = stat.Stat(source, ring)
    src = ring_stat.mean
    gen = stat.Stat(generated, ring).mean
    shift = [round(a - b) for a, b in zip(src, gen)]
    if max(abs(v) for v in shift) > MAX_TONE_SHIFT:
        return generated
    # Flat paper (uniform ring, e.g. a white bubble): snap near-paper pixels to the exact
    # paper colour so no faint box remains; lines/content further away are untouched.
    flat = max(ring_stat.stddev) <= 1.5
    paper = [round(v) for v in src]

    def lut(d, c):
        table = []
        for v in range(256):
            v = max(0, min(255, v + d))
            table.append(c if flat and abs(v - c) <= SNAP_TOLERANCE else v)
        return table

    if not any(shift) and not flat:
        return generated
    bands = [band.point(lut(d, c)) for band, d, c in zip(generated.split(), shift, paper)]
    return importlib.import_module("PIL.Image").merge("RGB", bands)



def _soften_mask(mask, pad_px=2):
    """Expand the inpaint mask by a few pixels so hard edges near strokes blend better.

    Cheap MaxFilter; keeps coverage under the existing percent cap (caller re-checks).
    """
    try:
        from PIL import ImageFilter
        size = max(3, int(pad_px) * 2 + 1)
        return mask.filter(ImageFilter.MaxFilter(size))
    except Exception:
        return mask


def inpaint(image_url, mask_url, allow_download=False, engine="auto"):
    raw, w, h = read_image(image_url)
    mask_raw, mw, mh = read_image(mask_url)
    if w != mw or h != mh or w * h > MAX_CROP_PIXELS:
        raise SmartOcrError("LaMa 原图和蒙版尺寸必须一致且不超过 300 万像素。", 413)
    source, mask = decode_pair(raw, mask_raw, w, h)
    covered = sum(v >= 128 for v in mask.getdata())
    if covered < 4 or covered / (w * h) > MAX_MASK_PERCENT:
        raise SmartOcrError("去字蒙版为空或超过区域的 66%，请缩小蒙版。")

    name = (engine or "auto").strip().lower()
    if name not in ENGINES:
        raise SmartOcrError("不支持的 LaMa 引擎：" + str(engine))

    # Deterministic bubble paper fill first (auto / bubble). Soften only for neural path.
    if name in ("auto", "bubble"):
        from manga_bubble_fill import detect_and_fill
        filled, meta = detect_and_fill(source, mask)
        if filled is not None:
            out = io.BytesIO()
            filled.save(out, format="PNG")
            if out.tell() > 12 * 1024 * 1024:
                raise SmartOcrError("修复图超过 12MB 限制。", 413)
            return {
                "ok": True, "engine": "bubble-fill-local", "engineName": "bubble",
                "width": w, "height": h,
                "image": "data:image/png;base64," + base64.b64encode(out.getvalue()).decode("ascii"),
                "applied": False, "verified": False,
                "paper": meta.get("paper"), "paperStd": meta.get("paperStd"),
                "maskInBubble": meta.get("maskInBubble"),
                "warning": "气泡填底色预览未修改原画。纯色气泡内的字已涂成气泡纸色；描边保留。请人工确认后再添加图层。",
            }
        if name == "bubble":
            raise SmartOcrError(
                "这块不像纯色气泡内的字（" + str(meta.get("reason") or "不适用") +
                "）。请改用自动 / 漫画 LaMa，或收紧蒙版只盖住气泡里的字。", 422)

    mask = _soften_mask(mask, 2)
    covered = sum(v >= 128 for v in mask.getdata())
    if covered < 4 or covered / (w * h) > MAX_MASK_PERCENT:
        raise SmartOcrError("去字蒙版为空或超过区域的 66%，请缩小蒙版。")
    with exclusive("lama"):
        chosen, model = get_model(allow_download, "auto" if name == "auto" else name)
        try:
            with _lock:
                generated = model(source, mask)
            composite = compose_masked(source, generated, mask)
            out = io.BytesIO()
            composite.save(out, format="PNG")
        except SmartOcrError:
            raise
        except Exception as exc:
            raise SmartOcrError("LaMa 修复失败；请检查模型配置、内存或缩小选区。", 502) from exc
    if out.tell() > 12 * 1024 * 1024:
        raise SmartOcrError("修复图超过 12MB 限制。", 413)
    engine_id = "simple-lama-manga-local" if chosen == "lama-manga" else "simple-lama-local"
    warning = (
        "本地漫画微调 LaMa 预览未修改原画。请人工检查是否误删衣服、边线或拟声词，然后决定是否添加图层。"
        if chosen == "lama-manga" else
        "本地 LaMa 预览未修改原画。请人工检查是否误删衣服、边线或拟声词，然后决定是否添加图层。"
    )
    return {
        "ok": True, "engine": engine_id, "engineName": chosen,
        "width": w, "height": h,
        "image": "data:image/png;base64," + base64.b64encode(out.getvalue()).decode("ascii"),
        "applied": False, "verified": False,
        "warning": warning,
    }


def _reset_for_tests():
    with _lock:
        _models.clear()
