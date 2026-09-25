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
| `pf_rookie` (Sprocket, ambient/dispatch) | `pf_rookie` | `idle` loop · `fumble` once 2.5 s (hose tangle) · `card_flip` once 1.0 s · `hold_sheet` loop (jump sheet) · `catch` once 0.7 s · `celebrate` once 1.5 s · `sad` once 1.5 s (false alarm) | `flip`, `catch` | 380 px |
| `pf_dog` (Ember) | `pf_dog` | `sit_idle` loop · `bark` once 0.6 s · `run_loop` loop · `celebrate` once 1.5 s · `hold_sheet` loop | `bark` | 220 px |
| `pf_rescued` (Trotter family; ONE asset, five runtime instances `rescued_0..4` = rooms 0..4) | `pf_rescued` with 5 skins `grandma`, `twins`, `dad`, `baby`, `teen`; room r of building b shows skin `[(r + b) mod 5]` | `wave_window` loop · `slide` once 1.2 s (pose only; the runtime moves the actor along the ladder) · `land` once 0.6 s · `cheer` loop | `land` | 260 px |

Every animation name above must exist in the export. Mix times: 0.15 s default, `spray_start→spray_loop` 0,
`slide→land` 0. **ALL root bones stay neutral in every clip** (the runtime owns every translation, including the
ladder travel of `slide`); skins may not add slots. **Anchors (bones, required):** `pf_chief`: `nozzle_tip` (spray
FX spawn point, along the nozzle axis), `grip_l`, `grip_r` (hose hand-holds), `head_top` (badge/plate anchor);
`pf_rookie`/`pf_dog`: `sheet_l`/`sheet_r` (jump-sheet corners); `pf_rescued`: `feet`. **FX ownership:** water
spray, steam, flame, embers, coins and dust are the runtime's Pixi particles (Claude), spawned at the anchor
world positions Codex's `RigActor` exposes (`getBoneWorldPosition(name)`), timed by the Spine events
(`spray_on`/`spray_off`/`land`/`catch`); rigs carry no FX slots. **Acceptance:** `check_contract.py` passes
(names, anchors, events, sizes, neutral roots), **no empty clip** (every clip keys at least two bones with visible
motion), and a recorded motion review (one capture per clip via the rig viewer) posted in the mailbox for the
coordinator's/owner's eyes before a rig is marked accepted.

## What the runtime does with them

`src/game/anim/rigRegistry.ts` maps rig name → `{json, atlas}` under `./assets/spine/<rig>/`; `RigActor.svelte`
loads via `Spine.from`, sets skins, drives `state.setAnimation(track, name, loop)` from the director beats
(`mascotEvents.ts`): `reveal` → `point_reels` on an alarm land, `winInfo` tiers → `win`/`big_win`, `douse` →
`spray_*`, `rescues` → `pf_rescued_<n>.slide` then `land` + `celebrate` on dog/rookie, `alarmCall.falseAlarm` →
`sad`. Fallbacks: sprite-sheet idles + tween pumps with the same beat hooks. A rig is accepted when
`python3 art-src/animation/tools/check_contract.py` passes (Claude ports the family checker to this table).

## v1.1 — Runtime interface (2026-09-25, ALLOCATION PF-20260925-03: Codex owns the rig RUNTIME too) · v1.2: tier numbering pinned 0..6

Codex owns, exclusively, three NEW directories nobody else creates or edits:
`apps/piggy_firefighters/src/game/anim/**` (rig registry, beat subscriber, Spine loading via `@esotericsoftware/spine-pixi-v8`
already in the workspace), `apps/piggy_firefighters/src/components/rigs/**` (`RigStage.svelte`, one `RigActor.svelte`
per rig, pixi-svelte components — see `packages/pixi-svelte` and `/home/user/lucky/apps/lucky/src/components/build/HouseRig.svelte`
for the house style) and `apps/piggy_firefighters/src/routes/rigs/**` (the dev-only rig viewer; `tools/build_dist.sh`
already moves `src/routes/rigs` out of the build). Claude owns the mounting points and the beats.

**Mounting.** Claude's `components/Game.svelte` and scene components mount `<RigStage slot="…" />` at these named
slots (board space, pixi-svelte `Container`s; Codex's stage positions rigs inside its slot, Claude positions the slot):
`mascotLeft` (Chief Hamm, left of the reels), `mascotRight` (Ember, right of the reels), `cardPresenter` (Sprocket at
the dispatch board on the Alarm Call card), `rescueRoom` ×5 (`index` 0..4, over each burning room), `ladder` (the
slide path: Codex receives `{fromX,fromY,toX,toY}` per slot in props), `sheet` (Sprocket + Ember holding the jump
sheet at the ladder foot), `winPlate` (a celebrating chief on BIG WIN and above). Each slot prop set:
`{slot, index?, width, height, scale, layout: 'desktop'|'portrait', reducedMotion: boolean}`.

**Beats.** Claude broadcasts through the game's existing `eventEmitter` (`src/game/eventEmitter.ts`) ONE emitter
event type, `animBeat`, `{type: 'animBeat', beat, ...payload}`; Codex subscribes in `game/anim/beatBus.ts`. Beats and
payloads (all positions 0-based board cells, amounts in bet multiples as numbers):

| beat | payload | fired |
|---|---|---|
| `spinStart` | `{mode, speedTier}` | every spin, base or bonus |
| `reelStop` | `{reel, symbols: string[]}` | each reel lands (row order top→bottom) |
| `alarmLand` | `{reel, row, count, golden}` | an ALARM/GALARM lands (`count` so far) |
| `anticipationStart` / `anticipationEnd` | `{reel, hit}` | book-driven anticipation reel; `hit` on end |
| `lineWin` | `{lineIndex, amount, symbol, kind}` | per presented line |
| `winTier` | `{tier: 0..6, amount, x}` — **pinned (v1.2):** 0 = at or below the bet (no celebration), 1 = ordinary win (> 1x, < 15x), 2 = BIG (≥ 15x), 3 = HUGE (≥ 30x), 4 = MEGA (≥ 50x), 5 = EPIC (≥ 100x), 6 = MAX (15,000x cap); rig consumers: tier 1 → `win`, tier ≥ 2 → `big_win`, `winPlate` appears from tier ≥ 2 | round tier known (client-derived from the booked round total, contract §8) |
| `backdraft` | `{cells: [{reel,row}]}` | the Backdraft flash |
| `rescueEnter` | `{bonus: 'rescue'\|'inferno', source, spins, rooms}` | entering the bonus scene |
| `douse` | `{sprays: [{reel, from, to}], rescues: [{reel, skin, prize?}], multiplier, spinsAdded}` | after each bonus reveal |
| `rescue` | `{reel, skin, prize?, multiplier}` | one per rescued room, right after `douse` |
| `buildingCleared` | `{building, spinsAdded}` | all five rooms saved |
| `rescueExit` | `{total, multiplier, rescued, buildings}` | leaving the bonus |
| `alarmCall` | `{outcome}` | card outcome shown |
| `bigWinStart` / `bigWinEnd` | `{tier: 2..6, amount}` (same numbering as `winTier`) | win-rung plate in / out |
| `maxWin` | `{amount}` | capped round |
| `idle` | `{seconds}` | every 10 s of idle (ambient loops) |
| `speedTier` | `{tier: 0..2}` | speed change (2 = Super Turbo: skip long clips) |
| `reducedMotion` | `{on}` | OS/setting change |

Rules: rigs never block the round (no awaited promises from Codex's side; Claude's directors own timing); Super
Turbo skips clips longer than 400 ms; every clip returns to its loop; nothing Codex draws may cover the reels
or the HUD bar; phone layout uses `scale` from the slot. Until a rig's export exists at its path, `RigActor`
renders nothing and Claude's procedural fallback (in Claude's scene files) shows; the fallback hides when
`rigRegistry.has(rig)` (Codex exports this from `game/anim/rigRegistry.ts`) is true.
