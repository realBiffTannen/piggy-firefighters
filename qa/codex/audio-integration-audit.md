# Audio and character contact integration — Phase B handoff

Read-only snapshot: `e911613`, 2026-09-25. Claude owns the affected frontend/audio paths.
The original audio files are still being produced; their sound quality and measured mix are **NOT RUN**.
Manifest replacement is already an acknowledged Phase B dependency in `docs/AUDIO_MAP.md`.
These findings define work needed before acceptance, not regressions in a claimed completed integration.

## Required integration work

1. **Suppress celebration at or below the actual charged cost.**
   `apps/piggy_firefighters/src/game/fx/audioDirector.ts:99` selects `total_win_small` even for levels 0/1.
   `src/game/rescue/rescueDirector.ts:256` and `:324` call it without a charged-cost guard.
   `src/game/audio/index.ts:183` accepts equality and defaults to 100; `src/game/bookEventHandlerMap.ts:65`
   supplies no mode cost. Derive one whole-round tier from W versus S before the base-bet floors, and
   share it across stingers, plates and rigs. Remove booked `winLevel` presentation authority in
   `src/game/roundTier.ts:42` and `:89`, and `src/game/bookEventHandlerMap.ts:98`.

2. **Connect sound to visible spray and contact.**
   `src/game/fx/audioDirector.ts:88` requests absent `hose_spray`/`douse` IDs; the new roster supplies
   `hose_start`, `hose_loop`, `hose_end`. `src/game/rescue/rescueDirector.ts:184` currently cues dousing
   on book iteration. `src/components/rigs/RigPlayback.svelte:39` exposes frame-timed `spray_on`,
   `spray_off`, `step`, `land`, `catch`; no game consumer is wired in this snapshot. Wire `onrigEvent`
   by visible actor/slot, stop the loop on every `spray_off` cancellation, and align catch/landing
   accents with actual arrival. Add or deliberately map neutral footstep, landing and sheet-catch
   cue IDs; they are not dedicated roster entries yet. Procedural fallbacks need equivalent contact
   timing and the existing `landingBus.publish()` arrival handshake.

3. **Invalidate delayed audio on skip, reset and new rounds.**
   `src/game/audio/audioManager.ts:443` allows a long undecoded one-shot to start regardless of lateness.
   Its `:583` decode continuation and `src/game/audio/presentationDirector.ts:134` can switch to a stale
   bed after a newer state. `audioManager.ts:786` clears music layers but leaves held voices, SFX loops,
   one-shots and pending decode continuations; `rescueDirector.ts:347` does not call audio teardown.
   Add generation/epoch checks and tracked source/timer cleanup, including timers in
   `src/game/audio/index.ts:87` and `:212`, so old cues cannot appear in a new scene.

4. **Finish the original cue registry and explicit feature mapping.**
   `src/game/audio/cueManifest.ts:2` still contains the 194-entry donor registry at 83 BPM, while
   `audio/cues.json` defines 232 original cues at 92/100 BPM. Regenerate the registry from delivered
   files. `src/game/audio/presentationDirector.ts:47` maps both Rescue and Inferno to `HOLD_BUILD`,
   with old beds/entries at `:34`; map the two features explicitly. Update old alarm/false-alarm/line-win
   IDs in `src/game/fx/audioDirector.ts:94` and `src/game/audio/index.ts:183` at the same handoff.

5. **Consume the authored turbo and duck metadata.**
   `src/game/audio/cueManifest.ts:8` has no duck/turbo-variant fields. `audioManager.playCue` at `:404`
   only drops low-priority decoration; it does not select the roster's shortened variants or ducking.
   Route those centrally so accelerated contacts do not acquire long unrelated tails. Keep musical
   beds at their authored tempo.

All abbreviated `src/` paths above are inside `apps/piggy_firefighters/`.

## Focused acceptance after integration

- Base returning 1x, ante returning 1x/1.5x, and 90x Inferno returning 50x/90x: accounting visible,
  no celebratory stinger, rig or plate. Above-cost whole-round returns use the agreed base-bet tier.
- Spray start/loop/end and an interrupted spray: one coherent cue chain tied to nozzle events;
  no residual loop after cancellation, reset, turbo change or teardown.
- Two queued rescues: each actual landing drives its sheet reaction/contact once; no early catch
  at departure and no replayed sound when old asynchronous work resolves.
- Deliberately delayed decode followed by skip/new round: no stale one-shot or bonus bed.
- Rescue and Inferno enter distinct original beds; return-to-base is idempotent. Muting, VO toggle,
  normal/turbo/super-turbo, resume and replay retain correct cue ownership.

No shared files edited, paid calls made, audio played, build run or math output read for this audit.
