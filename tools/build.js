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
// v37.59 — a copy whose settings are still to be filled in (the beta, until
// Tony sends its Firebase project's settings) is not built at all.
if (JSON.stringify(overrides).indexOf('"FILL-IN"') !== -1) fail('its settings in tools/environments.json are not filled in yet (FILL-IN)');

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
    if (k.charAt(0) === '_' || k === 'manifest' || k === 'brand' || k === 'homeScreen') return;   // notes, and what is not app config
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
  // The Content-Security-Policy <meta> is read by the browser before any script
  // runs, so APP_CONFIG cannot reach it — the build does (v36.82). A copy with
  // its own Worker gets that Worker in connect-src in place of the live one.
  if (cfg.workerUrl !== live.workerUrl) {
    const liveHost = new URL(live.workerUrl).host, ownHost = new URL(cfg.workerUrl).host;
    const csp = /<meta http-equiv="Content-Security-Policy" content="[^"]*">/.exec(page);
    if (!csp || csp[0].indexOf(liveHost) === -1) fail('could not find the live Worker in the Content-Security-Policy to replace');
    page = page.replace(csp[0], csp[0].split(liveHost).join(ownHost));
  }
  // Nothing of the live Firebase project may survive in another copy.
  const liveIds = [live.firebase.apiKey, live.firebase.projectId, live.firebase.messagingSenderId, live.firebase.appId]
    .filter(id => cfg.firebase.apiKey !== live.firebase.apiKey || id !== live.firebase.apiKey);
  // …except in `languageSource` (v36.88): every copy reads its interface
  // languages — the app's own words, public by the rules — from the family
  // project on purpose. That one setting is left out of the scan; anything
  // else naming the live project still refuses the build.
  const scanned = page.replace(/languageSource: Object\.freeze\(\{[^}]*\}\)/, 'languageSource: (checked)');
  if (scanned === page && cfg.languageSource) fail('could not find languageSource to set aside for the live-project check');
  const left = liveIds.filter(id => scanned.indexOf(id) !== -1);
  if (left.length) fail('the live Firebase project is still named in the page: ' + left.join(', '));
  // …and what was written must read back as intended.
  const a2 = page.indexOf(START) + START.length - 1;
  const back = vm.runInNewContext('(' + page.slice(a2 + 1, matchParen(page, a2)) + ')', { Object });
  if (JSON.stringify(back) !== JSON.stringify(cfg)) fail('the rewritten settings do not read back as intended');
  if (back.environment === 'live') fail("a non-live copy must not call itself 'live'");
  // v38.61 — the app's own name in the page itself. The script in <head> renamed the logos only at
  // DOMContentLoaded, after the whole 2 MB page: a first visit on a phone showed "Tony's Recipes" for 1.5–3 s
  // (the audit's filmstrip, 20 Oct), and a link preview (WhatsApp, Gmail), which runs no script, said "Tony's
  // Recipes Collection" for the tester invitation's link. A link preview reads og: tags, so those too.
  if (cfg.brandName) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const m = /^(.*?)(Kitchen Notes|Recipes)(.*)$/.exec(cfg.brandName);
    const logo = m ? esc(m[1]) + '<span>' + esc(m[2]) + '</span>' + esc(m[3]) : esc(cfg.brandName);
    const home = cfg.siteOrigin + cfg.sitePath, about = 'Your personal recipe collection, synced across all your devices.';
    [[/<title>[^<]*<\/title>/, '<title>' + esc(cfg.brandName) + '</title>\n'
        + '<meta name="description" content="' + esc(about) + '">\n'
        + '<meta property="og:type" content="website">\n'
        + '<meta property="og:title" content="' + esc(cfg.brandName) + '">\n'
        + '<meta property="og:description" content="' + esc(about) + '">\n'
        + '<meta property="og:url" content="' + esc(home) + '">\n'
        + '<meta property="og:image" content="' + esc(home + 'icons/icon-512.png') + '">', 'the page title'],
     [/<div class="logo">Tony's <span>Recipes<\/span> Collection<\/div>/, '<div class="logo" data-no-i18n>' + logo + '</div>', "the header's name"],
     [/<div class="login-logo">Tony's <span>Recipes<\/span><\/div>/, '<div class="login-logo" data-no-i18n>' + logo + '</div>', "the sign-in screen's name"]
    ].forEach(([re, to, what]) => {
      if (!re.test(page)) fail('could not find ' + what + " to give it the app's name");
      page = page.replace(re, () => to);
    });
  }
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
const SKIP = new Set(['.git', '.github', 'node_modules', 'dist', 'tests', 'tools', 'docs', 'package.json', 'package-lock.json']);
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
// Every copy: its Content-Security-Policy must let the page reach its own Worker.
{
  const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/.exec(page);
  if (!csp) fail('the page has no Content-Security-Policy');
  if (csp[1].indexOf(new URL(cfg.workerUrl).host) === -1) fail('the Content-Security-Policy does not allow ' + cfg.workerUrl + ' — every AI call would be blocked');
}

// v38.21 — what an iPhone keeps from the moment the icon is added: its label and
// the status bar's style (see environments.json, _why_homeScreen).
if (overrides.homeScreen) {
  const hs = overrides.homeScreen;
  if (hs.title) {
    const t = /<meta name="apple-mobile-web-app-title" content="[^"]*">/;
    if (!t.test(page)) fail('could not find the home-screen title to replace');
    page = page.replace(t, '<meta name="apple-mobile-web-app-title" content="' + hs.title.replace(/"/g, '&quot;') + '">');
  }
  if (hs.statusBar) {
    if (['default', 'black', 'black-translucent'].indexOf(hs.statusBar) === -1) fail('homeScreen.statusBar must be default, black or black-translucent');
    const b = /<meta name="apple-mobile-web-app-status-bar-style" content="[^"]*">/;
    if (!b.test(page)) fail('could not find the status-bar style to replace');
    page = page.replace(b, '<meta name="apple-mobile-web-app-status-bar-style" content="' + hs.statusBar + '">');
  }
  fs.writeFileSync(path.join(outDir, 'index.html'), page);
}
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
// v38.72 — what a device downloads, without the comments (tools/strip-comments.js): the community and test copies
// lose a quarter of their weight; the family's copy stays the source, byte for byte. Every stripped inline script must
// still parse, or the build is refused.
if (envName !== 'live') {
  const { stripHtml } = require('./strip-comments');
  const full = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8'), lean = stripHtml(full);
  const re = /<!--[\s\S]*?-->|(<script\b[^>]*>)([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(lean))) {
    if (!m[1] || /\bsrc\s*=/i.test(m[1]) || /\btype\s*=\s*["']?(?!text\/javascript|module)/i.test(m[1])) continue;
    try { new vm.Script(m[2]); } catch (e) { fail('a script no longer parses once its comments are taken out (' + e.message + ') — see tools/check-strip.js'); }
  }
  fs.writeFileSync(path.join(outDir, 'index.html'), lean);
  console.log('comments taken out: ' + Math.round(Buffer.byteLength(full) / 1024) + ' KB → ' + Math.round(Buffer.byteLength(lean) / 1024) + ' KB');
}
// Which build this is, for anyone looking at the deployed files.
fs.writeFileSync(path.join(outDir, 'build-info.json'), JSON.stringify({
  environment: envName, builtAt: new Date().toISOString(),
  commit: process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || null
}, null, 2) + '\n');

// ── Google sign-in, served from this copy's own address (v36.78) ────────────
// On an iPhone, sign-in run on <project>.firebaseapp.com stops half-way with
// "missing initial state": Safari keeps that site's storage apart from the
// app's. Firebase's documented remedy ("self-host the helper code") is to serve
// its sign-in pages from the app's own address and make that the authDomain.
// When a copy's authDomain IS its own address, those files are fetched from its
// Firebase project here, at build time, into dist/__/. They are Google's files,
// unchanged, and nothing in them is secret; fetching them on every build keeps
// them current. `handler` and `iframe` are pages, saved as .html so the host
// serves them as pages (both Cloudflare Pages and GitHub Pages answer
// /__/auth/handler with handler.html).
// The family's copy lives at the ROOT of rozinante2004-hash.github.io, which is
// another repository; its files are fetched there, the same way.
const AUTH_HELPERS = [
  ['__/auth/handler', '__/auth/handler.html'], ['__/auth/handler.js', '__/auth/handler.js'],
  ['__/auth/experiments.js', '__/auth/experiments.js'], ['__/auth/iframe', '__/auth/iframe.html'],
  ['__/auth/iframe.js', '__/auth/iframe.js'], ['__/firebase/init.json', '__/firebase/init.json']
];
async function fetchAuthHelpers() {
  if (envName === 'live') return 'n/a';
  const siteHost = new URL(cfg.siteOrigin).host;
  if (cfg.firebase.authDomain !== siteHost) return 'not needed (sign-in runs on ' + cfg.firebase.authDomain + ')';
  if (process.env.SKIP_AUTH_HELPERS === '1') return 'SKIPPED (SKIP_AUTH_HELPERS=1) — sign-in will not work in this build';
  const from = 'https://' + cfg.firebase.projectId + '.firebaseapp.com/';
  const skipped = [];
  for (const [src, dest] of AUTH_HELPERS) {
    let res;
    try { res = await fetch(from + src, { redirect: 'follow' }); }
    catch (e) { fail('could not fetch ' + from + src + ' (' + e.message + ') — set SKIP_AUTH_HELPERS=1 to build without sign-in'); }
    // init.json exists only for a project that uses Firebase Hosting (the test
    // project does not). Sign-in works without it — the v36.75 relay passed its
    // 404 straight through and Tony signed in on both devices — so it is
    // optional; every other file is required.
    if (res.status === 404 && src.endsWith('init.json')) { skipped.push(src); continue; }
    if (!res.ok) fail(from + src + ' answered ' + res.status);
    const body = Buffer.from(await res.arrayBuffer());
    if (!body.length) fail(from + src + ' came back empty');
    if (src.endsWith('init.json') && JSON.parse(body.toString('utf8')).projectId !== cfg.firebase.projectId)
      fail('init.json is for another Firebase project');
    fs.mkdirSync(path.dirname(path.join(outDir, dest)), { recursive: true });
    fs.writeFileSync(path.join(outDir, dest), body);
  }
  return (AUTH_HELPERS.length - skipped.length) + ' sign-in files from ' + from + (skipped.length ? ' (' + skipped.join(', ') + ' not published there — optional)' : '');
}

fetchAuthHelpers().then(function (helpers) {
  console.log('built ' + envName + ' → ' + path.relative(repo, outDir) + '/  (' +
    (envName === 'live' ? 'page identical to the source' : 'project ' + cfg.firebase.projectId + ', site ' + cfg.siteOrigin + cfg.sitePath
      + '; sign-in: ' + helpers) + ')');
});
