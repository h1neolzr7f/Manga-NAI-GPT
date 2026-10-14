"""User-selected chat models survive the real local HTTP proxy; no external calls."""
import http.client
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import threading
import unittest
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
spec = importlib.util.spec_from_file_location("custom_chat_server", ROOT / "99_server.py")
srv = importlib.util.module_from_spec(spec)
spec.loader.exec_module(srv)
srv.QUIET_REQUESTS = True

class Response(io.BytesIO):
    status = 200
    headers = {"Content-Type": "application/json"}

class CustomChatTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = srv.ThreadedTCPServer(("127.0.0.1", 0), srv.CORSRequestHandler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=4)

    def call(self, method, path, body=None, models=None):
        seen = []
        def capture(req, timeout=None):
            seen.append(req)
            data = {"data": models} if method == "GET" else {"choices": [{"message": {"content": "ok"}}]}
            return Response(json.dumps(data).encode())
        opener = mock.Mock()
        opener.open.side_effect = capture
        host = f"127.0.0.1:{self.port}"
        headers = {"Host": host, "Origin": f"http://{host}", "Sec-Fetch-Site": "same-origin",
                   "X-Director-Api-Url": "https://chat.example/v1/chat/completions",
                   "Authorization": "Bearer test-only-key"}
        encoded = None if body is None else json.dumps(body).encode()
        if encoded is not None:
            headers["Content-Type"] = "application/json"
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        try:
            with mock.patch.object(srv, "validate_upstream_url", return_value=None), mock.patch.object(srv, "_build_proxy_opener", return_value=opener):
                conn.request(method, path, encoded, headers)
                response = conn.getresponse()
                data = json.loads(response.read())
                self.assertEqual(response.status, 200, data)
        finally:
            conn.close()
        return data, seen

    def test_explicit_model_reaches_upstream_unchanged(self):
        for model in ("gpt-4.1-mini", "chatgpt-custom", "qwen3.5-flash", "Vendor/MyModel:Latest"):
            with self.subTest(model=model):
                _, seen = self.call("POST", "/director-proxy/chat-completions", {"model": model, "messages": []})
                self.assertEqual(json.loads(seen[0].data)["model"], model)
                self.assertEqual(seen[0].full_url, "https://chat.example/v1/chat/completions")
                self.assertEqual(seen[0].get_header("Authorization"), "Bearer test-only-key")

    def test_explicit_model_only_trims_whitespace(self):
        _, seen = self.call("POST", "/director-proxy/chat-completions", {"model": " Vendor/Custom "})
        self.assertEqual(json.loads(seen[0].data)["model"], "Vendor/Custom")

    def test_configured_env_default_is_preserved_when_body_model_missing(self):
        for model in ("gpt-4.1-mini", "qwen3.5-flash", "Vendor/Custom"):
            with self.subTest(model=model), mock.patch.dict(os.environ, {"DIRECTOR_MODEL": model}):
                _, seen = self.call("POST", "/director-proxy/chat-completions", {"messages": []})
                self.assertEqual(json.loads(seen[0].data)["model"], model)

    def test_blank_model_uses_the_configured_default(self):
        with mock.patch.dict(os.environ, {"DIRECTOR_MODEL": "Vendor/Custom"}):
            _, seen = self.call("POST", "/director-proxy/chat-completions", {"model": " "})
            self.assertEqual(json.loads(seen[0].data)["model"], "Vendor/Custom")

    def test_standard_openai_model_list_and_case_are_preserved(self):
        data, seen = self.call("GET", "/director-proxy/models", models=[
            {"id": "Vendor/Custom", "object": "model"},
            {"id": "gpt-4.1-mini", "object": "model"}])
        self.assertEqual([m["id"] for m in data["data"]], ["Vendor/Custom", "gpt-4.1-mini"])
        self.assertEqual(seen[0].full_url, "https://chat.example/v1/models")

    def test_explicit_protocol_metadata_filters_only_incompatible_entries(self):
        data, _ = self.call("GET", "/director-proxy/models", models=[
            {"id": "Vendor/Chat", "supported_protocols": ["openai:chat-completions"]},
            {"id": "image-only", "supported_protocols": ["openai:images"]},
            {"id": "LegacyChat"}])
        self.assertEqual([m["id"] for m in data["data"]], ["Vendor/Chat", "LegacyChat"])

if __name__ == "__main__":
    unittest.main(verbosity=2)

