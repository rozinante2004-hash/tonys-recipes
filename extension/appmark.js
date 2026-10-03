// 1.4 — on the app's own pages only: say that the extension is installed, so the
// app offers it to people who do not have it and not to people who do. Reads
// nothing; writes attributes on the page.
// 1.6 — and where it came from: a store install updates itself (its manifest
// carries the store's update_url); a folder install has to be updated by hand.
try {
  var mf = chrome.runtime.getManifest() || {};
  document.documentElement.setAttribute('data-mkn-extension-' + MKN_TAG, mf.version || '1');
  document.documentElement.setAttribute('data-mkn-extension-' + MKN_TAG + '-from', mf.update_url ? 'store' : 'folder');
} catch (e) {}
