"""Normal-request controls for production GPT image proxy; no network calls."""
import base64
import importlib.util
import json
import pathlib
import sys
import os
import urllib.parse
from unittest.mock import patch

repo = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path(os.environ.get('MANGA_AUDIT_ROOT',pathlib.Path(__file__).resolve().parents[2]))
spec = importlib.util.spec_from_file_location('audit_gpt_proxy', repo / 'gpt_image_proxy.py')
proxy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proxy)
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+afoIAAAAASUVORK5CYII=')
url = 'data:image/png;base64,' + base64.b64encode(PNG).decode()

class Response:
    def __init__(self, data): self.data = data
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, limit=None): return self.data if limit is None else self.data[:limit]

class Opener:
    def __init__(self): self.requests = []
    def open(self, request, timeout):
        self.requests.append(request)
        return Response(json.dumps({'data': [{'b64_json': base64.b64encode(PNG).decode(), 'revised_prompt': 'fixture revised'}]}).encode())

opener = Opener()
with patch.object(proxy, '_valid_public_url', side_effect=lambda value, **kw: urllib.parse.urlsplit(value)), patch.object(proxy, '_opener', return_value=opener):
    generated = proxy.request_image_edit({'operation': 'generate', 'baseUrl': 'https://offline.invalid/v1', 'model': 'user-model-exact', 'prompt': 'normal fixture', 'size': '1024x1536'}, 'OFFLINE_FIXTURE_ONLY')
    forwarded = json.loads(opener.requests[-1].data)
    assert forwarded['model'] == 'user-model-exact' and forwarded['size'] == '1024x1536'
    assert generated['image'] == url and generated['revisedPrompt'] == 'fixture revised'
    print('CONTROL GPT_GENERATION', json.dumps({'model': forwarded['model'], 'size': forwarded['size'], 'imageRoundtrip': True, 'requests': len(opener.requests)}))
    edited = proxy.request_image_edit({'operation': 'edit', 'baseUrl': 'https://offline.invalid/v1', 'model': 'user-model-exact', 'prompt': 'normal fixture', 'image': url, 'references': [url] * 3}, 'OFFLINE_FIXTURE_ONLY')
    image_fields = opener.requests[-1].data.count(b'name="image[]"')
    assert image_fields == 4 and edited['image'] == url
    print('CONTROL GPT_REFERENCES', json.dumps({'imageFields': image_fields, 'primaryPlusReferences': 4, 'imageRoundtrip': True, 'requests': len(opener.requests)}))

multiple = proxy._extract_image(json.dumps({'data': [{'b64_json': base64.b64encode(PNG).decode(), 'revised_prompt': 'first'}, {'b64_json': base64.b64encode(PNG).decode(), 'revised_prompt': 'second'}]}).encode(), opener)
assert multiple['revisedPrompt'] == 'first'
print('LIMIT GPT_MULTIPLE_RESPONSE', json.dumps({'upstreamImages': 2, 'returnedImages': 1, 'selected': multiple['revisedPrompt']}))
