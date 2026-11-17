# The farm animals' voices (v39.93, 17 Nov 2026)

Each of the 14 farm visitors speaks the ten default sayings in its own recorded voice. The voices were chosen by Tony
himself in ElevenLabs' Voice Library; the recordings are in `sounds/farm-1/<animal>-<n>.mp3`, `<n>` being the saying's
place in `FARM_SAYINGS_DEFAULT` (0 "Ouch!" … 9 "Hands off, I'm free-range!").

## How it came about
- 16 Nov: Tony asked whether the animals could use ElevenLabs. Proposed: record each saying once per animal and ship
  the files; a cast with accents to suit the names, or one voice.
- 17 Nov, Tony's choices: a cast, each animal its own voice and accent; the window's voice choice follows the cast;
  I make samples and he picks. I auditioned 41 library voices (by accent) — Tony: "Most of them have no character and
  are rather lame. I will pick the voices myself." Every voice that speaks through the API is added to his My Voices;
  the 42 I had used were removed at his request (trap in `docs/history/traps.md`).
- Tony's cast, and "Please use the newer model (V4)":

| Animal | ElevenLabs voice (in Tony's My Voices) | voice_id | Kind (device fallback) |
|---|---|---|---|
| Clementine the cow | Delphi – Transformational Narrator | 6HXfTcSnxaoT6uM4pTRP | female |
| Dolly the sheep | Canny – Versatile | lYz97gZSO1IVncLkczs4 | female |
| Percy the pig | LIAM DALE (British Male 60's) | w2ZdKT3ghAOcMRbpjC3u | male |
| Henrietta the hen | Grandma Rachel – Old Lazy Storyteller | 0rEo3eAjssGDUCXHYENf | female |
| Gerald the goat | Rusty Malone – Deep & Raspy | 507tTFX0IPtqFzGd1CAL | male |
| Duncan the duck | Elmoe – Silly & Energetic | 1kvnzrSTos1KbmLKMLCC | male |
| Hamish the horse | Potato – Earthy & Rooted | 0pkdtmrxitYBWv6q9NJO | male |
| Dennis the donkey | Kavian R – Chill, Relaxed Character | kNQlrGyEXK0N2D2pTcmn | male |
| Reginald the rooster | Gravel Midnight – Deep Character Voice | M5E055lOUxMi0kJpGyE9 | male |
| Tabitha the turkey | Ivanna – Upbeat Promos | 0S5oIfi8zOZixuSj8K6n | female |
| Gertrude the goose | Blondie – Children's Storyteller | XXphLKNRxvJ1Qa95KBhX | female |
| Rosie the rabbit | Chutki – Cute Kids Cartoon Character | Jr72SE8p9OcJmr8hyX0D | child |
| Bramble the sheepdog | Flint – Commanding Presence | qAZH0aMXY8tw1QufPN0D | male |
| Lorenzo the llama | Jim – Cockney London | sQGQZsvZ9uPuxtTy1uNh | male |

Percy: two voices in Tony's list are called Liam; both were recorded and Tony chose "Liam A (LIAM DALE)".

## How they are made
- `POST /v1/text-to-speech/<voice_id>?output_format=mp3_44100_128`, body `{"text": <saying>, "model_id": "eleven_v4",
  "seed": 11}` (no voice settings: each voice's own), one request per saying; the key is added by the session's proxy
  (header `xi-api-key: placeholder`). 150 recordings, 2,460 characters (credits).
- Each file: silence trimmed at both ends, loudness evened to −16 LUFS (`loudnorm=I=-16:TP=-1.5:LRA=11`), a 15 ms
  fade-in, mono 44.1 kHz 64 kbps.
- Tony heard all of them on a listening page (each animal's drawing from the app; Play all 10; ✎ to ask for a retake)
  and asked for no retakes.

## Other languages (v39.95)
The owner fills in each language's sentences in the farm window (Language selector, one slot per English sentence);
each language is its own document, `i18n/_farm_<lang>`. A person hears their app language's filled-in sentences,
else English. Until a language is recorded, the device's own voice for it says them. Next (Tony, 17 Nov): Hebrew in
"all 8 Hebrew voices in ElevenLabs … male voices to male characters and female voices to female characters randomly",
once he has filled the Hebrew slots in; the files will go to their own folder and `FARM_RECORDED.he` will name them.
Every voice used through the API is added to his My Voices (he was told beforehand).

**Hebrew pronunciation (Tony, 17 Nov 2026):** "הי is pronounced as Hi, while היי is pronounced as Hey. I'm sure we'll
find more to fix later." The text the voice reads may differ from what the bubble shows (as in the instructional
clip: vowel marks or a respelling in the spoken text only); every such fix is listed here.
| Written | Said |
|---|---|
| הי | "Hi" |
| היי | "Hey" |

## Recording a new saying or a new voice
Record it the same way, for every animal, into a NEW folder (`sounds/farm-2/…`) with all the files, and point
`FARM_SOUNDS` and `tools/build.js` at it: the service worker keeps every `sounds/…mp3` for ever once heard, so a file
must never change under the same name. A saying the owner adds in the farm window has no recording until then; the
device's own voice of the animal's kind says it.
