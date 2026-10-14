"""Audit 13: the editor's NovelAI size and the local proxy's size policy must agree, or the
init image/mask no longer match the request parameters."""
import importlib.util, json, os, subprocess, sys
root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
spec = importlib.util.spec_from_file_location('server99', os.path.join(root, '99_server.py'))
server = importlib.util.module_from_spec(spec); spec.loader.exec_module(server)
cases = [[1000, 400], [400, 1000], [1600, 900], [600, 1700], [3000, 400], [512, 512], [1, 1], [2000, 2000]]
js = ("const fs=require('fs'),vm=require('vm');const c={window:{}};c.window=c;vm.createContext(c);"
      "vm.runInContext(fs.readFileSync(process.argv[1],'utf8'),c);"
      "process.stdout.write(JSON.stringify(JSON.parse(process.argv[2]).map(([w,h])=>c.NaiEngineCore.sizeFor(w,h))));")
front = json.loads(subprocess.check_output(['node', '-e', js, os.path.join(root, 'js/ai/nai-engine-core.js'), json.dumps(cases)]))
for (w, h), f in zip(cases, front):
    back = server._safe_nai_size(f['width'], f['height'])
    assert back == f, ('13: proxy changed editor size', (w, h), f, back)
print('PASS 13 editor and proxy NovelAI sizes agree for', len(cases), 'aspect cases')
