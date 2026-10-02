// 1.4 — on the app's own pages only: say that the extension is installed, so the
// app offers it to people who do not have it and not to people who do. Reads
// nothing; writes one attribute on the page.
try {
  document.documentElement.setAttribute('data-mkn-extension-' + MKN_TAG, (chrome.runtime.getManifest() || {}).version || '1');
} catch (e) {}
