"""Audit 17: zero thresholds / erode size are valid and must not become defaults."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "local_tools"))
try:
    import cutout
except Exception as exc:  # optional heavy deps
    print("SKIP 17 cutout import failed:", exc); sys.exit(0)
k = cutout.rembg_kwargs({"fg_threshold": 0, "bg_threshold": 0, "erode_size": 0})
assert (k["alpha_matting_foreground_threshold"], k["alpha_matting_background_threshold"], k["alpha_matting_erode_size"]) == (0, 0, 0), k
k = cutout.rembg_kwargs({})
assert (k["alpha_matting_foreground_threshold"], k["alpha_matting_background_threshold"], k["alpha_matting_erode_size"]) == (240, 10, 10), k
k = cutout.rembg_kwargs({"fg_threshold": "", "erode_size": "255"})
assert k["alpha_matting_foreground_threshold"] == 240 and k["alpha_matting_erode_size"] == 255
print("PASS 17 cutout keeps explicit 0 settings; missing values use defaults")
