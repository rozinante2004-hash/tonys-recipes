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

## Where things are (12 Nov 2026, late)
- **The narrator is Jon** ("Jon - Relaxed, Deep and Approachable", ElevenLabs voice `Cz0K1kOv9tD8l0b5Qu53`). Tony heard the
  same opening lines by Adam, Jon and John: "Adam and John are talking too fast. They sound sped-up. Only Jon sounds
  natural." (Adam = "Engaging, Friendly and Bright" `s3TPKV1kjDlVtZbl4Ksh`, John `OEHTkiHZj6OczWZHu0Aj`; Hebrew later:
  Nimrod `ZiofZHcEBTn5sRySe5h8`, which needs the v4 models.)
- **The key** is a network secret on Tony's Default cloud environment: host `api.elevenlabs.io`, header `xi-api-key`
  (he entered it in the environment's settings; the secure form could not open in that long session). Its permissions:
  Text to Speech and Voices → Read (not Models). ElevenLabs plan: Starter at the $1 first-month promotion, with the
  commercial licence ("It indeed includes the commercial license").
- **The narration is recorded** in Jon's voice, one request per scene (`eleven_multilingual_v2`, stability 0.5,
  similarity 0.75, `previous_text`/`next_text` for a steady tone), with `/with-timestamps` so every word's time is
  known: 60.9 s of speech (3.6, 9.5, 14.4, 14.2, 10.1, 4.6, 4.7 s for scenes 1–7). With 0.45 s before and 0.65 s after
  each scene the clip runs **68.6 s** — over the 60 s Tony asked for; trimming is his call.
- **The sketch, version 4**, plays that recording (Web Audio), shows each sentence as a caption when it starts, and
  moves the pictures when the words are said ("dead", "vanish", "paste", "tap once", "saved", "servings", "the amounts
  follow", "shopping list", "pantry", "language", "share", "family", "latest version", "computer", "offline"). It is
  the private artifact "Kitchen Notes Clip Sketch" on Tony's Claude account. **Its sources are kept with it** as the
  artifact's files (`src/template.html.txt`, `src/build.js.txt`, `src/narr.json`, `src/rec.py.txt`); the built page
  itself holds the screenshots and Jon's audio (in `NARR`). The screenshots come from `node tests/screen-walk.js <dir>`.
- **The length stays: 69 seconds, nothing cut** (Tony, 12 Nov, on version 4: "It looks good as it is right now in the
  clip.").
- **The English video is made (13 Nov 2026):** `my-kitchen-notes-clip-en.mp4`, 70.1 s, 1080 × 1080, 30 frames a second,
  H.264 + AAC, 10.9 MB — sent to Tony in the session; the same clip plays as the artifact's page (version 5).
  - **Tony's own ten photos** ("please ignore the pics I've sent thus far and use these, which I've made myself";
    "Please feel free to edit the photos as you see fit"): Pickled cucumbers, Turkey Pastrami, Ratatouille, Stuffed
    cabbage, Roast beef, Beef (sliced, criss-cross crust), Pickled cucumbers and tomatoes, Pickled red cabbage and
    cucumbers, Stuffed peppers, Romanesco in cashew Béchamel sauce — in Hebrew "כרובית אלמוגים בבשמל קשיו" (his words).
    Brand names behind two of them are blurred. Photos from the Family app with a BY / BY-SA / CC credit are NOT used
    in a promotion (credit and share-alike); Pixabay / Pexels / Unsplash licences would do, his own are best.
  - **The app's real screens with those photos** come from a made-up kitchen ("Our Kitchen", recipes with plain
    invented ingredients) photographed by `shots.js` (the app served locally; the stand-in account's "Offline mode" and
    "Sign in to sync" lines hidden, as a signed-in kitchen shows neither): the recipe grid on a phone and a computer,
    the Add Recipe menu, a whole recipe and a whole collection as tall pictures the clip scrolls through, and the
    scaling row at ×1 and ×2.
  - **How the video is made** (`render.js`): the page has `__clip.seek(t)` — every CSS animation paused and set to the
    clip's clock — so each of the 2,104 frames is exact; `__clip.soundtrack()` renders Jon's recordings, the tune and
    the effects from the same clock (OfflineAudioContext → WAV); ffmpeg joins them. About 90 seconds to render.
  - The last scene holds 2.2 s after the last word, so the clip is 70 s (Tony approved the 69 s sketch as it was).
- **Sources:** with the artifact as its files (`src/template.html.txt`, `build.js.txt`, `render.js.txt`, `shots.js.txt`,
  `frames.js.txt`, `narr.json`, `rec.py.txt`); Jon's audio and the pictures are inside the built page.
## The Hebrew version (13 Nov 2026)
Tony reviewed the Hebrew script and rewrote parts of it; **these are his words — do not "improve" them.** The narration,
scene by scene, as recorded:
1. ברוכים הבאים ל-My Kitchen Notes. תראו למה כל כך טוב שהגעתם לכאן.
2. לא עוד קישורים למתכונים שהולכים לאיבוד בצ'אטים, או מפסיקים לעבוד בדיוק כשצריך אותם. לא עוד דפים מוכתמים מפוזרים על השיש, ונעלמים.
3. מצאתם מתכון באתר, בסרטון, או בדף ממחברת ישנה? הדביקו את הקישור או צלמו תמונה, הקישו פעם אחת, והוא שמור במטבח שלכם. מאורגן, מלא ושלכם לתמיד.
4. ומנקודה זו, הוא עובד בשבילכם. שנו את מספר המנות, והכמויות מתעדכנות. שלחו את המצרכים לרשימת הקניות. בדקו מה אפשר להכין ממה שכבר יש לכם במזווה. קראו אותו בכל שפה שתרצו.
5. הרכיבו אוספים: ארוחת חג, או הקלאסיקות של סבתא. ושתפו אותם. המשפחה מצטרפת למטבח שלכם, ולכולם תמיד יש את הגרסה העדכנית.
6. בטלפון, בטאבלט, במחשב. אפילו כשאין אינטרנט.
7. My Kitchen Notes. כל המתכונים שלכם, במקום אחד, לתמיד.

On screen (his): scene 2 "בלי קישורים אבודים ובלי פתקים אבודים."; scene 3 "הקלקה אחת, והמתכון שמור במטבח שלכם.", steps
"1 הדבק · 2 הקלק · 3 נשמר"; scene 4 "ומעכשיו הוא עובד בשבילכם."; scene 5 "הרכיבו אוספים. שתפו אותם עם המשפחה ועם החברים.";
scene 6 "בכל מכשיר. גם ללא אינטרנט.", "מסונכרן בכל מקום", "עובד גם ללא אינטרנט"; the last screen "כל המתכונים שלכם. במקום אחד.
לתמיד." and "בהזמנה בלבד. בינתיים" (he confirmed). The rest of the on-screen Hebrew (labels, tiles, family) is the draft he
left unchanged; every text is in the artifact's `src/he.json`. The name is said in English ("Yes. However, I would need
to hear it, to understand how he copes with English and accent."). The paper notes in Hebrew handwriting: "Great".
Open: the narration says "הקישו פעם אחת" while his on-screen words are "הקלקה / הקלק" — asked, not changed.

- **The Hebrew sketch** ("Let's start with a low-budget sketch and progress from there, like we did with the English
  version") is the private artifact "Kitchen Notes Clip Hebrew": **Nimrod** (`ZiofZHcEBTn5sRySe5h8`, model `eleven_v4`,
  `/with-timestamps`, no previous/next text), 58.6 s of speech, 67.9 s in all; the stage is `dir="rtl" lang="he"` with
  Frank Ruhl Libre / Heebo and the handwriting face Gveret Levin; `node build.js he` makes it from the same template
  (`he.json` holds every replaced text, the three paper notes, the extra CSS and the Hebrew phrases the pictures wait
  for). The app's screens in it are still the English ones.
- **After Tony's verdict on Nimrod and the sketch:** the app's screens in Hebrew (the interface in Hebrew, Hebrew recipe
  names — suggested: מלפפונים חמוצים, פסטרמת הודו, רטטוי, כרוב ממולא, רוסטביף, עגבניות כבושות, כרוב אדום כבוש, פלפלים ממולאים,
  כרובית אלמוגים בבשמל קשיו; the collection ארוחת חג; the kitchen המטבח שלנו), the tap positions for the mirrored screens,
  then `node render.js my-kitchen-notes-clip-he.mp4`.

## Afterwards, in the app (Tony, 13 Nov 2026 — not started)
"After the clips are done, I would like to be able to play them from the Help section and also add a link to them in
the testers' invites." To settle with him first: where the two MP4 files live (with the app's own site, about 11 MB
each, or a video site), which clip a person gets (by the app's language), and the invitation's wording. It is an app
change like any other: a version, Self Tests, Help, translations, his yes for the release.
