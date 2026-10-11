"""Character library 2.0: palette, score, head box, and identify() with fake models (no download needed)."""
import base64, io, os, sys, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
try:
    import numpy as np
    import cv2  # noqa: F401
except ImportError:  # Windows offline job installs Pillow only
    print("SKIP character library tests: numpy/cv2 not installed")
    sys.exit(0)
from PIL import Image
import manga_character_detect as mcd
import manga_character_library as L


def uri(arr):
    b = io.BytesIO(); Image.fromarray(arr).save(b, "PNG")
    return "data:image/png;base64," + base64.b64encode(b.getvalue()).decode()


class Fake:
    """faces at fixed boxes; feature = one-hot by the colour in the face centre; difference = 0 same / 1 other."""
    def __init__(self, faces): self.faces = faces
    def install(self):
        self.saved = (mcd._get_extra, mcd.faces, mcd.ccip_embed, mcd.ccip_difference)
        mcd._get_extra = lambda allow=False: {"face": None, "ccip": None, "ccipm": None}
        mcd.faces = lambda rgb, _m: [list(f) + [0.9] for f in self.faces]
        def emb(rgb, _mask, box, _m):
            x0, y0, x1, y1 = box; c = rgb[(y0 + y1) // 2, (x0 + x1) // 2]
            v = np.zeros(768, np.float32); v[int(np.argmax(c))] = 1; return v
        mcd.ccip_embed = emb
        def diff(feats, _m):
            F = np.array(feats); return (1 - F @ F.T) * 0.5 + np.where(np.eye(len(F)) > 0, 0, 0.01)
        mcd.ccip_difference = diff
    def remove(self): mcd._get_extra, mcd.faces, mcd.ccip_embed, mcd.ccip_difference = self.saved


class T(unittest.TestCase):
    def test_palette_gray_and_colour(self):
        g = np.full((80, 80, 3), 120, np.uint8)
        self.assertEqual(L.palette(g, [0, 0, 80, 80]), [])
        c = np.zeros((80, 80, 3), np.uint8); c[:, :40] = (220, 40, 40); c[:, 40:] = (40, 60, 200)
        p = L.palette(c, [0, 0, 80, 80], k=2)
        self.assertEqual(len(p), 2); self.assertAlmostEqual(sum(x["share"] for x in p), 1, places=2)
        self.assertEqual(L.palette_distance(p, p), 0)
        self.assertIsNone(L.palette_distance(p, []))

    def test_score_monotone(self):
        self.assertEqual(L.score(0), 100); self.assertEqual(L.score(L.MATCH), 50); self.assertEqual(L.score(1), 0)
        self.assertLess(L.score(0.05, 60), L.score(0.05, 10))

    def test_head_box_clamped(self):
        b = L.head_box([0, 0, 50, 50], 100, 100)
        self.assertEqual(b[:2], [0, 0]); self.assertLessEqual(b[2], 100); self.assertLessEqual(b[3], 100)

    def test_identify_one_per_panel(self):
        img = np.full((200, 400, 3), 255, np.uint8)
        img[20:80, 20:80] = (230, 0, 0)      # red  -> panel 0
        img[20:80, 120:180] = (230, 0, 0)    # red again in panel 0: must NOT also become "red"
        img[20:80, 220:280] = (0, 0, 230)    # blue -> panel 1
        fk = Fake([[30, 30, 70, 70], [130, 30, 170, 70], [230, 30, 270, 70]]); fk.install()
        try:
            red = L._encode(np.eye(768, dtype=np.float32)[0]); blue = L._encode(np.eye(768, dtype=np.float32)[2])
            lib = [{"id": "r", "name": "红", "features": [red]}, {"id": "b", "name": "蓝", "features": [blue]}]
            r = L.identify({"image": uri(img), "library": lib, "panels": [[0, 0, 200, 200], [200, 0, 400, 200]]})
            ids = [f["id"] for f in r["faces"]]
            self.assertEqual(ids.count("r"), 1); self.assertIn("b", ids)
            self.assertEqual(ids.count(None), 1)
            self.assertTrue(all(f["status"] == "match" for f in r["faces"] if f["id"]))
            # without panels the constraint is off
            r2 = L.identify({"image": uri(img), "library": lib})
            self.assertEqual([f["id"] for f in r2["faces"]].count("r"), 2)
            # empty library: everything unknown, no crash
            self.assertTrue(all(f["status"] == "unknown" for f in L.identify({"image": uri(img), "library": []})["faces"]))
        finally:
            fk.remove()

    def test_embed_needs_face_or_box(self):
        fk = Fake([]); fk.install()
        try:
            img = np.full((100, 100, 3), 200, np.uint8)
            with self.assertRaises(Exception): L.embed({"image": uri(img)})
            with self.assertRaises(Exception): L.embed({"image": uri(img), "box": [0, 0, 8, 8]})
            out = L.embed({"image": uri(img), "box": [10, 10, 90, 90]})
            self.assertEqual(len(base64.b64decode(out["feature"])), 768 * 4)
            self.assertEqual(len(out["feature"]), 4096)
        finally:
            fk.remove()


if __name__ == "__main__":
    unittest.main()
