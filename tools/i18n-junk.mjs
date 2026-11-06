/**
 * What never belongs in the shared translations or in a published language file (v39.47).
 *
 * Tony, 6 Nov 2026, after a publish from the app brought 72 Hebrew entries that were data, not phrases (photographers'
 * credits, a collection's recipe lines with a chef's name, a recipe's name, a list of language names with counts) —
 * and the files were found to hold family members' e-mail names from long ago: "Let's make sure it doesn't happen again,
 * as junk tends to accumulate".
 *
 * The app keeps such text out as it goes (index.html: data-no-i18n on every screen that showed it; i18nLooksLikeData;
 * i18nIsKitchenData). This is the same rule for the two jobs that write translations:
 *   - tools/translate-new.mjs (on a release) takes these out of the central store, for what the app no longer asks for;
 *   - tools/publish-languages.mjs never writes them into i18n/<lang>.json or a kept version (i18n/archive/).
 *
 * Three kinds:
 *   - letters of another script in the KEY: the app's English never holds Hebrew, Arabic, Cyrillic, Thai, Devanagari,
 *     Japanese, Chinese or Korean — the pattern is read from index.html (I18N_OTHER_SCRIPT), so there is one rule;
 *   - a credit: the key starts with ©;
 *   - a list of exact keys (tools/i18n-retired.json): stray lines, and names kept there only as SHA-256 of the key,
 *     so this public repository does not repeat them.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const list = JSON.parse(fs.readFileSync(path.join(here, 'i18n-retired.json'), 'utf8'));
const plain = new Set(list.keys || []);
const hashed = new Set(list.sha256 || []);
const sha = k => crypto.createHash('sha256').update(String(k), 'utf8').digest('hex');

export function retiredKey(k) { return plain.has(k) || hashed.has(sha(k)); }

// The app's own pattern, read from its source: `var I18N_OTHER_SCRIPT = /…/;`
export function otherScriptFrom(html) {
  const m = /var I18N_OTHER_SCRIPT = \/(.+)\/([a-z]*);/.exec(String(html || ''));
  if (!m) throw new Error('index.html has no I18N_OTHER_SCRIPT');
  return new RegExp(m[1], m[2]);
}

// Is this key one that never belongs in a translation file? (otherScript: from otherScriptFrom)
export function neverPublished(k, otherScript) {
  k = String(k);
  return otherScript.test(k) || /^©/.test(k) || retiredKey(k);
}
