// Builds the "Save recipes from Facebook" browser extension (extension 1.0, after app v37.22) for one
// copy of the app, as a folder and a .zip ready for the browsers' stores.
//
//   node tools/build-extension.mjs live   → dist-extension/live/ + my-kitchen-notes-extension.zip            (Chrome, Edge, Brave, Opera, Vivaldi)
//                                            dist-extension/live-firefox/ + my-kitchen-notes-extension-firefox.zip (Firefox)
//   node tools/build-extension.mjs test   → the same with -TEST
//
// 1.4 (app v37.46) — Tony: "the same extension for other common browsers like
// Edge", installed "as easy and simple as possible". Every Chromium browser runs
// the Chrome package as is (Edge's store takes the same zip); Firefox needs its
// background scripts listed (it has no extension service worker) and an add-on
// id. The Chromium zip is also written to downloads/ (committed) so the app can
// offer it before the stores list it; the zips are byte-for-byte reproducible,
// and CI fails if downloads/ is not what the source builds.
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

// The app's own pages: where appmark.js says the extension is installed.
{
  const mp = path.join(out, 'manifest.json');
  const m0 = JSON.parse(fs.readFileSync(mp, 'utf8'));
  m0.content_scripts.forEach(cs => { cs.matches = cs.matches.map(x => x === 'APP_PAGES' ? app + '*' : x); });
  fs.writeFileSync(mp, JSON.stringify(m0, null, 2) + '\n');
}
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
// Reproducible zips: fixed times, files in a fixed order, no extra attributes.
function zipDir(dir, zipPath) {
  const files = [];
  (function walk(d, rel) { for (const f of fs.readdirSync(d).sort()) { const p = path.join(d, f), r = rel ? rel + '/' + f : f; if (fs.statSync(p).isDirectory()) walk(p, r); else files.push(r); } })(dir, '');
  const t = new Date('2026-01-01T00:00:00Z');
  files.forEach(f => fs.utimesSync(path.join(dir, f), t, t));
  fs.rmSync(zipPath, { force: true });
  execFileSync('zip', ['-q', '-X', '-D', zipPath].concat(files), { cwd: dir, env: Object.assign({}, process.env, { TZ: 'UTC' }) });
}
const tag = which === 'test' ? '-TEST' : '';
const zip = path.join(repo, 'dist-extension', 'my-kitchen-notes-extension' + tag + '.zip');
zipDir(out, zip);

// Firefox: the same files; its manifest lists the background scripts and names the add-on.
const ffOut = out + '-firefox';
fs.rmSync(ffOut, { recursive: true, force: true });
fs.cpSync(out, ffOut, { recursive: true });
{
  const mp = path.join(ffOut, 'manifest.json');
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  m.background = { scripts: ['config.js', 'shared.js', 'background.js'] };
  m.browser_specific_settings = { gecko: { id: 'my-kitchen-notes' + (which === 'test' ? '-test' : '') + '@rozinante2004-hash.github.io', strict_min_version: '121.0' } };
  if (m.options_page) { m.options_ui = { page: m.options_page, open_in_tab: true }; delete m.options_page; }
  fs.writeFileSync(mp, JSON.stringify(m, null, 2) + '\n');
}
const ffZip = path.join(repo, 'dist-extension', 'my-kitchen-notes-extension-firefox' + tag + '.zip');
zipDir(ffOut, ffZip);

// The download the app offers until the stores list it (Chrome, Edge and the rest).
fs.mkdirSync(path.join(repo, 'downloads'), { recursive: true });
fs.copyFileSync(zip, path.join(repo, 'downloads', 'my-kitchen-notes-extension' + tag + '.zip'));
// 1.5 (app v37.51) — which version the downloads hold: the app compares it with
// the version the installed extension reports, and asks to update when newer.
fs.writeFileSync(path.join(repo, 'downloads', 'extension-version.json'),
  JSON.stringify({ version: JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8')).version }) + '\n');
console.log('built the extension (' + which + ') → ' + path.relative(repo, out) + ', ' + path.relative(repo, ffOut)
  + ', downloads/my-kitchen-notes-extension' + tag + '.zip — sends recipes to ' + app);
