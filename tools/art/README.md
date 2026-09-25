# tools/art: Piggy Firefighters art pipeline (ART lane)

```
art-src/reference/**             style/character refs (never shipped; README + MANIFEST.json)
        │ --ref (images/edits)
        ▼
gen_art.py ──PAID──► art-src/generated/<batch>/<name>.png         raw model output, NEVER edited
        │            art-src/generated/source-record.json          one row per HTTP attempt (also failures)
        ▼
derive_*.py / make_*.py (local, deterministic, free)
        ▼
apps/piggy_firefighters/static/assets/<family>/…                   runtime files + manifests
        ▼
verify_art.py ──► qa/art/verify_art.txt|json                        audit (agent PASS ≠ human sign-off)
```

Run everything from the repo root with `python3` (Pillow, numpy and scipy are required; `pip install fonttools` adds
the SVG masters). No tool prints, logs or writes a key.

## Rules the tools enforce

- **Only `gen_art.py` spends money.** The key comes from the environment variable `OPENAI_API_KEY` and nowhere else.
  Every attempt is appended to `art-src/generated/source-record.json` under an `fcntl` lock with an atomic replace:
  model, final prompt, prompt files, refs, size, quality, `cost_estimate_usd` (0.21 for 1024², 0.30 for the 1536
  sizes), status, output, sha256, usage, seconds and note. The record also keeps failures, because a refused call
  may still bill.
- **No overwrite.** An existing `<batch>/<name>.png` is reused. A redraw takes a new name (`_r2`) plus `--note`
  naming the defect. `--force` moves the paid original to `<batch>/superseded/` instead of deleting it.
- **References must live under `art-src/`**. Copy style refs into `art-src/reference/`. The tool refuses to read
  them straight from a donor checkout.
- **Protected families.** Every write is guarded, and nothing ever goes into
  `static/assets/{hud,fonts,audio,spine,placeholder}`.
- **Donor purge.** Before a derive writes into a runtime family dir under `static/assets/`, it deletes the untracked
  LUCKY donor copies in that family. Only files that git does not track **and** that are byte-identical to the donor
  file at the same path are deleted. Our outputs and other lanes' files, such as the frontend's
  `splash/manifest.json` mirror, never match that rule. `--out` (tests and staging) never purges. To preview a purge:
  `python3 tools/art/art_common.py purge-donor <family…>`. Add `--execute` to delete.
- **Text is never generated.** WILD, BONUS, the rung titles and the wordmark are lettered locally in Alfa Slab One
  (`art-src/branding/fonts/AlfaSlabOne-Regular.ttf` + OFL).
- **Alpha clean-up.** On every transparent source, alpha is normalised (the model tops out at 254), the glow below
  alpha 150 is cut, specks under 150 px are dropped, and RGB is zeroed under alpha 0 before WEBP.

## Tools

| Tool | What it does |
|---|---|
| `gen_art.py <batch> <name>` | The paid call. With `--ref a.png …` it POSTs multipart to `/v1/images/edits` (`image[]`); with no refs it POSTs JSON to `/v1/images/generations`. Options: `--size 1024x1024\|1024x1536\|1536x1024\|1536x2048\|2048x1152` (the last two added for PF-THUMB-01; the API accepted them on 2026-09-25, est $0.50), `--transparent`, `--model` (default `gpt-image-2.5-sunburst`), `--quality high`, `--prompt` / `--prompt-file`, `--preamble` (repeatable), `--note`, `--force`, `--dry-run` (validates and prints the plan; no key needed, nothing recorded). It makes 4 attempts with an 8·n s back-off and fails fast on 400/401/403. Exit codes: 0 ok, 1 API failure (recorded), 2 usage error (nothing sent). |
| `art_common.py` | Shared helpers: path resolution (`<batch>/<name>` or a unique bare name), `load_rgba`/`load_clean`, `components` + `sort_grid` (sheet splitter), `ink_bbox`, `fit_to_box` / `trim_pad_square` / `pose_b_matched`, `fit_into`, `cover`, `window`, `relight`, `warp_sep`, `period`, `hard_alpha`, `save_webp`/`save_png`/`write_json` (all guarded), `alpha_report`, `contact_sheet` (light + dark ground at 85 / 40 px), `purge_donor_copies`, and the theme `PALETTE`. Its CLI: `purge-donor`, `alpha`, `contact`. |
| `derive_symbols.py` | Square 384² lossless tiles → `sprites/symbolsCartoon/sym_<ID>.webp` + `manifest.json`. IDs: `H1…H4 L1…L4 W W_blaze ALARM GALARM`, plus pose B `H1_b…H4_b` (and optionally `W_b`). The ink box's larger side is 88 % (`--pad 0.068` is the **default**). `W_blaze` and pose B use their base's scale, so the win cut never changes size. WILD is lettered on the blank badge, and the lettered master is written beside the source as `<name>_lettered.png`. The manifest records runtime keys (`sym_W_BLAZE`, `sym_H1_b`), sources, fill and the tile rect of the WILD badge (compare it with `symbolMotion.WILD_BANNER.square`). Use `--bonus-tag` to tag the alarms, `--strict` to fail on PENDING or off-box tiles, and `--only`, `--map`, `--src ID=path` or `--out` to narrow or redirect. |
| `derive_symbols_tall.py` | Tall 384×500 tiles → `sprites/symbolsCartoonTall/symT_<ID>.webp` + manifest (ink 86 % of the width or 92 % of the height). Sources default to `symbols/sym_tall_<id>`. `--from-square [--square-map]` falls back to the square source, and a matched pose is then scaled against its square base. |
| `make_symbol_labels.py` | Library: `text_layer`, `ribbon`, `find_panel`, `letter_wild` (`--wild-style red-on-cream\|cream-on-red`), `bonus_square`, `bonus_tall`. CLI: `--bonus ALARM,GALARM [--tall]` re-tiles the alarms with a BONUS tag after `derive_symbols`; `--letter-wild raw.png --write out.png`; `--specimen out.png`. |
| `derive_scene.py [env ambient frame backplate shutter]` | `env`: `environment/<mood>_{landscape 2039x1000, portrait 1242x2208}.webp` cover-crop at q88. Moods are `base backdraft rescue inferno`; `--relight backdraft=base:backdraft` derives a mood without a paid call; `--land/--port` switch sizes (frontend placeholders are 2048x1024 / 1080x1920). `ambient`: `plate_<mood>_{1536x1024,1024x1536}.webp` at q80, with the ambient dir held to ≤ 1.5 MB. `frame`: the generated truck-panel frame is warped so its outer edge and opening land on `OPEN {212,1279,178,761}` of 1497×946, and the top rail (repeated unmirrored from `TOP_TILE [340,36,487,154]`) is rebuilt as whole periods; it writes `ui_scene/board_frame.webp` + `ui_scene/frame.meta.json` (opening fractions, rail period). `backplate`: `ui_scene/cell_backplate.webp` 963×645. Accepted redraws are registered in `art-src/generated/scene.sources.json` (e.g. `board_frame` → `scene/board_frame_r2`). `shutter`: `splash/shutter_slats_tile.webp` 1024×512 (6 whole slats, autocorrelation period) + `shutter_bottom_bar.webp` 1024×115. |
| `derive_cards.py [buycards splash maxwin]` | One 1536×1024 painting per mode serves both cards. `buycards/{ante,backdraft-spins,alarm-call,rescue,inferno}.webp` 768×512 come from `window(zoom,fx,fy)`; the contact sheet shows the ~271×80 HUD strip. `splash/card_{chief,lines,backdraft,alarm,rescue,maxwin}.webp` are 768² square crops, and the splash payload must stay ≤ 1.2 MB. `maxwin/max_win_card_16x9.webp` 1600×900 and `_portrait.webp` 900×1400, with `maxwin/manifest.json` holding `titleSafeArea` and a measured **calm ratio** (over 0.6 means the title area is busy). The splash manifest (the frontend's mirror) is checked for coverage but never edited. Override the defaults with `--spec`. |
| `derive_rescue.py [rooms props cells]` | `rooms`: each same-framing state edit (`scene/rooms_fire2`, `rooms_fire1`, `rooms_safe`, `scene/inferno_rooms_*`) is ECC-registered onto its plate (`scene/plate_rescue_16_9` / `plate_inferno_16_9`) and colour-matched on the static parts; every room keeps only the changed pixels touching its window (feathered; the window itself always opaque). Writes `features/rescue/room_<r>_{roaring,smouldering,safe}.webp` + `room_<r>_inferno_<state>.webp` (r = reel 0..4, one shared box per room), `block_facade(_inferno).webp` (the window band, for the building band above the frame) and `rooms.meta.json` (boxes + windows in plate, facade and environment px; portrait window centres + scale). `props`: `ladder_segment` (whole rung periods, seamless vertical repeat), `ladder_top`, `jump_sheet`, `badge_blank`, `spins_plate_blank`, `hose_nozzle`, `hose_segment` (seamless horizontal repeat), `water_jet`, `water_splash`, `steam_puff` + `props.meta.json`. `cells`: `ui_scene/cell_frame_{plain,win,locked}.webp` 384² + `line_plate.webp` + `cells.meta.json` (hole fractions). Blank plates/badges carry runtime text. `--map` overrides any source key. |
| `derive_winrungs.py [titles signs pieces coins fx]` | `titles`: BIG / HUGE / MEGA / EPIC / MAX WIN PNGs + outlined/live SVGs in `art-src/winrungs/titles/`. `signs`: `winrungs/signs/<rung>.webp` 1200×728 on the flat_manifest geometry (board 1139.4×364.3 at (600,338.3), plank 901.7×187.2 at (600,634.2); `--plank-w 820` matches the placeholder), built from one plaque sheet (5 boards on the top row, 2 bars below, `--crest epic,max`) and hung on brass chains; it writes `flat_manifest.json`. `pieces`: 10 items from one 5×2 sheet, each a 2D spin of 24 frames in 128 px cells on 8 columns (1024×384) + json, plus a 96 / 48 px blind-test sheet. `coins`: `winrungs/coins/coin_sheet.webp` 1024×512 (32 frames) + `coin_sheet.json` (animation `coin`), in its own dir so it never collides with the 24-frame `pieces/coin_sheet.webp`. `fx`: this title's own procedural additive textures (flare 1024×128, water-ripple ring 512, 8-point glint 256, steam puff 256, searchlight wedge 256×512). |
| `compose_plaques.py` | Local, free: lifts the raw pieces of the two paid plaque sheets (`winrungs/rung_plaques_a`: big, huge, mega boards + plain bar; `winrungs/rung_plaques_b`: epic board + gold bar; its MAX board is replaced by the redraw `winrungs/rung_plaque_max_r2`) onto `art-src/winrungs/plaques/rung_plaques_composite.png` in the 5-over-2 layout `derive_winrungs.py signs` reads by default. The boards were drawn stacked (~900 px wide) so the 1139 px title board is only ~1.2x upscaled. |
| `make_wordmark.py` | PIGGY FIREFIGHTERS, 1366×654 RGBA: yellow PIGGY with a red extrusion on a fire ladder, cream FIREFIGHTERS with a brass extrusion, ink outline, ink counters. Writes `branding/wordmark.png`, `art-src/branding/wordmark_master.png` and `wordmark.svg` (groups: live-text, ladder-accent, outline-extrusion, ink-outline, typography-faces). |
| `make_thumbnails.py` | PF-THUMB-01. `thumbnail/{foreground,background,preview}_{3_4 1536x2048, 16_9 2048x1152}.png`. The background is procedural flat-cel 3-tone from one exact hex (`--bg`, tones derived or `--tones`), or a painting (`--bg-34/--bg-169`) snapped to that hex. Review renders at 120×160 / 320×180 (+2× and grey) with a title mock go in `thumbnail/review/`. `thumbnail/source-record.json` holds hero provenance (rows looked up in the art record), hex/RGB/tones, sha256 + alpha inspection per file, and the checks: sizes/modes, genuine alpha, 5 % inset, title zone clear, exactly one figure, low-colour background, face readable. It never edits Codex's `thumbnail/instructions.md`. |
| `verify_art.py` | Audits `static/assets/<family>/**`. It FAILS any file byte-identical to **any** LUCKY donor runtime file or to an `art-src/reference` image. It checks exact sizes and modes, genuine alpha (4 clear corners for sprites; alpha may stay below 255 only for additive FX), the 88 % / 86×92 symbol boxes, manifest coverage (missing files and orphans), the expected inventory (PENDING, or FAIL with `--require`) and the budgets. `--families`, `--root`, `--report`. Exits 1 on FAIL. |
| `tests/selftest.py` | Runs every tool on synthetic PNGs (`tests/synthetic.py`) in a temp dir, and runs `gen_art.py` against a local mock API (`tests/mock_api.py`, hooks `PF_ART_GEN_DIR` / `PF_ART_API_BASE`, dummy key). No spend and no repo writes. Current result: 25/27 PASS (~100 s); the two symbol steps fail because the synthetic symbol map has no `W_b`, so `symbols.sources.json`'s real `sym_sq_w_b` is picked up (17 tiles instead of 16) — a test-isolation gap, not a derive bug. |

## Source names (the default maps)

Accepted raws are addressed as `<batch>/<name>` under `art-src/generated/`. The defaults can be overridden per tool
with `--map` / `--spec`, or registered once in `art-src/generated/symbols.sources.json` and
`symbols_tall.sources.json`.

| Consumer | Default source |
|---|---|
| square / tall symbols | `symbols/sym_sq_<id>` / `symbols/sym_tall_<id>` (`h1…l4, w, w_blaze, alarm, galarm, h1_b…h4_b`) |
| scene | `scene/plate_<mood>_16_9`, `scene/plate_<mood>_portrait`, `scene/board_frame` (→ `_r2` via `scene.sources.json`), `scene/cell_backplate`, `scene/shutter` |
| rescue / cells | `scene/rooms_*`, `scene/inferno_rooms_*`, `scene/rescue_props_{a,b}`, `scene/ui_frames` |
| cards | `cards/card_{ante,backdraft,alarm,rescue,inferno,chief,lines}`, `cards/maxwin_16_9`, `cards/maxwin_portrait` |
| win rungs | `art-src/winrungs/plaques/rung_plaques_composite.png` (from `compose_plaques.py`), `winrungs/rung_pieces` |

## Order for a full rebuild (all local, no spend)

```
python3 tools/art/derive_symbols.py --bonus-tag && python3 tools/art/derive_symbols_tall.py --bonus-tag
python3 tools/art/derive_scene.py env frame backplate      # backdraft has its own painting now
python3 tools/art/derive_rescue.py
python3 tools/art/derive_cards.py
python3 tools/art/compose_plaques.py && python3 tools/art/derive_winrungs.py   # titles -> signs -> pieces -> coins -> fx
python3 tools/art/make_wordmark.py
python3 tools/art/make_thumbnails.py --hero <accepted hero> --bg '#RRGGBB'
python3 tools/art/verify_art.py
```

## Registration notes for the frontend lane (not done by these tools)

`game/assets.ts` / `assetsScene.ts` still point at `static/assets/placeholder/**`, and those paths and names differ
from the family dirs above. When the frontend switches over:

| Placeholder | Our output |
|---|---|
| `symbols/h1.webp` | `sprites/symbolsCartoon/sym_H1.webp` |
| `rungs/sign_big.webp` | `winrungs/signs/big.webp` |
| `rungs/piece_coin_sheet.webp` | `winrungs/pieces/coin_sheet.webp` |
| `coins/coin_sheet.{webp,json}` | `winrungs/coins/coin_sheet.{webp,json}` |
| `scene/bg_base_*` | `environment/base_*` |
| `fx/cell_frame.webp` (win_cell_frame) | `ui_scene/cell_frame_win.webp` |
| RescueScene Graphics (block, windows, badge) | `features/rescue/**` per `rooms.meta.json` / `props.meta.json` |

The keys stay the same. The WILD badge rect measured in the manifest must match `symbolMotion.WILD_BANNER.square`.
