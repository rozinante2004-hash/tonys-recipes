#!/usr/bin/env node
/**
 * Build one copy of the app (v36.72, go-public WP-A step 3).
 *
 *     node tools/build.js live     → dist/   (the family's copy — see below)
 *     node tools/build.js test     → dist/   (the test copy, on Cloudflare Pages)
 *
 * `index.html` stays the file that is edited; this does not change how the app
 * is written. It copies the site into dist/ and, for any copy but the live one,
 * rewrites the #appConfig block of the page with that copy's settings from
 * tools/environments.json (and names the installable app after it).
 *
 * The LIVE build is the source, byte for byte: its settings ARE the #appConfig
 * block. That is checked here, every time, rather than trusted.
 *
 * Every other build is checked the other way round: not one of the live
 * copy's Firebase identifiers may survive anywhere in it. A test copy that could
 * reach the family's database would be worse than no test copy at all.
 *
 * Cloudflare Pages runs `node tools/build.js test` on every push (build output
 * directory `dist`). No dependencies — plain Node.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repo = path.resolve(__dirname, '..');
const envName = process.argv[2];
const outDir = path.resolve(repo, (process.argv.indexOf('--out') > -1 ? process.argv[process.argv.indexOf('--out') + 1] : 'dist'));
const envs = JSON.parse(fs.readFileSync(path.join(__dirname, 'environments.json'), 'utf8'));
if (!envName || !envs[envName] || envName.charAt(0) === '_') {
  console.error('usage: node tools/build.js <' + Object.keys(envs).filter(k => k.charAt(0) !== '_').join('|') + '> [--out dir]');
  process.exit(2);
}
const overrides = envs[envName];
function fail(msg) { console.error('BUILD REFUSED (' + envName + '): ' + msg); process.exit(1); }

// ── The #appConfig block ─────────────────────────────────────────────────────
const src = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
const START = 'window.APP_CONFIG = Object.freeze(';
const at = src.indexOf(START);
if (at === -1 || src.indexOf(START, at + 1) !== -1) fail('index.html must hold exactly one `' + START + '`');
// The matching close paren of Object.freeze( … ), skipping strings and comments.
function matchParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "'" || c === '"' || c === '`') {       // a string: jump to its end
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === '\\') i++;
      continue;
    }
    if (c === '/' && text[i + 1] === '/') { i = text.indexOf('\n', i); continue; }
    if (c === '/' && text[i + 1] === '*') { i = text.indexOf('*/', i) + 1; continue; }
    if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i;
  }
  return -1;
}
const open = at + START.length - 1;
const close = matchParen(src, open);
if (close === -1 || src[close + 1] !== ';') fail('could not find the end of the APP_CONFIG block');
const literal = src.slice(open + 1, close);
const live = vm.runInNewContext('(' + literal + ')', { Object });

function merge(base, over) {
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  Object.keys(over).forEach(k => {
    if (k.charAt(0) === '_' || k === 'manifest' || k === 'brand') return;   // notes, and what is not app config
    const v = over[k];
    out[k] = (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object')
      ? merge(base[k], v) : v;
  });
  return out;
}
function literalOf(v, indent) {
  const pad = '  '.repeat(indent);
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const body = Object.keys(v).map(k => pad + '  ' + (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)) + ': ' + literalOf(v[k], indent + 1)).join(',\n');
    return 'Object.freeze({\n' + body + '\n' + pad + '})';
  }
  return JSON.stringify(v).replace(/'/g, "\\u0027").replace(/^"(.*)"$/, "'$1'");
}

let page = src;
const cfg = merge(live, overrides);
if (envName === 'live') {
  if (Object.keys(overrides).some(k => k.charAt(0) !== '_')) fail("the live copy's settings are the #appConfig block itself — put nothing in environments.json 'live'");
} else {
  page = src.slice(0, at) + 'window.APP_CONFIG = ' + literalOf(cfg, 1) + src.slice(close + 1);
  // Nothing of the live Firebase project may survive in another copy.
  const liveIds = [live.firebase.apiKey, live.firebase.projectId, live.firebase.messagingSenderId, live.firebase.appId]
    .filter(id => cfg.firebase.apiKey !== live.firebase.apiKey || id !== live.firebase.apiKey);
  const left = liveIds.filter(id => page.indexOf(id) !== -1);
  if (left.length) fail('the live Firebase project is still named in the page: ' + left.join(', '));
  // …and what was written must read back as intended.
  const a2 = page.indexOf(START) + START.length - 1;
  const back = vm.runInNewContext('(' + page.slice(a2 + 1, matchParen(page, a2)) + ')', { Object });
  if (JSON.stringify(back) !== JSON.stringify(cfg)) fail('the rewritten settings do not read back as intended');
  if (back.environment === 'live') fail("a non-live copy must not call itself 'live'");
  // Its own tab icon (v36.73): the favicon's brown background in this copy's colour.
  if (overrides.brand) {
    const link = /<link rel="icon"[^\n]*?<\/svg>">/.exec(page);   // the SVG inside holds '>' of its own
    const from = "fill='%23" + overrides.brand.iconFrom.slice(1) + "'";
    if (!link || link[0].indexOf(from) === -1) fail('could not find the brown background of the tab icon to recolour');
    page = page.replace(link[0], link[0].split(from).join("fill='%23" + overrides.brand.color.slice(1) + "'"));
  }
}

// ── The site ─────────────────────────────────────────────────────────────────
// Everything the site serves; not the tooling, tests, docs or dependencies.
const SKIP = new Set(['.git', '.github', 'node_modules', 'dist', 'tests', 'tools', 'package.json', 'package-lock.json']);
function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const name of fs.readdirSync(from)) {
    if (SKIP.has(name) || name.endsWith('.md') || name.startsWith('.')) continue;
    const a = path.join(from, name), b = path.join(to, name);
    if (fs.statSync(a).isDirectory()) copyTree(a, b); else fs.copyFileSync(a, b);
  }
}
fs.rmSync(outDir, { recursive: true, force: true });
copyTree(repo, outDir);
// …except what the in-app Self Test itself loads from tests/ (the live site
// serves the whole repository, so there it has always been reachable).
const SELF_TEST_FILES = ['tests/sw-probe.js'];
SELF_TEST_FILES.forEach(f => {
  fs.mkdirSync(path.dirname(path.join(outDir, f)), { recursive: true });
  fs.copyFileSync(path.join(repo, f), path.join(outDir, f));
});
fs.writeFileSync(path.join(outDir, 'index.html'), page);
if (envName === 'live' && fs.readFileSync(path.join(outDir, 'index.html'), 'utf8') !== src) fail('the live page is not the source, byte for byte');

// The installable app's name, so a test copy on a home screen cannot pass for the real one.
if (overrides.manifest) {
  const mf = JSON.parse(fs.readFileSync(path.join(repo, 'manifest.json'), 'utf8'));
  Object.assign(mf, overrides.manifest);
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(mf, null, 2) + '\n');
}
// …and its own home-screen icons, drawn by tools/make-test-icons.mjs (v36.73).
if (overrides.brand && overrides.brand.icons) {
  for (const name of fs.readdirSync(path.join(repo, overrides.brand.icons))) {
    if (!fs.existsSync(path.join(repo, 'icons', name))) fail(overrides.brand.icons + '/' + name + ' replaces no icon in icons/');
    fs.copyFileSync(path.join(repo, overrides.brand.icons, name), path.join(outDir, 'icons', name));
  }
}
// Which build this is, for anyone looking at the deployed files.
fs.writeFileSync(path.join(outDir, 'build-info.json'), JSON.stringify({
  environment: envName, builtAt: new Date().toISOString(),
  commit: process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || null
}, null, 2) + '\n');

console.log('built ' + envName + ' → ' + path.relative(repo, outDir) + '/  (' +
  (envName === 'live' ? 'page identical to the source' : 'project ' + cfg.firebase.projectId + ', site ' + cfg.siteOrigin + cfg.sitePath) + ')');
