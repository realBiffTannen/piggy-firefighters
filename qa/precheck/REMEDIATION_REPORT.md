# STAKE PRE-SUBMISSION REMEDIATION — piggy-firefighters

repo `/Users/jbull/code/piggy-firefighters` @ `c111822` (branch `claude/bold-bell-aoscdj`) | ledger 18 families (15 ranked + 3 provisional) | tree at start: clean
artefact under test: the staged build `apps/piggy_firefighters/build` (bundle `bundle.2fEgGNG2.js` before the fix, `bundle.DJk68TR0.js` after; `./tools/build_dist.sh --no-sync`, BUILD OK 59 MB), served ONE DIRECTORY DEEP at `http://127.0.0.1:3062/v70/` the way Stake mounts a game, booted against this lane's fixtures-only mock RGS on `127.0.0.1:3061`. `game/dist` was not synced (coordinator's final build). No zip exists: the submission is a directory upload, so the staged directory is the artefact.

Environment stated up front (Step 1, consequence 6): mount path `/v70/`; device pixel ratios 1.0 / 1.1 / 1.25 / 1.5 / 2.0; renderer backend that initialised: **WebGL2 on every cell**, with a REAL WebGPU adapter present in the harness (Chromium 153.0.8010.12, `navigator.gpu.requestAdapter()` -> apple / metal-3 under `--enable-unsafe-webgpu --enable-features=Vulkan,WebGPU`), so a WebGPU init would have been seen. Every probe ran under `bash`, every browser launch muted.

## SCOREBOARD

    probed 18   HIT 2   CLEAR 13   UNPROVEN 3
    fixed 1     verified 1   escalated 1   needs-decision 0
    SAVES 1 — items removed that Stake raised before, across 1 prior cycle (piggy-builders, the Popout S family)

## CHANGES MADE

`apps/piggy_firefighters/src/app.html:162` — reviewer-viewport-layout — in the app's own `@media (max-height: 210px) and (min-aspect-ratio: 13/10) and (max-width: 339px)` tier, `.hud-spin-group { padding-right: 1px }` -> `12px` (one value; the HUD package is a protected donor and this tier already lived in app.html).
   probe before: leg c, 330x190, bar: `#turbo` rect 297..341 in a 330px viewport — `inside: false` (11px past the right edge; spin/auto/turbo tuck under each other by the HUD's -12px margins so the layout "fit" while the box did not).
   probe after:  leg c, 330x190, bar: `#turbo` rect 286..330, 8/8 bar controls inside and hit-testable at their centres; balance/bet/win untruncated. 320x568 and 400x225 byte-identical before/after (tier is width-scoped).
   siblings swept: 5 presets x 7 surfaces = 35 surface audits (bar, burger menu, rules sheet, bet ladder, autoplay menu, buy sheet idle, buy sheet with a pending card), 236 control audits — 0 unreachable. Controls that needed the surface's own scroll to reach (buy sheet, burger popup, bet ladder at 330x190; buy sheet at 400x225/480x270/320x568) are recorded per surface as `viaScroll` and are not defects: each surface is exactly one `overflow-y: auto` container and `scrollIntoView` makes every one hittable (the ledger's S1 defect is a centred overlay with NO scroll path).
   re-staged: `./tools/build_dist.sh --no-sync` -> BUILD OK; `padding-right: 12px` present once in `build/index.html`; `preference:"webgl"` and the depth-stencil guard unchanged in the new bundle; 0 source files newer than the build.

## SAVES

    SAVE — reviewer-viewport-layout
      found:    apps/piggy_firefighters/src/app.html:162 (330px tier) — probe-session.mjs leg c, 330x190 bar audit: `#turbo` 297..341 in 330, inside=false
      fixed:    the spin group's right padding at the <=339px tier, 1px -> 12px, moving the ring/auto/turbo column 11px left
      verified: leg c re-run on the re-staged artefact: 330x190 bar 8/8 inside+hittable; all five presets (330x190, 400x225, 480x270, 800x450, 320x568) x 7 surfaces -> 0 unreachable controls, 0 page errors; subpath probe re-run on the new artefact PASS
      cost before: piggy-builders round 2 (2026-07-20) — "Bonus menu should be scaled better on Popout S; the 'Cancel' button is hard to trigger." (R2-03, a regression of R1-03 "Game Info in Popout S and Mobile screen mode must not display both scrollbars at the same time."). Same family and the same 330x190 preset piggy-builders' review used; a different control (the bar's speed button, not the bonus menu's Cancel).
      round cost:  round-2 comment 2026-07-20 -> release 2026-07-24 (info.json); the cycle as a whole: 2 submissions, 20 days, 28 frontend versions.

    SAVE — renderer-backend-untested-on-review-hardware   (pre-check evidence, NOT scored as a round)
      found:    nothing to fix — packages/pixi-svelte/src/lib/components/InitialiseApplication.svelte:127 already ships `preference: 'webgl'` with the depth-stencil size guard (:71-100), and both are in the bundle (`preference:"webgl"` x1, guard typeof site x1)
      fixed:    NOT NEEDED (already fixed upstream in this workspace before this run)
      verified: probe-renderer-backend.mjs with a real adapter: 1290x911@1.1 / 1512x945@1.25 / 1366x768@1.5 / 1440x900@1.0 / 390x844@2.0 -> backend webgl on every cell (canvas `getContext('webgl2')` readback), 0 GPU-validation console lines, lit fraction 0.958-0.988, mean luminance 86-101. Canary (bundle served with `preference:"webgpu"` and the guard's feature-detect disabled): backend readback flips to webgpu on all five cells — the backend assertion can go red — but the black board does NOT reproduce on pixi.js 8.8.1 + Apple Metal (lit 0.96, 0 validation lines), so the pixel half of the probe is UNPROVEN as a discriminator on this Mac.
      cost before: piggy-christmas pre-check 2026-08-30 — "The same issue is still present." Black board, intact HTML HUD. NOT a completed review round.
      round cost:  unscored.

    SAVE — base-path-assumed-to-be-site-root   (pre-check evidence, NOT scored as a round)
      found:    nothing to fix — app.html fonts go through `%sveltekit.assets%`, runtime asset URLs through `new URL('../../assets/..', bundleUrl)` / `document.baseURI`; 0 root-absolute `/assets|/_app|/fonts` refs in the bundle
      fixed:    NOT NEEDED
      verified: probe-subpath-serving.mjs, staged build mounted at /v70/, splash gate passed: 385 same-origin requests, 0 >= 400, 0 outside the mount, 0 external origins; Inter 500/900, StationSign and Lilita One all `loaded`. Canary (inline @font-face with surplus parent hops): request escaped to `/assets/fonts/InterVariable.woff2` at the origin root, 404, face `error` — red. Re-run on the re-staged artefact: PASS again.
      cost before: piggy-christmas pre-check 2026-08-30 — reviewer console, two woff2 500s at the origin root.
      round cost:  unscored.

    SAVE — console-error-budget-unowned   (pre-check evidence, NOT scored as a round)
      found:    no allowlist exists anywhere under qa/ or tools/ (nothing to excuse); the full session below produced 1 console record in total
      fixed:    the gate it lacked: qa/precheck/probe-session.mjs leg a budgets, by TEXT, console errors, uncaught pageerrors, same-origin >= 400 and warnings matching /validation|invalid|does not match|failed to (load|fetch|compile|link)|out of memory|context lost/i at ZERO, and fails on any warning-cap notice
      verified: boot + 10 wire-confirmed rounds (/wallet/play -> /wallet/end-round, including a 500x and a 46x round) + burger menu, rules sheet, bet ladder, autoplay menu, buy sheet, pending buy card + four bought features -> 0 errors, 0 pageerrors, 0 hard-failure warnings, 0 cap notices, 0 same-origin >= 400, 0 external origins (1 console record total). Legs b/c/d likewise 0.
      cost before: piggy-christmas pre-check 2026-08-30 — ~500 validation lines, 2 font 500s, 6 404s.
      round cost:  unscored.

## FIXED BUT NOT A SAVE

none.

## ESCALATE — needs a decision or a change I may not make

- **artifact-served-is-not-artifact-tested (P1: no provenance stamp)** — `tools/build_dist.sh` is outside this lane (apps/piggy_firefighters/** only) and there is no `inputDigest`/`provenance` stamp anywhere under tools/ or qa/; by the ledger's rule a missing stamp is FAIL by default. What must change: `tools/build_dist.sh` should write `build/provenance.json` (git HEAD + a digest over `apps/piggy_firefighters/src`, `static`, `packages/*/src`, `vendor/*.tgz`) and `qa/gate` should recompute it against the artefact. Mitigation applied now: P1b fallback measured — 0 source files newer than `build/index.html` after the re-stage; P3 — 0 dangling attribute/CSS refs (subpath probe). The coordinator's final `./tools/build_dist.sh` (sync to game/dist) must be followed by `node qa/precheck/probe-subpath-serving.mjs --dir game/dist` so the shipped tree, not this staged one, is the one verified.

## NEEDS-DECISION

none.

## UNPROVEN — probes that could not run or cannot fail

- **gate-that-cannot-go-red** — read only: `qa/gate/run.mjs` aggregates check_mode_costs / check_round_tier / check_cue_ids / make_padding --check / gen_art_meta --check, each positively phrased and `process.exit(1)` on FAIL; no violation was injected into any of them this run. Of the probes authored here, subpath's canary is measured red; renderer's backend canary is red, its pixel canary cannot go red on this hardware (see above). Needs: a violation injected per repo gate.
- **compliance-controls-lost-in-refactor** — the ledger marks its probe VACUOUS; not run as a check. Partial live evidence only: the autoplay menu rendered in social mode reads "10 | 25 | ... | 1000 | CONFIRM 10 ROUNDS | 10 x USD 1.00 = USD 10.00" (a confirm step with the committed total), and the HUD host consumes `disabledAutoplay` (x4), `disabledTurbo`/`disabledSuperTurbo` (x3), `disabledBuyFeature`, `disabledSpacebar` (x2), `disabledSlamstop`, `displayNetPosition`, `displaySessionTimer`, `minimumRoundDuration`, `socialCasino`. Needs: the mount-closure writer audit, repaired.
- **win-attribution-transparency** — `components/Paylines.svelte` and `components/LinePop.svelte` exist (per-line win presentation), not rendered or timed by this run. Needs: a scene-graph/pixel read of the line-by-line pass.

## PROBE RESULTS (every family, with the subject it examined)

Provisional, run first:
- P1 renderer-backend — **CLEAR** (backend axis; pixel canary unprovable here). Subject: the staged bundle at /v70/ on five (viewport x DPR) cells with a real WebGPU adapter available. `qa/precheck/evidence/renderer-backend.json`, `renderer-backend-canary.json`.
- P2 base-path — **CLEAR**. Subject: 385 same-origin requests of the staged build at /v70/ + 4 font families. `subpath-serving.json`, `subpath-serving-canary.json`.
- P3 console-error-budget — **CLEAR**. Subject: leg a's full session (1 console record in total). `session-a.json`.

Ranked:
1. restricted-terminology-scoped-too-narrowly — **CLEAR**. Runtime: `?social=true` boot, rendered `innerText` of the bar, burger menu, rules sheet (all 11 sections), bet ladder, autoplay menu, buy sheet idle and with a pending card, diffed against the 45-term stake.us table INCLUDING the closed compounds (payline(s), paytable, payout(s), costs, credits, currencies): 0 hits. Bar reads "BALANCE | USD 10,000.00 | WIN | USD 0.00 | PLAY | USD 1.00 | SPIN | PLAY FEATURE"; rules read "PLAY FEATURE opens the feature cards. Every feature entry asks for confirmation first."; sweeps replay (`currency=XSC`) reads "PLAY 1.00 SC / WIN 0.00 SC". Static: 22 restricted-family literals in `src/**` + HUD `defaultStrings.js`, every one the `std` arm of a paired `{std, social}` entry or an unrendered placeholder name (`{cost}`). `session-b.json`.
2. reviewer-viewport-layout — **HIT -> FIXED -> VERIFIED** (above). `session-c.json`.
3. gate-that-cannot-go-red — **UNPROVEN** (above).
4. replay-mode-as-afterthought — **CLEAR**. Runtime leg d against an ad-hoc replay RGS (:3060) that 500s any `/wallet/*`: at 1440x900 and 400x225 the pre-roll shows all six rows co-located (HUD `JewelReplayModal.svelte`: Mode BASE / Base Bet $1.00 / Cost Multiplier 1x / Total Bet Cost $1.00 / Payout Multiplier 2.4x / Total Win $2.40 — the 2.4x is the book's `payoutMultiplier`, read from the `/bet/replay` response, not re-derived), START REPLAY inside and hittable at 400x225 (rect 135,179..265,197), the round plays, the card returns as PLAY AGAIN (inside, hittable) and PLAY AGAIN re-plays the book; 0 wallet requests; the reel grid is fully visible at 400x225 mid-play (`session-d-400x225-midplay.png`, R2-06 shape). Mode name resolves through `betModeTitle` -> the game's `BUY_<KEY>_TITLE` overrides (ALARM CALL, RESCUE SPINS, ...); base prints the HUD literal "BASE" (R1-10 note below). `session-d.json`.
5. artifact-served-is-not-artifact-tested — **HIT (no provenance gate) -> ESCALATED** (above).
6. money-formatting-not-single-sourced — **CLEAR**. One owner: `src/game/money.ts` delegating to the HUD's reviewed `defaultMoney` (BigInt micro-units, truncating, wallet/result split `formatMicroFixed`/`formatMicro`, zero-decimal rows JPY/KRW/IDR/CLP/VND). Per-site formatter sweep of `src/**`: every `toFixed`/`toLocaleString` hit is CSS, an audio log or a base-bet multiple ("15,000x"); 0 hardcoded symbols/codes; 0 `toFixed(2)` on money. Runtime: WIN $500.00 / balance $10,499.00 after a pinned 500x book, $2.40 / $10,001.40 after a 2.4x book; ladder USD 0.10..USD 100.00 in social mode.
7. presentation-derived-not-read-from-book — **CLEAR**. P1: `money.ts:69` rounds at 2dp (value-preserving); `Win.svelte:97` floors only the count-up interims and `land()` sets `formatBookAmount(amount)`. P2: MAX only on `wincap` (`roundTier`, known). P3 runtime: the plated WIN equals the wire payout exactly (500000000 micro -> $500.00; interims $300.19, $499.75 then $500.00).
8. authenticate-response-not-sole-bet-authority — **CLEAR**. `packages/components-shared/src/components/Authenticate.svelte` consumes betLevels/minBet/maxBet/stepBet/defaultBetLevel (`resolveBetLevels`, `snapToBetLevel`); `state-shared/stateBet.svelte.ts` `correctBetAmount` snaps to RGS options only — no `balanceAmount /` clamp; no bet/stake/wager localStorage key (only `-speed`, `-ante` (dropped at boot by hud.config.ts), `-music-volume`, `-sfx-volume`); a currency change is a new launch -> re-authenticate -> defaultBetLevel re-read (R2-02 shape). Runtime: opening bet $1.00 = mock `defaultBetLevel`, ladder = mock `betLevels`.
9. language-channel-and-locale-safety — **CLEAR**. `Object.hasOwn` guards at `src/i18n/messagesMap/index.ts:332`, `LoadI18n`, and `Authenticate.svelte activatedLang()`; English only offered. Runtime: `?lang=de` -> `/wallet/authenticate` body `{"language":"en"}`, `<html lang="en">`, labels BALANCE / SPIN.
10. currency-marker-by-enumeration — **CLEAR**. Single authority HUD `money/money.js` with XGC/XSC/XEC rows (suffix GC/SC, per Stake's table) plus one documented, review-cited ISK override in `money.ts` (left alone per the ledger's false-positive note 2); the untabulated fall-through prints the ISO code as a prefix (marked, never bare). Runtime: `currency=XSC` replay "1.00 SC" / "2.40 SC"; social + USD "USD 10,000.00".
11. compliance-controls-lost-in-refactor — **UNPROVEN** (vacuous probe; partial live evidence above).
12. mandatory-disclosure-missing-or-fail-closed — **CLEAR**. Rendered rules sheet (social boot): "Theoretical return: 96.70% in every mode (base game, ALARM BOOST, ...)", "The maximum win is 15,000x the base play amount in every mode", mode costs 1.5x/12x/18x/50x/90x, "Malfunction voids all wins and plays ... TM and (c) 2026 Engine." (no "Stake Engine"), and R1-02 checked by hand: no retrigger exists and the sheet says so — "no alarms appear, so the feature cannot start again from inside" (Rescue) / "No alarms appear, so Rescue Spins cannot start." (Backdraft Spins). No fail-closed gate: `displayRTP` is consumed nowhere; the figures are unconditional.
13. debug-surface-in-shipped-build — **CLEAR** (notes). Bundle: 0 `__pff*` dev hooks, 0 `fixture=`, 0 `devFixture`, 0 `debugger`; `__qaSetSpeedForTest`/`__qaRoundStartCount` are gated on `cfg.debug.qaSeams`, which hud.config.ts does not set. Notes, not fixed: `?skipSplash=1` / `?skipBrand=1` are honoured by the bumper in production; Pixi `hello: true` prints its banner to the console (a log line, not an error).
14. round-lifecycle-second-pass — **CLEAR**. Leg a: ALARM CALL bought, confirmed, played to `/wallet/end-round` and idle, then bought AGAIN with no pause (1.9 s each); RESCUE SPINS the same twice (19.7 s each, super turbo); 0 pageerrors, 0 console errors through all four (the piggy-builders R2-07 shape, `alphaMode` null on a destroyed texture, did not occur).
15. win-attribution-transparency — **UNPROVEN** (above).

## LEDGER FEEDBACK

- reviewer-viewport-layout D1: the audit MUST `scrollIntoView` before calling a control unreachable, and record that it did. The first run false-positived 24 controls that live inside a single `overflow-y: auto` surface (buy sheet, burger popup, bet ladder). Keep "exactly one scroller" as the criterion, not "visible at scrollTop 0".
- base-path P1: exclude `blob:`/`data:` URLs before the mount test — `new URL('blob:http://host/uuid').pathname` is the inner URL and reads as an escape (false positive on every Pixi/Spine/audio object URL).
- renderer-backend P2: Pixi's `%c`-styled hello banner does not surface as plain console text under Playwright; read the backend from the canvas (`getContext('webgl2')` answers on a WebGL canvas, null on a WebGPU one). And record that the black-board canary does not reproduce on pixi.js 8.8.1 + Apple Metal even with `preference:'webgpu'` and the guard disabled — the pixel assertion is only proven discriminating on the piggy-christmas (8.16 / Windows) evidence; a Mac run proves the backend axis only.
- replay-mode STAGE C/D runtime: since the 2026-09-03 review the pre-roll card RETURNS at end-of-book with its button relabelled PLAY AGAIN while the bar's own PLAY AGAIN stays disabled; an end detector keyed on the bar's button never fires.
- round-lifecycle: the HUD spin button stays pressable mid-round (slam-stop), so "spin enabled" is not "idle"; key idle on spin AND buy enabled, and key the round on `/wallet/play` -> `/wallet/end-round` (the built bundle has no DEV beacons). `/wallet/end-round` fires ~2 ms after `/wallet/play` (settle first, present after), so the balance readout lags the wire until the presentation lands — expected, not a defect.
- R1-10 (replay mode name must match the game's vocabulary) is still claimed by no stage: here base prints the HUD literal "BASE" (`JewelHudReplay.svelte:399`) where the rules say "base game". Vendored HUD; note for the HUD lane, not a change this run may make.
- The fixtures-only mock (`BOOKS_DIR=none`) 404s `/bet/replay`; a replay probe must bring its own replay RGS (leg d does).

## VERIFICATION LOG

    node qa/precheck/probe-subpath-serving.mjs                  -> SUBPATH-SERVING PASS  (385 requests, failed [], escaped [], external []; Inter/StationSign/Lilita loaded)   [run again on the re-staged build: PASS, same numbers]
    node qa/precheck/probe-subpath-serving.mjs --canary         -> SUBPATH-SERVING PASS (canary): escaped ['404 /assets/fonts/InterVariable.woff2'], face status error
    node qa/precheck/probe-renderer-backend.mjs                 -> RENDERER-BACKEND PASS: adapter available {"vendor":"apple","architecture":"metal-3"}; 5/5 cells backend=webgl gpuLines=0 lit 0.958-0.988 mean 86.3-100.5
    node qa/precheck/probe-renderer-backend.mjs --canary        -> RENDERER-BACKEND FAIL (canary): canaryUsedWebgpu true, canaryReproducedFailure false  (reported verbatim: the pixel half cannot go red on this hardware)
    node qa/precheck/probe-session.mjs --legs a                 -> LEG a: PASS {zeroConsoleErrors, zeroPageErrors, zeroHardWarnings, noWarningCap, zeroSameOrigin4xx, zeroExternalOrigins, tenSpins, everySurfaceOpened, fourBuysCompleted, buysWereBoughtModes, noLegError: all true}; rounds ms [22826, 809, 3623, 29937, 3628, 12270, 3628, 808, 3626, 3626]; buys ALARM CALL 1923/1920 ms, RESCUE SPINS 19722/19703 ms
    node qa/precheck/probe-session.mjs --legs b                 -> LEG b: PASS (zeroRestrictedTerms, every disclosure_* true, everySurfaceScraped)
    node qa/precheck/probe-session.mjs --legs c   (before fix)  -> LEG c: FAIL — 330x190 bar `#turbo` 297..341 inside=false (+ 23 scroll-container lines, later reclassified by the scrollIntoView repair)
    ./tools/build_dist.sh --no-sync                              -> BUILD OK (staged in apps/piggy_firefighters/build, game/dist untouched) 59M; css asset urls rewritten: 2
    node qa/precheck/probe-session.mjs --legs c   (after fix)   -> LEG c: PASS {everyPresetBooted, everySurfaceOpened, nonZeroControlsEverywhere, everyControlInsideAndHittable, zeroPageErrors: all true}; 330x190 bar (8 controls, 0 viaScroll, 0 bad)
    node qa/precheck/probe-session.mjs --legs d                 -> LEG d: PASS {sixRowsBothViewports, startInsideAndHittable, playAgainInsideAndHittable, roundEndedBothViewports, playAgainReplayed, zeroWalletTraffic, zeroPageErrors, zeroConsoleErrors, payoutMultiplierMatchesBook: all true}
    plated-win trace (scratch)                                   -> base_win: wire play payout 500000000 / end balance 10499000000; HUD samples $0.00 -> $300.19 -> $499.75 -> $500.00, balance $10,499.00. base_backdraft_win: $2.40 / $10,001.40
    ?lang=de boot (scratch)                                      -> authenticate body {"language":"en"}, html lang en, BALANCE / SPIN
    static: preference:"webgl" x1 and guard typeof x1 in the new bundle; 0 root-absolute asset refs; 0 sources newer than build/index.html
    not run: node qa/gate/run.mjs with injected violations; Storybook; the dev-server smoke (qa/smoke/port) — out of this lane's "once" budget and unaffected by a CSS value

Re-runs after edits were limited to the probe that hit (leg c) plus the shipped-file family the re-stage touches (subpath). The five-cell renderer matrix was not re-run: the only change is one CSS declaration in index.html, and the bundle's `preference:"webgl"` + guard were re-checked statically.
