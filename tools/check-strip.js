/*
 * Proof for tools/strip-comments.js (v38.72): over every inline script of a page, its comment list must be exactly
 * acorn's (a real JavaScript parser), and the stripped page's every inline script must still parse. Run where acorn
 * is installed (CI: npm install acorn):
 *
 *   node tools/check-strip.js index.html [dist/index.html]
 */
'use strict';
const fs = require('fs');
const vm = require('vm');
const { jsComments, stripHtml } = require('./strip-comments');
let acorn = null;
for (const p of ['acorn', process.env.ACORN_PATH || '']) { try { if (p) { acorn = require(p); break; } } catch (e) { /* the next */ } }
if (!acorn) { console.error('acorn is needed for this check (npm install acorn, or ACORN_PATH)'); process.exit(2); }

function scripts(html) {
  const out = [], re = /<!--[\s\S]*?-->|(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)/gi;
  let m;
  while ((m = re.exec(html))) {
    if (!m[1]) continue;   // a comment of the markup ("<script>" inside one is not a script)
    const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(m[1]) || [])[1] || '';
    if (/\bsrc\s*=/i.test(m[1]) || (type && !/javascript|ecmascript|module/i.test(type))) continue;
    out.push({ code: m[2], line: html.slice(0, m.index).split('\n').length });
  }
  return out;
}
let bad = 0;
const src = fs.readFileSync(process.argv[2], 'utf8');
for (const s of scripts(src)) {
  const ours = jsComments(s.code).map(r => r.join('-'));
  const theirs = [];
  try { acorn.parse(s.code, { ecmaVersion: 'latest', allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true, onComment: (b, t, a, e) => theirs.push(a + '-' + e) }); }
  catch (e) { console.error('script at line ' + s.line + ': acorn cannot parse it: ' + e.message); bad++; continue; }
  const a = new Set(ours), b = new Set(theirs);
  const missing = theirs.filter(x => !a.has(x)), extra = ours.filter(x => !b.has(x));
  if (missing.length || extra.length) {
    bad++;
    const show = r => { const [x] = r.split('-').map(Number); return 'line ' + (s.line + s.code.slice(0, x).split('\n').length - 1) + ': ' + JSON.stringify(s.code.slice(x, x + 60)); };
    console.error('script at line ' + s.line + ': ' + missing.length + ' comment(s) missed, ' + extra.length + ' taken that are not comments');
    missing.slice(0, 5).forEach(r => console.error('  missed ' + show(r)));
    extra.slice(0, 5).forEach(r => console.error('  NOT a comment ' + show(r)));
  }
}
const out = process.argv[3] ? fs.readFileSync(process.argv[3], 'utf8') : stripHtml(src);
for (const s of scripts(out)) {
  try { new vm.Script(s.code, { filename: 'inline script at line ' + s.line }); }
  catch (e) {
    // a script that is a module or uses top-level await is checked by acorn instead
    try { acorn.parse(s.code, { ecmaVersion: 'latest', sourceType: 'module', allowAwaitOutsideFunction: true }); }
    catch (e2) { console.error('stripped script at line ' + s.line + ' does not parse: ' + e.message); bad++; }
  }
}
console.log(bad ? 'FAILED' : 'every comment found exactly as acorn finds it, and every stripped script parses — '
  + Math.round(Buffer.byteLength(src) / 1024) + ' KB → ' + Math.round(Buffer.byteLength(out) / 1024) + ' KB');
process.exit(bad ? 1 : 0);
