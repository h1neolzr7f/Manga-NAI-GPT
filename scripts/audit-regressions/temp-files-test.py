"""Audit 44 (long upload names) and 45 (concurrent pack writes share one .part)."""
import os, sys, pathlib, tempfile, threading
ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT)); sys.path.insert(0, str(ROOT / "local_tools"))

# 44: run the real _process_one with a stub manager and a 244-char filename.
try:
    import server as lt_server
except Exception as exc:
    print("SKIP 44 local_tools.server import failed:", exc); lt_server = None
if lt_server:
    class Mgr:
        def remove_background(self, content, model, options, meta=None):
            return "stub", b"png"
    class H(lt_server.Handler):
        manager = Mgr()
    h = H.__new__(H)
    name = "a" * 240 + ".png"
    out = h._process_one(b"x", name, {})
    assert out["ok"] and out["model"] == "stub"
    print("PASS 44 long legal file names no longer break the temp file")

# 45: two writers of the same target never collide on a shared .part
import prompt_helper_images as phi
d = tempfile.mkdtemp(); target = os.path.join(d, "x.png"); errors = []
barrier = threading.Barrier(8)
def w(i):
    try:
        barrier.wait(); phi._atomic_write(target, b"data%d" % i)
    except Exception as e:
        errors.append(e)
ts = [threading.Thread(target=w, args=(i,)) for i in range(8)]
[t.start() for t in ts]; [t.join() for t in ts]
assert not errors, errors
assert open(target, "rb").read().startswith(b"data")
assert [f for f in os.listdir(d) if f.endswith(".part")] == []
print("PASS 45 concurrent pack downloads use unique temp files")
