# Rig parts: common registration (art lane → Codex Spine lane)

These notes cover the four rigs in `docs/ANIMATION_CONTRACT.md` (`pf_chief`, `pf_rookie`, `pf_dog`, `pf_rescued`). Every
file is original art from paid gpt-image edit calls. Provenance is in `source-record.json` here, and every HTTP
attempt is also in `art-src/generated/source-record.json`. The raw outputs in `art-src/generated/rig_<rig>/` are
never edited. The files in this folder were built from them by `build_parts.py`, which is local, deterministic and
free.

## The common canvas

| Item | Value |
|---|---|
| Canvas | **1024 x 1536 RGBA** for every master, part, split piece and skin (`<rig>/*.png`) |
| Feet line | **y = 1440**: the lowest opaque row of the master (soles or paws) |
| Feet centre / root pivot | **x = 512**: the centre of the soles on the bottom 2 % of the figure (Ember: bottom 5 %, so all four paws count) |
| Spine coordinates | `spine_x = (x - 512) * scale`, `spine_y = (1440 - y) * scale` (Spine y points up) |
| Scale to the contract size | `scale = runtime height / master height_px`, in each `<rig>/anchors.json` |

| Rig | Master height (px) | Contract height | `scale` | Master bbox on the canvas (x0, y0, x1, y1) |
|---|---|---|---|---|
| `pf_chief` | 1423 | 420 px | 0.29515 | 42, 18, 977, 1440 |
| `pf_rookie` | 1441 | 380 px | 0.26371 | 177, 0, 849, 1440 (the helmet crown touches the top edge; nothing is clipped) |
| `pf_dog` | 1195 | 220 px | 0.18410 | 45, 246, 993, 1440 |
| `pf_rescued` | 1313 | 260 px | 0.19802 | 51, 128, 939, 1440 |

**How each file lands on the canvas.** Each master is moved by whole pixels only, with no resampling (`raw_shift`
in `registration.json`). Each same-framing part is fitted to its raw master with a uniform scale plus a translation
and no rotation. The fit maximises colour-label agreement (precision x recall). The part is resampled once with
premultiplied bicubic filtering, then moved by the master's shift. The model does not keep pixel framing: the
head-only edits came back about 1.8x enlarged, and the fit undoes that. Placement priors keep a helmet from
matching a boot (`YRANGE`, `SRANGE` in `build_parts.py`).

There are three special cases:

- **Skins**: placed by their feet. Four skins already had the template's sole line, so they are identity. `twins`
  is scaled by 0.961 so the rider's head fits, then its soles are aligned.
- **`coat_tails`**: raw scale, shifted so its red hem matches the master's hem (21 px for the chief, 14 px for the
  rookie). The colour fit locked onto the chest bands.
- **Raised arms**: the scale is the square root of the ratio between the down arm's area and the raised arm's area.
  The raised arm's shoulder cap (its bottom 12 %) is placed on the down arm's shoulder cap (its top 12 %). The
  pivot is stored as `shoulder_pivot`.

Each fit is recorded in `<rig>/registration.json` (`s`, `tx`, `ty`, `score`, `mode`).

**Review.** `qa/art/parts/<rig>_reassembly.png` shows the master on the left and the stacked parts on the right,
with the feet line in red. `qa/art/parts/<rig>_<part>.png` overlays each part on the faded master, and
`qa/art/parts/<rig>_contact.png` is a labelled contact sheet. All of these were reviewed by eye. Registration is
good to a few pixels, which is enough to author from. Do a final nudge in Spine against the master image.

## Sides and naming

The cast faces three-quarter toward screen-right. The arm or leg on the **image-left** is the character's
**right** (near side): `arm_right`, `leg_right`, `hand_r_*`. The image-right one is the character's **left**
(`arm_left`, `leg_left`, `hand_l_*`). The sheets list the right hands in the top row and the left hands in the
bottom row.

## Layers per rig (back to front)

- **pf_chief**: `leg_right` / `leg_left` (or `legs`) → `coat_tails` → `body_no_head_no_arms` (neck stub and
  shoulder caps are painted) → `arm_left` → `head_no_helmet` (or `head_blank` plus face pieces) → `helmet_front` →
  `arm_right`. Props go on their hand bone: `pieces/bugle.png`, `pieces/nozzle.png`, `pieces/badge_blank.png` (the
  WILD sign face, lettered locally) and `pieces/shield_plate.png`. `helmet_only` is the complete helmet with the
  navy lining painted. Use it when the helmet leaves the head. `helmet_front` is the layer-ready version: over the
  head, a helmet pixel is kept only where the master shows the same colour.
- **pf_rookie**: the same stack. Props are `pieces/hose_flexible.png` (a straight hose of even thickness for mesh
  bending, with a coupling on the left and a nozzle on the right), `pieces/hose_coil.png` (the fumble),
  `pieces/card_blank.png` (a blank front to letter locally) and `pieces/card_back.png`. Catch and pinch hands are
  in `hands_sheet`.
- **pf_dog**: `legs` (4 legs on one layer: the front pair touch, so cut them apart in Spine) →
  `body_no_head_no_legs` (redraw r2: continuous torso, no socket pads) → `head_no_helmet` → `helmet_front`.
  `parts_sheet` has `ear_left`, `ear_right`, `tail`, `jaw` (open bark), `head_no_jaw` and `tongue`. `face_sheet`
  has eyes, brows and mouths, including the bark mouth.
- **pf_rescued**: the template `body_no_head_no_arms` → `leg_*` → `arm_left` → `head` (or `head_blank` plus face
  pieces) → `arm_right`. The five skins (`skin_grandma`, `skin_twins`, `skin_dad`, `skin_baby`, `skin_teen`) are
  full-figure costume edits on the template's joints. Cut each skin's regions with the template part masks (the
  same canvas) so all skins keep the same slots. The extras stay attached to the body: the cat is on grandma's
  shoulder, the second twin rides piggyback, and the baby is in a chest sling. Arms stay free for the wave.
  `wave_arm` gives three wave angles and three open hands. `slide_poses` gives reference poses for slide, land and
  cheer.

## Sheet pieces (`<rig>/pieces/`)

The sheets are split on their requested grid into trimmed pieces. `sheet_origin` is the top-left of each piece
inside the sheet. The eye pieces include the brows the model drew above them; use the separate brow pieces when
you animate brows. Multiply a piece by its sheet's `sheet_scale_to_canvas` to match the canvas:

| Rig | Sheet | Scale | Measured by |
|---|---|---|---|
| chief | hands | 0.552 | largest skin area of `arm_right` vs `hand_r_open` |
| chief | face | 0.501 | moustache area in `head_no_helmet` vs `moustache` |
| chief | props | 0.676 | brass shield area on `helmet_only` vs `shield_plate` |
| rookie | hands | 0.635 | skin area of `arm_right` vs `hand_r_open` |
| rookie | face | 0.623 | eye-white area in `head_no_helmet` vs `eyes_open` |
| rookie | props | 0.635 | assumed equal to the rookie hands (no counterpart); the hose should pass the grip hole |
| dog | parts | 1.175 | width of `head_no_helmet` vs `head_no_jaw` |
| dog | face | 0.900 | matched **by eye** (eye width and nose width); the white fur defeats the colour measure |
| rescued | face | 0.679 | eye-white area in `head` vs `eyes_open` |
| rescued | wave_arm | 0.896 | area of `arm_right` vs `wave_arm_up` (approximate) |
| rescued | slide_poses | 1.972 | shirt-cream area of the master vs `pose_cheer` (approximate; reference poses) |

## Anchors (contract bones), from `<rig>/anchors.json`

| Rig | Anchor | Where (measured) | Bind to |
|---|---|---|---|
| pf_chief | `head_top` | canvas (541.5, 18), the helmet crown; spine (8.7, 419.7) | head bone |
| pf_chief | `nozzle_tip` | `pieces/nozzle.png` (768, 97.5), the muzzle centre at the right end, on the nozzle's x axis | nozzle bone (child, rotates with it) |
| pf_chief | `grip_r` / `grip_l` | `pieces/hand_r_grip.png` (178.6, 217.4) / `hand_l_grip.png` (127.8, 210.8), the centre of the empty fist tunnel | the hand bones; the hose passes through |
| pf_rookie | `sheet_r` / `sheet_l` | `pieces/hand_r_catch.png` (268, 236) / `hand_l_catch.png` (30, 255), the fingertip point farthest from the cuff | the hand bones |
| pf_dog | `sheet_r` (and `sheet_l`) | canvas (861, 751), the front of the mouth under the nose; spine (64.3, 126.8) | jaw bone (Ember holds one corner in his mouth; offset `sheet_l` along the sheet edge if both are needed) |
| pf_rescued | `feet` | canvas (512, 1440) = the root pivot; spine (0, 0) | root; time the `land` event to contact |

To turn a piece coordinate into canvas space, place the piece in Spine at its sheet scale and read the point through
the attachment's transform. The piece coordinates are there so the bone can be set on the exact pixel.

## Known limits (what Codex may still need to do inside its rig folder)

- The hidden-surface paint is good but not perfect. `head_blank` (chief) has a lumpy crown, which is hidden under
  the helmet. The dog's four legs are one layer. The skins are full figures, not per-slot parts: cut them with the
  template masks.
- Face pieces are drawn at sheet scale and share one scale per sheet. Place them by eye on `head_blank`.
- `pf_chief/QA_reassembly.png` and `pf_chief/pieces/shield_13.png` were written by another process during this
  run. They are not part of this delivery and were left untouched.
