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

This stage deliberately isolates a single clip: it does not exercise director
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

## Focused verification

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
