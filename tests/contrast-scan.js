#!/usr/bin/env node
/**
 * Contrast scan (v36.14). Run it against a local static server, once per theme:
 *
 *     python3 -m http.server 8137 &
 *     THEME=dark  node tests/contrast-scan.js --port 8137
 *     THEME=light node tests/contrast-scan.js --port 8137
 *
 * It exists because Tony's Meal menu was #F2EDE6 text on a hard-coded white
 * panel — 1.16:1 — and nothing in the suite could see it. The panel is MOBILE
 * ONLY: it does not exist above 700px, so every desktop check walked straight
 * past it. This opens every menu, panel and modal AT PHONE WIDTH and measures
 * what actually rendered.
 *
 * "LIGHT SURFACE IN DARK MODE" is the bug class itself: a background that was
 * written as a literal before the theme existed, with themed (and therefore
 * light) text on top of it. In light mode that bucket is meaningless and is
 * suppressed.
 */
// Contrast scan: phone width, dark mode, every menu / panel / modal opened in
// turn. Computes the EFFECTIVE background behind each run of text by
// compositing up the ancestor chain, then the WCAG contrast ratio. Asserts what
// rendered — a hardcoded `background: white` under `color: var(--ink)` is
// invisible to any check that only reads the stylesheet.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const SCAN = `(() => {
  function parse(c) {
    var m = /rgba?\\(([^)]+)\\)/.exec(c || '');
    if (!m) return null;
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function over(fg, bg) {   // composite fg (with alpha) onto opaque bg
    var a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a),
             b: fg.b * a + bg.b * (1 - a), a: 1 };
  }
  function lum(c) {
    var f = [c.r, c.g, c.b].map(function (v) {
      v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  }
  function ratio(a, b) {
    var l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  // Walk up until something opaque is found, compositing translucent layers.
  function effectiveBg(el) {
    var stack = [], n = el;
    while (n && n.nodeType === 1) {
      var cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return { img: true };
      var c = parse(cs.backgroundColor);
      if (c && c.a > 0) { stack.push(c); if (c.a >= 0.999) break; }
      n = n.parentElement;
    }
    if (!stack.length) return { r: 255, g: 255, b: 255, a: 1 };
    var base = stack[stack.length - 1];
    if (base.a < 0.999) base = over(base, { r: 255, g: 255, b: 255, a: 1 });
    for (var i = stack.length - 2; i >= 0; i--) base = over(stack[i], base);
    return base;
  }
  var out = [];
  var seen = new Set();
  document.querySelectorAll('*').forEach(function (el) {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
    var rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return;
    // Only elements that directly own visible text.
    var own = Array.from(el.childNodes)
      .filter(function (n) { return n.nodeType === 3 && n.textContent.trim(); })
      .map(function (n) { return n.textContent.trim(); }).join(' ');
    if (!own) return;
    // Emoji-only labels carry their own colour; contrast does not apply.
    if (!/[A-Za-z0-9\\u0590-\\u05FF]/.test(own)) return;
    var cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.1) return;
    var fg = parse(cs.color);
    if (!fg) return;
    var bg = effectiveBg(el);
    if (bg.img) return;                       // gradient/photo behind — skip
    if (fg.a < 0.999) fg = over(fg, bg);
    var size = parseFloat(cs.fontSize);
    var bold = (parseInt(cs.fontWeight, 10) || 400) >= 700;
    var large = size >= 24 || (size >= 18.66 && bold);
    var need = large ? 3 : 4.5;
    var got = ratio(fg, bg);
    if (got >= need) return;
    var key = el.className + '|' + own.slice(0, 30);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      text: own.slice(0, 44),
      sel: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
           (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).join('.') : ''),
      color: cs.color, bg: 'rgb(' + [bg.r, bg.g, bg.b].map(Math.round).join(',') + ')',
      ratio: Math.round(got * 100) / 100, need: need
    });
  });
  return out;
})()`;

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://127.0.0.1:8137/index.html?t=' + (process.env.THEME || 'dark'), { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof window.renderGrid === 'function', null, { timeout: 20000 });
  await p.waitForTimeout(1200);
  const off = p.locator('text=Continue offline').first();
  if (await off.count()) { await off.click(); await p.waitForTimeout(600); }

  await p.evaluate(() => {
    setTheme(new URLSearchParams(location.search).get('t') || 'dark');
    recipes.length = 0;
    recipes.push(normalizeRecipe({ id: 974001, uid: 'x', name: 'Onion soup', category: 'Soup',
      difficulty: 'Easy', bg: '#F6EFE6', diets: ['Keto'], source: 'https://example.com/x',
      ingredients: [{ a: '3', n: 'onions' }], steps: ['Fry them'] }));
    renderFilters(); renderGrid();
  });
  await p.waitForTimeout(400);

  const findings = {};
  async function scan(label) {
    const rows = await p.evaluate(SCAN);
    if (rows.length) findings[label] = rows;
  }

  await scan('main screen');

  // Every mobile dropdown panel.
  for (const id of ['mobileMealPanel', 'mobileDietPanel']) {
    await p.evaluate(i => { document.querySelectorAll('.mobile-dropdown-panel').forEach(e => e.classList.remove('open'));
                            var el = document.getElementById(i); if (el) el.classList.add('open'); }, id);
    await p.waitForTimeout(150);
    await scan('panel: ' + id);
  }
  await p.evaluate(() => document.querySelectorAll('.mobile-dropdown-panel').forEach(e => e.classList.remove('open')));

  // Every drop-menu (⚙️, ··· More, Imp/Exp, + Add, Sort).
  const drops = await p.evaluate(() => Array.from(document.querySelectorAll('.drop-menu')).map(e => e.id).filter(Boolean));
  for (const id of drops) {
    await p.evaluate(i => { document.querySelectorAll('.drop-menu').forEach(e => e.classList.remove('open'));
                            var el = document.getElementById(i); if (el) el.classList.add('open'); }, id);
    await p.waitForTimeout(120);
    await scan('menu: ' + id);
  }
  await p.evaluate(() => document.querySelectorAll('.drop-menu').forEach(e => e.classList.remove('open')));

  // The select bar.
  await p.evaluate(() => { selectMode = true; document.getElementById('selectBar').style.display = 'flex'; renderGrid(); });
  await p.waitForTimeout(150);
  await scan('select bar');
  await p.evaluate(() => { cancelSelectMode(); });

  // Every modal overlay.
  const overlays = await p.evaluate(() => Array.from(document.querySelectorAll('.modal-overlay')).map(e => e.id).filter(Boolean));
  for (const id of overlays) {
    await p.evaluate(i => {
      document.querySelectorAll('.modal-overlay').forEach(e => e.classList.remove('open'));
      if (i === 'viewOverlay') { viewId = 974001; try { drawView(); } catch (e) {} }
      if (i === 'editOverlay') { try { openAddModal(974001); } catch (e) {} }
      var el = document.getElementById(i); if (el) el.classList.add('open');
    }, id);
    await p.waitForTimeout(250);
    await scan('modal: ' + id);
  }
  await p.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(e => e.classList.remove('open')));

  // The ask dialog and the photo sheets, which are built at runtime.
  await p.evaluate(() => { askConfirm({ icon: '📚', title: 'Create it?', message: 'Two recipes move in.', okLabel: 'Create it' }); });
  await p.waitForTimeout(200);
  await scan('ask dialog');
  await p.evaluate(() => { var o = document.getElementById('askOverlay'); if (o) o.remove(); });

  await p.evaluate(() => showPhotoSourcePicker(974001, 'Onion soup'));
  await p.waitForTimeout(200);
  await scan('photo source sheet');
  await p.evaluate(() => { var o = document.getElementById('photoSourcePicker'); if (o) o.remove(); });

  await p.evaluate(() => { chooseCollectionPhoto({ id: 1, name: 'Book' }, [{ name: 'Onion soup', photo: '' }]); });
  await p.waitForTimeout(200);
  await scan('collection photo chooser');
  await p.evaluate(() => { var o = document.getElementById('collPhotoOverlay'); if (o) o.remove(); });

  // Global dedupe: the page behind every panel is re-counted otherwise.
  const uniq = new Map();
  for (const [surface, rows] of Object.entries(findings)) {
    for (const r of rows) {
      const k = r.sel + '|' + r.text;
      if (!uniq.has(k)) uniq.set(k, Object.assign({ where: surface }, r));
    }
  }
  function lumOf(rgb) {
    const [r, g, b] = rgb.match(/\d+/g).map(Number).map(v => v / 255)
      .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const all = [...uniq.values()];
  // THE bug class: a light surface that survived into dark mode.
  const dark = (process.env.THEME || 'dark') === 'dark';
  const lightInDark = dark ? all.filter(r => lumOf(r.bg) > 0.5) : [];
  const rest = all.filter(r => !lightInDark.includes(r));
  console.log('=== LIGHT SURFACE IN DARK MODE (' + lightInDark.length + ') ===');
  lightInDark.forEach(r => console.log('  ' + r.ratio.toFixed(2) + '  ' + r.sel + '\n        bg ' + r.bg + '  fg ' + r.color + '  [' + r.where + ']  "' + r.text + '"'));
  console.log('\n=== OTHER LOW CONTRAST (' + rest.length + ') ===');
  rest.sort((a, b) => a.ratio - b.ratio).forEach(r => console.log('  ' + r.ratio.toFixed(2) + '  ' + r.sel + '  bg ' + r.bg + ' fg ' + r.color + '  "' + r.text + '"'));
  console.log('errors', errs.length ? errs.join(' | ') : 'none');
  await b.close();
  process.exit((lightInDark.length + rest.length + errs.length) ? 1 : 0);
})();
