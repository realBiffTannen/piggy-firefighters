# Isolated clip review viewer

Open `http://127.0.0.1:3008/rigs` after starting the app with
`pnpm dev --host 127.0.0.1 --port 3008 --strictPort`. This development route is
removed by the existing distribution build wrapper. Browser launches must use
`--mute-audio`.

## Review controls

- Only rigs in the runtime export manifest can be selected. Missing exports
  leave all art controls disabled and create no renderer or asset request.
- The selected JSON and atlas use the runtime registry URLs and the workspace's
  installed Spine parser. `isUsableRigData` enforces the same runtime interface.
  A bad export produces a visible error rather than substitute art.
- Skin and animation choices come from the parsed original export. The default
  clip comes from `RIG_DEFINITIONS`; all contracted loops retain their identity.
  Once clips hold their final pose for inspection. Replay returns to setup pose.
- Normal and quarter speed, pause/resume, replay, contract anchor crosses, and a
  bounded log of keyed events and completion/loop boundaries are available.
- Desktop is 920 × 600 logical pixels at 1× rig scale. Phone is 360 × 480 at 0.5×.
  The canvas fits available CSS width. The gold ruler marks the contract height
  (Chief 420, Rookie 380, Ember 220, Trotter 260 authored pixels), with a feet
  baseline; it does not normalize a wrongly sized export to pass the reference.

The default controls isolate a single clip; the Chief button below also reviews
its three spray transitions. Neither path exercises director
crossfades, runtime ladder travel, gameplay timing, particle FX, audio, RGS or
the final phone layout. It does not mark any rig accepted. Record and review
every real clip and skin after the static contract checker passes.

## Lifecycle and ownership

Preview-only code is under `src/routes/rigs`. It owns its Pixi application,
context, resize, graphics, animation listener and ticker callback. Unmount
invalidates pending initialization/loading work; child cleanup precedes renderer
destruction. Shared Pixi asset-cache textures are retained for subsequent
selection, while the owned application and display objects are destroyed.
The preview uses `pixi-svelte`'s provider and repository-local `assetLoad` parser
without installing a separate Spine version or changing shared package exports.

## Initial empty-state verification (before original exports)

Run from the repository root:

```sh
node --test qa/codex/rig-viewer/viewerLogic.test.mts
node qa/codex/rig-viewer/check-components.mjs
node qa/codex/rig-viewer/browser-empty.mjs /absolute/path/to/playwright/index.mjs
```

- PASS: 3 focused synthetic checks (missing export choices, loop identity,
  bounded event history and explicit reference scaling).
- PASS: 5 viewer sources compile with no Svelte warnings or scoped TypeScript
  diagnostics.
- PASS: muted Chromium 151.0.7922.34 at 1360 × 1000 and 390 × 844: empty state,
  disabled art controls, 360px phone frame, no horizontal overflow, reachable
  footer, zero game canvas, zero missing-rig/audio/RGS requests and zero page
  errors. Evidence: `empty-state-report.json`, `empty-desktop.png`,
  `empty-phone.png`; both screenshots visually inspected.
- The first browser gate exposed root-layout inheritance. Claude's coordinated
  `31dbca5` fix lazily loads the game shell outside `/rigs`. Screenshot review
  then exposed `app.html`'s inline scroll lock; the route now overrides it using
  a lifecycle-scoped document class, removed when leaving the viewer.
- PASS: independent read-only lifecycle, anchors and controls review found no
  concrete defect. This is code review, not proof of loaded-art behavior.
- Real exported rig loading, clip control behavior, skins, anchor placement,
  motion craft and recorded acceptance: **NOT RUN**, original exports absent.

No artwork was generated or copied, no full build or simulation was run.

## Original-art capture runner

After the original runtime JSON/atlas/PNG exports land, start the development
viewer and run from the repository root (using the same installed Playwright
entry module as `browser-empty.mjs`):

```sh
node qa/codex/rig-viewer/capture-art.mjs /absolute/path/to/playwright/index.mjs \
  --url http://127.0.0.1:3008/rigs --frames desktop,mobile
```

`--frames` defaults to `desktop`; `--rig pf_chief` can limit a work-in-progress
review (repeat the option for more rigs). The report records that requested
scope explicitly. Outputs default to a new timestamped directory under
`qa/codex/rig-viewer/captures/`; `--output` may select another NEW directory
under this QA directory. Existing evidence is never overwritten.

For an incomplete authoring pilot, pass the explicit viewer URL with its query:
`--url 'http://127.0.0.1:3008/rigs?pilot=1' --rig pf_chief`. The query is
preserved, and JSON marks `authoringPilot: true` with a work-in-progress
limitation. Every declared clip/skin is recorded; required but missing contract
clips, anchors, events and rescued skins are listed for each export. A
successful pilot recording does **not** establish full-contract readiness.
Both contract and motion acceptance stay **NOT RUN** in every capture report.

The runner requires real runtime exports, validates that the viewer loaded its
rig canvas, and compares every loaded clip/skin choice with the hashed JSON.
It records one muted WebM per rig/frame/speed and every clip × skin at normal
and quarter speed. Once clips play through; loops play twice. Three PNG frames
per case sample nominal wall-clock fractions, with actual elapsed times
recorded; these are not asserted animation phases because the viewer clamps
ticker deltas on slow renderers. A fourth frame records the paused final pose
after completion, or the paused pose after two verified loop boundaries (not
an exact seam frame). Each case pauses before selection/clearing and binds its
boundary count to a fresh PLAY row id; older events and clip-prefix matches
cannot satisfy it. A finite completion wait fails if the renderer cannot finish.
Desktop records 1360 × 1000; phone records 390 × 844. Logical canvas size, rig
scale, browser version, URLs, exact served JSON/atlas/texture hashes, disk
hashes before/after, video/frame hashes and browser errors are saved in JSON.
Server responses are hashed and forwarded unchanged through a Playwright route;
this captures PNG bytes even when Chromium's image worker makes its ordinary
response-body API unavailable. JSON, atlas and every texture must still match
the immutable local input hashes.
Video offsets are approximate host timestamps, explicitly labelled; use the
frame timestamps and on-screen controls/log for precise case identification.

Exit codes: **0 CAPTURED** = requested evidence captured without detected
errors; **2 BLOCKED** = missing original exports/coverage; **1 FAIL** = invalid
exports, load/control errors, changed hashes or incomplete captures. With no
exports the runner writes a BLOCKED report before launching any browser. A
partial family remains BLOCKED if the requested set includes missing rigs.
`motionAcceptance` always remains **NOT RUN**: capturing is not artistic
approval. Human review must assess timing, pose, weight, contacts, silhouettes,
loop seams and every skin; game integration and synchronized audio need their
own review. The runner does not generate art or accept substitute animation.

Focused checks (no real-art recording; use Node 24 or another runtime supporting
the same TypeScript stripping as the existing viewer test command):

```sh
node --test qa/codex/rig-viewer/capture-plan.test.mjs qa/codex/rig-viewer/viewerLogic.test.mts
node --check qa/codex/rig-viewer/capture-art.mjs
```

The helper fixtures are synthetic temporary test data, never shipped artwork
or motion evidence. Full-family browser recording requires all original exports.

Prepared-runner verification: **PASS**, 9 focused checks (4 capture helper +
5 viewer logic); runner syntax **PASS**. The no-art preflight at
`capture-preflight/report.json` returned **BLOCKED**, exit 2, all four exports
missing, zero cases and no browser launch. This verifies refusal to accept an
empty viewer; the loaded-art recording path remains **NOT RUN**.

First real-export discovery check (2026-09-25): **PASS** after correcting the
registry glob to resolve the application's `static/assets/spine` directory.
The earlier four-parent path resolved outside the application and could not
discover newly delivered rigs. Muted Chromium loaded the original Chief pilot
as Spine 4.2.43, displayed its three real spray clips and events, and retained
the visible CONTRACT INCOMPLETE warning. This is a loading check, not motion
acceptance: the first rendered pose exposed sleeve deformation requiring
correction before the full recording/review pass.

## Chief spray transitions

The development viewer's **Chief spray sequence** button plays `spray_start`,
holds `spray_loop` for 0.8 animation seconds, then plays `spray_end`. It retains
the outgoing poses and uses the runtime's zero start-to-loop mix and 150 ms
mix into the end. Quarter speed slows the entire sequence, including the hold;
Pause/Resume and Replay apply to it. Selecting a clip returns to independent
clip review. This isolates the transitions; it does not exercise the game
director, water FX, sound or gameplay cancellation.

With a stable original Chief export installed, run the actual browser control
probe into a new output directory:

```sh
node qa/codex/rig-viewer/browser-sequence.mjs /absolute/path/to/playwright/index.mjs \
  qa/codex/rig-viewer/sequence-review-NEW
```

It checks normal and quarter-speed clip/event ordering, actual loop track time,
pause/resume and replacement by a manual clip. Pausing must preserve the actual
canvas pixels and event log; cancellation must survive two replacement loop
boundaries without a stale sequence transition. It records muted video, final
frames, exact served/disk asset hashes and unchanged viewer/probe source hashes.
A control PASS is separate from artistic motion acceptance and full-rig readiness.

The v008 probe **PASS** on Chromium 151 at both speeds with the stronger pause
and cancellation assertions above, matching JSON/atlas/PNG hashes and zero
browser/audio/RGS errors: `sequence-v008-r1/report.json`. The original v006 report
is superseded for these control claims because its shorter waits alone could
not prove pause or cancellation. v008's mid-start, loop and settled pose images
were visually inspected; the raised cuff defect is resolved and hand contact
is continuous. This accepts the pilot anatomy for further authoring only.
The remaining seven Chief clips, continuous motion review, other rigs and
mounted gameplay review are still pending.
