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
