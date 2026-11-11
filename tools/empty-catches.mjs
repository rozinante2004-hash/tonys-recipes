#!/usr/bin/env node
/**
 * The empty-catch review — the audit of 10 Nov 2026, item H3 (Tony, 11 Nov: "12. Yes").
 *
 *     ACORN_PATH=<acorn> node tools/empty-catches.mjs [index.html] [--all]
 *
 * Lists every error that is caught and dropped without a word — `catch (e) {}` and `.catch(function(){})` — in the
 * page's inline scripts (and self-tests.js is left out: a test may swallow on purpose). Most are right: a storage
 * read that may be blocked, a focus() on a node that left. The ones that matter are around a WRITE that the person
 * believes happened — a database set/update/delete/add/commit, a write to the server — because a swallowed failure
 * there is a lost write nobody hears of. Those are listed first ("writes"); --all lists the rest too.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const acorn = require(process.env.ACORN_PATH || 'acorn');

const argv = process.argv.slice(2);
const file = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1] === '--max-writes')) || 'index.html';
const ALL = argv.includes('--all');
// --max-writes N: fail (exit 1) when more than N are around a write — CI holds the line, so a new one is a choice.
const MAX = argv.includes('--max-writes') ? Number(argv[argv.indexOf('--max-writes') + 1]) : null;
const html = fs.readFileSync(file, 'utf8');
const lineAt = (() => { const starts = [0]; for (let i = 0; i < html.length; i++) if (html[i] === '\n') starts.push(i + 1);
  return pos => { let lo = 0, hi = starts.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (starts[m] <= pos) lo = m; else hi = m - 1; } return lo + 1; }; })();

const WRITE = /^(set|update|delete|add|commit|put|setDoc|updateDoc|deleteDoc|addDoc|runTransaction|saveData|syncCloudPhotos|flushCloudDeletes|writeBatch)$/;
const NET_WRITE = /action:\s*'(feedback-send|meter-admin|mail-recipe|invite-for|app-signals|survey-answer|household-report|link-sent)'/;
function walk(node, fn, parent) {
  if (!node || typeof node.type !== 'string') return;
  fn(node, parent);
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => c && typeof c.type === 'string' && walk(c, fn, node));
    else if (v && typeof v.type === 'string' && k !== 'parent') walk(v, fn, node);
  }
}
function calls(node) {
  const out = [];
  walk(node, n => {
    if (n.type === 'CallExpression') {
      const c = n.callee;
      const name = c.type === 'Identifier' ? c.name : (c.type === 'MemberExpression' && !c.computed ? c.property.name : '');
      if (name) out.push(name);
    }
  });
  return out;
}
const found = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let m;
const blanked = html.replace(/<!--[\s\S]*?-->/g, c => c.replace(/[^\n]/g, ' '));
while ((m = re.exec(blanked))) {
  const code = m[1], base = m.index + m[0].indexOf(m[1]);
  let ast;
  try { ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowReturnOutsideFunction: true }); }
  catch (e) { console.error('a script would not parse at line ' + lineAt(base) + ': ' + e.message); continue; }
  walk(ast, (n, parent) => {
    // try { … } catch (e) {}
    if (n.type === 'TryStatement' && n.handler && n.handler.body.body.length === 0) {
      const inner = calls(n.block), src = code.slice(n.block.start, n.block.end);
      const write = inner.some(c => WRITE.test(c)) || NET_WRITE.test(src);
      found.push({ line: lineAt(base + n.handler.start), kind: 'catch {}', write, what: inner.slice(0, 4).join(', '), src: src.replace(/\s+/g, ' ').slice(0, 110) });
    }
    // promise.catch(function(){}) / .catch(() => {})
    if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && !n.callee.computed && n.callee.property.name === 'catch'
        && n.arguments.length === 1 && /FunctionExpression$/.test(n.arguments[0].type)
        && n.arguments[0].body.type === 'BlockStatement' && n.arguments[0].body.body.length === 0) {
      const inner = calls(n.callee.object), src = code.slice(n.callee.object.start, n.callee.object.end);
      const write = inner.some(c => WRITE.test(c)) || NET_WRITE.test(src);
      found.push({ line: lineAt(base + n.start), kind: '.catch()', write, what: inner.slice(0, 4).join(', '), src: src.replace(/\s+/g, ' ').slice(0, 110) });
    }
  });
}
const writes = found.filter(f => f.write);
console.log(`${found.length} errors caught and dropped in ${path.basename(file)} (${found.filter(f => f.kind === 'catch {}').length} catch {}, ${found.filter(f => f.kind === '.catch()').length} .catch()); ${writes.length} around a write`);
console.log('\n== around a write (a swallowed failure here is a lost write):');
writes.forEach(f => console.log(`  ${f.line}  ${f.kind}  [${f.what}]  ${f.src}`));
if (ALL) { console.log('\n== the rest:'); found.filter(f => !f.write).forEach(f => console.log(`  ${f.line}  ${f.kind}  [${f.what}]  ${f.src}`)); }
if (MAX !== null && writes.length > MAX) {
  console.log(`::error::${writes.length} errors are dropped silently around a write — more than the ${MAX} reviewed (the audit of 10 Nov 2026, H3). `
    + 'Log the new one (syncLog) or, if dropping it is right, raise --max-writes in self-tests.yml on purpose.');
  process.exit(1);
}
