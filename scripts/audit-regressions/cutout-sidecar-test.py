"""Audit 54/57: local cutout service reports crop box and keeps source alpha."""
import sys
from pathlib import Path
try:
    from PIL import Image
except ImportError:
    print("SKIP 54/57 (no PIL)"); sys.exit(0)
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "local_tools"))
from cutout import postprocess_rgba, image_to_png_bytes, bytes_to_image
from model_manager import ModelManager

im = Image.new("RGBA", (100, 100), (255, 255, 255, 0))
for y in range(20, 30):
    for x in range(60, 70):
        im.putpixel((x, y), (255, 0, 0, 255))
meta = {}
out = postprocess_rgba(im, {"crop": True, "feather": 0}, meta)
assert out.size == (14, 14)
assert meta == {"crop": {"x": 58, "y": 18, "width": 14, "height": 14}, "source_width": 100, "source_height": 100}, meta
print("PASS 54 sidecar crop reports its source offset")

t = Image.new("RGBA", (4, 1), (255, 0, 0, 0))
t.putpixel((1, 0), (0, 0, 255, 128))
t.putpixel((2, 0), (0, 255, 0, 255))
t.putpixel((3, 0), (255, 255, 255, 255))
meta = {}
_, png = ModelManager().remove_background(image_to_png_bytes(t), "color-key", {"engine": "color-key", "key_color": "#ffffff", "crop": False, "feather": 0}, meta=meta)
a = [bytes_to_image(png).getpixel((i, 0))[3] for i in range(4)]
assert a == [0, 128, 255, 0], a
print("PASS 57 colour key never revives transparent or half-transparent pixels")
