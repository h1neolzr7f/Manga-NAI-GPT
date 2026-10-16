"""Catalog + resumable download for optional local model weights.

One-click packages only ship the lightest high-value weight (comic-text-detector).
Heavier models (manga LaMa, manga-ocr, SAM, stock LaMa) are listed here so the
settings UI can download them with progress, SHA-256 verify, resume, and
mirror fallback (Hugging Face → hf-mirror, GitHub → ghproxy when needed).
"""
from __future__ import annotations

import hashlib
import os
import threading
import urllib.error
import urllib.request

from manga_smart_ocr import SmartOcrError
from manga_model_guard import progress_start, progress_add, progress_end
from manga_bundle import bundled_file, bundled_dir

# ---- catalog (id -> metadata). sizes are bytes on disk after download. ----
CATALOG = {
    "ctd": {
        "id": "ctd",
        "label": "漫画文字检测",
        "benefit": "去字时精确找出笔画，避免擦到人脸、猫或线稿；气泡填底色不依赖它。",
        "size_bytes": 94669756,
        "size_label": "约 91MB",
        "license": "GPL-3.0",
        "bundle": True,  # shipped in Setup / portable when packaging succeeds
        "filename": "comictextdetector.pt.onnx",
        "sha256": "1a86ace74961413cbd650002e7bb4dcec4980ffa21b2f19b86933372071d718f",
        "urls": [
            "https://github.com/zyddnys/manga-image-translator/releases/download/beta-0.3/comictextdetector.pt.onnx",
            "https://mirror.ghproxy.com/https://github.com/zyddnys/manga-image-translator/releases/download/beta-0.3/comictextdetector.pt.onnx",
        ],
        "cache_key": "ctd",
    },
    "lama-manga": {
        "id": "lama-manga",
        "label": "漫画微调 LaMa",
        "benefit": "去掉杂物 / 画面上的拟声词：漫画线稿补背景更干净。纯色气泡去字优先用气泡填底色，不耗此模型。",
        "size_bytes": 205717870,
        "size_label": "约 196MB",
        "license": "MIT",
        "bundle": False,
        "filename": "anime-manga-big-lama.pt",
        "sha256": "479d3afdcb7ed2fd944ed4ebcc39ca45b33491f0f2e43eb1000bd623cfb41823",
        "urls": [
            "https://huggingface.co/df1412/anime-big-lama/resolve/main/anime-manga-big-lama.pt",
            "https://hf-mirror.com/df1412/anime-big-lama/resolve/main/anime-manga-big-lama.pt",
        ],
        "cache_key": "lama-manga",
    },
    "lama": {
        "id": "lama",
        "label": "通用 LaMa",
        "benefit": "没有漫画微调时的去杂物兜底。体积与漫画版接近，一般优先下漫画版即可。",
        "size_bytes": 205803670,
        "size_label": "约 197MB",
        "license": "Apache-2.0",
        "bundle": False,
        "filename": "big-lama.pt",
        "sha256": "7ba7aa7ac37a4d41fdbbeba3a2af7ead18058552997e3a3cd1a3b2210c9e6b4c",
        "urls": [
            "https://github.com/enesmsahin/simple-lama-inpainting/releases/download/v0.1.0/big-lama.pt",
            "https://mirror.ghproxy.com/https://github.com/enesmsahin/simple-lama-inpainting/releases/download/v0.1.0/big-lama.pt",
        ],
        "cache_key": "lama",
    },
    "sam2": {
        "id": "sam2",
        "label": "智能点选（SAM 2.1 tiny）",
        "benefit": "改一块 / 换角色时点一下选中人物。官方最小 SAM2（约 149MB）；未接 MobileSAM（需另改推理路径）。",
        "size_bytes": 156008466,
        "size_label": "约 149MB",
        "license": "Apache-2.0",
        "bundle": False,
        "filename": "sam2.1_hiera_tiny.pt",
        "sha256": "7402e0d864fa82708a20fbd15bc84245c2f26dff0eb43a4b5b93452deb34be69",
        "urls": [
            "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt",
            "https://mirror.ghproxy.com/https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt",
        ],
        "cache_key": "sam2",
    },
    "manga-ocr": {
        "id": "manga-ocr",
        "label": "Manga OCR 精修",
        "benefit": "日文竖排字幕识别更准。体积大，首次需确认下载；之后离线。",
        "size_bytes": 444135475,
        "size_label": "约 424MB",
        "license": "Apache-2.0",
        "bundle": False,
        "filename": "pytorch_model.bin",
        "sha256": "c63e0bb5b3ff798c5991de18a8e0956c7ee6d1563aca6729029815eda6f5c2eb",
        "urls": [
            "https://huggingface.co/kha-white/manga-ocr-base/resolve/main/pytorch_model.bin",
            "https://hf-mirror.com/kha-white/manga-ocr-base/resolve/main/pytorch_model.bin",
        ],
        "cache_key": "manga-ocr",
        # Extra small HF files so a local folder works with MangaOcr(path).
        "sidecar": [
            {"name": "config.json",
             "urls": [
                 "https://huggingface.co/kha-white/manga-ocr-base/resolve/main/config.json",
                 "https://hf-mirror.com/kha-white/manga-ocr-base/resolve/main/config.json"]},
            {"name": "preprocessor_config.json",
             "urls": [
                 "https://huggingface.co/kha-white/manga-ocr-base/resolve/main/preprocessor_config.json",
                 "https://hf-mirror.com/kha-white/manga-ocr-base/resolve/main/preprocessor_config.json"]},
            {"name": "tokenizer_config.json",
             "urls": [
                 "https://huggingface.co/kha-white/manga-ocr-base/resolve/main/tokenizer_config.json",
                 "https://hf-mirror.com/kha-white/manga-ocr-base/resolve/main/tokenizer_config.json"]},
            {"name": "special_tokens_map.json",
             "urls": [
                 "https://huggingface.co/kha-white/manga-ocr-base/resolve/main/special_tokens_map.json",
                 "https://hf-mirror.com/kha-white/manga-ocr-base/resolve/main/special_tokens_map.json"]},
            {"name": "vocab.txt",
             "urls": [
                 "https://huggingface.co/kha-white/manga-ocr-base/resolve/main/vocab.txt",
                 "https://hf-mirror.com/kha-white/manga-ocr-base/resolve/main/vocab.txt"]},
        ],
    },
}

_lock = threading.Lock()
_busy = set()


def _cache_target(spec):
    """Where a downloaded file should land (same paths the loaders already use)."""
    key = spec["cache_key"]
    if key == "ctd":
        from manga_text_detector import weights_path
        return weights_path()
    if key == "sam2":
        from manga_sam_select import weights_path
        return weights_path()
    if key == "lama-manga":
        from manga_lama_inpaint import manga_weights_path
        return manga_weights_path()
    if key == "lama":
        from manga_model_guard import lama_weights_path
        return lama_weights_path()
    if key == "manga-ocr":
        # Flat local dir so MangaOcr(path) works; also symlink-friendly for HF cache.
        cache = os.environ.get("XDG_CACHE_HOME") or os.path.join("~", ".cache")
        return os.path.abspath(os.path.expanduser(
            os.path.join(cache, "manga-editor", "manga-ocr-base", "pytorch_model.bin")))
    raise SmartOcrError("未知模型：" + key)


def _bundled(spec):
    if spec["id"] == "manga-ocr":
        return bool(bundled_dir("manga-ocr-base"))
    return bool(bundled_file(spec["filename"]))


def _cached(spec):
    if _bundled(spec):
        return True
    if spec["cache_key"] == "manga-ocr":
        from manga_model_guard import manga_ocr_cached
        target = _cache_target(spec)
        if os.path.isfile(target) and os.path.getsize(target) == spec["size_bytes"]:
            return True
        return manga_ocr_cached()
    path = _cache_target(spec)
    return os.path.isfile(path) and os.path.getsize(path) == spec["size_bytes"]


def list_models():
    out = []
    for spec in CATALOG.values():
        bundled = _bundled(spec)
        cached = _cached(spec)
        out.append({
            "id": spec["id"],
            "label": spec["label"],
            "benefit": spec["benefit"],
            "size": spec["size_label"],
            "sizeBytes": spec["size_bytes"],
            "license": spec["license"],
            "bundlePolicy": "installer" if spec["bundle"] else "download",
            "bundled": bundled,
            "cached": cached,
            "ready": bundled or cached,
            "busy": spec["id"] in _busy,
        })
    return {"ok": True, "models": out,
            "note": "安装包默认只带文字检测（约 91MB）。漫画 LaMa / Manga OCR / 智能点选需在此下载；纯色气泡去字不需要下载。"}


def _sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _open_url(url, start=0, timeout=180):
    headers = {"User-Agent": "Manga-NAI-GPT-model-download/1.6.5"}
    if start > 0:
        headers["Range"] = "bytes=%d-" % start
    req = urllib.request.Request(url, headers=headers)
    return urllib.request.urlopen(req, timeout=timeout)


def _download_one(urls, target, expected_sha, expected_size, progress_name, verify_size=True):
    os.makedirs(os.path.dirname(target), exist_ok=True)
    tmp = target + ".part"
    start = os.path.getsize(tmp) if os.path.isfile(tmp) else 0
    if start > 0 and expected_size and start > expected_size:
        os.remove(tmp)
        start = 0
    last_err = None
    for url in urls:
        try:
            with _open_url(url, start=start) as r:
                code = getattr(r, "status", None) or r.getcode()
                # Server ignored Range → restart
                if start and code == 200:
                    start = 0
                mode = "ab" if start and code == 206 else "wb"
                if mode == "wb":
                    start = 0
                total = expected_size or 0
                try:
                    cl = int(r.headers.get("Content-Length") or 0)
                    if code == 206 and cl:
                        total = start + cl
                    elif code == 200 and cl:
                        total = cl
                except Exception:
                    pass
                progress_start(progress_name, total or expected_size or 0)
                if start:
                    progress_add(progress_name, start)
                try:
                    with open(tmp, mode) as f:
                        while True:
                            chunk = r.read(1 << 20)
                            if not chunk:
                                break
                            f.write(chunk)
                            progress_add(progress_name, len(chunk))
                finally:
                    progress_end(progress_name)
            if expected_sha and _sha256_file(tmp) != expected_sha:
                os.remove(tmp)
                raise SmartOcrError("模型校验失败（SHA-256 不符），已删除：" + progress_name, 502)
            if verify_size and expected_size and os.path.getsize(tmp) != expected_size:
                os.remove(tmp)
                raise SmartOcrError("模型大小不符，已删除：" + progress_name, 502)
            os.replace(tmp, target)
            return target, url
        except SmartOcrError:
            raise
        except (urllib.error.URLError, urllib.error.HTTPError, OSError, TimeoutError) as exc:
            last_err = exc
            continue
    raise SmartOcrError(
        "下载失败（已尝试官方与镜像）：" + progress_name + "。请检查网络后重试。"
        + ((" 原因：" + str(last_err)) if last_err else ""), 502)


def download(model_id, allow_download=False):
    spec = CATALOG.get(model_id)
    if not spec:
        raise SmartOcrError("未知模型：" + str(model_id))
    if not allow_download:
        raise SmartOcrError(
            "%s 尚未下载（%s）。请确认后下载。" % (spec["label"], spec["size_label"]), 428)
    if _cached(spec):
        return {"ok": True, "id": spec["id"], "already": True, "path": _cache_target(spec)}
    with _lock:
        if spec["id"] in _busy:
            raise SmartOcrError(spec["label"] + " 正在下载，请稍候。", 429)
        _busy.add(spec["id"])
    try:
        target = _cache_target(spec)
        # Prefer writing into the real cache dir, not a missing bundled override path.
        # If prefer() returned a non-existing bundled path via env empty — cache target is fine.
        path, used = _download_one(
            spec["urls"], target, spec["sha256"], spec["size_bytes"], spec["filename"])
        # manga-ocr sidecars (small; no resume needed)
        if spec.get("sidecar"):
            base = os.path.dirname(path)
            for side in spec["sidecar"]:
                dest = os.path.join(base, side["name"])
                if os.path.isfile(dest) and os.path.getsize(dest) > 0:
                    continue
                _download_one(side["urls"], dest, None, None, side["name"], verify_size=False)
            # Point HF/transformers at this folder via a marker env is optional;
            # also populate standard hub layout if missing so MangaOcr() default works.
            _seed_hf_manga_ocr(base)
        return {"ok": True, "id": spec["id"], "path": path, "url": used, "already": False}
    finally:
        with _lock:
            _busy.discard(spec["id"])


def _seed_hf_manga_ocr(local_dir):
    """Copy/symlink into the HF hub cache layout so MangaOcr() finds weights without a path arg."""
    try:
        from manga_model_guard import manga_ocr_cache_dir
        hub = manga_ocr_cache_dir()
        snap = os.path.join(hub, "snapshots", "local-bundled")
        os.makedirs(snap, exist_ok=True)
        for name in os.listdir(local_dir):
            src = os.path.join(local_dir, name)
            dst = os.path.join(snap, name)
            if os.path.isfile(src) and not os.path.exists(dst):
                try:
                    os.symlink(src, dst)
                except OSError:
                    import shutil
                    shutil.copy2(src, dst)
        refs = os.path.join(hub, "refs")
        os.makedirs(refs, exist_ok=True)
        main = os.path.join(refs, "main")
        if not os.path.isfile(main):
            with open(main, "w", encoding="utf-8") as f:
                f.write("local-bundled\n")
    except Exception:
        pass
