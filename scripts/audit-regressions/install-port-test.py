"""Audit 83/84/85: install scripts and Windows tools port contract."""
import pathlib, re, subprocess, sys, tempfile
try:
    from PIL import Image
except ImportError:
    print("SKIP 83/84/85 (no PIL)"); raise SystemExit(0)
ROOT = pathlib.Path(__file__).resolve().parents[2]

sh = (ROOT / "scripts/install-ai.sh").read_text(encoding="utf-8")
ps = (ROOT / "scripts/install-ai.ps1").read_text(encoding="utf-8")
assert "--no-build-isolation" in sh and "--no-deps" in sh
assert "--no-build-isolation" in ps and "--no-deps" in ps
# Dry-run with no-build-isolation must NOT enter isolated build deps when torch is absent from isolation
# (we only assert the product scripts carry the flag; pip dry-run without isolation would need torch installed).
print("PASS 83 install-ai uses --no-build-isolation with --no-deps for SAM2")

prep = (ROOT / "scripts/prepare-installer.ps1").read_text(encoding="utf-8")
assert "sys.argv[1]" in prep and "sys.argv[2]" in prep
assert "Image.open(r'$iconSource')" not in prep
with tempfile.TemporaryDirectory(prefix="O'Brien Manga 测试-") as tmp:
    p = pathlib.Path(tmp)
    src, out = p / "icon.png", p / "app.ico"
    Image.new("RGBA", (16, 16), "red").save(src)
    code = "from PIL import Image; import sys; im=Image.open(sys.argv[1]).convert('RGBA'); im.save(sys.argv[2], sizes=[(16,16)])"
    r = subprocess.run([sys.executable, "-c", code, str(src), str(out)], capture_output=True, text=True)
    assert r.returncode == 0 and out.exists(), r.stderr
print("PASS 84 icon conversion takes paths via sys.argv (apostrophe-safe)")

win = (ROOT / "scripts/windows/start_manga_editor_nai.ps1").read_text(encoding="utf-8")
assert "LOCAL_TOOLS_PORT" in win and re.search(r'ToolsPort\s*=\s*if\s*\(\$env:LOCAL_TOOLS_PORT', win)
assert "/health" in win
assert re.search(r'\$env:LOCAL_TOOLS_PORT\s*=\s*\[string\]\$ToolsPort', win)
print("PASS 85 Windows launcher shares LOCAL_TOOLS_PORT and health-checks the tools URL")
