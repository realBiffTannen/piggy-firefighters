# Rig parts: common registration, r2 (art lane → Codex Spine lane)

These notes cover the four rigs in `docs/ANIMATION_CONTRACT.md` (`pf_chief`, `pf_rookie`, `pf_dog`, `pf_rescued`). Every
image is original art from paid gpt-image edit calls (47 calls, `source-record.json` here; every HTTP attempt is also in
`art-src/generated/source-record.json`). **r2 made no paid call.** It is local, deterministic re-processing of the same
raw outputs (`art-src/generated/rig_<rig>/`, never edited). Masters and sheets are immutable inputs: r2 verifies each
master is the integer shift of its raw master and never rewrites a master or a sheet.

Scripts: `build_parts.py` (pipeline), `cut_sheets.py` (fixed-grid sheet cutter), `derive_r2.py` (derived layers),
`register_parts.py` (the r1 fit, reused), `make_anchors.py`, `make_inventory.py`. Parameters that were read by eye
are data, not code: `<rig>/sheets.layout.json` (cell rectangles, labels, cut rules, per-family scales) and
`<rig>/derive.layout.json` (belt bands, leg seeds, skin-slot overrides, helmet cut). Every file is written to a temp
file in its own directory and renamed into place; a file whose decoded pixels did not change is not rewritten.

## What r2 fixed (r1 defects from ART_REPORT.md, INVENTORY.md and Codex's pixel review)

| r1 defect | r2 fix |
|---|---|
| The component-clustering cutter mislabelled pieces: `eyes_open` had one eye plus a brow, `brows_level` had eyes, `moustache` and both ears carried the mouth | **Fixed-grid extraction.** Every sheet was LOOKED at, and its grid and label map are written in `<rig>/sheets.layout.json`. Cell boundaries sit in the measured transparent gutters. A component belongs to the cell that holds its centroid, and a per-cell rule then decides what is kept (below). Nothing is clustered |
| `coat_tails` was the separate coat edit at raw scale, about 216x96 on the chief's body instead of about 580x200 | Cut from the **registered body's own pixels**, from the belt's middle line to the hem. It is at master scale by construction: chief 577x230, rookie 330x196 |
| The split legs were registered undersized, with soles at y≈1395 (chief) | `leg_right` / `leg_left` are cut from the registered body's own leg pixels, with soles moved onto **y 1440** (chief +2 px, rookie +4, rescued +1). The top of each leg extends straight up to 140 px under the hem as hidden overlap for rotation |
| `body_no_head_no_arms` repeated the legs, so the boots doubled when stacked | The body no longer contains the legs (and, for chief/rookie, stops at the belt). Every pixel of the lower body is in exactly one layer |
| Light seam across the helmet where `helmet_front` met the head (chief, rookie) | `helmet_front` is cut from the **master's own pixels** inside the registered helmet, so at rest it is the master and has no seam. Ember's helmet_front is rebuilt the same way |
| Chief's raised fingertips clipped (86 rows at x 0, 15 at x 1023) | Each raised arm is rotated about its recorded shoulder pivot by the smallest angle that keeps a 4 px margin: right +4.75°, left −1.25°. Shoulder caps are unmoved |
| Rookie `head_blank` locked onto the eye (s 0.345, visibly tiny) | Re-fitted to the registered `head_no_helmet` (s 0.656). The overlay was reviewed: cranium, snout and neck coincide |
| Dog legs were one layer | Four layers: `leg_hind_right`, `leg_hind_left`, `leg_front_right`, `leg_front_left` (below) |
| Rescued skins were full figures, not slots | Each skin is cut into the template's six slots on the same canvas: `skins/<skin>/{head, body_no_head_no_arms, arm_right, arm_left, leg_right, leg_left}.png` |
| One scale per sheet (r1) was wrong by up to 2x: the model drew each sheet row at its own size | **One scale per family** (eyes, brows, mouths, ears, hands, ...), measured on a reference piece against the master with a reviewed overlay, or set by eye where no counterpart is visible |

Not changed (reasons in Open items): the rookie master, the dog body redraw, the chief `head_blank` crown.

## The common canvas

| Item | Value |
|---|---|
| Canvas | **1024 x 1536 RGBA** for every master, part, derived layer and skin slot |
| Feet line | **y = 1440**: the lowest opaque row of the master (soles or paws) |
| Feet centre / root pivot | **x = 512**: the centre of the soles in the bottom 2 % of the figure (Ember: bottom 5 %, so all four paws count) |
| Spine coordinates | `spine_x = (x - 512) * scale`, `spine_y = (1440 - y) * scale` (Spine y points up) |
| Scale to the contract size | `scale = runtime height / master height_px`, in each `<rig>/anchors.json` |

| Rig | Master height (px) | Contract height | `scale` | Master bbox (x0, y0, x1, y1) |
|---|---|---|---|---|
| `pf_chief` | 1423 | 420 px | 0.29515 | 42, 18, 977, 1440 |
| `pf_rookie` | 1441 | 380 px | 0.26371 | 177, 0, 849, 1440 (the crown touches y 0; see Open items) |
| `pf_dog` | 1195 | 220 px | 0.18410 | 45, 246, 993, 1440 |
| `pf_rescued` | 1313 | 260 px | 0.19802 | 51, 128, 939, 1440 |

**How each file lands on the canvas.**
- Masters are moved by whole pixels only (`raw_shift`).
- Same-framing parts keep their r1 fit (uniform scale plus translation, fitted on colour-label agreement) and are re-placed from the raw output, bit-identical to r1. `build_parts.py --refit` re-runs the fit.
- Skins are placed by their feet. `twins` is scaled 0.961.
- Derived layers (`coat_tails`, the legs, `helmet_front`, the dog legs, the skin slots) are pixel subsets of an already registered layer or of the master. The only exceptions are the integer sole shift and the rotated raised arms.

Each record is in `<rig>/registration.json`: fits, derived-layer methods and parameters, the superseded r1 raw edits, and every piece's cell, rule, dropped components and scale.

## Sides and naming

The cast faces three-quarter toward screen-right. The limb on the **image-left** is the character's **right** (near side):
`arm_right`, `leg_right`, `hand_r_*`, and for Ember `leg_hind_right` and `leg_front_right`. The image-right limb is the character's **left**. On the hand sheets, the top row holds the right hands and the bottom row the left.

## Layers per rig (back to front) and what each contains

- **pf_chief / pf_rookie:** `leg_right` → `leg_left` → `coat_tails` → `body_no_head_no_arms` → `arm_left` → `head_no_helmet` (or `head_blank` plus face pieces) → `helmet_front` → `arm_right`.
  - `body_no_head_no_arms` keeps the torso down to the belt's bottom outline and the curly tail.
  - `coat_tails` starts at the belt's middle line, so its cut edge hides under the belt.
  - `legs` is the two legs on one layer.
  - `helmet_only` is the complete helmet with the painted navy lining. Use it when the helmet leaves the head.
  - Props go on their hand bone:
    - Chief: `pieces/bugle`, `pieces/nozzle`, `pieces/badge_blank` (blank, lettered by the runtime; v1.3) and `pieces/shield_plate`.
    - Rookie: `pieces/hose_flexible`, `pieces/hose_coil`, `pieces/card_blank` and `pieces/card_back`.
  - The raised arms are `arm_*_raised`, with the pivot `shoulder_pivot` in `registration.json`.
- **pf_dog:** `leg_hind_left` → `leg_front_left` → `leg_hind_right` → `leg_front_right` → `body_no_head_no_legs` → `head_no_helmet` → `helmet_front`.
  - The four legs come from the registered legs layer. Separate legs are separate components.
  - The near front leg overlaps the far hind leg. They are split by a marker watershed on the dark-red outline, with one seed per leg in `derive.layout.json`. The black spots count as fur.
  - The near front leg keeps the outline it shares with the far hind leg. The hidden part of the far hind leg is not painted: it is covered at rest.
  - `legs.png` (all four) is kept.
  - `parts_sheet` pieces: `ear_left`, `ear_right`, `tail`, `jaw` (open bark), `head_no_jaw` and `tongue`.
- **pf_rescued:** `leg_right` → `leg_left` → `body_no_head_no_arms` → `arm_left` → `head` (or `head_blank` plus face pieces) → `arm_right`.
  - The trousers meet at the crotch. The legs are separate regions below the crotch apex and are cut vertically through the apex above it.
- **Skins** (`skins/<skin>/`, the same six slot names and canvas as the template):
  - Each skin is split into cells, the flat-colour regions between ink lines. A cell goes whole to the template slot that holds at least 80 % of it. A small cell (4,000 px or less: a finger, a stripe) goes whole to its majority slot. A large straddling cell is split on the template boundary.
  - Ink goes to the front-most neighbouring slot. Crumbs under 2,500 px join the slot they touch most.
  - Override polygons in `derive.layout.json` keep each skin's extras on the right slot:
    - grandma: the cat, and the skirt and cardigan hem, stay on the body
    - twins: the piggyback twin, his arms and both hands, and the tail stay on the body; the lower twin's head is the head; the arms follow the 0.961 skin scale
    - dad: the robe skirt and shawl collar are body
    - baby: the baby and the sling are body
    - teen: the rolled hood is body
  - Review: `qa/art/parts/pf_rescued_skin_slots_r2.png` tints the slots.

## Sheet pieces (`<rig>/pieces/`): fixed grid

The cell rectangles are in `<rig>/sheets.layout.json`. Each piece is the sheet pixels of its kept components only, never a rectangle crop, trimmed to the alpha bbox + 4 px. `sheet_origin` is the piece's top-left in the sheet. Rules per cell:

| Rule | Keeps | Used for |
|---|---|---|
| `eyes` | BOTH eyes: the two largest components that are not brows. A brow is a solid dark stroke with another component below it; brows come only from the brow row | every `eyes_*` |
| `brows` | the brow pair (two largest components) | every `brows_*` |
| `mouth` | the mouth: the largest component plus its own creases (solid ink strokes within 30 px and under 15 % of its area, such as corner dimples or a lip arc) | every `mouth_*` |
| `single` | the single largest component | ears, moustaches, dog ear/tail/jaw/tongue |
| `hand` | the whole hand | every `hand_*` |
| `plate` | the plate plus anything inside its box | `badge_blank`, `shield_plate`, `card_blank` |
| `whole` | everything in the cell | props, wave arms/hands, `head_no_jaw` |
| `figure` | the figure by its own component mask (the three slide poses interlock in x) | `pose_*` |

Dropped components are listed per piece in `registration.json`. The only drops are the brows in the chief's four eye cells and the rookie's eyes_open / eyes_closed / eyes_dart cells, as designed. Ember's, the rescued's and the rookie's eyes_happy cells hold no brows. Every sheet has 0 components outside every cell.

**Scale to the canvas, per family** (multiply the piece by this; each value was checked with an overlay on the master):

| Rig | Family (sheet) | Scale | Measured by |
|---|---|---|---|
| chief | eyes (face) | 0.65 | fit of `eyes_open`'s near eye on the master. The far eye sits about 20 % wider apart on the master than on the sheet |
| chief | brows (face) | 0.53 | the master's near brow width vs `brows_level`'s |
| chief | mouth (face) | 0.70 | by eye: `mouth_open` under the master's moustache at 0.6 / 0.7 / 0.8 |
| chief | moustache (face) | 0.93 | by eye: tip-to-tip width of the master moustache (fits 0.84 / 0.96 bracket it) |
| chief | ears (face) | 0.40 | fit of `ear_left` on the master ear (foreshortened, under the brim) |
| chief | hands | 0.47 | by eye: `hand_r_open` over `arm_right`'s hand at 0.45 / 0.55 (r1 area measure 0.55 read too big) |
| chief | props | 0.574 | fit of `shield_plate` on the helmet plate. At this scale the nozzle's hose is 80 px thick on the canvas and the grip hole is 32 px: resize the nozzle by eye if it must pass through the fist |
| rookie | eyes / brows / mouth / ears (face) | 0.60 / 0.50 / 0.32 / 0.45 | fits and widths on the master, overlays reviewed |
| rookie | hands | 0.45 | by eye: `hand_r_open` over `arm_right`'s hand |
| rookie | cards (props) | 0.45 | assumed equal to the hands (the pinch hand holds the card) |
| rookie | hose (props) | 0.237 | so the hose (91 px thick on the sheet) passes the grip hole (48 px on the hands sheet x 0.45) |
| dog | eyes / brows / mouth (face) | 0.90 / 0.87 / 0.85 | fits and widths on the master; mouth by eye over the muzzle |
| dog | parts | 1.19 | fit of `head_no_jaw` over the master head (1.187: ears, eyes and nose coincide) |
| rescued | eyes / brows / mouth / ears (face) | 0.70 / 0.66 / 0.52 / 0.66 | fits and widths on the master; mouth and ears by eye |
| rescued | wave arms | 0.896 | length and area of `arm_right` vs `wave_arm_up` (approximate: poses differ) |
| rescued | wave hands | 0.62 | by eye: `wave_hand_front` over `arm_right`'s hand |
| rescued | poses | 1.972 | shirt-cream area of the master vs `pose_cheer` (reference poses) |

Face pieces still need a final by-eye placement on `head_blank`. The sheets were drawn independently of the face, so eye spacing and brow arc differ slightly from the master.

## Anchors (contract bones), from `<rig>/anchors.json`

| Rig | Anchor | Where (measured) | Bind to |
|---|---|---|---|
| pf_chief | `head_top` | canvas (541.5, 18), the helmet crown; spine (8.7, 419.7) | head bone |
| pf_chief | `nozzle_tip` | `pieces/nozzle.png` (768, 97.5), the muzzle centre on the nozzle's x axis (piece scale 0.574) | nozzle bone (child, rotates with it) |
| pf_chief | `grip_r` / `grip_l` | `pieces/hand_r_grip.png` (178.6, 217.4) / `hand_l_grip.png` (127.8, 210.8), the centre of the empty fist tunnel (piece scale 0.47) | the hand bones |
| pf_rookie | `sheet_r` / `sheet_l` | `pieces/hand_r_catch.png` (268, 236) / `hand_l_catch.png` (30, 255), the fingertip point farthest from the cuff (piece scale 0.45) | the hand bones |
| pf_dog | `sheet_r` (and `sheet_l`) | canvas (861, 751), the front of the mouth under the nose; spine (64.3, 126.8) | jaw bone |
| pf_rescued | `feet` | canvas (512, 1440) = the root pivot; spine (0, 0) | root; time the `land` event to contact |

## Review evidence (`qa/art/parts/`)

- `<rig>_pieces_r2.png` shows every piece at 2x on mid-grey, with its file name and caption (sheet row/col, rule, kept/dropped components, scale). Every label was checked against its content by eye.
- `<rig>_layers_r2.png` shows every canvas layer (and skin slot) trimmed, at 0.5x, with its canvas bbox.
- `<rig>_reassembly.png` puts the master on the left and the r2 layers stacked in rig order on the right, with the feet line in red. Silhouette IoU with the master:

  | Rig | IoU | Note |
  |---|---|---|
  | chief | 0.967 | the bugle is not a body layer |
  | rookie | 0.950 | |
  | dog | 0.932 | the r2 body redraw differs from the master; the tail is a piece |
  | rescued | 0.984 | |

- `<rig>_<layer>.png` overlays each r2 layer on the faded master. `pf_rescued_skin_slots_r2.png` shows the tinted slot map per skin.
- The r1 `<rig>_contact.png` sheets are superseded. They show the mislabelled r1 pieces and are kept only as history.

## Open items (need a decision or Spine-side work; none needs a paid call unless stated)

- **Rookie master "down 12 px" was not applied.**
  - The raw master's top rows are y 40–42 with alpha ≤ 44/255, so only one faint antialias row is lost at y 0.
  - Moving the master 12 px down would put the soles on y 1452, off the contract feet line, and masters are immutable in this pass.
  - `helmet_only` keeps its crown from y 1. `helmet_front` (cut from the master) touches y 0 like the master.
- **Dog body (`body_no_head_no_legs`, the r2 redraw)** is longer and lower than the master. Either nudge it in Spine or order a same-framing redraw (one paid call, for a named defect). That is the coordinator's decision.
- **Chief `head_blank`** has a lumpy crown, hidden under the helmet.
- **Hidden areas:** the far hind leg under the near front leg (dog) and the lower twin's head behind the rider are not painted. They are covered at rest, and hiding them in motion is an authoring task.
- **Chief nozzle vs grip:** at the measured prop scale, the nozzle's hose (80 px) is wider than the grip tunnel (32 px). Scale the nozzle by eye in Spine, or keep the hose passing behind the fist.
- **Foreign files (not part of this delivery; left untouched):** `pf_chief/QA_reassembly.png` (RGB, belongs under `qa/art/parts/`) and `pf_chief/pieces/shield_13.png` (lettered "13").
