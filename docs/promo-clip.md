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
3. מצאתם מתכון באתר, בסרטון, או בדף ממחברת ישנה? הדביקו את הקישור או צלמו תמונה, הקליקו פעם אחת, והוא שמור במטבח שלכם. מאורגן, מלא ושלכם לתמיד.
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
The narration first said "הקישו פעם אחת"; asked, Tony: "Yes. Use הקליקו instead" — scene 3 was recorded again.
His verdicts: Nimrod "Yes. His voice is excellent"; the Hebrew recipe names "Fine"; "The Hebrew clip sounds great. We
can progress with it." 

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

- **The Hebrew video is made (13 Nov 2026):** `my-kitchen-notes-clip-he.mp4`, 68.2 s, 1080 × 1080, 10.2 MB, sent to Tony
  with a download card (as the English one was, again: `SendUserFile` with `display: "attach"` — the first card offered
  no download). The app's screens in it are the app in Hebrew (`node shots.js photos/web shots-he he`: the interface
  language set to Hebrew, Hebrew recipes, the kitchen "המטבח שלנו", the collection "ארוחת חג"); the close-up finds
  "Import from URL" from where the app drew it (`rects.json` → `--ox/--oy/--hx…` on `.zoom`), so it is right in both
  directions; the window's own ✕ is hidden for the servings close-up (in a right-to-left screen it floats over it).
  Nimrod's recordings are about 5.5 dB quieter than Jon's: `he.json` has `voiceGain` 1.85 and everything passes one
  limiter (`A.out`), so the Hebrew clip is about as loud as the English one (mean −18.4 dB against −16.8 dB).
  The English MP4 Tony approved ("The clip looks great!") was NOT rendered again after these changes.

## In the app
- **v39.72 (on Test, 13 Nov 2026): the in-app player.** Tony approved the Hebrew clip ("looks great and sounds great")
  and said where it goes: "The Hebrew clip should be linked if the interface language is Hebrew. For all other
  languages link the English version. No point in linking both for everyone. Link it in the "💬 Ask About the App"
  modal. Let's start with creating the in-app player." The two MP4s and their stills are `media/my-kitchen-notes-clip-
  en|he.mp4|.jpg` in the repository; a new render of a clip replaces its file there (and its still: the frame at 3.6 s).
- **v39.73 (on Test, 14 Nov 2026): the public page and the invitation's link.** `clip.html` plays the clip for
  someone without the app (English; `?lang=he` for the Hebrew clip); the testers' invitation links to it in the
  invitation's language. Details: `docs/history/2026-11.md`, v39.73.
- Next, on his word: other sources in the player (YouTube, a recipe's source clip).

## The first frame is the logo (14 Nov 2026)
Tony, with a WhatsApp screenshot of the two files he had sent: "when sending the clips, there is nothing but a blank
square before starting playback. I would like them to present our logo instead of a blank square." A chat shows a
video's first frame; scene 1 used to fade in from nothing, so that frame was the empty background over the caption.
- **The template:** scene 1's logo has the class `open` instead of `pop`, takes `{{iconbig}}` (`icons/icon-512.png`,
  so it is sharp when large) and runs `@keyframes settle`: for the first 0.3 s it sits in the middle of the picture
  at 2.6 times its size, then moves into its place by 1.05 s. `openAt()` measures where "the middle" is from where
  the logo ends up (in the stage's own units, so it holds at any size and in both directions) — after the fonts are
  in, and again in `__clip.capture()`. Nothing else in the clip changed; the chime and the narration start as before.
- **The files:** only the opening was made again, so that what Tony approved stays what he approved. `render-open.js`
  photographs the first 250 frames (8.33 s — exactly the approved file's first group of pictures; its key frames are
  every 250 frames) and encodes them as `render.js` does; `splice.sh <en|he>` then joins that opening to the approved
  file's own picture from frame 251 on (`ffmpeg -f segment -segment_frames 250`, then the concat demuxer, `-c copy`)
  and to the approved file's own sound (`-c copy`). Checked for both: the same frame count and length, no decode
  error, every frame 1/30 s apart, every frame after the 250th identical to the approved file's, the sound identical;
  the first 250 differ only in the opening second (after it, about 46 dB against the approved encode — the same
  pictures, encoded again). A whole new render of the English clip would NOT do: the template's close-up in scene 3
  moved a little since the English file was approved (41 dB there), so splice, do not re-render.
- The stills in `media/` (the frame at 3.6 s) did not change. The two new files replaced the old ones in `media/`.
  The files as Tony first approved them (the input to `splice.sh`, its `approved/` folder) are `media/*.mp4` at commit
  64d974a. The template, `build.js`, `render-open.js` and `splice.sh` are stored with the clips' pages (the two
  artifacts, under `src/`), as the other sources are.

## What Tony asked for, in his words (13 Nov 2026)
"After the clips are done, I would like to be able to play them from the Help section and also add a link to them in
the testers' invites." And, 13 Nov: "When saying that I would like to play it from Help, I mean to create some kind of
an in-app player. We could use it to play other sources as well, like youtube and other clips from the source field.
We will address it indeed later as it is an app change." Where the files live: "If the clip is playable without having
to install the app, then the app's own site is fine. However, if installing the app is mandatory for the clip to be
viewable, then it cannot be used as a marketing tool" — so: the two MP4 files on the app's own site, with a small
public page that plays them in any browser (no install, no sign-in; outside the app's sign-in gate), linked from the
invitations; and an in-app player window (the clips by the app's language; later YouTube and a recipe's source clip).
Still to settle: the invitation's wording. It is an app change like any other: a version, Self Tests, Help,
translations, his yes for the release.
