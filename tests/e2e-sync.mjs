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
 *     cd <a folder with firebase-tools@13, @firebase/rules-unit-testing@3,
 *        firebase@10.12.0 and playwright installed>
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
  await fs.setDoc(fs.doc(db, 'shared/recipe_4000'), { r: JSON.stringify(seed), updatedAt: t0, id: 4000 });
  await fs.setDoc(fs.doc(db, 'shared/meta'), { nextId: 5000, ids: [4000], schema: 2, updatedAt: t0 });
  await fs.setDoc(fs.doc(db, 'shared/access'), { members: [
    { email: WRITER, role: 'write' }, { email: READER, role: 'read' } ], updatedAt: Date.now() });
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
async function cloudDoc(id) {
  const r = await fetch(`http://${EMU.host}:${EMU.firestorePort}/v1/projects/${EMU.projectId}/databases/(default)/documents/shared/${id}`,
                        { headers: { Authorization: 'Bearer owner' } });
  if (r.status === 404) return null;
  const j = await r.json();
  return fromValue({ mapValue: { fields: j.fields || {} } });
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
async function device(label, email) {
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
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window._fbAuth && window._fbEmulated === true, null, { timeout: 20000 });
  await page.evaluate(async (who) => {
    window._justSignedIn = true;               // the app's "just signed in", not an auto-login
    const cred = firebase.auth.GoogleAuthProvider.credential(
      JSON.stringify({ sub: 'uid-' + who.replace(/\W/g, ''), email: who, email_verified: true }));
    await window._fbAuth.signInWithCredential(cred);
  }, email);
  // Signed in, and the first load from the cloud has finished.
  try {
    await page.waitForFunction(() => window._driveMode && window._fbUser && window._lastSyncOkAt, null, { timeout: 30000 });
  } catch (e) {
    const st = await page.evaluate(() => ({ drive: !!window._driveMode, user: window._fbUser && window._fbUser.email,
      lastSync: window._lastSyncOkAt, status: (document.getElementById('dsText') || {}).textContent,
      recent: (typeof recentErrors === 'function' ? recentErrors() : []).slice(-3).map(x => x.message) }));
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
  const A = await device('A (owner)', OWNER);
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
