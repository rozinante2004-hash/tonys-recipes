#!/usr/bin/env node
/**
 * End-to-end sync tests (v36.71, go-public WP-A step 2).
 *
 * The app, in real browsers, signed in, syncing through a REAL Firestore — the
 * Firebase emulator — as several devices at once. Until this file the suite had
 * never once run the app signed in: every sync test used a fake database built
 * inside the test, which checks what the code does with an answer, never
 * whether the answer is right. This checks the whole round trip, against the
 * published rules, with the same Firebase SDK version the live app loads.
 *
 *     cd <a folder with firebase-tools@13, @firebase/rules-unit-testing@5,
 *        firebase@<the version index.html loads> and playwright installed>
 *     npx firebase emulators:exec --only firestore,auth --project demo-tonys \
 *       "node <repo>/tests/e2e-sync.mjs"
 *
 * It serves the app itself, from a small local server that adds the two
 * emulator addresses to the page's Content-Security-Policy on the way out. (A
 * page rewritten by the browser test tool instead counts as coming from the
 * internet, and Chrome then refuses to let it reach 127.0.0.1 at all.)
 *
 * Nothing here can touch the family's data. The app only uses the emulator when
 * it is served from this computer's own address AND the test sets
 * __FIREBASE_EMULATOR__ before the page loads AND the project is a `demo-` one
 * (which the SDK guarantees never reaches a real backend).
 *
 * The Firebase SDK is served from node_modules in place of www.gstatic.com, so
 * the test does not depend on reaching Google's CDN — and is pinned to the
 * version the app asks for (a mismatch fails the run rather than testing a
 * different SDK from the one the family's phones load).
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i > -1 ? argv[i + 1] : d; };
let PORT = 0;                     // chosen when the local server starts
const EMU = { host: '127.0.0.1', firestorePort: 8085, authPort: 9099, projectId: 'demo-tonys' };
// v36.85 (WP-D) — `--layout households` runs the same checks with every
// household in its own space (APP_CONFIG.dataLayout = 'households', rules from
// the HOUSEHOLDS part of firestore.rules), plus the household-only ones: places kept by
// e-mail being taken up, a newcomer founding a separate household, and joining
// by invitation link. The family's household is seeded as `e2e-home`.
const LAYOUT = arg('layout', process.env.E2E_LAYOUT || 'shared');
const HH = LAYOUT === 'households';
let SERVE_HH = HH;      // the layout the served page runs in — switched mid-run by the move test
let HID = null;   // the household the owner founds at first sign-in
let SEED = null, SEED_AT = 0;
// The household the owner founded, filled as the family's will be at
// migration: its recipes, and a place kept for each member's address.
async function fillHousehold(hid) {
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), h = 'households/' + hid;
    await fs.updateDoc(fs.doc(db, h), { name: 'E2E family' });
    await fs.setDoc(fs.doc(db, h + '/recipes/4000'), { r: JSON.stringify(SEED), updatedAt: SEED_AT, id: 4000 });
    await fs.setDoc(fs.doc(db, h + '/state/meta'), { nextId: 5000, ids: [4000], schema: 2, updatedAt: SEED_AT });
    await fs.setDoc(fs.doc(db, 'pending/' + hid + ':' + WRITER), { hid, email: WRITER, role: 'editor' });
    await fs.setDoc(fs.doc(db, 'pending/' + hid + ':' + READER), { hid, email: READER, role: 'viewer' });
  });
}
const uidOnPage = d => d.page.evaluate(() => window._fbUser && window._fbUser.uid);

// Dependencies come from the folder the test is run in (CI installs them there),
// then from the repo, then from this sandbox's global install.
const reqCwd = createRequire(path.join(process.cwd(), 'noop.js'));
const reqRepo = createRequire(path.join(repo, 'noop.js'));
function resolveDep(name) {
  for (const r of [reqCwd, reqRepo]) { try { return r.resolve(name); } catch (e) {} }
  const g = '/opt/node22/lib/node_modules/' + name;
  if (existsSync(g)) return g;
  throw new Error('cannot find ' + name + ' — install it in the folder you run this from');
}
const { chromium } = reqCwd(resolveDep('playwright'));
const rut = await import(pathToFileURL(resolveDep('@firebase/rules-unit-testing')).href);
const fs = await import(pathToFileURL(resolveDep('firebase/firestore')).href);
const sdkDir = path.dirname(resolveDep('firebase/package.json'));
const sdkVersion = JSON.parse(readFileSync(path.join(sdkDir, 'package.json'), 'utf8')).version;

const html = readFileSync(path.join(repo, 'index.html'), 'utf8');
const wantSdk = (html.match(/gstatic\.com\/firebasejs\/([\d.]+)\/firebase-app-compat\.js/) || [])[1];
if (wantSdk !== sdkVersion) {
  console.error(`the app loads Firebase ${wantSdk}, but ${sdkVersion} is installed here — install firebase@${wantSdk}`);
  process.exit(2);
}
const OWNER  = (html.match(/ownerEmail:\s*'([^']+)'/) || [])[1];
const WRITER = 'writer@example.com';
const READER = 'reader@example.com';

// The published rules, filled in the way the app fills them.
const q = list => list.map(e => '"' + e + '"').join(', ');
const rules = readFileSync(path.join(repo, 'firestore.rules'), 'utf8')
  .replace(/\{\{APP_ADMINS\}\}/g, '"' + OWNER + '"')
  .replace(/\{\{READ\}\}/g,  q([OWNER, WRITER, READER]))
  .replace(/\{\{WRITE\}\}/g, q([OWNER, WRITER]))
  .replace(/\{\{ADMIN\}\}/g, q([OWNER]));
const env = await rut.initializeTestEnvironment({
  projectId: EMU.projectId,
  firestore: { rules, host: EMU.host, port: EMU.firestorePort }
});
await env.clearFirestore();
await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();       // ONCE: each call re-applies emulator settings, and a second one throws
  // A family cloud always has its meta record; an EMPTY cloud is a different
  // first-run path ("nothing to load"), and not the one being tested here.
  // …and at least one recipe: only a load that brings something down counts
  // as a completed sync in the app, which is right for a real family cloud.
  const t0 = Date.now() - 60000;
  const seed = { id: 4000, uid: 'e2e-seed', name: 'E2E seed stew', emoji: '🍲', category: 'Dinner', difficulty: 'Easy',
                 prep: '1 h', servings: '4', ingredients: [{ a: '1', n: 'carrot' }], steps: ['Stew.'], updatedAt: t0 };
  SEED = seed; SEED_AT = t0;
  if (HH) {
    // Filled in once the owner has founded the household (see below).
  } else {
    await fs.setDoc(fs.doc(db, 'shared/recipe_4000'), { r: JSON.stringify(seed), updatedAt: t0, id: 4000 });
    await fs.setDoc(fs.doc(db, 'shared/meta'), { nextId: 5000, ids: [4000], schema: 2, updatedAt: t0 });
    // The app's languages, where every copy reads them (v36.88).
    await fs.setDoc(fs.doc(db, 'shared/i18n_he'), { strings: { 'Save': 'שמור', 'Search recipes, ingredients…': 'חיפוש מתכונים, מרכיבים…' }, count: 2 });
    await fs.setDoc(fs.doc(db, 'shared/i18n_index'), { langs: { he: { at: t0, count: 2 } }, probed: true });
    await fs.setDoc(fs.doc(db, 'shared/access'), { members: [
      { email: WRITER, role: 'write' }, { email: READER, role: 'read' } ], updatedAt: Date.now() });
  }
});
// Reads straight from the emulator's REST API as its "owner", which bypasses
// the rules — what is REALLY in the cloud, not what any device believes.
function fromValue(v) {
  if (!v) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) { const o = {}; Object.entries(v.mapValue.fields || {}).forEach(([k, x]) => { o[k] = fromValue(x); }); return o; }
  return null;
}
async function restDoc(docPath) {
  const r = await fetch(`http://${EMU.host}:${EMU.firestorePort}/v1/projects/${EMU.projectId}/databases/(default)/documents/${docPath}`,
                        { headers: { Authorization: 'Bearer owner' } });
  if (r.status === 404) return null;
  const j = await r.json();
  return fromValue({ mapValue: { fields: j.fields || {} } });
}
// A document by its first-layout name, wherever the layout under test keeps it.
function cloudDoc(id) {
  if (!HH) return restDoc('shared/' + id);
  const h = 'households/' + HID + '/';
  if (id.startsWith('recipe_')) return restDoc(h + 'recipes/' + id.slice(7));
  if (id.startsWith('photo_'))  return restDoc(h + 'photos/' + id.slice(6));
  return restDoc(h + 'state/' + id);
}
const cloudRecipe = async id => { const d = await cloudDoc('recipe_' + id); return d && d.r ? JSON.parse(d.r) : d; };

let failures = 0;
function ok(name, cond, detail) {
  if (cond) console.log('  ok   ' + name);
  else { failures++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
async function until(fn, ms = 15000, step = 250) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > ms) return v;
    await new Promise(r => setTimeout(r, step));
  }
}

// The app, served from the repository — with the emulator addresses added to
// its Content-Security-Policy. Only this test's copy; the published page is
// untouched.
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json',
                '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(repo, path.normalize(p));
  if (!file.startsWith(repo) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
  let body = readFileSync(file);
  if (p === '/index.html') {
    body = body.toString('utf8').replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*?connect-src )/,
      `$1http://${EMU.host}:${EMU.authPort} http://${EMU.host}:${EMU.firestorePort} `);
    if (SERVE_HH) {
      const before = body;
      body = body.replace(/dataLayout:(\s*)'shared'/, "dataLayout:$1'households'");
      if (body === before) throw new Error('could not switch the page to the household layout');
    }
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
PORT = server.address().port;

const browser = await chromium.launch({ args: ['--disable-renderer-backgrounding',
  '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows'] });
const devices = [];

// One device: its own browser profile (so its own localStorage and IndexedDB,
// exactly like a second phone), signed in as `email`.
async function device(label, email, opts = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  if (process.env.E2E_DEBUG) {
    page.on('requestfailed', r => console.log('    [' + label + '] request failed: ' + r.url().slice(0, 90) + ' — ' + (r.failure() && r.failure().errorText)));
    page.on('console', m => { if (/error|refused|CSP|Content Security/i.test(m.text())) console.log('    [' + label + '] console: ' + m.text().slice(0, 160)); });
  }
  await ctx.route(/www\.gstatic\.com\/firebasejs\/[\d.]+\/(firebase-[a-z-]+\.js)$/, (route) => {
    const file = route.request().url().split('/').pop();
    route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(path.join(sdkDir, file)) });
  });
  await ctx.route(/accounts\.google\.com/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  await ctx.route(/workers\.dev/, r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"no Worker in the e2e run"}' }));
  await ctx.addInitScript(emu => { window.__FIREBASE_EMULATOR__ = emu; }, EMU);
  await page.goto(`http://127.0.0.1:${PORT}/index.html${opts.query || ''}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window._fbAuth && window._fbEmulated === true, null, { timeout: 20000 });
  await page.evaluate(async (who) => {
    window._justSignedIn = true;               // the app's "just signed in", not an auto-login
    const cred = firebase.auth.GoogleAuthProvider.credential(
      JSON.stringify({ sub: 'uid-' + who.replace(/\W/g, ''), email: who, email_verified: true }));
    await window._fbAuth.signInWithCredential(cred);
  }, email);
  // Signed in, and the first load from the cloud has finished.
  try {
    if (opts.ready === 'household')        // a brand-new household has nothing to load yet
      await page.waitForFunction(() => window._fbUser && typeof householdOf === 'function' && householdOf(), null, { timeout: 30000 });
    else
      await page.waitForFunction(() => window._driveMode && window._fbUser && window._lastSyncOkAt, null, { timeout: 30000 });
  } catch (e) {
    const st = await page.evaluate(() => ({ drive: !!window._driveMode, user: window._fbUser && window._fbUser.email,
      lastSync: window._lastSyncOkAt, status: (document.getElementById('dsText') || {}).textContent,
      recent: (typeof recentErrors === 'function' ? recentErrors() : []).slice(-3).map(x => x.message),
      layout: typeof cloudLayout === 'function' ? cloudLayout() : '?',
      household: typeof householdOf === 'function' ? householdOf() : '?',
      log: (() => { try { return JSON.parse(localStorage.getItem('tonys_sync_log') || '[]').slice(-6).map(e => e.k + ': ' + e.m + (e.d ? ' ' + JSON.stringify(e.d).slice(0, 120) : '')); } catch (e) { return []; } })() }));
    throw new Error(label + ' never finished its first sync: ' + JSON.stringify(st) + ' — ' + errors.slice(0, 2).join(' | '));
  }
  const d = { label, email, page, ctx, errors };
  devices.push(d);
  return d;
}
const inPage = (d, fn, arg) => d.page.evaluate(fn, arg);
// What a person on that device does: waits for "🔄 New changes available",
// then taps it. The app does not apply another device's changes behind your
// back — it offers them (onSnapshot on shared/meta → the banner).
async function tapRefreshWhenOffered(d, ms = 15000) {
  const shown = await until(() => inPage(d, () => {
    const b = document.getElementById('refreshBanner');
    return !!(b && getComputedStyle(b).display !== 'none');
  }), ms);
  if (!shown) return false;
  await d.page.click('#refreshBanner');
  return true;
}
const names = d => inPage(d, () => recipes.map(r => r.name));

try {
  console.log('Signing in');
  let A;
  if (HH) {
    A = await device('A (owner)', OWNER, { ready: 'household' });
    const h = await inPage(A, () => householdOf());
    ok('the owner, signing in for the first time, founds a household', h && h.role === 'owner', JSON.stringify(h));
    HID = h.hid;
    await fillHousehold(HID);
    await A.page.reload({ waitUntil: 'domcontentloaded' });
    await A.page.waitForFunction(() => window._driveMode && window._fbUser && window._lastSyncOkAt, null, { timeout: 30000 });
  } else {
    A = await device('A (owner)', OWNER);
    // v36.97 — the translations were seeded where the first layout kept them
    // (shared/i18n_*); the owner's sign-in copies them to i18n/… (both layouts).
    const moved = await inPage(A, () => { try { localStorage.removeItem('tonys_langs_moved'); } catch (e) {} return i18nMoveToAppWide(); });
    const movedHe = await restDoc('i18n/he'), movedIdx = await restDoc('i18n/_index'), oldHe = await restDoc('shared/i18n_he');
    ok('the owner\'s sign-in moves the translations to their app-wide place (v36.97)',
      movedHe && movedHe.strings && movedHe.strings.Save === 'שמור', JSON.stringify({ moved, movedHe }));
    ok('…the language list last', movedIdx && movedIdx.langs && movedIdx.langs.he && movedIdx.movedFrom === 'shared', JSON.stringify(movedIdx));
    ok('…and the old copy is left as it was', oldHe && oldHe.strings && oldHe.strings.Save === 'שמור', JSON.stringify(oldHe));
    {
      // v36.88 — every translated language, for everyone, without signing in.
      console.log('Languages for everyone');
      const ctx0 = await browser.newContext({ serviceWorkers: 'block' });
      const p0 = await ctx0.newPage();
      await ctx0.route(/www\.gstatic\.com\/firebasejs\/[\d.]+\/(firebase-[a-z-]+\.js)$/, (route) =>
        route.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(path.join(sdkDir, route.request().url().split('/').pop())) }));
      await ctx0.route(/accounts\.google\.com|workers\.dev/, r => r.fulfill({ status: 503, body: '' }));
      await ctx0.addInitScript(emu => { window.__FIREBASE_EMULATOR__ = emu; }, EMU);
      await p0.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
      await p0.waitForFunction(() => window._fbEmulated === true, null, { timeout: 20000 });
      const known = await p0.evaluate(async () => { await i18nCentralIndex(true); return i18nKnownLangs(); });
      ok('a visitor who has not signed in sees every translated language', known.includes('he'), JSON.stringify(known));
      const heSave = await p0.evaluate(async () => { const d = await i18nLoadDict('he'); return d && d['Save']; });
      ok('…and can switch to one, straight from the central copy', heSave === 'שמור', JSON.stringify(heSave));
      await ctx0.close();
    }
  }
  ok('the owner signs in and syncs against the emulator', true);
  const B = await device('B (writer)', WRITER);
  ok('a writer signs in on a second device', true);

  console.log('A recipe travels');
  const id = await inPage(A, () => {
    const id = nextId++;
    recipes.push(normalizeRecipe({ id, name: 'E2E soup', ingredients: [{ a: '1', n: 'onion' }], steps: ['Simmer.'], updatedAt: Date.now() }));
    saveData(); renderGrid();
    return id;
  });
  const up = await until(() => cloudRecipe(id));
  ok('a recipe added on A reaches the cloud', up && up.name === 'E2E soup', JSON.stringify(up));
  ok('B is offered the change ("New changes available")', await tapRefreshWhenOffered(B));
  const seen = await until(async () => (await names(B)).includes('E2E soup'));
  ok('…and after the tap, B has it', seen, JSON.stringify(await names(B)));

  await inPage(A, (id) => {
    const r = recipes.find(x => x.id === id); r.name = 'E2E soup, renamed'; r.updatedAt = Date.now(); saveData();
  }, id);
  await tapRefreshWhenOffered(B);
  const renamed = await until(async () => (await names(B)).includes('E2E soup, renamed'));
  ok('a rename on A reaches B', renamed, JSON.stringify(await names(B)));

  console.log('Both ways');
  await inPage(B, (id) => {
    const r = recipes.find(x => x.id === id); r.notes = 'B was here'; r.updatedAt = Date.now(); saveData();
  }, id);
  ok('an edit on the WRITER\'s device reaches the cloud',
     await until(async () => ((await cloudRecipe(id)) || {}).notes === 'B was here'), JSON.stringify(await cloudRecipe(id)));
  ok('A is offered it', await tapRefreshWhenOffered(A));
  ok('…and has it', await until(() => inPage(A, (id) => (recipes.find(x => x.id === id) || {}).notes === 'B was here', id)));

  console.log('Two devices change the same recipe');
  // Both hold the same version. B saves first; A, which has NOT taken B's
  // change, saves second. A's save must be refused — never an overwrite.
  await inPage(B, (id) => {
    const r = recipes.find(x => x.id === id); r.name = 'Changed on B'; r.updatedAt = Date.now(); saveData();
  }, id);
  await until(async () => ((await cloudRecipe(id)) || {}).name === 'Changed on B');
  await inPage(A, (id) => {
    const r = recipes.find(x => x.id === id); r.name = 'Changed on A, unaware'; r.updatedAt = Date.now(); saveData();
  }, id);
  const refused = await until(() => inPage(A, () => {
    const o = document.getElementById('serviceErrorOverlay');
    return !!(o && /EDITED_ELSEWHERE|changed on another device/i.test(o.textContent));
  }));
  ok('A is told its save was refused, and why', refused);
  await new Promise(r => setTimeout(r, 2500));
  ok('the cloud still holds B\'s version — nothing was overwritten', ((await cloudRecipe(id)) || {}).name === 'Changed on B',
     JSON.stringify(((await cloudRecipe(id)) || {}).name));
  ok('A\'s own version is still on A — nothing was lost either',
     await inPage(A, (id) => (recipes.find(x => x.id === id) || {}).name === 'Changed on A, unaware', id));
  await inPage(A, () => { const o = document.getElementById('serviceErrorOverlay'); if (o) o.remove(); });

  console.log('Deleting');
  const doomed = await inPage(A, () => {
    const id = nextId++;
    recipes.push(normalizeRecipe({ id, name: 'E2E to delete', ingredients: [], steps: ['x'], updatedAt: Date.now() }));
    saveData(); return id;
  });
  await until(() => cloudRecipe(doomed));
  await tapRefreshWhenOffered(B);
  await until(async () => (await names(B)).includes('E2E to delete'));
  // A WRITER's delete: the rules refuse it, the recipe stays in the cloud,
  // and the writer is told rather than left thinking it worked.
  await inPage(B, (id) => { window.askConfirm = async () => true; return deleteRecipe(id); }, doomed);
  await new Promise(r => setTimeout(r, 4000));
  ok('a writer\'s delete is refused — the recipe is still in the cloud', !!(await cloudRecipe(doomed)));
  ok('…and the writer is told', await inPage(B, () => {
    const o = document.getElementById('serviceErrorOverlay');
    return !!(o && /DELETE|admin|only/i.test(o.textContent));
  }));
  await inPage(B, () => { const o = document.getElementById('serviceErrorOverlay'); if (o) o.remove(); });
  // The OWNER's delete goes through, and reaches the other device.
  await inPage(A, (id) => { window.askConfirm = async () => true; return deleteRecipe(id); }, doomed);
  ok('the owner\'s delete removes it from the cloud', await until(async () => !(await cloudRecipe(doomed))));
  await tapRefreshWhenOffered(B);
  ok('…and from the other device', await until(async () => !(await names(B)).includes('E2E to delete')), JSON.stringify(await names(B)));

  console.log('A read-only member');
  const C = await device('C (reader)', READER);
  ok('a reader signs in and sees the recipes', (await names(C)).includes('E2E seed stew'), JSON.stringify(await names(C)));
  const before = JSON.stringify(await cloudRecipe(4000));
  await inPage(C, () => { const r = recipes.find(x => x.id === 4000); r.name = 'Reader was here'; r.updatedAt = Date.now(); saveData(); });
  await new Promise(r => setTimeout(r, 4000));
  ok('a reader\'s edit does not reach the cloud', JSON.stringify(await cloudRecipe(4000)) === before);

  console.log('Offline, then back');
  await B.ctx.setOffline(true);
  await inPage(B, () => window.dispatchEvent(new Event('offline')));
  await inPage(B, () => { const r = recipes.find(x => x.id === 4000); r.notes = 'written offline'; r.updatedAt = Date.now(); saveData(); });
  await new Promise(r => setTimeout(r, 2500));
  ok('while offline, nothing reaches the cloud (and nothing breaks)', ((await cloudRecipe(4000)) || {}).notes !== 'written offline');
  await B.ctx.setOffline(false);
  await inPage(B, () => window.dispatchEvent(new Event('online')));
  ok('back online, the offline edit goes up by itself', await until(async () => ((await cloudRecipe(4000)) || {}).notes === 'written offline', 20000),
     JSON.stringify(((await cloudRecipe(4000)) || {}).notes));

  if (HH) {
    console.log('Households');
    const wm = await restDoc('households/' + HID + '/members/' + await uidOnPage(B));
    ok('the writer took up the place kept for them, as an editor', wm && wm.role === 'editor', JSON.stringify(wm));
    ok('…and the kept place is gone', !(await restDoc('pending/' + HID + ':' + WRITER)));
    const rm = await restDoc('households/' + HID + '/members/' + await uidOnPage(C));
    ok('the reader is a viewer', rm && rm.role === 'viewer', JSON.stringify(rm));
    ok('the owner is in the family household, as owner',
       await inPage(A, () => { const h = householdOf(); return h && h.role === 'owner' && h.name === 'E2E family'; }));

    const N = await device('N (newcomer)', 'newcomer@example.com', { ready: 'household' });
    const nh = await inPage(N, () => householdOf());
    ok('a newcomer founds a household of their own', nh && nh.hid !== HID && nh.role === 'owner', JSON.stringify(nh));
    ok('…named after them', /Newcomer.s Kitchen Notes/.test(nh && nh.name || ''), nh && nh.name);
    ok('…and the app carries that name', await until(() => inPage(N, () => /Newcomer.s Kitchen Notes/.test(document.querySelector('.header .logo').textContent)
       && /Newcomer.s Kitchen Notes/.test(document.title))),
       JSON.stringify(await inPage(N, () => [(document.querySelector('.header .logo') || {}).textContent, document.title])));
    ok('…and sees none of the family\'s recipes', !(await names(N)).includes('E2E seed stew'), JSON.stringify(await names(N)));

    const url = await inPage(A, async () => {
      window.askConfirm = async () => true;                 // "Read + Write"
      try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch (e) {}
      try { navigator.clipboard.writeText = async () => {}; } catch (e) {}
      return householdInvite();
    });
    const code = (/[?&]join=([A-Za-z0-9_-]+)/.exec(url || '') || [])[1];
    ok('the owner makes an invitation link', !!code, url);
    const J = await device('J (invited)', 'invited@example.com', { query: '?join=' + code });
    ok('someone with the link joins the family household', await inPage(J, () => (householdOf() || {}).name === 'E2E family'));
    ok('…as an editor, and sees the recipes', (await restDoc('households/' + HID + '/members/' + await uidOnPage(J)) || {}).role === 'editor'
       && (await names(J)).includes('E2E seed stew'), JSON.stringify(await names(J)));
    ok('…and the code is gone from the address', await inPage(J, () => !/join=/.test(location.href)));

    console.log('Family Access, household layout');
    await inPage(A, async () => {
      openAccessControl();
      document.getElementById('accessEmailInput').value = 'Aunt@Example.com';
      document.querySelector('input[name="newRole"][value="write"]').checked = true;
      addAccessMember();
    });
    ok('adding an address keeps a place for it, at once (nothing to publish)',
       await until(async () => ((await restDoc('pending/' + HID + ':aunt@example.com')) || {}).role === 'editor'));
    const auntIdx = await until(() => inPage(A, () => { const i = getAccessMembers().findIndex(m => m.email === 'aunt@example.com'); return i >= 0 ? i + 1 : 0; }));
    await inPage(A, (i) => changeAccessRole(i - 1, 'read'), auntIdx);
    ok('changing the role changes the kept place',
       await until(async () => ((await restDoc('pending/' + HID + ':aunt@example.com')) || {}).role === 'viewer'));
    const readerIdx = await inPage(A, (e) => getAccessMembers().findIndex(m => m.email === e), READER);
    await inPage(A, (i) => changeAccessRole(i, 'write'), readerIdx);
    ok('…and a member\'s role, in the household itself',
       await until(async () => ((await restDoc('households/' + HID + '/members/' + await uidOnPage(C))) || {}).role === 'editor'));
    const auntNow = await inPage(A, () => getAccessMembers().findIndex(m => m.email === 'aunt@example.com'));
    await inPage(A, (i) => removeAccessMember(i), auntNow);
    ok('removing takes the kept place away', await until(async () => !(await restDoc('pending/' + HID + ':aunt@example.com'))));
    ok('a member cannot manage the household', await inPage(B, () => {
      openAccessControl(); const bar = document.getElementById('householdBar').textContent;
      return !/Invitation link|Rename/.test(bar) && /Leave this household/.test(bar);
    }));
  }

  if (!HH) {
    // v36.86 — the owner's one-time move from `shared` into a household,
    // and then the app switched over, exactly as it will be done for real.
    console.log('Moving the family into a household');
    const rep = await inPage(A, async () => {
      window.backupSave = async () => {};                       // no download dialogs in a test
      return householdMoveIn({ yes: true, name: 'E2E moved family' });
    });
    ok('the move copies the collection', rep && rep.copied && rep.copied.recipes >= 2, JSON.stringify(rep));
    ok('…and every copy reads back identical', rep && rep.verified > 0 && !rep.mismatched.length, JSON.stringify(rep && rep.mismatched));
    ok('…and keeps places for the family\'s members', rep && rep.kept.some(k => k.startsWith(WRITER + ' (editor')) && rep.kept.some(k => k.startsWith(READER + ' (viewer')),
       JSON.stringify(rep && rep.kept));
    HID = rep && rep.hid;
    const copiedRecipe = await restDoc('households/' + HID + '/recipes/4000');
    ok('a recipe is in the household', copiedRecipe && JSON.parse(copiedRecipe.r).name, JSON.stringify(copiedRecipe));
    ok('…and the original is untouched', !!(await restDoc('shared/recipe_4000')));
    const rep2 = await inPage(A, () => householdMoveIn({ yes: true, name: 'ignored' }));
    ok('running it again tops up the SAME household', rep2 && rep2.hid === HID, JSON.stringify(rep2 && rep2.hid));

    SERVE_HH = true;                                              // the app switched over
    await A.page.reload({ waitUntil: 'domcontentloaded' });
    await A.page.waitForFunction(() => window._driveMode && window._fbUser && window._lastSyncOkAt, null, { timeout: 30000 });
    const ah = await inPage(A, () => householdOf());
    ok('after the switch the owner is in the moved household', ah && ah.hid === HID && ah.role === 'owner', JSON.stringify(ah));
    ok('…with every recipe', (await names(A)).includes('E2E seed stew'), JSON.stringify(await names(A)));
    const W = await device('W (writer, after the move)', WRITER);
    ok('a family member signs in and takes up their kept place',
       await inPage(W, () => (householdOf() || {}).role === 'editor') && (await names(W)).includes('E2E seed stew'), JSON.stringify(await names(W)));
  }

} catch (e) {
  failures++;
  console.log('  FAIL the run stopped: ' + (e && e.stack || e));
} finally {
  for (const d of devices) {
    if (d.errors.length) console.log('  page errors on ' + d.label + ': ' + d.errors.slice(0, 3).join(' | '));
  }
  await browser.close();
  await env.cleanup();
  server.close();
}
console.log(failures ? `\n${failures} end-to-end check(s) failed` : '\nall end-to-end sync checks passed');
process.exit(failures ? 1 : 0);
