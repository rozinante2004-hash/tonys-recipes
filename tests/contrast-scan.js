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
// Same resolution order as run-self-tests.js: CI installs playwright into the
// workspace, this sandbox has it under /opt. Hardcoding the /opt path is what
// made the first CI run of this step fail.
function loadPlaywright() {
  for (const m of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return require(m); } catch (e) { /* try the next one */ }
  }
  console.error('Could not require("playwright").');
  process.exit(2);
}
const { chromium } = loadPlaywright();
const PORT = (function () {
  const i = process.argv.indexOf('--port');
  return (i > -1 && process.argv[i + 1]) ? process.argv[i + 1] : '8137';
})();

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
  await p.goto('http://127.0.0.1:' + PORT + '/index.html?t=' + (process.env.THEME || 'dark'), { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => typeof window.renderGrid === 'function', null, { timeout: 20000 });
  await p.waitForTimeout(1200);
  const off = p.locator('text=Continue offline').first();
  if (await off.count()) { await off.click(); await p.waitForTimeout(600); }

  // v36.54 — THE FIXTURE HAS TO HAVE EVERYTHING IN IT. Until this release it
  // was a recipe with no notes, and Tony's Notes box — hard-coded cream under
  // var(--ink) text, which is near-white in dark mode — sat at about 1.1:1 on
  // his phone while this scan reported zero findings in both themes. A scan
  // measures what rendered; a section that never renders is never measured.
  // i18nHarvestRecipe() is the recipe the translation harvest builds to light
  // up every branch of the view (notes, Version history, the cooking log,
  // nutrition, sub-headings), so it is the right fixture here for the same
  // reason. Plus a plain one, because a normal card is its own surface too.
  await p.evaluate(() => {
    setTheme(new URLSearchParams(location.search).get('t') || 'dark');
    recipes.length = 0;
    var rich = i18nHarvestRecipe();
    rich.id = 974001; rich.name = 'Onion soup'; rich.photo = '';
    // Its own words are '·', which is right for the harvest (they must never
    // reach a dictionary) and wrong here: the scan skips a text that has no
    // letters in it, so the one fixture built to show everything showed
    // nothing measurable. Real words, in both of Tony's scripts.
    var W = 'Fry the onions slowly — טגנו לאט';
    rich.notes = 'Keep it warm. שמרו חם עד ההגשה.'; rich.by = 'Tony';
    rich.ingredients = [{ sub: 'For the soup' }, { a: '1', n: 'onion בצל' }, { a: '2', n: 'water מים', ind: 1 }];
    rich.steps = [W, { sub: 'Serving' }, { t: W, ind: 1 }];
    rich.cookLog.forEach(function (c) { c.note = 'Very good — טעים'; });
    rich.history.forEach(function (h) { h.name = 'Onion soup (old)'; });
    recipes.push(normalizeRecipe(rich));
    recipes.push(normalizeRecipe({ id: 974002, uid: 'y', name: 'Plain soup', category: 'Soup',
      difficulty: 'Easy', bg: '#F6EFE6', diets: ['Keto'], source: 'https://example.com/x',
      notes: 'Keep it warm.', ingredients: [{ a: '3', n: 'onions' }], steps: ['Fry them'] }));
    // A collection, because its part titles and its "collection actions"
    // heading are surfaces no single recipe has — and both were dark brown on
    // the dark card (v36.54).
    recipes.push(normalizeRecipe({ id: 974003, uid: 'z', name: 'Winter soups', category: 'Soup',
      difficulty: 'Easy', ingredients: [], steps: [],
      parts: [{ uid: 'p1', name: 'Tomato soup', ingredients: [{ a: '1', n: 'tomato' }], steps: ['Cook it'] },
              { uid: 'p2', name: 'Lentil soup', ingredients: [{ a: '1', n: 'lentils' }], steps: ['Cook them'] }] }));
    // …and a log with something in every finding level, or the Logging panel
    // draws "Nothing recorded yet" and its bad/warn cards are never measured.
    setLogEnabled(true);
    var now = Date.now();
    writeSyncLog([
      { at: now,        k: 'conflict', m: 'Save refused for "Soup" — changed on another device' },
      { at: now - 1000, k: 'error',    m: 'Cloud read timed out after 45s' },
      { at: now - 2000, k: 'save',     m: 'Wrote "Soup"' },
      { at: now - 3000, k: 'photo',    m: 'Photo missing from the cloud' }
    ]);
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

  // DRAW the panels before measuring them (v36.54). Logging, Sync Health,
  // Backups, What leaves this device, the access list… are built by a render
  // function the first time they are opened. Adding the .open class to their
  // overlay, which is all the loop below does, measured an empty <div>. The
  // translation harvest keeps the list of those functions for the same reason
  // — it had to draw the screens nobody has opened — so it is reused here
  // rather than copied. The open-recipe entry is left to the loop, which draws
  // the view itself with the overlay open.
  await p.evaluate(async () => {
    for (const [name, fn] of (window.I18N_HARVEST || [])) {
      if (/open recipe|converter/.test(name)) continue;
      try { await fn(); } catch (e) {}
    }
  });

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

  // The collection view.
  await p.evaluate(() => { document.querySelectorAll('.modal-overlay').forEach(e => e.classList.remove('open'));
                           viewId = 974003; try { drawView(); } catch (e) {}
                           document.getElementById('viewOverlay').classList.add('open'); });
  await p.waitForTimeout(250);
  await scan('collection view');
  await p.evaluate(() => document.getElementById('viewOverlay').classList.remove('open'));

  // The error dialog WITH action buttons — its secondary buttons were dark
  // brown on the dark card, and a plain error never draws them.
  await p.evaluate(() => { showServiceError('API_KEY: the key was rejected', [
    { label: 'Try again', primary: true, onClick: function () {} },
    { label: 'Open settings', onClick: function () {} }]); });
  await p.waitForTimeout(200);
  await scan('error dialog with actions');
  await p.evaluate(() => { Array.from(document.body.children).forEach(function (e) {
    if (e.style && e.style.position === 'fixed' && /Try again/.test(e.textContent)) e.remove(); }); });

  // The converter with a category chosen: its quick-value buttons exist only then.
  await p.evaluate(() => { try { openCalcModal(); setCalcCat('Volume'); } catch (e) {} });
  await p.waitForTimeout(200);
  await scan('converter');
  await p.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(e => e.classList.remove('open')));

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

  // STATIC CHECKS (v36.54) — for surfaces no fixture can reach. The rendered
  // scan measures what it can open; these read the source for the two shapes
  // that have actually shipped broken.
  const fs = require('fs');
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
  //  (a) A CSS variable that is used and never defined. `var(--card)` had no
  //      definition anywhere, so four surfaces had NO background at all — and
  //      in dark mode their var(--warm-brown) text was brown on brown, 1.08:1.
  //      Allowed: a fallback in the var() itself, or a value set from script.
  const defined = new Set([...src.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m => m[1]));
  const setByJs = new Set([...src.matchAll(/setProperty\(\s*['"](--[a-z0-9-]+)/g)].map(m => m[1]));
  const undef = [...new Set([...src.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/gi)].map(m => m[1]))]
    .filter(v => !defined.has(v) && !setByJs.has(v));
  console.log('\n=== UNDEFINED CSS VARIABLES (' + undef.length + ') ===');
  undef.forEach(v => console.log('  ' + v));
  //  (b) One inline style giving a LIGHT literal surface and THEMED text — the
  //      exact shape of the Notes box. In light mode it reads; in dark mode the
  //      text turns near-white on a surface that did not move. A literal pair
  //      (literal surface, literal text) is fine; so is a token pair.
  function lumHex(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return 0.2126 * ch(h.substr(0, 2)) + 0.7152 * ch(h.substr(2, 2)) + 0.0722 * ch(h.substr(4, 2));
    function ch(x) { const v = parseInt(x, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); } }
  const mixed = [];
  for (const m of src.matchAll(/style=\\?"([^"]*)"|cssText\s*=\s*'([^']*)'/g)) {
    const t = m[1] || m[2] || '';
    const bg = /background(?:-color)?\s*:\s*(#[0-9a-fA-F]{3,6}\b|white\b)/.exec(t);
    if (!bg || lumHex(bg[1] === 'white' ? '#ffffff' : bg[1]) < 0.6) continue;
    if (!/(^|;)\s*color\s*:\s*var\(--(ink|muted|heading)\)/.test(t)) continue;
    mixed.push(src.slice(0, m.index).split('\n').length + ': ' + t.replace(/\s+/g, ' ').slice(0, 110));
  }
  console.log('\n=== LIGHT LITERAL SURFACE + THEMED TEXT (' + mixed.length + ') ===');
  mixed.forEach(r => console.log('  ' + r));

  await b.close();
  process.exit((lightInDark.length + rest.length + errs.length + undef.length + mixed.length) ? 1 : 0);
})();
