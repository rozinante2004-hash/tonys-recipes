# The farm animals' voices (v39.93, 17 Nov 2026)

Each of the 14 farm visitors speaks the ten default sayings in its own recorded voice. The voices were chosen by Tony
himself in ElevenLabs' Voice Library; the recordings are in `sounds/farm-1/<animal>-<n>.mp3`, `<n>` being the saying's
place in `FARM_SAYINGS_DEFAULT` (0 "Ouch!" … 9 "Hands off, I'm free-range!"). Since v39.96: `sounds/farm-2/`,
the first and last as Tony rewrote them (below).

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

## The two rewritten English sayings (v39.96, 18 Nov 2026)
Tony rewrote the first and last sayings in the farm window — "Ouch! Quit it!" (was "Ouch!") and "Hands off, I'm
free-range!!" (was "…free-range!") — and asked: "Please record again so all the recorded sentences match what is
written". Both were recorded again in every animal's voice (Percy: LIAM DALE), the same way (V4, seed 11; 28 files,
574 characters), into `sounds/farm-2/` with the other eight copied unchanged from farm-1; `FARM_SAYINGS_DEFAULT`
holds his wording. farm-1 stays on the site for copies not yet updated. Listening page:
https://claude.ai/artifact/BViPXpAoqS7JnhisrZ81FP. He also took Percy the pig off the visiting animals (his choice in
the window; Percy keeps his recordings).

## Hebrew (v39.96, 18 Nov 2026)
Tony's ten Hebrew sentences (`i18n/_farm_he`, saved 17 Nov) in ElevenLabs' eight Hebrew voices — "Please use all of
them and assign male voices to male characters and female voices to female characters randomly". Dealt at random
(Python `random.Random(17112026)`): each of the six male voices to one male animal and then two more at random; the
two female voices three each. Where animals share a voice, the first keeps the plain take and each other one has its
own take (another seed) and a pitch change (ffmpeg `rubberband`), so no two animals sound alike — the same voice and
text with the same seed gave the same take.

| Animal | Hebrew voice | voice_id | Take (seed) | Pitch |
|---|---|---|---|---|
| Percy the pig | Nimrod – Warm & Confident | ZiofZHcEBTn5sRySe5h8 | 11 | — |
| Gerald the goat | Herzl Ben – Articulate, Clear | 6Ijsl5024dyMrE00loVE | 11 | — |
| Bramble the sheepdog | Herzl Ben | 6Ijsl5024dyMrE00loVE | 12 | −2 semitones |
| Duncan the duck | Itamar – Israeli Hebrew Narrator | l7Q9rbdCC6j3J5dNlOOg | 11 | — |
| Hamish the horse | Dorian – Expressive Young man | PBHwEnXdzx0yfhIO2UCH | 11 | — |
| Dennis the donkey | Viktor M – Smart & Kind Guy | 8sZ9Z3Jy28CGLLCmKEHn | 11 | — |
| Lorenzo the llama | Viktor M | 8sZ9Z3Jy28CGLLCmKEHn | 12 | +1.5 |
| Reginald the rooster | Erez – Natural Israeli Hebrew | AZzja2JCoYeMe9vDQBll | 11 | — |
| Dolly the sheep | Danit – Natural Israeli Hebrew | s0T0DT6EAPeX57MQpn3I | 11 | — |
| Henrietta the hen | Danit | s0T0DT6EAPeX57MQpn3I | 12 | −2 |
| Gertrude the goose | Danit | s0T0DT6EAPeX57MQpn3I | 13 | +2 |
| Tabitha the turkey | Zina – Young & Soulful | Tbj9UQjXon5RB9MPEyc2 | 11 | — |
| Clementine the cow | Zina | Tbj9UQjXon5RB9MPEyc2 | 12 | −2.5 |
| Rosie the rabbit | Zina | Tbj9UQjXon5RB9MPEyc2 | 13 | +3.5 |

- Body `{"text": <spoken>, "model_id": "eleven_v4", "seed": <take>, "language_code": "he"}`; the spoken text is his
  sentence with היי written הֵיי (said "Hey"); the bubble shows his text. 140 files, about 2,700 characters with the
  retakes. Same evening-out as English (pitch change first). The key cannot transcribe (no speech_to_text), so Tony's
  ears are the only check of the words. Listening page: https://claude.ai/artifact/4T11ezRj8yXcdA4Gm9yN5r.
- Files: `sounds/farm-he-1/<animal>-<n>.mp3`, `<n>` the sentence's place in `FARM_RECORDED.he.sayings` (his order:
  0 היי! תפסיק עם זה! … 9 בלי ידיים! אני תרנגולת חופש!). A sentence he changes has no recording until recorded again —
  all of them into `sounds/farm-he-2/`.

## Recording a new saying or a new voice
Record it the same way, for every animal, into a NEW folder (`sounds/farm-2/…`) with all the files, and point
`FARM_SOUNDS` and `tools/build.js` at it: the service worker keeps every `sounds/…mp3` for ever once heard, so a file
must never change under the same name. A saying the owner adds in the farm window has no recording until then; the
device's own voice of the animal's kind says it.
