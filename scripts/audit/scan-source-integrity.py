"""Read-only source/resource scan. Exit 0 means these basic checks passed.

Unlike defect-reproduction fixtures in this directory, this script checks for
syntax errors, directly referenced missing resources and invalid image files.
It does not test browser behaviour or model quality. Needs Node.js and Pillow.
"""
import json
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

root = Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get(
    "MANGA_AUDIT_ROOT", Path(__file__).resolve().parents[2])).resolve()
js = sorted(p for p in (root / "js").rglob("*.js") if "third" not in p.parts)
python = sorted(list(root.glob("*.py")) + list((root / "local_tools").rglob("*.py")))
svg = sorted((root / "assets").rglob("*.svg"))
images = sorted(p for p in (root / "assets").rglob("*")
                if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"})
failures = []

def record(path, error):
    failures.append({"path": str(path.relative_to(root)), "error": str(error)})

for path in js:
    result = subprocess.run(["node", "--check", str(path)], capture_output=True, text=True)
    if result.returncode:
        record(path, result.stderr)
for path in python:
    try:
        compile(path.read_text(encoding="utf-8-sig"), str(path), "exec")
    except (SyntaxError, UnicodeError) as error:
        record(path, error)
for path in svg:
    try:
        ET.parse(path)
    except ET.ParseError as error:
        record(path, error)
for path in images:
    try:
        with Image.open(path) as image:
            image.verify()
    except Exception as error:
        record(path, error)
html = (root / "index.html").read_text(encoding="utf-8")
for reference in re.findall(r'''(?:src|href)=["']([^"']+)["']''', html):
    if reference.startswith(("http:", "https:", "//", "data:", "#", "javascript:", "app:")):
        continue
    target = reference.split("?")[0].split("#")[0]
    if target and not (root / target).exists():
        failures.append({"path": "index.html", "error": "Missing direct reference: " + reference})
print(json.dumps({"jsSyntaxCount": len(js), "pythonSyntaxCount": len(python),
                  "svgXmlCount": len(svg), "rasterVerifyCount": len(images),
                  "failures": failures}, ensure_ascii=False, indent=2))
sys.exit(1 if failures else 0)
