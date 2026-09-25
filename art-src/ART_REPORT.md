# ART_REPORT: Piggy Firefighters art audit

**Status: agent PASS with warnings. No human has signed off.** Nothing in this report is a human review, a platform approval or a star rating.

- **Auditor:** ART auditor subagent, 2026-09-25, 06:10 to 06:25 UTC.
- **Repo state:** branch `claude/bold-bell-aoscdj` at HEAD `eda46c5`, plus the uncommitted working tree as it was on disk during the audit.
- **Spend:** none. The auditor made no paid calls and edited no asset.
- **Files the auditor wrote:** this report, `qa/art/verify_art.{txt,json}` (a verifier re-run) and the evidence in `qa/art/audit/`.
- **Running work:** the post-art and rig-pieces passes were still writing into `art-src/animation/parts` (the git status shows `helmet_front`, `eyes_*`, `registration.json` and the dog `anchors.json` modified at 06:04). The parts findings below describe what was on disk at 06:10.

## 1. Verdict per check

| # | Check | Result | Evidence |
|---|---|---|---|
| A | `tools/art/verify_art.py`: sizes, modes, genuine alpha, symbol fit boxes, manifests, inventory, budgets | **PASS**: 0 FAIL, 0 PENDING, 1 WARN, 148 ok | `qa/art/verify_art.txt` |
| B | Donor files, sha256 over the whole of all three donor repos | **PASS**: 0 matches | `qa/art/audit/sha_scan.json` |
| B2 | Donor look-alikes, perceptual hash (extra check) | **WARN**: 4 win-rung FX textures look almost the same as LUCKY's (our own code; no byte match) | `qa/art/audit/donor_scan.json` |
| C | Exact pixel sizes against the recipe | **PASS** | verifier, §3 |
| D | Genuine alpha where required | **PASS** for runtime and thumbnails; **WARN** for parts (4 files touch the canvas edge) | §4.D |
| E | Manifests cover every file | **PASS** where a manifest exists; **WARN**: 5 locations have no manifest | §4.E |
| F | No baked text except locally lettered WILD, BONUS, rung titles and the wordmark | **PASS**, one note ("13" on the chief's shield) | §4.F |
| G | Palette adherence, ink and shading | **PASS** with a warning (UI frame reds are hotter than engine red) | `qa/art/audit/palette.json` |
| H | Symbol contact sheets at 85 px and 40 px, light and dark, judged by eye | **PASS**, with minor readability notes | `qa/art/audit/sym_*` |
| I | Thumbnails at 120x160 and 320x180, judged by eye | **PASS**. The Codex validator passes 8/8 (structure only). | `qa/art/audit/thumb_*`, `thumbnail/review/` |
| J | Ledger rows against generated PNGs, and the cost sum | **PASS**: 134 rows = 134 paid PNGs, $39.47 | §5 |
| K | `static/assets` byte budget per directory | **PASS**: 9.28 MB total, all within budget | §3 |
| L | Rig parts: structure, anchors, registration | **PASS** on structure and anchors; **WARN** on registration and clipping | §4.L |
| M | Donor leftovers outside the ART directories (reported only; not ART paths) | **FAIL** (another lane's paths): `hud/` 15/15 and `fonts/` 6/6 are byte-identical to LUCKY | §4.M |

Nothing in the audited ART directories blocks: no donor byte match, no size or alpha failure, no unrecorded paid output.

## 2. Spend (ledger `art-src/generated/source-record.json`)

The ledger has **134 rows, all status OK.** Every row uses `gpt-image-2.5-sunburst`, quality high, n 1. 132 rows are `images/edits` and 2 are `images/generations`. No failed attempts are recorded.

| Batch | Rows | Est. USD |
|---|---|---|
| symbols | 35 | 8.97 |
| scene | 21 | 6.30 |
| cards | 13 | 3.90 |
| winrungs | 4 | 1.20 |
| hero (4 candidates + `chief_hamm_master`) | 5 | 1.50 |
| rig_pf_chief | 12 | 3.60 |
| rig_pf_rookie | 12 | 3.60 |
| rig_pf_dog (incl. `body_no_head_no_legs_r2`) | 8 | 2.40 |
| rig_pf_rescued | 14 | 4.20 |
| thumb (6 candidates, 2 `_r2`, 2 backgrounds) | 10 | 3.80 |
| **Total** | **134** | **39.47** |

**Checking the files against the rows:**
- There are 141 PNGs under `art-src/generated/`. 134 of them are the 134 row outputs; all exist, and each file's sha256 equals its recorded hash, so no raw output was edited after it was recorded.
- The other 7 are local derivatives, not paid outputs: `hero/contact_hero.png` and six `symbols/*_lettered.png`.
- No output appears twice and no row points at a missing file.

**Checking the hero-fix + masters report (47 calls, $14.10):**
- The ledger has `hero/chief_hamm_master` (1) + chief 12 + rookie 12 + dog 8 + rescued 14 = 47 rows × $0.30 = **$14.10**. `art-src/animation/parts/source-record.json` agrees (47, 14.1).
- A minor miscount: the report says "13 raw paid outputs" for `rig_pf_chief`. The directory and the ledger both have 12.

## 3. Inventory

### Runtime assets, `apps/piggy_firefighters/static/assets/`

| Directory | Files | Bytes | Pixel sizes | Purpose |
|---|---|---|---|---|
| `sprites/symbolsCartoon` | 17 + manifest | 1,406 KB | 384x384 RGBA ×17 | Square reel symbols: H1-H4, L1-L4, W, W_blaze, ALARM, GALARM, pose B H1_b-H4_b and W_b |
| `sprites/symbolsCartoonTall` | 17 + manifest | 1,761 KB | 384x500 RGBA ×17 | Tall reel symbols, same set |
| `environment` | 8 | 1,336 KB | 2039x1000 RGB ×4, 1242x2208 RGB ×4 | Base, backdraft, rescue and inferno backdrops, landscape and portrait |
| `features/rescue` | 42 + 2 meta | 713 KB | rooms 233-234x390 RGBA ×30; facade 1298x376 RGB ×2; props (sizes vary) | Rescue and Inferno rooms (5 reels × roaring / smouldering / safe × normal and inferno), window facades, ladder, hose, nozzle, water jet and splash, steam, jump sheet, blank badge, blank spins plate |
| `ui_scene` | 6 + 2 meta | 284 KB | board_frame 1497x946, cell_backplate 963x645, 3 cell frames at 384x384, line_plate 307x291 (all RGBA) | Truck-panel reel frame, cell plates and frames, line-number plate |
| `buycards` | 5 | 547 KB | 768x512 RGB | Ante, Backdraft Spins, Alarm Call, Rescue and Inferno buy cards |
| `splash` | 8 + manifest | 806 KB | 768x768 RGB ×6, shutter 1024x512, bar 1024x115 | Splash cards and shutter |
| `maxwin` | 2 + manifest | 465 KB | 1600x900 RGB, 900x1400 RGB | Max-win card, 16:9 and portrait |
| `winrungs/signs` | 5 + manifest | 396 KB | 1200x728 RGBA | Signs BIG, HUGE, MEGA, EPIC and MAX WIN (lettered locally) |
| `winrungs/pieces` | 10 + 10 json | 904 KB | 1024x384 RGBA | Tumbling-piece spin sheets, 24 frames each |
| `winrungs/coins` | 1 + json | 166 KB | 1024x512 RGBA | Coin sheet, 32 frames |
| `winrungs/fx` | 5 | 95 KB | 1024x128, 512², 256² ×2, 256x512 | Procedural additive FX |
| `branding` | 2 | 186 KB | wordmark.png 1366x654 RGBA, wordmark_small.webp 683x327 RGBA | Wordmark |
| `ambient` | 0 | 0 | none | Empty directory |

The nine families total **9,283,035 bytes (9.28 MB, 8.85 MiB)**. LUCKY's same nine families total 12.04 MB, or 13.06 MB with its `ambient/`.

**Budgets:**
- `ambient/` holds 0 MB against its 1.5 MB budget.
- `splash/` holds 0.79 MB against its 1.2 MB budget.
- The largest single file is `maxwin/max_win_card_portrait.webp` at 257 KB.
- Sprites are the heaviest family at 3.24 MB: 34 lossless tiles of about 93 KB each. They are the first place to save bytes if the bundle needs trimming.

### Rig parts, `art-src/animation/parts/` (182 files, 29.6 MB, source only, never shipped)

These are the `pf_chief`, `pf_rookie`, `pf_dog` and `pf_rescued` part sets: 53 registered parts on a 1024x1536 RGBA canvas, 11 sheets at 1536x1024, and trimmed pieces. `INVENTORY.md` holds the per-file table. Each rig also has `registration.json` and `anchors.json`.

### Thumbnails, `thumbnail/` (PF-THUMB-01, 38 files, 29.6 MB)

| File | Size | Mode | Result |
|---|---|---|---|
| `foreground_3_4.png` | 1536x2048 | RGBA | 54.5 % alpha 0, 45.0 % alpha 255, 0.55 % soft edge; RGB zeroed under alpha 0 |
| `background_3_4.png` | 1536x2048 | RGB | #26365C 62.5 % / #42578A 26.1 % / #1E2C4F 9.5 % |
| `preview_3_4.png` | 1536x2048 | RGB | Flattened review composite |
| `foreground_16_9.png` | 2048x1152 | RGBA | 70.1 % alpha 0, 29.4 % alpha 255, 0.46 % soft edge |
| `background_16_9.png` | 2048x1152 | RGB | Same 3 tones, 99.2 % in the top 3 |
| `preview_16_9.png` | 2048x1152 | RGB | Flattened review composite |

Every recorded sha256 in `thumbnail/source-record.json` equals the file on disk.

## 4. Check details

**A. Verifier.** The only WARN is `branding/wordmark_small.webp` (683x327 RGBA): the verifier has no expectation rule for it, and nothing references it yet.

**B. Donor files.**
- The sha256 scan hashed every file of 64 bytes or more in `/home/user/lucky`, `/home/user/piggy-builders-3` and `/home/user/piggy-police`, whole repos except `node_modules` and `.git`: 13,175 files, 8,323 unique hashes.
- It compared them against all 148 files in the nine ART families, the 182 parts files, the 38 thumbnail files and the 297 files in `art-src/generated/`. Result: **0 matches**.
- A perceptual dHash scan against 3,942 donor images, using a threshold of ≤ 10 of 256 bits, found 7 near hits:
  - **`winrungs/fx/{dust_puff, flare_horizontal, glint_4point, light_ray_wedge}`** are near-identical to LUCKY `art-src/winrungs/fx/*` of the same names. The alpha correlation with LUCKY's runtime FX is 0.96 to 0.99; `ring_shockwave` is 0.885.
    - They come from our own code (`derive_winrungs.fx_textures`) and match no donor byte for byte.
    - They are generic soft glows with the same file names, and on screen they cannot be told apart from the donor's.
    - This is not a blocker. If "unique to Piggy Firefighters" should hold for FX too, give them a firefighting motif, such as water-droplet ripples or a steam texture.
  - The other 3 hits (`pf_rookie/arm_right`, `pf_rookie/head_blank`, a thumbnail shield mask) are false positives: mostly empty canvases matched against unrelated donor layers.

**D. Alpha in the parts.**
- All 166 part PNGs are RGBA with alpha values of both 0 and 255, have RGB zeroed under alpha 0, and have clear corners. `QA_reassembly.png` is the one exception: it is RGB and belongs to another process.
- The eye pieces trip a "light neutral" heuristic, but that is the eye whites, not a painted background.
- **Clipped:**
  - `pf_chief/arms_raised.png`, `arm_right_raised.png` and `arm_left_raised.png` touch the canvas edge: 88 rows at x=0 and 30 rows at x=1023, so the raised fingertips are cut off (`qa/art/audit/chief_arms_raised.png`).
  - `pf_rookie/master_pf_rookie.png` touches y=0 across 12 px, so the helmet crown is shaved (`qa/art/audit/rookie_master.png`).

**E. Manifests.**
- Every manifest names only files that exist, and no file in its directory is left out. This holds for `sprites/symbolsCartoon`, `sprites/symbolsCartoonTall`, `splash`, `maxwin`, `winrungs/signs`, `winrungs/pieces/*.json`, `winrungs/coins`, `ui_scene/frame.meta.json` and `cells.meta.json`, and `features/rescue/{rooms,props}.meta.json`.
- No manifest covers `environment/`, `buycards/`, `branding/`, `winrungs/fx/`, or `ui_scene/board_frame.webp` and `cell_backplate.webp` (except through `frame.meta`). Only the verifier's expected-file list covers them.

**F. Baked text.**
- I looked over every runtime family, the parts contact sheets, the buy and splash cards, the backdrops, the max-win card and the thumbnails. The only letterforms are the local ones:
  - WILD on `sym_W`, `W_b` and `W_blaze`, square and tall
  - BONUS on ALARM and GALARM, square and tall
  - the BIG, HUGE, MEGA, EPIC and MAX WIN signs
  - the wordmark
- The raw W, W_blaze and W_b outputs have blank badges, confirmed by eye.
- The dispatch board, the clock, the door plaque and the truck doors carry no glyphs.
- A scan of the prompts shows letterable words only inside negative instructions ("no text, letters, numbers") or as character names in reference descriptions. None leaked into an output.
- **Note:** the thumbnails and `pf_chief/pieces/shield_13.png` carry a locally lettered **"13"** (`letter_shield.py`). Theme §2 specifies this "13" shield, but it is outside the stated allowlist, and the thumbnail brief says the art layers have "no ... typography". **Owner or Codex call:** keep the "13" or ship a blank shield.

**G. Palette.**
- **Outline ink** is one very dark maroon-brown everywhere I measured it (median of the silhouette's outer ring):
  - #1E0100 on the square symbols and #1C0100 on the tall ones
  - #170200 on the signs, #1A0400 on the UI and #1D0100 on the rescue props
  - the wordmark uses the theme's #2A1A10
  It is never pure black, so the family reads as one ink. The small piece sheets read lighter only because they are downscaled.
- **Engine red:** the median red is within ΔE76 of about 3.5 to 13 of #D7262B on symbols, signs, cards and the max-win card. Hydrant yellow is within ΔE of about 8.
- **WARN, hotter reds:** `ui_scene/board_frame.webp` (#FC171B, ΔE 20), `cell_frame_locked.webp` (#F80410, ΔE 22), `features/rescue/badge_blank.webp` and `ladder_top.webp` (#F3131D and #F4121C, ΔE 16 to 17). They are purer and hotter than engine red and than the symbols they frame. A small hue/value pull would unify them.
- **Flame orange** covers more than 1 % of a non-fire asset only on `winrungs/signs/max.webp` (1.3 %, its flaming crest), which is acceptable.
- The brick reds (#92241C to #A9271E) are a material colour, not a palette violation.

**H. Symbols** (`sym_sq_85.png`, `sym_sq_40_x2.png`, `sym_tall_85.png`, `sym_tall_40_x2.png`, `sym_sq_192.png`)
- At 85 px, every one of the 34 tiles reads on light, near-black and dusk-navy grounds. At 40 px every silhouette is still distinct.
- The high/low hierarchy is clear, and ALARM (red box) and GALARM (gold box) can be told apart by colour at 40 px.
- There is one outline weight, flat cel shading with one hard shadow tone and white spec highlights, the same across H, L, W and the alarms.
- Minor points:
  - WILD and BONUS lettering does not resolve at 40 px; the shield and ribbon shapes carry the meaning there.
  - L4 (black boots) and the H3 halligan bar lose edge on the darkest ground; the yellow bands and highlights rescue them.
  - On the tall ALARM and GALARM tiles the BONUS ribbon floats below the box with a visible gap; on the square tiles it overlaps the box.

**I. Thumbnails.**
- At 120x160 the chief's face (salute) is the dominant read, and the helmet, moustache and eyes resolve.
- At 320x180 the hero sits on the right third and glances left into a quiet title area.
- There is exactly one figure. The background is one 225° hue in three tones. Edges are clean on white and black (`thumbnail/review/foreground_3_4_edges_white_black.png`), and the identity matches `chief_hamm_master.png`.
- `tools/codex/thumbnail/validate_thumbnail.py --json`: 8/8 PASS (structure only).
- **Bookkeeping bug:** `thumbnail/source-record.json` lists `"refs": null` on the t3 provenance rows, but the ledger rows carry `reference_paths` (`chief_hamm_master.png` and the style pig). The lookup key in `make_thumbnails.py` needs fixing.
- The delivery record in `thumbnail/instructions.md` still reads pending / NOT RUN. It is Codex's file, so Codex needs to fill it.

**L. Rig parts.**
- **Anchors:** present as `ANIMATION_CONTRACT.md` requires. `pf_chief` has `nozzle_tip`, `grip_l`, `grip_r` and `head_top`; `pf_rookie` and `pf_dog` have `sheet_l` and `sheet_r`; `pf_rescued` has `feet`. Every rig has a Spine scale.
- **Inventory:** every part named in the production report is on disk. That includes the five rescued skins (grandma with the cat, twins piggyback, dad in a bathrobe, the baby in a sling, teen with headphones), the dog jaw, tail, ears and tongue, and the rookie card and hose props.
- **Registration**, measured as the overlap (IoU) between the master's silhouette and the union of its registered parts:
  - pf_chief 0.949 (bugle not in the parts)
  - pf_rookie 0.937
  - pf_dog 0.935 (tail not in the union)
  - pf_rescued 0.977

  That is good, but not "within a few pixels" everywhere. In the reassembly images:
  - `legs.png` doubles the legs already painted in `body_no_head_no_arms.png` at a small offset. That leaves a ghost boot or leg edge between the legs of pf_chief and pf_rescued.
  - The dog's `body_no_head_no_legs` (r2) has a longer, lower torso and a different stance from the dog master.
  - A thin light seam crosses the helmet shell where `helmet_front` meets the head on pf_chief and pf_rookie.
  - The raised-arm fingertips are clipped (see D).
- **Foreign files:** `pf_chief/pieces/shield_13.png` and `pf_chief/QA_reassembly.png` (RGB) are both from another process. The QA image belongs under `qa/art/parts/`.
- **Hero master:** `chief_hamm_master.png` shows all four must-fixes (level brows, catch-lights in both pupils, a thumbed hand gripping the bugle ring, a separated-finger point with a margin). `ART_HERO.md` is present.

**M. Outside the ART paths** (reported, not edited; another lane owns them)
- `static/assets/hud/`: all 15 SVGs are byte-identical to LUCKY `static/assets/hud/*`.
- `static/assets/fonts/`: all 6 files are byte-identical to LUCKY. Inter, Alfa Slab One and Lilita One are third-party OFL fonts. The **`interGold` bitmap font (png + xml)** is a LUCKY-made asset.
- `CLAUDE.md` says no donor asset may ship, so these are blockers for the frontend/HUD lane.
- `static/assets/{hat3d,build,ambient}` are empty directories; `hat3d` is a LUCKY name. Remove them.
- `placeholder/` (56 files) has no donor byte match.

**Card and scene review** (`qa/art/audit/fam_*.png`, `rooms_on_facade.png`)
- One cohesive family: the same ink, flat cel shading and palette across the symbols, backdrops, cards, signs, UI, rescue props, parts and thumbnails. Chief Hamm is the same character everywhere.
- The rooms fit their facades with no seams in all 6 state rows.
- Nits:
  - `splash/card_lines` crops Ember's head at the right edge.
  - The pig waving from the window in the Rescue and Inferno buy and splash cards wears a blue shirt, not the Trotter rig's cream tee. That is a small continuity gap.
  - The smouldering and safe rooms keep soft soot smudges above the windows.

## 5. Open items

1. **Frontend lane** (the blocker for players to see any of this art): `game/assets.ts`, `assetsScene.ts`, `Background.svelte`, `WinRungs.svelte`, `Splash.svelte` and `SceneShutter.svelte` still load `static/assets/placeholder/**`.
   - Switch them to the family paths (README "Registration notes").
   - Update `symbolMotion.WILD_BANNER` to the measured badge rects, square `{x 120, y 209, w 143, h 129}` and tall `{x 123, y 242, w 137, h 142}` (it currently has `62, 204, 262, 98` / `54, 167, 276, 122`).
   - Update the `SIGN` rect in `SymbolSprite.svelte` to match.
2. **Frontend/HUD lane:** replace the LUCKY `hud/*.svg` icons and the `interGold` bitmap font with originals, and remove the empty `hat3d/`, `build/` and `ambient/` directories.
3. **Coordinator:** commit with explicit paths. These are untracked: `static/assets/winrungs/` (33 files), `static/assets/branding/` (2), the `thumbnail/` deliverables, review and source files, `art-src/generated/thumb/`, `art-src/generated/prompts/thumb_*.txt`, `art-src/animation/parts/{INVENTORY,REGISTRATION}.md`, `qa/art/audit/` and this report.
4. **Parts** (free and local, for the rig-pieces r2 pass or Codex):
   - Drop the painted legs from `body_no_head_no_arms`, or mask them where `legs.png` overlaps, so the boots stop doubling.
   - Fix the helmet_front seam.
   - Re-place the chief's raised arms, or pad the canvas, so the fingertips are not clipped.
   - Shift the rookie master down about 12 px.
   - Decide whether the dog body r2 gets a Spine nudge or a same-framing redraw. A redraw would be paid, one call, for a named defect.
   - Cut the pf_rescued skins into slots (see the production report's open items).
   - Move `QA_reassembly.png` to `qa/art/parts/`.
5. **Palette polish** (free): pull `board_frame`, `cell_frame_locked`, `badge_blank` and `ladder_top` reds toward #D7262B, or toward the symbols' #DA1C21.
6. **Decisions:**
   - Keep or blank the "13" on the thumbnail helmet shield. The brief bans typography in the tile layers.
   - Decide whether the generic `winrungs/fx` glows need a firefighting motif to count as "unique".
7. **Bookkeeping:**
   - Fix the `refs: null` in `thumbnail/source-record.json`.
   - Give `branding/wordmark_small.webp` a verifier rule and a consumer.
   - Codex to fill the delivery record in `thumbnail/instructions.md`.
8. **Not done here:** the Stake reviewer backend run, the in-game capture at cabinet scale, and human visual sign-off.

## 6. Evidence and how to reproduce

`qa/art/audit/` holds:
- symbol contact sheets at 85, 40 (×2 zoom) and 192 px, square and tall, on light, dark and navy grounds
- family contact sheets `fam_*.png`
- `rooms_on_facade.png`
- thumbnail renders at 120x160 and 320x180 (plus ×3)
- the clipped-part renders
- `sha_scan.json`, `donor_scan.json` and `palette.json`
- the scripts that produced them (their output paths point at the auditor scratchpad)

Re-run the verifier with `python3 tools/art/verify_art.py`. Its report is `qa/art/verify_art.txt`.
