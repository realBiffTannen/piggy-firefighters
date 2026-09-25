# Rig parts: common registration, r2.1 (art lane → Codex Spine lane)

These notes cover the four rigs in `docs/ANIMATION_CONTRACT.md` (`pf_chief`, `pf_rookie`, `pf_dog`, `pf_rescued`). Every
image is original art from paid gpt-image edit calls (47 calls, `source-record.json` here; every HTTP attempt is also in
`art-src/generated/source-record.json`). **r2 and r2.1 made no paid call.** They are local, deterministic re-processing
of the same raw outputs (`art-src/generated/rig_<rig>/`, never edited). Masters and sheets are immutable inputs: the
build verifies each master is the integer shift of its raw master and never rewrites a master or a sheet.

Scripts: `build_parts.py` (pipeline), `cut_sheets.py` (fixed-grid sheet cutter), `derive_r2.py` (derived layers and
the r2.1 fixes), `register_parts.py` (the r1 fit, reused), `make_anchors.py`, `make_inventory.py`. Parameters that were
read by eye are data, not code: `<rig>/sheets.layout.json` (cell rectangles, labels, cut rules, per-family scales) and
`<rig>/derive.layout.json` (belt bands, leg seeds, skin-slot overrides, helmet cut, the r2.1 corrections and derived
pieces, each with its reason). Every file is written to a temp file in its own directory and renamed into place; a file
whose decoded pixels did not change is not rewritten. `python3 tools/art/check_images.py` passes on every output.

## What r2.1 fixed (the verifier's r2 findings)

| r2 defect | r2.1 fix |
|---|---|
| **Ears named by image side.** `ear_left` was the image-left ear on all four rigs (the prompt's "his left ear" was drawn as the viewer's left), against the convention of every other sided part | The two ear labels are swapped in each `sheets.layout.json` (face_sheet r3 c2/c3 chief and rookie, r3 c0/c1 rescued, parts_sheet r0 c0/c1 dog) and re-cut: `ear_right` is now the image-left ear. The same two files swapped names; their pixels are unchanged |
| Ember `head_no_jaw` was a whole head with a painted open mouth, tongue, lower lip and chin (two jaws with `jaw`) | The cell keeps its true name `head_open_smile` (a whole-head swap, never stacked with `jaw`). `head_no_jaw` is **derived** from it: inside a by-eye polygon, the lower lip line, the chin and the head outline under it are masked away, the dark mouth interior is kept (the tongue repainted with the interior's own colour) and the cut through the fur is closed with the head's own outline ink (`derive.layout.json` `pieces`, method and numbers in `registration.json`) |
| Ember `mouth_*` carried the black nose and an opaque cream patch (two noses on the head) | Renamed `muzzle_*` (family `muzzle`): opaque muzzle overlays that include the nose, registered **nose-on-nose** with `head_no_helmet`. Their scale is set by the noses (head nose 117 px wide, sheet noses 108-116): **1.05** (r2: 0.85, which left the head's nose rim showing). `anchors.json` `guidance.muzzle_nose` gives the head's nose centre and each piece's nose centre |
| Twins body slot carried the rider twin's head (the "no head" name misleads); unpainted band behind the lower twin's head | Kept in the body slot: the contract allows no skin-only slot. Documented here, in INVENTORY and in `anchors.json`: the twins' head slot must stay at or near rest (see the joints row below) |
| Twins `arm_right` was a bare forearm (the striped sleeve stayed on the body); stray strokes and ragged tops on the skin arm slots | A sleeve override moves the near sleeve from the shoulder cap to `arm_right`. Slot outline ink now goes to the front slot only within 6 px of the nearest cell (`ink_tol_px`), thin strays hanging off an arm are handed to the slot they touch (`arm_spur_px`), and four by-eye `reassign` polygons send the remaining strays (twins torso side line, baby strap edge, grandma placket stroke and button rim) to the body. Reviewed on `pf_rescued_skin_slots_r2.png` and per-slot renders |
| Ember `helmet_front`: binary alpha, outer ink ring 3-17 px short, the grey shadow under the brim replaced by white fur, a hole at x 850 | The kept mask grows 8 px through the master's own outline ink and antialias edge (alpha copied, 1094 partial-alpha pixels), then through the master's shadow-coloured pixels under the brim (14-20 px deep). The crown now matches the master at every column checked (x 408-850) and the ±6 px band has 570 px more than 40 levels lighter than the master, all in the head redraw's own ear outline under the brim (r2: 2177 by the same measure) |
| Ember `leg_front_left` top showed beside the chest (4636 px outside the master) | Above y 1120 the leg keeps only what the body covers or the master shows (4418 px clipped); `legs.png` loses the same pixels (1117 px outside the master, all below y 1120) |
| Rookie `coat_tails` 8 px low and 30 px too wide per side | Cut from the **master's own pixels** from the master's belt middle line to the hem (cells of the master assigned to the registered slots). At y 880-950 the stack equals the master except 42 of 15584 coat pixels; best shift (0, 0), colour error 0 |
| Rookie legs 3 px low, boots 8-13 px narrow | Cut from the master's own leg pixels below the hem, hidden tops extended 140 px under the coat/body and never outside them. Best shift (0, 0), error 0; at y 1360 / 1400 the stack spans exactly the master's 194-833 / 177-849 |
| Rookie torso "12-16 px wider on the image-right side" | Measured per layer, that overhang is the far sleeve `arm_left` (x 759 vs 743 at y 720), plus the body's collar and shoulders above it. What shows at rest outside the master silhouette is trimmed and the new edge takes the master's own outline pixels (`edge_to_master`): arm_left 5058 px, body 7270 px. The master's curly tail replaces the redraw's (10-15 px apart). Rookie IoU 0.950 → 0.991 |
| Rookie hands 25-30 % small (0.45); cards and hose followed | Hands **0.60**, cards **0.60**, hose **0.316** (0.60 x 48 / 91). `anchors.json` sheet_r / sheet_l use the new scale |
| Chief `head_blank` 12-27 px low (r1 fit, score 0.538) | A similarity correction (scale 1.005, dx -4, dy -17 about the nostril midpoint) found by matching the nostrils and the jaw/chin/neck outline to `head_no_helmet`: chin at x 500 on y 581 (head 582), 1474 px outside the head (was 4563). Overlay reviewed |
| Chief hands maybe small (0.47) | Hands **0.58**: navy cuff length across the forearm gives 0.54-0.64, pink area 0.57-0.60, side-by-side review at 0.47/0.55/0.58/0.62. `grip_r`/`grip_l` tunnel is 39 px on the canvas (was 32) |
| Rescued dad soles on y 1442-1443 | Every skin is snapped by a whole-pixel shift so its lowest alpha>128 row is y 1440 (the contract's feet measure, as for the master): dad -3, baby +1, teen +1, grandma 0, twins 0 (`sole_snap_px`). Grandma's faint row at 1441 is antialias, like the master's own row at 1441, so she is not moved |
| Dad's head slot held the chest inside the robe's V | A pixel override sends the head slot's pixels below y 586 to the body |
| Twins slots do not line up with the template pivots | `registration.json` `skin_slots.joints` and `anchors.json` `guidance.skin_joints` give each skin's neck and shoulder points and their offsets from the template: twins neck +84 / +75 px, shoulders +150-160 px lower. The twins are rest-pose (or near-rest) for head and arm motion unless Codex gives that skin its own bones |
| Chief `arm_left` shoulder cap bulged out of the master (7784 px) | `edge_to_master`: trimmed where it showed outside the master and closed with the master's outline; the chief body's far shoulder, which the bulge had hidden, is fitted the same way (1833 px). At y 560/600/640 the stack's right edge is 725/771/806 (master 724/770/806). Chief IoU 0.967 → 0.978 |
| Rescued `head_blank` chin 3-9 px low | Moved up 5 px (dy -3..-8 compared): chin at x 500 on y 573 (head 573), 2131 px outside `head.png` (was 2607); the jowl at x 600 is the blank's own drawing |
| Chief `pieces/shield_13` orphan, lettered from the r1 plate | Re-lettered from the r2 `shield_plate` by `tools/art/letter_shield.py` (alpha now identical to the plate) and registered as a derived piece (same sheet origin, cell and props scale 0.574, lettering parameters). Contract v1.3: the rig uses the blank `shield_plate`; `shield_13` is the ART_HERO lettering for static uses |
| `pf_chief/QA_reassembly.png`: stale r1 QA image in the delivery folder | Moved to `qa/art/parts/pf_chief_reassembly_r1.png` (the coordinator should `git rm` the old tracked path) |
| Stale r1 contact sheets under current-looking names | Renamed `qa/art/parts/<rig>_contact_r1_superseded.png`; the authoritative sheets are named below |
| 1-9 px fragments in layers | Islands are now counted 4-connected (a pixel that touches its layer only diagonally is detached). Skin crumbs go to the slot they touch most; every canvas layer and piece is checked: **no island under 30 px** remains (the rookie's raised far arm lost five 1-px specks) |
| `source-record.json` provenance stuck at r1 | r2 and r2.1 `local_processing` entries added (scripts, layout files, what was read by eye) |

## What r2 fixed (r1 defects from ART_REPORT.md, INVENTORY.md and Codex's pixel review)

| r1 defect | r2 fix |
|---|---|
| The component-clustering cutter mislabelled pieces: `eyes_open` had one eye plus a brow, `brows_level` had eyes, `moustache` and both ears carried the mouth | **Fixed-grid extraction.** Every sheet was LOOKED at, and its grid and label map are written in `<rig>/sheets.layout.json`. Cell boundaries sit in the measured transparent gutters. A component belongs to the cell that holds its centroid, and a per-cell rule then decides what is kept (below). Nothing is clustered |
| `coat_tails` was the separate coat edit at raw scale, about 216x96 on the chief's body instead of about 580x200 | Cut from the **registered body's own pixels**, from the belt's middle line to the hem (chief 577x230). r2.1: the rookie's is cut from the master |
| The split legs were registered undersized, with soles at y≈1395 (chief) | `leg_right` / `leg_left` are cut from the registered body's own leg pixels, with soles moved onto **y 1440** (chief +2 px, rescued +1). The top of each leg extends straight up to 140 px under the hem as hidden overlap for rotation. r2.1: the rookie's are the master's leg pixels |
| `body_no_head_no_arms` repeated the legs, so the boots doubled when stacked | The body no longer contains the legs (and, for chief/rookie, stops at the belt). Every pixel of the lower body is in exactly one layer |
| Light seam across the helmet where `helmet_front` met the head (chief, rookie) | `helmet_front` is cut from the **master's own pixels** inside the registered helmet, so at rest it is the master and has no seam. Ember's helmet_front is rebuilt the same way (r2.1: with the full ink ring and the brim shadow) |
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
| Feet line | **y = 1440**: the lowest opaque (alpha > 128) row of the master (soles or paws); every skin is snapped onto it (r2.1) |
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
- Same-framing parts keep their r1 fit (uniform scale plus translation, fitted on colour-label agreement) and are re-placed from the raw output. `build_parts.py --refit` re-runs the fit. r2.1: the chief and rescued `head_blank` add a recorded similarity correction on top of it (`head_blank_adjust`).
- Skins are placed by their feet (`twins` is scaled 0.961), then snapped onto y 1440 by a whole-pixel shift (`sole_snap_px`, r2.1).
- Derived layers (`coat_tails`, the legs, `helmet_front`, the dog legs, the skin slots) are pixel subsets of an already registered layer or of the master. The exceptions are the integer sole shifts, the rotated raised arms, and the r2.1 edge closures (`edge_to_master` copies the master's own outline pixels along a trimmed edge).

Each record is in `<rig>/registration.json`: fits, derived-layer methods and parameters, the superseded r1 raw edits, the islands dropped, and every piece's cell, rule, dropped components and scale.

## Sides and naming

The cast faces three-quarter toward screen-right. The limb on the **image-left** is the character's **right** (near side):
`arm_right`, `leg_right`, `hand_r_*`, `ear_right` (r2.1), and for Ember `leg_hind_right` and `leg_front_right`. The
image-right limb or ear is the character's **left**. On the hand sheets, the top row holds the right hands and the bottom
row the left. r2 named the ears by image side; r2.1 swapped the two labels on all four rigs, so an `ear_left` referenced
before r2.1 is now `ear_right` (same pixels).

## Layers per rig (back to front) and what each contains

- **pf_chief / pf_rookie:** `leg_right` → `leg_left` → `coat_tails` → `body_no_head_no_arms` → `arm_left` → `head_no_helmet` (or `head_blank` plus face pieces) → `helmet_front` → `arm_right`.
  - `body_no_head_no_arms` keeps the torso down to the belt's bottom outline and the curly tail. r2.1: where the body (chief far shoulder; rookie collar and shoulders) showed at rest outside the master silhouette it is trimmed and closed with the master's outline; the rookie's tail is the master's.
  - `coat_tails` starts at the belt's middle line, so its cut edge hides under the belt. Chief: the registered body's pixels. Rookie (r2.1): the master's own pixels.
  - `legs` is the two legs on one layer. Rookie (r2.1): the master's own leg pixels.
  - `arm_left` (r2.1, both rigs): the far sleeve is trimmed to the master silhouette where it showed outside it and closed with the master's outline; the hidden overlap under the head and the near arm is kept. `arms_down` is `arm_right` + `arm_left` again.
  - `helmet_only` is the complete helmet with the painted navy lining. Use it when the helmet leaves the head.
  - Props go on their hand bone:
    - Chief: `pieces/bugle`, `pieces/nozzle`, `pieces/badge_blank` (blank, lettered by the runtime; v1.3) and `pieces/shield_plate`. `pieces/shield_13` is the same plate lettered "13" (ART_HERO.md shield rule) for static uses; the rig carries no lettering (v1.3).
    - Rookie: `pieces/hose_flexible`, `pieces/hose_coil`, `pieces/card_blank` and `pieces/card_back`.
  - The raised arms are `arm_*_raised`, with the pivot `shoulder_pivot` in `registration.json`.
- **pf_dog:** `leg_hind_left` → `leg_front_left` → `leg_hind_right` → `leg_front_right` → `body_no_head_no_legs` → `head_no_helmet` → `helmet_front`.
  - The four legs come from the registered legs layer. Separate legs are separate components.
  - The near front leg overlaps the far hind leg. They are split by a marker watershed on the dark-red outline, with one seed per leg in `derive.layout.json`. The black spots count as fur.
  - The near front leg keeps the outline it shares with the far hind leg. The hidden part of the far hind leg is not painted: it is covered at rest.
  - r2.1: above y 1120 the far front leg keeps only what the body covers or the master shows (its top no longer stands beside the chest). `legs.png` (all four) loses the same pixels.
  - `helmet_front` (r2.1) is the master's helmet with its whole outer ink ring, the brim tips and the grey shadow under the brim; its edge alpha is the master's.
  - `parts_sheet` pieces: `ear_right`, `ear_left`, `tail`, `jaw` (open bark), `head_open_smile` (the cell as drawn: a whole head with an open smiling mouth, a whole-head swap, never stacked with `jaw`), `head_no_jaw` (r2.1, derived from `head_open_smile`: the upper jaw with a dark mouth interior, made to stack with `jaw`) and `tongue`. Both heads were drawn apart from the master (spot pattern, head tuft): they are swap heads, not overlays on `head_no_helmet`.
  - Face pieces: `eyes_*`, `brows_*` and `muzzle_*` (r2.1; r2 called them `mouth_*`). The muzzles are opaque and include the nose: place each nose-on-nose with the head (`anchors.json` `guidance.muzzle_nose`).
- **pf_rescued:** `leg_right` → `leg_left` → `body_no_head_no_arms` → `arm_left` → `head` (or `head_blank` plus face pieces) → `arm_right`.
  - The trousers meet at the crotch. The legs are separate regions below the crotch apex and are cut vertically through the apex above it.
- **Skins** (`skins/<skin>/`, the same six slot names and canvas as the template; skins add no slot):
  - Each skin is split into cells, the flat-colour regions between ink lines. A cell goes whole to the template slot that holds at least 80 % of it. A small cell (4,000 px or less: a finger, a stripe) goes whole to its majority slot. A large straddling cell is split on the template boundary.
  - Ink goes to the front-most neighbouring slot, but only within 6 px of the nearest cell's distance (r2.1). Crumbs (4-connected islands) under 2,500 px join the slot they touch most; thin strays hanging off an arm go to the slot they touch; what touches no other slot and is under 30 px is dropped.
  - Override polygons in `derive.layout.json` keep each skin's extras on the right slot:
    - grandma: the cat, and the skirt and cardigan hem, stay on the body; r2.1: the cardigan placket stroke and a button rim leave `arm_left`
    - twins: **the piggyback twin (head, collar, hugging arms and fists, legs) and the tail stay on the body**; the lower twin's head is the head; the arms follow the 0.961 skin scale; r2.1: the near striped sleeve joins `arm_right`, the torso's side line leaves `arm_left`
    - dad: the robe skirt and shawl collar are body; r2.1: so is the bare chest in the robe's V below y 586
    - baby: the baby and the sling are body; r2.1: the strap edge leaves `arm_left`
    - teen: the rolled hood is body
  - **Twins limits.** The body slot carries the rider twin, and the space behind the lower twin's head (where the head slot sits) is not painted: a head move shows the background there. The twins' neck sits ~84 px right and 75 px below the template's neck, and both shoulders ~150-160 px below the template's shoulders (`guidance.skin_joints`). Keep the twins' head and arms at or near rest, or place that skin's attachments on skin-specific bones at those points.
  - Review: `qa/art/parts/pf_rescued_skin_slots_r2.png` tints the slots.

## Sheet pieces (`<rig>/pieces/`): fixed grid

The cell rectangles are in `<rig>/sheets.layout.json`. Each piece is the sheet pixels of its kept components only, never a rectangle crop, trimmed to the alpha bbox + 4 px. `sheet_origin` is the piece's top-left in the sheet. Rules per cell:

| Rule | Keeps | Used for |
|---|---|---|
| `eyes` | BOTH eyes: the two largest components that are not brows. A brow is a solid dark stroke with another component below it; brows come only from the brow row | every `eyes_*` |
| `brows` | the brow pair (two largest components) | every `brows_*` |
| `mouth` | the mouth: the largest component plus its own creases (solid ink strokes within 30 px and under 15 % of its area, such as corner dimples or a lip arc) | every `mouth_*`, Ember's `muzzle_*` |
| `single` | the single largest component | ears, moustaches, dog ear/tail/jaw/tongue |
| `hand` | the whole hand | every `hand_*` |
| `plate` | the plate plus anything inside its box | `badge_blank`, `shield_plate`, `card_blank` |
| `whole` | everything in the cell | props, wave arms/hands, `head_open_smile` |
| `figure` | the figure by its own component mask (the three slide poses interlock in x) | `pose_*` |
| derived (r2.1) | made from an already cut piece, same sheet origin, cell and scale; method and parameters in `derive.layout.json` `pieces` and `registration.json` | Ember `head_no_jaw` (from `head_open_smile`), chief `shield_13` (from `shield_plate`) |

Dropped components are listed per piece in `registration.json`. The only drops are the brows in the chief's four eye cells and the rookie's eyes_open / eyes_closed / eyes_dart cells, as designed. Ember's, the rescued's and the rookie's eyes_happy cells hold no brows. Every sheet has 0 components outside every cell.

**Scale to the canvas, per family** (multiply the piece by this; each value was checked with an overlay on the master or side by side with the part it replaces):

| Rig | Family (sheet) | Scale | Measured by |
|---|---|---|---|
| chief | eyes (face) | 0.65 | fit of `eyes_open`'s near eye on the master. The far eye sits about 20 % wider apart on the master than on the sheet |
| chief | brows (face) | 0.53 | the master's near brow width vs `brows_level`'s |
| chief | mouth (face) | 0.70 | by eye: `mouth_open` under the master's moustache at 0.6 / 0.7 / 0.8 |
| chief | moustache (face) | 0.93 | by eye: tip-to-tip width of the master moustache (fits 0.84 / 0.96 bracket it) |
| chief | ears (face) | 0.40 | fit of `ear_right` (the image-left, near ear; `ear_left` in r2) on the master's image-left ear (foreshortened, under the brim) |
| chief | hands | **0.58** (r2: 0.47) | navy cuff length across the forearm vs `arm_right` / `arm_left` 0.54-0.64; pink area 0.60 (`hand_r_open`) and 0.57 (`hand_l_open`); side by side at 0.47 / 0.55 / 0.58 / 0.62 the palm and cuff match the arm's own hand at 0.58 |
| chief | props | 0.574 | fit of `shield_plate` on the helmet plate. At this scale the nozzle's hose is 80 px thick on the canvas and the grip tunnel is 39 px (hands at 0.58): resize the nozzle by eye if it must pass through the fist, or let the hose pass behind it |
| rookie | eyes / brows / mouth / ears (face) | 0.60 / 0.50 / 0.32 / 0.45 | fits and widths on the master, overlays reviewed (ears: `ear_right`, the image-left ear) |
| rookie | hands | **0.60** (r2: 0.45) | pink area 0.63 (`hand_r_open` vs `arm_right`); side by side at 0.45 / 0.55 / 0.60 / 0.65 / 0.70 the palm, fingers and navy cuff match both arms' own hands at 0.60 |
| rookie | cards (props) | **0.60** (r2: 0.45) | equal to the hands (the pinch hand holds the card) |
| rookie | hose (props) | **0.316** (r2: 0.237) | so the hose (91 px thick on the sheet) passes the grip tunnel (48 px on the hands sheet, 29 px on the canvas at 0.60): 0.60 x 48 / 91 |
| dog | eyes / brows (face) | 0.90 / 0.87 | fits and widths on the master |
| dog | muzzle (face) | **1.05** (r2 `mouth`: 0.85) | nose-on-nose: head nose 117 px wide vs 108-116 px on the sheet; at 1.05 the noses coincide (overlay reviewed) |
| dog | parts | 1.19 | fit of `head_open_smile` over the master head (1.187: ears, eyes and nose coincide) |
| rescued | eyes / brows / mouth / ears (face) | 0.70 / 0.66 / 0.52 / 0.66 | fits and widths on the master; mouth and ears (`ear_right` over the image-left ear) by eye |
| rescued | wave arms | 0.896 | length and area of `arm_right` vs `wave_arm_up` (approximate: poses differ) |
| rescued | wave hands | 0.62 | by eye: `wave_hand_front` over `arm_right`'s hand |
| rescued | poses | 1.972 | shirt-cream area of the master vs `pose_cheer` (reference poses) |

Face pieces still need a final by-eye placement on `head_blank`. The sheets were drawn independently of the face, so eye spacing and brow arc differ slightly from the master.

## Anchors (contract bones), from `<rig>/anchors.json`

| Rig | Anchor | Where (measured) | Bind to |
|---|---|---|---|
| pf_chief | `head_top` | canvas (541.5, 18), the helmet crown; spine (8.7, 419.7) | head bone |
| pf_chief | `nozzle_tip` | `pieces/nozzle.png` (768, 97.5), the muzzle centre on the nozzle's x axis (piece scale 0.574) | nozzle bone (child, rotates with it) |
| pf_chief | `grip_r` / `grip_l` | `pieces/hand_r_grip.png` (178.6, 217.4) / `hand_l_grip.png` (127.8, 210.8), the centre of the empty fist tunnel (piece scale **0.58**; tunnel 68 px on the piece, 39 px on the canvas) | the hand bones |
| pf_rookie | `sheet_r` / `sheet_l` | `pieces/hand_r_catch.png` (268, 236) / `hand_l_catch.png` (30, 255), the fingertip point farthest from the cuff (piece scale **0.60**) | the hand bones |
| pf_dog | `sheet_r` (and `sheet_l`) | canvas (861, 751), the front of the mouth under the nose; spine (64.3, 126.8) | jaw bone |
| pf_rescued | `feet` | canvas (512, 1440) = the root pivot; spine (0, 0) | root; time the `land` event to contact |

`anchors.json` also has a `guidance` block (r2.1; not contract bones): Ember's `muzzle_nose` (the head's nose centre on the canvas and each muzzle's nose centre in piece pixels, at the muzzle scale 1.05), and the rescued `skin_joints` (each skin's neck and shoulder points and their offsets from the template's).

## Review evidence (`qa/art/parts/`)

The authoritative sheets are regenerated by `build_parts.py` with every r2.1 file:

- `<rig>_pieces_r2.png` shows every piece at 2x on mid-grey, with its file name and caption (sheet row/col, rule, kept/dropped components or the piece it is derived from, scale). Every label was checked against its content by eye (r2.1: the ears, Ember's muzzles and both heads, `shield_13`).
- `<rig>_layers_r2.png` shows every canvas layer (and skin slot) trimmed, at 0.5x, with its canvas bbox.
- `<rig>_reassembly.png` puts the master on the left and the layers stacked in rig order on the right, with the feet line in red. Silhouette IoU with the master:

  | Rig | IoU r2 | IoU r2.1 | Note |
  |---|---|---|---|
  | chief | 0.967 | 0.978 | the bugle is not a body layer |
  | rookie | 0.950 | 0.991 | coat tails and legs are the master's pixels |
  | dog | 0.932 | 0.942 | the body redraw differs from the master; the tail is a piece |
  | rescued | 0.984 | 0.984 | |

- `<rig>_<layer>.png` overlays each layer on the faded master (r2.1: regenerated for every layer). `pf_rescued_skin_slots_r2.png` shows the tinted slot map per skin.
- Superseded, history only: the r1 contact sheets `<rig>_contact_r1_superseded.png` (they show the r1 mislabels) and `pf_chief_reassembly_r1.png` (the r1 QA image formerly at `pf_chief/QA_reassembly.png`).
- `.gitignore` ignores `qa/**/*.png`, so this evidence reaches the repository only by an explicit `git add -f` of the four `<rig>_pieces_r2.png`, four `<rig>_layers_r2.png`, four `<rig>_reassembly.png` and `pf_rescued_skin_slots_r2.png` (or a `!qa/art/parts/*_r2.png` / `*_reassembly.png` negation rule): the coordinator's call. Leave the `*_r1_superseded.png` files out.

## Open items (need a decision or Spine-side work; none needs a paid call unless stated)

- **Rookie master "down 12 px" was not applied.**
  - The raw master's top rows are y 40–42 with alpha ≤ 44/255, so only one faint antialias row is lost at y 0.
  - Moving the master 12 px down would put the soles on y 1452, off the contract feet line, and masters are immutable in this pass.
  - `helmet_only` keeps its crown from y 1. `helmet_front` (cut from the master) touches y 0 like the master.
- **Rookie body redraw.** The collar and shoulders were trimmed to the master silhouette where they showed at rest (r2.1); when the far arm lifts, the body's side under it keeps the redraw's shape with a short inked cut at the shoulder. A same-framing body redraw would remove that (one paid call; the coordinator's decision, next to the rookie master decision).
- **Dog body (`body_no_head_no_legs`, the r2 redraw)** is longer and lower than the master. Either nudge it in Spine or order a same-framing redraw (one paid call, for a named defect). That is the coordinator's decision. The head redraw's far-ear outline under the brim (about 120 px) is the only remaining difference in the helmet band.
- **Ember's swap heads** (`head_open_smile`, `head_no_jaw`) were drawn apart from the master (spot pattern, head tuft). They serve the bark as whole-head swaps; a `head_no_jaw` that matches `head_no_helmet` exactly would need a same-framing edit of the master head (one paid call).
- **Twins.** The rider twin rides on the body slot and the space behind the lower twin's head is not painted; the twins' neck and shoulders sit well away from the template pivots. Rest-pose (or near-rest) head and arm motion for this skin, or skin-specific bones in Spine. Splitting the rider into its own slot would need a skeleton slot only the twins use (the contract lets skins add no slot): Codex's call.
- **Chief `head_blank`** has a lumpy crown, hidden under the helmet; its right jowl is a little narrower than `head_no_helmet`'s (its own drawing).
- **Hidden areas:** the far hind leg under the near front leg (dog) and the rider twin's chest behind the lower twin's head are not painted. They are covered at rest, and hiding them in motion is an authoring task.
- **Chief nozzle vs grip:** at the measured scales the nozzle's hose (80 px) is still wider than the grip tunnel (39 px). Scale the nozzle by eye in Spine, or keep the hose passing behind the fist.
- **`shield_13`** is registered and current; whether it stays in the rig delivery under contract v1.3 (no lettering on the rig) is the coordinator's call. The rig should use `shield_plate`.
- **Old tracked paths:** `pf_chief/QA_reassembly.png` (moved to `qa/`) and `pf_dog/pieces/mouth_{closed,bark,pant,sad}.png` (renamed `muzzle_*`) are gone from disk; the coordinator's commit should remove them from the index.
