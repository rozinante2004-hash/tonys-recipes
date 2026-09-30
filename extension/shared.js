// Shared by the button under each post (content.js) and the toolbar button
// (background.js injects the same function). Nothing leaves the browser except
// by opening the app with the text after '#' — a part of an address that no
// server ever receives.
function mknSeeMore(root) {
  var M = /^(see more|show more|… ?see more|הצג עוד|ראה עוד|ראי עוד)$/i;
  var n = 0;
  (root || document).querySelectorAll('[role="button"],div[dir="auto"] span,a').forEach(function (e) {
    var t = (e.textContent || '').trim();
    if (t.length < 16 && M.test(t) && e.offsetParent) { e.click(); n++; }
  });
  return n;
}
function mknCleanText(s) {
  return String(s || '')
    .replace(/\s*(see less|show less|הצג פחות|ראה פחות)\s*$/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function mknOpenApp(app, text, url) {
  var a = app.replace(/#.*$/, '');
  window.open(a + '#share-text=' + encodeURIComponent(text) + '&share-url=' + encodeURIComponent(url || location.href), '_blank');
}

// ── Any website (extension 1.2) ──────────────────────────────────────────────
// Almost every recipe site embeds its recipe for search engines (schema.org
// Recipe, in JSON-LD). That is the cleanest copy there is: read it first,
// then what the person selected, then the page's main text.
function mknDuration(iso) {
  var m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(String(iso || ''));
  if (!m || !(m[1] || m[2] || m[3])) return String(iso || '');
  var h = (+m[1] || 0) * 24 + (+m[2] || 0), mi = +m[3] || 0;
  return (h ? h + ' h ' : '') + (mi ? mi + ' min' : '');
}
function mknRecipeFromJsonLd() {
  var found = null;
  function visit(o) {
    if (!o || found) return;
    if (Array.isArray(o)) { o.forEach(visit); return; }
    if (typeof o !== 'object') return;
    var t = o['@type'];
    if (t === 'Recipe' || (Array.isArray(t) && t.indexOf('Recipe') !== -1)) { found = o; return; }
    if (o['@graph']) visit(o['@graph']);
  }
  document.querySelectorAll('script[type="application/ld+json"]').forEach(function (s) {
    try { visit(JSON.parse(s.textContent)); } catch (e) {}
  });
  if (!found) return '';
  var r = found, out = [];
  var txt = function (x) { return String(x == null ? '' : x).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim(); };
  if (r.name) out.push(txt(r.name));
  if (r.description) out.push(txt(r.description));
  var facts = [];
  if (r.recipeYield) facts.push('Servings: ' + txt(Array.isArray(r.recipeYield) ? r.recipeYield[0] : r.recipeYield));
  if (r.prepTime) facts.push('Prep: ' + mknDuration(r.prepTime));
  if (r.cookTime) facts.push('Cook: ' + mknDuration(r.cookTime));
  if (r.totalTime) facts.push('Total: ' + mknDuration(r.totalTime));
  if (facts.length) out.push(facts.join(' · '));
  var ings = r.recipeIngredient || r.ingredients || [];
  if (ings.length) out.push('Ingredients:\n' + ings.map(function (i) { return '- ' + txt(i); }).join('\n'));
  var steps = [];
  (function walk(ins, section) {
    if (!ins) return;
    if (typeof ins === 'string') { txt(ins).split(/\n+/).forEach(function (l) { if (l.trim()) steps.push(l.trim()); }); return; }
    if (Array.isArray(ins)) { ins.forEach(function (x) { walk(x, section); }); return; }
    if (ins['@type'] === 'HowToSection') { if (ins.name) steps.push('## ' + txt(ins.name)); walk(ins.itemListElement, ins.name); return; }
    if (ins.text || ins.name) steps.push(txt(ins.text || ins.name));
  })(r.recipeInstructions);
  if (steps.length) {
    var n = 0;
    out.push('Method:\n' + steps.map(function (s) { return /^## /.test(s) ? s.slice(3) + ':' : (++n) + '. ' + s; }).join('\n'));
  }
  return out.join('\n\n');
}
function mknTakeFromPage() {
  var sel = String(getSelection() || '').trim();
  if (sel.length >= 40) return mknCleanText(sel);
  var ld = mknRecipeFromJsonLd();
  if (ld.length >= 40) return ld;
  var best = '';
  var m = document.querySelector('[data-ad-preview="message"],[data-ad-comet-preview="message"]');
  if (m) best = m.innerText;
  if (!best || best.trim().length < 40) {
    var main = document.querySelector('[itemtype*="schema.org/Recipe"],article,main,[role="main"]');
    if (main) best = main.innerText;
  }
  if (!best || best.trim().length < 40) best = document.body ? document.body.innerText : '';
  return mknCleanText(String(best || '').slice(0, 20000));
}
