# Piggy Firefighters — tile-editor upload set

Prepared 2026-09-25 by lane S (submission kit). These are the files to hand to the Engine game-tile editor, named per the tile rule (Background + Foreground ≤ 3 MB combined, Provider logo transparent and legible small). No upload was performed; tile-editor appearance and platform acceptance remain the owner's manual step.

## Files

| File | Role | Dimensions | Mode | Bytes | SHA-256 |
| --- | --- | --- | --- | ---: | --- |
| `PiggyFirefighters-BG.png` | Background, 3:4 (primary) | 1536 × 2048 | RGB, opaque | 44,281 | `6ba9bcc2c9081e6a9b3a4958ca611ac050373dc70b598a294687b45400eda429` |
| `PiggyFirefighters-FG.png` | Foreground, 3:4 (primary) | 1536 × 2048 | RGBA, genuine alpha 0…255 | 1,564,182 | `fd121af9646949d73eff2480d3a5a56e2c6c8226abf45c13a6ddba057539b92e` |
| `PiggyFirefighters-BG-16x9.png` | Background, 16:9 | 2048 × 1152 | RGB, opaque | 30,376 | `d8045f25fcf3d79992c501d866825bd60fd44b21a92f3bc67ab51d23b5632755` |
| `PiggyFirefighters-FG-16x9.png` | Foreground, 16:9 | 2048 × 1152 | RGBA, genuine alpha 0…255 | 955,823 | `abbd05d756a90fde72a8cde5dde09a457f1aa9a225f65bdfcf56233f305720a2` |
| `CrashGalaxy-Logo.png` | Provider logo | 1024 × 355 | RGBA, white mark on transparent | 72,399 | `a309817cb374c26ac63af8e17d2066f5b4a3b9de059be3ab5eeb8158f9ba562d` |
| `CrashGalaxy-Logo.svg` | Provider logo vector source (derived, see below) | viewBox 0 0 1142 396 | — | 5,526 | `ec01a747217fd199a9a3106c7b69fb2c98ae7408f08644f801e187699763213a` |

The four tile PNGs are byte-identical copies (`cp`) of `thumbnail/{background,foreground}_{3_4,16_9}.png`; their hashes equal the ones recorded in `thumbnail/source-record.json` (`files[]`) and the ones recomputed today. Layer placement: load the background first, the foreground above it at (0, 0) with identical scale and the original alpha; the game wordmark is a separate editor element and the title zones are clear (validator checks below).

## Combined-size check (≤ 3 MB)

| Pair | Bytes | Result |
| --- | ---: | --- |
| 3:4 BG + FG | 44,281 + 1,564,182 = **1,608,463** (1.61 MB decimal / 1.53 MiB) | PASS |
| 16:9 BG + FG | 30,376 + 955,823 = **986,199** (0.99 MB) | PASS |

## Provider logo provenance

`CrashGalaxy-Logo.png` is rasterised from the Crash Galaxy brand bumper shipped in this game, `apps/piggy_firefighters/src/brand/crash-galaxy-bumper.ts` (file SHA-256 `01112fd59580830600c19262a71ac5e6df3da87379334a94539197a19972f326`): the three path constants `ROCKET_D`, `CRASH_D`, `GALAXY_D` in the lockup's 1142 × 396 user space, the wordmark lines inside the bumper's `translate(397,37)` group, all filled solid `#ffffff` (the bumper's `finish: 'solid'` rendering; no chrome gradient, trail, sheen or stars). `CrashGalaxy-Logo.svg` is that assembly; the PNG is `magick -background none -density 300 CrashGalaxy-Logo.svg -resize 1024x` (ImageMagick internal SVG renderer), RGBA, alpha 0…255, RGB 0…1 (pure white ink). The mark is the brand's own black/white lockup; the white version suits the platform's dark card background, as in the sibling titles' `CrashGalaxy-Logo.png` files.

Legibility check (viewed with the Read tool on a dark field): at 48 px **height** (≈138 px wide) the rocket and both words are fully legible; at 48 px **width** the lockup is only 17 px tall — the rocket silhouette and the two-line shape read, the letters go soft. This is a 2.9:1 wide lockup, so the editor's small placements should size it by height.

## Validator evidence (agent checks, not human sign-off)

- `tools/art/make_thumbnails.py` checks in `thumbnail/source-record.json` (`checks[]`): 14/14 pass — sizes/modes, genuine alpha, figure inside the 5 % inset, title zone clear (0.00 % covered) in both ratios, one figure, low-colour background (dominant hue 225, `#26365C`), face readable at 120×160 and 320×180.
- `python3 tools/codex/thumbnail/validate_thumbnail.py --json`: PASS 8/8 files (structure and provenance presence only, not visual acceptance) — `source-record.json` `codex_validator`.
- Review composites at tile size: `thumbnail/review/review_3_4_120x160.png`, `review_16_9_320x180.png` and the grey-value checks.
- Human art acceptance and the real tile-editor preview are NOT RUN; see `docs/submission/PRE_UPLOAD_CHECKLIST.md`.
