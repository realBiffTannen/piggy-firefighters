# Rig runtime handoff — PF-20260925-03

Status: **implementation + focused static/unit verification PASS; real-rig browser/motion review NOT RUN.**
No original Spine exports exist in this checkout at this checkpoint. No art was fabricated or generated.
The `/rigs` dev route deliberately shows an empty readiness state, not a claimed motion viewer.

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
before broadcasting the next spin. Each arrival snapshots its skin; director-provided skin overrides
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

## Focused verification

Run from `/Users/jbull/code/piggy-firefighters`:

```sh
node --experimental-strip-types --test qa/codex/rig-runtime/rigLogic.test.mts qa/codex/rig-runtime/playbackControl.test.mts
node qa/codex/rig-runtime/check-components.mjs
```

Latest result: **10 tests PASS**, **10 source files compile / scoped TypeScript diagnostics PASS**, zero
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
