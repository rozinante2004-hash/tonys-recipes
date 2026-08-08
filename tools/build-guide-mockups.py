#!/usr/bin/env python3
"""Generate mock-ups of iOS Shortcuts action cards for the upload guide.

Drawn to match the real Shortcuts editor closely enough to compare against at a
glance: white rounded cards on iOS system grey, coloured icon tiles, and blue
variable chips. Deliberately NOT pixel-perfect fakes of Apple's UI — they are
diagrams of what each action should read.
"""
import os, html

FONT = "-apple-system, 'SF Pro Text', 'Segoe UI', Helvetica, Arial, sans-serif"
W = 700
CARD_X, CARD_W = 16, W - 32
RADIUS = 16

ICONS = {
    'receive': ('#3B7BE8', 'M3 9 L9 3 L15 9 M9 3 L9 15'),   # download-ish
    'text':    ('#F5C518', None),
    'var':     ('#F08A24', None),
    'base64':  ('#4A4A4A', None),
    'url':     ('#34C759', None),
    'if':      ('#5E9BF5', None),
    'notify':  ('#F2564B', None),
}
ICON_GLYPH = {'text': '≡', 'var': 'x', 'base64': '●', 'url': '↓', 'if': '?', 'notify': '!', 'receive': '⇩'}


def esc(s):
    return html.escape(str(s), quote=True)


def chip(x, y, label, fs=17, tone='blue'):
    """A blue variable chip, as Shortcuts draws inserted variables."""
    pad = 9
    w = len(label) * fs * 0.58 + pad * 2
    fill, col = ('#E3EEFC', '#0A74E8') if tone == 'blue' else ('#EDEDED', '#444')
    return (f'<rect x="{x}" y="{y-fs}" width="{w:.0f}" height="{fs+10}" rx="6" fill="{fill}"/>'
            f'<text x="{x+pad}" y="{y+1}" font-family="{FONT}" font-size="{fs}" fill="{col}">{esc(label)}</text>'), x + w + 6


def icon(x, y, kind, size=30):
    col = ICONS.get(kind, ('#888', None))[0]
    g = ICON_GLYPH.get(kind, '•')
    return (f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="8" fill="{col}"/>'
            f'<text x="{x+size/2}" y="{y+size*0.68}" font-family="{FONT}" font-size="{size*0.55:.0f}" '
            f'fill="#fff" text-anchor="middle" font-weight="600">{esc(g)}</text>')


def card(y, height, parts, badge=None, badge_col=None, indent=0):
    """One action card. `parts` is raw svg already positioned.

    `indent` insets the card from the left, which is how the guide shows that an
    action sits INSIDE an If branch rather than after the block.
    """
    out = [f'<rect x="{CARD_X+indent}" y="{y}" width="{CARD_W-indent}" height="{height}" rx="{RADIUS}" '
           f'fill="#FFFFFF" stroke="#E3E3E8"/>']
    if badge:
        bw = len(badge) * 12 + 22
        out.append(f'<rect x="{CARD_X+CARD_W-bw-12}" y="{y+12}" width="{bw}" height="26" rx="13" fill="{badge_col}"/>')
        out.append(f'<text x="{CARD_X+CARD_W-bw/2-12}" y="{y+30}" font-family="{FONT}" font-size="14" '
                   f'fill="#fff" text-anchor="middle" font-weight="700">{esc(badge)}</text>')
    out.extend(parts)
    return ''.join(out)


def svg(height, body, title=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{height}" '
            f'viewBox="0 0 {W} {height}" role="img" aria-label="{esc(title)}">'
            f'<rect width="{W}" height="{height}" fill="#F2F2F7"/>{body}</svg>')


def line(x, y, text, fs=17, col='#111', weight='400'):
    return (f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{fs}" fill="{col}" '
            f'font-weight="{weight}">{esc(text)}</text>')


def textw(text, fs=17):
    return len(text) * fs * 0.55


OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'whatsapp', 'img')
os.makedirs(OUT, exist_ok=True)


def write(name, content):
    path = os.path.join(OUT, name)
    open(path, 'w').write(content)
    print('  ', name, len(content), 'bytes')


# ── 1. Receive Files from Share Sheet ────────────────────────────────────────
p = [icon(34, 20, 'receive')]
x = 78
p.append(line(x, 42, 'Receive'))
x += textw('Receive') + 12
c, x = chip(x, 42, 'Files'); p.append(c)
p.append(line(x, 42, 'from')); x += textw('from') + 12
c, x = chip(x, 42, 'Share Sheet'); p.append(c)
p.append(line(34, 78, "If there's no input:", 15, '#8A8A8E'))
c, _ = chip(190, 78, 'Continue', 15); p.append(c)
write('01-receive.svg', svg(120, card(12, 96, p), 'Receive Files from Share Sheet'))

# ── 2. Text + Set Variable pair ──────────────────────────────────────────────
p = [icon(34, 20, 'text'), line(78, 42, 'Text')]
p.append(f'<line x1="{CARD_X}" y1="62" x2="{CARD_X+CARD_W}" y2="62" stroke="#EEE"/>')
p.append(line(34, 92, 'Meat-prep.zip', 17, '#111'))
body = card(12, 110, p)
p2 = [icon(34, 148, 'var')]
x = 78
p2.append(line(x, 170, 'Set variable')); x += textw('Set variable') + 12
c, x = chip(x, 170, 'FILENAME'); p2.append(c)
p2.append(line(x, 170, 'to')); x += textw('to') + 10
c, x = chip(x, 170, 'Text'); p2.append(c)
body += card(140, 56, p2)
write('02-filename.svg', svg(210, body, 'Text and Set variable FILENAME'))

# ── 3. Base64: wrong vs right — the trap ─────────────────────────────────────
p = [icon(34, 30, 'base64')]
x = 78
c, x = chip(x, 52, 'Shortcut Input'); p.append(c)
c, x = chip(x, 52, 'Token'); p.append(c)
p.append(line(x, 52, 'with base64'))
p.append(line(34, 92, 'encodes your token into the file, and uploads it to a public repo', 14, '#B3261E'))
body = card(22, 88, p, badge='WRONG', badge_col='#D93025')

p2 = [icon(34, 158, 'base64')]
x = 78
c, x = chip(x, 180, 'Shortcut Input'); p2.append(c)
p2.append(line(x, 180, 'with base64'))
p2.append(f'<line x1="{CARD_X}" y1="200" x2="{CARD_X+CARD_W}" y2="200" stroke="#EEE"/>')
p2.append(line(34, 228, 'Line Breaks', 16, '#444'))
p2.append(line(CARD_X + CARD_W - 80, 228, 'None', 16, '#0A74E8'))
body += card(150, 100, p2, badge='RIGHT', badge_col='#1E8E3E')
write('03-base64.svg', svg(268, body, 'Base64 Encode: one chip only, line breaks none'))

# ── 4. Get contents of URL ───────────────────────────────────────────────────
p = [icon(34, 24, 'url')]
p.append(line(78, 46, 'Get contents of'))
p.append(line(34, 84, 'https://api.github.com/repos/rozinante2004-hash/', 15, '#0A74E8'))
p.append(line(34, 110, 'tonys-recipes/contents/whatsapp/', 15, '#0A74E8'))
c, _ = chip(34, 142, 'FILENAME', 16); p.append(c)
p.append(line(190, 142, '← a blue chip, NOT the typed word', 14, '#B3261E'))
p.append(f'<line x1="{CARD_X}" y1="162" x2="{CARD_X+CARD_W}" y2="162" stroke="#EEE"/>')
p.append(line(34, 190, 'Method', 16, '#444'))
p.append(line(CARD_X + CARD_W - 70, 190, 'GET', 16, '#0A74E8'))
write('04-get-url.svg', svg(226, card(12, 200, p), 'Get contents of URL with FILENAME variable'))

# ── 5. Headers ───────────────────────────────────────────────────────────────
p = [line(34, 40, 'Headers', 16, '#444', '600')]
p.append(f'<line x1="{CARD_X}" y1="54" x2="{CARD_X+CARD_W}" y2="54" stroke="#EEE"/>')
p.append(line(34, 84, 'Authorization', 16, '#111'))
x = 210
p.append(line(x, 84, 'Bearer', 16, '#111')); x += textw('Bearer ', 16) + 6
c, _ = chip(x, 84, 'TOKEN', 15); p.append(c)
p.append(line(34, 110, 'mind the space after "Bearer" — no space gives a 401', 13, '#B3261E'))
p.append(f'<line x1="{CARD_X}" y1="126" x2="{CARD_X+CARD_W}" y2="126" stroke="#EEE"/>')
p.append(line(34, 156, 'Accept', 16, '#111'))
p.append(line(210, 156, 'application/vnd.github+json', 15, '#111'))
write('05-headers.svg', svg(196, card(12, 172, p), 'The two headers'))

# ── 6. The If block, filled in ───────────────────────────────────────────────
IND = 30  # how far a nested action is inset


def if_header(y):
    p = [icon(34, y + 8, 'if')]
    x = 78
    p.append(line(x, y + 30, 'If'))
    x += textw('If') + 10
    c, x = chip(x, y + 30, 'SHA')
    p.append(c)
    p.append(line(x, y + 30, 'has any value'))
    return card(y, 48, p)


body = if_header(12)
# the vertical rail that shows what the block encloses
body += f'<line x1="{CARD_X+14}" y1="60" x2="{CARD_X+14}" y2="330" stroke="#C7C7CC" stroke-width="3"/>'
p2 = [line(52 + IND, 96, 'Get contents of …/whatsapp/', 15),
      line(52 + IND, 120, 'PUT · JSON body: message, content, sha', 14, '#1E8E3E'),
      line(52 + IND, 142, 'three fields — sha included', 13, '#666')]
body += card(72, 88, p2, indent=IND)
body += card(172, 40, [line(34, 198, 'Otherwise', 17, '#111', '600'),
                       line(150, 198, '← the file is not there yet', 14, '#666')])
p3 = [line(52 + IND, 256, 'Get contents of …/whatsapp/', 15),
      line(52 + IND, 280, 'PUT · JSON body: message, content', 14, '#1E8E3E'),
      line(52 + IND, 302, 'TWO fields — no sha at all', 13, '#B3261E')]
body += card(232, 88, p3, indent=IND)
body += card(332, 40, [line(34, 358, 'End If', 17, '#111', '600')])
write('06-if-block.svg', svg(386, body, 'The finished If / Otherwise / End If block'))

# ── 8. The empty If block — what you see before the uploads go in ────────────
# The If card is drawn taller here so the + sits inside it, as Shortcuts draws it.
body = ''
ph = [icon(34, 20, 'if')]
x = 78
ph.append(line(x, 42, 'If'))
x += textw('If') + 10
c, x = chip(x, 42, 'SHA')
ph.append(c)
ph.append(line(x, 42, 'has any value'))
ph.append('<rect x="78" y="62" width="48" height="34" rx="10" fill="#E3EEFC"/>')
ph.append(line(94, 87, '+', 22, '#0A74E8', '600'))
body += card(12, 108, ph)
body += line(140, 87, '← adds a SECOND CONDITION, not an action', 14, '#B3261E')

body += '<rect x="46" y="134" width="608" height="46" rx="12" fill="#FFF4E5" stroke="#F0C48A" stroke-dasharray="6 4"/>'
body += line(64, 163, 'the FIRST upload action belongs in this gap', 15, '#A85B00')

body += card(194, 40, [line(34, 220, 'Otherwise', 17, '#111', '600')])

body += '<rect x="46" y="248" width="608" height="46" rx="12" fill="#FFF4E5" stroke="#F0C48A" stroke-dasharray="6 4"/>'
body += line(64, 277, 'the SECOND upload action belongs in this gap', 15, '#A85B00')

body += card(308, 40, [line(34, 334, 'End If', 17, '#111', '600')])
body += line(34, 380, 'A new action always lands at the very bottom. Drag it up into the gap.', 14, '#666')
write('08-if-empty.svg', svg(398, body, 'The empty If block and where the two uploads go'))

# ── 7. Whole shortcut, top to bottom ─────────────────────────────────────────
rows = [
    ('receive', 'Receive', 'Files', 'from Share Sheet'),
    ('text',    'Text',    None,    'Meat-prep.zip'),
    ('var',     'Set variable', 'FILENAME', 'to Text'),
    ('text',    'Text',    None,    'github_pat_… (your token)'),
    ('var',     'Set variable', 'TOKEN', 'to Text'),
    ('base64',  'Base64 Encode', 'Shortcut Input', 'Line Breaks: None'),
    ('var',     'Set variable', 'CONTENT', 'to Base64 Encoded'),
    ('url',     'Get contents of', 'FILENAME', 'GET · 2 headers'),
    ('var',     'Set variable', 'SHA', 'to Dictionary Value'),
]
body, y = '', 12
for kind, lead, chp, tail in rows:
    p = [icon(30, y + 11, kind, 26)]
    x = 68
    p.append(line(x, y + 32, lead, 16))
    x += textw(lead, 16) + 10
    if chp:
        c, x = chip(x, y + 32, chp, 15)
        p.append(c)
    p.append(line(x, y + 32, tail, 15, '#666'))
    body += card(y, 48, p)
    y += 56
write('07-full.svg', svg(y + 4, body, 'The whole shortcut, nine actions'))
print('done')
