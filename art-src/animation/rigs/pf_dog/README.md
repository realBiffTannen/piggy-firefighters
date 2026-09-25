# Ember (pf_dog) rig — authoring notes

Original Piggy Firefighters art only (registered r2 parts under `art-src/animation/parts/pf_dog`).
Contract: `docs/ANIMATION_CONTRACT.md` (220 px standing, root at the feet centre, clips
`sit_idle · bark · run_loop · celebrate · hold_sheet`, event `bark`, anchors `sheet_l`/`sheet_r`).
Acting brief: `art-src/animation/rigs/DIRECTION.md`. Pipeline follows the Chief lane
(`../pf_chief`): Python authoring → Spine 4.2.43 CLI import into a NEW project → JSON+atlas
export with the pinned preset → `finish_export.mjs` derives the runtime bounds.

## Files

- `layout_dog.py` → `dog-layout.json`: bones at canvas points, surfaces, draw order. Bound to the
  exact `registration.json` sha256; a changed delivery blocks authoring until re-measured.
- `dog_performances.py`: the five clips in 220 px skeleton units.
- `author_dog.py --output drafts/vNNN`: freezes byte-identical source PNGs into `images/`, writes
  `pf_dog.json` (skeleton.spine 4.2.43, images `./images/`) and `source-record.json` with hashes.
- `dog.export.json`: the pinned export preset (straight alpha, 1×, ≤ 2048 pages, strip whitespace).
- `finish_export.mjs <export dir> <runtime dir>`: copies the native export and fills only
  `skeleton.x/y/width/height` from spine-core 4.2.74 setup-pose bounds (regions resolved from the
  native atlas); records hashes in `bounds-provenance.json` and the draft's `source-record.json`.

## Build

```sh
python3 -B art-src/animation/rigs/pf_dog/layout_dog.py                     # only after re-measuring
python3 -B art-src/animation/rigs/pf_dog/author_dog.py --output art-src/animation/rigs/pf_dog/drafts/v003
mkdir art-src/animation/rigs/.spine.lock                                    # shared CLI lock
D=$PWD/art-src/animation/rigs/pf_dog/drafts/v003
/Applications/Spine.app/Contents/MacOS/Spine --update 4.2.43 --disable-audio -i $D/pf_dog.json -o $D/pf_dog.spine -r
/Applications/Spine.app/Contents/MacOS/Spine --update 4.2.43 --disable-audio -i $D/pf_dog.spine -o $D/export/pf_dog \
  -e $PWD/art-src/animation/rigs/pf_dog/dog.export.json
rmdir art-src/animation/rigs/.spine.lock
node art-src/animation/rigs/pf_dog/finish_export.mjs $D/export/pf_dog $D/runtime
cp $D/runtime/pf_dog.{json,atlas,png} apps/piggy_firefighters/static/assets/spine/pf_dog/
python3 -B art-src/animation/tools/check_contract.py --rig pf_dog
```

Never open the project in Spine 4.3; never re-import over an edited `.spine`.

## Rig design

- Registered full-canvas layers are region attachments: `body_no_head_no_legs`, the four legs,
  `helmet_front`. The head is `head_no_helmet` split into UV polygon sub-meshes: `face`, the near
  ear (`ear_right`, drawn in front of the face) and the far ear (`ear_left`, behind it), so ears
  swing rigidly from roots hidden under the helmet brim. The tail is a UV polygon of the master.
  At rest every surface reproduces the master pixel-for-pixel; nothing is repainted.
- Eyes and brows are polygon sub-meshes of the head on their own bones, each sitting over a
  same-shape cover whose UVs sample the head's own white crown fur. A blink squashes the eye onto
  its lower lid (bone origin at the lid), a brow raise translates the brow; the cover keeps the
  painted feature from showing through. Muzzle overlays (`muzzle_closed/bark/pant/sad`) are region
  attachments on the `muzzle` slot registered nose-on-nose at 1.05 per `anchors.json`; setup is
  the head's painted smile, clips key the overlay explicitly.
- Bones: `root → pelvis → {leg_hind_right, leg_hind_left, tail, body → chest → {leg_front_right,
  leg_front_left, neck → head → {ear_right, ear_left, helmet, brow_*, eye_*, muzzle, jaw →
  {sheet_r, sheet_l}}}}`. Positive leg rotation swings a paw forward (screen right); positive
  body rotation rears the chest about the hips (hind legs stay planted on `pelvis`). The far front
  leg pivots at the chest front (838,1112 canvas) so its clipped top never leaves the chest.
- `sheet_r` = anchors.json (64.3, 126.8), `sheet_l` offset along the mouth toward the chin; both
  ride the `jaw` bone.
- Draw order (back→front): tail, ear_left, far legs, face, eye/brow covers+features, muzzle,
  ear_right, helmet, body, near legs. The body (collar) is drawn over the head's neck fur exactly as
  the master layers it, so a nod tucks the chin into the collar.

## Clips

`sit_idle` 4.4 s loop (standing alert: Ember has no seated pose in the delivery; two uneven
breaths, head drift with ear/tail follow-through, one blink at 2.3 s, a brow flicker) ·
`bark` 0.6 s (intake, snap forward with `muzzle_bark` at 0.24 s, `bark` event 0.25 s, ears flick
back, recover) · `run_loop` 0.5 s loop (gallop, front pair leading, body bob/pitch, ears and tail
trailing, panting) · `celebrate` 1.5 s (crouch, rear up 24° with paddling forepaws, pant + happy
squint + fast wag, drop with a landing squash) · `hold_sheet` 2.4 s loop (braced hold, head on the
corner, slow tugs through neck/jaw, wag, blink). Root neutral in every clip.

## Drafts and evidence

- `drafts/v001`: first native round trip (front-leg pivots too low: the far leg's clipped top edge
  showed ahead of the chest at full swing). Native project, JSON and frozen images retained;
  its superseded export/runtime pages are not committed.
- `drafts/v002`: current. Native `.spine`, `export/pf_dog/` (CLI output), `runtime/` (bounds
  derived; installed to `apps/piggy_firefighters/static/assets/spine/pf_dog/`).
- Gate: `check_contract.py --rig pf_dog` PASS on v002 (static preflight only).
- Visual sanity: `qa/codex/rig-viewer/pf_dog-final/` — muted headless Chromium captures of the
  rest pose (with anchors) and mid-clip frames of every clip at quarter speed, inspected by the
  author. This is not the recorded motion review the contract requires for acceptance.
