#!/usr/bin/env node
/**
 * Every window's ✕ stays in view (v38.49). Run it against a local static server:
 *
 *     python3 -m http.server 8137 &
 *     node tests/close-in-view.js --port 8137
 *
 * Tony: "In many modals (e.g. 🔭 Explore — What can I cook?) the closing X is
 * stuck at the top of the modal and disappears when scrolling down. It should be
 * a floating icon, always in the same place, no matter where you scroll (like we
 * have in the recipes). Please run a full test and fix the ones in need."
 *
 * Each window is opened in turn, at a computer's size and at a phone's, made
 * long enough to scroll (a tall filler at its end), scrolled to the bottom, and
 * its ✕ must then still be on the screen and be what a tap there reaches.
 */
function loadPlaywright() {
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(m); } catch (e) { /* try the next one */ }
  }
  console.error('Could not require("playwright").');
  process.exit(2);
}
const { chromium } = loadPlaywright();
const PORT = (() => { const i = process.argv.indexOf('--port'); return i > -1 ? process.argv[i + 1] : '8137'; })();

(async () => {
  const browser = await chromium.launch();
  const bad = [];
  let scanned = 0;
  for (const vp of [{ width: 1280, height: 760, name: 'computer' }, { width: 390, height: 760, name: 'phone' }]) {
    const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: vp })).newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const off = page.locator('text=Continue offline').first();
    if (await off.count()) { await off.click(); await page.waitForTimeout(500); }
    const res = await page.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const out = [], skip = { selfTestOverlay: 1, progOverlay: 1, i18nOverlay: 1 };
      const isClose = b => /^[✕×✖✗]︎?$/.test((b.textContent || '').trim()) || /^close$/i.test(b.getAttribute('aria-label') || '');
      const scrollerOf = (el, top) => {
        for (let x = el.parentElement; x && x !== top.parentElement; x = x.parentElement) {
          const oy = getComputedStyle(x).overflowY;
          if ((oy === 'auto' || oy === 'scroll') && x.scrollHeight > x.clientHeight + 4) return x;
        }
        return null;
      };
      if (typeof openView === 'function' && recipes.length) { openView(recipes[0].id); await wait(250); }
      const ids = Array.from(document.querySelectorAll('[id$="Overlay"]')).map(e => e.id).filter(id => !skip[id]);
      let n = 0;
      for (const id of ids) {
        const ov = document.getElementById(id);
        const wasOpen = ov.classList.contains('open');
        ov.classList.add('open');
        if (getComputedStyle(ov).display === 'none') ov.style.display = 'flex';
        await wait(60);
        const close = Array.from(ov.querySelectorAll('button')).filter(isClose)[0];
        if (!close) { if (!wasOpen) ov.classList.remove('open'); ov.style.display = ''; continue; }
        n++;
        // The card: the overlay's child holding the ✕. Made long enough to scroll.
        let card = close; while (card.parentElement && card.parentElement !== ov) card = card.parentElement;
        const filler = document.createElement('div'); filler.style.cssText = 'height:2600px;flex:none;'; filler.className = '__filler';
        let into = card;
        // Content is often in an inner box; put the filler in the deepest box that scrolls, or the card.
        const inner = Array.from(card.querySelectorAll('*')).filter(x => { const oy = getComputedStyle(x).overflowY; return (oy === 'auto' || oy === 'scroll') && x.clientHeight > 120; })[0];
        if (inner && !inner.contains(close) && !scrollerOf(close, ov)) into = inner;
        into.appendChild(filler);
        await wait(40);
        const sc = scrollerOf(filler, ov) || (ov.scrollHeight > ov.clientHeight + 4 ? ov : null);
        if (sc) { sc.scrollTop = sc.scrollHeight; await wait(80); }
        const r = close.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const hit = (cy > 0 && cy < innerHeight && cx > 0 && cx < innerWidth) ? document.elementFromPoint(cx, cy) : null;
        const ok = !!hit && (hit === close || close.contains(hit));
        if (!ok) out.push({ id, why: !sc ? 'did not scroll' : (cy < 0 || cy > innerHeight) ? 'scrolled out of view (y=' + Math.round(cy) + ')' : 'covered by ' + (hit ? (hit.id || hit.className || hit.tagName) : 'nothing') });
        filler.remove();
        if (sc) sc.scrollTop = 0;
        if (!wasOpen) ov.classList.remove('open');
        ov.style.display = '';
      }
      return { out, n };
    });
    scanned += res.n;
    console.log(`${vp.name}: ${res.n} windows with a ✕`);
    res.out.forEach(f => { bad.push(vp.name + ' ' + f.id + ' — ' + f.why); console.log(`  ✗ ${f.id} — ${f.why}`); });
    await page.close();
  }
  await browser.close();
  if (bad.length) { console.log(`\n${bad.length} window(s) lose their ✕ when scrolled`); process.exit(1); }
  console.log(`\nevery ✕ stays in view (${scanned} checks)`);
})();
