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

(async function(){
  if (!TOKEN) { console.log('CLOUDFLARE_API_TOKEN is not set.'); process.exit(1); }
  console.log('Cloudflare usage, the last ' + DAYS + ' day(s), ' + il(Date.now()) + ' Israel time\n');
  await analytics();
  await counters();
})().catch(function(e){ console.log('Failed: ' + (e && e.message || e)); process.exit(1); });
