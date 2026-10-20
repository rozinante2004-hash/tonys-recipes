#!/usr/bin/env node
// Cloudflare Pages: build only the branch each project publishes — no previews.
//
// 19 Oct 2026, measured with tools/cf-usage.js: 905 Pages builds this month
// against a free plan of 500 builds a month (and one build at a time). Both
// projects built a "preview" of EVERY branch: the community project
// (my-kitchen-notes-beta) built every push to test and main, the test project
// every push to main and beta — 553 of the 905, none of them ever opened, and
// each one queueing ahead of the deploys that matter. Nothing uses a preview
// address; the production branches (beta, test) are untouched.
//
// Reads each project, changes only `preview_deployment_setting` in its source
// configuration (everything else sent back as it was — the GitHub connection
// lives in that object), and reads it again to show what Cloudflare now holds.
//
//   CLOUDFLARE_API_TOKEN=… node tools/cf-pages-previews.js [none|all]
'use strict';
const ACCOUNT = '4dbc420100c13bf94fda83047ce0a7ac';          // public: worker/wrangler.jsonc
const PROJECTS = ['my-kitchen-notes-beta', 'tonys-recipes-test'];
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const WANT = process.argv[2] === 'all' ? 'all' : 'none';

async function cf(path, init) {
  const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT + path, Object.assign({}, init, {
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' } }));
  let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, j };
}
function say(p) {
  const c = ((p.source || {}).config) || {};
  return p.name + ': production branch ' + p.production_branch + ', builds on push ' + (c.deployments_enabled !== false)
    + ', previews ' + c.preview_deployment_setting;
}

(async function () {
  if (!TOKEN) { console.log('CLOUDFLARE_API_TOKEN is not set.'); process.exit(1); }
  let bad = 0;
  for (const name of PROJECTS) {
    const g = await cf('/pages/projects/' + name);
    if (g.status !== 200 || !g.j || !g.j.result) { console.log(name + ': could not read it (HTTP ' + g.status + ')'); bad++; continue; }
    const p = g.j.result;
    console.log('before  ' + say(p));
    const source = JSON.parse(JSON.stringify(p.source || {}));
    if (!source.config || !source.config.repo_name) { console.log(name + ': no GitHub connection in its settings — left alone'); bad++; continue; }
    if (source.config.preview_deployment_setting === WANT) { console.log('        already ' + WANT); continue; }
    source.config.preview_deployment_setting = WANT;
    const u = await cf('/pages/projects/' + name, { method: 'PATCH', body: JSON.stringify({ source }) });
    if (u.status !== 200 || !u.j || !u.j.success) {
      console.log(name + ': not changed (HTTP ' + u.status + ') ' + JSON.stringify((u.j && u.j.errors) || '').slice(0, 300)); bad++; continue;
    }
    const a = await cf('/pages/projects/' + name);
    const after = a.j && a.j.result;
    console.log('after   ' + (after ? say(after) : '(could not read it back)'));
    const c = ((after || {}).source || {}).config || {};
    if (!after || c.preview_deployment_setting !== WANT || c.repo_name !== source.config.repo_name || after.production_branch !== p.production_branch) {
      console.log(name + ': the settings read back are not what was sent'); bad++;
    }
  }
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.log('Failed: ' + (e && e.message || e)); process.exit(1); });
