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
            tab: 'households', notes: null, notesError: '', noteFilter: 'open', founding: null,
            replies: {}, replying: null, replyDraft: '', replySending: false,
            errors: null, errorsError: '', errFilter: 'open', useCopy: '',   // v38.15
            picked: {},   // v38.16 — the notes ticked for 📋 Copy reports
            survey: null, surveyError: '' };   // v38.18 — 📝 the end-of-beta question
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
      r.usage = (m && m.usage) || null;           // v38.15 — { 'YYYY-MM': { feature: times } } (Worker v69)
      if (m && m.last_seen > r.lastSeen) r.lastSeen = m.last_seen;
      return r;
    });
  }

  // v37.64 — notes from the floating 💬 button (feedback/<id>), newest first.
  // v37.68 — the one inbox (the Worker, every copy) and anything kept in this
  // copy's own database before it (v37.64–67), together, newest first.
  var COPY_NAME = { 'recipes-f379d': 'family', 'tonys-recipes-test': 'test', 'my-kitchen-notes-beta': 'beta' };
  // v38.04 — only the newest read counts: one still under way when the window closes, or
  // overtaken by a newer one, is dropped (CI: a late read from an earlier window replaced
  // the notes the Feedback tab was showing).
  var _notesGen = 0;
  async function loadNotes() {
    var gen = ++_notesGen;
    var out = [], errs = [], replies = {};
    try {
      var t = await window._fbUser.getIdToken();
      var r = await fetch(WORKER_ENDPOINT, { method: 'POST', headers: workerHeaders(),
        body: workerBody({ action: 'meter-admin', op: 'notes', idToken: t }), signal: AbortSignal.timeout(20000) });
      var d = {}; try { d = await r.json(); } catch (e) {}
      if (!r.ok) throw new Error((d && d.error) || ('the server answered ' + r.status));
      (d.notes || []).forEach(function (n) { out.push(Object.assign({}, n, { key: 's' + n.id, src: 'server', copy: COPY_NAME[n.project] || n.env || n.project })); });
      // v38.00 — the answers sent to them in the writers' apps (Worker v68).
      (d.replies || []).forEach(function (x) { (replies[x.note_id] = replies[x.note_id] || []).push(x); });
    } catch (e) { if (!/not set up|METER_DB|Unknown|no messages/i.test(e.message)) errs.push('the server: ' + e.message); }
    try {
      (await window._fbDb.collection('feedback').orderBy('at', 'desc').limit(300).get()).forEach(function (doc) {
        var n = doc.data() || {}; out.push(Object.assign({ id: doc.id }, n, { key: 'd' + doc.id, src: 'db', copy: n.env === 'live' ? 'family' : (n.env || '') }));
      });
    } catch (e) { if (!/permission/i.test(e.message) || !out.length) errs.push('this copy\u2019s database: ' + e.message); }
    if (gen !== _notesGen) return false;
    out.sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    S.notes = out; S.replies = replies; S.notesError = (!out.length && errs.length) ? errs.join('; ') : ''; S.notesPartial = errs.length > 0;
    return true;
  }
  // v38.16 — the notes ticked, in the order shown (newest first), and all of each as text.
  function pickedNotes() { return (S.notes || []).filter(function (n) { return S.picked[n.key]; }); }
  function shownNotes() { return (S.notes || []).filter(function (n) { return S.noteFilter === 'all' || n.status !== 'done'; }); }
  function when(t) { var d = new Date(t || 0); return d.toLocaleString() + ' (UTC ' + d.toISOString().slice(0, 16).replace('T', ' ') + ')'; }
  function reportText(n, i, total) {
    var L = [];
    L.push('=== Report ' + (i + 1) + ' of ' + total + ' — ' + (n.src === 'server' ? 'note #' + n.id : 'kept in this copy’s database') + ' (' + (n.copy || n.env || '?') + ') ===');
    L.push('From: ' + (n.email || n.uid || 'unknown') + (n.name ? ' (' + n.name + ')' : '') + (n.household ? ' · Household: ' + n.household : '') + (n.hid ? ' [' + n.hid + ']' : ''));
    L.push('When: ' + when(n.at) + ' · App ' + (n.version || '?') + ' · Copy: ' + (n.copy || n.env || '?') + ' · Language: ' + (n.lang || '?') + ' · Status: ' + (n.status || '?'));
    if (n.where) L.push('Where in the app: ' + n.where);
    L.push('Device: ' + (n.device || '?'));
    if (n.shot) L.push('Screenshot: yes — attached to the note in the app (pictures are not copied as text)');
    L.push('--- Note ---', String(n.text || '').trim() || '(empty)');
    var reps = n.src === 'server' ? (S.replies[n.id] || []) : [];
    if (reps.length) {
      L.push('--- Answers sent to their app ---');
      reps.forEach(function (x) { L.push('[' + when(x.at) + '] ' + String(x.text || '').trim() + (x.read_at ? '  (read ' + when(x.read_at) + ')' : '  (not read yet)')); });
    }
    L.push(n.log ? '--- What the app was doing (log, ' + Math.round(n.log.length / 1024) + ' KB) ---\n' + String(n.log).trim() : '--- No log was sent with this note ---');
    return L.join('\n');
  }
  function reportsText(list) {
    return 'Notes about My Kitchen Notes — ' + list.length + ' report' + (list.length === 1 ? '' : 's') + ', copied ' + when(Date.now()) + '\n\n'
      + list.map(function (n, i) { return reportText(n, i, list.length); }).join('\n\n');
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
    // v38.16 — Tony: "select several feedback reports and in one click on a "Copy Reports" button,
    // will copy all relevant information, so I could paste it here … in one go".
    var nPicked = pickedNotes().length;
    var filt = '<div class="mg-tools" style="margin-bottom:10px;">'
      + '<button type="button" class="mg-btn' + (S.noteFilter === 'open' ? ' mg-primary' : '') + '" onclick="mknManage.noteFilter(\'open\')">Not done yet</button>'
      + '<button type="button" class="mg-btn' + (S.noteFilter === 'all' ? ' mg-primary' : '') + '" onclick="mknManage.noteFilter(\'all\')">All (' + S.notes.length + ')</button>'
      + (list.length ? '<span class="mg-sep"></span>'
        + '<button type="button" class="mg-btn" id="mgPickAll" onclick="mknManage.pickAll(true)">☑ Select all shown</button>'
        + (nPicked ? '<button type="button" class="mg-btn" id="mgPickNone" onclick="mknManage.pickAll(false)">☐ Clear</button>' : '')
        + '<button type="button" class="mg-btn mg-primary" id="mgCopyReports"' + (nPicked ? '' : ' disabled title="Tick the notes to copy first"')
        + ' onclick="mknManage.copyReports()">📋 Copy reports' + (nPicked ? ' (' + nPicked + ')' : '') + '</button>' : '')
      + '</div>';
    if (!list.length) return filt + '<div class="mg-empty">' + (S.notes.length ? 'Every note is done. 🎉' : 'No notes yet.') + '</div>';
    var tag = { new: '🆕 new', seen: '👀 seen', done: '✅ done' };
    return filt + list.map(function (n) {
      var subj = encodeURIComponent('Your note about My Kitchen Notes');
      var body = encodeURIComponent('\n\n\u2014 you wrote (' + new Date(n.at || 0).toLocaleString() + '):\n' + (n.text || ''));
      // v37.95 — the key carries a document's id (anyone signed in may choose one): as an
      // attribute it is escA'd, as a handler's argument a JS string (jsA).
      var k = escA(n.key), kj = jsA(n.key);
      return '<div class="mg-card' + (n.status === 'new' ? ' mg-new' : '') + (S.picked[n.key] ? ' mg-picked' : '') + '" id="mgNote-' + k + '">'
        + '<label class="mg-pick"><input type="checkbox"' + (S.picked[n.key] ? ' checked' : '') + ' onchange="mknManage.pick(' + kj + ', this.checked)"'
        + ' aria-label="Select this note for 📋 Copy reports"> Select</label>'
        + '<div class="mg-ptop"><div><b class="mg-email">' + esc(n.email || n.uid) + '</b> <span class="mg-muted">' + esc(n.household || '') + '</span>'
        + (n.copy ? ' <span class="mg-copy">' + esc(n.copy) + '</span>' : '')
        + '<div class="mg-muted">' + new Date(n.at || 0).toLocaleString() + ' · ' + esc(n.version || '') + ' · ' + esc(n.env || '') + ' · ' + esc(n.lang || '') + '</div></div>'
        + '<span class="mg-muted">' + (tag[n.status] || esc(n.status)) + '</span></div>'
        + '<div class="mg-text" dir="auto">' + esc(n.text || '') + '</div>'
        + (n.shot ? '<img class="mg-shot" src="' + escA(n.shot) + '" alt="The tester\u2019s screenshot" onclick="this.classList.toggle(\'mg-big\')">' : '')
        + (n.log ? '<details><summary class="mg-muted">What the app was doing (' + Math.round(n.log.length / 1024) + ' KB)</summary>'
            + '<pre class="mg-log">' + esc(n.log) + '</pre><button type="button" class="mg-btn" onclick="mknManage.copyLog(' + kj + ')">📋 Copy the log</button></details>' : '')
        + '<div class="mg-device mg-muted">' + esc(n.device || '') + '</div>'
        + repliesHtml(n)
        + '<div class="mg-tools" style="margin-top:8px;">'
        // v37.94 — Tony: Reply by e-mail did nothing (the browser hands mailto: to the
        // computer, and his has no e-mail app set for it). Gmail opens in a new tab, filled in;
        // the e-mail app stays beside it for computers where it is set up.
        + (n.email ? '<a class="mg-btn" target="_blank" rel="noopener" href="https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(n.email) + '&su=' + subj + '&body=' + body + '">✉️ Reply in Gmail</a>'
            + '<a class="mg-btn" href="mailto:' + escA(n.email) + '?subject=' + subj + '&body=' + body + '" title="Opens the e-mail app this computer is set to use">📨 E-mail app</a>' : '')
        // v38.00 — Tony: "Reply in App … received exactly as a join request, with the red dot and all."
        + (canReplyInApp(n) && S.replying !== n.key ? '<button type="button" class="mg-btn" onclick="mknManage.replyOpen(' + kj + ')" title="Your answer comes up in their app, like a link request, with a red dot until they read it">📲 Reply in app</button>' : '')
        + (n.status !== 'seen' ? '<button type="button" class="mg-btn" onclick="mknManage.mark(' + kj + ',\'seen\')">👀 Seen</button>' : '')
        + (n.status !== 'done' ? '<button type="button" class="mg-btn" onclick="mknManage.mark(' + kj + ',\'done\')">✅ Done</button>' : '')
        + '<button type="button" class="mg-btn mg-danger" onclick="mknManage.delNote(' + kj + ')">🗑</button></div>'
        + (S.replying === n.key ? replyBoxHtml(n, kj) : '') + '</div>';
    }).join('');
  }
  // v38.00 — a note from the inbox, with its writer known, can be answered in their app.
  function canReplyInApp(n) { return n.src === 'server' && !!n.uid && !!n.project; }
  function repliesHtml(n) {
    var list = n.src === 'server' ? (S.replies[n.id] || []) : [];
    return list.map(function (x) {
      return '<div class="mg-reply"><div class="mg-muted">📲 Your answer in their app · ' + new Date(x.at || 0).toLocaleString() + ' · '
        + (x.read_at ? '<span class="mg-read">✓ read ' + new Date(x.read_at).toLocaleString() + '</span>' : 'not read yet') + '</div>'
        + '<div class="mg-text" dir="auto">' + esc(x.text || '') + '</div></div>';
    }).join('');
  }
  function replyBoxHtml(n, kj) {
    return '<div class="mg-replybox"><div class="mg-muted">Your answer to ' + esc(n.email || 'them') + ' — it comes up in their app (' + esc(n.copy || '') + ') the next time they open it, with a red dot until they read it.</div>'
      + '<textarea id="mgReplyText" rows="4" dir="auto" maxlength="5000" placeholder="Your answer" oninput="mknManage.replyDraft(this.value)">' + esc(S.replyDraft) + '</textarea>'
      + '<div class="mg-tools"><button type="button" class="mg-btn mg-primary" id="mgReplySend"' + (S.replySending ? ' disabled' : '') + ' onclick="mknManage.replySend(' + kj + ')">'
      + (S.replySending ? 'Sending…' : '📲 Send to their app') + '</button>'
      + '<button type="button" class="mg-btn" onclick="mknManage.replyCancel()">Cancel</button></div></div>';
  }

  // ─── v38.15: WHAT THE TESTERS' APPS REPORT (Worker v69) ─────────────────────
  // Errors the apps noted by themselves (the beta and the test copy), and how
  // often each household used each feature — names and numbers only.
  var _errGen = 0;
  async function loadErrors() {
    var gen = ++_errGen, rows = null, err = '';
    try {
      var t = await window._fbUser.getIdToken();
      var r = await fetch(WORKER_ENDPOINT, { method: 'POST', headers: workerHeaders(),
        body: workerBody({ action: 'meter-admin', op: 'errors', idToken: t }), signal: AbortSignal.timeout(20000) });
      var d = {}; try { d = await r.json(); } catch (e) {}
      if (!r.ok || !Array.isArray(d.errors)) throw new Error((d && d.error) || ('the server answered ' + r.status + (r.ok ? ' — it needs Worker v69 or newer' : '')));
      rows = d.errors.map(function (x) { return Object.assign({}, x, { copy: COPY_NAME[x.project] || x.env || x.project }); });
    } catch (e) { err = String((e && e.message) || e); }
    if (gen !== _errGen) return false;
    S.errors = rows; S.errorsError = err;
    return true;
  }
  function errNew() { return (S.errors || []).filter(function (x) { return x.status === 'new'; }).length; }
  function errBy(id) { return (S.errors || []).filter(function (x) { return String(x.id) === String(id); })[0]; }
  function householdName(project, hid) {
    var r = S.rows.filter(function (x) { return x.hid === hid && (x.project || thisProject()) === project; })[0];
    return r ? (r.name || r.code || hid) : (hid || '');
  }
  function errText(x) {   // the words to paste to whoever fixes it
    return '[' + x.copy + ' ' + x.version + '] ' + x.kind + ': ' + x.message + (x.place ? '\n  at ' + x.place : '') + '\n  screen: ' + (x.screen || '—')
      + ' · ' + x.n + ' time' + (x.n === 1 ? '' : 's') + ', ' + new Date(x.first_at || 0).toISOString().slice(0, 16).replace('T', ' ') + ' → '
      + new Date(x.last_at || 0).toISOString().slice(0, 16).replace('T', ' ') + ' UTC · ' + (x.lang || '') + '\n  ' + (x.device || '');
  }
  function errorsHtml() {
    if (S.errorsError) return '<div class="mg-note">The error reports could not be read: ' + esc(S.errorsError) + '</div>';
    if (!S.errors) return '<div class="mg-empty">⏳ Reading the error reports…</div>';
    var list = S.errors.filter(function (x) { return S.errFilter === 'all' || x.status !== 'done'; });
    var tools = '<div class="mg-muted" style="margin-bottom:8px;">Sent by the testers’ apps by themselves (the beta and the test copy): the error’s wording, where, the screen, the version and the device — never a recipe’s contents. The same error is one line with a count.</div>'
      + '<div class="mg-tools" style="margin-bottom:10px;">'
      + '<button type="button" class="mg-btn' + (S.errFilter === 'open' ? ' mg-primary' : '') + '" onclick="mknManage.errFilter(\'open\')">Not done yet</button>'
      + '<button type="button" class="mg-btn' + (S.errFilter === 'all' ? ' mg-primary' : '') + '" onclick="mknManage.errFilter(\'all\')">All (' + S.errors.length + ')</button>'
      + (list.length ? '<button type="button" class="mg-btn" onclick="mknManage.errCopyAll()" title="Copies these reports as text, to paste where they will be fixed">📋 Copy these</button>' : '')
      + '<button type="button" class="mg-btn" onclick="mknManage.errReload()">↻</button></div>';
    if (!list.length) return tools + '<div class="mg-empty">' + (S.errors.length ? 'Every error is done. 🎉' : 'No errors reported. 🎉') + '</div>';
    return tools + list.map(function (x) {
      var id = jsA(String(x.id));
      return '<div class="mg-card' + (x.status === 'new' ? ' mg-new' : '') + '">'
        + '<div class="mg-ptop"><div><b class="mg-email">' + esc(x.email || x.uid || '') + '</b> <span class="mg-muted">' + esc(householdName(x.project, x.hid)) + '</span>'
        + ' <span class="mg-copy">' + esc(x.copy) + '</span>'
        + '<div class="mg-muted">' + esc(x.version) + ' · ' + esc(x.kind) + ' · ' + esc(x.lang || '') + ' · last ' + new Date(x.last_at || 0).toLocaleString()
        + (x.n > 1 ? ' · <b>' + x.n + ' times</b> since ' + new Date(x.first_at || 0).toLocaleDateString() : '') + '</div></div>'
        + '<span class="mg-muted">' + (x.status === 'done' ? '✅ done' : '🆕 new') + '</span></div>'
        + '<pre class="mg-log mg-err">' + esc(x.message) + '</pre>'
        + '<div class="mg-muted">Screen: ' + esc(x.screen || '—') + (x.place ? ' · at ' + esc(x.place) : '') + '</div>'
        + '<div class="mg-device mg-muted">' + esc(x.device || '') + '</div>'
        + '<div class="mg-tools" style="margin-top:8px;">'
        + '<button type="button" class="mg-btn" onclick="mknManage.errCopy(' + id + ')">📋 Copy</button>'
        + (x.status !== 'done' ? '<button type="button" class="mg-btn" onclick="mknManage.errMark(' + id + ',\'done\')">✅ Done</button>'
                               : '<button type="button" class="mg-btn" onclick="mknManage.errMark(' + id + ',\'new\')">↩ Not done</button>')
        + '<button type="button" class="mg-btn mg-danger" onclick="mknManage.errDel(' + id + ')">🗑</button></div></div>';
    }).join('');
  }
  // Each counted feature in words. An unknown one is shown as it is.
  var USE_WORDS = {
    'open': 'Opened the app (days, per device)', 'view': 'Opened a recipe', 'search': 'Searched (times the app was open)',
    'scale': 'Changed the servings', 'units': 'Switched units', 'cooked': 'Marked as cooked', 'timer': 'Started a timer',
    'voice': 'Voice control', 'pantry': 'Opened the pantry', 'suggest': 'Asked for suggestions', 'translate': 'Translated a recipe',
    'print': 'Printed', 'word': 'Exported to Word', 'share': 'Shared a recipe', 'bring': 'Sent to Bring!', 'help': 'Asked the help assistant',
    'photo-search': 'Searched for a photo', 'farm': 'Tapped a farm visitor', 'farm-off': 'Turned the farm off', 'share-app': 'Shared the app',
    'link-request': 'Asked to link with a household',
    'added.typed': 'typed in', 'added.link': 'from a link', 'added.extension': 'from the browser extension', 'added.shared': 'shared to the app (phone)',
    'added.photo': 'from a photo', 'added.screenshots': 'from screenshots', 'added.text': 'from pasted text', 'added.video-file': 'from a video file',
    'added.whatsapp': 'from WhatsApp', 'added.linked': 'copied from a linked household', 'added.suggestion': 'an AI suggestion',
    'added.translation': 'a translated copy', 'added.video-bookmark': 'a video bookmark', 'added.import': 'imported',
    'from.web': 'a website', 'from.facebook': 'Facebook', 'from.instagram': 'Instagram', 'from.tiktok': 'TikTok', 'from.youtube': 'YouTube'
  };
  function useWord(k) { return USE_WORDS[k] || k; }
  // { feature: times } for one month → three short lists, biggest first.
  function useGroups(c) {
    var g = { added: [], from: [], other: [] };
    Object.keys(c || {}).forEach(function (k) {
      var n = c[k], grp = /^added\./.test(k) ? 'added' : /^from\./.test(k) ? 'from' : 'other';
      g[grp].push([k, n]);
    });
    Object.keys(g).forEach(function (k) { g[k].sort(function (a, b) { return b[1] - a[1]; }); });
    return g;
  }
  function useListHtml(c) {
    var g = useGroups(c), total = g.added.reduce(function (t, x) { return t + x[1]; }, 0);
    var li = function (x) { return '<span class="mg-use"><b>' + x[1] + '</b> ' + esc(useWord(x[0])) + '</span>'; };
    return (total ? '<div><b>' + total + ' recipe' + (total === 1 ? '' : 's') + ' added</b>: ' + g.added.map(li).join('') + '</div>' : '<div class="mg-muted">No recipes added.</div>')
      + (g.from.length ? '<div class="mg-muted" style="margin-top:2px;">Their sources: ' + g.from.map(li).join('') + '</div>' : '')
      + (g.other.length ? '<div style="margin-top:4px;">' + g.other.map(li).join('') + '</div>' : '');
  }
  function usePanelHtml(r) {
    var months = Object.keys(r.usage || {}).sort().reverse();
    if (!months.length) return r.remote || r.copy !== 'family' ? '<div class="mg-h">What they use</div><div class="mg-muted">Nothing counted yet'
      + ' (counted in the beta and the test copy only).</div>' : '';
    return '<div class="mg-h">What they use</div>' + months.map(function (m) {
      return '<div class="mg-usemonth"><div class="mg-muted">' + mon(m) + ' ' + m.slice(0, 4) + '</div>' + useListHtml(r.usage[m]) + '</div>';
    }).join('');
  }
  // Every household of a copy, added up, month by month.
  function useHtml() {
    var copies = {};
    S.rows.forEach(function (r) { if (r.usage) (copies[r.copy] = copies[r.copy] || []).push(r); });
    var names = Object.keys(copies).sort(function (a, b) { return a === 'beta' ? -1 : b === 'beta' ? 1 : a < b ? -1 : 1; });
    var intro = '<div class="mg-muted" style="margin-bottom:10px;">How the testers’ households use the app, added up — counted by their apps (the beta and the test copy), names and numbers only. Each household’s own counts are in its details (🏠 Households → a row).</div>';
    if (!names.length) return intro + '<div class="mg-empty">Nothing counted yet.</div>';
    if (names.indexOf(S.useCopy) === -1) S.useCopy = names[0];
    var pick = '<div class="mg-tools" style="margin-bottom:10px;">' + names.map(function (c) {
      return '<button type="button" class="mg-btn' + (S.useCopy === c ? ' mg-primary' : '') + '" onclick="mknManage.useCopy(' + jsA(c) + ')">' + esc(c) + ' (' + copies[c].length + ')</button>'; }).join('') + '</div>';
    var sum = {}, active = {};
    copies[S.useCopy].forEach(function (r) {
      Object.keys(r.usage).forEach(function (m) {
        var c = sum[m] = sum[m] || {};
        active[m] = (active[m] || 0) + 1;
        Object.keys(r.usage[m]).forEach(function (k) { c[k] = (c[k] || 0) + r.usage[m][k]; });
      });
    });
    return intro + pick + Object.keys(sum).sort().reverse().map(function (m) {
      return '<div class="mg-card"><div class="mg-ptop"><b>' + mon(m) + ' ' + m.slice(0, 4) + '</b><span class="mg-muted">' + active[m] + ' household' + (active[m] === 1 ? '' : 's') + ' counted</span></div>'
        + useListHtml(sum[m]) + '</div>';
    }).join('');
  }

  // ─── v38.18: 📝 THE END-OF-BETA QUESTION (Worker v71) ─────────────────────────
  // Prepared, not sent (Tony). Sent per copy from here; answers read here.
  var SURVEY_ID = 'end-of-beta-1';
  var SURVEY_COPIES = [['my-kitchen-notes-beta', 'beta'], ['tonys-recipes-test', 'test']];
  async function loadSurvey() {
    try {
      var t = await window._fbUser.getIdToken();
      var r = await fetch(WORKER_ENDPOINT, { method: 'POST', headers: workerHeaders(),
        body: workerBody({ action: 'meter-admin', op: 'survey-list', idToken: t }), signal: AbortSignal.timeout(20000) });
      var d = {}; try { d = await r.json(); } catch (e) {}
      if (!r.ok || !Array.isArray(d.surveys)) throw new Error((d && d.error) || ('the server answered ' + r.status + (r.ok ? ' — it needs Worker v71 or newer' : '')));
      S.survey = d; S.surveyError = '';
    } catch (e) { S.survey = null; S.surveyError = String((e && e.message) || e); }
    return true;
  }
  function surveyWords(list, key) {
    var q = typeof surveyQuestions === 'function' ? surveyQuestions() : null, m = {};
    ((q && q[key]) || []).forEach(function (c) { m[c[0]] = c[1]; });
    return function (v) { return m[v] || v || '—'; };
  }
  function surveyAnswers() {
    return ((S.survey && S.survey.answers) || []).filter(function (a) { return a.survey === SURVEY_ID; })
      .map(function (a) { return Object.assign({}, a, { copy: COPY_NAME[a.project] || a.project }); });
  }
  function surveyText(list) {
    var keepW = surveyWords(null, 'keep'), priceW = surveyWords(null, 'price');
    return 'The end-of-beta question — ' + list.length + ' answer' + (list.length === 1 ? '' : 's') + ', copied ' + new Date().toLocaleString() + '\n\n'
      + list.map(function (a, i) {
          return '=== ' + (i + 1) + '. ' + (a.email || a.uid) + (a.household ? ' (' + a.household + ')' : '') + ' · ' + a.copy + ' · ' + new Date(a.at || 0).toLocaleString() + ' · ' + (a.lang || '') + ' ===\n'
            + 'Keep using: ' + keepW(a.keep) + '\nWould pay a month: ' + priceW(a.price) + '\nOne thing to change or add: ' + (a.change || '—') + '\nAnything else: ' + (a.other || '—');
        }).join('\n\n');
  }
  function countsHtml(list, key, words) {
    var q = typeof surveyQuestions === 'function' ? surveyQuestions() : { keep: [], price: [] };
    var total = list.filter(function (a) { return a[key]; }).length;
    return (q[key] || []).map(function (c) {
      var n = list.filter(function (a) { return a[key] === c[0]; }).length, pct = total ? Math.round(n / total * 100) : 0;
      return '<div class="mg-svrow"><span class="mg-svlab">' + esc(c[1]) + '</span><span class="mg-bar mg-svbar"><span style="width:' + pct + '%;background:var(--terracotta-fill);display:block;height:100%;"></span></span><b>' + n + '</b></div>';
    }).join('');
  }
  function surveyHtml() {
    if (S.surveyError) return '<div class="mg-note">The question could not be read: ' + esc(S.surveyError) + '</div>';
    if (!S.survey) return '<div class="mg-empty">⏳ Reading…</div>';
    var list = surveyAnswers();
    var status = SURVEY_COPIES.map(function (c) {
      var sv = (S.survey.surveys || []).filter(function (x) { return x.project === c[0] && x.survey === SURVEY_ID; })[0];
      var n = list.filter(function (a) { return a.project === c[0]; }).length;
      var word = !sv ? '<b>not sent</b>' : sv.closed_at ? 'asked ' + new Date(sv.opened_at).toLocaleDateString() + ' – ' + new Date(sv.closed_at).toLocaleDateString() + ', no longer asked'
        : '<b>being asked</b> since ' + new Date(sv.opened_at).toLocaleDateString();
      var btn = sv && !sv.closed_at ? '<button type="button" class="mg-btn" onclick="mknManage.surveyClose(' + jsA(c[0]) + ')">■ Stop asking</button>'
        : '<button type="button" class="mg-btn mg-primary" onclick="mknManage.surveySend(' + jsA(c[0]) + ')">📤 ' + (sv ? 'Ask again' : 'Send to the ' + c[1] + '’s testers…') + '</button>';
      return '<div class="mg-svcopy"><span class="mg-copy">' + esc(c[1]) + '</span> ' + word + ' · ' + n + ' answer' + (n === 1 ? '' : 's') + ' ' + btn + '</div>';
    }).join('');
    var head = '<div class="mg-muted" style="margin-bottom:8px;">Three questions and room for anything else. Nobody is asked until you send it; each tester is then asked once, the next time they open the app (“Later” waits a day).</div>'
      + '<div class="mg-tools" style="margin-bottom:10px;"><button type="button" class="mg-btn" onclick="mknManage.surveyPreview()">👁 Preview</button>'
      + (list.length ? '<button type="button" class="mg-btn" onclick="mknManage.surveyCopy()">📋 Copy answers</button>' : '')
      + '<button type="button" class="mg-btn" onclick="mknManage.surveyReload()">↻</button></div>' + status;
    if (!list.length) return head + '<div class="mg-empty">No answers yet.</div>';
    var written = list.filter(function (a) { return a.change || a.other; });
    return head
      + '<div class="mg-card"><div class="mg-h">Would you keep using it?</div>' + countsHtml(list, 'keep') + '</div>'
      + '<div class="mg-card"><div class="mg-h">What would you pay each month?</div>' + countsHtml(list, 'price') + '</div>'
      + '<div class="mg-card"><div class="mg-h">In their words (' + written.length + ')</div>' + (written.length ? written.map(function (a) {
          return '<div class="mg-svword"><div class="mg-muted">' + esc(a.email || '') + ' · ' + esc(a.household || '') + ' · <span class="mg-copy">' + esc(a.copy) + '</span> · ' + new Date(a.at || 0).toLocaleDateString() + '</div>'
            + (a.change ? '<div class="mg-text" dir="auto"><b>Change or add:</b> ' + esc(a.change) + '</div>' : '')
            + (a.other ? '<div class="mg-text" dir="auto"><b>Anything else:</b> ' + esc(a.other) + '</div>' : '') + '</div>';
        }).join('') : '<div class="mg-muted">Nothing written yet.</div>') + '</div>';
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
      + '<button type="button" role="tab" aria-selected="' + (S.tab === 'feedback') + '" class="mg-tab' + (S.tab === 'feedback' ? ' mg-on' : '') + '" onclick="mknManage.tabTo(\'feedback\')">💬 Feedback' + (nc ? ' <span class="mg-badge">' + nc + '</span>' : '') + '</button>'
      // v38.15 — what the testers' apps report by themselves (Worker v69).
      + '<button type="button" role="tab" aria-selected="' + (S.tab === 'errors') + '" class="mg-tab' + (S.tab === 'errors' ? ' mg-on' : '') + '" onclick="mknManage.tabTo(\'errors\')">⚠️ Errors' + (errNew() ? ' <span class="mg-badge">' + errNew() + '</span>' : '') + '</button>'
      + '<button type="button" role="tab" aria-selected="' + (S.tab === 'use') + '" class="mg-tab' + (S.tab === 'use' ? ' mg-on' : '') + '" onclick="mknManage.tabTo(\'use\')">📈 Use</button>'
      + '<button type="button" role="tab" aria-selected="' + (S.tab === 'survey') + '" class="mg-tab' + (S.tab === 'survey' ? ' mg-on' : '') + '" onclick="mknManage.tabTo(\'survey\')">📝 Beta question</button></div>';
    if (S.tab === 'feedback') { body.innerHTML = tabs + notesHtml(); return; }
    if (S.tab === 'errors') { body.innerHTML = tabs + errorsHtml(); return; }
    if (S.tab === 'use') { body.innerHTML = tabs + (S.loading ? '<div class="mg-empty">⏳ Reading every household…</div>' : useHtml()); return; }
    if (S.tab === 'survey') { body.innerHTML = tabs + surveyHtml(); return; }
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
      + usePanelHtml(r)
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
    // v38.00 — Tony: the buttons here "are just painted on and do not behave like the buttons at the
    // top of the app". The app's own raised look: a lip below, lifted under the pointer, pressed down
    // when clicked; a ring for the keyboard; dimmed while it works.
    + '.mg-btn{box-shadow:0 3px 0 #c8c0b5,0 4px 5px rgba(0,0,0,.10);transform:translateY(0);transition:transform .08s ease,box-shadow .08s ease,background .12s ease;'
    + 'font-weight:600;-webkit-tap-highlight-color:transparent;user-select:none;}'
    + '.mg-btn:hover{background:var(--note-bg);box-shadow:0 3px 0 #c8c0b5,0 5px 8px rgba(0,0,0,.14);transform:translateY(-1px);}'
    + '.mg-btn:active{box-shadow:0 1px 0 #c8c0b5;transform:translateY(2px);}'
    + '.mg-btn.mg-primary{box-shadow:0 3px 0 #7a2b08,0 4px 5px rgba(0,0,0,.18);}'
    + '.mg-btn.mg-primary:hover{background:#c94410;box-shadow:0 3px 0 #7a2b08,0 5px 8px rgba(0,0,0,.24);}'
    + '.mg-btn.mg-primary:active{background:#a83a0c;box-shadow:0 1px 0 #7a2b08;}'
    + '.mg-btn.mg-danger{box-shadow:0 3px 0 #b3261e55,0 4px 5px rgba(0,0,0,.10);}'
    + '.mg-btn.mg-danger:hover{background:#fdecea;}.mg-btn.mg-danger:active{box-shadow:0 1px 0 #b3261e55;}'
    + '.mg-btn:focus-visible,.mg-tab:focus-visible,.mg-sort:focus-visible{outline:3px solid var(--terracotta);outline-offset:2px;}'
    + '.mg-btn:disabled{opacity:.55;cursor:wait;transform:none;box-shadow:0 1px 0 #c8c0b5;}'
    + ':root[data-theme="dark"] .mg-btn{box-shadow:0 3px 0 #0d0a08,0 4px 5px rgba(0,0,0,.35);}'
    + ':root[data-theme="dark"] .mg-btn:hover{background:#33291F;box-shadow:0 3px 0 #0d0a08,0 5px 8px rgba(0,0,0,.45);}'
    + ':root[data-theme="dark"] .mg-btn:active{box-shadow:0 1px 0 #0d0a08;}'
    + ':root[data-theme="dark"] .mg-btn.mg-danger:hover{background:#3A1F1C;}'
    + '@media (prefers-reduced-motion:reduce){.mg-btn,.mg-btn:hover,.mg-btn:active{transform:none;transition:none;}}'
    + '.mg-reply{margin-top:8px;padding:8px 10px;border-inline-start:3px solid var(--terracotta-fill);background:var(--note-bg);border-radius:6px;}'
    + '.mg-reply .mg-text{margin:4px 0 0;}.mg-read{color:var(--ok-text);font-weight:600;}'
    + '.mg-replybox{margin-top:10px;padding:10px;border:1px dashed var(--border);border-radius:8px;}'
    + '#mgReplyText{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--ink);margin:6px 0;font:inherit;font-size:14px;}'
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
    + '.mg-tab{all:unset;cursor:pointer;padding:8px 14px;font-weight:600;color:var(--muted);border-bottom:3px solid transparent;border-radius:8px 8px 0 0;transition:background .12s ease,color .12s ease;}'
    + '.mg-tab:hover{background:var(--note-bg);color:var(--heading);}.mg-tab:active{background:var(--border);}'
    + '.mg-tab.mg-on{color:var(--heading);border-bottom-color:var(--terracotta-fill);}'
    + '.mg-sort:hover{background:var(--note-bg);}.mg-sort:active{background:var(--border);}'
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
    + '.mg-err{max-height:160px;font-size:12px;margin:8px 0 4px;}'
    + '.mg-pick{float:inline-end;display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--muted);cursor:pointer;margin-inline-start:10px;user-select:none;}'
    + '.mg-pick input{width:18px;height:18px;accent-color:var(--terracotta-fill);cursor:pointer;}'
    + '.mg-card.mg-picked{outline:2px solid var(--terracotta-fill);outline-offset:-1px;}'
    + '.mg-sep{width:1px;align-self:stretch;background:var(--border);margin:0 4px;}'
    + '.mg-svcopy{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0;font-size:13px;}'
    + '.mg-svrow{display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13px;}.mg-svlab{flex:0 0 46%;}'
    + '.mg-svbar{flex:1;min-width:60px;margin-top:0;}.mg-svword{border-top:1px solid var(--border);padding:6px 0;}'
    + '.mg-use{display:inline-block;margin:2px 10px 2px 0;}.mg-use b{color:var(--heading);}'
    + '.mg-usemonth{margin:6px 0 10px;}'
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
      // v38.10 — a read overtaken by a newer one changes nothing at all: not the page, not the dot
      // (CI: a late one re-counted the ⚙️ dot from notes since marked done, and hid it).
      if (typeof feedbackInboxHere !== 'function' || feedbackInboxHere()) loadNotes().then(function (fresh) { if (fresh === false) return; render(); syncDot(); });
      if (typeof feedbackInboxHere !== 'function' || feedbackInboxHere()) loadErrors().then(function (fresh) { if (fresh !== false) render(); });   // v38.15 — the ⚠️ count
      return api.reload();
    },
    tabTo: function (t) { S.tab = t; render(); if (t === 'feedback' && !S.notes) loadNotes().then(function (fresh) { if (fresh !== false) render(); });
      if (t === 'errors' && !S.errors) loadErrors().then(function (fresh) { if (fresh !== false) render(); });
      if (t === 'survey') loadSurvey().then(render); },
    // v38.18 — 📝 the end-of-beta question: preview, send (per copy), stop, copy.
    surveyReload: function () { S.survey = null; render(); return loadSurvey().then(render); },
    surveyPreview: function () { return typeof openSurveyWindow === 'function' ? openSurveyWindow({ preview: true }) : null; },
    surveySend: async function (project) {
      var copy = COPY_NAME[project] || project;
      if (await askConfirm({ icon: '📤', title: 'Send the end-of-beta question?',
          message: 'Each of the ' + copy + '’s testers is asked once, the next time they open the app. You can stop asking at any time.',
          okLabel: 'Send it', cancelLabel: 'Not yet' }) !== true) return false;
      try { await meterSet('survey-open', '', { project: project, survey: SURVEY_ID }); }
      catch (e) { showServiceError('Could not send it: ' + e.message); return false; }
      toast('📤 Sent — the ' + copy + '’s testers are asked the next time they open the app.', 6000);
      await loadSurvey(); render(); return true;
    },
    surveyClose: async function (project) {
      try { await meterSet('survey-close', '', { project: project, survey: SURVEY_ID }); }
      catch (e) { showServiceError('Could not stop it: ' + e.message); return false; }
      toast('■ Nobody more is asked.'); await loadSurvey(); render(); return true;
    },
    surveyCopy: function () {
      var list = surveyAnswers(); if (!list.length) return 0;
      if (typeof fbProbeCopy === 'function') fbProbeCopy(surveyText(list), list.length + ' answer' + (list.length === 1 ? '' : 's'));
      return list.length;
    },
    _survey: loadSurvey,
    // v38.15 — the testers' apps' own reports (Worker v69).
    errFilter: function (f) { S.errFilter = f; render(); },
    errReload: function () { S.errors = null; render(); return loadErrors().then(function (fresh) { if (fresh !== false) render(); }); },
    errMark: async function (id, status) {
      var x = errBy(id); if (!x) return false;
      try { await meterSet('error-status', '', { id: x.id, status: status }); }
      catch (e) { showServiceError('Could not mark the error: ' + e.message); return false; }
      x.status = status; render(); return true;
    },
    errDel: async function (id) {
      var x = errBy(id); if (!x) return false;
      if (await askConfirm({ icon: '🗑', title: 'Remove this error report?', message: 'If it happens again, it comes back.', okLabel: 'Remove', danger: true }) !== true) return false;
      try { await meterSet('error-delete', '', { id: x.id }); }
      catch (e) { showServiceError('Could not remove it: ' + e.message); return false; }
      S.errors = (S.errors || []).filter(function (y) { return y !== x; }); render(); return true;
    },
    errCopy: function (id) { var x = errBy(id); if (x && typeof fbProbeCopy === 'function') fbProbeCopy(errText(x), 'The error report'); },
    errCopyAll: function () {
      var list = (S.errors || []).filter(function (x) { return S.errFilter === 'all' || x.status !== 'done'; });
      if (list.length && typeof fbProbeCopy === 'function') fbProbeCopy(list.map(errText).join('\n\n'), list.length + ' error report' + (list.length === 1 ? '' : 's'));
      return list.length;
    },
    useCopy: function (c) { S.useCopy = c; render(); },
    _errors: loadErrors,
    noteFilter: function (f) { S.noteFilter = f; render(); },
    // v38.16 — tick notes, then 📋 Copy reports: everything about each, as one text.
    pick: function (key, on) { if (on) S.picked[key] = true; else delete S.picked[key]; render(); return pickedNotes().length; },
    pickAll: function (on) { S.picked = {}; if (on) shownNotes().forEach(function (n) { S.picked[n.key] = true; }); render(); return pickedNotes().length; },
    copyReports: function () {
      var list = pickedNotes();
      if (!list.length) { toast('Tick the notes to copy first.'); return 0; }
      var text = reportsText(list), kb = Math.round(text.length / 1024);
      var done = function () { toast('\u{1F4CB} ' + list.length + ' report' + (list.length === 1 ? '' : 's') + ' copied (' + kb + ' KB) \u2014 paste them into the chat', 7000); };
      try { navigator.clipboard.writeText(text).then(done, function () { showServiceError('The reports could not be copied by themselves \u2014 select this text and copy it:\n\n' + text); }); }
      catch (e) { showServiceError('The reports could not be copied by themselves \u2014 select this text and copy it:\n\n' + text); }
      return list.length;
    },
    _reportsText: function (keys) { return reportsText((S.notes || []).filter(function (n) { return keys.indexOf(n.key) !== -1; })); },
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
    // v38.00 — 📲 Reply in app: the answer box under the note, then to their app (Worker v68).
    replyOpen: function (key) {
      var n = noteBy(key); if (!n || !canReplyInApp(n)) return false;
      if (S.replying !== key) S.replyDraft = '';
      S.replying = key; render();
      var t = document.getElementById('mgReplyText'); if (t) t.focus();
      return true;
    },
    replyDraft: function (v) { S.replyDraft = String(v || ''); },
    replyCancel: function () { S.replying = null; S.replyDraft = ''; render(); },
    replySend: async function (key) {
      var n = noteBy(key); if (!n || !canReplyInApp(n) || S.replySending) return false;
      var t = document.getElementById('mgReplyText'); if (t) S.replyDraft = t.value;
      var text = S.replyDraft.trim();
      if (!text) { toast('Write your answer first.'); if (t) t.focus(); return false; }
      S.replySending = true; render();
      var d;
      try {
        d = await meterSet('note-reply', '', { id: n.id, text: text });
        // an older Worker (before v68) does not know the answer, and says something else
        if (!d || !d.ok || !d.reply) throw new Error('the server did not keep it — it needs Worker v68 or newer');
      } catch (e) {
        S.replySending = false; render();
        showServiceError('Your answer could not be sent: ' + e.message + '\n\nIt is still in the box.');
        return false;
      }
      (S.replies[n.id] = S.replies[n.id] || []).push(d.reply);
      if (n.status === 'new') n.status = 'seen';
      S.replySending = false; S.replying = null; S.replyDraft = '';
      render(); syncDot();
      toast('📲 Sent — it comes up in their app the next time they open it.', 6000);
      return true;
    },
    _notes: loadNotes,
    close: function () { var ov = document.getElementById('manageOverlay'); if (ov) ov.remove(); S.open = null; _notesGen++; _errGen++; },
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
        .concat(['Cap ($)', 'Linked with', 'Shared the app', 'Last active', 'Founded', 'Came through', 'Notes', 'Deleted', 'Left', 'Feature counts (by month)']);
      var lines = [head].concat(sorted().map(function (r) {
        return [r.name, r.code, r.copy, r.owner, r.members.length, r.members.map(function (m) { return m.email + ' (' + m.role + (m.termsAt ? ', terms v' + (m.termsVersion || '?') + ' ' + new Date(m.termsAt).toISOString().slice(0, 10) : ', terms not agreed') + ')'; }).join('; ')]
          .concat(months.map(function (m) { var x = r.months.filter(function (y) { return y.month === m; })[0]; return x ? x.usd.toFixed(4) : '0'; }))
          .concat([r.cap == null ? '' : r.cap, r.links.map(function (l) { return l.name; }).join('; '), r.referred,
                   r.lastSeen ? new Date(r.lastSeen).toISOString().slice(0, 10) : '', r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
                   r.referredBy, r.note, r.deleted ? deletedText(r.deleted) : '',
                   (r.left || []).map(function (x) { return x.email + ' ' + new Date(x.at || 0).toISOString().slice(0, 10); }).join('; '),
                   Object.keys(r.usage || {}).sort().map(function (m) { return m + ': ' + Object.keys(r.usage[m]).sort().map(function (k) { return k + '=' + r.usage[m][k]; }).join(' '); }).join('; ')]);
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
