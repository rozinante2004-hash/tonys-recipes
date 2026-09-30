// The toolbar button: on any page, send the selected text (or, on Facebook,
// the post's text) to My Kitchen Notes. Runs only when clicked (activeTab).
importScripts('config.js');
chrome.action.onClicked.addListener(async function (tab) {
  if (!tab || !tab.id) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['config.js', 'shared.js'] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: async function () {
    var sel = String(getSelection() || '').trim();
    if (sel.length < 40) {
      for (var i = 0; i < 4 && mknSeeMore(document); i++) await new Promise(function (r) { setTimeout(r, 600); });
      var best = '';
      var m = document.querySelector('[data-ad-preview="message"],[data-ad-comet-preview="message"]');
      if (m) best = m.innerText;
      if (!best || best.trim().length < 40) document.querySelectorAll('[dir="auto"],article,main').forEach(function (e) {
        if (e.closest('[role="article"] [role="article"]')) return;
        var t = (e.innerText || '').trim();
        if (t.length > best.length && t.length < 20000 && e.offsetParent) best = t;
      });
      sel = best;
    }
    sel = mknCleanText(sel);
    if (sel.length < 40) { alert('No recipe text found here. Select the recipe text, then press the button again.'); return; }
    mknOpenApp(MKN_APP, sel, location.href);
  } });
});
