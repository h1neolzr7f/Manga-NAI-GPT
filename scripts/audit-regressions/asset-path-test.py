"""Audit 63: imported asset files are keyed by the full asset id and written atomically."""
import importlib.util, os, tempfile, base64
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
spec = importlib.util.spec_from_file_location('server99', os.path.join(ROOT, '99_server.py'))
s = importlib.util.module_from_spec(spec); spec.loader.exec_module(s)
long = 'asset-' + 'x' * 40
a, b = long + '-red', long + '-blue'
assert s.imported_asset_relative_path(a, 'same.png') != s.imported_asset_relative_path(b, 'same.png'), '63: ids sharing a long prefix collide'
cwd = os.getcwd(); tmp = tempfile.mkdtemp()
try:
    os.chdir(tmp)
    ra, _ = s.save_imported_asset({'id': a, 'name': 'same.png', 'data': base64.b64encode(b'RED').decode()})
    rb, _ = s.save_imported_asset({'id': b, 'name': 'same.png', 'data': base64.b64encode(b'BLUE').decode()})
    assert open(ra, 'rb').read() == b'RED' and open(rb, 'rb').read() == b'BLUE', '63: second asset overwrote the first'
    assert not [f for f in os.listdir(os.path.dirname(ra)) if '.part-' in f]
finally:
    os.chdir(cwd)
print('PASS 63 imported assets keyed by full id; no overwrite')
