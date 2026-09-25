# PIGGY FIREFIGHTERS — ledger (newest first; coordinator writes, lanes append under their own heading)

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
