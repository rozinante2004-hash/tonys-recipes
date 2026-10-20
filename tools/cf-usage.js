#!/usr/bin/env node
// What used the account's Cloudflare free allowances, hour by hour (Israel
// time). Written 19 Oct 2026 after "[Alert] KV daily operation limit exceeded"
// arrived while Tony had barely touched the app.
//
// Prints COUNTS only — no keys, no addresses, no IPs, no secrets — because the
// job log is public. Needs CLOUDFLARE_API_TOKEN; the analytics part needs the
// token to be allowed "Account Analytics: Read", and says so if it is not.
//
//   CLOUDFLARE_API_TOKEN=… node tools/cf-usage.js [days=2]
'use strict';
const ACCOUNT = '4dbc420100c13bf94fda83047ce0a7ac';          // public: worker/wrangler.jsonc
const KV_NS = '8c950e5009b34afca800fea2ce69eb1b';            // BRING_KV, same file
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const DAYS = Math.max(1, Math.min(7, parseInt(process.argv[2] || '2', 10) || 2));
const TZ = 'Asia/Jerusalem';

function il(t) {
  return new Date(t).toLocaleString('en-GB', { timeZone: TZ, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
}
async function cf(path, init) {
  const r = await fetch('https://api.cloudflare.com/client/v4' + path, Object.assign({}, init, {
    headers: Object.assign({ Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, (init || {}).headers || {}) }));
  const text = await r.text();
  let j = null; try { j = JSON.parse(text); } catch (e) {}
  return { status: r.status, j, text };
}
async function graphql(query, variables) {
  const r = await cf('/graphql', { method: 'POST', body: JSON.stringify({ query, variables }) });
  if (r.status !== 200 || !r.j) return { error: 'HTTP ' + r.status };
  if (r.j.errors && r.j.errors.length) return { error: r.j.errors.map(function(e){ return e.message; }).join('; ') };
  return { data: r.j.data };
}

async function analytics() {
  const until = new Date();
  const since = new Date(until.getTime() - DAYS * 864e5);
  const q = `query($acct: string!, $since: Time!, $until: Time!) {
    viewer { accounts(filter: { accountTag: $acct }) {
      kv: kvOperationsAdaptiveGroups(limit: 2000, filter: { datetime_geq: $since, datetime_lt: $until }) {
        sum { requests } dimensions { actionType datetimeHour namespaceId } }
      w: workersInvocationsAdaptive(limit: 2000, filter: { datetime_geq: $since, datetime_lt: $until }) {
        sum { requests errors } dimensions { scriptName datetimeHour status } }
      cpu: workersInvocationsAdaptive(limit: 10, filter: { datetime_geq: $since, datetime_lt: $until }) {
        sum { requests errors } quantiles { cpuTimeP50 cpuTimeP99 cpuTimeP999 } dimensions { scriptName status } }
      q: d1QueriesAdaptiveGroups(limit: 40, orderBy: [count_DESC], filter: { datetime_geq: $since, datetime_lt: $until }) {
        count sum { rowsRead rowsWritten } dimensions { query } }
      d1: d1AnalyticsAdaptiveGroups(limit: 2000, filter: { datetimeHour_geq: $since, datetimeHour_lt: $until }) {
        sum { readQueries writeQueries rowsRead rowsWritten } dimensions { datetimeHour } }
    } } }`;
  const r = await graphql(q, { acct: ACCOUNT, since: since.toISOString(), until: until.toISOString() });
  if (r.error) {
    console.log('Analytics: not available with this token (' + r.error.slice(0, 200) + ').');
    console.log('  The token needs "Account Analytics: Read" for the hour-by-hour picture.');
    return false;
  }
  const a = (r.data.viewer.accounts || [])[0] || {};
  const hours = {};
  function row(h) { return hours[h] = hours[h] || { kvWrite: 0, kvRead: 0, kvOther: 0, kvWriteOtherNs: 0, req: 0, err: 0, d1w: 0, d1r: 0 }; }
  (a.kv || []).forEach(function(g){
    const h = g.dimensions.datetimeHour, t = g.dimensions.actionType, n = g.sum.requests, x = row(h);
    if (t === 'write') { if (g.dimensions.namespaceId === KV_NS) x.kvWrite += n; else x.kvWriteOtherNs += n; }
    else if (t === 'read') x.kvRead += n; else x.kvOther += n;
  });
  const scripts = {};
  (a.w || []).forEach(function(g){
    const x = row(g.dimensions.datetimeHour);
    x.req += g.sum.requests; x.err += g.sum.errors;
    scripts[g.dimensions.scriptName] = (scripts[g.dimensions.scriptName] || 0) + g.sum.requests;
  });
  (a.d1 || []).forEach(function(g){ const x = row(g.dimensions.datetimeHour); x.d1w += g.sum.rowsWritten; x.d1r += g.sum.rowsRead; });
  console.log('Hour (Israel)    Worker req  errors  KV writes  (other ns)  KV reads  KV del/list  D1 rows written  D1 rows read');
  const days = {};
  Object.keys(hours).sort().forEach(function(h){
    const x = hours[h];
    const day = new Date(h).toISOString().slice(0, 10);   // Cloudflare's day: midnight UTC = 03:00 Israel
    const d = days[day] = days[day] || { req: 0, kvWrite: 0, kvWriteOtherNs: 0, d1w: 0, d1r: 0 };
    d.req += x.req; d.kvWrite += x.kvWrite; d.kvWriteOtherNs += x.kvWriteOtherNs; d.d1w += x.d1w; d.d1r += x.d1r;
    console.log(il(h).padEnd(17) + String(x.req).padStart(10) + String(x.err).padStart(8) + String(x.kvWrite).padStart(11)
      + String(x.kvWriteOtherNs).padStart(12) + String(x.kvRead).padStart(10) + String(x.kvOther).padStart(13)
      + String(x.d1w).padStart(17) + String(x.d1r).padStart(14));
  });
  console.log('\nPer Cloudflare day (each runs 03:00–03:00 Israel time):');
  Object.keys(days).sort().forEach(function(d){
    const x = days[d];
    console.log('  ' + d + ': Worker requests ' + x.req + ' (free: 100,000) · KV writes ' + (x.kvWrite + x.kvWriteOtherNs)
      + ' (free: 1,000) · D1 rows written ' + x.d1w + ' (free: 100,000) · D1 rows read ' + x.d1r + ' (free: 5,000,000)');
  });
  if (a.q && a.q.length) {
    console.log('\nD1 statements, most frequent first (count · rows written · rows read):');
    a.q.forEach(function(g){ console.log('  ' + String(g.count).padStart(7) + String(g.sum.rowsWritten).padStart(8) + String(g.sum.rowsRead).padStart(9)
      + '  ' + String(g.dimensions.query || '').replace(/\s+/g, ' ').slice(0, 150)); });
  }
  (a.cpu || []).forEach(function(g){
    console.log('CPU (ms, limit 10 on the free plan) ' + g.dimensions.scriptName + ' [' + g.dimensions.status + '] requests ' + g.sum.requests
      + ': p50 ' + (g.quantiles.cpuTimeP50 / 1000).toFixed(1) + ', p99 ' + (g.quantiles.cpuTimeP99 / 1000).toFixed(1) + ', p99.9 ' + (g.quantiles.cpuTimeP999 / 1000).toFixed(1));
  });
  console.log('\nWorker requests by Worker: ' + Object.keys(scripts).map(function(s){ return s + ' ' + scripts[s]; }).join(', '));
  return true;
}

// Always possible with a Workers token: what the spend counters hold, and how
// many rate-limit counters are alive right now (they live two minutes).
async function counters() {
  const today = new Date().toISOString().slice(0, 10), yest = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const keys = ['rl:day:' + yest, 'rl:day:' + today, 'rl:mon:' + month, 'rl:vid:' + yest, 'rl:vid:' + today];
  console.log('\nSpend counters (AI calls counted by the Worker):');
  for (const k of keys) {
    const r = await cf('/accounts/' + ACCOUNT + '/storage/kv/namespaces/' + KV_NS + '/values/' + encodeURIComponent(k));
    console.log('  ' + k.padEnd(20) + (r.status === 200 ? r.text : r.status === 404 ? '— (none)' : 'HTTP ' + r.status));
  }
  const l = await cf('/accounts/' + ACCOUNT + '/storage/kv/namespaces/' + KV_NS + '/keys?prefix=rl%3A&limit=1000');
  if (l.status !== 200 || !l.j) { console.log('  Listing the counters: HTTP ' + l.status); return; }
  const live = (l.j.result || []).map(function(x){ return x.name; }).filter(function(n){ return /^rl:.+:\d+:(ai|x)$/.test(n); });
  const ips = {}; live.forEach(function(n){ ips[n.split(':').slice(1, -2).join(':')] = 1; });
  console.log('  Per-minute counters alive now: ' + live.length + ' (cheap ' + live.filter(function(n){ return /:x$/.test(n); }).length
    + ', AI/slow ' + live.filter(function(n){ return /:ai$/.test(n); }).length + ') from ' + Object.keys(ips).length + ' address(es)');
  const other = (l.j.result || []).length - live.length;
  console.log('  Other rl: keys: ' + other);
}

const D1_ID = '4ca9eeaa-221f-4afa-a2f3-b85f8942a66b';         // METER_DB, worker/wrangler.jsonc
async function d1(sql) {
  const r = await cf('/accounts/' + ACCOUNT + '/d1/database/' + D1_ID + '/query', { method: 'POST', body: JSON.stringify({ sql }) });
  if (r.status !== 200 || !r.j || !r.j.success) return { error: 'HTTP ' + r.status + ' ' + String(r.text).slice(0, 160) };
  return { rows: ((r.j.result || [])[0] || {}).results || [] };
}
async function tables() {
  const t = await d1("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name");
  if (t.error) { console.log('\nD1 (the database): not readable with this token — ' + t.error); return; }
  const parts = [];
  for (const row of t.rows) { const c = await d1('SELECT COUNT(*) AS n FROM "' + row.name.replace(/"/g, '') + '"'); parts.push(row.name + ' ' + (c.rows ? c.rows[0].n : '?')); }
  console.log('\nD1 tables (rows): ' + parts.join(', '));
}
async function pages() {
  const r = await cf('/accounts/' + ACCOUNT + '/pages/projects');
  if (r.status !== 200 || !r.j) { console.log('\nPages: HTTP ' + r.status); return; }
  const month = new Date().toISOString().slice(0, 7);
  let total = 0; const per = [], kinds = {};
  for (const p of (r.j.result || [])) {
    let n = 0, page = 1;
    for (;;) {
      const d = await cf('/accounts/' + ACCOUNT + '/pages/projects/' + encodeURIComponent(p.name) + '/deployments?per_page=25&page=' + page);
      const list = (d.j && d.j.result) || [];
      const mine = list.filter(function(x){ return String(x.created_on || '').slice(0, 7) === month; });
      n += mine.length;
      mine.forEach(function(x){
        const k = p.name + ' ' + (x.environment || '?') + ' ' + (((x.deployment_trigger || {}).metadata || {}).branch || '?') + ' ' + ((x.deployment_trigger || {}).type || '?')
          + ' → ' + ((x.latest_stage || {}).name || '?') + ':' + ((x.latest_stage || {}).status || '?');
        kinds[k] = (kinds[k] || 0) + 1;
      });
      if (list.length < 25 || mine.length < list.length || page > 40) break;
      page++;
    }
    total += n; per.push(p.name + ' ' + n);
  }
  console.log('\nPages deployments this month (' + month + '): ' + total + ' (free: 500 builds a month; "queued" ones were never built) — ' + per.join(', '));
  Object.keys(kinds).sort().forEach(function(k){ console.log('  ' + String(kinds[k]).padStart(4) + '  ' + k); });
  for (const p of (r.j.result || [])) {
    const b = p.build_config || {}, src = ((p.source || {}).config) || {};
    console.log('  ' + p.name + ': production branch ' + (p.production_branch || '?') + ', previews ' + (src.preview_deployment_setting || '?')
      + (src.preview_branch_includes ? ' include ' + JSON.stringify(src.preview_branch_includes) : '') + (src.preview_branch_excludes ? ' exclude ' + JSON.stringify(src.preview_branch_excludes) : '')
      + ', build "' + (b.build_command || '') + '"');
  }
}

// --report (v79, the hourly usage watch): today's use of each free allowance (Cloudflare's day starts 00:00
// UTC) and this month's Pages builds, told to the Worker, which warns the owner at 70% (usage-report). The key
// is derived from this token; deploy-worker.yml gives the Worker the same one (USAGE_KEY).
async function todayMetrics() {
  const now = new Date(), since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const q = `query($acct: string!, $since: Time!, $until: Time!) {
    viewer { accounts(filter: { accountTag: $acct }) {
      kv: kvOperationsAdaptiveGroups(limit: 20, filter: { datetime_geq: $since, datetime_lt: $until }) { sum { requests } dimensions { actionType } }
      w: workersInvocationsAdaptive(limit: 20, filter: { datetime_geq: $since, datetime_lt: $until }) { sum { requests errors } }
      d1: d1AnalyticsAdaptiveGroups(limit: 20, filter: { datetimeHour_geq: $since, datetimeHour_lt: $until }) { sum { rowsRead rowsWritten } }
    } } }`;
  const r = await graphql(q, { acct: ACCOUNT, since: since.toISOString(), until: now.toISOString() });
  if (r.error) throw new Error('analytics: ' + r.error.slice(0, 200));
  const a = (r.data.viewer.accounts || [])[0] || {}, kv = {};
  (a.kv || []).forEach(function(g){ kv[g.dimensions.actionType] = (kv[g.dimensions.actionType] || 0) + g.sum.requests; });
  const sum = function(list, f){ return (list || []).reduce(function(t, g){ return t + (g.sum[f] || 0); }, 0); };
  return {
    workerRequests: { used: sum(a.w, 'requests'), limit: 100000 },
    kvWrites: { used: kv.write || 0, limit: 1000 }, kvReads: { used: kv.read || 0, limit: 100000 },
    kvDeletes: { used: kv.delete || 0, limit: 1000 }, kvLists: { used: kv.list || 0, limit: 1000 },
    d1RowsWritten: { used: sum(a.d1, 'rowsWritten'), limit: 100000 }, d1RowsRead: { used: sum(a.d1, 'rowsRead'), limit: 5000000 },
    // v82 — not an allowance: how often the server answered with an error today, out of how many requests
    workerErrors: { used: sum(a.w, 'errors'), of: sum(a.w, 'requests') }
  };
}
// v86 — what Cloudflare really built this month (Tony, 20 Oct: "What is Paused?"). Since the previews were switched
// off (20 Oct 09:23) Cloudflare still files a deployment for every push to another branch, left "queued" and never
// built: 41 of them by the afternoon were counted as builds. A direct upload (ad_hoc) is not a build either. And
// whether the latest production build of each copy went through: Cloudflare kept building past 500 in October, so
// "over the allowance" is not "stopped" unless a build is refused.
function countBuilds(deployments, month) {
  let used = 0, latest = null;
  for (const x of deployments || []) {
    if (String(x.created_on || '').slice(0, 7) !== month) continue;
    if (((x.deployment_trigger || {}).type || '') === 'ad_hoc') continue;
    const stage = x.latest_stage || {};
    if ((stage.name || '') === 'queued') continue;
    used++;
    if (x.environment === 'production' && (!latest || String(x.created_on) > String(latest.created_on))) latest = x;
  }
  const st = latest ? (latest.latest_stage || {}) : null;
  // a build still running is not a refusal
  const lastOk = !st ? null : st.status === 'failure' || st.status === 'canceled' ? false : st.name === 'deploy' && st.status === 'success' ? true : null;
  return { used, lastOk, lastAt: latest ? latest.created_on : null };
}
async function monthBuilds() {
  const r = await cf('/accounts/' + ACCOUNT + '/pages/projects');
  if (r.status !== 200 || !r.j) return null;
  const month = new Date().toISOString().slice(0, 7);
  const out = { used: 0, limit: 500, period: 'month', per: {}, lastOk: null };
  for (const p of (r.j.result || [])) {
    const all = [];
    for (let page = 1; page <= 60; page++) {
      const d = await cf('/accounts/' + ACCOUNT + '/pages/projects/' + encodeURIComponent(p.name) + '/deployments?per_page=25&page=' + page);
      const list = (d.j && d.j.result) || [];
      all.push(...list);
      const mine = list.filter(function(x){ return String(x.created_on || '').slice(0, 7) === month; });
      if (list.length < 25 || mine.length < list.length) break;
    }
    const c = countBuilds(all, month);
    out.used += c.used; out.per[p.name] = c.used;
    // the account's builds are refused for all its projects at once, so one refusal is enough to say so
    if (c.lastOk === false) out.lastOk = false; else if (c.lastOk === true && out.lastOk !== false) out.lastOk = true;
  }
  return out;
}
// Firestore's day so far (the free plan: 50,000 reads, 20,000 writes, 20,000 deletes a day, counted from
// midnight in California), from Cloud Monitoring — when FIREBASE_RULES_KEY's service account may read it
// ("Monitoring Viewer" on the project). Without that it says so and the rest goes on. 20 Oct: Google also wants
// billing on ("This API method requires billing to be enabled") — not on the free plan, so the apps' count stands in.
function pacificMidnightBefore(now) {
  const p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(now)).forEach(function(x){ p[x.type] = x.value; });
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Date.UTC(+p.year, +p.month - 1, +p.day) - (wall - Math.floor(now / 1000) * 1000);
}
async function firestoreMetrics(project) {
  const key = process.env.FIREBASE_RULES_KEY || '';
  if (!key) return { note: 'no FIREBASE_RULES_KEY here' };
  let token;
  try {
    const { GoogleAuth } = require('google-auth-library');
    const client = await new GoogleAuth({ credentials: JSON.parse(key), scopes: ['https://www.googleapis.com/auth/monitoring.read'] }).getClient();
    token = (await client.getAccessToken()).token;
  } catch (e) { return { note: 'no Google sign-in for Cloud Monitoring (' + String(e.message || e).slice(0, 120) + ')' }; }
  const now = Date.now(), start = pacificMidnightBefore(now), out = {};
  const period = Math.max(60, Math.ceil((now - start) / 1000)) + 's';
  for (const [name, metric, limit] of [['firestoreReads', 'read_count', 50000], ['firestoreWrites', 'write_count', 20000], ['firestoreDeletes', 'delete_count', 20000]]) {
    const q = new URLSearchParams({ filter: 'metric.type="firestore.googleapis.com/document/' + metric + '"',
      'interval.startTime': new Date(start).toISOString(), 'interval.endTime': new Date(now).toISOString(),
      'aggregation.alignmentPeriod': period, 'aggregation.perSeriesAligner': 'ALIGN_SUM', 'aggregation.crossSeriesReducer': 'REDUCE_SUM' });
    const r = await fetch('https://monitoring.googleapis.com/v3/projects/' + project + '/timeSeries?' + q, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) {
      // v86 — Google's own reason (a missing role, or the Cloud Monitoring API off in a project), addresses taken out
      let why = ''; try { why = String(((await r.json()).error || {}).message || ''); } catch (e) {}
      why = why.replace(/[\w.+-]+@[\w.-]+/g, '<account>').slice(0, 300);
      if (/requires billing/i.test(why)) return { note: 'Google lets Cloud Monitoring be read only with billing on (the free plan): the apps\u2019 own count of reads stands in' };
      if (r.status === 403 && !/has not been used|disabled/i.test(why))
        return { note: 'the service account may not read Cloud Monitoring in ' + project + ' — give it the "Monitoring Viewer" role there (Google: ' + why + ')' };
      return { note: 'Cloud Monitoring answered HTTP ' + r.status + (why ? ' — ' + why : '') };
    }
    const j = await r.json();
    let used = 0;
    (j.timeSeries || []).forEach(function(t){ (t.points || []).forEach(function(pt){ used += Number((pt.value || {}).int64Value || 0); }); });
    out[name] = { used, limit, period: 'pacific-day', project };
  }
  return { metrics: out };
}
async function report() {
  const metrics = await todayMetrics();
  const fs = await firestoreMetrics('my-kitchen-notes-beta');
  if (fs.metrics) Object.assign(metrics, fs.metrics); else console.log('Firestore: not measured — ' + fs.note);
  const builds = await monthBuilds();
  if (builds !== null) metrics.pagesBuilds = builds;
  const wr = require('fs').readFileSync(require('path').join(__dirname, '..', 'worker', 'wrangler.jsonc'), 'utf8');
  const appKey = (/"APP_SHARED_KEY"\s*:\s*"([^"]+)"/.exec(wr) || [])[1] || '';
  const key = require('crypto').createHmac('sha256', TOKEN).update('mkn-usage-watch-v1').digest('hex');
  const r = await fetch('https://lively-bread-273a.rozinante2004.workers.dev/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'usage-report', appKey, key, metrics }) });
  let j = null; try { j = await r.json(); } catch (e) {}
  Object.keys(metrics).forEach(function(k){ const x = metrics[k], of = x.limit || x.of || 1;
    console.log(k.padEnd(15) + String(x.used).padStart(9) + ' of ' + String(of).padStart(9) + '  ' + Math.round(100 * x.used / of) + '%'); });
  console.log('The Worker: HTTP ' + r.status + (j && j.warned ? ', warned: ' + (j.warned.join(', ') || 'nothing') : j && j.error ? ' — ' + j.error : ''));
  if (r.status === 403) console.log('::warning::the Worker refused the usage watch — publish the Worker (deploy-worker.yml sets USAGE_KEY)');
}

module.exports = { countBuilds };
if (require.main === module) (async function(){
  if (!TOKEN) { console.log('CLOUDFLARE_API_TOKEN is not set.'); process.exit(1); }
  if (process.argv.includes('--report')) { await report(); return; }
  console.log('Cloudflare usage, the last ' + DAYS + ' day(s), ' + il(Date.now()) + ' Israel time\n');
  await analytics();
  await counters();
  await tables();
  await pages();
})().catch(function(e){ console.log('Failed: ' + (e && e.message || e)); process.exit(1); });
