// v37.85 — corrections to a translated privacy statement or terms page.
// Tony: "the editor should find any word that is translated, no matter where".
// Every passage of privacy.<lang>.html / terms.<lang>.html carries data-k, its
// key in the interface dictionary (tools/legal-keys.py writes them). A
// correction saved in the translation editor is stored under that key and
// shown here in place of the shipped wording. Inside the app the app hands
// over its own dictionary (it has the correction the moment it is saved);
// opened on its own, the page reads the published i18n/<lang>.json.
// legalApplyDict in index.html is the same rule for the kitchen-rules page.
(function () {
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  // The new words replace the block's; its bold names, links and isolated
  // English names are put back around the same words wherever they still are.
  function rewrite(el, text) {
    var marks = Array.prototype.filter.call(el.children, function (c) { return c.tagName !== 'BR'; });
    var parts = [text];
    marks.forEach(function (m) {
      var w = norm(m.textContent);
      if (!w) return;
      for (var i = 0; i < parts.length; i++) {
        if (typeof parts[i] !== 'string') continue;
        var at = parts[i].indexOf(w);
        if (at === -1) continue;
        parts.splice(i, 1, parts[i].slice(0, at), m.cloneNode(true), parts[i].slice(at + w.length));
        return;
      }
    });
    el.textContent = '';
    parts.forEach(function (p) { el.appendChild(typeof p === 'string' ? document.createTextNode(p) : p); });
  }
  function apply(dict) {
    if (!dict) return 0;
    var n = 0;
    Array.prototype.forEach.call(document.querySelectorAll('[data-k]'), function (el) {
      var t = dict[el.getAttribute('data-k')];
      if (typeof t !== 'string' || !norm(t) || norm(t) === norm(el.textContent)) return;
      rewrite(el, norm(t)); n++;
    });
    return n;
  }
  window.mknLegalApply = apply;
  var inApp = false;
  try { inApp = window.parent !== window && typeof window.parent.legalFile === 'function'; } catch (e) {}
  if (inApp) return;
  var lang = document.documentElement.lang;
  if (!/^[a-z]{2}$/.test(lang) || lang === 'en') return;
  fetch('i18n/' + lang + '.json', { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) { if (j && j.strings) apply(j.strings); })
    .catch(function () {});
})();
