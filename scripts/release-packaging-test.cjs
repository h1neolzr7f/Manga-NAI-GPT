// Verify the release pipeline's trigger and file dependencies before publishing.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const workflow = read('.github/workflows/build-windows-installer.yml');
assert.match(workflow, /^  push:\s*\r?\n    tags:/m, 'release tags require a push trigger');
assert.doesNotMatch(workflow, /^    paths:/m, 'tag pushes cannot have path filters');
const installer = read('installer/MangaEditorDesuNAI.iss');
const info = installer.match(/^InfoBeforeFile=(.+)$/m)[1].trim();
assert(!info.includes('{#SourceRoot}'), 'pre-install information must remain available when installer sources are excluded from staging');
assert(fs.existsSync(path.resolve(root, 'installer', info.replaceAll('\\', '/'))), 'pre-install information file exists');
assert.match(workflow, /make-one-click-zip\.ps1[^\r\n]+-SourceRoot/, 'portable release must use the prepared runtime payload');
const zip = read('scripts/make-one-click-zip.ps1');
assert.match(zip, /\[string\]\$SourceRoot/, 'portable packager accepts prepared source');
assert.match(zip, /\$robocopyArgs = @\(\$SourceRoot,/, 'portable packager copies the supplied prepared source');
assert.match(installer, /https:\/\/github\.com\/h1neolzr7f\/Manga-NAI-GPT"/, 'installer support links use this repository');
console.log('PASS release packaging: tag trigger, installer information, runtime payload and support links');
