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
