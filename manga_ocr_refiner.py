"""Optional Japanese manga OCR *recognition*, on a human-selected local crop.

Upstream engine: kha-white/manga-ocr. We call its documented MangaOcr(PIL.Image)
interface without copying model source/weights. No full-page bbox detection here.
Model (~400 MB) may be downloaded by manga-ocr on the first EXPLICIT user click;
ordinary Tesseract OCR does not import or initialize this package unless the caller
opts into post-detect refine (and weights are already cached, or allow_download).
"""
import importlib
import importlib.util
import io
import threading

from manga_smart_ocr import read_image, SmartOcrError
from manga_model_guard import exclusive, require_download_consent

_model = None
_model_lock = threading.RLock()


def package_ready():
    try:
        return importlib.util.find_spec("manga_ocr") is not None
    except (ImportError, ValueError):
        return False


def get_model(allow_download=False):
    global _model
    with _model_lock:
        if _model is None:
            try:
                engine = importlib.import_module("manga_ocr")
            except (ImportError, OSError) as exc:
                raise SmartOcrError(
                    "未安装 Manga OCR。请在本地 Python 环境执行 pip install manga-ocr；"
                    "首次使用还需下载约 400MB 的模型。", 503
                ) from exc
            # Installed but weights not cached: ask the user before MangaOcr() downloads.
            require_download_consent("manga-ocr", False, allow_download)
            try:
                # Do not let web input supply a model or arbitrary download URL.
                _model = engine.MangaOcr()
            except Exception as exc:
                raise SmartOcrError(
                    "Manga OCR 模型初始化失败，请检查本机模型缓存、网络与依赖版本。"
                    "首用下载约 400MB，之后可从缓存离线运行。", 503
                ) from exc
        return _model


def decode_image(raw, width, height):
    if width * height > 4_000_000:
        raise SmartOcrError("Manga OCR 选区不得超过 400 万像素，请缩小框选区域。", 413)
    try:
        image_module = importlib.import_module("PIL.Image")
    except (ImportError, OSError) as exc:
        raise SmartOcrError("未安装 Pillow，请在本机运行 pip install Pillow。", 503) from exc
    try:
        image = image_module.open(io.BytesIO(raw))
        if image.format != "PNG" or image.size != (width, height):
            raise SmartOcrError("图片格式或尺寸校验失败。")
        image.load()
        return image.convert("RGB")
    except (OSError, ValueError) as exc:
        if isinstance(exc, SmartOcrError):
            raise
        raise SmartOcrError("选区图片无法解码。") from exc


def _recognize(model, image):
    text = model(image)
    if not isinstance(text, str) or not text.strip() or len(text) > 500:
        return None
    return text.strip()



def warm(allow_download=False):
    """Load manga-ocr into memory when weights are already cached (no download prompt).

    Safe to call from a background warm endpoint; raises 428 if weights are missing
    and allow_download is false.
    """
    from manga_model_guard import manga_ocr_cached
    if not package_ready():
        raise SmartOcrError(
            "未安装 Manga OCR。请在本地 Python 环境执行 pip install manga-ocr。", 503)
    if not allow_download and not manga_ocr_cached():
        raise SmartOcrError("Manga OCR 模型尚未下载。", 428)
    with exclusive("manga-ocr"):
        get_model(allow_download)
    return {"ok": True, "engine": "manga-ocr-local", "warmed": True}

def refine_region(image_url, allow_download=False):
    data, width, height = read_image(image_url)
    if width * height > 4_000_000 or width < 2 or height < 2:
        raise SmartOcrError("Manga OCR 选区无效或超过 400 万像素上限。", 413)
    image = decode_image(data, width, height)
    with exclusive("manga-ocr"):
        model = get_model(allow_download)
        try:
            # The model's underlying transformer is not guaranteed thread-safe.
            with _model_lock:
                text = _recognize(model, image)
        except Exception as exc:
            if isinstance(exc, SmartOcrError):
                raise
            raise SmartOcrError("Manga OCR 推理失败；请检查本机可用内存与模型安装。", 502) from exc
    if text is None:
        raise SmartOcrError("Manga OCR 未返回有效短文本，请重新框选或手动修改。", 422)
    return {
        "ok": True, "engine": "manga-ocr-local",
        "width": width, "height": height,
        "text": text, "verified": False,
        "warning": "Manga OCR 只识别用户给定选区，不检测气泡边界；可能产生幻觉，请人工校对。"
    }


def _looks_suspect(text, confidence=0, vertical=False):
    """Cheap UI flag: likely garbage / truncated OCR the user should check.

    Does not drop the region — only marks it for yellow highlight in the panel.
    """
    compact = "".join((text or "").split())
    if not compact:
        return True
    # Very low Tesseract confidence (manga-ocr leaves confidence at 0 after refine).
    if confidence and confidence < 35:
        return True
    # Latin/digit soup or symbol-heavy fragments after refine often mean a bad crop.
    cjk = sum(1 for ch in compact if ("぀" <= ch <= "ヿ") or ("㐀" <= ch <= "鿿")
              or ("ｦ" <= ch <= "ﾝ") or ("가" <= ch <= "힯"))
    if cjk == 0 and len(compact) >= 2:
        return True
    if cjk and (len(compact) - cjk) / len(compact) > 0.55 and len(compact) >= 3:
        return True
    # Vertical bubble with a single wide glyph string of punctuation-like dots only.
    if vertical and len(compact) <= 2 and all(ch in "．.、…・·" for ch in compact):
        return True
    return False


def _pad_box(reg, page_w, page_h):
    w = max(1, int(reg.get("width") or 0))
    h = max(1, int(reg.get("height") or 0))
    x = int(reg.get("x") or 0)
    y = int(reg.get("y") or 0)
    vertical = bool(reg.get("vertical")) or (h > w * 1.35)
    if vertical:
        # Tall/narrow vertical bubbles: extra side pad so edge glyphs are not clipped.
        pad_x = max(14, round(w * 0.48))
        pad_y = max(8, round(h * 0.14))
    else:
        pad_x = max(10, round(w * 0.22))
        pad_y = max(10, round(h * 0.40))
    left = max(0, x - pad_x)
    top = max(0, y - pad_y)
    right = min(page_w, x + w + pad_x)
    bottom = min(page_h, y + h + pad_y)
    if right - left < 2 or bottom - top < 2:
        return None
    if (right - left) * (bottom - top) > 4_000_000:
        return None
    return left, top, right, bottom


def refine_page_regions(png_bytes, width, height, regions, allow_download=False):
    """Re-recognize each detection crop with manga-ocr (same padding as the UI button).

    Returns (regions, refined_count). Failed crops keep the Tesseract text.
    Raises SmartOcrError(428) when weights are missing and allow_download is false.
    """
    if not regions:
        return [], 0
    image_module = importlib.import_module("PIL.Image")
    page = image_module.open(io.BytesIO(png_bytes))
    page.load()
    page = page.convert("RGB")
    if page.size != (width, height):
        raise SmartOcrError("页面尺寸与 OCR 结果不一致。")
    out = []
    refined = 0
    with exclusive("manga-ocr"):
        model = get_model(allow_download)
        with _model_lock:
            for reg in regions:
                box = _pad_box(reg, width, height)
                item = dict(reg)
                if box is None:
                    out.append(item)
                    continue
                try:
                    text = _recognize(model, page.crop(box))
                except Exception:
                    text = None
                if text:
                    item["originalText"] = reg.get("text")
                    item["text"] = text[:500]
                    item["recognizer"] = "manga-ocr-local"
                    item["confidence"] = 0
                    refined += 1
                iw = max(1, int(item.get("width") or 0))
                ih = max(1, int(item.get("height") or 0))
                item["suspect"] = _looks_suspect(
                    item.get("text"), item.get("confidence") or 0,
                    bool(item.get("vertical")) or (ih > iw * 1.35))
                out.append(item)
    return out, refined


def _reset_for_tests():
    global _model
    with _model_lock:
        _model = None
