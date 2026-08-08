#!/usr/bin/env python3
"""Generate whatsapp/Send-chat-to-Recipes.shortcut — the iPhone upload Shortcut.

Building this by hand in the Shortcuts editor is 33 fiddly steps (see
whatsapp/UPLOAD-FROM-IPHONE.md). A .shortcut file is just a property list, so we
can emit the finished thing and let Tony fill in the two fields that are his.

**The token is deliberately NOT in here.** It ships as the placeholder below and
has to be pasted in on the phone after import. A token in a repo file is a token
in a public repo.

The plist keys Shortcuts uses are undocumented and shift between iOS releases, so
treat the output as "very likely right" rather than "verified" — the guide tells
Tony which rows to eyeball after import.

    python3 tools/build-shortcut.py
"""
import plistlib
import os
import uuid

REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(REPO, 'whatsapp', 'Send-chat-to-Recipes.shortcut')

API = 'https://api.github.com/repos/rozinante2004-hash/tonys-recipes/contents/whatsapp/'
TOKEN_PLACEHOLDER = 'PASTE-YOUR-GITHUB-TOKEN-HERE'
DEFAULT_FILENAME = 'Meat_Whatsapp.txt'
OBJ = '￼'  # OBJECT REPLACEMENT CHARACTER — where a variable chip sits


# ── serialisation helpers ────────────────────────────────────────────────────

def var(name):
    """A reference to a named variable, as an attachment value."""
    return {'Type': 'Variable', 'VariableName': name}


SHORTCUT_INPUT = {'Type': 'ExtensionInput'}


def attachment(value):
    """A field whose whole content is one variable."""
    return {'Value': value, 'WFSerializationType': 'WFTextTokenAttachment'}


def text(*parts):
    """A text field built from literal strings and variable references.

    Shortcuts stores these as a string with U+FFFC where each chip sits, plus a
    map from character range to the variable that fills it.
    """
    s = ''
    attachments = {}
    for p in parts:
        if isinstance(p, str):
            s += p
        else:
            attachments['{%d, 1}' % len(s)] = p
            s += OBJ
    value = {'string': s}
    if attachments:
        value['attachmentsByRange'] = attachments
    return {'Value': value, 'WFSerializationType': 'WFTextTokenString'}


def dict_field(pairs):
    """A key/value table — used for both HTTP headers and a JSON body."""
    items = []
    for key, value in pairs:
        items.append({
            'WFItemType': 0,                       # 0 = text
            'WFKey': text(key) if isinstance(key, str) else key,
            'WFValue': value if isinstance(value, dict) and 'WFSerializationType' in value else text(value),
        })
    return {
        'Value': {'WFDictionaryFieldValueItems': items},
        'WFSerializationType': 'WFDictionaryFieldValue',
    }


def action(identifier, params=None):
    return {
        'WFWorkflowActionIdentifier': identifier,
        'WFWorkflowActionParameters': params or {},
    }


def set_variable(name):
    return action('is.workflow.actions.setvariable', {'WFVariableName': name})


def plain_text(value):
    return action('is.workflow.actions.gettext', {'WFTextActionText': value})


HEADERS = [
    ('Authorization', text('Bearer ', var('TOKEN'))),
    ('Accept', 'application/vnd.github+json'),
]


def put_upload(with_sha):
    """The upload action. The only difference between the two copies is `sha`:
    GitHub needs it to replace an existing file and rejects an empty one when
    creating a new file, which is why this is built twice."""
    body = [
        ('message', 'Update chat export from iPhone'),
        ('content', attachment(var('CONTENT'))),
    ]
    if with_sha:
        body.append(('sha', attachment(var('SHA'))))
    return action('is.workflow.actions.downloadurl', {
        'WFURL': text(API, var('FILENAME')),
        'WFHTTPMethod': 'PUT',
        'WFHTTPHeaders': dict_field(HEADERS),
        'WFHTTPBodyType': 'JSON',
        'WFJSONValues': dict_field(body),
        'Advanced': True,
        'ShowHeaders': True,
    })


# ── the shortcut itself ──────────────────────────────────────────────────────

GROUP = str(uuid.uuid4()).upper()   # ties If / Otherwise / End If together

actions = [
    # 1–2. the file name to write to
    plain_text(text(DEFAULT_FILENAME)),
    set_variable('FILENAME'),

    # 3–4. the token
    plain_text(text(TOKEN_PLACEHOLDER)),
    set_variable('TOKEN'),

    # 5–6. the shared file, base64'd. Line breaks MUST be None or GitHub 422s.
    action('is.workflow.actions.base64encode', {
        'WFEncodeMode': 'Encode',
        'WFBase64LineBreakMode': 'None',
        'WFInput': attachment(SHORTCUT_INPUT),
    }),
    set_variable('CONTENT'),

    # 7–9. ask GitHub whether the file is already there
    action('is.workflow.actions.downloadurl', {
        'WFURL': text(API, var('FILENAME')),
        'WFHTTPMethod': 'GET',
        'WFHTTPHeaders': dict_field(HEADERS),
        'Advanced': True,
        'ShowHeaders': True,
    }),
    action('is.workflow.actions.getvalueforkey', {'WFDictionaryKey': 'sha'}),
    set_variable('SHA'),

    # 10–14. two uploads, one per answer
    action('is.workflow.actions.conditional', {
        'GroupingIdentifier': GROUP,
        'WFControlFlowMode': 0,            # If
        'WFInput': attachment(var('SHA')),
        'WFCondition': 100,                # has any value
    }),
    put_upload(with_sha=True),
    action('is.workflow.actions.conditional', {
        'GroupingIdentifier': GROUP,
        'WFControlFlowMode': 1,            # Otherwise
    }),
    put_upload(with_sha=False),
    action('is.workflow.actions.conditional', {
        'GroupingIdentifier': GROUP,
        'WFControlFlowMode': 2,            # End If
    }),

    # 15. say so — a silent failure looks exactly like success
    action('is.workflow.actions.notification', {
        'WFNotificationActionBody': text('Uploaded to Recipes'),
        'WFNotificationActionTitle': text("Tony's Recipes"),
    }),
]

workflow = {
    'WFWorkflowClientVersion': '1200',
    'WFWorkflowMinimumClientVersion': 900,
    'WFWorkflowMinimumClientVersionString': '900',
    'WFWorkflowIcon': {
        'WFWorkflowIconStartColor': 4292093695,      # orange
        'WFWorkflowIconGlyphNumber': 59511,
    },
    'WFWorkflowImportQuestions': [],
    'WFWorkflowTypes': ['ActionExtension'],          # = appears in the Share sheet
    'WFWorkflowHasShortcutInputVariables': True,
    'WFWorkflowInputContentItemClasses': [
        'WFFileContentItem',
        'WFGenericFileContentItem',
        'WFAppStoreAppContentItem',
        'WFArticleContentItem',
        'WFContactContentItem',
        'WFDateContentItem',
        'WFEmailAddressContentItem',
        'WFFolderContentItem',
        'WFImageContentItem',
        'WFiTunesProductContentItem',
        'WFLocationContentItem',
        'WFDCMapsLinkContentItem',
        'WFAVAssetContentItem',
        'WFPDFContentItem',
        'WFPhoneNumberContentItem',
        'WFRichTextContentItem',
        'WFSafariWebPageContentItem',
        'WFStringContentItem',
        'WFURLContentItem',
    ],
    'WFWorkflowActions': actions,
}

with open(OUT, 'wb') as fh:
    plistlib.dump(workflow, fh)

print('  wrote', os.path.relpath(OUT, REPO), '—', os.path.getsize(OUT), 'bytes')
print('  ', len(actions), 'actions; token is a placeholder, paste the real one on the phone')
