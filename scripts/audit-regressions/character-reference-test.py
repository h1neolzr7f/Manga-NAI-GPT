"""Audit 33: JPEG/WebP reference photos are accepted by the character-library embedding input."""
import base64, io, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, ROOT)
try:
    from PIL import Image
    import numpy  # noqa: F401
except ImportError:
    print('SKIP 33 (Pillow/numpy not installed)'); raise SystemExit(0)
import manga_character_library as lib
from manga_smart_ocr import SmartOcrError
for fmt, mime in (('JPEG', 'jpeg'), ('WEBP', 'webp'), ('PNG', 'png')):
    b = io.BytesIO(); Image.new('RGB', (40, 30), (200, 10, 10)).save(b, fmt)
    rgb = lib._rgb({'image': 'data:image/%s;base64,%s' % (mime, base64.b64encode(b.getvalue()).decode())})
    assert rgb.shape == (30, 40, 3), (fmt, rgb.shape)
b = io.BytesIO(); Image.new('RGB', (8, 8)).save(b, 'PNG')
try:
    lib._rgb({'image': 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()}); raise SystemExit('mismatched type accepted')
except SmartOcrError:
    pass
print('PASS 33 character library accepts JPEG/WebP/PNG references; mismatched content rejected')
