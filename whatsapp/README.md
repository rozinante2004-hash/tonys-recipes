# WhatsApp group exports

Files here are read by Tony's Recipes (⚙️ Settings → 💬 WhatsApp Groups → *Load chats
from this folder*), and because they are served over HTTPS they work on **every**
device — the iPhone included. A file left on the laptop is not reachable from the
phone; that is the whole reason this folder exists.

## Adding a group

1. In WhatsApp: open the group → tap the group name → **Export chat** → **Without media**.
   (There is no API and no scheduled export — this step is manual on every platform.
   Anything that automates WhatsApp Web breaches the Terms of Service and gets numbers banned.)
2. Save the resulting file into this folder. **WhatsApp gives you a `.zip` containing
   `_chat.txt`, not a bare `.txt`** — upload it as-is. The app detects a zip by its contents
   and unpacks it itself, so the file extension does not matter and you never need to
   unzip anything by hand. (If your browser saves it as `download` with no extension,
   that is fine too — just rename it to something meaningful.)
   Give it a sensible name — the file name becomes the group's label unless `index.json`
   says otherwise.
3. Commit and push. The app picks it up the next time you press *Load chats from this folder*.

**From the iPhone, without a laptop:** see [UPLOAD-FROM-IPHONE.md](UPLOAD-FROM-IPHONE.md) —
Export chat → Share → a Shortcut that PUTs the file straight into this folder.
The same guide as one offline, printable file:
[upload-guide.html](https://rozinante2004-hash.github.io/tonys-recipes/whatsapp/upload-guide.html).
It is **generated** from the markdown by `tools/build-upload-guide.js` — edit the markdown
and re-run the builder; never hand-edit the HTML.

## `index.json` — optional since v29.5

The app now **lists this folder** over the GitHub API, so a file that is simply dropped in here
is picked up on its own. `index.json` is still read, and still does one useful job: giving a file
a nicer group label than its file name. Without it the label comes from the file name.

(The listing needs the repository to be public, which it is. For a private repo the listing is
refused and `index.json` becomes required again — the app falls back to it automatically.)

Either a plain list of file names:

```json
["family-food.txt", "baking-club.txt"]
```

or, when you want nicer labels:

```json
[
  { "file": "family-food.txt", "group": "Family Food" },
  { "file": "baking-club.txt", "group": "Baking Club" }
]
```

## Updating

Re-exporting a chat gives you the **entire** history again, not just the new part, so
replace the old file rather than appending to it. Loading the folder replaces every
remote entry for the same reason.

## What gets ignored

Group housekeeping — "joined using a group link", "left", "changed the subject", and their
Hebrew equivalents — is filtered out during parsing. In a real group that can be a large
share of the lines, and none of it answers a cooking question.

## Automating the upload (not the export)

- **iPhone:** a Shortcut that accepts a file from the Share sheet and PUTs it to
  `PUT /repos/<owner>/<repo>/contents/whatsapp/<file>` via the GitHub API turns the
  whole thing into *Export chat → Share → Shortcut*.
- **Android / desktop:** share or copy the file into a local clone of this folder and
  let a small commit-and-push script handle the rest.

## Privacy

These files contain other people's messages. This folder is as public as the repository
is — if the repo is public, so are the chats. Keep the repository private, or import the
files device-locally instead (⚙️ Settings → 💬 WhatsApp Groups → *Import exported .txt files*),
which stores them in the browser and uploads nothing.
