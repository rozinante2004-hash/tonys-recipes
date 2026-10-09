// 1.7.2 — Firefox may hold back the sites the extension works on until they are allowed:
// say so, with one button (a click is what Firefox needs to ask).
(function () {
  var box = document.getElementById('perm');
  if (!box || typeof chrome === 'undefined' || !chrome.permissions) return;
  var origins = (chrome.runtime.getManifest().host_permissions || []);
  if (!origins.length) return;
  function check() { chrome.permissions.contains({ origins: origins }, function (ok) { box.hidden = !!ok; }); }
  document.getElementById('permGo').addEventListener('click', function () {
    chrome.permissions.request({ origins: origins }, function () { check(); });
  });
  check();
})();
// 1.7 — the store copy: My Kitchen Notes, or the family's app (see shared.js).
function show(u) { document.getElementById('app').textContent = u; }
if (typeof MKN_FAMILY_APP === 'string' && MKN_FAMILY_APP && typeof chrome !== 'undefined' && chrome.storage) {
  document.getElementById('choose').hidden = false;
  chrome.storage.local.get('mknFamily', function (o) {
    var fam = !!(o && o.mknFamily);
    document.querySelector('input[value="' + (fam ? 'family' : 'beta') + '"]').checked = true;
    show(fam ? MKN_FAMILY_APP : MKN_APP);
  });
  document.getElementById('choose').addEventListener('change', function (e) {
    var fam = e.target.value === 'family';
    chrome.storage.local.set({ mknFamily: fam });
    show(fam ? MKN_FAMILY_APP : MKN_APP);
  });
} else show(MKN_APP);
