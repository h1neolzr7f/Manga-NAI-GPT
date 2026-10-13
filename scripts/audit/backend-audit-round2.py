#!/usr/bin/env python3
"""Read-only Manga-NAI-GPT ca9572d audit reproductions.

All files created by tests live in temporary directories. No upstream connections,
models, paid requests, credentials, or repository writes are used.
Run: python3 scripts/audit/backend-audit-round2.py
"""
import base64
import hashlib
import http.client
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
spec = importlib.util.spec_from_file_location("round2_server", ROOT / "99_server.py")
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)
server.QUIET_REQUESTS = True
import prompt_helper_images as phi


def node_repro(body):
    prelude = r"""
const fsReal = require('node:fs'), vm = require('node:vm');
const source = fsReal.readFileSync('scripts/novelai-batch-tools.mjs','utf8');
const section = source.slice(source.indexOf('async function responseToImageBuffer'), source.indexOf('async function materialUrlExists'));
let accepted = 0;
const ctx = { Buffer, zlib:require('node:zlib'), path:require('node:path'),
process:{env:{MNAI_PORT:'17333',NAI_RETRIES:'3'}},console:{log(){}},
setTimeout:fn=>{fn();return 0;},
buildRequest:()=>({parameters:{width:1024,height:1024,seed:123}}),
fs:{mkdir:async()=>{},writeFile:async()=>{throw new Error('simulated disk full AFTER generation');}},
fetch:async()=>{accepted++;return {ok:true,headers:{get:()=> 'image/png'},arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};}
};
vm.createContext(ctx);vm.runInContext(section,ctx);
"""
    result = subprocess.run(["node", "-e", prelude + body], cwd=ROOT,
                            text=True, capture_output=True, check=True, timeout=10)
    return json.loads(result.stdout)


class Reproductions(unittest.TestCase):
    def test_web_font_family_is_stored_url_encoded(self):
        script = r'''
const fs=require('node:fs'),vm=require('node:vm');
const saved=[];
const ctx={fmFontRepository:{saveWebFont:async(name,url)=>saved.push({name,url}),getAllFonts:async()=>saved},
FontSelectorManager:{reloadAll(){}},fmUserFontManager:{updateFontList(){}},fontLogger:{error(){}},
createToastError(){},getText:x=>x};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/core/font/font-manager-core.js','utf8')+';globalThis.manager=fontManager;',ctx);
ctx.manager.loadWebFontStylesheet=async()=>{};ctx.manager.addFontOption=async()=>{};
(async()=>{await ctx.manager.registerWebFont('https://fonts.googleapis.com/css2?family=Roboto+Slab:wght@400');console.log(JSON.stringify(saved));})();
'''
        result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True,
                                capture_output=True, check=True, timeout=10)
        saved = json.loads(result.stdout)
        self.assertEqual(saved[0]["name"], "Roboto+Slab")
        print("PROVEN: registered web font family retains URL encoding:", saved[0]["name"])

    def test_normal_character_reference_jpeg_is_rejected_by_embed(self):
        primary = os.environ.get("CODEX_PRIMARY_RUNTIME_PYTHON", sys.executable)
        program = r'''
import io,json,base64
from PIL import Image
from unittest.mock import patch
import manga_character_detect as d
import manga_character_library as c
from manga_smart_ocr import SmartOcrError
b=io.BytesIO();Image.new('RGB',(32,32),'white').save(b,format='JPEG')
image='data:image/jpeg;base64,'+base64.b64encode(b.getvalue()).decode()
with patch.object(d,'_get_extra',return_value={'face':object(),'ccip':object()}):
 try:c.embed({'image':image})
 except SmartOcrError as error:print(json.dumps({'status':error.status,'error':str(error),'prefix':image[:23]}))
'''
        result = subprocess.run([primary, "-c", program], cwd=ROOT, text=True,
                                capture_output=True, check=True, timeout=10)
        payload = json.loads(result.stdout)
        self.assertEqual(payload["status"], 400)
        self.assertEqual(payload["prefix"], "data:image/jpeg;base64,")
        print("PROVEN: normal JPEG character reference ->", payload)

    def test_batch_retries_after_successful_generation_and_disk_failure(self):
        result = node_repro(r"""
(async()=>{try{await ctx.generateImageWithRetry({token:'audit-stub',endpoint:'http://localhost.invalid',outputPath:'unused'},3);}catch(e){console.log(JSON.stringify({accepted,error:e.message}));}})();
""")
        self.assertEqual(result["accepted"], 3)
        print("PROVEN: successful fake generations after disk-full:", result)

    def test_batch_retries_unknown_network_outcome(self):
        result = node_repro(r"""
ctx.fetch=async()=>{accepted++;throw new TypeError('simulated lost response AFTER upstream acceptance');};
(async()=>{try{await ctx.generateImageWithRetry({token:'audit-stub',endpoint:'http://localhost.invalid',outputPath:'unused'},3);}catch(e){console.log(JSON.stringify({accepted,error:e.message}));}})();
""")
        self.assertEqual(result["accepted"], 3)
        print("PROVEN: fake accepted requests after lost response:", result)

    def test_batch_ignores_mnai_port(self):
        result = node_repro(r"""
const start=source.indexOf('async function generateComicDemo()');
const end=source.indexOf('async function main()',start);
ctx.resolveNovelAiToken=async()=> 'audit-stub';ctx.getComicPreset=()=>({pages:[{file:'audit.png',prompt:'audit'}]});
ctx.rootDir='/unused';ctx.comicOutputRoot='/unused';ctx.DEFAULT_QUALITY='audit';ctx.DEFAULT_NEGATIVE='audit';ctx.materialUrlExists=async()=>false;
let destination='';ctx.generateImageWithRetry=async opts=>{destination=opts.endpoint;throw new Error('stop before generation');};
vm.runInContext(source.slice(start,end),ctx);
(async()=>{try{await ctx.generateComicDemo();}catch(e){}console.log(JSON.stringify({configuredPort:ctx.process.env.MNAI_PORT,destination}));})();
""")
        self.assertEqual(result["configuredPort"], "17333")
        self.assertIn(":8000/", result["destination"])
        print("PROVEN: batch custom-port mismatch:", result)

    def test_prompt_download_duplicate_requests_share_part_file(self):
        raw = b"safe fake image payload"
        m = {"root": "03_images/imgPromptHelper/", "packs": {"audit": {
            "source": "https://unused.invalid/", "files": {"test.png": [hashlib.sha256(raw).hexdigest(), len(raw)]}}}}
        barrier = threading.Barrier(2)
        real_replace = os.replace
        outcomes = []

        def racing_replace(src, dst):
            barrier.wait(timeout=5)
            return real_replace(src, dst)

        class Response(io.BytesIO):
            pass

        def worker():
            try:
                phi.download("audit", opener=lambda *args, **kwargs: Response(raw))
                outcomes.append("ok")
            except Exception as error:
                outcomes.append(type(error).__name__)

        with tempfile.TemporaryDirectory() as td, patch.object(phi, "manifest", return_value=m), \
                patch.object(phi, "local_path", return_value=None), patch.object(phi, "store_dir", return_value=td), \
                patch.object(phi.os, "replace", side_effect=racing_replace), patch.object(phi, "status", return_value={"ok": True}):
            threads = [threading.Thread(target=worker) for _ in range(2)]
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=10)
            self.assertEqual(sorted(outcomes), ["FileNotFoundError", "ok"])
        print("PROVEN: simultaneous same-pack downloads:", outcomes)

    def test_long_legal_upload_name_fails_before_processing(self):
        sys.path.insert(0, str(ROOT / "local_tools"))
        import server as sidecar

        class FakeManager:
            calls = 0
            def remove_background(self, *args):
                self.calls += 1
                return "color-key", b"stub"

        manager = FakeManager()
        handler = type("H", (), {"manager": manager})()
        name = "a" * 240 + ".png"
        # Verify the filename itself is legal on this filesystem.
        with tempfile.TemporaryDirectory() as td:
            Path(td, name).write_bytes(b"stub")
            with patch.dict(os.environ, {"TMPDIR": td}):
                with self.assertRaises(OSError) as failure:
                    sidecar.Handler._process_one(handler, b"stub", name, {})
        self.assertEqual(manager.calls, 0)
        self.assertEqual(failure.exception.errno, 36)
        print("PROVEN: legal 244-character upload filename ->", failure.exception.errno, "before processing")

    def test_static_uploaded_svg_served_as_active_same_origin_document(self):
        # Proves storage + HTTP headers only; no browser script execution claimed.
        raw = b'<svg xmlns="http://www.w3.org/2000/svg"><script>document.documentElement.setAttribute("data-audit","executed")</script></svg>'
        with tempfile.TemporaryDirectory() as td, patch.object(server.os, "getcwd", return_value=td):
            rel, error = server.save_imported_asset({"id": "audit", "name": "untrusted.svg", "data": base64.b64encode(raw).decode()})
            self.assertIsNone(error)
            httpd = server.ThreadedTCPServer(("127.0.0.1", 0), server.CORSRequestHandler)
            thread = threading.Thread(target=httpd.serve_forever, daemon=True)
            thread.start()
            try:
                c = http.client.HTTPConnection("127.0.0.1", httpd.server_address[1], timeout=5)
                c.request("GET", "/" + rel)
                response = c.getresponse()
                body = response.read()
                self.assertEqual(response.status, 200)
                self.assertIn("image/svg+xml", response.getheader("Content-Type"))
                self.assertIsNone(response.getheader("Content-Security-Policy"))
                self.assertIsNone(response.getheader("Content-Disposition"))
                self.assertEqual(body, raw)
                print("PROVEN: imported unsanitized SVG served as", response.getheader("Content-Type"), "without sandbox CSP/attachment")
                c.close()
            finally:
                httpd.shutdown()
                httpd.server_close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
