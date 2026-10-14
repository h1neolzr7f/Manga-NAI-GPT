"""Audit 24: Director/tagger connections are validated at connect time (DNS rebinding), and
_start_tool_job never falls back to the server's own NovelAI key."""
import importlib.util, os, socket, threading, time, urllib.error, urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler
from unittest.mock import patch
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
spec = importlib.util.spec_from_file_location('server99', os.path.join(ROOT, '99_server.py'))
s = importlib.util.module_from_spec(spec); spec.loader.exec_module(s)

hits = []
class H(BaseHTTPRequestHandler):
    def do_POST(self):
        hits.append(self.headers.get('Authorization')); self.send_response(200); self.end_headers(); self.wfile.write(b'{}')
    def log_message(self, *a): pass
own = HTTPServer(('127.0.0.1', 0), H); port = own.server_address[1]
threading.Thread(target=own.serve_forever, daemon=True).start()

real = socket.getaddrinfo
answers = iter([[(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', port))]])
def rebinding(host, p, *a, **k):
    if host == 'rebind.example':
        try:
            return next(answers)                   # validation sees a public address
        except StopIteration:
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', p))]   # connect sees loopback
    return real(host, p, *a, **k)
url = 'http://rebind.example:%d/v1/chat/completions' % port
with patch.object(s, '_get_proxy_url', return_value=''), patch('socket.getaddrinfo', side_effect=rebinding):
    assert s.validate_upstream_url(url, port) == ''
    req = urllib.request.Request(url, data=b'{}', headers={'Authorization': 'Bearer TEST'}, method='POST')
    try:
        s.SERVER_PORT = port
        s._build_proxy_opener().open(req, timeout=5)
        raise SystemExit('24: rebinding connection was not blocked')
    except urllib.error.URLError as e:
        assert 'rejected' in str(e.reason), e
assert hits == [], '24: request reached this server'
# allowed loopback service on another port still works
with patch.object(s, '_get_proxy_url', return_value=''):
    s.SERVER_PORT = None
    r = s._build_proxy_opener().open(
        urllib.request.Request('http://127.0.0.1:%d/x' % port, data=b'{}', method='POST'), timeout=5)
    assert r.status == 200
print('PASS 24 Director/tagger upstream pinned and validated at connect time')

captured = {}
class P:
    def __init__(self, cmd, env=None, **k): captured.update(env); self.stdout = iter(()); self.returncode = 0
    def wait(self): return 0
with patch.dict(os.environ, {'NOVELAI_API_KEY': 'pst-SERVER-ONLY'}), patch.object(s.subprocess, 'Popen', P):
    job = s._start_tool_job('material-previews', '', [])
    for _ in range(100):
        if s.TOOL_JOBS[job['id']]['ended_at']: break
        time.sleep(0.02)
assert 'NOVELAI_API_KEY' not in captured, 'tool job must not inherit the server key without an explicit token'
print('PASS _start_tool_job has no env-key fallback')
