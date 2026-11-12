# The promotional clip — notes (started 12 Nov 2026)

Tony asked for a 30–60 second infographics clip, narrated by a pleasant male voice, that promotes the app and shows a
new user why they chose well. A new session remembers nothing: read this first before touching the clip.

## Decisions so far (Tony's words where quoted)
- **Script C, "Welcome to your kitchen"** (about 60 s) — "I also like C the most." The narration, sentence by sentence:
  1. Welcome to My Kitchen Notes. Here's why you'll be glad you came.
  2. No more recipe links lost in your chats, or dead when you finally need them. No more stained paper notes that
     clutter the counter, and vanish.
  3. Found a recipe on a website, in a video, or on a page of an old notebook? Paste the link or take a photo, tap
     once, and it is saved in your kitchen. Tidy, complete, and yours for good.
  4. Then it works for you. Change the servings, and the amounts follow. Send the ingredients to your shopping list.
     Ask what you can make with what's in the pantry. Read it in your own language.
  5. Build collections: a holiday dinner, or grandma's classics. And share them. Your family joins your kitchen, and
     everyone always has the latest version.
  6. On your phone, your tablet, your computer. Even offline.
  7. My Kitchen Notes. All your recipes, in one place, for good.
- **Pictures:** the app's own logo, colours (terracotta, cream, warm brown), fonts (Playfair Display, DM Sans, Heebo)
  and real screens, with a made-up kitchen (`tests/screen-walk.js` makes them: "Sample Kitchen", "Cook One"). Plain
  icons and "your chats" — no other company's logo. The finished clip gets real food photos (Tony's own) and close-ups
  of the buttons being tapped. Never a web page's photo (CLAUDE.md, Decisions).
- **The paper notes** "should be crammed with small handwriting." Done in the sketch (three handwritten recipes).
- **The last screen:** the logo, "All your recipes. One place. For good.", mykitchennotes.community, and
  "By invitation only. For now" (his wording).
- **Language:** English first; "Once it is final we could translate it to Hebrew, and possibly other languages later."
- **Shape:** "It should fit both phones and PC screens" — square.
- **Music and sound effects:** made by us (synthesised), no rights to clear — "If you do it yourself it's fine."
- **The voice: ElevenLabs** (Tony, 12 Nov: "Let's go with Elevenlabs"). He listened: in English, Conversational
  voices rather than Narration — he liked **Adam, Jon and John**; in Hebrew **Nimrod** "sounds rather good". Azure's
  Hebrew "sounds artificial and robotic." Prices he saw on their site: Starter $1 for the first month as a promotion
  (30k credits a month), then $11 a month (121k), the highest $99. The API is at api.elevenlabs.io (header
  `xi-api-key`). The key goes in the session's secure form, never in the chat or the repository.

## Where things are
- **The sketch** (a page that plays: captions, the device's computer voice, our own tones) was published as a private
  artifact on Tony's Claude account, "Kitchen Notes Clip Sketch" (version 2). Tony: "As sketches go, this is a nice
  one :-)" and "Let's progress with it." Its source was in the session's scratchpad (not kept); the artifact holds the
  built page and can be read back from his artifacts list.
- **Next:** Tony opens the ElevenLabs account and makes an API key; the session asks for it with the secure form
  (which also allows the host). Then: one line read by Adam, Jon and John for him to choose by ear; the full
  narration per sentence; the clip rebuilt around the real timings; a video file (square) at the end. Hebrew after
  the English is final.
