# Uploading a chat export straight from the iPhone

Goal: **WhatsApp → Export chat → Share → Shortcut → done.** No laptop in the middle.

The export step itself cannot be automated on any platform — WhatsApp has no API for it and
anything driving WhatsApp Web breaches their terms and gets numbers banned. The *upload*
afterwards can be, and that is what this does.

**As of v29.5 you only have to upload the file.** The app lists the folder over the GitHub API,
so `index.json` no longer has to be edited. It is still read, and still useful for one thing:
giving a file a nicer group label than its file name.

---

## Before you start

You need a **fine-grained personal access token**, scoped to this one repository:

1. GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token
   <https://github.com/settings/personal-access-tokens/new>
2. **Repository access:** Only select repositories → `rozinante2004-hash/tonys-recipes`
3. **Permissions:** Repository permissions → **Contents: Read and write**. Nothing else.
4. **Expiration:** pick a date you will actually remember. When it expires the Shortcut stops
   working with a 401 — annoying, not dangerous.
5. Copy the token. It is shown once.

Two things worth being clear about:

- **The token lives on your phone.** Scoped to one repo with only Contents write, the worst
  someone with your unlocked phone could do is edit this repository. That is why it is
  fine-grained rather than a classic token.
- **The repository is public, so the chats are public.** That is true today with the laptop
  route as well — this changes nothing about it — but it is worth knowing before you upload a
  family group. If you would rather they were not, the alternative is
  ⚙️ Settings → 💬 WhatsApp Groups → *Import exported .txt files*, which keeps them in the
  browser and uploads nothing.

---

## The Shortcut

New Shortcut → name it something like **Send chat to Recipes**.

In the Shortcut's settings (the ⓘ button): turn on **Show in Share Sheet**, and set
*Share Sheet Types* to **Files** only.

Then these actions, in order:

**1. Receive input**
Automatically added when you enable the Share Sheet. It gives you *Shortcut Input*.

**2. Text** → name it by renaming the action's variable to `FILENAME`
Type the file name you want in the repo, e.g. `family-food.zip`.
Keep it ASCII — plain letters, digits, dashes. A Hebrew file name needs percent-encoding in
the URL and it is not worth the trouble; the *group label* can be Hebrew, see below.

**3. Text** → variable `TOKEN`
Paste the token from above.

**4. Base64 Encode**
Input: **Shortcut Input**.
Tap the action and set **Line Breaks: None**. This matters — the default inserts line breaks
and GitHub rejects the payload with a 422.

**5. Get Contents of URL** — look up whether the file already exists
- URL: `https://api.github.com/repos/rozinante2004-hash/tonys-recipes/contents/whatsapp/[FILENAME]`
- Method: **GET**
- Headers:
  - `Authorization` → `Bearer [TOKEN]`
  - `Accept` → `application/vnd.github+json`

**6. Get Dictionary Value** → key `sha`, from the result of step 5.
Rename its variable to `SHA`.

For a file that does not exist yet this request returns 404 and `SHA` comes out empty. That is
expected and is exactly how the next step tells new from existing.

**7. If** → `SHA` **has any value**

  **Then** — Get Contents of URL
  - URL: `https://api.github.com/repos/rozinante2004-hash/tonys-recipes/contents/whatsapp/[FILENAME]`
  - Method: **PUT**
  - Headers: `Authorization` → `Bearer [TOKEN]`, `Accept` → `application/vnd.github+json`
  - Request Body: **JSON**
    - `message` (Text) → `Update chat export [FILENAME]`
    - `content` (Text) → the **Base64 Encoded** variable from step 4
    - `sha` (Text) → `SHA`

  **Otherwise** — Get Contents of URL
  - Same URL, method, and headers
  - Request Body: **JSON**
    - `message` (Text) → `Add chat export [FILENAME]`
    - `content` (Text) → the **Base64 Encoded** variable from step 4
    - *(no `sha` — sending an empty one is an error, which is the whole reason for the If)*

**8. Show Notification** → `Uploaded [FILENAME]`
Optional, but worth having: without it a silent failure looks identical to success.

---

## Using it

WhatsApp → open the group → tap the group name → **Export chat** → **Without media** →
in the Share sheet pick **Send chat to Recipes**.

WhatsApp hands you a `.zip` containing `_chat.txt`. **Upload it exactly as it is.** The app
sniffs the zip header and unpacks it itself, so there is no need to unzip anything, and the file
extension does not matter.

Then in the app: ⚙️ Settings → 💬 WhatsApp Groups → **Load chats from this folder**.

Re-exporting a chat gives you the *entire* history again, not just the new part — so upload it
under the **same file name** to replace the old one. That is what step 7's `sha` branch is for.

---

## Giving a group a proper name

By default the group label comes from the file name. To use something better — Hebrew, say —
add it to `index.json` once:

```json
[
  { "file": "family-food.zip", "group": "אוכל משפחתי" }
]
```

The file still gets picked up without this; `index.json` only supplies the label now.

---

## When it does not work

| What you see | What it means |
|---|---|
| **401** | Token expired, or wrong. Generate a new one and update step 3. |
| **404** on the PUT | Token has no access to this repo, or Contents write was not granted. |
| **422** | Almost always Base64 line breaks — check step 4 is set to **Line Breaks: None**. |
| **409** | Two uploads raced. Run it again. |
| Upload succeeds, app shows nothing | Tap *Load chats from this folder* again. If still nothing, the file may not be a real WhatsApp export — the app needs the `[date, time] Name: message` shape and says so. |

To check what actually landed, this needs no token and works in Safari:

<https://api.github.com/repos/rozinante2004-hash/tonys-recipes/contents/whatsapp>

That is the same listing the app itself now reads.
