// Builds the "Save recipes from Facebook" browser extension (extension 1.0, after app v37.22) for one
// copy of the app, as a folder and a .zip ready for the Chrome Web Store.
//
//   node tools/build-extension.mjs live   → dist-extension/live/ + my-kitchen-notes-extension.zip
//   node tools/build-extension.mjs test   → dist-extension/test/ + my-kitchen-notes-extension-TEST.zip
//
// The only difference is where "Save recipe" sends the text: the family app
// (and later the public one) or the test copy. The test build says TEST in its
// name, so the two can sit side by side in Chrome.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const which = process.argv[2];
if (!['live', 'test'].includes(which)) { console.error('usage: node tools/build-extension.mjs <live|test>'); process.exit(2); }

const html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
const envs = JSON.parse(fs.readFileSync(path.join(repo, 'tools/environments.json'), 'utf8'));
const base = {
  siteOrigin: (/siteOrigin:\s*'([^']+)'/.exec(html) || [])[1],
  sitePath:   (/sitePath:\s*'([^']+)'/.exec(html) || [])[1],
};
const cfg = Object.assign({}, base, envs[which] || {});
if (!cfg.siteOrigin || !cfg.sitePath) { console.error('could not find the site address'); process.exit(1); }
const app = cfg.siteOrigin + cfg.sitePath;

const out = path.join(repo, 'dist-extension', which);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
const src = path.join(repo, 'extension');
for (const f of fs.readdirSync(src)) {
  if (f === 'icons' || f.endsWith('.md')) continue;
  fs.copyFileSync(path.join(src, f), path.join(out, f));
}
for (const f of fs.readdirSync(path.join(src, 'icons'))) fs.copyFileSync(path.join(src, 'icons', f), path.join(out, 'icons', f));

fs.writeFileSync(path.join(out, 'config.js'),
  '// Written by tools/build-extension.mjs (' + which + ').\n'
  + 'var MKN_APP = ' + JSON.stringify(app) + ';\n'
  + 'var MKN_APP_NAME = ' + JSON.stringify('My Kitchen Notes' + (which === 'test' ? ' (TEST)' : '')) + ';\n'
  + 'var MKN_TAG = ' + JSON.stringify(which) + ';\n');
if (which === 'test') {
  const m = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
  m.name = m.name + ' (TEST)';
  m.short_name = 'MKN (TEST)';
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(m, null, 2) + '\n');
}
const zip = path.join(repo, 'dist-extension', 'my-kitchen-notes-extension' + (which === 'test' ? '-TEST' : '') + '.zip');
fs.rmSync(zip, { force: true });
execFileSync('zip', ['-qr', zip, '.'], { cwd: out });
console.log('built the extension (' + which + ') → ' + path.relative(repo, out) + ' and ' + path.relative(repo, zip) + ' — sends recipes to ' + app);
