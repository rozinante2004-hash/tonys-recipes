# Uploading a chat export straight from the iPhone

Goal: **WhatsApp → Export chat → Share → Shortcut → done.** No laptop in the middle.

The export step itself cannot be automated on any platform — WhatsApp has no API for it, and
anything driving WhatsApp Web breaches their terms and gets numbers banned. The *upload*
afterwards can be, and that is what this builds.

**As of v29.5 you only upload the file.** The app lists the folder over the GitHub API, so
`index.json` no longer has to be edited. It is still read, and still does one job: giving a file
a nicer group label than its file name.

> **Prefer to read this away from GitHub?**
> **[upload-guide.html](https://rozinante2004-hash.github.io/tonys-recipes/whatsapp/upload-guide.html)**
> is this same guide as one self-contained file — pictures embedded, works offline, prints tidily.
> Handy open on the iPad, or printed, while you build the Shortcut on the phone.
>
> **Don't fancy this?** There is a simpler route that needs no Shortcut at all:
> **[upload.html](https://rozinante2004-hash.github.io/tonys-recipes/whatsapp/upload.html)** —
> open it on the phone, add it to your Home Screen, paste the token once, pick the file, upload.
> A few more taps per export than the Share sheet, but nothing to build and nothing to go wrong.
>
> **The pictures below are mock-ups, not screenshots** — drawn to match what the Shortcuts editor
> shows so you can compare at a glance. Colours and spacing will differ slightly from your screen;
> the *words and the blue chips* are what to check against.
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

![The Receive action, set to Files](img/01-receive.svg)


If your Shortcuts app does not match even this, skip the whole thing and use the upload page —
see the top of this document. It does the same job and needs no Shortcuts archaeology.

### 2.2 The file name

**5.** Search actions for `Text` → tap **Text**. **6.** Tap inside its box and type the name you
want the file to have in the repo, e.g. `Meat-prep.zip`

> ✅ **Should read:** a yellow **Text** action containing `Meat-prep.zip`

Keep it **plain ASCII** — letters, digits, dashes, and an extension. Hebrew belongs in the group
*label*, not the file name (Part 4).

**7.** Search for `Set Variable` → tap it. **8.** Tap **Variable Name**, type `FILENAME`

> ✅ **Should read:** `Set variable FILENAME to Text`
>
> The word **Text** at the end is a blue chip, not typed — Shortcuts fills it in because the Text
> action is directly above. If it says `Set variable FILENAME to Shortcut Input`, tap that chip
> and choose **Text** instead.

![Text action and Set variable FILENAME](img/02-filename.svg)


### 2.3 The token

**9.** Add another **Text** action → paste your token into it.
**10.** Add another **Set Variable** → name it `TOKEN`

> ✅ **Should read:** `Set variable TOKEN to Text`
>
> The capitalisation is only a label — `Token` works identically to `TOKEN`, as long as you insert
> *that same chip* later. Matching the guide exactly just makes the later steps easier to check.

> ⚠️ **The token is now visible whenever this shortcut is open for editing** — so it is visible in
> any screenshot of this screen. Do not send one to anyone, including me. If one escapes, revoke
> at <https://github.com/settings/personal-access-tokens> and paste a fresh one in. To show
> someone the shortcut, clear this Text action first, screenshot, then paste it back.

### 2.4 Turn the file into text

GitHub's API will not take a raw file. It takes **Base64** — a way of writing any file as plain
letters and digits. That is all this step does.

**11.** Search for `Base64` → tap **Base64 Encode**

> ✅ **Should read:** `Shortcut Input with base64` — **exactly one blue chip**, and it must say
> **Shortcut Input**.
>
> ⚠️ **Check for a second chip.** Shortcuts helpfully drops the *previous* action's output into
> this field, so it very often arrives reading `Shortcut Input  Token  with base64` — with a
> stray **Token** chip alongside. That is wrong twice over: it encodes your token together with
> the file, and then **uploads your token into the public repository** as part of the file's
> contents.
>
> To fix: tap the field, put the cursor after the stray chip, and press **⌫ backspace** until only
> **Shortcut Input** remains. Deleting the whole field and re-inserting **Shortcut Input** from the
> variable bar works too.
>
> The chip you want is the file WhatsApp handed you. Nothing else belongs here.

![Base64 Encode: wrong with two chips, right with one and Line Breaks None](img/03-base64.svg)


**12.** Tap the small **⌄** (or **Show More**) on that action and set **Line Breaks** to **None**

> ✅ **Should read:** the action expands to show `Line Breaks: None`
>
> **This is the single most common failure.** The default chops the text into lines, and GitHub
> answers **422** because a file's contents may not contain line breaks.

**13.** Add a **Set Variable** → name it `CONTENT`

> ✅ **Should read:** `Set variable CONTENT to Base64 Encoded`

---

### 2.5 Ask GitHub whether the file is already there

**First, why this step exists** — this is the part that is genuinely confusing, and it is worth
one paragraph before you tap anything.

GitHub treats *creating* a file and *replacing* a file as two different requests:

- **Creating** — you just send the contents.
- **Replacing** — you must also quote the **`sha`**, an ID GitHub gives the version currently
  stored. It is GitHub asking *"you did look at what's there before overwriting it, didn't you?"*

You do not know in advance which case you are in — the first time you send `Meat-prep.zip` it is a
create, every time after that it is a replace. **So you ask.** You request the file's details:

- **File exists** → GitHub returns its details, including a `sha`.
- **File does not exist** → GitHub returns **404 Not Found**, and there is no `sha`.

That difference — *did I get a `sha` or not?* — is what section 2.6 branches on. Nothing here
uploads anything; this step only asks a question.

A 404 here is **not an error**. It is the expected answer for a new file.

---

**14.** Search for `Get Contents of URL` → tap it

> ✅ **Should read:** `Get contents of` followed by an empty URL box

**15.** Tap the URL box and type this **exactly**, ending with the slash:

```
https://api.github.com/repos/rozinante2004-hash/tonys-recipes/contents/whatsapp/
```

**16.** With the cursor still at the end, look **just above the keyboard**. There is a bar of
suggestions — your variables live there. Tap **FILENAME**.

> ✅ **Should read:**
> `Get contents of https://api.github.com/repos/rozinante2004-hash/tonys-recipes/contents/whatsapp/FILENAME`
>
> **FILENAME must be a blue chip**, not black text. If it is black you typed the word instead of
> inserting the variable — the shortcut will then ask GitHub for a file literally called
> "FILENAME", get a 404, and you will spend an hour suspecting your token. Tap the word, delete
> it, and pick it from the bar above the keyboard instead.
>
> If you cannot see the variable bar, tap the URL box once more — it appears only while that field
> has the cursor.

![Get contents of URL with the FILENAME chip and Method GET](img/04-get-url.svg)


**17.** Tap **Show More** on this action to reveal Method, Headers and Request Body.

**18.** Set **Method** to **GET**

> ✅ **Should read:** `Method: GET`
>
> (It is usually GET already.)

**19.** Under **Headers**, tap **Add new field**. Key: `Authorization`. For the value, type
`Bearer ` — **including the space after "Bearer"** — then insert the **TOKEN** variable from the
bar above the keyboard.

> ✅ **Should read:** `Authorization` → `Bearer TOKEN`
>
> with **TOKEN** as a blue chip. The space matters: `BearerTOKEN` is rejected as a **401**, which
> looks exactly like a bad token and sends you off regenerating one that was fine.

**20.** **Add new field** again. Key: `Accept`. Value: `application/vnd.github+json`

> ✅ **Should read:** `Accept` → `application/vnd.github+json`
>
> This one is plain text — no variable.

![The two headers](img/05-headers.svg)


**21.** Leave **Request Body** alone. A GET sends nothing.

**22.** Search for `Get Dictionary Value` → tap it. Set **Key** to `sha`.

> ✅ **Should read:** `Get sha from Contents of URL`
>
> The **Contents of URL** chip is the answer from step 14. If it says something else, tap it and
> choose **Contents of URL**.

**23.** Add a **Set Variable** → name it `SHA`

> ✅ **Should read:** `Set variable SHA to Dictionary Value`

**At this point the shortcut, top to bottom, should look like this:**

![The whole shortcut so far — nine actions](img/07-full.svg)

In text, if you prefer to compare that way:

```
Receive Files from Share Sheet
Text                         → Meat-prep.zip
Set variable FILENAME to Text
Text                         → github_pat_…
Set variable TOKEN to Text
Base64 Encode Shortcut Input   (Line Breaks: None)
Set variable CONTENT to Base64 Encoded
Get contents of https://api.github.com/…/whatsapp/FILENAME
Set variable SHA to Dictionary Value
```

Nine actions. If yours matches, 2.6 is the last part.

---

### 2.6 Upload it

**24.** Search for `If` → tap it. Three rows appear: **If**, **Otherwise**, **End If**.

**25.** Tap the blue field after **If** and choose **SHA**. Tap the condition and choose
**has any value**.

> ✅ **Should read:** `If SHA has any value`
>
> In plain English: *"if GitHub gave me a sha, the file is already there."*

![The If / Otherwise / End If block with both upload actions](img/06-if-block.svg)


Now one upload action in each half. They are **identical except for one field**.

**26.** With the cursor between **If** and **Otherwise**, add **Get Contents of URL**. If it lands
in the wrong place, press and hold it and drag it between those two rows.

**27.** URL: the same as step 15 — type the address, then insert **FILENAME** from the bar.

**28.** **Show More** → **Method: PUT**

**29.** Headers: the same two as steps 19–20 (`Authorization` → `Bearer TOKEN`, and `Accept`).

**30.** **Request Body: JSON**, then **Add new field** three times, each of type **Text**:

| Key | Value |
|---|---|
| `message` | `Update chat export` (any text — it becomes the commit message) |
| `content` | insert the **CONTENT** variable |
| `sha` | insert the **SHA** variable |

> ✅ **Should read**, inside the If branch:
> `Get contents of https://…/whatsapp/FILENAME` with `Method: PUT`, two headers, and a JSON body
> of three fields: `message`, `content`, `sha`

**31.** Now the other half. Between **Otherwise** and **End If**, add another
**Get Contents of URL** and set it up **exactly the same way** — *but with only two body fields:*
`message` and `content`. **No `sha`.**

> ✅ **Should read**, inside the Otherwise branch: the same action, JSON body of **two** fields
>
> Sending an empty `sha` is an error, which is the entire reason this is split in two. If you find
> yourself wondering why you are building the same thing twice — that is why.

### 2.7 Tell yourself it worked

**32.** After **End If**, add **Show Notification** with text `Uploaded to Recipes`

> ✅ **Should read:** `Show notification Uploaded to Recipes`

Worth having: without it, a silent failure looks exactly like success.

**33.** Tap the shortcut's name at the top → **Rename** → `Send chat to Recipes`

### 2.8 Test it before you need it

Tap **▶** (bottom right). With no file shared in, it should fail at the Base64 step — that is
fine and expected. The real test is Part 3.

Better first test: share **any small file** to it from the Files app. If you get *"Uploaded to
Recipes"*, check it landed:

<https://api.github.com/repos/rozinante2004-hash/tonys-recipes/contents/whatsapp>

Then delete the test file from GitHub in a browser.

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
