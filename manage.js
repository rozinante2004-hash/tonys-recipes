// ─── THE MANAGEMENT APP (v37.58, design step 4) ──────────────────────────────
// Tony's own view of every household in THIS copy (family, test or beta — each
// has its own database): who is in it, what its AI has cost this month and the
// two before, its allowance (which he can change), who it is linked with, how
// many new households its 📲 share link brought, and when anyone last opened
// the app. Loaded only when he opens it (⚙️ → 📊 Households); nobody else can
// read any of it — the database rules (appAdmin) and the Worker (OWNER_EMAILS)
// both check that it is him. It never reads anyone's recipes.
(function () {
  'use strict';
  var S = { rows: [], sort: 'month', dir: -1, q: '', meter: null, meterError: '', open: null, loading: false };
  function esc(v) { return escH(String(v == null ? '' : v)); }
  function money(v) { return '$' + (Number(v) || 0).toFixed(2); }
  function ago(t) {
    if (!t) return '—';
    var d = (Date.now() - t) / 864e5;
    return d < 1 ? 'today' : d < 2 ? 'yesterday' : Math.floor(d) + ' days ago';
  }
  function roleRank(r) { var o = { owner: 0, admin: 1, editor: 2, viewer: 3 }; return Object.prototype.hasOwnProperty.call(o, r) ? o[r] : 4; }
  function mon(m) { var p = String(m).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, 1)).toLocaleDateString(undefined, { month: 'short' }); }

  async function meterList() {
    if (!window._fbUser) throw new Error('Sign in first.');
    var t = await _fbUser.getIdToken();
    var r = await fetch(WORKER_ENDPOINT, { method: 'POST', headers: workerHeaders(),
      body: workerBody({ action: 'meter-admin', op: 'list', idToken: t }), signal: AbortSignal.timeout(15000) });
    var d = {}; try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((d && d.error) || ('the server answered ' + r.status));
    return d;
  }
  async function meterSet(op, hid, extra) {
    var t = await _fbUser.getIdToken();
    var r = await fetch(WORKER_ENDPOINT, { method: 'POST', headers: workerHeaders(),
      body: workerBody(Object.assign({ action: 'meter-admin', op: op, hid: hid, idToken: t }, extra)), signal: AbortSignal.timeout(15000) });
    var d = {}; try { d = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((d && d.error) || ('the server answered ' + r.status));
    return d;
  }

  // Everything about every household, gathered in five reads.
  async function load() {
    var db = window._fbDb, rows = {}, byCode = {};
    var hs = await db.collection('households').get();
    hs.forEach(function (d) {
      var h = d.data() || {};
      rows[d.id] = { hid: d.id, name: h.name || '', code: h.code || '', ownerUid: h.ownerUid || '', createdAt: h.createdAt || 0,
                     referredBy: h.referredBy || '', members: [], links: [], asking: [], asked: [], referred: 0, lastSeen: 0 };
      if (h.code) byCode[h.code] = d.id;
    });
    (await db.collectionGroup('members').get()).forEach(function (d) {
      var hid = d.ref.parent.parent.id, m = d.data() || {};
      if (!rows[hid]) return;
      rows[hid].members.push({ uid: m.uid, email: m.email || '', name: m.name || '', role: m.role || '', lastSeen: m.lastSeen || 0, joinedAt: m.joinedAt || 0 });
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
    S.meter = null; S.meterError = '';
    try { S.meter = await meterList(); } catch (e) { S.meterError = e.message; }
    var spend = {};
    if (S.meter) (S.meter.households || []).forEach(function (h) { spend[h.hid] = h; });
    S.rows = Object.keys(rows).map(function (hid) {
      var r = rows[hid], m = spend[hid] || null;
      var owner = r.members.filter(function (x) { return x.role === 'owner'; })[0];
      r.owner = owner ? owner.email : '';
      r.months = m ? m.months : [];
      r.month = r.months.length ? r.months[0].usd : 0;
      r.cap = m ? m.capNow : (S.meter && S.meter.capped ? S.meter.defaults.cap : null);
      r.capSet = m && typeof m.cap === 'number';
      r.note = (m && m.note) || '';
      if (m && m.last_seen > r.lastSeen) r.lastSeen = m.last_seen;
      return r;
    });
  }

  function sorted() {
    var q = S.q.trim().toLowerCase();
    var list = S.rows.filter(function (r) {
      if (!q) return true;
      return [r.name, r.code, r.owner].concat(r.members.map(function (m) { return m.email; })).join(' ').toLowerCase().indexOf(q) !== -1;
    });
    var key = { name: function (r) { return r.name.toLowerCase(); }, owner: function (r) { return r.owner; },
                members: function (r) { return r.members.length; }, month: function (r) { return r.month; },
                cap: function (r) { return r.cap == null ? 1e9 : r.cap; }, links: function (r) { return r.links.length; },
                referred: function (r) { return r.referred; }, seen: function (r) { return r.lastSeen; } }[S.sort] || function (r) { return r.month; };
    return list.sort(function (a, b) { var x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * S.dir; });
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
    var head = '<div class="mg-top"><div><div class="mg-title">📊 Households</div><div class="mg-muted">'
      + esc(env === 'live' ? 'the family’s copy' : env + ' copy') + ' · ' + S.rows.length + ' household' + (S.rows.length === 1 ? '' : 's')
      + (S.meter ? ' · AI ' + (S.meter.capped ? 'allowance $' + S.meter.defaults.cap + '/month ($' + S.meter.defaults.firstMonth + ' the first)' : 'counted, not capped') : '') + '</div></div>'
      + '<div class="mg-tools"><input id="mgSearch" type="search" placeholder="Search name, identifier or e-mail" value="' + escA(S.q) + '" oninput="mknManage.search(this.value)">'
      + '<button type="button" class="mg-btn" onclick="mknManage.csv()">⬇ CSV</button>'
      + '<button type="button" class="mg-btn" onclick="mknManage.reload()">↻</button></div></div>';
    if (S.meterError) head += '<div class="mg-note">AI spending could not be read: ' + esc(S.meterError)
      + (/METER_DB/.test(S.meterError) ? ' — the server’s spending database is not set up yet.' : '') + '</div>';
    if (S.loading) { body.innerHTML = head + '<div class="mg-empty">⏳ Reading every household…</div>'; return; }
    var list = sorted();
    var months = (S.meter && S.meter.months) || [];
    var table = '<div class="mg-scroll"><table class="mg-table"><thead><tr>'
      + th('name', 'Household') + th('owner', 'Owner') + th('members', 'Members') + th('month', 'This month')
      + th('cap', 'Cap') + '<th>' + (months.length ? months.slice(1).map(mon).reverse().join(' · ') : 'Before') + '</th>'
      + th('links', 'Linked with') + th('referred', 'Shared the app') + th('seen', 'Last active') + '</tr></thead><tbody>'
      + (list.length ? list.map(function (r) {
          return '<tr class="mg-row' + (S.open === r.hid ? ' mg-open' : '') + '" onclick="mknManage.show(\'' + r.hid + '\')">'
            + '<td><div class="mg-name" dir="auto">' + esc(r.name || '(no name)') + '</div><div class="mg-muted mg-code">' + esc(r.code || '—') + '</div></td>'
            + '<td class="mg-email">' + esc(r.owner || '—') + '</td>'
            + '<td class="mg-c">' + r.members.length + '</td>'
            + '<td>' + barHtml(r) + '</td>'
            + '<td class="mg-c">' + (r.cap == null ? '—' : money(r.cap) + (r.capSet ? ' ✎' : '')) + '</td>'
            + '<td class="mg-muted">' + (r.months.length ? r.months.slice(1).reverse().map(function (m) { return money(m.usd); }).join(' · ') : '—') + '</td>'
            + '<td>' + (r.links.length ? r.links.map(function (l) { return esc(l.name || l.code); }).join(', ') : '—') + '</td>'
            + '<td class="mg-c">' + (r.referred || '—') + '</td>'
            + '<td>' + ago(r.lastSeen) + '</td></tr>';
        }).join('') : '<tr><td colspan="9" class="mg-empty">No household matches.</td></tr>')
      + '</tbody></table></div>';
    body.innerHTML = head + table + panelHtml();
  }
  function panelHtml() {
    var r = S.rows.filter(function (x) { return x.hid === S.open; })[0];
    if (!r) return '';
    return '<div class="mg-panel" role="region" aria-label="Household details">'
      + '<div class="mg-ptop"><div><div class="mg-title" dir="auto">' + esc(r.name) + '</div><div class="mg-muted">' + esc(r.code || 'no identifier yet')
      + ' · founded ' + (r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—') + (r.referredBy ? ' · came through ' + esc(r.referredBy) : '') + '</div></div>'
      + '<button type="button" class="mg-btn" onclick="mknManage.show(null)" aria-label="Close the details">✕</button></div>'
      + '<div class="mg-h">AI allowance</div>'
      + (r.cap == null && !(S.meter && S.meter.capped) ? '<div class="mg-muted">This copy’s AI is counted, not capped.</div>'
        : '<div class="mg-caprow">' + barHtml(r) + '<input id="mgCap" type="number" min="0" max="1000" step="0.5" value="' + (r.cap == null ? '' : r.cap) + '" aria-label="Monthly allowance in dollars">'
          + '<button type="button" class="mg-btn mg-primary" onclick="mknManage.saveCap()">Save</button>'
          + '<button type="button" class="mg-btn" onclick="mknManage.saveCap(0)" title="Stops its AI; nothing else is affected">Pause AI</button>'
          + (r.capSet ? '<button type="button" class="mg-btn" onclick="mknManage.saveCap(null)">Back to the default</button>' : '') + '</div>')
      + (r.months.length ? '<div class="mg-muted" style="margin-top:4px;">' + r.months.map(function (m) { return mon(m.month) + ': ' + money(m.usd) + ' (' + m.calls + ' calls)'; }).join(' · ') + '</div>' : '')
      + '<div class="mg-h">Members</div>'
      + r.members.sort(function (a, b) { return roleRank(a.role) - roleRank(b.role); })
          .map(function (m) { return '<div class="mg-li"><span class="mg-email">' + esc(m.email) + '</span> <span class="mg-muted">' + esc(m.role) + ' · last opened ' + ago(m.lastSeen) + '</span></div>'; }).join('')
      + '<div class="mg-h">Linked with</div>' + (r.links.length ? r.links.map(function (l) { return '<div class="mg-li">' + esc(l.name) + ' <span class="mg-muted">' + esc(l.code) + '</span></div>'; }).join('') : '<div class="mg-muted">Nobody yet.</div>')
      + ((r.asked.length || r.asking.length) ? '<div class="mg-h">Requests waiting</div>'
          + r.asked.map(function (a) { return '<div class="mg-li">from ' + esc(a.from) + ' <span class="mg-muted">' + esc(a.code) + '</span></div>'; }).join('')
          + r.asking.map(function (a) { return '<div class="mg-li">to ' + esc(a.to) + '</div>'; }).join('') : '')
      + '<div class="mg-h">Shared the app</div><div>' + (r.referred ? r.referred + ' new household' + (r.referred === 1 ? '' : 's') + ' came through its 📲 link' : '<span class="mg-muted">No new households through its link yet.</span>') + '</div>'
      + '<div class="mg-h">Your notes</div><textarea id="mgNote" rows="3" dir="auto" placeholder="Only you see these.">' + esc(r.note) + '</textarea>'
      + '<div><button type="button" class="mg-btn" onclick="mknManage.saveNote()">Save the note</button></div>'
      + '</div>';
  }

  var CSS = '#manageOverlay{position:fixed;inset:0;z-index:1250;background:var(--cream);color:var(--ink);overflow:auto;font-family:"DM Sans","Heebo",sans-serif;}'
    + '#manageOverlay .mg-wrap{max-width:1280px;margin:0 auto;padding:16px;}'
    + '#manageOverlay .mg-bar0{display:flex;justify-content:flex-end;}'
    + '.mg-top{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;justify-content:space-between;margin-bottom:12px;}'
    + '.mg-title{font:700 20px/1.2 "Playfair Display","Frank Ruhl Libre",serif;color:var(--heading);}'
    + '.mg-muted{color:var(--muted);font-size:12px;}.mg-code{font-family:ui-monospace,Menlo,Consolas,monospace;}'
    + '.mg-tools{display:flex;gap:6px;flex-wrap:wrap;}.mg-tools input{min-width:220px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--ink);font-size:14px;}'
    + '.mg-btn{padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--heading);cursor:pointer;font-size:13px;min-height:36px;}'
    + '.mg-primary{background:var(--terracotta-fill);color:#fff;border-color:transparent;}'
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
    + '.mg-li{padding:3px 0;}.mg-caprow{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}'
    + '.mg-caprow input{width:90px;padding:7px 8px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--ink);}'
    + '#mgNote{width:100%;box-sizing:border-box;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--card-bg);color:var(--ink);margin-bottom:6px;font:inherit;}';

  var api = window.mknManage = {
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
      return api.reload();
    },
    close: function () { var ov = document.getElementById('manageOverlay'); if (ov) ov.remove(); S.open = null; },
    reload: async function () {
      S.loading = true; render();
      try { await load(); }
      catch (e) { S.loading = false; render(); showServiceError('The households could not be read: ' + (e && e.message)
        + (/permission/i.test(String(e && e.message)) ? '\n\nThe database rules need publishing (⚙️ → 👥 Family Access → Show rules).' : '')); return false; }
      S.loading = false; render();
      var s = document.getElementById('mgSearch'); if (s && !S.open) s.focus();
      return S.rows.length;
    },
    search: function (v) { S.q = v; render(); var s = document.getElementById('mgSearch'); if (s) { s.focus(); s.setSelectionRange(v.length, v.length); } },
    sortBy: function (k) { if (S.sort === k) S.dir = -S.dir; else { S.sort = k; S.dir = (k === 'name' || k === 'owner') ? 1 : -1; } render(); },
    show: function (hid) { S.open = (hid && S.open !== hid) ? hid : null; render();
      if (S.open) { var p = document.querySelector('#manageOverlay .mg-panel'); if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); } },
    saveCap: async function (v) {
      var r = S.rows.filter(function (x) { return x.hid === S.open; })[0];
      if (!r) return false;
      var cap = v !== undefined ? v : (document.getElementById('mgCap') || {}).value;
      if (cap !== null && cap !== '' && !(Number(cap) >= 0)) { toast('A number of dollars, please.'); return false; }
      try { await meterSet('set-cap', r.hid, { cap: (cap === null || cap === '') ? null : Number(cap) }); }
      catch (e) { showServiceError('Could not change the allowance: ' + e.message); return false; }
      toast(cap === null ? 'Back to the default allowance' : Number(cap) === 0 ? '⏸ Its AI is paused' : '✅ Allowance set to $' + Number(cap).toFixed(2));
      await api.reload(); S.open = r.hid; render();
      return true;
    },
    saveNote: async function () {
      var r = S.rows.filter(function (x) { return x.hid === S.open; })[0];
      if (!r) return false;
      try { await meterSet('set-note', r.hid, { note: (document.getElementById('mgNote') || {}).value || '' }); }
      catch (e) { showServiceError('Could not save the note: ' + e.message); return false; }
      toast('Note saved'); r.note = (document.getElementById('mgNote') || {}).value || '';
      return true;
    },
    csv: function () {
      var months = (S.meter && S.meter.months) || [];
      var head = ['Household', 'Identifier', 'Owner', 'Members', 'Member e-mails'].concat(months.map(function (m) { return 'AI ' + m + ' ($)'; }))
        .concat(['Cap ($)', 'Linked with', 'Shared the app', 'Last active', 'Founded', 'Came through', 'Notes']);
      var lines = [head].concat(sorted().map(function (r) {
        return [r.name, r.code, r.owner, r.members.length, r.members.map(function (m) { return m.email + ' (' + m.role + ')'; }).join('; ')]
          .concat(months.map(function (m) { var x = r.months.filter(function (y) { return y.month === m; })[0]; return x ? x.usd.toFixed(4) : '0'; }))
          .concat([r.cap == null ? '' : r.cap, r.links.map(function (l) { return l.name; }).join('; '), r.referred,
                   r.lastSeen ? new Date(r.lastSeen).toISOString().slice(0, 10) : '', r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : '',
                   r.referredBy, r.note]);
      })).map(function (row) { return row.map(function (c) { c = String(c == null ? '' : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); });
      var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'households-' + String((window.APP_CONFIG && APP_CONFIG.environment) || 'live') + '-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      return lines.length - 1;
    },
    _state: S, _load: load, _render: render
  };
  window._manageLoaded = true;
})();
