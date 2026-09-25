# Audio manager lifecycle checks

These checks exercise the production `audioManager.ts` through its existing public methods. Esbuild bundles that file in memory; only the Web Audio, clock, storage, fetch and manifest boundaries are controlled. No audio plays, no assets are generated, and no game build or simulation runs.

Run from the repository root:

```sh
node --test qa/codex/audio-lifecycle/audioManager.test.mjs
node qa/codex/audio-lifecycle/check-types.mjs
```

The manager keeps its public method signatures and encoded/decode caches. Its additional `getState()` fields expose held/loop/total voice counts for diagnosis.

- Scene epochs invalidate every deferred start on `teardownToBase()`. Per-cue request tokens also invalidate stop-before-decode and stop/restart races for held cues, SFX loops and music layers. A shared bed revision makes the most recent bed request win, including a request to keep the current bed.
- One-shots and held starts use a strict 120 ms deadline on `performance.now()`, so browser suspension cannot freeze their lateness clock. Visibility and turbo changes invalidate pending transient starts. Instance, cooldown and family limits are checked again when decode completes.
- Every source, including a fading voice removed from its active map, remains tracked until disposal. Ended callbacks remove only their own voice; teardown disconnects old voices and cannot free a replacement's instance count.
- The latest bed requested before unlock is remembered without constructing an audio context. Repeated unlock/resume preserves the current scene. Startup/restore uses `base_loop_a`, with `ambient_station_loop` as the startup ambience; both names are checked against the real manifest.
- Equal-tempo, whole-bar 4/4 grids retain phase. Different or unknown grids start the incoming bed at bar one, including the 92 BPM base to 100 BPM bonus transition. A known mismatched-tempo layer is skipped or faded out; cue selection belongs to the caller.
- Teardown stops transient, layer and fading voices, resets ducking and restores base once. An already-running base bed is retained. Cache warming can finish after teardown without reviving cancelled requests.

Visibility semantics: hiding cancels pending and live one-shots/held cues, but does not stop existing loops or music. A pending loop or layer can finish after hide/show if no explicit stop occurred. A SFX loop whose decode finishes while still hidden is dropped, with no queued restart; music layers retain music scheduling. Scene owners must call the corresponding stop/remove method or teardown when their desired loop/layer changes. This preserves music across browser suspension without replaying transient contacts.

Caller boundary: directors must cancel their own timers and guard their own `await ensureDecoded(...)` continuations. A new method call made by an obsolete caller after teardown appears to the manager as a new request. Directors also own charged-cost celebration gating, cue IDs, animation contacts and which scene layers should be requested.

Evidence: the initial 26-case suite failed 17 cases against the transferred manager and passed all 26 after the lifecycle fix. With suspended-wall-clock, visibility, turbo, mute/resume, stale queued callback and tempo-layer coverage, the final suite has **33 PASS, 0 FAIL**. The scoped strict TypeScript check **PASS** covers the actual manager and generated cue manifest against installed HUD, SvelteKit and Vite declarations. `git diff --check` is clear for the owned change.

Listening quality, authored-file timing, browser/device behavior and mounted game/animation integration are **NOT RUN** by this suite. A fake Web Audio pass is not audible synchronization acceptance.
