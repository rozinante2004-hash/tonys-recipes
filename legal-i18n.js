// v37.85 — corrections to a translated privacy statement or terms page.
// Tony: "the editor should find any word that is translated, no matter where".
// Every passage of privacy.<lang>.html / terms.<lang>.html carries data-k, its
// key in the interface dictionary (tools/legal-keys.py writes them). A
// correction saved in the translation editor is stored under that key and
// shown here in place of the shipped wording. Inside the app the app hands
// over its own dictionary (it has the correction the moment it is saved);
// opened on its own, the page reads the published i18n/<lang>.json.
// legalApplyDict in index.html is the same rule for the kitchen-rules page.
// v38.27 — it also writes out the contact address. The pages do not (they are public, and
// harvested for addresses): <a class="mkn-mail" data-u data-d> holds the two halves and reads
// "contact [at] …" until this joins them into a real mailto: link.
(function () {
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function mail(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('a.mkn-mail[data-u][data-d]'), function (a) {
      var addr = a.getAttribute('data-u') + '@' + a.getAttribute('data-d');
      // The words the passage's key was made from, so a correction can still find this link.
      if (!a.hasAttribute('data-k-text')) a.setAttribute('data-k-text', norm(a.textContent));
      a.setAttribute('href', 'mailto:' + addr);
      a.textContent = addr;
    });
  }
  // The new words replace the block's; its bold names, links and isolated
  // English names are put back around the same words wherever they still are.
  function rewrite(el, text) {
    var marks = Array.prototype.filter.call(el.children, function (c) { return c.tagName !== 'BR'; });
    var parts = [text];
    marks.forEach(function (m) {
      var w = norm(m.getAttribute('data-k-text') || m.textContent);
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
    mail(document);
    return n;
  }
  window.mknLegalApply = apply;
  window.mknLegalMail = mail;
  mail(document);
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
