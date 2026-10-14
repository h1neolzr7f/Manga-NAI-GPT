"""Audit 14/15/16: character model initialisation, idle release vs in-flight use, detect cache key."""
import os, sys, types, io, importlib
from unittest.mock import patch
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, ROOT)
import manga_character_detect as d
import manga_model_guard as g

# fake onnxruntime: the second model fails to load once
calls = {'n': 0, 'fail': 'ccip'}
class Session:
    def __init__(self, path, providers=None):
        calls['n'] += 1
        if calls['fail'] and calls['fail'] in os.path.basename(path).lower():
            calls['fail'] = None
            raise RuntimeError('simulated load failure')
        self.path = path
sys.modules['onnxruntime'] = types.SimpleNamespace(InferenceSession=Session)
files = {k: 'x-%s.onnx' % k for k in d.EXTRA}
with patch.object(d, 'extra_cached', return_value=True), \
     patch.object(d, 'extra_path', side_effect=lambda k: '/m/%s-%s' % (k, files[k])), \
     patch('os.path.isfile', return_value=True), \
     patch('os.path.getsize', side_effect=lambda p: next(v['bytes'] for k, v in d.EXTRA.items() if '/m/%s-' % k in p)), \
     patch.object(d, '_sha256', side_effect=lambda p: next(v['sha'] for k, v in d.EXTRA.items() if '/m/%s-' % k in p)):
    d._extra.clear()
    try:
        d._get_extra(False)
        raise SystemExit('expected simulated failure')
    except RuntimeError:
        pass
    assert d._extra == {}, '14: failed init must not leave a half-ready set: %r' % list(d._extra)
    extra = d._get_extra(False)
    assert set(extra) == set(d.EXTRA), '14: retry must load every session'
    print('PASS 14 character models publish atomically; retry loads all')
    # 15: idle release clears the shared dict while a request holds its snapshot
    g._last_use['sam2'] = 0
    g.release_idle(now=10**9, limit=1)
    assert d._extra == {}
    assert 'face' in extra and 'ccip' in extra, '15: in-flight request keeps its sessions'
    print('PASS 15 idle release does not break an in-flight request')

# 16: cache key includes refine; degraded result is not cached
try:
    import numpy as np
    from PIL import Image
except ImportError:
    print('SKIP 16 (numpy/Pillow not installed)')
    raise SystemExit(0)
buf = io.BytesIO(); Image.new('RGB', (32, 32), 'white').save(buf, 'PNG'); raw = buf.getvalue()
sam = types.ModuleType('manga_sam_select'); sam._embeds = {}
state = {'pred': None, 'inits': 0}
def _get_predictor(allow):
    state['inits'] += 1
    if state['pred'] is None:
        raise d.SmartOcrError('no torch', 500)
    return state['pred']
sam._get_predictor = _get_predictor
sys.modules['manga_sam_select'] = sam
d._cache.clear()
with patch.object(d, '_get_seg', return_value=object()), patch.object(d, 'read_image', return_value=(raw, 32, 32)), \
     patch.object(d, 'find_characters', return_value=([], [])):
    r1 = d.detect({'image': 'x', 'identity': False, 'refine': False})
    r2 = d.detect({'image': 'x', 'identity': False, 'refine': True})
    assert not r2.get('cached'), '16: refine request must not reuse the refine:false result'
    assert state['inits'] == 1
    state['pred'] = object()
    r3 = d.detect({'image': 'x', 'identity': False, 'refine': True})
    assert r3['refined'] is True and not r3.get('cached'), '16: degraded result must not be cached'
print('PASS 16 detect cache keyed by refine; degraded results not cached')
