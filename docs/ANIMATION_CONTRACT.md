# Piggy Firefighters — animation contract (rig interface for the Spine lane)

Owner brief: "deliver substantially better animations after Piggy Police's rejection". Two lanes:

- **Runtime integration (Claude):** `apps/piggy_firefighters/src/game/anim/**`, `apps/piggy_firefighters/src/components/rigs/**`,
  FX (Pixi particles/tweens) everywhere else. Ships **procedural fallbacks** for every rig slot so the game
  plays before a rig lands; a rig replaces its fallback the moment the exported files exist at the paths below.
- **Spine authoring (Codex, macOS, Spine 4.2.43):** `art-src/animation/rigs/<rig>/**` (Spine projects, exports,
  part images it derives) and `apps/piggy_firefighters/static/assets/spine/<rig>/**` (runtime exports). Codex edits
  NOTHING else without a mailbox agreement. Part art comes from Claude's art lane
  (`art-src/animation/parts/<rig>/*.png`, provenance in `art-src/animation/parts/source-record.json`); Codex may
  derive/cut/repaint parts inside its rig folder.

Runtime: `@esotericsoftware/spine-pixi-v8` 4.2.x (the family pins 4.2.74). Export from Spine **4.2.43** as JSON
(`<rig>.json`) + atlas (`<rig>.atlas`, PNG pages ≤ 2048², premultiplied alpha OFF, "Strip whitespace" on,
scale 1.0 desktop). Never open a rig in 4.3.x (FX rigs may be 4.3.23 exported down to 4.2). Pivot = feet
centre for characters; skeleton units = pixels at 1080p desktop board scale (Chief Hamm standing ≈ 420 px tall).

## Rigs (names are the contract)

| Rig | Skeleton | Animations (name → loop? → notes) | Events | Size |
|---|---|---|---|---|
| `pf_chief` (Chief Hamm, mascot left of the reels; WILD sign holder) | `pf_chief` | `idle` loop 4–6 s breathing + helmet wobble · `idle_alt` loop (checks watch / bugle) · `win` once 1.2 s (fist pump) · `big_win` once 2.4 s · `point_reels` once 0.8 s · `spray_start` once 0.6 s → `spray_loop` loop → `spray_end` once 0.5 s · `celebrate` once 2.0 s · `sad` once 1.5 s (false alarm) | `step` (foot down), `spray_on`, `spray_off`, `sign_hit` | 420 px tall |
| `pf_rookie` (Sprocket, ambient/dispatch) | `pf_rookie` | `idle` loop · `fumble` once 2.5 s (hose tangle) · `card_flip` once 1.0 s · `hold_sheet` loop (jump sheet) · `catch` once 0.7 s | `flip`, `catch` | 380 px |
| `pf_dog` (Ember) | `pf_dog` | `sit_idle` loop · `bark` once 0.6 s · `run_loop` loop · `celebrate` once 1.5 s · `hold_sheet` loop | `bark` | 220 px |
| `pf_rescued_<n>` n=1..5 (Trotter family, one per room) | `pf_rescued` with 5 skins `grandma`, `twins`, `dad`, `baby`, `cat_lady` | `wave_window` loop · `slide` once 1.2 s (down the ladder) · `land` once 0.6 s · `cheer` loop | `land` | 260 px |

Every animation name above must exist in the export (empty is acceptable while blocking). Mix times: 0.15 s
default, `spray_start→spray_loop` 0, `slide→land` 0. No animation may move the root bone off-origin except
`slide` (its travel is set by the runtime; the rig animates the pose only). Skins may not add slots.

## What the runtime does with them

`src/game/anim/rigRegistry.ts` maps rig name → `{json, atlas}` under `./assets/spine/<rig>/`; `RigActor.svelte`
loads via `Spine.from`, sets skins, drives `state.setAnimation(track, name, loop)` from the director beats
(`mascotEvents.ts`): `reveal` → `point_reels` on an alarm land, `winInfo` tiers → `win`/`big_win`, `douse` →
`spray_*`, `rescues` → `pf_rescued_<n>.slide` then `land` + `celebrate` on dog/rookie, `alarmCall.falseAlarm` →
`sad`. Fallbacks: sprite-sheet idles + tween pumps with the same beat hooks. A rig is accepted when
`python3 art-src/animation/tools/check_contract.py` passes (Claude ports the family checker to this table).
