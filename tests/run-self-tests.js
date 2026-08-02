#!/usr/bin/env node
/**
 * Tony's Recipes — headless runner for the in-app Self Test suite (5.6).
 *
 * The suite itself lives in index.html as SELF_TESTS and is the real source of
 * truth; this only drives it. Run it against a local static server:
 *
 *     python3 -m http.server 8137 &
 *     node tests/run-self-tests.js --port 8137
 *
 * Two things about it are deliberate and easy to get wrong:
 *
 * 1. It opens #selfTestOverlay before running anything. Some checks interact
 *    with modals, and "the topmost dialog" means something different when the
 *    Self Test screen is itself open. A runner that skipped this once let
 *    a11y_basics close the suite out from under itself in the real app while
 *    reporting a clean pass here — the bug reached Tony before it reached CI.
 *
 * 2. net_* and stor_firebase are expected to fail without network and a
 *    signed-in Firebase session, so they are skipped by default rather than
 *    quietly tolerated. --include-network runs them and holds them to the same
 *    standard, for use somewhere they can actually pass.
 */
const path = require('path');

function loadPlaywright() {
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(p); } catch (e) { /* try the next one */ }
  }
  console.error('Could not require("playwright").');
  console.error('Note: `npx playwright install` downloads the browsers but does NOT');
  console.error('make the package resolvable here. Install it too:');
  console.error('  npm install playwright@1.56.1 && npx playwright install chromium');
  process.exit(2);
}

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i > -1 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const PORT = arg('port', '8137');
const INCLUDE_NETWORK = argv.includes('--include-network');
// These need real network and a signed-in Firebase session. They cannot pass in
// a sandbox or in CI, and pretending otherwise would make the suite meaningless.
const NETWORK_DEPENDENT = id => /^net_/.test(id) || id === 'stor_firebase';

(async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e.message)));

  const url = `http://127.0.0.1:${PORT}/index.html`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    console.error(`Could not load ${url} — is the static server running?`);
    await browser.close();
    process.exit(2);
  }
  await page.waitForTimeout(2500);

  const ready = await page.evaluate(() => typeof window.SELF_TESTS !== 'undefined');
  if (!ready) {
    // A single-file app fails silently and completely on a syntax error, so this
    // is the most likely reason and worth saying out loud.
    console.error('SELF_TESTS is not defined — index.html probably threw before defining it.');
    pageErrors.slice(0, 5).forEach(e => console.error('  ' + e));
    await browser.close();
    process.exit(2);
  }

  const results = await page.evaluate(async (includeNetwork) => {
    const overlay = document.getElementById('selfTestOverlay');
    if (overlay) overlay.classList.add('open');   // see note 1 in the header
    const out = [];
    for (const t of window.SELF_TESTS) {
      const skip = !includeNetwork && (/^net_/.test(t.id) || t.id === 'stor_firebase');
      if (skip) { out.push({ id: t.id, group: t.group, name: t.name, skipped: true }); continue; }
      const started = Date.now();
      try {
        await t.test();
        out.push({ id: t.id, group: t.group, name: t.name, ok: true, ms: Date.now() - started });
      } catch (e) {
        out.push({ id: t.id, group: t.group, name: t.name, ok: false, ms: Date.now() - started,
                   err: String((e && e.message) || e) });
      }
    }
    return {
      tests: out,
      suiteStillOpen: !!(overlay && overlay.classList.contains('open')),
      leftOpen: Array.from(document.querySelectorAll('.open')).map(e => e.id).filter(Boolean)
    };
  }, INCLUDE_NETWORK);

  const tests   = results.tests;
  const passed  = tests.filter(t => t.ok).length;
  const failed  = tests.filter(t => t.ok === false);
  const skipped = tests.filter(t => t.skipped);

  console.log(`\n${passed} passed, ${failed.length} failed, ${skipped.length} skipped (network/Firebase)\n`);

  if (failed.length) {
    console.log('FAILURES');
    for (const f of failed) console.log(`  ✗ [${f.group}] ${f.id} — ${f.name}\n      ${f.err}`);
    console.log('');
  }

  // A test that closes the suite, or strands a dialog, is a real defect even
  // when every assertion passed — it makes every later test run blind.
  let hygiene = 0;
  if (!results.suiteStillOpen) {
    console.log('✗ HYGIENE: a test closed #selfTestOverlay — everything after it ran blind.');
    hygiene++;
  }
  const stranded = results.leftOpen.filter(id => id !== 'selfTestOverlay');
  if (stranded.length) {
    console.log(`✗ HYGIENE: dialogs left open: ${stranded.join(', ')} — close them in finally, not try.`);
    hygiene++;
  }

  if (pageErrors.length) {
    console.log(`\nUncaught page errors (${pageErrors.length}):`);
    pageErrors.slice(0, 5).forEach(e => console.log('  ' + e));
  }

  await browser.close();
  process.exit(failed.length || hygiene ? 1 : 0);
})();
