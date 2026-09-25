#!/usr/bin/env node
/**
 * Accessibility scan with axe-core (v36.65, audit block 6).
 *
 *     python3 -m http.server 8137 &
 *     node tests/axe-scan.js --port 8137
 *
 * The page, the recipe view with a real recipe in it, and EVERY dialog opened
 * in turn — because a dialog's controls only exist to a scanner while it is
 * open, and the audit found both of its findings (cards with buttons inside
 * them, an unlabelled field) in places a scan of the start page never sees.
 * Fails on anything axe rates serious or critical. Colour contrast is off
 * here: tests/contrast-scan.js does that, in both themes, more thoroughly.
 */
function loadPlaywright() {
  // Same resolution order as the other runners: CI installs playwright into the
  // workspace, this sandbox has it under /opt.
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(m); } catch (e) { /* try the next one */ }
  }
  console.error('Could not require("playwright").');
  process.exit(2);
}
const { chromium } = loadPlaywright();
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const PORT = (() => { const i = argv.indexOf('--port'); return i > -1 ? argv[i + 1] : '8137'; })();
const axePath = require.resolve('axe-core/axe.min.js', { paths: [process.cwd(), path.join(__dirname, '..')] });
const axeSrc = fs.readFileSync(axePath, 'utf8');

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const off = page.locator('text=Continue offline').first();
  if (await off.count()) { await off.click(); await page.waitForTimeout(500); }
  await page.addScriptTag({ content: axeSrc });

  const found = await page.evaluate(async () => {
    const out = [];
    const opts = { rules: { 'color-contrast': { enabled: false } } };
    const keep = (where, r) => r.violations
      .filter(v => v.impact === 'serious' || v.impact === 'critical')
      .forEach(v => out.push({ where, id: v.id, impact: v.impact, n: v.nodes.length,
                               target: v.nodes[0].target.join(' '), help: v.help }));
    const wait = ms => new Promise(r => setTimeout(r, ms));
    for (const mode of ['list', 'grid']) { setView(mode); await wait(200); keep('page (' + mode + ')', await axe.run(document, opts)); }
    if (recipes.length) {
      openView(recipes[0].id); await wait(300);
      keep('viewOverlay', await axe.run(document.getElementById('viewOverlay'), opts));
      closeM('viewOverlay');
    }
    const skip = { selfTestOverlay: 1, progOverlay: 1, i18nOverlay: 1, viewOverlay: 1 };
    const ids = Array.from(document.querySelectorAll('[id$="Overlay"]')).map(e => e.id).filter(id => !skip[id]);
    for (const id of ids) {
      const el = document.getElementById(id);
      el.classList.add('open'); await wait(80);
      keep(id, await axe.run(el, opts));
      el.classList.remove('open');
    }
    return { out, dialogs: ids.length };
  });

  console.log(`scanned the page, the recipe view and ${found.dialogs} dialogs`);
  if (found.out.length) {
    console.log('\nSERIOUS / CRITICAL');
    found.out.forEach(f => console.log(`  ✗ ${f.impact} ${f.id} ×${f.n} in ${f.where} — ${f.help}\n      e.g. ${f.target}`));
  } else console.log('no serious or critical accessibility violations');
  if (errors.length) { console.log('\nUncaught page errors:'); errors.slice(0, 5).forEach(e => console.log('  ' + e)); }
  await browser.close();
  process.exit(found.out.length || errors.length ? 1 : 0);
})();
