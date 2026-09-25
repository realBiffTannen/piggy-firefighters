# Chief Hamm (`pf_chief`) — full ten-clip rig

Status (2026-09-25, draft `drafts/full-v002`): **all ten contract clips exported and installed**;
`check_contract.py --rig pf_chief` **PASS**; a visual sanity pass of the export was looked at
(`qa/codex/rig-viewer/pf_chief-final/`); the **per-clip recorded motion review and the mounted-gameplay
review are NOT RUN**. The runtime files at `apps/piggy_firefighters/static/assets/spine/pf_chief/`
(`pf_chief.json` + `.atlas` + two PNG pages) are the full-v002 export, replacing the three-clip pilot.
Original Piggy Firefighters art only; no lettering is baked into the rig (`shield_13` is the approved
local derivation); the optional `badge_blank` prop is not used, so there is no `badge` bone.

## Clips

| clip | length | keyed events | notes |
|---|---|---|---|
| `idle` | 5.0 s loop | — | chest-led breath, delayed helmet, one irregular blink |
| `idle_alt` | 4.0 s loop | `step` @ 0.44 | bugle retrieved from the belt, inspected, returned; weight shift onto the near foot |
| `win` | 1.2 s | — | one compact fist pump (thumb hand), nozzle visibly regained |
| `big_win` | 2.4 s | `step` + `sign_hit` @ 0.48 | stronger anticipation, held raised silhouette; both events on the peak / foot-down |
| `point_reels` | 0.8 s | `sign_hit` @ 0.30 | gaze leads, index point toward the reels at full extension |
| `spray_start` / `spray_loop` / `spray_end` | 0.6 s / 1.2 s loop / 0.5 s | `spray_on` @ 0.44 / `spray_off` @ 0 | the accepted pilot-v008 curves, unchanged (asserted by the test) |
| `celebrate` | 2.0 s | `step` @ 0.50 | open-hand salute/wave with one stamp of the far foot |
| `sad` | 1.5 s | — | worried brows, exhale, sympathetic recovery |

Root is never keyed. Every clip returns to the setup-compatible pose so the runtime's 0.15 s default mix
(0 s into `spray_loop`) lands cleanly. Anchors: `nozzle_tip`, `grip_l`, `grip_r`, `head_top`.

## How it is built

`author_pilot.py --full` reads a registration + `full-layout.json` (measured by `layout_pilot.py`), copies the
piece PNGs byte-identically into the draft's `images/`, builds bones / mesh attachments / IK / transform
constraints, and takes the clips from `chief_performances.py` (the spray clips come from `spray_clips()`).
The layout was measured against registration `6c180d00…` (the `registered-source/422c2b5` snapshot), which
is what full-v002 uses:

```sh
python3 -B art-src/animation/rigs/pf_chief/test_author_pilot.py
python3 -B art-src/animation/rigs/pf_chief/author_pilot.py --full \
  --parts art-src/animation/rigs/pf_chief/registered-source/422c2b5/pf_chief \
  --layout art-src/animation/rigs/pf_chief/full-layout.json \
  --output art-src/animation/rigs/pf_chief/drafts/full-v003
```

Then the Spine **4.2.43** CLI round trip (never 4.3; hold `art-src/animation/rigs/.spine.lock` while it runs):
import `pf_chief.json` into a NEW `pf_chief.spine` (`-r`), export with `pilot.export.json` (straight alpha, 1×,
pages ≤ 2048, strip whitespace) into `export/`, then `node finish_export.mjs drafts/<d>/export drafts/<d>/runtime`
derives the four `skeleton.x/y/width/height` fields (spine-core 4.2.74 setup pose + IK bounds) into `runtime/`,
which is copied to the static assets folder. Hashes of every stage are in the draft's `source-record.json`.

**Parts delivery caveat.** The current `art-src/animation/parts/pf_chief` delivery is r2.1 (registration
`9b38c201…`); it re-cut several pieces (body, far arm, head, hands, bugle, nozzle, shield) and has not been
re-measured into the layout. The rig therefore ships the frozen `422c2b5` pixels, byte-identical to what the
accepted pilot-v008 used. Adopting r2.1 needs a new layout pass, not a re-run of this script.

## History

Pilot drafts v001–v008 developed the spray anatomy (UV winding, arm layering, tucked far elbow, connected
original hose, seated sleeve tip, transverse tapered forearm). v008 was accepted for further authoring after
the browser sequence probe (`qa/codex/rig-viewer/sequence-v008-r1`). full-v001 added the seven remaining
performances (JSON only, never round-tripped). full-v002 adds the `step` foot-downs in `idle_alt`/`celebrate`,
is the first full draft round-tripped through 4.2.43, and is the installed runtime rig.
