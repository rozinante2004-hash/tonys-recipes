// The toolbar button, its keyboard shortcut (Alt+Shift+S) and the right-click
// menu: on ANY page, send the recipe to My Kitchen Notes — the one the page
// embeds for search engines, else the selected text, else the page's main
// text. Right-clicking a LINK sends that link for the app to import. Runs only
// when clicked (activeTab).
// Chrome/Edge run this as a service worker and load the two files here; Firefox
// lists all three in its manifest (1.4), so they are already loaded there.
if (typeof importScripts === 'function' && typeof MKN_APP === 'undefined') importScripts('config.js', 'shared.js');
async function mknSendFromTab(tab) {
  if (!tab || !tab.id) return;
  var got = null;
  // Facebook, Instagram, TikTok: our script there reads the post ON SCREEN (1.3).
  try { got = await chrome.tabs.sendMessage(tab.id, { mkn: 'take' }); } catch (e) {}
  if (!got) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['config.js', 'shared.js'] });
    var res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: async function () {
      if (!String(getSelection() || '').trim()) {
        for (var i = 0; i < 4 && mknSeeMore(document, true); i++) await new Promise(function (r) { setTimeout(r, 600); });
      }
      return { text: mknTakeFromPage(), url: location.href };
    } });
    got = res && res[0] && res[0].result;
  }
  if (!got || !got.text || got.text.length < 40) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: function () { alert('No recipe text found here. Select the recipe text, then try again.'); } });
    return;
  }
  // Opened by the extension itself, so no pop-up blocker can stop it.
  chrome.tabs.create({ url: mknAppAddress(await mknSendToNow(), got.text, got.url), index: tab.index + 1 });
}
chrome.action.onClicked.addListener(mknSendFromTab);
chrome.runtime.onInstalled.addListener(function (details) {
  // 1.7 — whoever had the store copy before 1.7 got it from the family app (the
  // listing was the family's): they keep sending there.
  try {
    if (mknFamilyOn() && details && details.reason === 'update' && /^1\.[0-6]\./.test(String(details.previousVersion || '')))
      chrome.storage.local.set({ mknFamily: true });
  } catch (e) {}
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({ id: 'mkn-page', title: '📘 Save recipe to ' + MKN_APP_NAME, contexts: ['page', 'selection'] });
    chrome.contextMenus.create({ id: 'mkn-link', title: '📘 Import this link into ' + MKN_APP_NAME, contexts: ['link'] });
  });
});
chrome.contextMenus.onClicked.addListener(async function (info, tab) {
  if (info.menuItemId === 'mkn-link' && info.linkUrl) {
    chrome.tabs.create({ url: (await mknSendToNow()).replace(/#.*$/, '') + '?url=' + encodeURIComponent(info.linkUrl) });
    return;
  }
  if (info.menuItemId === 'mkn-page') mknSendFromTab(tab);
});
