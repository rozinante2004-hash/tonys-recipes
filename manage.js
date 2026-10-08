// ─── THE MANAGEMENT APP (v37.58, design step 4) ──────────────────────────────
// Tony's own view of every household (family, test or beta — each copy has its
// own database; v37.71: the other copies' through the Worker): who is in it, what its AI has cost this month and the
// two before, its allowance (which he can change), who it is linked with, how
// many new households its ✉️ share link brought, and when anyone last opened
// the app. Loaded only when he opens it (⚙️ → 📊 Households); nobody else can
// read any of it — the database rules (appAdmin) and the Worker (OWNER_EMAILS)
// both check that it is him. It never reads anyone's recipes.
(function () {
  'use strict';
  var S = { rows: [], sort: 'month', dir: -1, q: '', meter: null, meterError: '', loadError: '', open: null, loading: false,
            tab: 'households', notes: null, notesError: '', noteFilter: 'open', founding: null };
  function esc(v) { return escH(String(v == null ? '' : v)); }
  function money(v) { return '$' + (Number(v) || 0).toFixed(2); }
  // v67 — a copy may have its own allowance (the family's: $10, no first-month extra).
  function ownCap(project) { var b = S.meter && S.meter.defaults && S.meter.defaults.byProject; return b && typeof b[project] === 'number' ? b[project] : null; }
  function defCap(project) { var o = ownCap(project); return o != null ? o : S.meter.defaults.cap; }
  function famCap() { return ownCap(Object.keys(COPY_NAME).filter(function (k) { return COPY_NAME[k] === 'family'; })[0]); }
  function capWords(project) { var o = ownCap(project); return o != null ? '$' + o + '/month per household' : '$' + S.meter.defaults.cap + '/month ($' + S.meter.defaults.firstMonth + ' the first)'; }
  function ago(t) {
    if (!t) return '—';
    var d = (Date.now() - t) / 864e5;
    return d < 1 ? 'today' : d < 2 ? 'yesterday' : Math.floor(d) + ' days ago';
  }
  function roleRank(r) { var o = { owner: 0, admin: 1, editor: 2, viewer: 3 }; return Object.prototype.hasOwnProperty.call(o, r) ? o[r] : 4; }
  function mon(m) { var p = String(m).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, 1)).toLocaleDateString(undefined, { month: 'short' }); }

  // v37.78 — Tony: the beta's Households "should only include its own
  // details". Every copy's households are listed in the FAMILY app only.
  function allCopiesHere() {
    if (window._allCopiesOverride !== undefined) return !!window._allCopiesOverride;   // the tests
    return String((window.APP_CONFIG && APP_CONFIG.environment) || 'live') === 'live';
  }
  async function meterList() {
    if (!window._fbUser) throw new Error('Sign in first.');
    var t = await _fbUser.getIdToken();
    var r = await fetch(WORKER_ENDPOINT, { method: 'POST', headers: workerHeaders(),
      body: workerBody({ action: 'meter-admin', op: 'list', all: allCopiesHere(), idToken: t }), signal: AbortSignal.timeout(15000) });
    var d = {}; try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((d && d.error) || ('the server answered ' + r.status));
    return d;
  }
  async function meterSet(op, hid, extra) {
    var t = await _fbUser.getIdToken();
    var r = await fetch(WORKER_ENDPOINT, { method: 'POST', headers: workerHeaders(),
      body: workerBody(Object.assign({ action: 'meter-admin', op: op, hid: hid, idToken: t }, extra || {})), signal: AbortSignal.timeout(15000) });
    var d = {}; try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((d && d.error) || ('the server answered ' + r.status));
    return d;
  }

  // Everything about every household, gathered in five reads.
  // v37.60 — the database and the server are read independently: either can
  // fail (rules not yet published, the server's database not set up) without
  // hiding what the other knows, and the page SAYS which one failed — Tony saw
  // an empty table after an error box he had closed.
  async function load() {
    var rows = {}, byCode = {};
    S.loadError = '';
    try { await loadHouseholds(rows, byCode); }
    catch (e) { S.loadError = String((e && e.message) || e); }
    S.meter = null; S.meterError = '';
    try { S.meter = await meterList(); } catch (e) { S.meterError = e.message; }
    // v37.96 — whether newcomers may start a household in THIS copy.
    try { S.founding = typeof hhFoundingOpen === 'function' ? await hhFoundingOpen(true) : null; } catch (e) { S.founding = null; }
    var spend = {}, here = thisProject();
    if (S.meter) (S.meter.households || []).forEach(function (h) {
      // v37.71 — another copy's household: listed from what it reported to the
      // server (Worker v62). One that never reported is not listed: it may be
      // long deleted, and its spending alone says nothing about it.
      if (h.project && h.project !== here) { if (h.report && allCopiesHere()) remoteRow(rows, h); return; }
      spend[h.hid] = h;
      // v37.72 — deleted, and kept on the list, marked (Tony: "do not remove
      // these entries"): what the server noted when it went.
      if (h.report && h.report.deletedAt && !S.loadError && !rows[h.hid]) { remoteRow(rows, h, true); return; }
      // known to the server but not readable here (the database refused): still
      // listed, from what the server noted. Otherwise the database is the list —
      // a deleted household keeps its spending history on the server, unlisted.
      if (S.loadError && !rows[h.hid]) rows[h.hid] = { key: h.hid, hid: h.hid, name: h.name || '', code: h.code || '', ownerUid: '', createdAt: h.created_at || 0,
        referredBy: '', members: [], links: [], asking: [], asked: [], referred: 0, lastSeen: 0 };
    });
    finish(rows, spend);
  }
  async function loadHouseholds(rows, byCode) {
    var db = window._fbDb;
    var hs = await db.collection('households').get();
    hs.forEach(function (d) {
      var h = d.data() || {};
      rows[d.id] = { key: d.id, hid: d.id, name: h.name || '', code: h.code || '', ownerUid: h.ownerUid || '', createdAt: h.createdAt || 0,
                     referredBy: h.referredBy || '', members: [], links: [], asking: [], asked: [], referred: 0, lastSeen: 0 };
      if (h.code) byCode[h.code] = d.id;
    });
    (await db.collectionGroup('members').get()).forEach(function (d) {
      var hid = d.ref.parent.parent.id, m = d.data() || {};
      if (!rows[hid]) return;
      rows[hid].members.push({ uid: m.uid, email: m.email || '', name: m.name || '', role: m.role || '', lastSeen: m.lastSeen || 0, joinedAt: m.joinedAt || 0,
                               termsAt: m.termsAt || 0, termsVersion: m.termsVersion || '' });   // v37.83
      if (m.lastSeen > rows[hid].lastSeen) rows[hid].lastSeen = m.lastSeen;
    });
    try {
      (await db.collectionGroup('links').get()).forEach(function (d) {
        var hid = d.ref.parent.parent.id, l = d.data() || {};
        if (rows[hid]) rows[hid].links.push({ hid: d.id, name: l.name || '', code: l.code || '' });
      });
    } catch (e) {}
    try {
      (await db.collection('linkRequests').get()).forEach(function (d) {
        var q = d.data() || {};
        if (q.to && rows[q.to] && !q.declined) rows[q.to].asked.push({ from: q.fromName || q.fromCode || q.from, code: q.fromCode || '' });
        if (q.from && rows[q.from]) rows[q.from].asking.push({ to: q.toLabel || q.email || q.to });
      });
    } catch (e) {}
    Object.keys(rows).forEach(function (hid) {
      var by = rows[hid].referredBy && byCode[rows[hid].referredBy];
      if (by && rows[by]) rows[by].referred++;
    });
  }
  function thisProject() { return String((window.APP_CONFIG && APP_CONFIG.firebase && APP_CONFIG.firebase.projectId) || ''); }
  function copyOf(project) { return COPY_NAME[project] || project || ''; }
  // The copy's own page (deleting a household happens there, in its database).
  function copyUrl(project) {
    var c = copyOf(project), A = window.APP_CONFIG || {};
    var u = c === 'family' ? A.liveSiteUrl : c === 'test' ? (A.testCopy && A.testCopy.siteUrl) : c === 'beta' ? (A.betaCopy && A.betaCopy.siteUrl) : '';
    return u ? u + '?manage' : '';
  }
  function remoteRow(rows, h, here) {
    var p = h.report || {}, key = here ? h.hid : h.project + ':' + h.hid;
    var r = { key: key, hid: h.hid, project: here ? thisProject() : h.project, remote: !here,
              deleted: p.deletedAt ? { at: p.deletedAt, by: p.deletedBy || '', how: p.deletedHow || '' } : null, left: (p.left || []).slice(), name: h.name || p.name || '', code: h.code || p.code || '', ownerUid: '',
              createdAt: h.created_at || p.createdAt || 0, referredBy: p.referredBy || '', members: (p.members || []).slice(), links: (p.links || []).slice(),
              asking: [], asked: [], referred: 0, lastSeen: 0, reportAt: h.reportAt || 0, meter: h };
    r.members.forEach(function (m) { if (m.lastSeen > r.lastSeen) r.lastSeen = m.lastSeen; });
    rows[key] = r;
  }
  function finish(rows, spend) {
    // Referrals within each other copy, from the identifiers its households came through.
    var byCode = {};
    Object.keys(rows).forEach(function (k) { var r = rows[k]; if (r.remote && r.code) byCode[r.project + '/' + r.code] = r; });
    Object.keys(rows).forEach(function (k) { var r = rows[k], by = r.remote && r.referredBy && byCode[r.project + '/' + r.referredBy]; if (by) by.referred++; });
    S.rows = Object.keys(rows).map(function (key) {
      var r = rows[key], m = (r.remote || r.deleted) ? r.meter : (spend[r.hid] || null);
      if (!r.left) r.left = (m && m.report && m.report.left) || [];
      r.copy = copyOf(r.project || thisProject()) || 'this copy';
      r.capped = r.remote ? !!(m && m.capped) : !!(S.meter && S.meter.capped);
      var owner = r.members.filter(function (x) { return x.role === 'owner'; })[0];
      r.owner = owner ? owner.email : '';
      r.months = m ? m.months : [];
      r.month = r.months.length ? r.months[0].usd : 0;
      r.cap = m ? m.capNow : (r.capped ? defCap(r.project || thisProject()) : null);
      r.capSet = m && typeof m.cap === 'number';
      r.note = (m && m.note) || '';
      if (m && m.last_seen > r.lastSeen) r.lastSeen = m.last_seen;
      return r;
    });
  }

  // v37.64 — notes from the floating 💬 button (feedback/<id>), newest first.
  // v37.68 — the one inbox (the Worker, every copy) and anything kept in this
  // copy's own database before it (v37.64–67), together, newest first.
  var COPY_NAME = { 'recipes-f379d': 'family', 'tonys-recipes-test': 'test', 'my-kitchen-notes-beta': 'beta' };
  async function loadNotes() {
    S.notesError = '';
    var out = [], errs = [];
    try {
      var t = await window._fbUser.getIdToken();
      var r = await fetch(WORKER_ENDPOINT, { method: 'POST', headers: workerHeaders(),
        body: workerBody({ action: 'meter-admin', op: 'notes', idToken: t }), signal: AbortSignal.timeout(20000) });
      var d = {}; try { d = await r.json(); } catch (e) {}
      if (!r.ok) throw new Error((d && d.error) || ('the server answered ' + r.status));
      (d.notes || []).forEach(function (n) { out.push(Object.assign({}, n, { key: 's' + n.id, src: 'server', copy: COPY_NAME[n.project] || n.env || n.project })); });
    } catch (e) { if (!/not set up|METER_DB|Unknown|no messages/i.test(e.message)) errs.push('the server: ' + e.message); }
    try {
      (await window._fbDb.collection('feedback').orderBy('at', 'desc').limit(300).get()).forEach(function (doc) {
        var n = doc.data() || {}; out.push(Object.assign({ id: doc.id }, n, { key: 'd' + doc.id, src: 'db', copy: n.env === 'live' ? 'family' : (n.env || '') }));
      });
    } catch (e) { if (!/permission/i.test(e.message) || !out.length) errs.push('this copy\u2019s database: ' + e.message); }
    out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    S.notes = out; S.notesError = (!out.length && errs.length) ? errs.join('; ') : ''; S.notesPartial = errs.length > 0;
  }
  function noteBy(key) { return (S.notes || []).filter(function (n) { return n.key === key; })[0]; }
  function newCount() { return (S.notes || []).filter(function (n) { return n.status === 'new'; }).length; }
  // v37.68 — the ⚙️ dot follows what is marked here.
  // v37.94 — what is counted here is a real count: kept on the device too (feedbackKnown).
  function syncDot() { if (S.notes && !S.notesError && !S.notesPartial) { if (typeof feedbackKnown === 'function') feedbackKnown(newCount()); else if (typeof feedbackDot === 'function') feedbackDot(newCount()); } }
  function notesHtml() {
    if (S.notesError) return '<div class="mg-note">The notes could not be read: ' + esc(S.notesError)
      + (/permission/i.test(S.notesError) ? ' \u2014 this copy\u2019s database rules need publishing (⚙️ → 🏠 My household → 👥 Family Access → Show rules).' : '') + '</div>';
    if (!S.notes) return '<div class="mg-empty">⏳ Reading the notes…</div>';
    var list = S.notes.filter(function (n) { return S.noteFilter === 'all' || n.status !== 'done'; });
    var filt = '<div class="mg-tools" style="margin-bottom:10px;">'
      + '<button type="button" class="mg-btn' + (S.noteFilter === 'open' ? ' mg-primary' : '') + '" onclick="mknManage.noteFilter(\'open\')">Not done yet</button>'
      + '<button type="button" class="mg-btn' + (S.noteFilter === 'all' ? ' mg-primary' : '') + '" onclick="mknManage.noteFilter(\'all\')">All (' + S.notes.length + ')</button></div>';
    if (!list.length) return filt + '<div class="mg-empty">' + (S.notes.length ? 'Every note is done. 🎉' : 'No notes yet.') + '</div>';
    var tag = { new: '🆕 new', seen: '👀 seen', done: '✅ done' };
    return filt + list.map(function (n) {
      var subj = encodeURIComponent('Your note about My Kitchen Notes');
      var body = encodeURIComponent('\n\n\u2014 you wrote (' + new Date(n.at || 0).toLocaleString() + '):\n' + (n.text || ''));
      // v37.95 — the key carries a document's id (anyone signed in may choose one): as an
      // attribute it is escA'd, as a handler's argument a JS string (jsA).
      var k = escA(n.key), kj = jsA(n.key);
      return '<div class="mg-card' + (n.status === 'new' ? ' mg-new' : '') + '" id="mgNote-' + k + '">'
        + '<div class="mg-ptop"><div><b class="mg-email">' + esc(n.email || n.uid) + '</b> <span class="mg-muted">' + esc(n.household || '') + '</span>'
        + (n.copy ? ' <span class="mg-copy">' + esc(n.copy) + '</span>' : '')
        + '<div class="mg-muted">' + new Date(n.at || 0).toLocaleString() + ' · ' + esc(n.version || '') + ' · ' + esc(n.env || '') + ' · ' + esc(n.lang || '') + '</div></div>'
        + '<span class="mg-muted">' + (tag[n.status] || esc(n.status)) + '</span></div>'
        + '<div class="mg-text" dir="auto">' + esc(n.text || '') + '</div>'
        + (n.shot ? '<img class="mg-shot" src="' + escA(n.shot) + '" alt="The tester\u2019s screenshot" onclick="this.classList.toggle(\'mg-big\')">' : '')
        + (n.log ? '<details><summary class="mg-muted">What the app was doing (' + Math.round(n.log.length / 1024) + ' KB)</summary>'
            + '<pre class="mg-log">' + esc(n.log) + '</pre><button type="button" class="mg-btn" onclick="mknManage.copyLog(' + kj + ')">📋 Copy the log</button></details>' : '')
        + '<div class="mg-device mg-muted">' + esc(n.device || '') + '</div>'
        + '<div class="mg-tools" style="margin-top:8px;">'
        // v37.94 — Tony: Reply by e-mail did nothing (the browser hands mailto: to the
        // computer, and his has no e-mail app set for it). Gmail opens in a new tab, filled in;
        // the e-mail app stays beside it for computers where it is set up.
        + (n.email ? '<a class="mg-btn" target="_blank" rel="noopener" href="https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(n.email) + '&su=' + subj + '&body=' + body + '">✉️ Reply in Gmail</a>'
            + '<a class="mg-btn" href="mailto:' + escA(n.email) + '?subject=' + subj + '&body=' + body + '" title="Opens the e-mail app this computer is set to use">📨 E-mail app</a>' : '')
        + (n.status !== 'seen' ? '<button type="button" class="mg-btn" onclick="mknManage.mark(' + kj + ',\'seen\')">👀 Seen</button>' : '')
        + (n.status !== 'done' ? '<button type="button" class="mg-btn" onclick="mknManage.mark(' + kj + ',\'done\')">✅ Done</button>' : '')
        + '<button type="button" class="mg-btn mg-danger" onclick="mknManage.delNote(' + kj + ')">🗑</button></div></div>';
    }).join('');
  }

  function sorted() {
    var q = S.q.trim().toLowerCase();
    var list = S.rows.filter(function (r) {
      if (!q) return true;
      return [r.name, r.code, r.owner, r.copy, r.deleted ? 'deleted ' + r.deleted.by : ''].concat(r.members.map(function (m) { return m.email; })).join(' ').toLowerCase().indexOf(q) !== -1;
    });
    var key = { name: function (r) { return r.name.toLowerCase(); }, copy: function (r) { return r.copy; }, owner: function (r) { return r.owner; },
                members: function (r) { return r.members.length; }, month: function (r) { return r.month; },
                cap: function (r) { return r.cap == null ? 1e9 : r.cap; }, links: function (r) { return r.links.length; },
                referred: function (r) { return r.referred; }, seen: function (r) { return r.lastSeen; } }[S.sort] || function (r) { return r.month; };
    return list.sort(function (a, b) {
      if (!!a.deleted !== !!b.deleted) return a.deleted ? 1 : -1;     // v37.72 — the deleted ones last
      var x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * S.dir; });
  }

  function barHtml(r) {
    if (r.cap == null) return '<span class="mg-num">' + money(r.month) + '</span>';
    var pct = r.cap > 0 ? Math.min(100, Math.round(r.month / r.cap * 100)) : 100;
    var tone = pct >= 100 ? 'var(--danger)' : pct >= 80 ? '#C98A14' : 'var(--ok-text)';
    return '<div class="mg-num">' + money(r.month) + ' <span class="mg-muted">of ' + money(r.cap) + '</span></div>'
      + '<div class="mg-bar"><div style="width:' + pct + '%;background:' + tone + ';"></div></div>';
  }
  function th(key, label) {
    return '<th><button type="button" class="mg-sort" onclick="mknManage.sortBy(\'' + key + '\')">' + label
      + (S.sort === key ? (S.dir < 0 ? ' ▾' : ' ▴') : '') + '</button></th>';
  }
  function render() {
    var ov = document.getElementById('manageOverlay');
    if (!ov) return;
    var body = ov.querySelector('.mg-body');
    var env = String((window.APP_CONFIG && APP_CONFIG.environment) || 'live');
    var copies = [['live', 'family', APP_CONFIG.liveSiteUrl], ['test', 'test', APP_CONFIG.testCopy && APP_CONFIG.testCopy.siteUrl],
                  ['beta', 'beta', APP_CONFIG.betaCopy && APP_CONFIG.betaCopy.siteUrl]]
      .filter(function (c) { return c[2] && c[0] !== env; });
    // v37.70 — each copy has its own households: one tap opens another copy's list.
    var multi = S.rows.some(function (r) { return r.remote; });
    var nDel = S.rows.filter(function (r) { return r.deleted; }).length;
    var others = copies.length ? '<div class="mg-muted" style="margin-top:4px;">' + (multi ? 'Their own pages: ' : 'Other copies: ') + copies.map(function (c) {
        return '<a class="mg-link" href="' + escA(c[2] + '?manage') + '" target="_blank" rel="noopener">' + esc(c[1]) + ' \u2197</a>'; }).join(' · ') + '</div>' : '';
    var head = '<div class="mg-top"><div><div class="mg-title">📊 Households</div><div class="mg-muted">'
      + (multi ? 'every copy' : esc(env === 'live' ? 'the family’s copy' : env + ' copy')) + ' · ' + (S.rows.length - nDel) + ' household' + (S.rows.length - nDel === 1 ? '' : 's')
      + (multi ? ' (' + copyCounts() + ')' : '') + (nDel ? ' \u00b7 ' + nDel + ' deleted' : '')
      + (!S.meter ? '' : multi ? ' · AI allowance $' + S.meter.defaults.cap + '/month ($' + S.meter.defaults.firstMonth + ' the first) on the test copy and the beta; '
            + (famCap() != null ? 'the family’s $' + famCap() + '/month' : 'the family’s is counted, not capped')
          : ' · AI ' + (S.meter.capped ? 'allowance ' + capWords(thisProject()) : 'counted, not capped')) + '</div>' + others + '</div>'
      + '<div class="mg-tools"><input id="mgSearch" type="search" placeholder="Search name, identifier or e-mail" value="' + escA(S.q) + '" oninput="mknManage.search(this.value)">'
      + '<button type="button" class="mg-btn" onclick="mknManage.csv()">⬇ CSV</button>'
      + '<button type="button" class="mg-btn" onclick="mknManage.reload()">↻</button></div></div>';
    if (S.loadError) head += '<div class="mg-note" id="mgLoadError">The households could not be read from the database: ' + esc(S.loadError)
      + (/permission/i.test(S.loadError) ? ' \u2014 this copy\u2019s database rules need publishing: ⚙️ → 🏠 My household → 👥 Family Access → 🔧 Show Firestore security rules → Copy → Firebase → Publish, then ↻.' : '') + '</div>';
    // v37.96 — Tony (security audit, "b"): newcomers by invitation only, per copy.
    if (S.founding !== null) head += '<div class="mg-muted" id="mgFounding" style="margin:6px 0 2px;">New households in this copy: <b>'
      + (S.founding ? 'anyone who signs in may start one' : 'by invitation only') + '</b> '
      + '<button type="button" class="mg-btn" id="mgFoundingBtn" style="min-height:28px;padding:3px 10px;" onclick="mknManage.setFounding(' + (S.founding ? 'false' : 'true') + ')">'
      + (S.founding ? '🔒 Invitation only' : '🔓 Let anyone start one') + '</button></div>';
    if (S.meterError) head += '<div class="mg-note">AI spending could not be read: ' + esc(S.meterError)
      + (/METER_DB/.test(S.meterError) ? ' — the server’s spending database is not set up yet.' : '') + '</div>';
    var nc = newCount();
    // v37.73 — the notes are read in the family app only (Tony: never in the beta's).
    var inbox = typeof feedbackInboxHere !== 'function' || feedbackInboxHere();
    if (!inbox) S.tab = 'households';
    var tabs = !inbox ? '' : '<div class="mg-tabs" role="tablist">'
      + '<button type="button" role="tab" aria-selected="' + (S.tab === 'households') + '" class="mg-tab' + (S.tab === 'households' ? ' mg-on' : '') + '" onclick="mknManage.tabTo(\'households\')">🏠 Households</button>'
      + '<button type="button" role="tab" aria-selected="' + (S.tab === 'feedback') + '" class="mg-tab' + (S.tab === 'feedback' ? ' mg-on' : '') + '" onclick="mknManage.tabTo(\'feedback\')">💬 Feedback' + (nc ? ' <span class="mg-badge">' + nc + '</span>' : '') + '</button></div>';
    if (S.tab === 'feedback') { body.innerHTML = tabs + notesHtml(); return; }
    head = tabs + head;
    if (S.loading) { body.innerHTML = head + '<div class="mg-empty">⏳ Reading every household…</div>'; return; }
    var list = sorted();
    var months = (S.meter && S.meter.months) || [];
    var table = '<div class="mg-scroll"><table class="mg-table"><thead><tr>'
      + th('name', 'Household') + (multi ? th('copy', 'Copy') : '') + th('owner', 'Owner') + th('members', 'Members') + th('month', 'This month')
      + th('cap', 'Cap') + '<th>' + (months.length ? months.slice(1).map(mon).reverse().join(' · ') : 'Before') + '</th>'
      + th('links', 'Linked with') + th('referred', 'Shared the app') + th('seen', 'Last active') + '</tr></thead><tbody>'
      + (list.length ? list.map(function (r) {
          return '<tr class="mg-row' + (S.open === r.key ? ' mg-open' : '') + (r.deleted ? ' mg-deleted' : '') + '" onclick="mknManage.show(' + jsA(r.key) + ')">'
            + '<td><div class="mg-name" dir="auto">' + esc(r.name || '(no name)') + '</div><div class="mg-muted mg-code">' + esc(r.code || '—') + '</div>'
            + (r.deleted ? '<div class="mg-gone">\u{1F5D1} ' + esc(deletedText(r.deleted)) + '</div>' : '')
            + (r.left && r.left.length ? '<div class="mg-muted">' + r.left.length + ' left (deleted their account)</div>' : '') + '</td>'
            + (multi ? '<td><span class="mg-copy">' + esc(r.copy) + '</span></td>' : '')
            + '<td class="mg-email">' + esc(r.owner || '—') + '</td>'
            + '<td class="mg-c">' + r.members.length + '</td>'
            + '<td>' + barHtml(r) + '</td>'
            + '<td class="mg-c">' + (r.cap == null ? '—' : money(r.cap) + (r.capSet ? ' ✎' : '')) + '</td>'
            + '<td class="mg-muted">' + (r.months.length ? r.months.slice(1).reverse().map(function (m) { return money(m.usd); }).join(' · ') : '—') + '</td>'
            + '<td>' + (r.links.length ? r.links.map(function (l) { return esc(l.name || l.code); }).join(', ') : '—') + '</td>'
            + '<td class="mg-c">' + (r.referred || '—') + '</td>'
            + '<td>' + ago(r.lastSeen) + '</td></tr>';
        }).join('') : '<tr><td colspan="' + (multi ? 10 : 9) + '" class="mg-empty">No household matches.</td></tr>')
      + '</tbody></table></div>';
    body.innerHTML = head + table + panelHtml();
  }
  // v37.72 — who deleted it, how, and when.
  function deletedText(d) {
    var who = d.by ? ' (' + d.by + ')' : '';
    return (d.how === 'account' ? 'Deleted with its owner\u2019s account' + who : d.how === 'admin' ? 'Deleted by you' + who : 'Deleted by its owner' + who)
      + ' \u00b7 ' + new Date(d.at).toLocaleDateString();
  }
  function leftHtml(r) {
    return (r.left || []).length ? '<div class="mg-h">Left</div>' + r.left.map(function (x) {
      return '<div class="mg-li"><span class="mg-email">' + esc(x.email || 'someone') + '</span> <span class="mg-muted">deleted their account \u00b7 '
        + new Date(x.at || 0).toLocaleDateString() + '</span></div>'; }).join('') : '';
  }
  function copyCounts() {
    var n = {};
    S.rows.forEach(function (r) { if (!r.deleted) n[r.copy] = (n[r.copy] || 0) + 1; });
    return Object.keys(n).sort().map(function (c) { return n[c] + ' ' + c; }).join(', ');
  }
  function openRow() { return S.rows.filter(function (x) { return x.key === S.open; })[0]; }
  function panelHtml() {
    var r = openRow();
    if (!r) return '';
    var url = r.remote ? copyUrl(r.project) : '';
    return '<div class="mg-panel" role="region" aria-label="Household details">'
      + '<div class="mg-ptop"><div><div class="mg-title" dir="auto">' + esc(r.name) + '</div><div class="mg-muted">' + esc(r.code || 'no identifier yet')
      + ' · founded ' + (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—') + (r.referredBy ? ' · came through ' + esc(r.referredBy) : '')
      + (r.remote && !r.deleted ? ' · <span class="mg-copy">' + esc(r.copy) + '</span> as of ' + ago(r.reportAt) : r.remote ? ' · <span class="mg-copy">' + esc(r.copy) + '</span>' : '') + '</div></div>'
      + '<button type="button" class="mg-btn" onclick="mknManage.show(null)" aria-label="Close the details">✕</button></div>'
      + (r.deleted ? '<div class="mg-note mg-gone">\u{1F5D1} ' + esc(deletedText(r.deleted)) + '. Its recipes and photos are gone; this is what was known about it then.</div>' : '')
      + (r.deleted ? '' : '<div class="mg-h">AI allowance</div>')
      + (r.deleted ? '' : r.cap == null && !r.capped ? '<div class="mg-muted">' + (r.remote ? 'The ' + esc(r.copy) + ' copy’s' : 'This copy’s') + ' AI is counted, not capped.</div>'
        : '<div class="mg-caprow">' + barHtml(r) + '<input id="mgCap" type="number" min="0" max="1000" step="0.5" value="' + (r.cap == null ? '' : r.cap) + '" aria-label="Monthly allowance in dollars">'
          + '<button type="button" class="mg-btn mg-primary" onclick="mknManage.saveCap()">Save</button>'
          + '<button type="button" class="mg-btn" onclick="mknManage.saveCap(0)" title="Stops its AI; nothing else is affected">Pause AI</button>'
          + (r.capSet ? '<button type="button" class="mg-btn" onclick="mknManage.saveCap(null)">Back to the default</button>' : '') + '</div>')
      + (r.months.length ? '<div class="mg-muted" style="margin-top:4px;">' + r.months.map(function (m) { return mon(m.month) + ': ' + money(m.usd) + ' (' + m.calls + ' calls)'; }).join(' · ') + '</div>' : '')
      + '<div class="mg-h">' + (r.deleted ? 'Members when it was deleted' : 'Members') + '</div>'
      + r.members.sort(function (a, b) { return roleRank(a.role) - roleRank(b.role); })
          .map(function (m) { return '<div class="mg-li"><span class="mg-email">' + esc(m.email) + '</span> <span class="mg-muted">' + esc(m.role) + ' · last opened ' + ago(m.lastSeen)
            // v37.83 — the record that they agreed to the terms (Tony).
            + ' · ' + (m.termsAt ? '\u{1F4DD} agreed to the terms' + (m.termsVersion ? ' (v' + esc(m.termsVersion) + ')' : '') + ' ' + new Date(m.termsAt).toLocaleDateString() : '<span class="mg-noterms">not yet agreed to the terms</span>')
            + '</span></div>'; }).join('')
      + leftHtml(r)
      + '<div class="mg-h">Linked with</div>' + (r.links.length ? r.links.map(function (l) { return '<div class="mg-li">' + esc(l.name) + ' <span class="mg-muted">' + esc(l.code) + '</span></div>'; }).join('') : '<div class="mg-muted">Nobody yet.</div>')
      + ((r.asked.length || r.asking.length) ? '<div class="mg-h">Requests waiting</div>'
          + r.asked.map(function (a) { return '<div class="mg-li">from ' + esc(a.from) + ' <span class="mg-muted">' + esc(a.code) + '</span></div>'; }).join('')
          + r.asking.map(function (a) { return '<div class="mg-li">to ' + esc(a.to) + '</div>'; }).join('') : '')
      + '<div class="mg-h">Shared the app</div><div>' + (r.referred ? r.referred + ' new household' + (r.referred === 1 ? '' : 's') + ' came through its ✉️ share link' : '<span class="mg-muted">No new households through its link yet.</span>') + '</div>'
      + '<div class="mg-h">Your notes</div><textarea id="mgNote" rows="3" dir="auto" placeholder="Only you see these.">' + esc(r.note) + '</textarea>'
      + '<div><button type="button" class="mg-btn" onclick="mknManage.saveNote()">Save the note</button></div>'
      + (r.deleted ? '' : '<div class="mg-h">Delete</div>')
      + (r.deleted ? '' : r.remote ? '<div class="mg-muted">It lives in the ' + esc(r.copy) + ' copy’s own database, so it is deleted there'
          + (url ? ': <a class="mg-link" href="' + escA(url) + '" target="_blank" rel="noopener">open the ' + esc(r.copy) + ' copy’s Households \u2197</a>' : '.') + '</div>'
       : mine(r) ? '<div class="mg-muted">This is the household you are in now. To delete it, use ⚙️ → 🏠 My household → 👥 Family Access → 🗑 Delete this household.</div>'
                 : '<button type="button" class="mg-btn mg-danger" id="mgDelete" onclick="mknManage.del()">🗑 Delete this household…</button>')
      + '</div>';
  }

  var CSS = '#manageOverlay{position:fixed;inset:0;z-index:1250;background:var(--cream);color:var(--ink);overflow:auto;font-family:"DM Sans","Heebo",sans-serif;}'
    + '#manageOverlay .mg-wrap{max-width:1280px;margin:0 auto;padding:16px;padding-top:calc(12px + env(safe-area-inset-top));'
    + 'padding-left:calc(16px + env(safe-area-inset-left));padding-right:calc(16px + env(safe-area-inset-right));}'
    // v37.68 — the Close button was under the iPhone's clock and battery: below them, and it stays in reach when scrolling.
    + '#manageOverlay .mg-bar0{display:flex;justify-content:flex-end;position:sticky;top:0;z-index:5;padding-top:env(safe-area-inset-top);margin-top:calc(-1 * env(safe-area-inset-top));background:var(--cream);}'
    + '.mg-top{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;justify-content:space-between;margin-bottom:12px;}'
    + '.mg-title{font:700 20px/1.2 "Playfair Display","Frank Ruhl Libre",serif;color:var(--heading);}'
    + '.mg-muted{color:var(--muted);font-size:12px;}.mg-code{font-family:ui-monospace,Menlo,Consolas,monospace;}'
    + '.mg-tools{display:flex;gap:6px;flex-wrap:wrap;}.mg-tools input{min-width:220px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--ink);font-size:14px;}'
    + '.mg-btn{padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--heading);cursor:pointer;font-size:13px;min-height:36px;}'
    + '.mg-primary{background:var(--terracotta-fill);color:#fff;border-color:transparent;}'
    + '.mg-danger{color:var(--danger);border-color:var(--danger);}'
    + '.mg-note{background:var(--note-bg);border-inline-start:3px solid var(--note-border);padding:8px 12px;margin-bottom:10px;font-size:13px;border-radius:6px;}'
    + '.mg-scroll{overflow-x:auto;border:1px solid var(--border);border-radius:10px;background:var(--card-bg);}'
    + '.mg-table{width:100%;min-width:900px;border-collapse:collapse;font-size:13px;}.mg-table th{text-align:start;background:var(--card-bg);position:sticky;top:0;border-bottom:1px solid var(--border);padding:0;white-space:nowrap;}'
    + '.mg-sort{all:unset;cursor:pointer;display:block;padding:9px 10px;font-weight:600;color:var(--heading);}'
    + '.mg-table td{padding:8px 10px;border-bottom:1px solid var(--border);vertical-align:top;}'
    + '.mg-row{cursor:pointer;}.mg-row:hover,.mg-open{background:var(--note-bg);}'
    + '.mg-name{font-weight:600;color:var(--heading);}.mg-email{word-break:break-all;}.mg-c{text-align:center;}.mg-num{white-space:nowrap;}'
    + '.mg-bar{height:6px;border-radius:3px;background:var(--border);margin-top:4px;min-width:90px;overflow:hidden;}.mg-bar>div{height:100%;}'
    + '.mg-empty{padding:24px;text-align:center;color:var(--muted);}'
    + '.mg-panel{margin-top:14px;border:1px solid var(--border);border-radius:10px;background:var(--card-bg);padding:14px 16px;}'
    + '.mg-ptop{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;}'
    + '.mg-h{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);margin:14px 0 4px;}'
    + '.mg-noterms{color:var(--danger);}.mg-li{padding:3px 0;}.mg-caprow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}'
    + '.mg-caprow input{width:90px;padding:7px 8px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--ink);}'
    + '.mg-tabs{display:flex;gap:6px;margin-bottom:12px;border-bottom:1px solid var(--border);}'
    + '.mg-tab{all:unset;cursor:pointer;padding:8px 14px;font-weight:600;color:var(--muted);border-bottom:3px solid transparent;}'
    + '.mg-tab.mg-on{color:var(--heading);border-bottom-color:var(--terracotta-fill);}'
    + '.mg-badge{display:inline-block;min-width:18px;padding:1px 6px;border-radius:9px;background:var(--terracotta-fill);color:#fff;font-size:11px;text-align:center;}'
    + '.mg-deleted{opacity:.62;}.mg-deleted .mg-name{text-decoration:line-through;}.mg-gone{color:var(--danger);font-size:12px;margin-top:2px;}'
    + '.mg-link{color:var(--terracotta);font-weight:600;text-decoration:none;}'
    + '.mg-copy{display:inline-block;padding:1px 7px;border-radius:9px;border:1px solid var(--border);font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;}'
    + '.mg-card{border:1px solid var(--border);border-radius:10px;background:var(--card-bg);padding:12px 14px;margin-bottom:10px;}'
    + '.mg-card.mg-new{border-inline-start:4px solid var(--terracotta-fill);}'
    + '.mg-text{white-space:pre-wrap;margin:8px 0;font-size:14px;line-height:1.5;}'
    + '.mg-shot{max-height:160px;max-width:100%;border-radius:8px;border:1px solid var(--border);cursor:zoom-in;display:block;margin:6px 0;}'
    + '.mg-shot.mg-big{max-height:none;cursor:zoom-out;}'
    + '.mg-log{max-height:260px;overflow:auto;font-size:11px;background:var(--note-bg);padding:8px;border-radius:6px;white-space:pre-wrap;}'
    + '.mg-device{font-size:11px;word-break:break-all;margin-top:4px;}'
    + 'a.mg-btn{text-decoration:none;display:inline-flex;align-items:center;}'
    + '#mgNote{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--ink);margin-bottom:6px;font:inherit;}';

  function mine(r) { return !!(typeof _household !== 'undefined' && _household && _household.hid === r.hid); }
  // v37.61 — Tony: "As the Admin, I should be able to delete accounts from this
  // Households table. With a verification pop up of course." A household and
  // everything in it: marked first (the rules then let him read and remove its
  // content — and only its), then its recipes, photos, chats, settings, the
  // requests in it, its links (both halves), link requests, places kept by
  // e-mail, its members, and last the household with its identifier. The
  // people's SIGN-INS are Firebase's own list: removing those takes a server
  // key no page may hold, so he is taken to that list with their addresses.
  async function deleteHousehold(r, onStep) {
    var db = window._fbDb, n = 0, ref = db.collection('households').doc(r.hid);
    async function inBatches(refs) {
      for (var i = 0; i < refs.length; i += 400) {
        var b = db.batch(); refs.slice(i, i + 400).forEach(function (x) { b.delete(x); });
        await b.commit(); n += Math.min(400, refs.length - i);
      }
    }
    async function refsOf(q) { var out = []; (await q.get()).forEach(function (d) { out.push(d.ref); }); return out; }
    onStep('Marking it for deletion…');
    await ref.update({ deleting: true });
    var kinds = ['recipes', 'photos', 'chats', 'state', 'requests', 'requestLog'];   // v37.80 — and its request history
    for (var k = 0; k < kinds.length; k++) {
      onStep('Deleting its ' + kinds[k] + '…');
      await inBatches(await refsOf(ref.collection(kinds[k])));
    }
    onStep('Removing its links and requests…');
    var links = await refsOf(ref.collection('links')), other = [];
    links.forEach(function (l) { other.push(db.collection('households').doc(l.id).collection('links').doc(r.hid)); });
    await inBatches(links.concat(other));
    await inBatches((await refsOf(db.collection('linkRequests').where('from', '==', r.hid)))
      .concat(await refsOf(db.collection('linkRequests').where('to', '==', r.hid))));
    await inBatches(await refsOf(db.collection('pending').where('hid', '==', r.hid)));
    onStep('Removing its members…');
    await inBatches(await refsOf(ref.collection('members')));
    var last = db.batch();
    last.delete(ref);
    if (r.code) last.delete(db.collection('codes').doc(r.code));
    await last.commit(); n += r.code ? 2 : 1;
    return n;
  }

  var api = window.mknManage = {
    // v37.96 — newcomers by invitation only (or not), in this copy.
    setFounding: async function (open) {
      try { await hhSetFoundingOpen(!!open); S.founding = !!open; render(); toast(open ? 'Anyone who signs in may start a household here.' : 'New households here: by invitation only.'); return true; }
      catch (e) { toast('Could not change it: ' + ((e && e.message) || e) + (/permission/i.test(String(e && e.message)) ? ' — publish this copy\u2019s database rules first.' : ''), 8000); return false; }
    },
    open: async function () {
      if (typeof isAppOwner === 'function' && !isAppOwner()) { toast('Only the app’s owner can open this.'); return false; }
      if (!document.getElementById('mgCss')) { var st = document.createElement('style'); st.id = 'mgCss'; st.textContent = CSS; document.head.appendChild(st); }
      var ov = document.getElementById('manageOverlay');
      if (!ov) {
        ov = document.createElement('div'); ov.id = 'manageOverlay'; ov.setAttribute('data-no-i18n', '');
        ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Households');
        ov.innerHTML = '<div class="mg-wrap"><div class="mg-bar0"><button type="button" class="mg-btn" onclick="mknManage.close()" aria-label="Close">✕ Close</button></div><div class="mg-body"></div></div>';
        document.body.appendChild(ov);
        ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') api.close(); });
      }
      if (typeof feedbackInboxHere !== 'function' || feedbackInboxHere()) loadNotes().then(function () { render(); syncDot(); });
      return api.reload();
    },
    tabTo: function (t) { S.tab = t; render(); if (t === 'feedback' && !S.notes) loadNotes().then(render); },
    noteFilter: function (f) { S.noteFilter = f; render(); },
    mark: async function (key, status) {
      var n = noteBy(key); if (!n) return false;
      try {
        if (n.src === 'server') await meterSet('note-status', '', { id: n.id, status: status });
        else await window._fbDb.collection('feedback').doc(n.id).update({ status: status });
      } catch (e) { showServiceError('Could not mark the note: ' + e.message); return false; }
      n.status = status; render(); syncDot(); return true;
    },
    delNote: async function (key) {
      var n = noteBy(key); if (!n) return false;
      if (await askConfirm({ icon: '🗑', title: 'Remove this note?', message: 'It is gone for good.', okLabel: 'Remove', danger: true }) !== true) return false;
      try {
        if (n.src === 'server') await meterSet('note-delete', '', { id: n.id });
        else await window._fbDb.collection('feedback').doc(n.id).delete();
      } catch (e) { showServiceError('Could not remove the note: ' + e.message); return false; }
      S.notes = (S.notes || []).filter(function (x) { return x.key !== key; }); render(); syncDot(); return true;
    },
    copyLog: function (key) { var n = noteBy(key); if (n && typeof fbProbeCopy === 'function') fbProbeCopy(n.log, 'The log'); },
    _notes: loadNotes,
    close: function () { var ov = document.getElementById('manageOverlay'); if (ov) ov.remove(); S.open = null; },
    reload: async function () {
      S.loading = true; render();
      try { await load(); }
      catch (e) { S.loadError = String((e && e.message) || e); }
      S.loading = false; render();
      var s = document.getElementById('mgSearch'); if (s && !S.open) s.focus();
      return S.rows.length;
    },
    search: function (v) { S.q = v; render(); var s = document.getElementById('mgSearch'); if (s) { s.focus(); s.setSelectionRange(v.length, v.length); } },
    sortBy: function (k) { if (S.sort === k) S.dir = -S.dir; else { S.sort = k; S.dir = (k === 'name' || k === 'owner') ? 1 : -1; } render(); },
    show: function (hid) { S.open = (hid && S.open !== hid) ? hid : null; render();
      if (S.open) { var p = document.querySelector('#manageOverlay .mg-panel'); if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
    saveCap: async function (v) {
      var r = openRow();
      if (!r) return false;
      var cap = v !== undefined ? v : (document.getElementById('mgCap') || {}).value;
      if (cap !== null && cap !== '' && !(Number(cap) >= 0)) { toast('A number of dollars, please.'); return false; }
      try { await meterSet('set-cap', r.hid, { cap: (cap === null || cap === '') ? null : Number(cap), project: r.project || undefined }); }
      catch (e) { showServiceError('Could not change the allowance: ' + e.message); return false; }
      toast(cap === null ? 'Back to the default allowance' : Number(cap) === 0 ? '⏸ Its AI is paused' : '✅ Allowance set to $' + Number(cap).toFixed(2));
      await api.reload(); S.open = r.key; render();
      return true;
    },
    del: async function () {
      var r = openRow();
      if (!r || r.remote || r.deleted || mine(r)) return false;
      var who = r.members.map(function (m) { return m.email; }).filter(Boolean);
      var typed = await askConfirm({ icon: '🗑', title: 'Delete \u201c' + (r.name || r.code || 'this household') + '\u201d?',
        message: 'Everything in it goes, for everyone in it: its recipes, photos, chats and settings, its links with other households, and its '
          + who.length + ' member' + (who.length === 1 ? '' : 's') + (who.length ? ' (' + who.join(', ') + ')' : '') + '. This cannot be undone.\n\n'
          + 'Their sign-ins stay: next time they open the app they are asked to start a collection or join one.\n\nType the household\u2019s name to confirm.',
        input: '', placeholder: r.name || '', okLabel: 'Delete it', danger: true });
      if (typeof typed !== 'string') return false;
      if (!sameTypedName(typed, r.name || r.code)) { toast('The name did not match \u2014 nothing was deleted.', 6000); return false; }
      var n;
      try { n = await deleteHousehold(r, function (msg) { toast('\u23f3 ' + msg, 4000); }); }
      catch (e) { showServiceError('The household could not be fully deleted: ' + (e && e.message)
        + (/permission/i.test(String(e && e.message)) ? '\n\nThis copy\u2019s database rules need publishing first (⚙️ → 🏠 My household → 👥 Family Access → Show rules).' : '')
        + '\n\nWhat was already removed stays removed; run it again to finish.'); return false; }
      syncLog('save', 'Deleted a household from the management app', { name: r.name, code: r.code, items: n });
      // v37.72 — kept on the list, marked as deleted by you, with who was in it.
      try { await meterSet('mark-deleted', r.hid, { name: r.name, code: r.code, report: { name: r.name, code: r.code, createdAt: r.createdAt,
        referredBy: r.referredBy, members: r.members, links: r.links } }); } catch (e) {}
      S.open = null;
      await api.reload();
      var pid = (window.APP_CONFIG && APP_CONFIG.firebase && APP_CONFIG.firebase.projectId) || '';
      var open = await askConfirm({ icon: '✅', title: 'Deleted', message: '\u201c' + (r.name || r.code) + '\u201d and everything in it are gone (' + n + ' items).'
          + (who.length ? '\n\nTheir sign-ins are kept in Firebase\u2019s own list. To remove those too, open it and delete: ' + who.join(', ') + '.' : ''),
        okLabel: who.length ? 'Open Firebase\u2019s list of sign-ins' : 'OK', cancelLabel: 'Close' });
      if (open === true && who.length && pid) window.open('https://console.firebase.google.com/project/' + encodeURIComponent(pid) + '/authentication/users', '_blank', 'noopener');
      return n;
    },
    saveNote: async function () {
      var r = openRow();
      if (!r) return false;
      try { await meterSet('set-note', r.hid, { note: (document.getElementById('mgNote') || {}).value || '', project: r.project || undefined }); }
      catch (e) { showServiceError('Could not save the note: ' + e.message); return false; }
      toast('Note saved'); r.note = (document.getElementById('mgNote') || {}).value || '';
      return true;
    },
    csv: function () {
      var months = (S.meter && S.meter.months) || [];
      var head = ['Household', 'Identifier', 'Copy', 'Owner', 'Members', 'Member e-mails (terms agreed)'].concat(months.map(function (m) { return 'AI ' + m + ' ($)'; }))
        .concat(['Cap ($)', 'Linked with', 'Shared the app', 'Last active', 'Founded', 'Came through', 'Notes', 'Deleted', 'Left']);
      var lines = [head].concat(sorted().map(function (r) {
        return [r.name, r.code, r.copy, r.owner, r.members.length, r.members.map(function (m) { return m.email + ' (' + m.role + (m.termsAt ? ', terms v' + (m.termsVersion || '?') + ' ' + new Date(m.termsAt).toISOString().slice(0, 10) : ', terms not agreed') + ')'; }).join('; ')]
          .concat(months.map(function (m) { var x = r.months.filter(function (y) { return y.month === m; })[0]; return x ? x.usd.toFixed(4) : '0'; }))
          .concat([r.cap == null ? '' : r.cap, r.links.map(function (l) { return l.name; }).join('; '), r.referred,
                   r.lastSeen ? new Date(r.lastSeen).toISOString().slice(0, 10) : '', r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
                   r.referredBy, r.note, r.deleted ? deletedText(r.deleted) : '',
                   (r.left || []).map(function (x) { return x.email + ' ' + new Date(x.at || 0).toISOString().slice(0, 10); }).join('; ')]);
      })).map(function (row) { return row.map(function (c) { c = String(c == null ? '' : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); });
      var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'households-' + (S.rows.some(function (r) { return r.remote; }) ? 'all' : String((window.APP_CONFIG && APP_CONFIG.environment) || 'live')) + '-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return lines.length - 1;
    },
    _state: S, _load: load, _render: render
  };
  window._manageLoaded = true;
})();
