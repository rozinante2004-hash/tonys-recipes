/*
 * What a device downloads, without what only a reader of the source needs (v38.72).
 *
 * Tony, 21 Oct 2026: "Where is the 2200 KB limit coming from? If no progress is possible without overcoming this
 * limitation then please do whatever is required to reduce the size." The limit is the app's own budget (self-test
 * `perf_page_budget`), there because every new device downloads the whole page on its first visit. A third of the
 * page was comments — 712 KB in the scripts, 42 KB in the styles, 18 KB in the markup: the reasons behind the code,
 * Tony's own words, what was tried and failed. They stay in the source; tools/build.js takes them out of the community
 * and test copies it builds (the family's copy is the source itself, byte for byte, and forwards to the community one).
 *
 * Exact, not a guess: a small JavaScript lexer that knows strings, template literals (with ${} inside), regular
 * expressions and comments, checked against acorn's own comment list over the whole page (tools/check-strip.js) and
 * by the full Self Test suite running on the built copy in CI. Nothing but comments is removed: a comment alone on its
 * lines takes its lines with it; one after code leaves the code and the line; one between tokens becomes a space.
 *
 *   const { stripHtml } = require('./strip-comments');   page = stripHtml(page)
 */
'use strict';

// Where a `/` starts a regular expression rather than a division: after these, or at the start.
const REGEX_AFTER_PUNCT = new Set('(,=:[!&|?{};+-*%<>~^}'.split(''));
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw',
  'case', 'do', 'else', 'yield', 'await']);

// The comments of one script: [start, end) pairs, in order.
function jsComments(code) {
  const out = [];
  const n = code.length;
  let i = 0, prev = '';            // prev: the last significant token ('' at the start)
  const tplStack = [];             // brace depth at which each open ${…} returns to its template
  let depth = 0;
  const isIdStart = c => /[A-Za-z_$\u0080-￿]/.test(c);
  const isId = c => /[A-Za-z0-9_$\u0080-￿]/.test(c);
  function readString(q) {         // i at the opening quote
    i++;
    while (i < n) {
      const c = code[i];
      if (c === '\\') { i += 2; continue; }
      if (c === q) { i++; return; }
      if (c === '\n') return;      // an unterminated string ends at the line (as the engine would complain)
      i++;
    }
  }
  function readTemplate() {        // i just after a ` or a } closing ${…}; returns true when ${ was met
    while (i < n) {
      const c = code[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; return false; }
      if (c === '$' && code[i + 1] === '{') { i += 2; return true; }
      i++;
    }
    return false;
  }
  function readRegex() {           // i at the opening /
    i++;
    let inClass = false;
    while (i < n) {
      const c = code[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '\n') return;
      if (inClass) { if (c === ']') inClass = false; }
      else if (c === '[') inClass = true;
      else if (c === '/') { i++; break; }
      i++;
    }
    while (i < n && /[a-z]/i.test(code[i])) i++;   // flags
  }
  while (i < n) {
    const c = code[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v' || c === ' ' || c === '﻿') { i++; continue; }
    if (c === '/' && code[i + 1] === '/') {
      const s = i; while (i < n && code[i] !== '\n') i++;
      out.push([s, i]); continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      const s = i, e = code.indexOf('*/', i + 2); i = e < 0 ? n : e + 2;
      out.push([s, i]); continue;
    }
    if (c === '"' || c === "'") { readString(c); prev = 'str'; continue; }
    if (c === '`') { i++; if (readTemplate()) { tplStack.push(depth); depth++; } prev = 'str'; continue; }
    if (c === '/') {
      if (prev === '' || REGEX_AFTER_PUNCT.has(prev) || REGEX_AFTER_WORD.has(prev)) { readRegex(); prev = 'regex'; }
      else { i++; prev = '/'; }
      continue;
    }
    if (c === '{') { depth++; i++; prev = '{'; continue; }
    if (c === '}') {
      depth--;
      if (tplStack.length && tplStack[tplStack.length - 1] === depth) {   // the end of a ${…}: back into the template
        tplStack.pop(); i++;
        if (readTemplate()) { tplStack.push(depth); depth++; }
        prev = 'str'; continue;
      }
      i++; prev = '}'; continue;
    }
    if (isIdStart(c)) { const s = i; while (i < n && isId(code[i])) i++; prev = code.slice(s, i); if (!REGEX_AFTER_WORD.has(prev)) prev = 'id'; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(code[i + 1] || ''))) {
      while (i < n && /[0-9A-Za-z_.]/.test(code[i])) { if ((code[i] === 'e' || code[i] === 'E') && /[+-]/.test(code[i + 1] || '')) i++; i++; }
      prev = 'num'; continue;
    }
    // punctuation: ++ and -- keep a following / a division (x++ / 2); anything else as itself
    if ((c === '+' || c === '-') && code[i + 1] === c) { i += 2; prev = 'id'; continue; }
    i++; prev = c;
  }
  return out;
}

// The comments of a style sheet (outside its strings).
function cssComments(css) {
  const out = [];
  let i = 0; const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === '"' || c === "'") { i++; while (i < n && css[i] !== c) { if (css[i] === '\\') i++; i++; } i++; continue; }
    if (c === '/' && css[i + 1] === '*') { const s = i, e = css.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; out.push([s, i]); continue; }
    i++;
  }
  return out;
}

// Take the ranges out: alone on their lines → the lines go; after code → to the end of the line; between → a space.
function cut(text, ranges) {
  if (!ranges.length) return text;
  let out = '', at = 0;
  for (const [s, e] of ranges) {
    if (s < at) continue;
    const lineStart = text.lastIndexOf('\n', s - 1) + 1;
    let lineEnd = text.indexOf('\n', e); if (lineEnd < 0) lineEnd = text.length;
    const before = text.slice(Math.max(lineStart, at), s), after = text.slice(e, lineEnd);
    const aloneBefore = lineStart >= at && /^[ \t]*$/.test(before), aloneAfter = /^[ \t\r]*$/.test(after);
    if (aloneBefore && aloneAfter) {                  // whole lines: drop them, newline included
      out += text.slice(at, lineStart);
      at = lineEnd < text.length ? lineEnd + 1 : lineEnd;
    } else if (aloneAfter) {                          // after code: the code stays, its trailing spaces go
      out += text.slice(at, s).replace(/[ \t]+$/, '');
      at = e;
    } else {                                          // between tokens: never let two of them touch
      const prevC = out.length || s > at ? text[s - 1] : '', nextC = text[e] || '';
      out += text.slice(at, s) + (/\s/.test(prevC) || /\s/.test(nextC) ? '' : ' ');
      at = e;
    }
  }
  return out + text.slice(at);
}

function stripJs(code) { return cut(code, jsComments(code)); }
function stripCss(css) { return cut(css, cssComments(css)); }

// A whole page: inline scripts (JavaScript only), <style> blocks, and the markup's own <!-- --> — the first comment of
// the page (its version line) is kept. A script or style is found exactly as the browser finds it: from its tag to
// the first closing tag.
function stripHtml(html) {
  // a comment of the markup is skipped first: "<script>" written inside one is not a script (the CSP note says it)
  const re = /(<!--[\s\S]*?-->[ \t]*\n?)|(<script\b[^>]*>)([\s\S]*?)(<\/script\s*>)|(<style\b[^>]*>)([\s\S]*?)(<\/style\s*>)/gi;
  let out = '', at = 0, m, firstComment = true;
  while ((m = re.exec(html))) {
    out += html.slice(at, m.index);
    if (m[1]) {
      if (firstComment) { firstComment = false; out += m[1]; }   // the page's version line stays
    } else if (m[2]) {
      const type = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(m[2]) || [])[1] || '';
      const isJs = !/\bsrc\s*=/i.test(m[2]) && (!type || /^(text|application)\/(javascript|ecmascript)$|^module$/i.test(type));
      out += m[2] + (isJs ? stripJs(m[3]) : m[3]) + m[4];
    } else {
      out += m[5] + stripCss(m[6]) + m[7];
    }
    at = re.lastIndex;
  }
  return out + html.slice(at);
}

const api = { stripHtml, stripJs, stripCss, jsComments, cssComments };
// Node (tools/build.js, tools/check-strip.js) — or a page that loads this file (the page-budget self-test)
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else if (typeof window !== 'undefined') window.MknStrip = api;
