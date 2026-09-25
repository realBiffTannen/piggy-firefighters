# Codex animation preflight and part handoff

This is a preparation lane, not delivered animation. Claude owns the art commission, scene mounting,
beats and animation contract. Codex owns rig authoring, the rig runtime/viewer, and this checker under the
PF-20260925-03 / allocation B handoff. No paid generation, artwork
copying, Spine launch, or runtime export was performed for this preflight.

## Read-only validator

Run the actual v1.1 four-rig gate from the repository root:

```sh
python3 -B art-src/animation/tools/check_contract.py
```

The wrapper reads the rig-keyed `qa/codex/animation/requirements.json` and checks each exact runtime
`assets/spine/<rig>/<rig>.json` and `<rig>.atlas` pair. `--rig pf_chief` selects one rig;
`--runtime-root /absolute/scratch/path` is available for isolated export review. Missing exports are
`BLOCKED`; four absent rigs cannot pass. The requirements reflect the v1.1 clip/event/anchor roster,
the five rescued skins, and a minimum of two numerically moving bones per clip.

For an independent generic export:

```sh
python3 -B tools/codex/animation/validate_rig.py \
  --rig pf_chief \
  --json apps/piggy_firefighters/static/assets/spine/pf_chief/pf_chief.json \
  --atlas apps/piggy_firefighters/static/assets/spine/pf_chief/pf_chief.atlas
```

Optional `--requirements /absolute/path/requirements.json` accepts one rig's **exact** clip/skin/event
lists, a required-anchor subset, and a positive minimum motion count:

```json
{"clips": ["idle"], "skins": ["default"], "events": [], "anchors": ["head_top"], "min_moving_bones": 2}
```

That example describes a miniature test rig, not the production Chief contract. Omitted lists are not
checked; the generic minimum defaults to one moving bone. The production wrapper selects the approved
rig entry automatically. No unagreed duration or event-frame timings are hardcoded.
Unknown requirements keys fail so a caller cannot silently assume an unsupported requirement was checked.

The validator reads files only and emits JSON to stdout:

- Exit 0 / `PASS`: static checks passed. Motion craft and runtime rendering remain `NOT RUN`.
- Exit 1 / `FAIL`: invalid export, atlas, or explicit requirements. Known invalidity takes precedence when
  other PNG pages are also missing.
- Exit 2 / `BLOCKED`: required inputs or texture pages are missing.

Checks cover Spine 4.2.x metadata, positive-duration nonempty pose timelines, numeric bone keys and known
animated bones, case-sensitive bone and 4.2 slot timeline names, ordered nonnegative frame times, declared animation events (required events must also be
keyed in at least one clip), required anchor bones, neutral root setup/direct
timelines, every skin's texture attachments (including linked meshes and sequences), atlas regions,
straight alpha declaration, PNG headers and dimensions, region containment, and maximum 2048×2048 pages.
Root Bezier curves are rejected conservatively because neutral endpoints can still produce an excursion.
Empty blocking clips do not qualify as delivered clips.

`moving_bones_by_clip` lists non-root bones with numeric pose values changing over a positive time interval.
Static keys and inherited movement do not count; curves with identical endpoint values are not counted.
This is a necessary structural proxy, **not proof of visible motion**: a hidden/control bone could still
move without changing rendered pixels. The contract's visible-motion requirement requires the per-clip
recording and visual review even when two bones pass this check.

This is intentionally **not** a complete Spine parser, PNG decoder, constraint evaluator, provenance
validator, or motion renderer. It does not prove weighted-mesh quality, contact stability, easing quality,
seam-free loops, event timing, skin appearance, runtime cancellation, mobile visibility, or human acceptance.
Spine 4.2.43 re-export and the actual runtime remain necessary even after a static pass.

Focused synthetic regressions:

```sh
python3 -B -m unittest discover -s tools/codex/animation -p 'test_validate_rig.py' -v
```

23 focused tests pass, including observed false positives for capitalized `Rotate` and legacy slot
`color` timelines (now rejected), plus explicit `angle` rejection and `value`/`rgba` acceptance.
Tests exercise the CLI, temporary synthetic
PNG/JSON/atlas inputs, both missing and invalid inputs, and verify that input bytes remain unchanged.
No game simulation or broad application suite is part of this bounded tool verification.

## v1.1 resolutions and remaining craft details

Claude accepted the craft corrections in `docs/ANIMATION_CONTRACT.md` v1.1:

1. `pf_rookie` includes `celebrate` and `sad`.
2. Every root remains neutral, including `slide`; runtime controls ladder travel.
3. One `pf_rescued` asset drives instances `rescued_0..4`; skin index is `(room + building) mod 5`.
4. Skins are `grandma` (with cat), `twins`, `dad`, `baby`, `teen`. Skins may not add slots.
5. Chief anchors are `nozzle_tip`, `grip_l`, `grip_r`, `head_top`; Rookie and Ember each provide
   `sheet_l`, `sheet_r`; rescued characters provide `feet`. Runtime owns particle FX; rigs have no FX slots.
6. Every clip requires at least two bones with visible motion and a recorded motion review. The structural
   checker cannot replace that review. Empty clips cannot qualify as accepted work.

Before authoring, settle the remaining unspecified loop durations, exact contact/event frames, clip end
poses, and prop transitions against the runtime director. v1.1 supplies named mounting slots and scale,
nonblocking beat delivery, Super Turbo rules, and reduced-motion input; runtime implementation and visible
desktop/mobile bounds still need verification. The inherited prose below the table still mentions
`pf_rescued_<n>` and says Claude ports the checker; the explicit v1.1 allocation and corrected table govern.

## Original part commission requirements

Deliver accepted original model sheets and transparent registered PNG parts under
`art-src/animation/parts/<rig>/`, with provenance in the Claude-owned source record. Every part needs the
shared canvas registration, crop offset, joint/pivot coordinates, consistent facing and palette, and enough
paint overlap for the full intended motion. Fully paint the hidden neck, crown, shoulders and sleeves:
no doubled collars, baked props, missing hand surfaces, or seams exposed when the head/helmet lifts.
Codex derives parts only inside its owned rig folders.

| Rig | Required articulation and variants |
| --- | --- |
| `pf_chief` | White helmet with brass 13 shield; ears, moustache, brows, eyes and expression mouths; torso and coat tails; upper/lower limbs and boots; grip/open/point/fist hands; separate WILD badge, hose/nozzle and bugle. Agree badge-to-hose prop transitions. |
| `pf_rookie` | Oversized helmet, expressive face, independently articulated limbs, deformable hose, blank card front/back, grip/open/catch hands. Share jump-sheet contact coordinates with runtime. |
| `pf_dog` | Separate head/jaw/ears/tail/helmet, front and hind limbs; compatible sitting and running poses; explicit jump-sheet grip solution. |
| `pf_rescued` | Grandma with cat, twins, dad, baby and teen: five distinctive silhouettes with shared joint registration; wave/catch hands, faces, limbs, clothing/blanket, separate cat and second twin. All skins support wave → slide → land → cheer without adding slots. |

Performance direction: eyes lead, anticipation precedes action, readable poses hold briefly, weight settles,
and ears/helmet/coat follow with a delay. Preserve planted feet and stable grips. Each character has distinct
acting; a continuous whole-character bounce is not the intended result.

## Author/export workflow and next acceptance

Read-only discovery found `/Applications/Spine.app/Contents/MacOS/Spine` and the cached 4.2.43 update at
`/Users/jbull/Library/Application Support/Spine/updates/4.2.43`. Presence is not an editor execution result.
Always select `-u 4.2.43`. Once edited, each `.spine` project becomes authoritative; never overwrite it by
reimporting a generated seed. Scratch-export before promoting runtime files. Use scale 1.0, straight alpha,
whitespace stripping, and PNG pages no larger than 2048².

Family scripts in `/Users/jbull/code/piggy-police/art-src/animation/rigs/pw_pig_worker/tools/` were inspected
only for workflow. No donor artwork, rig pose data, or exported asset is approved for this title. Do not copy
the old export script's unrestricted scratch-directory deletion or its 0.5 export scale. The old checker
only inspected the first skin's texture attachments; this validator deliberately checks every skin.

After approved art lands: author one character pilot, inspect every clip at full speed and quarter speed,
inspect at desktop and mobile game sizes, then test complete spray and rescue/catch sequences in the
runtime. Check loop seams, prop contact, clipping, mixed transitions, interrupted loops, and event/audio
synchronization. Bind captures and validation to the exported hashes and final build. Human motion review,
physical-device performance and platform approval remain separate evidence.
