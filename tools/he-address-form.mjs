#!/usr/bin/env node
/**
 * Hebrew in the plural — the audit of 10 Nov 2026, item U6 (Tony, 11 Nov 2026: "Plural").
 *
 *     node tools/he-address-form.mjs                     the proposal for i18n/he.json: every change, nothing written
 *     node tools/he-address-form.mjs --central           the same for the CENTRAL Hebrew (read from the app's database,
 *                                                        no key needed: the rules let anyone read the translations)
 *     node tools/he-address-form.mjs … --out <file.md>   also write the proposal as a list a person can read and tick
 *     FIREBASE_RULES_KEY='<service account JSON>' node tools/he-address-form.mjs --central --apply --confirm "make it plural"
 *                                                        write the changes into the central Hebrew (only if it is still
 *                                                        what was read); publish-languages then puts it in i18n/he.json
 *
 * Why the central document and not i18n/he.json: the publish job writes the files FROM the central translations, so a
 * change made only to the file is undone at the next publish (seen 10 Nov: hand-written plurals came back singular).
 *
 * What changes — only words from the reviewed tables below, and only where they cannot be something else:
 *   1. a "him/her" slash form addressed to the reader (בחר/י, תבדוק/י, יכול/ה, את/ה) — anywhere;
 *   2. a masculine-singular command (לחץ, בחר, שמור, …) — only as the first word of the text, of a sentence or of a
 *      clause (after . : ! ? — – → ( • · or a line break, emoji and spaces between), or after "ואז " / "אחר כך ";
 *      Hebrew without vowels writes many commands as the past tense (שלח = "send" and "he sent") and some as
 *      adjectives (שמור = "save" and "saved"), so a command in the middle of a sentence is left for a person;
 *   3. the pronoun forms שלך → שלכם, אליך → אליכם, אותך → אתכם, ממך → מכם, עליך → עליכם, בשבילך → בשבילכם, לך → לכם.
 * What does not: "him/her" slash forms that are about someone else (לבעל/ת המטבח, חבר/ה), and singular forms outside
 * these positions — the proposal lists the strings that still hold one, for a person to look at.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── the reviewed tables ──────────────────────────────────────────────────────────────────────────────────────
// A masculine-singular command → the plural. Kept to verbs this app's Hebrew actually uses.
export const COMMANDS = {
  'לחץ': 'לחצו', 'הקש': 'הקישו', 'בחר': 'בחרו', 'שלח': 'שלחו', 'בדוק': 'בדקו', 'העתק': 'העתיקו', 'שמור': 'שמרו',
  'פתח': 'פתחו', 'הוסף': 'הוסיפו', 'נסה': 'נסו', 'התחבר': 'התחברו', 'בטל': 'בטלו', 'השתמש': 'השתמשו', 'עדכן': 'עדכנו',
  'הצג': 'הציגו', 'הדבק': 'הדביקו', 'שתף': 'שתפו', 'הסר': 'הסירו', 'בקש': 'בקשו', 'מחק': 'מחקו', 'גרור': 'גררו',
  'הפעל': 'הפעילו', 'הזן': 'הזינו', 'קבל': 'קבלו', 'שאל': 'שאלו', 'המשך': 'המשיכו', 'סמן': 'סמנו', 'ערוך': 'ערכו',
  'הזח': 'הזיחו', 'נקה': 'נקו', 'שחרר': 'שחררו', 'תן': 'תנו', 'טען': 'טענו', 'החלף': 'החליפו', 'שחזר': 'שחזרו',
  'סרוק': 'סרקו', 'התנתק': 'התנתקו', 'תרגם': 'תרגמו', 'הקלד': 'הקלידו', 'גלול': 'גללו', 'הורד': 'הורידו',
  'רענן': 'רעננו', 'התקן': 'התקינו', 'הדפס': 'הדפיסו', 'צלם': 'צלמו', 'הירשם': 'הירשמו', 'היכנס': 'היכנסו',
  'שים': 'שימו', 'הגדר': 'הגדירו', 'אשר': 'אשרו', 'ודא': 'ודאו', 'חזור': 'חזרו', 'המתן': 'המתינו', 'צור': 'צרו',
  'כבה': 'כבו', 'שכפל': 'שכפלו', 'התעלם': 'התעלמו', 'השאר': 'השאירו', 'פרסם': 'פרסמו', 'דלג': 'דלגו',
  'הקלט': 'הקליטו', 'הוצא': 'הוציאו', 'ייבא': 'ייבאו', 'ייצא': 'ייצאו', 'גש': 'גשו', 'הכנס': 'הכניסו', 'סגור': 'סגרו',
  'כתוב': 'כתבו', 'קרא': 'קראו', 'הפוך': 'הפכו', 'חבר': 'חברו', 'עבור': 'עברו', 'אפס': 'אפסו', 'מיין': 'מיינו',
  'הרחב': 'הרחיבו', 'כווץ': 'כווצו', 'הסתר': 'הסתירו', 'האזן': 'האזינו', 'הקטן': 'הקטינו', 'הגדל': 'הגדילו',
};
// Commands that are also an ordinary word, so they change ONLY in their slash form (חבר/י), never alone:
// חבר = member/friend, עבור = for, אפס = zero, כתוב = written, הפוך = upside down, סגור = closed, קרא/שמור/בדוק are kept
// as commands at the start of a clause (a past tense or an adjective rarely opens an instruction), but these four never.
const SLASH_ONLY = new Set(['חבר', 'עבור', 'אפס', 'הפוך']);
// A slash form addressed to the reader that is not a command.
export const SLASH_OTHER = {
  'את/ה': 'אתם', 'יכול/ה': 'יכולים', 'מחובר/ת': 'מחוברים', 'מסכים/ה': 'מסכימים', 'מסתכל/ת': 'מסתכלים',
  'בטוח/ה': 'בטוחים', 'מוכן/ה': 'מוכנים', 'מעוניין/ת': 'מעוניינים', 'תבדוק/י': 'תבדקו', 'שתתחבר/י': 'שתתחברו',
  'שתוכל/י': 'שתוכלו', 'תוכל/י': 'תוכלו', 'תרצה/י': 'תרצו', 'שתרצה/י': 'שתרצו', 'תמצא/י': 'תמצאו',
  'טען/י': 'טענו', 'תשלח/י': 'תשלחו', 'תסגור/י': 'תסגרו', 'תפתח/י': 'תפתחו',
};
// Slash forms about someone else — never changed (listed in the proposal, so nobody wonders).
const SLASH_KEEP = new Set(['לבעל/ת', 'בעל/ת', 'חבר/ה', 'מבקש/ת', 'הוזמן/ה', 'מרכיב/שלב', 'קריאות/יום', 'כתיבות/יום']);
export const PRONOUNS = { 'שלך': 'שלכם', 'אליך': 'אליכם', 'אותך': 'אתכם', 'ממך': 'מכם', 'עליך': 'עליכם', 'בשבילך': 'בשבילכם', 'לך': 'לכם' };
// One-letter prefixes a Hebrew word can carry (and, that, when, to …), checked longest first.
const PREFIXES = ['וכש', 'כש', 'וש', 'ו', 'ש'];

const HEB = /[א-ת]/;
const WORD = /[א-ת׳״"״׳']+(?:\/[א-ת]{1,3})?/g;
const BOUNDARY = /[.:!?—–→(\n•·;"“«]/;

function clauseStart(text, at) {
  // What lies between the previous word (Hebrew or Latin) and this one: a boundary there, or the start of the text.
  let i = at - 1;
  // A placeholder ({1}: a link or bold) is not a word.
  while (i >= 0) {
    if (text[i] === '}' && /\{\d\}$/.test(text.slice(Math.max(0, i - 2), i + 1))) { i -= 3; continue; }
    if (/[א-תA-Za-z0-9]/.test(text[i])) break;
    if (BOUNDARY.test(text[i])) return true;
    i--;
  }
  if (i < 0) return true;
  // "ואז לחץ", "אחר כך בחר"
  const before = text.slice(Math.max(0, i - 7), i + 1);
  return /(?:^|[^א-ת])ואז$/.test(before) || /אחר כך$/.test(text.slice(Math.max(0, i - 7), i + 1));
}

// The English says when an opening word that looks like a command is a state ("📱 Stored on this device only" →
// "שמור במכשיר" = "saved", not "save"): then the first word is left.
const STATE_EN = /^[^A-Za-z]*(Stored|Saved|Sent|Deleted|Copied|Checked|Closed|Written|Kept|Loaded|Opened|Shared|Removed|Selected|Chosen|Translated|Restored|Connected|Signed|Locked|Asked|Received|Accepted|Read-only|Read only)\b/;
// The plural of one string, and the reasons. Never touches {1} placeholders, Latin text or emoji.
export function heAddressPlural(text, english) {
  const stateFirst = STATE_EN.test(String(english || ''));
  let firstWord = true;
  const changes = [];
  // Once a command in this text has been made plural, the text is an instruction: a command joined to it by "או",
  // a comma or a "ו" ("…, הקש שיתוף", "הוסיפו … או ייבא", "ולחץ") is one too.
  let saw = false;
  const joined = (all, at) => /(?:^|[^\u05D0-\u05EA])או\s+$/.test(all.slice(Math.max(0, at - 6), at)) || /,\s*$/.test(all.slice(Math.max(0, at - 3), at));
  const out = String(text).replace(WORD, (w, at, all) => {
    const isFirst = firstWord; firstWord = false;
    // 1. slash forms
    if (w.includes('/')) {
      for (const p of [''].concat(PREFIXES)) {
        if (p && !w.startsWith(p)) continue;
        const core = w.slice(p.length);
        if (SLASH_KEEP.has(core)) return w;
        // "אני מסכים/ה" is the speaker, not the reader: left as it is (the first pass made it "אני מסכימים")
        if (/(?:^|[^\u05D0-\u05EA])אני(?:\s+רק)?\s+$/.test(all.slice(Math.max(0, at - 10), at))) return w;
        if (SLASH_OTHER[core]) { changes.push(w + ' → ' + p + SLASH_OTHER[core]); return p + SLASH_OTHER[core]; }
        const m = /^(.+)\/י$/.exec(core);
        if (m && COMMANDS[m[1]]) { saw = true; changes.push(w + ' → ' + p + COMMANDS[m[1]]); return p + COMMANDS[m[1]]; }
      }
      return w;
    }
    // 3. pronouns (whole word; "לך" only when it is not opening a clause, where it can mean "go")
    if (PRONOUNS[w] && !(w === 'לך' && clauseStart(all, at))) { changes.push(w + ' → ' + PRONOUNS[w]); return PRONOUNS[w]; }
    // 2. a command opening a clause — or joined to one already made plural
    if (COMMANDS[w] && !SLASH_ONLY.has(w) && !(isFirst && stateFirst) && (clauseStart(all, at) || (saw && joined(all, at)))) {
      saw = true; changes.push(w + ' → ' + COMMANDS[w]); return COMMANDS[w];
    }
    if (saw && w.length > 2 && w[0] === 'ו' && COMMANDS[w.slice(1)] && !SLASH_ONLY.has(w.slice(1))) {
      changes.push(w + ' → ו' + COMMANDS[w.slice(1)]); return 'ו' + COMMANDS[w.slice(1)];
    }
    return w;
  });
  return { text: out, changes };
}

// What is left singular after the change, for a person to look at (not changed: it may be right as it is).
const LEFT = /(?:^|[^א-ת])(אתה|תוכל|תרצה|תמצא|תראה|תבחר|תלחץ|תשלח|תשמור|תפתח|אל ת[א-ת]+|[א-ת]+\/[יהת])(?=[^א-ת]|$)/;
export function leftSingular(text) { const m = LEFT.exec(text); return m ? m[1] : ''; }

// ── the reviewed fixes ──────────────────────────────────────────────────────────────────────────────────────────
// Tony read the first proposal (11 Nov 2026) and found singular forms the tables do not reach ("גש … בזמן שאתה מחובר",
// "ושמע", "תרצה", "שאתה מייבא"). Each phrase a person had to look at is in tools/he-plural-overrides.json, keyed by its
// English: { from: what the rules above make of it, to: the reviewed plural }. A fix is used only while the rules
// still make exactly `from` — if the phrase changed since, it is reported, never applied blind.
export function loadOverrides() {
  try { return JSON.parse(fs.readFileSync(path.join(repo, 'tools', 'he-plural-overrides.json'), 'utf8')); } catch (e) { return {}; }
}
export function pluralWithOverrides(text, english, overrides) {
  const r = heAddressPlural(text, english);
  const o = overrides && overrides[english];
  if (!o) return { text: r.text, changes: r.changes, override: '' };
  if (o.from === r.text) return { text: o.to, changes: r.changes.concat(['(reviewed by hand)']), override: 'used' };
  return { text: r.text, changes: r.changes, override: 'stale' };
}

// ── the run ───────────────────────────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (import.meta.url === 'file://' + process.argv[1] || process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const opt = n => { const i = argv.indexOf('--' + n); return i > -1 ? argv[i + 1] : null; };
  const CENTRAL = argv.includes('--central'), APPLY = argv.includes('--apply');
  const html = fs.readFileSync(path.join(repo, 'index.html'), 'utf8');
  const src = /languageSource:\s*Object\.freeze\(\{([\s\S]*?)\}\)/.exec(html);
  const field = n => (new RegExp(n + ":\\s*'([^']+)'").exec(src ? src[1] : '') || [])[1];
  const projectId = field('projectId'), prefix = field('prefix'), indexPath = field('index');
  const DOCS = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/`;
  let strings, updateTime = null;
  if (CENTRAL) {
    const r = await fetch(DOCS + prefix + 'he');
    if (!r.ok) { console.error('the central Hebrew could not be read: HTTP ' + r.status); process.exit(1); }
    const j = await r.json();
    updateTime = j.updateTime;
    strings = {};
    for (const [k, v] of Object.entries(((j.fields || {}).strings || {}).mapValue ? j.fields.strings.mapValue.fields || {} : {})) strings[k] = v.stringValue;
  } else {
    strings = JSON.parse(fs.readFileSync(path.join(repo, opt('in') || 'i18n/he.json'), 'utf8')).strings;
  }
  const changed = [], left = [], stale = [], overrides = loadOverrides();
  // Phrases translated by hand in this checkout's i18n/he.json that the central Hebrew lacks (new in this release
  // cycle): written along with the plural, or the publish that follows would drop them from the file.
  let repoNew = {};
  if (CENTRAL) {
    try {
      const file = JSON.parse(fs.readFileSync(path.join(repo, 'i18n', 'he.json'), 'utf8')).strings || {};
      for (const [k, v] of Object.entries(file)) if (!(k in strings) && typeof v === 'string' && v.trim()) repoNew[k] = v;
    } catch (e) {}
  }
  for (const [k, v] of Object.entries(strings)) {
    if (typeof v !== 'string') continue;
    const r = pluralWithOverrides(v, k, overrides);
    if (r.override === 'stale') stale.push(k);
    if (r.text !== v) changed.push({ k, from: v, to: r.text, why: r.changes });
    const l = leftSingular(r.text);
    if (l) left.push({ k, text: r.text, word: l });
  }
  console.log(`${Object.keys(strings).length} Hebrew phrases (${CENTRAL ? 'central, ' + projectId : opt('in') || 'i18n/he.json'}): ${changed.length} to change, ${left.length} with a singular form left for a person`
    + `; ${Object.keys(overrides).length - stale.length} reviewed fixes used` + (Object.keys(repoNew).length ? `; ${Object.keys(repoNew).length} new phrases from this checkout added` : '') + (stale.length ? `, ${stale.length} NOT used (the phrase changed since it was reviewed): ` + stale.map(k => JSON.stringify(k.slice(0, 50))).join(', ') : ''));
  if (!opt('out') && !APPLY) changed.slice(0, 40).forEach(c => console.log('  ' + c.from + '\n→ ' + c.to + '\n'));
  if (opt('out')) {
    const md = ['# Hebrew in the plural — the proposal', '',
      `${changed.length} of ${Object.keys(strings).length} Hebrew phrases change (read from ${CENTRAL ? 'the central translations' : 'i18n/he.json'}, ${new Date().toISOString().slice(0, 10)}).`,
      'Each entry: the English, the Hebrew now, the Hebrew proposed. Nothing is written until it is approved.', '',
      '## The changes', ''];
    changed.forEach((c, i) => md.push(`${i + 1}. **${c.k.replace(/\n/g, ' ').slice(0, 140)}**`, `   - now: ${c.from.replace(/\n/g, ' ')}`, `   - plural: ${c.to.replace(/\n/g, ' ')}`, ''));
    md.push('## Left as they are — for a person to look at', '', 'These still hold a singular form the script does not change on its own (a command in the middle of a sentence, "אתה", a future tense, "אל ת…").', '');
    left.forEach((l, i) => md.push(`${i + 1}. **${l.k.replace(/\n/g, ' ').slice(0, 140)}** — "${l.word}": ${l.text.replace(/\n/g, ' ')}`));
    fs.writeFileSync(opt('out'), md.join('\n') + '\n');
    console.log('the proposal: ' + opt('out'));
  }
  if (APPLY) {
    if (!CENTRAL) { console.error('--apply writes the CENTRAL Hebrew only (a change to the file alone is undone by the next publish)'); process.exit(1); }
    if (opt('confirm') !== 'make it plural') { console.error('--apply needs --confirm "make it plural"'); process.exit(1); }
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    let credentials = null; try { credentials = JSON.parse((process.env.FIREBASE_RULES_KEY || '').trim()); } catch (e) {}
    if (!credentials || credentials.type !== 'service_account') { console.error('FIREBASE_RULES_KEY is not a service account key'); process.exit(1); }
    const { GoogleAuth } = require('google-auth-library');
    const t = await (await new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/datastore'] }).getClient()).getAccessToken();
    const next = Object.assign({}, strings, repoNew); changed.forEach(c => { next[c.k] = c.to; });
    const fields = { strings: { mapValue: { fields: Object.fromEntries(Object.entries(next).map(([k, v]) => [k, { stringValue: String(v) }])) } },
      count: { integerValue: String(Object.keys(next).length) },
      updatedAt: { integerValue: String(Date.now()) }, by: { stringValue: 'GitHub, Hebrew in the plural (approved by the owner)' } };
    const mask = Object.keys(fields).map(f => 'updateMask.fieldPaths=' + encodeURIComponent(f)).join('&');
    const r = await fetch(DOCS + prefix + 'he?' + mask + '&currentDocument.updateTime=' + encodeURIComponent(updateTime),
      { method: 'PATCH', headers: { Authorization: 'Bearer ' + (t.token || t), 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
    if (!r.ok) { console.error('::error::not written (HTTP ' + r.status + '): ' + (await r.text()).slice(0, 300) + ' — if it changed meanwhile, run again'); process.exit(1); }
    // The publish job notices a language by the index's { at, count } for it (as tools/translate-new.mjs writes it).
    const now = Number(fields.updatedAt.integerValue), count = Object.keys(next).length;
    const ri = await fetch(DOCS + indexPath + '?updateMask.fieldPaths=' + encodeURIComponent('langs.he'),
      { method: 'PATCH', headers: { Authorization: 'Bearer ' + (t.token || t), 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { langs: { mapValue: { fields: { he: { mapValue: { fields: { at: { integerValue: String(now) }, count: { integerValue: String(count) } } } } } } } } }) });
    if (!ri.ok) { console.error('::error::the Hebrew was written, but the languages index was not (HTTP ' + ri.status + ') — run "Publish languages" with force'); process.exit(1); }
    console.log(`::notice::Hebrew in the plural: ${changed.length} phrases changed in the central translations — publish-languages puts them in i18n/he.json.`);
  }
}
