# pf_rescued — the Trotter family rig

One Spine 4.2.43 skeleton, five skins (`grandma`, `twins`, `dad`, `baby`, `teen`), 260 px
standing, root = feet centre, anchor bone `feet`, event `land`. Clips: `wave_window` loop
2.6 s · `slide` once 1.2 s · `land` once 0.6 s (`land` at 0.04 s) · `cheer` loop 1.2 s.
Original Piggy Firefighters art only (Claude's registered r2 parts under
`art-src/animation/parts/pf_rescued/`); no paid call, no repainted pixel, no lettering.

## Pipeline (Chief pattern)

1. `python3 -B layout_rescued.py` — measures `rescued-layout.json` against the registration
   hash: shared bone points (hips, chest, leg pivots), every skin's neck and shoulders (from
   `anchors.json`), hand centres (alpha centroid of the bottom 120 rows of each arm slot) and
   the BY-EYE mouth centre of each skin's baked smile. Grandma waves with her image-right arm
   because the cat rides the other shoulder, and that shoulder's raise is capped at 40°.
2. `python3 -B author_rescued.py --output drafts/vNNN` — freezes byte-identical copies of the
   34 source PNGs (skin slots renamed `<skin>_<slot>.png` so one atlas holds all five skins),
   builds the rig and writes `pf_rescued.json` (`skeleton.spine` 4.2.43, `images` `./images/`)
   plus `source-record.json` with every source hash. Refuses to overwrite a draft.
3. Round trip under the shared CLI lock (`mkdir art-src/animation/rigs/.spine.lock`): import
   into a NEW `pf_rescued.spine`, export with `rescued.export.json` (pinned preset: straight
   alpha, 1×, pages ≤ 2048, strip whitespace, bleed), then
   `node finish_export.mjs drafts/vNNN/export drafts/vNNN/runtime` derives the CLI-omitted
   `skeleton.x/y/width/height` as the union of the five skins' setup bounds
   (spine-core 4.2.74) and copies the native atlas/pages unchanged.
4. Install `runtime/pf_rescued.{json,atlas}` and the pages at
   `apps/piggy_firefighters/static/assets/spine/pf_rescued/`; gate:
   `python3 art-src/animation/tools/check_contract.py --rig pf_rescued`.

## Rig design

- Bones: `root` → `feet`, `hips` (→ `chest`), `leg_r`, `leg_l`; then per skin
  `head_<skin>`, `arm_r_<skin>` → `hand_r_<skin>`, `arm_l_<skin>` → `hand_l_<skin>` at that
  skin's own measured joints (the twins' neck sits 75 px and shoulders ~155 px below the
  template's, so shared pivots would have thrown their arms off the body).
- Slots (back to front): `leg_left`, `leg_right`, `arm_left`, `body`, `head`, `mouth`,
  `arm_right`, `wave_hand`. Skins add no slots. Every attachment is a four-vertex weighted
  mesh bound to the skin's own bone, with the hull hugging the painted box so the packer
  strips the transparent canvas (a full-canvas hull produced 31 pages; this one packs into
  2 × 2048² + 1024 × 512).
- Faces: each skin's head keeps its baked features; the shared open mouths
  (`mouth_call` 0.78, `mouth_cheer` 0.60, `mouth_o` 0.75 of sheet scale) are laid per skin
  over the baked smile so they cover it. Eye/brow overlays are not used: they would not
  cover the baked eyes (grandma's glasses, teen's lids) and would double up.
- The open palm `wave_hand_front` (0.68) rides the waving hand bone, pre-turned 150° so it
  reads upright with the arm raised; it covers the baked closed hand.
- Acting: wave = call (arm raised, hand flapping, `mouth_call`, head and chest toward the arm,
  urgent bob) then a held silhouette with breathing; slide = arms up and legs kicked out with
  body bumps, then arms down to brace and legs gathered for contact (the runtime moves the
  actor); land = compress at 0.14 s, rebound past neutral, settle; cheer = arms pumping out
  of phase over four torso hops, head rocking, `mouth_cheer`. Root never keyed.

## v001 evidence (2026-09-25)

- Import and export through Spine 4.2.43 CLI: Complete, no warnings. 34 atlas regions.
- `check_contract.py --rig pf_rescued`: PASS (18–22 moving bones per clip, `land` keyed,
  `feet` present, five skins exactly, root neutral).
- Viewer sanity (`qa/codex/rig-viewer/pf_rescued-final/`, muted headless Chromium at quarter
  speed, 12 paused frames across all five skins, `contact-sheet.png`): all parts attached,
  feet on the baseline at the anchor, 260 px ruler matched, cat and rider travel with their
  bodies, palm and mouths land where measured, `land` event logged at 0.040 s, no page errors.
- Not run: recorded per-clip motion review, mounted gameplay/ladder travel, phone layout,
  interruption and reduced-motion review. This is a static-gate-passing, viewer-sane rig,
  not a motion-accepted one.
- The draft's `export/` and `runtime/` PNG pages are not committed; the installed pages are
  byte-identical to the native export (hashes in `runtime/source-record.json` → `pages`, and
  verified with shasum at install).
