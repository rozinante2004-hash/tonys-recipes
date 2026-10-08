// 1.4 — on the app's own pages only: say that the extension is installed, so the
// app offers it to people who do not have it and not to people who do. Reads
// nothing; writes attributes on the page.
// 1.6 — and where it came from: a store install updates itself (its manifest
// carries the store's update_url); a folder install has to be updated by hand.
// 1.7 — the store copy serves two apps: on each it says so under that app's own
// name (the family's 'live', the beta's 'beta').
// 1.7.1 — Tony: merely opening the family app's address must not be enough.
// "Save recipe" sends there from now on only once the family app has opened a
// household for the person here — the app marks its page `data-mkn-member`
// (app v37.98); a stranger is turned away before that (by invitation only).
try {
  var mf = chrome.runtime.getManifest() || {};
  var fam = typeof MKN_FAMILY_APP === 'string' && MKN_FAMILY_APP && location.href.indexOf(MKN_FAMILY_APP) === 0;
  var tag = (typeof MKN_FAMILY_APP === 'string' && MKN_FAMILY_APP) ? (fam ? 'live' : 'beta') : MKN_TAG;
  document.documentElement.setAttribute('data-mkn-extension-' + tag, mf.version || '1');
  document.documentElement.setAttribute('data-mkn-extension-' + tag + '-from', mf.update_url ? 'store' : 'folder');
  if (fam) {
    var mknMemberSeen = function () {
      if (document.documentElement.getAttribute('data-mkn-member') !== '1') return false;
      chrome.storage.local.set({ mknFamily: true });
      return true;
    };
    if (!mknMemberSeen()) {
      var mknWatch = new MutationObserver(function () { if (mknMemberSeen()) mknWatch.disconnect(); });
      mknWatch.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mkn-member'] });
    }
  }
} catch (e) {}
