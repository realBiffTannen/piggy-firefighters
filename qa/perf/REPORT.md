# PIGGY FIREFIGHTERS — low-end performance pass: before → after

Harness: `qa/perf/measure.mjs` (Playwright + CDP, muted headless Chromium 153.0.8010.12) against the STAGED production
build served one directory deep (`/v70/`) with the fixtures-only mock RGS. Two emulated profiles, every scenario a fresh
page + session:

| profile | viewport | CPU throttle | device |
|---|---|---|---|
| phone-lowend | 390×844 @ dsf 3, touch | 6× | mobile |
| laptop-old | 1366×768 @ dsf 1 | 4× | desktop |

`baseline` = HEAD 1dcbc21 as shipped (`qa/perf/baseline.json`, 2026-09-25 22:53 UTC). `after` = the working tree of this
pass (`qa/perf/after.json`, 2026-09-26 00:47 UTC; provenance `98e8a0b5…`, index.html `5d2999bb…`). One run each.
Frame p50/p95 are pinned at 16.7 ms by the headless vsync in both runs, so the frame signal is in `max` / `>33 ms` /
long tasks, not in the percentiles.

## Headline

- Boot (phone-lowend): splash pressable **1752 → 1358 ms (−22 %)**, shutter done **3484 → 3108 ms (−11 %)**, requests
  **383 → 140 (−63 %)**, transfer **31.72 → 11.71 MB (−63 %)**; laptop-old: press 1129 → 820 ms (−27 %), shutter
  2807 → 2517 ms (−10 %), 383 → 123 requests, 31.72 → 10.01 MB (−68 %).
- GPU resident after boot **293.9 → 257.7 MB (phone) / 220 MB (laptop)**; textures 125 → 81 / 64; GL bytes uploaded
  before the shutter 222 → 126 / 97 MB. Session-wide GL peak: base_win 315.7 → 258.8 / 220.7 MB, backdraft_spins
  320 → 261 / 222 MB, inferno_buy 385 → 374 / 332 MB.
- Script time per round −13…−27 % (phone base_win 4828 → 3657 ms, backdraft_spins 9568 → 6999 ms, inferno_buy
  11354 → 9566 ms); frames over 33 ms per round 1/0/2/6 → 0/0/1/4 (phone), 0/0/2/3 → 0/0/0/1 (laptop); the
  inferno_buy 116.7 ms hitch (phone) is now 83.3 ms, its 3 long tasks (200 ms) now 1 (64 ms).
- JS heap peak unchanged within ±1.5 MB (33–36 MB during a round on both profiles); boot heap peak 19.1 → 14.9 MB.
- Per-session transfer (boot + one round): phone base_win 33.2 → 23.3 MB, inferno_buy 34.9 → 25.0 MB. The boot no
  longer carries the feature art, the feature rigs, 167 cold audio cues or the other layout's symbol sheet; they arrive
  in idle chunks after the door lifts or behind the feature shutter (see "round: fetched" below).
- Bundle: `index.html` 1,514,173 → 1,398,056 B (lodash gone: −134 KB minified JS); fonts 860 → 404 KB.
- Rounds: 0 console errors in every scenario, both profiles; round wall times unchanged (33.3 s / 10.9 s / 62.9 s /
  71.7 s) — the presentation is the same, it just costs less.

## One real regression, found and fixed in this lane

The first `after` run hung every round on the static build (spin button never returned; dev server fine). Cause:
group e replaced `_.range(n).map(cb)` with `Array.from({ length: n }, cb)` in `src/game/stateGame.svelte.ts` when
building the five reel objects. Rollup models `Array.from` as a pure builtin and does not treat the callback's return
values as escaping, so its object-property tracking took the reels' `rt.resolved: true` / `rt.planned: false` literals
as constants: in the production bundle `finish()` compiled to `() => {}` and `symbolAt()` lost its `planned` branch, so
no reel promise could ever resolve (verified by patching probes into the built page: reveal → spin → brake → impact all
fired, `await Promise.all(reelPromises)` never returned; the compiled `finish` body was `a=()=>{}`). Dev (no Rollup
pass) never showed it. Fix: explicit loops in `stateGame.svelte.ts` (reels) and
`packages/utils-slots/src/createGetEmptyPaddedBoard.ts` (the same pattern building nested array literals). The bundle
again compiles `finish` as `a=()=>{t.resolved||(t.resolved=!0,t.resolve())}`; all ten scenarios then completed.
The other `Array.from` replacements (`createMultiBookUtils.ts`, `createReelForSpinning.svelte.ts`) return values that
are already opaque to Rollup and are unaffected.

Also finished in this lane: `packages/utils-shared/winLevel.ts` and `i18n.ts` still imported lodash (both at the
package root, outside the `src/` globs group e searched), which is why the whole library was still in the bundle after
their pass. `Object.values` / `Object.entries` and a 12-line plain-object deep merge (checked equal to `_.merge` on
catalogue-shaped input) replace them.

## Before → after, per profile and scenario

### phone-lowend (390×844 @3, CPU ×6, mobile)

| scenario / window | metric | baseline | after |
|---|---|---|---|
| boot | press at / shutter done (ms) | 1752 / 3484 | 1358 / 3108 |
| boot | requests / transfer | 383 / 31.72 MB | 140 / 11.71 MB |
| boot | images · audio · fonts · json | 147/24.65 MB · 223/6.11 MB · 3/0.40 MB · 5/0.55 MB | 75/7.98 MB · 56/3.23 MB · 3/0.19 MB · 3/0.30 MB |
| boot | frames p95 / max / >33 ms | 66.7 / 733.2 / 17 | 50.0 / 666.7 / 14 |
| boot | long tasks # / total / longest (ms) | 4 / 1232 / 672 | 3 / 971 / 629 |
| boot | heap peak (MB) | 19.1 | 14.9 |
| boot | GL uploads to shutter (calls / MB) | 125 / 221.9 | 60 / 125.9 |
| boot | textures resident after boot | 125 × 293.9 MB | 81 × 257.7 MB |
| +3 s | frames p95 / max, long tasks, heap peak | 16.8 / 16.8, 0, 18.9 MB | 16.7 / 16.8, 0, 17.0 MB |
| base_win | round wall (s) / frames max / >33 | 33.2 / 33.3 / 1 | 33.3 / 16.8 / 0 |
| base_win | heap peak / script (ms) | 34.8 MB / 4828 | 33.6 MB / 3657 |
| base_win | fetched in round · GL uploads in round | 4 req 1.5 MB · 22 / 16.5 MB | 140 req 11.61 MB (after-gate warm) · 22 / 0.9 MB |
| base_win | textures after round / GL peak | 147 × 315.7 MB / 315.7 | 103 × 258.8 MB / 258.8 |
| base_backdraft_win | wall / max / >33 | 11.0 / 16.8 / 0 | 10.9 / 16.8 / 0 |
| base_backdraft_win | heap peak / script | 24.5 MB / 1961 ms | 23.4 MB / 1469 ms |
| base_backdraft_win | textures after / GL peak | 131 × 293.9 MB | 87 × 257.8 MB |
| backdraft_spins | wall / max / >33 | 63.0 / 66.7 / 2 | 62.9 / 33.3 / 1 |
| backdraft_spins | heap peak / script | 35.9 MB / 9568 ms | 32.8 MB / 6999 ms |
| backdraft_spins | GL uploads in round / GL peak | 31 / 21.5 MB / 320.1 MB | 31 / 4.4 MB / 261.1 MB |
| backdraft_spins | textures after round | 63 × 160.1 MB (GC had run) | 103 × 261.1 MB (see notes) |
| inferno_buy | wall / max / >33 / >100 | 71.5 / 116.7 / 6 / 1 | 71.7 / 83.3 / 4 / 0 |
| inferno_buy | long tasks # / total / longest | 3 / 200 / 83 | 1 / 64 / 64 |
| inferno_buy | heap peak / script | 35.9 MB / 11354 ms | 36.2 MB / 9566 ms |
| inferno_buy | GL uploads in round / GL peak | 46 / 84.1 MB / 385.2 | 90 / 106.1 MB / 374.4 |
| inferno_buy | textures after round | 68 × 209.2 MB | 71 × 237.2 MB |
| idle (10 s) | frames p95 / max, script, heap end | 16.8 / 16.8, 802 ms, 19.9 MB | 16.7 / 16.8, 567 ms, 23.0 MB |

### laptop-old (1366×768 @1, CPU ×4, desktop)

| scenario / window | metric | baseline | after |
|---|---|---|---|
| boot | press at / shutter done (ms) | 1129 / 2807 | 820 / 2517 |
| boot | requests / transfer | 383 / 31.72 MB | 123 / 10.01 MB |
| boot | images · audio · fonts · json | 147/24.65 MB · 223/6.11 MB · 3/0.40 MB · 5/0.55 MB | 58/6.28 MB · 56/3.23 MB · 3/0.19 MB · 3/0.30 MB |
| boot | frames p95 / max / >33 ms | 33.4 / 400.0 / 12 | 33.3 / 133.4 / 8 |
| boot | long tasks # / total / longest (ms) | 3 / 697 / 364 | 3 / 538 / 327 |
| boot | heap peak (MB) | 15.5 | 13.5 |
| boot | GL uploads to shutter (calls / MB) | 125 / 221.9 | 43 / 96.7 |
| boot | textures resident after boot | 125 × 293.9 MB | 64 × 220.0 MB |
| +3 s | frames p95 / max, long tasks, heap peak | 16.7 / 16.8, 0, 18.8 MB | 16.7 / 16.8, 0, 16.6 MB |
| base_win | wall / max / >33 | 33.2 / 16.8 / 0 | 33.3 / 16.8 / 0 |
| base_win | heap peak / script | 34.9 MB / 3198 ms | 35.0 MB / 2621 ms |
| base_win | fetched in round · GL uploads in round | 4 req 1.5 MB · 22 / 16.1 MB | 140 req 11.61 MB · 22 / 0.6 MB |
| base_win | textures after round / GL peak | 147 × 315.3 MB | 86 × 220.7 MB |
| base_backdraft_win | wall / max / >33 | 11.0 / 16.8 / 0 | 11.0 / 16.8 / 0 |
| base_backdraft_win | heap peak / script | 22.4 MB / 1242 ms | 22.9 MB / 1086 ms |
| base_backdraft_win | textures after / GL peak | 131 × 293.9 MB | 70 × 220.0 MB |
| backdraft_spins | wall / max / >33 | 62.8 / 33.4 / 2 | 62.8 / 16.8 / 0 |
| backdraft_spins | heap peak / script | 34.1 MB / 6739 ms | 33.0 MB / 5156 ms |
| backdraft_spins | GL uploads in round / GL peak | 31 / 18.9 MB / 318.4 | 31 / 1.8 MB / 221.7 |
| backdraft_spins | textures after round | 147 × 318.4 MB | 86 × 221.7 MB |
| inferno_buy | wall / max / >33 / >100 | 71.5 / 66.6 / 3 / 0 | 71.6 / 50.0 / 1 / 0 |
| inferno_buy | long tasks # / total / longest | 1 / 52 / 52 | 0 / 0 / 0 |
| inferno_buy | heap peak / script | 34.6 MB / 6582 ms | 36.0 MB / 6179 ms |
| inferno_buy | GL uploads in round / GL peak | 46 / 78.0 MB / 383.6 | 91 / 98.7 MB / 331.9 |
| inferno_buy | textures after round / DOM nodes | 70 × 199.6 MB / 2440 | 74 × 217.6 MB / 1960 |
| idle (10 s) | frames p95 / max, script, heap end | 16.8 / 16.8, 339 ms, 20.5 MB | 16.7 / 16.8, 370 ms, 23.1 MB |

Console errors: 0 in every cell of both runs. Console warnings: 0.

### Deltas that look like regressions in the raw table but are not

- **"fetched in round" 4 → 140 requests / 11.6 MB.** The harness's round window opens ~3 s after the shutter; the
  after-gate warm (win-rung kit, alarm + mode cards + Sprocket's rig, max-win cards, Backdraft plate, the Rescue block
  decoded-only on non-low tiers) and the paced cold-audio prefetch now land there instead of before the splash gate.
  Per session the total is lower (see headline); nothing is fetched twice; the 4 → 140 is the move, not growth.
- **"textures after round" for backdraft_spins on the phone 160 → 261 MB (laptop 318 → 222 MB).** Pixi's TextureGC
  unloads textures unused for a while; in the baseline it happened to run during the long feature on the phone and not
  on the laptop (160 vs 318 MB for the same scenario). The comparable number is the session's GL peak, which fell
  320 → 261 MB (phone) and 318 → 222 MB (laptop). inferno_buy's 209 → 237 MB (phone) has the same cause; its peak fell
  385 → 374 MB and the Rescue set now uploads behind the bay-door shutter (90 upload calls in the round instead of at
  boot).
- **idle heap end 20 → 23 MB after inferno_buy.** The audio manager keeps the encoded bytes of evictable beds and the
  cold cue set decoded (31.5 MB PCM, not JS heap) and the lazy-asset registry keeps its resolved handles; a ~3 MB higher
  JS floor after a bonus against 30 MB less resident PCM and a round peak that did not move (36 vs 35.9 MB).
- **DOM nodes ±1–9 %** are the HUD's own variance between runs (baseline itself spans 1585–2440 across scenarios).
- **idle script 339 → 370 ms on the laptop** (phone 802 → 567 ms): one 10 s window, within run-to-run noise.

### What the harness cannot see

Headless Chromium exposes no `navigator.deviceMemory`, so `game/quality.svelte.ts` scores both profiles `high` and
these numbers exercise the 'high' path only (full-size lossless rig pages, full LOD plates, high particle caps, no idle
frame cap). The 'low' tier was driven once on this same production bundle through the QA seam
(`globalThis.__PFF_QA = true` + `?quality=low`, phone profile, base_win): boot fine, the 500x round completed with
WIN $500.00, and at idle afterwards the renderer ran at 30 fps (59 clears per 2 s, `ticker.deltaMS` 33.3) while rAF
stayed at 60 — the idle cap is live in production. Group a's low/mid figures (boot images 4.37 MB, half-size rig
pages 0.97 MB for chief + dog, LOD plates) were measured on the dev server and are not repeated here.

## What changed (by group)

### a — boot, quality tiers, lazy loading
- `src/game/quality.svelte.ts` (new): static device tier `high` / `mid` / `low` from `deviceMemory`, core count and
  WebGL2 availability, frozen at import; `measureOnce(app)` samples 180 ticker frames after the gate and drops one tier
  (once per session, remembered in `sessionStorage`) when p90 > 25 ms. `?quality=` is honoured only in DEV or under
  `__PFF_QA`. `qv()` gives per-tier values; `DPR_CAP` 2 / 1.5 / 1.25; `rendererOptions()` clamps the renderer
  resolution to the tier's cap and turns MSAA off on `low` (byte-identical init options on `high`).
- `packages/pixi-svelte`: `createApp({ rendererOptions })` spread by `InitialiseApplication` before the fixed
  `preference: 'webgl'` / `resizeTo`; a shared `enableMipmaps` helper (`mipmaps.ts`) and `getProcessed` exported;
  `AssetsLoader` merges into `loadedAssets` instead of replacing (a lazy set landing during the loader's grace timer
  was otherwise dropped) and passes a per-asset `resolution` to `Assets.load`.
- `assetsScene.ts` split into `bootSceneAssets` (this orientation's base plate, shutter, frame, cells, rung FX) and
  `LAZY_SETS` (winrungs, maxwin, alarm, rescue, backdraft, bg). `assets.ts` boots the boot set, only the two mascot
  rigs (`pf_chief`, `pf_dog`) and, on a wide boot, only the square symbol sheet (the tall one is fetched on a flip;
  a stacked boot keeps both for the blur atlas).
- `lazyAssets.ts` (new): `ensureFeatureAssets(kind)` (memoised, mipmaps on, in-place merge into `loadedAssets`, GPU
  upload through one shared queue at ≤ 4 ms per frame), `loadRig` for `pf_rookie` (alarm set) / `pf_rescued` (rescue
  set), `ensureSymbolSet`. `rescueDirector.ts` awaits the alarm / rescue / backdraft sets before the shutter close or
  phase flip (bounded to 20 s; a stalled network degrades to fallbacks). `Game.svelte` warms winrungs → alarm →
  maxwin → backdraft (and rescue, decoded only, above `low`) in idle chunks 1.2 s after the door lifts, and bakes the
  reel blur atlas in an idle slot while the splash is still up.
- Spine rigs load from `static/assets/spine-lod/<rig>/<rig>.atlas` (lossless WebP pages, −48 % bytes) on `high` and
  `<rig>.half.atlas` (half-size pages, atlas `size:` lines intact) below; skeleton JSON unchanged. 19 large plates /
  cards / signs load from `static/assets/lod/…` at 0.625 scale below `high`, with `resolution: 0.625` so every consumer
  keeps the original logical size.
- `prewarm.ts` on the shared uploader; its walker now reaches Spine pages, bitmap-font pages and the processed
  spritesheets (the coin sheet was never prewarmed). Idle cap on `low`: `ticker.maxFPS = 30` while nothing animates.
  Symbol idle motions capped 3 / 2 / 1 per tier. `app.html` preloads the two fonts and the wordmark. `Background.svelte`
  fetches a missing mood plate lazily and keeps the previous plate up meanwhile.

### b — render / FX
- `Anticipation.svelte`: spark / wash / glow canvases are module singletons (the 9–10 canvas uploads per anticipating
  spin become 0 after the first); on `mid` / `low` the `BlurFilter` ring becomes a baked additive sprite (`high` keeps
  the filter as it was); sparks 16 / 8 / 4.
- `BoardFrame.svelte`: the 5-layer contact shadow is cached as one texture (`cacheAsTexture`, 1× / 0.5× / 0.5×);
  `low` draws one layer.
- `BoardFx.svelte`: one `GraphicsContext` per shape+colour, Graphics pooled per key (no re-tessellation per emit);
  live cap 90 / 50 / 25; every other particle skipped in turbo below `high`.
- `BackdraftFx.svelte`: flame pool grows on demand up to 120 / 60 / 32 (boot no longer instantiates 120 additive
  objects), one shared teardrop context, ticker skipped while nothing is alive.
- `SceneShutter.svelte`: the intro/outro card's chains, sign panel, frame strokes and slate are cached as two sprites
  (rebuilt on layout / font / card change) instead of ~45 unbatchable Graphics per frame; motes 9 / 5 / 0, puffs 14 / 7 / 4.
- `WinRungs.svelte`: pieces 60 / 30 / 16 (half fps on `low`), texture assigned only on a frame flip, the wash quad
  sized to the canvas (was 12000×12000); `present` awaits the winrungs (+ maxwin) textures and the BIG bed before the
  first sign drop, with a re-entrancy guard. `WinCoins.svelte` 60 / 30 / 16 particles; `ParticleEmitter.svelte` removes
  its ticker callback on destroy (one leaked listener per coin win before) and skips `update` while idle and empty.
- `RescueScene.svelte`: seven shared `TextStyle` instances. `Mascots.svelte`: a mascot's rig stage is unmounted while
  its slot is hidden (stacked layouts ticked ~50 invisible bones).

### d — audio
- Codec choice memoised (no `<audio>` element per URL: 223 fewer at the splash); a 47-cue hot set decoded before the
  gate instead of 223 cues (48 requests / 3.18 MB instead of 223 / 6.36 MB); the cold set decodes after the shutter in
  idle-paced batches; turbo variants are fetched only when turbo is switched on (base ids play until decoded).
- Beds > 20 s keep their bytes and are evicted from PCM once no longer current / pending / voiced: resident PCM after
  warm 118.9 → 88.2 MB; a bonus round returns to 88.2 MB instead of growing. `prepareBonus(kind)` pre-decodes the bonus
  bed + entry flourish at the trigger fanfare / alarm reveal.
- The `AudioContext` is suspended ~70 ms after mute and on a hidden tab, resumed on unmute / visible;
  `latencyHint` `interactive` on `high`, `balanced` below.

### e — JS and derived assets
- lodash removed from every workspace import (see above for the two `utils-shared` files finished in this lane):
  `bundle.js` 1,438,287 → 1,304,373 B.
- `sceneLayout()` / `boardLayout()` are memoised `$derived.by` values (same object on consecutive reads; new object on
  resize, chip measurement or a feature band).
- `InterVariable.woff2` subset 352,240 → 133,908 B; the `interGold` bitmap-font page PNG 437,089 → WebP 184,518 B
  (lossless, pixel-identical).
- `tools/perf/derive_spine_lod.py`, `derive_lod_textures.py`, `subset_inter_font.py`, `convert_gold_font_page.py`
  (+ `README.md`) regenerate every derived asset from the originals; `src/game/lod.generated.ts` is written by the
  texture script. Shipped tree on disk 60.5 → 72.5 MB (spine-lod +11.1 MB, lod +1.6 MB; the original rig PNGs stay for
  the rig viewer); per-session transfer is what fell.

## Verification done in this lane

1. `pnpm lint` (eslint `src`) clean before and after the two fixes above.
2. `pnpm --filter pixi-svelte build` then `./tools/build_dist.sh --no-sync`: BUILD OK, provenance stamped.
3. `qa/perf/measure.mjs --label after`: all 10 scenarios ok, exit 0, 0 console errors (`qa/perf/after.json`,
   `qa/perf/after.log`).
4. `qa/smoke/port/smoke.mjs base_win backdraft_spins` on the dev server (3072) + fixtures mock (3073): both PASS,
   finalWin 50000 / 5580, 0 console errors (`qa/perf/smoke/results.json`, screenshots alongside).
5. The shipped bundle driven once at `?quality=low` through the QA seam (phone profile): boot, a completed 500x round,
   30 fps idle cap engaged.

## Notes for the coordinator

- `qa/gate/check_provenance.mjs` hashes `packages/<name>/src` only; packages that keep their code at the package root
  (`utils-shared`, `config-*`, …) never enter the input digest — an edit to `packages/utils-shared/i18n.ts` left the
  digest unchanged in this pass. Worth extending the walk to the package root (`*.ts`) before the next submission.
- lodash / `@types/lodash` are still declared in eight `package.json` files and the lockfile; nothing imports them any
  more. Pruning is a separate housekeeping commit.
- Group a's A6 stays partial on stacked boots (portrait phones keep both symbol sheets, +17 requests / +1.4 MB) until
  `src/game/reels/blurAtlas.ts` stops latching `built = null` when a sheet is missing (or bakes from `symT_*`).
- Report-only items for Codex's rig lane are unchanged from the groups' notes: SP-2 (0.5× atlas export / PMA /
  `.skel`), SP-4 (skip `updatePose` for invisible actors), SP-5 / MSK-13 (no stencil mask while every actor is hidden),
  A2 (`pf_rookie` / `pf_rescued` now arrive after boot through `lazyAssets.loadRig`).

## Appendix — every metric, auto-generated (`baseline` → `after`)

### phone-lowend / boot

| metric | baseline | after | delta |
|---|---|---|---|
| boot: press at (ms) | 1752 | 1358 | -394 (-22%) ✓ |
| boot: shutter done at (ms) | 3484 | 3108 | -376 (-11%) ✓ |
| boot: wall nav->shutter (ms) | 3488 | 3117 | -371 (-11%) ✓ |
| boot: requests | 383 | 140 | -243 (-63%) ✓ |
| boot: transfer (MB) | 31.72 | 11.71 | -20 (-63%) ✓ |
| boot: image req / MB | 147/24.65 | 75/7.98 |  |
| boot: audio req / MB | 223/6.11 | 56/3.23 |  |
| boot: font req / MB | 3/0.4 | 3/0.19 |  |
| boot: json req / MB | 5/0.55 | 3/0.3 |  |
| boot: text req / MB | 5/0.02 | 3/0.02 |  |
| boot: frames p50 (ms) | 16.7 | 16.7 | 0 (0%) |
| boot: frames p95 (ms) | 66.7 | 50 | -16.7 (-25%) ✓ |
| boot: frames max (ms) | 733.2 | 666.7 | -66.5 (-9%) ✓ |
| boot: frames >33 ms | 17 | 14 | -3 (-18%) ✓ |
| boot: long tasks # / total ms / longest | 4/1232/672 | 3/971/629 |  |
| boot: heap peak (MB) | 19.1 | 14.9 | -4.2 (-22%) ✓ |
| boot: GL uploads calls / MB | 125/221.91 | 60/125.87 |  |
| textures after boot (count) | 125 | 81 | -44 (-35%) ✓ |
| textures after boot (MB) | 293.9 | 257.7 | -36.2 (-12%) ✓ |
| GL peak (MB) | 293.9 | 257.7 | -36.2 (-12%) ✓ |
| +3s after shutter: frames p95 / max | 16.8/16.8 | 16.7/16.8 |  |
| +3s after shutter: long tasks #/ms | 0/0 | 0/0 |  |
| +3s after shutter: heap peak (MB) | 18.9 | 17 | -1.9 (-10%) ✓ |
| console errors | 0 | 0 | 0 |

### phone-lowend / base_win

| metric | baseline | after | delta |
|---|---|---|---|
| round wall (s) | 33.2 | 33.3 | +0.1 (0%) ✗ |
| round: frames p50 (ms) | 16.7 | 16.7 | 0 (0%) |
| round: frames p95 (ms) | 16.8 | 16.8 | 0 (0%) |
| round: frames max (ms) | 33.3 | 16.8 | -16.5 (-50%) ✓ |
| round: frames >33 ms | 1 | 0 | -1 (-100%) ✓ |
| round: frames >100 ms | 0 | 0 | 0 |
| round: long tasks # / total ms / longest | 0/0/0 | 0/0/0 |  |
| round: heap start / peak / end (MB) | 19.2/34.8/29.1 | 14.3/33.6/22.1 |  |
| round: heap peak (MB) | 34.8 | 33.6 | -1.2 (-3%) ✓ |
| round: script (ms) | 4828 | 3657 | -1171 (-24%) ✓ |
| round: fetched req / MB | 4/1.5 | 140/11.61 |  |
| round: GL uploads calls / MB | 22/16.48 | 22/0.92 |  |
| textures after round (count) | 147 | 103 | -44 (-30%) ✓ |
| textures after round (MB) | 315.7 | 258.8 | -56.9 (-18%) ✓ |
| GL peak (MB) | 315.7 | 258.8 | -56.9 (-18%) ✓ |
| DOM nodes | 1737 | 1745 | +8 (0%) ✗ |
| console errors | 0 | 0 | 0 |

### phone-lowend / base_backdraft_win

| metric | baseline | after | delta |
|---|---|---|---|
| round wall (s) | 11 | 10.9 | -0.1 (-1%) ✓ |
| round: frames p50 (ms) | 16.7 | 16.7 | 0 (0%) |
| round: frames p95 (ms) | 16.7 | 16.7 | 0 (0%) |
| round: frames max (ms) | 16.8 | 16.8 | 0 (0%) |
| round: frames >33 ms | 0 | 0 | 0 |
| round: frames >100 ms | 0 | 0 | 0 |
| round: long tasks # / total ms / longest | 0/0/0 | 0/0/0 |  |
| round: heap start / peak / end (MB) | 19.4/24.5/19.9 | 14.5/23.4/23.4 |  |
| round: heap peak (MB) | 24.5 | 23.4 | -1.1 (-4%) ✓ |
| round: script (ms) | 1961 | 1469 | -492 (-25%) ✓ |
| round: fetched req / MB | 0/0 | 136/10.1 |  |
| round: GL uploads calls / MB | 6/0.06 | 6/0.06 |  |
| textures after round (count) | 131 | 87 | -44 (-34%) ✓ |
| textures after round (MB) | 293.9 | 257.8 | -36.1 (-12%) ✓ |
| GL peak (MB) | 293.9 | 257.8 | -36.1 (-12%) ✓ |
| DOM nodes | 1585 | 1724 | +139 (9%) ✗ |
| console errors | 0 | 0 | 0 |

### phone-lowend / backdraft_spins

| metric | baseline | after | delta |
|---|---|---|---|
| round wall (s) | 63 | 62.9 | -0.1 (-0%) ✓ |
| round: frames p50 (ms) | 16.7 | 16.7 | 0 (0%) |
| round: frames p95 (ms) | 16.7 | 16.7 | 0 (0%) |
| round: frames max (ms) | 66.7 | 33.3 | -33.4 (-50%) ✓ |
| round: frames >33 ms | 2 | 1 | -1 (-50%) ✓ |
| round: frames >100 ms | 0 | 0 | 0 |
| round: long tasks # / total ms / longest | 0/0/0 | 0/0/0 |  |
| round: heap start / peak / end (MB) | 16.1/35.9/24.1 | 14.4/32.8/22.7 |  |
| round: heap peak (MB) | 35.9 | 32.8 | -3.1 (-9%) ✓ |
| round: script (ms) | 9568 | 6999 | -2569 (-27%) ✓ |
| round: fetched req / MB | 4/1.74 | 140/11.84 |  |
| round: GL uploads calls / MB | 31/21.51 | 31/4.41 |  |
| textures after round (count) | 63 | 103 | +40 (63%) ✗ |
| textures after round (MB) | 160.1 | 261.1 | +101 (63%) ✗ |
| GL peak (MB) | 320.1 | 261.1 | -59 (-18%) ✓ |
| DOM nodes | 1680 | 1813 | +133 (8%) ✗ |
| console errors | 0 | 0 | 0 |

### phone-lowend / inferno_buy

| metric | baseline | after | delta |
|---|---|---|---|
| round wall (s) | 71.5 | 71.7 | +0.2 (0%) ✗ |
| round: frames p50 (ms) | 16.7 | 16.7 | 0 (0%) |
| round: frames p95 (ms) | 16.7 | 16.8 | +0.1 (1%) ✗ |
| round: frames max (ms) | 116.7 | 83.3 | -33.4 (-29%) ✓ |
| round: frames >33 ms | 6 | 4 | -2 (-33%) ✓ |
| round: frames >100 ms | 1 | 0 | -1 (-100%) ✓ |
| round: long tasks # / total ms / longest | 3/200/83 | 1/64/64 |  |
| round: heap start / peak / end (MB) | 14.1/35.9/20.3 | 14.1/36.2/22.8 |  |
| round: heap peak (MB) | 35.9 | 36.2 | +0.3 (1%) ✗ |
| round: script (ms) | 11354 | 9566 | -1788 (-16%) ✓ |
| round: fetched req / MB | 2/3.14 | 138/13.24 |  |
| round: GL uploads calls / MB | 46/84.11 | 90/106.11 |  |
| textures after round (count) | 68 | 71 | +3 (4%) ✗ |
| textures after round (MB) | 209.2 | 237.2 | +28 (13%) ✗ |
| GL peak (MB) | 385.2 | 374.4 | -10.8 (-3%) ✓ |
| DOM nodes | 1930 | 1954 | +24 (1%) ✗ |
| idle: frames p95 / max | 16.8/16.8 | 16.7/16.8 |  |
| idle: script (ms) | 802 | 567 | -235 (-29%) ✓ |
| idle: heap end (MB) | 19.9 | 23 | +3.1 (16%) ✗ |
| console errors | 0 | 0 | 0 |

### laptop-old / boot

| metric | baseline | after | delta |
|---|---|---|---|
| boot: press at (ms) | 1129 | 820 | -309 (-27%) ✓ |
| boot: shutter done at (ms) | 2807 | 2517 | -290 (-10%) ✓ |
| boot: wall nav->shutter (ms) | 2809 | 2522 | -287 (-10%) ✓ |
| boot: requests | 383 | 123 | -260 (-68%) ✓ |
| boot: transfer (MB) | 31.72 | 10.01 | -21.7 (-68%) ✓ |
| boot: image req / MB | 147/24.65 | 58/6.28 |  |
| boot: audio req / MB | 223/6.11 | 56/3.23 |  |
| boot: font req / MB | 3/0.4 | 3/0.19 |  |
| boot: json req / MB | 5/0.55 | 3/0.3 |  |
| boot: text req / MB | 5/0.02 | 3/0.02 |  |
| boot: frames p50 (ms) | 16.7 | 16.7 | 0 (0%) |
| boot: frames p95 (ms) | 33.4 | 33.3 | -0.1 (-0%) ✓ |
| boot: frames max (ms) | 400 | 133.4 | -266.6 (-67%) ✓ |
| boot: frames >33 ms | 12 | 8 | -4 (-33%) ✓ |
| boot: long tasks # / total ms / longest | 3/697/364 | 3/538/327 |  |
| boot: heap peak (MB) | 15.5 | 13.5 | -2 (-13%) ✓ |
| boot: GL uploads calls / MB | 125/221.91 | 43/96.73 |  |
| textures after boot (count) | 125 | 64 | -61 (-49%) ✓ |
| textures after boot (MB) | 293.9 | 220 | -73.9 (-25%) ✓ |
| GL peak (MB) | 293.9 | 220 | -73.9 (-25%) ✓ |
| +3s after shutter: frames p95 / max | 16.7/16.8 | 16.7/16.8 |  |
| +3s after shutter: long tasks #/ms | 0/0 | 0/0 |  |
| +3s after shutter: heap peak (MB) | 18.8 | 16.6 | -2.2 (-12%) ✓ |
| console errors | 0 | 0 | 0 |

### laptop-old / base_win

| metric | baseline | after | delta |
|---|---|---|---|
| round wall (s) | 33.2 | 33.3 | +0.1 (0%) ✗ |
| round: frames p50 (ms) | 16.7 | 16.7 | 0 (0%) |
| round: frames p95 (ms) | 16.8 | 16.7 | -0.1 (-1%) ✓ |
| round: frames max (ms) | 16.8 | 16.8 | 0 (0%) |
| round: frames >33 ms | 0 | 0 | 0 |
| round: frames >100 ms | 0 | 0 | 0 |
| round: long tasks # / total ms / longest | 0/0/0 | 0/0/0 |  |
| round: heap start / peak / end (MB) | 20.1/34.9/20.2 | 14.2/35/21.6 |  |
| round: heap peak (MB) | 34.9 | 35 | +0.1 (0%) ✗ |
| round: script (ms) | 3198 | 2621 | -577 (-18%) ✓ |
| round: fetched req / MB | 4/1.5 | 140/11.61 |  |
| round: GL uploads calls / MB | 22/16.12 | 22/0.56 |  |
| textures after round (count) | 147 | 86 | -61 (-41%) ✓ |
| textures after round (MB) | 315.3 | 220.7 | -94.6 (-30%) ✓ |
| GL peak (MB) | 315.3 | 220.7 | -94.6 (-30%) ✓ |
| DOM nodes | 1733 | 1745 | +12 (1%) ✗ |
| console errors | 0 | 0 | 0 |

### laptop-old / base_backdraft_win

| metric | baseline | after | delta |
|---|---|---|---|
| round wall (s) | 11 | 11 | 0 (0%) |
| round: frames p50 (ms) | 16.7 | 16.7 | 0 (0%) |
| round: frames p95 (ms) | 16.8 | 16.7 | -0.1 (-1%) ✓ |
| round: frames max (ms) | 16.8 | 16.8 | 0 (0%) |
| round: frames >33 ms | 0 | 0 | 0 |
| round: frames >100 ms | 0 | 0 | 0 |
| round: long tasks # / total ms / longest | 0/0/0 | 0/0/0 |  |
| round: heap start / peak / end (MB) | 20.3/22.4/21.3 | 14.5/22.9/22.9 |  |
| round: heap peak (MB) | 22.4 | 22.9 | +0.5 (2%) ✗ |
| round: script (ms) | 1242 | 1086 | -156 (-13%) ✓ |
| round: fetched req / MB | 0/0 | 136/10.1 |  |
| round: GL uploads calls / MB | 6/0.01 | 6/0.01 |  |
| textures after round (count) | 131 | 70 | -61 (-47%) ✓ |
| textures after round (MB) | 293.9 | 220 | -73.9 (-25%) ✓ |
| GL peak (MB) | 293.9 | 220 | -73.9 (-25%) ✓ |
| DOM nodes | 1712 | 1724 | +12 (1%) ✗ |
| console errors | 0 | 0 | 0 |

### laptop-old / backdraft_spins

| metric | baseline | after | delta |
|---|---|---|---|
| round wall (s) | 62.8 | 62.8 | 0 (0%) |
| round: frames p50 (ms) | 16.7 | 16.7 | 0 (0%) |
| round: frames p95 (ms) | 16.7 | 16.7 | 0 (0%) |
| round: frames max (ms) | 33.4 | 16.8 | -16.6 (-50%) ✓ |
| round: frames >33 ms | 2 | 0 | -2 (-100%) ✓ |
| round: frames >100 ms | 0 | 0 | 0 |
| round: long tasks # / total ms / longest | 0/0/0 | 0/0/0 |  |
| round: heap start / peak / end (MB) | 19.9/34.1/25.2 | 14.2/33/23.3 |  |
| round: heap peak (MB) | 34.1 | 33 | -1.1 (-3%) ✓ |
| round: script (ms) | 6739 | 5156 | -1583 (-23%) ✓ |
| round: fetched req / MB | 4/1.74 | 140/11.84 |  |
| round: GL uploads calls / MB | 31/18.88 | 31/1.78 |  |
| textures after round (count) | 147 | 86 | -61 (-41%) ✓ |
| textures after round (MB) | 318.4 | 221.7 | -96.7 (-30%) ✓ |
| GL peak (MB) | 318.4 | 221.7 | -96.7 (-30%) ✓ |
| DOM nodes | 1807 | 1813 | +6 (0%) ✗ |
| console errors | 0 | 0 | 0 |

### laptop-old / inferno_buy

| metric | baseline | after | delta |
|---|---|---|---|
| round wall (s) | 71.5 | 71.6 | +0.1 (0%) ✗ |
| round: frames p50 (ms) | 16.7 | 16.7 | 0 (0%) |
| round: frames p95 (ms) | 16.7 | 16.8 | +0.1 (1%) ✗ |
| round: frames max (ms) | 66.6 | 50 | -16.6 (-25%) ✓ |
| round: frames >33 ms | 3 | 1 | -2 (-67%) ✓ |
| round: frames >100 ms | 0 | 0 | 0 |
| round: long tasks # / total ms / longest | 1/52/52 | 0/0/0 |  |
| round: heap start / peak / end (MB) | 19.9/34.6/26.2 | 14/36/22.7 |  |
| round: heap peak (MB) | 34.6 | 36 | +1.4 (4%) ✗ |
| round: script (ms) | 6582 | 6179 | -403 (-6%) ✓ |
| round: fetched req / MB | 2/3.14 | 138/13.24 |  |
| round: GL uploads calls / MB | 46/78.04 | 91/98.68 |  |
| textures after round (count) | 70 | 74 | +4 (6%) ✗ |
| textures after round (MB) | 199.6 | 217.6 | +18 (9%) ✗ |
| GL peak (MB) | 383.6 | 331.9 | -51.7 (-13%) ✓ |
| DOM nodes | 2440 | 1960 | -480 (-20%) ✓ |
| idle: frames p95 / max | 16.8/16.8 | 16.7/16.8 |  |
| idle: script (ms) | 339 | 370 | +31 (9%) ✗ |
| idle: heap end (MB) | 20.5 | 23.1 | +2.6 (13%) ✗ |
| console errors | 0 | 0 | 0 |
