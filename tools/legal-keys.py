#!/usr/bin/env python3
"""v37.85 — tie each passage of the translated privacy statement and terms to
its English original, so the translation editor can find and correct it.

Tony: "the editor should find any word that is translated, no matter where".
The translated pages (privacy.<lang>.html, terms.<lang>.html) are written block
for block from the English ones. This pairs the blocks in order (h1, h2, h3, p,
li, th, td, div.box, div.meta) and writes on each translated block

    data-k="📜 Privacy statement · <the English block's words>"

— the dictionary key the app and the page itself look up for a correction.
The translation note at the top of each page (data-no-k) has no English twin.
It also makes sure each page loads legal-i18n.js, which applies corrections.

Run after changing any of these pages:   python3 tools/legal-keys.py
Fails, changing nothing, if a translation's blocks do not match the English.
"""
import html, os, re, sys
from html.parser import HTMLParser

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ['he', 'ar', 'ru', 'fr', 'es', 'de', 'it', 'pt', 'zh', 'ja']      # LEGAL_LANGS in index.html
PREFIX = {'privacy': '📜 Privacy statement · ', 'terms': '⚖️ Terms · '}   # LEGAL_KEY_PREFIX in index.html
BLOCKS = {'h1', 'h2', 'h3', 'p', 'li', 'th', 'td'}

def norm(s):
    return re.sub(r'\s+', ' ', s).strip()

class Blocks(HTMLParser):
    """Each block: (tag, offset just after the tag name, its words)."""
    def __init__(self, src):
        super().__init__(convert_charrefs=True)
        self.lines = [0]
        for m in re.finditer('\n', src):
            self.lines.append(m.end())
        self.found, self.cur, self.depth, self.skip = [], None, 0, 0
        self.feed(src)
    def is_block(self, tag, attrs):
        a = dict(attrs)
        if 'data-no-k' in a:
            return 'skip'
        if tag in BLOCKS:
            return True
        return tag == 'div' and (a.get('class') or '').split()[:1] in (['box'], ['meta'])
    def handle_starttag(self, tag, attrs):
        if self.cur is not None:
            if tag == self.cur[0]: self.depth += 1
            return
        if self.skip:
            if tag == self.skip_tag: self.skip += 1
            return
        kind = self.is_block(tag, attrs)
        if kind == 'skip':
            self.skip, self.skip_tag = 1, tag
        elif kind:
            line, col = self.getpos()
            self.cur, self.depth = [tag, self.lines[line - 1] + col + 1 + len(tag), []], 1
    def handle_endtag(self, tag):
        if self.skip:
            if tag == self.skip_tag:
                self.skip -= 1
            return
        if self.cur is not None and tag == self.cur[0]:
            self.depth -= 1
            if self.depth == 0:
                self.found.append((self.cur[0], self.cur[1], norm(''.join(self.cur[2]))))
                self.cur = None
    def handle_data(self, data):
        if self.cur is not None:
            self.cur[2].append(data)

def main():
    plan, problems = [], []
    for doc in ('privacy', 'terms'):
        en = Blocks(open(os.path.join(REPO, doc + '.html'), encoding='utf-8').read()).found
        for lang in LANGS:
            path = os.path.join(REPO, '%s.%s.html' % (doc, lang))
            src = open(path, encoding='utf-8').read()
            src = re.sub(r' data-k="[^"]*"', '', src)
            tr = Blocks(src).found
            if [b[0] for b in tr] != [b[0] for b in en]:
                problems.append('%s.%s.html: %d blocks against the English %d, or in another order' % (doc, lang, len(tr), len(en)))
                continue
            # Insert from the end, so earlier offsets stay right.
            for (tag, at, _), (_, _, words) in sorted(zip(tr, en), key=lambda p: -p[0][1]):
                if words:
                    src = src[:at] + ' data-k="' + html.escape(PREFIX[doc] + words, quote=True) + '"' + src[at:]
            if 'legal-i18n.js' not in src:
                src = src.replace('</body>', '<script src="legal-i18n.js"></script>\n</body>', 1)
            plan.append((path, src))
    if problems:
        print('\n'.join(problems)); sys.exit(1)
    for path, src in plan:
        open(path, 'w', encoding='utf-8').write(src)
    print('keyed %d pages' % len(plan))

main()
