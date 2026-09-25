# Rig runtime handoff — PF-20260925-03

Status: **implementation + focused static/unit verification PASS; full-rig gameplay motion review NOT RUN.**
The `/rigs` dev route has a separate authoring/capture workflow documented under
`qa/codex/rig-viewer/`; a partial pilot is not accepted gameplay animation.

## Claude integration (shared files remain in Claude's lane)

1. Add the type to the existing emitter union:

```ts
import type { EmitterEventAnim } from './anim/beatBus';
// ... existing EmitterEvent union ... | EmitterEventAnim
```

2. Spread `rigAssets` into `src/game/assets.ts`:

```ts
import { rigAssets } from './anim/rigRegistry';
export default { /* existing assets */ ...rigAssets };
```

`rigAssets` discovers matching `<rig>.json` + `<rig>.atlas` through Vite's
`Object.keys(import.meta.glob(...))` path-metadata optimization. Static assets are not imported as JS or
copied into a second bundle. Missing exports register nothing and generate no missing-file requests.
The existing pixi-svelte loader parses the skeleton, atlas, and pages with its pinned 4.2.74 runtime.
Rebuild/restart after a new export lands so the manifest discovers it.

3. Mount the stage unconditionally in the scene's positioned Pixi container. Conditionally hide ONLY the
procedural fallback. Gating RigStage itself on `has()` would deadlock loading/mount readiness.

```svelte
<script lang="ts">
  import RigStage from './rigs/RigStage.svelte';
  import { rigRegistry } from '../game/anim/rigRegistry';
</script>

<RigStage slot="mascotLeft" width={240} height={420} scale={1}
  layout="desktop" reducedMotion={false}
  onready={(actor) => { /* actor.getBoneWorldPosition('nozzle_tip') */ }}
  onrigEvent={(event) => { /* event.name + event.anchors are for scene-owned FX */ }} />
{#if !rigRegistry.has('pf_chief')}
  <!-- existing procedural Chief fallback -->
{/if}
```

`rigRegistry.has` reads a SvelteMap; use it directly in a template or `$derived`. It becomes true only
AFTER data validation and a mounted actor's initial track succeeds. Readiness is reference-counted:
destroying one rescued-pig instance does not invalidate other mounted instances. Failed or missing data
keeps the fallback. The loader uses existing pixi-svelte providers; no new app dependencies are required.

Supported stage slots: `mascotLeft`, `mascotRight`, `cardPresenter`, `rescueRoom` (index 0..4), `ladder`,
`sheet` (Rookie + Ember), `winPlate`. Stage width/height bound the clip mask; scenes own slot position.
Scale preserves rig aspect ratio and obeys the supplied layout scale. Keep the complete desired pose
inside the slot; no actor can draw outside the slot mask onto reels/HUD.

Ladder accepts `path={{fromX,fromY,toX,toY}}` or those four coordinates directly, in the slot's local
coordinates. Its slot must enclose the complete path. A rescue drives slide → land → hidden loop.
Up to five rescue beats arriving during a slide are queued locally; a new spin/exit cancels them.
Directors still own the presentation interval and must allow time for any desired sequential rescues
before broadcasting the next spin. Each rescue beat snapshots its path and skin, including queued
rescues; a later room's path cannot change an earlier rescue. Director-provided skin overrides
the `(room + building) mod 5` fallback. Book `buildingCleared.building` is 1-based, so using its count
as the next building's zero-based skin offset produces the correct next-building family.

`RigActor.svelte` also exposes `getBoneWorldPosition(name)` through a component binding and the
`onready` handle. It returns Pixi global coordinates or null after disposal. `onrigEvent` receives
`{rig, slot, index, name, anchors}`. Bones required by the contract are included as position snapshots.
Spine `spray_on`/`spray_off`, `land`, `catch`, etc. pass through; interruption/unmount also emits
`spray_off` when necessary. `ondispose(rig,index)` lets scene FX release their per-actor resources.

The beat subscriber returns no promises. All tracks return to their idle/slot loop; tier 0 does not
celebrate. Super Turbo skips one-shot performances; reduced motion holds static poses and does not
advance Spine physics. Slot actors own their ticker callbacks/listeners and release those on unmount;
the provider owns object destruction and leaves shared atlas textures reusable.

The v1.2.2 tier map is typed as `WinTier`: 0 neutral, 1 ordinary, 2 BIG, 3 HUGE, 4 MEGA,
5 EPIC, 6 MAX. `bigWinStart`/`bigWinEnd` accept 2..6. The director first applies the charged-cost
gate (`W <= S` is neutral), then the base-bet floors; rigs consume that decision. Authored acting
and contact review direction is in `art-src/animation/rigs/DIRECTION.md`.

## Focused verification

Run from `/Users/jbull/code/piggy-firefighters`:

```sh
node --experimental-strip-types --test qa/codex/rig-runtime/rigLogic.test.mts qa/codex/rig-runtime/playbackControl.test.mts
node qa/codex/rig-runtime/check-components.mjs
```

Latest result: **11 tests PASS**, **14 source files compile / scoped TypeScript diagnostics PASS**, zero
Svelte warnings. Tests cover loss/turbo behavior, rescue skin/room mapping, reduced motion,
cancellation epochs, and fail-closed validation for incomplete/malformed data. The checker uses the
installed Svelte compiler, svelte2tsx and TypeScript and reports only owned runtime-file diagnostics;
it is not a claim that the whole app type-checks. Neither root nor app package defines a `test` script.

Not run in this lane: full build (coordinator owns the build process), WebGL rendering, mobile/device
performance, actual rig art, clip captures, FX synchronization, and animation acceptance. These require
original exports, the shared mounting/emitter integration, and the contract's authored-export gate.
The readiness check is a runtime safety check, not a substitute for `check_contract.py` and motion review.


## Focused review corrections

- AnimationState dispatches events before Skeleton world transforms update. Events and clip completion
  now enter an epoch-scoped queue, drained only after `spine.update()` returns. The event captures current
  anchors before completion changes to the next clip. Cancellation drops deferred callbacks.
- Normal clip changes retain the outgoing TrackEntry and use the contracted 0.15 second mix; only initial
  mounting and explicit reduced-motion/static pose resets clear tracks and restore setup pose. The real
  installed Spine AnimationState test proves an outgoing 50px translation blends through an intermediate
  value to the unkeyed setup position, rather than snapping or remaining stuck.
- Sheet Rookie/Ember now hold during rescue departure. The ladder publishes an internal arrival cue
  after the first land pose has received a world-transform update; then the sheet performs catch/celebrate.
  `landingBus` in `game/anim/playbackControl.ts` is also available to Claude's procedural ladder: call
  `landingBus.publish()` from its actual arrival callback if a rescued rig is unavailable but sheet rigs
  are mounted. It returns no promise and does not delay the director. Spin/exit cancellation discards
  pending ladder arrivals. The original public `animBeat` contract is unchanged.
- Asset resolution explicitly distinguishes development source depth from the configured SvelteKit inline
  bundle depth. Focused coverage verifies `https://cdn.example/games/piggy-firefighters/v1/_app/immutable/bundle.js`
  resolves to `/games/piggy-firefighters/v1/assets/spine/...` and keeps the release prefix.

The four regression tests first failed, then passed after implementation. Event timing and mixing tests
use the installed real Spine core, not fake state methods. These remain focused runtime-logic evidence;
real original art, mounted WebGL, full-app integration and motion acceptance remain pending. The reviewer
identified the issues but has not performed a post-fix review; no approval is claimed.

## Rescue queue and settings regression correction

Queued requests now copy each beat's path, skin and clip steps on receipt. Playback
uses that request's path, including an explicitly missing path, rather than reading
the next room's live props. Settings effects read only speed/reduced-motion props;
playback side effects run inside Svelte `untrack`. A settings reset clears queued
rescues before the idle transition, whose existing cancellation clears pending
contact callbacks and arrivals and hides the ladder actor.

The focused regression uses the production queue helper: A/B/C rescue path and
skin snapshots survive later path mutation, and clearing the queue discards its
pending travel. Snapshot coverage first failed, then passed after implementation.
The production settings effect's `untrack` and cancellation calls were source-
reviewed and component-compiled; their behavior in mounted gameplay remains
**NOT RUN**. A test that merely copied the intended effect pattern was removed.
Existing real-Spine contact, crossfade and cancellation checks remain passing.
No full build or motion capture was run for this correction.
