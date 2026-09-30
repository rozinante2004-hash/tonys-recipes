// The toolbar button, its keyboard shortcut (Alt+Shift+S) and the right-click
// menu: on ANY page, send the recipe to My Kitchen Notes — the one the page
// embeds for search engines, else the selected text, else the page's main
// text. Right-clicking a LINK sends that link for the app to import. Runs only
// when clicked (activeTab).
importScripts('config.js');
async function mknSendFromTab(tab) {
  if (!tab || !tab.id) return;
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['config.js', 'shared.js'] });
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: async function () {
    if (!String(getSelection() || '').trim()) {
      for (var i = 0; i < 4 && mknSeeMore(document); i++) await new Promise(function (r) { setTimeout(r, 600); });
    }
    var text = mknTakeFromPage();
    if (text.length < 40) { alert('No recipe text found here. Select the recipe text, then try again.'); return; }
    mknOpenApp(MKN_APP, text, location.href);
  } });
}
chrome.action.onClicked.addListener(mknSendFromTab);
chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({ id: 'mkn-page', title: '📘 Save recipe to ' + MKN_APP_NAME, contexts: ['page', 'selection'] });
    chrome.contextMenus.create({ id: 'mkn-link', title: '📘 Import this link into ' + MKN_APP_NAME, contexts: ['link'] });
  });
});
chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === 'mkn-link' && info.linkUrl) {
    chrome.tabs.create({ url: MKN_APP.replace(/#.*$/, '') + '?url=' + encodeURIComponent(info.linkUrl) });
    return;
  }
  if (info.menuItemId === 'mkn-page') mknSendFromTab(tab);
});
