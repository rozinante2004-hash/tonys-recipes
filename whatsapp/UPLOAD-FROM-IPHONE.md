# Uploading a chat export straight from the iPhone

Goal: **WhatsApp → Export chat → Share → Shortcut → done.** No laptop in the middle.

The export step itself cannot be automated on any platform — WhatsApp has no API for it, and
anything driving WhatsApp Web breaches their terms and gets numbers banned. The *upload*
afterwards can be, and that is what this builds.

**As of v29.5 you only upload the file.** The app lists the folder over the GitHub API, so
`index.json` no longer has to be edited. It is still read, and still does one job: giving a file
a nicer group label than its file name.

> **Don't fancy this?** There is a simpler route that needs no Shortcut at all:
> **[upload.html](https://rozinante2004-hash.github.io/tonys-recipes/whatsapp/upload.html)** —
> open it on the phone, add it to your Home Screen, paste the token once, pick the file, upload.
> A few more taps per export than the Share sheet, but nothing to build and nothing to go wrong.
>
> **Written against the Shortcuts app as it looks in 2026**, and corrected against real
> screenshots. The **ⓘ is in the BOTTOM toolbar** — see 2.1. If your screen still doesn't match a
> step, say so rather than working around it; the layout moves between iOS versions and guessing
> at it has already cost two rounds here.

---

## Part 1 — Get a token first

Do this on the phone, in Safari, so you can paste the token straight into the Shortcut.

1. Go to <https://github.com/settings/personal-access-tokens/new>
2. **Token name:** `iPhone chat upload`
3. **Expiration:** pick a date you'll remember. When it lapses the Shortcut returns 401 —
   annoying, not dangerous.
4. **Repository access:** tap **Only select repositories** → choose
   `rozinante2004-hash/tonys-recipes`
5. **Permissions** → **Repository permissions** → find **Contents** → set it to
   **Read and write**. Leave everything else alone.
6. **Generate token**, then **copy it**. It is shown once and never again.

Paste it somewhere you can get at in a moment — Notes will do, and you can delete it after.

**Treat it like a password.** It goes into the shortcut in step 9, where it is visible to anyone
who opens the shortcut for editing — so it is also visible in any screenshot of that screen. If
one ever escapes, revoking and regenerating takes a minute:
<https://github.com/settings/personal-access-tokens>.

---

## Part 2 — Build the Shortcut

Open **Shortcuts** → **+** (top right) to create a new one. You should be on the screen from
your screenshot: the name at the top, "Add actions from below", and a search box.

### 2.1 Make it appear in the Share sheet

**The ⓘ button is in the BOTTOM toolbar**, not at the top. While editing a shortcut the bar along
the bottom reads `↶  ↷  ⓘ  ⬆  ▶` — undo, redo, **info**, share, run. Tap the **ⓘ** in the middle.

Two things that will otherwise waste your time:

- The **⌄ chevron beside the shortcut's name** is *not* it. That menu only has Rename, Choose
  Icon, Duplicate, Move and Add to Home Screen.
- **Searching the actions for "Receive" finds nothing**, because in this version it is not an
  action you can add. It is purely a setting, and the "Receive … from Share Sheet" row appears at
  the top of your shortcut *by itself* once the setting is on.

So:

1. Tap **ⓘ** in the bottom toolbar
2. Turn on **Show in Share Sheet**
3. Close the panel. A row now sits at the top of the shortcut reading something like
   *"Receive Text and images input from Share Sheet"*
4. Tap the blue **Text and images** in that row → **deselect everything**, select **Files** only

If your Shortcuts app does not match even this, skip the whole thing and use the upload page —
see the top of this document. It does the same job and needs no Shortcuts archaeology.

### 2.2 The file name

5. Search actions for `Text` → tap **Text**
6. Tap the empty text box and type the file name you want in the repo, e.g.
   `family-food.zip`

   Keep it **plain ASCII** — letters, digits, dashes. A Hebrew file name needs percent-encoding
   in the URL and is not worth the trouble. Hebrew belongs in the *group label*, see Part 4.

7. Search actions for `Set Variable` → tap **Set Variable**
8. Tap **Variable Name** and type `FILENAME`

   (The Text action's output flows into it automatically. Naming variables is the difference
   between a shortcut you can read next year and one you can't.)

### 2.3 The token

9. Add another **Text** action. Paste your token into it.
10. Add another **Set Variable**, name it `TOKEN`

> ⚠️ **The token is now plainly visible whenever this shortcut is open for editing.**
> That is unavoidable — Shortcuts has nowhere private to keep it — but it means a screenshot of
> the editor is a screenshot of your credentials. Do not send one to anyone, including me, and if
> you already have, revoke the token at
> <https://github.com/settings/personal-access-tokens> and paste a fresh one in.
>
> If you need to show someone the shortcut, delete the text from this action first, screenshot,
> then paste it back.

### 2.4 Encode the file

11. Search actions for `Base64` → tap **Base64 Encode**
12. Check its input says **Shortcut Input**. If it says something else, tap it and choose
    **Shortcut Input**.
13. Tap the word **Encode** (or the ⌄ on the action) to show its options and set
    **Line Breaks: None**

    **This one matters.** The default inserts line breaks and GitHub rejects the upload with a
    422. It is the single most likely thing to go wrong.

14. Add a **Set Variable**, name it `CONTENT`

### 2.5 Ask GitHub whether the file already exists

15. Search actions for `Get Contents of URL` → tap it
16. In the URL box, type this, and where `[FILENAME]` appears insert the **variable**, not the
    literal text:

    `https://api.github.com/repos/rozinante2004-hash/tonys-recipes/contents/whatsapp/`

    then tap the **variable bar just above the keyboard** and pick **FILENAME**.

17. Tap **Show More** on that action:
    - **Method:** GET
    - **Headers** → **Add new field** twice:
      - Key `Authorization`, Value: type `Bearer ` (with the space) then insert the **TOKEN**
        variable
      - Key `Accept`, Value `application/vnd.github+json`

18. Search actions for `Get Dictionary Value` → tap it
    - **Get:** Value
    - **Key:** `sha`
    - **In:** the output of step 15 (it should already say *Contents of URL*)
19. Add a **Set Variable**, name it `SHA`

    For a file that does not exist yet this request returns 404 and `SHA` comes out **empty**.
    That is expected — it is exactly how the next step tells a new file from an existing one.

### 2.6 Upload

20. Search actions for `If` → tap **If**
21. Set it to: **If** `SHA` **has any value**

    Tap the first blue field and choose the **SHA** variable; tap the condition and choose
    **has any value**.

You now have an **If** / **Otherwise** / **End If** block. Put one upload action in each half.

**Inside "If"** (the file already exists — replace it):

22. Add **Get Contents of URL**, dragging it between **If** and **Otherwise**
    - **URL:** same as step 16 (base URL + **FILENAME** variable)
    - **Show More** → **Method: PUT**
    - **Headers:** the same two as step 17 (`Authorization`, `Accept`)
    - **Request Body: JSON**
    - **Add new field** three times, all type **Text**:
      - `message` → `Update chat export` (any text; it becomes the commit message)
      - `content` → insert the **CONTENT** variable
      - `sha` → insert the **SHA** variable

**Inside "Otherwise"** (brand new file):

23. Add another **Get Contents of URL**, between **Otherwise** and **End If**
    - Identical to step 22, **except there is no `sha` field** — only `message` and `content`.

    Sending an empty `sha` is an error, which is the entire reason for the If.

### 2.7 Tell yourself it worked

24. After **End If**, add **Show Notification** → text `Uploaded to Recipes`

    Worth having. Without it, a silent failure looks exactly like success.

25. Rename the shortcut (tap the name at the top) to something you'll recognise in the Share
    sheet — **Send chat to Recipes**.

---

## Part 3 — Use it

1. WhatsApp → open the group → tap the group name at the top
2. Scroll down → **Export Chat** → **Without Media**
3. In the Share sheet, pick **Send chat to Recipes**
4. In the app: ⚙️ Settings → 💬 WhatsApp Groups → **Load chats from this folder**

WhatsApp gives you a `.zip` containing `_chat.txt`. **Upload it exactly as it is** — the app
sniffs the zip header and unpacks it itself. The file extension does not matter.

Re-exporting a chat gives you the **entire** history again, not just the new part — so upload it
under the **same file name** to replace the old one. That is what the `sha` branch is for.

---

## Part 4 — Giving a group a proper name

By default the group label comes from the file name. For something better — Hebrew, say — add it
to `index.json` once:

```json
[
  { "file": "family-food.zip", "group": "אוכל משפחתי" }
]
```

The file is picked up without this. `index.json` only supplies the label now.

---

## When it doesn't work

| What you see | What it means |
|---|---|
| Shortcut isn't in the Share sheet | The **Receive … from Share Sheet** action isn't first, or its "what" isn't set to **Files**. Also check WhatsApp's sheet — scroll right and tap **More**. |
| **401** | Token expired or mistyped. Check the `Authorization` value is `Bearer ` **with a space** then the variable. |
| **404** on the upload | Token can't reach this repo — recheck *Only select repositories* and *Contents: Read and write*. |
| **422** | Almost always Base64 line breaks. Step 13. |
| **409** | Two uploads raced. Run it again. |
| Uploads fine, app shows nothing | Tap *Load chats from this folder* again. If still nothing, the file may not be a real export — the app needs the `[date, time] Name: message` shape and will say so. |

To see what actually landed — no token needed, works in Safari:

<https://api.github.com/repos/rozinante2004-hash/tonys-recipes/contents/whatsapp>

That's the same listing the app itself reads.

---

## Two things worth deciding first

**The token lives on your phone.** Scoped to one repo with only Contents write, the worst someone
with your unlocked phone could do is edit this repository. That is why it is a fine-grained token
rather than a classic one.

**This repository is public, so the chats are public.** That is equally true of the laptop route —
this changes nothing — but it is worth a conscious decision before uploading a family group. If
you'd rather they weren't, ⚙️ Settings → 💬 WhatsApp Groups → *Import exported .txt files* keeps
them in the browser and uploads nothing.
