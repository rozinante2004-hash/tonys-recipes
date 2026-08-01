# 5.4 — One Firestore document per recipe

**Status: steps 1 and 2 of 3 shipped (v28.0, v28.1).**

- **v28.0** — per-recipe reads with a legacy fallback, dual-write, migration on first load
  after sign-in, `schema: 2` in `shared/meta`.
- **v28.1** — **stopped writing `shared/recipes`**, removing the last blind whole-collection
  overwrite in the app. The plan said to wait until every device had run v28.0; v28.1 instead
  makes the waiting unnecessary. It still *reads* the legacy document once per load
  (`reconcileLegacyStragglers`) and adopts anything a device left on v27.9 wrote there, so a
  straggler cannot lose edits. `meta.legacyAt` is the high-water mark that keeps that check
  cheap and — the part that matters — stops it resurrecting a deleted recipe.

Still to do:

- **Delete the legacy document by hand,** after a backup, once no device can possibly still be
  on v27.9. Remove `reconcileLegacyStragglers` and the `recipes` listener in the same pass.
- **The two-browser checks in §7 have NOT been run.** They can't be here: they need two
  signed-in sessions against the real Firebase project, and this sandbox has neither network
  nor Firebase. The unit tests below cover the decision logic; §7 covers the thing that
  actually bites.
- **`firestore.rules` changed and must be published by hand** (Firebase console → Firestore
  Database → Rules → paste → Publish). `write` was split into `create, update` so the
  admin-only `delete` rule finally restricts something. Until it is published, deletion stays
  open to every write-role member.

**Why it was worth doing:** Tony has confirmed he is *not* the only editor, which makes the
lost-edit problem below a live risk rather than a theoretical one.

---

## 1. How sync works today

**Documents in use** (collection `shared`):

| Document | Contents |
|---|---|
| `shared/recipes` | `{ recipes: <JSON string of ALL recipes, photo-free>, nextId, updatedAt }` |
| `shared/photo_<id>` | One document per recipe photo (already split out — do not disturb) |
| `shared/access` | The family member list |

**Save** — `saveToFirestore()`:
1. `stripPhotosForCloud(recipes)` → JSON → size-checked against `FIRESTORE_DOC_LIMIT` (1 048 487)
2. `_fbDb.collection('shared').doc('recipes').set({...})` — **a blind whole-document overwrite**
3. `syncCloudPhotos()` writes only changed photos, tracked by `_cloudPhotoStamps`

**Load** — `loadFromFirestore()` → `_loadFromFirestoreInner()`:
- one `.get()` on `shared/recipes`, `JSON.parse`, `migrateRecipes()`
- `attachCloudPhotos()` pulls each `photo_<id>` where `_ph` (or legacy `hp`) is set
- preserves local-only fields the cloud copy lacks: `originalPhoto` (`_localOrig`) and
  `history` (`_localHist`)
- merges offline edits when `_offlineQueue` is set, newest `updatedAt` wins per recipe

**Relevant state:** `_offlineQueue`, `_justSaved`, `_cloudPhotoStamps`, `_cloudPhotoIds`,
`_lastVisibleRefresh` (foreground refresh, throttled 20 s).

### The four problems

1. **Lost edits.** Step 2 is `.set()` with the whole collection. Two people editing within the
   same window: whoever saves second overwrites the first person's change entirely. Not merged —
   replaced, silently. *This is the one that matters.*
2. **Every change rewrites everything.** Favouriting one recipe re-uploads all of them.
   Measured at ~1.7 KB/recipe, that is ~340 KB to record one boolean at 200 recipes.
3. **A hard ceiling.** The 1 MiB limit applies to the *sum*. Measured ~1.7 KB per realistic
   recipe → **~610 recipes**, after which `DOC_TOO_BIG` stops cloud sync entirely.
4. **Blast radius.** One oversized recipe fails the whole save.

---

## 2. Target shape

`shared/recipe_<id>` — one document per recipe, photo-free, same shape as a `stripPhotosForCloud`
entry. Photos stay in `shared/photo_<id>` exactly as they are.

`shared/meta` — `{ nextId, updatedAt, schema: 2 }`. `nextId` must stay centralised or two devices
will mint the same recipe id.

Once per-recipe documents exist, **`history` (3.4) can start syncing again** — it was excluded
only because it tripled the single shared document (1.7 KB → 6.2 KB per recipe, capacity
610 → 170). Per-document that cost is irrelevant. Re-enable by removing `history` from the
exclusion list in `stripPhotosForCloud` and dropping the `_localHist` preservation in
`_loadFromFirestoreInner`.

---

## 3. Migration — the risky part

Existing data lives in `shared/recipes`. Requirements:

- **Old app versions must keep working during the transition.** Tony deploys by uploading files
  by hand; assume a phone may run v27.9 for days after the PC has v28. So: **dual-write** for one
  release — write per-recipe documents *and* keep `shared/recipes` updated — then stop writing the
  legacy document in a later release.
- **Migration must be idempotent and interruptible.** A migration that half-finishes on a flaky
  phone connection must be safe to re-run.
- **Never delete the legacy document in the same release that stops writing it.** Leave it as a
  fallback for at least one version.
- Read path: prefer `recipe_*` documents; if none exist, fall back to `shared/recipes` and
  trigger migration.

Suggested sequence:
1. v28.0 — read per-recipe with legacy fallback; **dual-write**; migrate on first load after
   sign-in; `schema: 2` in `shared/meta`.
2. v28.1 — stop writing `shared/recipes` once Tony confirms every device is on v28.0.
3. Later — delete the legacy document by hand, after a backup.

---

## 4. Concurrency

Per-recipe documents remove *cross-recipe* clobbering for free. For *same-recipe* collisions use a
transaction that compares `updatedAt` and refuses a write whose base is older, then tells the user
plainly ("this recipe was changed on another device — reload before editing"). Do **not** silently
merge field-by-field; a wrong silent merge is worse than an honest refusal.

Deletions need a tombstone or a reconciliation pass: with one document per recipe, "absent" no
longer distinguishes *deleted* from *not yet loaded*. Simplest: keep an `order`/`ids` array in
`shared/meta` as the authoritative membership list.

---

## 5. Firestore rules

`firestore.rules` (repo root, 5.5) matches `/shared/{document=**}`, so `recipe_*` and `meta` are
already covered. Verify rather than assume, and remember the app fetches this file and substitutes
`{{READ}}`/`{{WRITE}}`/`{{ADMIN}}`.

---

## 6. Cost note

Reads go **up**: one per recipe per load instead of one for the collection. At 600 recipes that is
600 reads per cold load against a 50 000/day free tier — fine, but real. Writes go sharply down.
Consider caching by `updatedAt` so a load only fetches changed documents.

---

## 7. Test plan — this must not ship on unit tests alone

Added to the Self Test suite in v28.0 (Cloud Sync group), all driving the real functions
against `_fakeFirestore`, an in-memory stand-in:
- ✅ `cloud_migrate_idempotent` — migration is idempotent, and leaves the legacy doc alone
- ✅ `cloud_migrate_legacy` — a legacy-only account migrates, and the documents round-trip
- ✅ `cloud_delete_docs` — deleting a recipe removes its document *and* its `photo_<id>`
- ✅ `cloud_nextid` — `nextId` never regresses, including against a higher cloud value
- ✅ `cloud_stale_base` — a stale-base write is refused, not silently applied
- ✅ `cloud_doc_range` — the legacy `recipes` doc falls outside the `recipe_*` id range
- ✅ `cloud_history_split` — history travels per-recipe but never in the legacy document
- ✅ `cloud_dirty` — only changed recipes are written

Each was mutation-checked: the code was deliberately broken and the test confirmed to fail.
That matters more than the tests passing, and it found a real defect in one of them.

Then, by hand, with two browsers signed into the same account:
1. Edit **different** recipes simultaneously on both → both survive. *(Fails today.)*
2. Edit the **same** recipe on both → second gets an honest refusal, no silent loss.
3. Delete on A while B has it open → B reconciles without resurrecting it.
4. Go offline on A, edit, come back → offline queue still merges correctly.
5. Old version on one device, new on the other → neither corrupts the other's data.
6. **Back up first** (Imp/Exp → Backup — Save) and verify restore works before starting.

---

## 8. Context the new session needs

- Verification is Playwright against a local `python3 -m http.server`, driving the in-app
  `SELF_TESTS` array. As of v27.9: **115 checks, 109 passing**; the 6 failures are network/Firebase
  only and cannot pass in a sandbox.
- Branch `claude/tonys-recipes-app-nv31q1`, PR #1. Tony also uploads files to `main` by hand, so
  fetch and merge `main` before starting.
- Single-file app; no build step. Bump `version.json` and the four `v27.x` strings in `index.html`
  together.
- Keep `RECONSTRUCTION_PROMPT.md` and `IMPROVEMENT_IDEAS.md` current.
