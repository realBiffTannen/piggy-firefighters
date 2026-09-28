# PIGGY FIREFIGHTERS — ledger (newest first; coordinator writes, lanes append under their own heading)

- 2026-09-28 (later) — **NO DISPLAY MODALS FOR SMALL WINS (contract §8 v1.3.1) · game/dist REBUILT**. Owner: "get rid of the
  display modals for small wins". Cause: the win-tier floors (BIG 15x … EPIC 100x) and the centred count-up plaque (20x) were
  measured in BASE-BET units, so the dearer modes raised modals for small returns — a 16x line on a 5x FIVE-ALARM spin (3.2x the
  stake) got a BIG WIN sign, a 101x total on a 100x Inferno buy an EPIC sign, a 21x per-spin win inside a 25x Rescue buy the
  count-up plaque. Now every threshold is in COST units (`game/roundTier.ts` roundTier / rungFloorsBooked / smallWinMaxBooked;
  the rung sign paces on the round's own floors, `winRungs` carries `costX`): base unchanged (15x / 20x), ante 45x / 60x,
  super ante 75x / 100x, Alarm Call 225x / 300x, Rescue 375x / 500x, Backdraft 750x / 1,000x, Inferno 1,500x / 2,000x
  (`qa/smoke/static-2026-09-28/tier_probe.mjs`). Tier 0 (W <= S) unchanged. Contract §8, ANIMATION_CONTRACT winTier row and
  `check_round_tier.mjs` (32 cases) updated; math untouched. Gate 14/14 OK; `game/dist` rebuilt: `bundle.DllHVmeT.js`,
  provenance PASS (digest `8dc50bbd89db…`), sumsSha256 `b72bb9ac9bff…`; static smoke desktop + phone on the published books
  0 errors (`results_v131.json`). Submission kit rebound to this build.
- 2026-09-28 — **OWNER RE-PRICE (contract v1.3, `math-freeze-v2`) · MASCOTS OUT · TROTTERVILLE F.D. · game/dist REBUILT**
  `10ef511` (math v2) · `9a61961` (mascots, shield, card art) · `34afb50` (two ante tiers, prices, 20,000x, math promoted) · build commit.
  Owner instructions today: (1) remove the Chief Hamm and Ember mascots — `pf_chief` / `pf_dog` Spine exports deleted, Mascots.svelte,
  the win-plate chief, the chief hose hand-off and the boot rigs gone; Ember inpainted out of five card paintings (gen_art.py --mask,
  5 paid calls); the Chief stays only as WILD / splash hero / thumbnail; (2) card 1's blank shield now reads TROTTERVILLE / 13 / FIRE
  DEPT. (fictional Trotterville Fire Department, lettered locally by tools/art/letter_card_crest.py; names.ts DEPARTMENT/STATION);
  (3) math redone: ALARM BOOST 3x for exactly 5x the natural chance of each bonus, NEW FIVE-ALARM BOOST `super_ante` 5x for 15x
  (piggy-police's two-tier HUD ante chooser: `anteTiers` + `anteTierConfirm`, RAISE THE ALARM / NO BOOST, CONFIRM before arming),
  Alarm Call 15x (144/9/147 of 300), Rescue 25x, Backdraft 50x, Inferno 100x, max win 20,000x every mode, 100,000 trials per mode.
  Mechanism unchanged (shared canonical banks, exact integer natural factors 1/5/15; BRS = BRA's strips; FR0 27 / FRI 15 wilds put the
  organic bonus means at the set prices; ante tiers pin the >= 40x-cost tail at 0.75, ante SD/cost 8.0, super ante 7.37 least-change;
  an exact RTP-ceiling guard). Production PASS (740,000 trials → 1,520,001 rows, 8 workers, 2,121 s, peak 1,117 MiB); audit PASS
  (`qa/codex/math/v2-audit.json`); promoted to `math/publish/` (`MANIFEST.json`, 15 files, 1,568,941,459 B); 22 real-book fixtures
  synced (incl. ante / super_ante trigger + win); RTP 0.967 every mode (§9). Frontend: seven modes, chooser, rules sheet with the exact
  frequencies, 20,000x everywhere, one super-ante card painting (1 paid call; art spend today $1.80 est., recorded). Gate 14/14 OK.
  `game/dist` rebuilt: 756 files, 66,964 KiB, `bundle.fThyBaRl.js`, provenance PASS (digest `4ed05ff202b8…`), sumsSha256
  `304398d3b508…` (`game/BUILD_INFO.md`); subpath-serving probe PASS; static smoke of that tree on the published v2 books
  (`qa/smoke/static-2026-09-28/`): desktop 1440x900 + phone 390x844, boot → press → one real spin → ante chooser → feature sheet,
  0 console errors / 0 page errors / 0 failed requests; frames show no mascot beside the reels, ALARM BOOST 3x OFF chip, the
  chooser (3x / 5x / NO BOOST), the six feature cards at the new prices. Submission kit rebound (PRE_UPLOAD_CHECKLIST, BUILD_RECORD,
  MATH_HANDOFF, `qa/submission/math_package_manifest.json`). NOT DONE: Codex's `rigLogic.ts` / `RigStage.svelte` /
  `ANIMATION_CONTRACT.md` still carry inert mascot entries; `check_win_coins.mjs` sample text still says $15,000 (not an assertion);
  the human gates (real-phone pass, rig motion review, art acceptance) remain open; no fixture-matrix smoke on this tree.
- 2026-09-26 — **PANEL CEILING RAISERS (items 1–5)** `b81fd18..HEAD` (plan `docs/superpowers/plans/2026-09-26-panel-ceiling-raisers.md`;
  three-seat panel iteration 1 in `qa/stake-review/`). Phone mascots + bay-door bar stand on the HUD's measured bar top; splash
  CSS gradients → painted furniture (2 paid sheets); authored pose B + C key frames for all 12 symbols (38 paid edits + 2
  redraws; three-frame win cut through squashes; lazy after boot); painted bay-door plates; Backdraft Spins bay-door
  intro/outro cards; one Chief on stage for BIG+; rescue multiplier badge climbs per rescue; owner listening pass recorded;
  HUD bonus tile in the owner-supplied Lilita One. Spend today $10.80 (art, recorded). Gates added: hud_bar, symbol_motion,
  splash_no_gradients, rig_beats, bonus_font (all PASS). Recorded motion review `qa/smoke/review/contract/MOTION_REVIEW_2026-09-26.md`.
  OPEN: an unreproduced black-canvas pageerror ('reading "indices"') seen only under SwiftShader at load 100–300; pre-existing
  check_cue_ids FAIL (WinRungs `rung_bed_${...}`, also at 9eac10c); `game/dist` not synced (owner: `! ./tools/build_dist.sh`).
- 2026-09-25 — **LOW-END PERFORMANCE PASS** `968e8e8` + `game/dist` `d1db6bd` (owner: "optimize for devices without the latest hardware").
  Measured with a new throttled harness (`qa/perf/measure.mjs`: phone 390×844@3 at 6× CPU throttle, old laptop 1366×768 at 4×;
  `qa/perf/REPORT.md`). Boot on the phone profile: requests 383 → 140, transfer 31.7 → 11.7 MB, splash −22 %, shutter −11 %,
  GPU resident after boot 294 → 220–258 MB, main-thread script per round −13…−27 %, idle script −29 %; 0 console errors in all
  ten cells before and after; round wall times unchanged (presentation identical, cheaper). What changed: a quality tier
  (`src/game/quality.svelte.ts`: deviceMemory / cores / WebGL2 + a one-time frame-time measurement; DPR cap 2 / 1.5 / 1.25),
  boot manifest split into boot vs lazy feature sets (rungs, max-win, rescue, mode cards, the second symbol sheet, the other
  orientation's plates), rigs loaded per slot on first show with a `spine-lod` variant (lossless WebP pages, half-size atlas
  below 'high'), 0.625× LOD plates/signs below 'high' (`static/assets/lod`, derived, originals untouched), Inter font subset,
  gold bitmap-font page to WebP, lodash removed from the bundle (−134 KB), memoised scene layout, particle caps and cached
  Graphics/text styles in the FX, hidden mascots unmounted, audio: 47-cue hot set decoded first, cold cues paced after the
  splash gate, beds per bonus pre-decoded behind the shutter, context suspended while muted/hidden, memoised codec choice.
  Found and fixed in verify: a Rollup tree-shake of `Array.from` that hung every round on the STATIC build only. Not done
  (reported): Codex-lane rig runtime skips (`updatePose` for invisible actors), rig re-export at 0.5×, audio re-encode,
  lodash still declared in package.json files (housekeeping). `game/dist`: 712 files, 72,516 KiB, `bundle.BCHNHVOb.js`, sumsSha256
  `caaefb837a55…`, provenance PASS (`game/BUILD_INFO.md`).
- 2026-09-25 — **OWNER FIXES + game/dist SYNCED** `ecec27c`: Backdraft Spins plate now has its own reserved band above the frame
  (`BACKDRAFT_BAND_CELLS`; it was cut off at the top on desktop and rode the frame on phones); outro card title sized to its
  slate ("INFERNO RESCUE COMPLETE" overflowed on a phone); ALARM BOOST chip hidden while a bonus plays unless ON
  (`html[data-pff-feature]` from Game.svelte + app.html rule). Captures inspected: phone + desktop Backdraft, phone Inferno
  outro; 0 console errors. `./tools/build_dist.sh` synced `game/dist` (671 files, 60,512 KiB, `bundle.CCvmXjNR.js`, provenance PASS,
  sumsSha256 `c1aed81b27cd…`, `game/BUILD_INFO.md`).
- 2026-09-25 — **SMALL WINS SHOW NO FIGURE** (owner, screenshot of a "$1.20" line pop): line pops now appear only for a
  multiplied line (the "×N" tag inside Rescue Spins / Blaze Wilds), and the centred count-up overlay only above 20x
  (`SMALL_WIN_MAX_BOOKED`, `game/roundTier.ts`); every smaller win is carried by the line highlight and the HUD WIN meter.
  Files: `game/bookEventHandlerMap.ts` (`showOrdinaryWin`), `components/LinePop.svelte`, `components/Win.svelte`. Lint clean;
  smoke base_win (500x rung) and base_backdraft_win (2.4x, the small-win path) PASS, 0 console errors. Final tree re-staged:
  `bundle.CByPO-7d.js`, provenance digest `368350f200cf…`, sumsSha256 `28671dec5353…` (`docs/submission/BUILD_RECORD.md`).
- 2026-09-25 — **PRE-SUBMISSION GATES + KIT**: remediator `fc2fe02`/`5a0686f` (18 probes on the staged artefact: 1 fix — 330×190
  popout spin-group padding; subpath serving, renderer backend at five DPR cells, a 10-round session with every overlay and
  back-to-back buys, social=true scrape, replay mode, money formatting all PASS with 0 console errors; report
  `qa/precheck/REMEDIATION_REPORT.md`); jurisdiction sweep `20f6e0d` clean on the game's own copy (disclaimer verbatim,
  "Engine", donor wording absent, 15,000x / titles / prices / 96.70% single-sourced); its one finding — the donor sample
  bet-mode copy in `packages/state-shared` — scrubbed in `dda8b38` together with the build provenance stamp
  (`qa/gate/check_provenance.mjs`, run by `build_dist.sh`). Submission kit `4682f45`: `docs/submission/{PRE_UPLOAD_CHECKLIST,
  STAKE_REVIEW_INTRODUCTION_COMMENT,GENERAL_DISCLAIMER_AUDIT}.md`, tile upload set `thumbnail/submission/` (BG+FG ≤ 3 MB, provider
  logo), `qa/submission/math_package_manifest.json` (EQUAL to MANIFEST). Live Engine guideline pages re-scraped at 11:55 EDT
  (disclaimer template = `rulesContent.ts` byte for byte). **FINAL TREE STAGED** at `dda8b38`: 671 files / 60,512 KiB,
  `bundle.CByPO-7d.js`, provenance digest `368350f200cf…` PASS, sumsSha256 `28671dec5353…`, subpath-serving PASS
  (`docs/submission/BUILD_RECORD.md`). The rsync into `game/dist` was refused to this session by the permission gate
  ("Modify Shared Resources"): the owner runs `./tools/build_dist.sh` once to sync. Open (HUD package, next release): base-mode
  replay label prints `BASE`. Human gates NOT RUN: listening pass, real-phone pass, recorded rig motion review.
- 2026-09-25 — **FINISHING PASS (owner, on the Mac)**: owner instruction "finish piggy firefighters", "no over-extensive tests, just the
  final product"; Codex idle since 02:57 EDT, so the coordinator completes every lane here from Codex's preserved state (`d5531f0`,
  verbatim; mailbox `8c556a3`). **MATH PROMOTED** `de57dad` + fixtures `80d4a18`: M3 COMPLETE (1,840,000 trials / 3,630,001 rows,
  5,381 s, peak 627 MiB), independent audit PASS (`qa/codex/math/m3-audit.json`), thirteen-file payload in `math/publish/`
  (index + six LUTs + `MANIFEST.json` committed, books gitignored per the family convention), `docs/math/MATH_PF_REPORT.md`,
  contract §9 measured + header FROZEN, `MATH_HANDOFF.md` COMPLETE/AUDITED; RTP 0.967 every mode, base SD/cost 14.40, ante 9.50;
  `server/fixtures` = the sixteen production fixtures. **RIGS LANDED**: `pf_chief` ten clips `9185703`, `pf_rookie` `abdd623`,
  `pf_dog` `df6f2dd`, `pf_rescued` five skins `75b148a` — all authored in Codex's Python pattern from the r2 parts, round-tripped
  through Spine 4.2.43 CLI, `check_contract.py` PASS ×4, viewer sanity frames under `qa/codex/rig-viewer/<rig>-final/`; recorded
  per-clip motion review NOT RUN (owner's instruction). **PHASE B COMPLETE** `9ec8109`/`d92d333`/`f52928d`/`c782f68`: Codex's
  red runtime tests implemented (`fitRigInSlot`, `canEmitRigEvent`, win-plate lifecycle; 14/14), every contract slot mounted with
  fallbacks gated on `rigRegistry.has()`, all 19 beats emitted, hose gate on the mounted chief, viewer route dev-only, smoke
  `base_trigger_rescue` PASS 0 console errors. **3D RENDERS LANDED** `769f254` (Blender 5.2.2 toon turntables, seven pieces +
  fountain coin, blind test PASS at 48 px) and consumers switched `c111822` (droplet/ember/spark stay 2D). Staged build 59 MB OK.
- 2026-09-25 — **PARTS r2 LANDED** `9f20e8a` (all four rigs): fixed-grid cutter + per-cell rules, per-family scales, coat
  tails / single legs from the registered body, helmet_front from the master, Ember legs ×4 + muzzles, rescued skins in six
  slots, ears by character side, hand scales re-measured; three verifiers' 25 findings fixed; QA sheets committed;
  `R2_CHANGES.md` names every changed file. Open (Codex): rookie master crown at y0, twins rider in the body slot.
- 2026-09-25 — **PORT LANDED** `20a5ac6` (fix round: costs 12/18/50/90, §8 tier rule, shutter run tokens, audio seam on
  delivered ids, copy v1.2.1, padding reels from CSVs; smoke 12/12 + shutter race; gate 4/4); `audioManager.ts` transfer to
  Codex effective. Phase B integration workflow launched (delivered art switch, RigStage/animBeat wiring, manifest
  durations, brass font, fixtures_m1 smoke). **MESHY lane E** `2fe301a`: 7 rung-piece GLBs (105 credits) posted to Codex
  with the Blender toon-turntable spec; 2D flip sheets stay as fallback.
- 2026-09-25 — **AUDIO r3 `c347069` + r4 `e1b4244`**: five redraws folded in by measurement (base A v2 ships, inferno /
  backdraft v1 kept, rung_hit_big now an in-key hybrid C-pent 0.979 with pickup, sym_win_l4 v1 + tuned knock); `measure.py`
  PASS 16/16; mix re-runs sha256-identical; no scratch files in the repo. Spend: 107 + 5 draws, ≈3,104 chars for the
  redraws (next quota read ≈182,438). Human listening pass NOT RUN. Port fix round + Chief r2 re-cut still running.
- 2026-09-25 — **AUDIO BUILD LANDED** `55e615e`: 232 cues in both codecs (464 runtime files), masters, measured gates all
  passing except base_loop_a chug (draw defect); five coordinator-issued redraws in flight (base A, inferno bed,
  backdraft layer, rung_hit_big, sym_win_l4). Human listening pass NOT RUN.
- 2026-09-25 — **ART LANE COMPLETE** `ca0388c` (134 paid OpenAI calls ≈ $40, all OK): symbols (square/tall/pose-B, WILD
  and BONUS lettered locally), scenes (base/backdraft/rescue/inferno plates, rooms, props, truck-side frame, cell
  frames), buy cards + splash deck + max-win + bay-door shutter, win rungs + FX + wordmark, four rigs' masters/sheets
  r1 + anchors, **PF-THUMB-01 tiles at native 1536x2048 / 2048x1152 (validator PASS 8/8, bg #26365C)**; audit agent
  PASS with warnings. r2 piece re-cut workflow launched (fixed grid, labelled contact sheets, three verifiers).
- 2026-09-25 — **CHIEF PARTS LANDED** `62725b3`: pf_chief registered parts (canvas 1024x1536, feet y1440/x512), 29 cut
  pieces incl. the locally lettered `shield_13`, registration.json, reassembly QA, alpha clean; shield rule in
  ART_HERO.md; Codex spray pilot unblocked. Other rigs registering. Audio draws 107/107 done; build/measure running.
- 2026-09-25 — Port agent returned (build OK, smoke 5/5, 0 console errors); reviewers running. Donor LUCKY art purged
  from static/assets (byte-identical files only, + the donor spine dir); only donor audio remains until the audio
  build purges it. New symbol tiles landing in sprites/.
- 2026-09-25 — Audio: subagent draws were refused by the harness permission gate ("Real-World Transactions"), so the
  coordinator session issues the authorized ElevenLabs draws directly (quota 194,478 chars; 11 music plans then 96
  SFX; every call ledgered). Codex audio audit `41a1ed4` merged (`fa1cff8`); `audioManager.ts` + `qa/codex/audio-lifecycle`
  transferred to Codex effective on PORT LANDED.
- 2026-09-25 — Codex tagged `math-freeze-v1` (annotated → `38a6c2f7…`); M3 production RUNNING locally since 04:29:39 UTC.
  Codex `7b865af` (thumbnail validator + tests) merged as `4adef7b`. Audio lane run 1 withheld draws (same authorization
  gap as art); relaunched from the draw stage with the owner's authorization quoted (roster: 232 cues, 98 SFX jobs,
  13 music plans).
- 2026-09-25 — **MATH FREEZE**: Codex M1 handoff `38a6c2f75d6b624eab2ae4efbcd55ed467075127` merged as `04fef7b` and
  acknowledged as `math-freeze-v1` after a §8 conformance check of the 16 fixtures (costs 1/1.5/12/18/50/90, RTP
  0.96699999). Codex starts the single production run (1.84M trials / 3,630,001 rows). Fixtures staged in
  `server/fixtures_m1/` for the Phase-B swap.
- 2026-09-25 — Codex viewer `f33462b` merged as `16cd45a`; Codex M1 PASS (64k trials, 118,001 rows, SD 14.4/9.5, ante
  etl40b 0.75). Art lane run 1 made NO paid call (agents saw only relayed Codex text and withheld spend); relaunched
  with the owner's authorization quoted verbatim in every paid job. Lesson recorded for the audio draw step.
- 2026-09-25 — Codex `9fc1cf3` merged as `eaaba48`: winTier/rung types narrowed to 0..6 / 2..6; rigs DIRECTION.md acting
  brief accepted (Chief spray pilot first, recorded-motion acceptance).
- 2026-09-25 — Codex resumed (credits restored); copy audit F `a675324` merged as `3eb40d5`. Contract v1.2.1: card order =
  ascending price, Backdraft scope + WILD wording exact; ANIMATION_CONTRACT v1.2 pins winTier 0..6. Six frontend copy/
  threshold fixes queued for Phase B (prices from final index, 15/30/50/100x client table, ignore booked winLevel).
- 2026-09-25 — Codex rig runtime `321410c` merged as `1a2d51d` (24 Codex-owned files: anim runtime, RigStage/RigActor,
  rig preflight, run_guard watchdog, mailbox). Wiring into shared files scheduled for Phase B. Backdraft calibration
  (ignition 92/6/2, mult 96.5/1/1/1.5) accepted for the 50x target.
- 2026-09-25 — Contract v1.2 (Codex M2): shared canonical bonus banks per (bonus, starting-spin class) with common
  weights; base/ante fit non-bonus outcomes only; 350k = simulation trials per bonus mode, publication rows follow
  (alarm_call 700,001). Histogram-law alternative declined.
- 2026-09-25 — Codex M1: 60k dev books, base RTP 0.967 SD 14.4 in band; ante etl40b 1.009 (solver fix in progress).
  Pricing decision: adopt derived 18x rescue / 90x inferno / ≈12x alarm_call; tune backdraft_spins toward 50x (organic
  109x rejected as above the flagship). `buildingCleared.building` = 1-based ordinal of the cleared building.
  All 10 donor maps complete (scratchpad); art + audio lanes launched as workflows.
- 2026-09-25 — Codex handoff `f4a00ca` merged (INBOX, LOCAL_READINESS, math-contract-audit, thumbnail/instructions.md);
  Codex accepted A–F + PF-03, Blender present, M1 + rig runtime underway. Contract prose: real-table cap proof (9,875x/spin),
  cap clipping of booked amounts, one false-alarm book. build_dist.sh kill scoped to its own process tree.
- 2026-09-25 — Contract v1.1 after Codex's pre-freeze audit: Backdraft Spins gets additive multiplier Blaze Wilds
  (x2/x3/x5/x10, sum along a line) so 15,000x is genuinely reachable; volatility bands re-derived from donor v2.7 LUTs
  (base 13.38–15.44, ante 8.79–10.14); 5+ alarms → 15 spins; ANIMATION_CONTRACT v1.1 fields (neutral roots, anchors,
  FX ownership, one pf_rescued asset with room→skin mapping, acceptance rule).
- 2026-09-25 — TRANSFER PF-20260925-03: Codex also owns the Spine rig RUNTIME (`src/game/anim/**`, `src/components/rigs/**`,
  `src/routes/rigs/**`) behind the `animBeat` / `RigStage` slot interface (ANIMATION_CONTRACT v1.1). Codex intake ACK
  received for PF-20260925-02 (math model lane accepted; production only after freeze).
- 2026-09-25 — ALLOCATION PF-20260925-02 (owner: more work to Codex): Codex now owns the WHOLE math lane (model +
  dev + production, `math/**`), Spine rig production in full, runtime QA/captures on the Mac (`qa/codex/**`), the
  submission kit, copy audit, optional Blender renders. Claude writes no model code. Mailbox entry names milestones
  M1 (10k dev books + reel CSVs + fixtures) → M2 (contract v1.1 + `math-freeze-v1`) → M3 (production 350k/1M).
- 2026-09-25 — app source snapshot `731beb1` (donor engine copied; port to the 20-line base game running as a
  background workflow); tooling `08d1308` (Linux build_dist.sh, mock RGS :3036, lockfile, vendored pp HUD tarball).

- 2026-09-25 — FOUNDATION: workspace + packages + math SDK copied from LUCKY (donor of record), design of record,
  contract v1.0 DRAFT, theme bible, animation contract, repo rules, Codex mailbox PONG (PF-20260925-01),
  PF-THUMB-01 acknowledged. Math model source: next commit. No paid generation yet.

## Codex lane (append below)
