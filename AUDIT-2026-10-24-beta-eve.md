# Beta-eve audit — 24 October 2026 (v38.89 → v38.90, v38.91)

Tony, 24 Oct: "As tomorrow I will be sending out the Beta invitations, let's run an audit of the application that
covers all aspects. Once done, please proceed to executing all relevant fixes and changes, and save the ones you
need my feedback for for last."

## How it was checked

- **A new tester's first half hour, end to end**, on the beta build against the Firebase emulators, with the copy
  **by invitation only** exactly as tomorrow (`config/founding` closed, two invited addresses):
  - Phone (390 × 844) and computer (1366 × 860).
  - In English and in Hebrew (a phone set to Hebrew, the way most testers' phones will be).
  - The route: sign-in, the kitchen rules, the welcome, naming the kitchen, the first screen, the beta welcome, a
    website import, the example recipes, a recipe, the editor, menus, Help, search, 💬 a note, 👥 Family Access, an
    invitation link, the family chat, link requests, chats with kitchens, the identifier, sounds, 📡 Sync Health,
    backups, the pantry, About, the tour, a bold word saved and shown.
  - Screenshots were looked at one by one. The app's own "not translated yet" list was read at the end of each walk.
- **An uninvited address** (earlier today): told clearly, signed out on "Not now"; nothing founded.
- **The translations, as the release job sees them**: the app's own phrase collection run in a hidden browser,
  compared with the published Hebrew file — what tomorrow's job will translate.
- **Database rules** for the newer collections (`talk`, `talkIds`, `linkTalk`, `links`, `requestLog`).
- **Reads**: what the newer live listeners cost.
- **Privacy**: the Statement against the chats; the public translation files for names and addresses.
- **The invitation e-mail** (both languages) against what the app now does.
- **Every local suite**: 414 Self Tests pass in English, in Hebrew, with preferences, and on the built test copy.
  Phone fit, contrast (dark and light), phone chrome, close-button-in-view and the Worker checks also pass.

## Found and fixed

### v38.90 (released today)

1. **Hebrew stopped at the door.** On a Hebrew phone, most of the first hour was in English, although the
   translations existed. There were four causes:
   - **Phrases with a name or a number** ("Welcome to …", "Invite someone to …", "Shared · …", every
     "Saved 3 recipes") were only translated on a device that had made the language. The shapes are now taken
     from the translations themselves, so every phone gets them.
   - **Questions in a window** (the welcome, "What shall we call your recipe collection?", the invitation link,
     the identifier, the tour) were marked like a recipe's own words, so they were never translated. They are
     now translated as they appear.
   - **Hints inside text boxes** ("Your note", "Write a message…") were skipped together with the box. Now
     translated; what someone types never is.
   - **The language offer** waited hidden under the sign-in screen and appeared only after the kitchen rules. It now
     comes first, so the sign-in screen and the kitchen rules are already in Hebrew.
   - Also: the first screen of an empty kitchen, the chats with other kitchens, the tour, the recipe badge's words
     and the "Pasta" meal type were never collected for translation. They are now: **55 new phrases**, translated by
     the job that runs after this release.
2. **Kept out of the translations:**
   - **The signed-in person's name.** The status line had filed "☁️ <name>" as a phrase. The owner's own name sat
     in every language's public file this way. It is now kept apart, and the after-release job removes those
     entries (four per language).
   - **A recipe's own words** in the import previews.
   - **Chat times** (a new phrase for every minute).
   - **Avatar letters.**
3. **Sync Health on a brand-new kitchen** said "unrecognised — shared/meta is missing or damaged" in red, and
   "Last successful sync: never". Now it says "new — nothing saved to the cloud yet", and an empty kitchen read
   successfully counts as a sync.
4. **B with nothing selected, then Save** left a step reading "****". Empty marks are now dropped on save. Two bold
   words next to each other stay two; a first version of this fix would have merged them, and was caught by its
   own test.
5. **A "-" for preparation time or servings** was shown as "⏱ -". It is now hidden.
6. **Imported recipes got a random emoji** (an avocado for lemon pasta). They now get one that fits the name
   (English or Hebrew), then the meal type.
7. **Sync Health values with a note under them** ("3 of 50,000") could not be translated. Now they can.

### v38.91

8. **A family-chat message showed the name typed into the message**, which any member could set to someone else's.
   It now shows the name from the household's member list.
9. **"about under $0.01"** in Sync Health now reads "under $0.01".
10. **The Help** now says that a phone in another language is asked on the sign-in screen. It also describes the
    owner's 👀 Seen / ✅ Done / 🗑 Delete selected for several notes or error reports.
11. **The recreation prompt** has the translation rules learnt today and a new kitchen's first hour.

## Checked and fine

- **Rules for the household chat:**
  - Only members write.
  - Each message is signed with the writer's own account.
  - A message to one person is read only by the two of them.
  - Nothing can be edited afterwards.
  - The owner deleting the household also removes the private messages.
  - Chats between kitchens are signed with the kitchen's name, never a person's.
- **Reads:** the family chat listens with three small queries per open app, and only in a kitchen with more than one
  member. For 20 testers this is far inside the free allowance, and the usage alerts already watch it.
- **The Privacy Statement** (1.7) covers both chats: who reads what, and that kitchens see only a kitchen's name.
- **The invitation** (English and Hebrew) matches the app:
  - Sign in with the invited address.
  - Start a collection.
  - Invite family with the share button at the top.
  - 💬 at the bottom left.
  - The iPhone shortcut and the computer extension are offered.
- **A phone in English** sees no change: no language question, nothing recorded as untranslated.
- **No page errors** in any walk. The only console lines were the test harness's own (blocked service worker,
  refused wake lock, a request the test itself cut off).

## Watch during the beta

- **The Hebrew of the 55 new phrases** arrives with the after-release job (Actions → "Translate new phrases"), then
  "Publish languages" within about ten minutes. Until then those phrases show in English.
- **Chat history grows** and each open app reads it whole. Fine for weeks of testing. If a kitchen chats a lot, a
  limit (the last 200 messages) is a small change.
- **Tester names** never reach the translations now (see 2), but a tester's device still keeps its own list of
  untranslated phrases. That list is only ever used by the owner's "Finish translating", on the owner's own device.

## Needs Tony (last)

1. **WhatsApp alerts (CallMeBot), tonight.** A reminder comes at 20:25. Steps:
   1. Open https://www.callmebot.com/blog/free-api-whatsapp-messages/.
   2. Send the bot's number "I allow callmebot to send me messages".
   3. When the key arrives, add the secrets WHATSAPP_PHONE and WHATSAPP_KEY at
      https://github.com/rozinante2004-hash/tonys-recipes/settings/secrets/actions/new.
   4. I then redeploy the Worker
      (https://github.com/rozinante2004-hash/tonys-recipes/actions/workflows/deploy-worker.yml), and you press
      ⚙️ → 👑 App owner → 📲 WhatsApp alerts → Send me a test alert.

   Nothing else depends on it: alerts still come by e-mail.
2. **Sending the invitations:** ⚙️ → 👑 App owner → ✉️ Invite testers, choose **English** or **עברית** for each
   group, and paste the addresses. Only the addresses in To can start a kitchen.
3. **From tomorrow (Sunday 25 Oct) every release waits for your yes**, as agreed.
