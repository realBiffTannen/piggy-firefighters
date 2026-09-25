# Codex local coordination — PF-20260925-01 / 02 / 03

## Owner instructions

- Coordinate with Claude Desktop on Piggy Firefighters.
- Codex owns a local 350,000-simulation run for each bonus mode.
- Give animation quality particular attention following Piggy Police's rejection.
- Paid game assets, music, sound effects and animation work are authorized as needed for the highest quality; coordinate generation ownership to prevent duplicate spend.
- Initial wait for Claude's handoff was satisfied by the source and ownership transfers below. Production simulations still require an agreed math freeze.
- Added thumbnail commission PF-THUMB-01: one character and a low-color background for both 3:4 and 16:9, with `thumbnail/instructions.md`; expense authorized for highest quality.

## Current handshake

- Claude Desktop acknowledged PF-20260925-01 in its Piggy Firefighters game build task.
- Claude's announced working branch: `claude/bold-bell-aoscdj`.
- Local checkout: `/Users/jbull/code/piggy-firefighters`.
- Shared origin: `realBiffTannen/piggy-firefighters`.
- Fetched app foundation `731beb15bcd0ae72b8a7ae5b13f496bad8699154`; accepted math/full-work allocation `0b98828` and rig-runtime transfer `2ae645b`.
- Fetched corrected contracts `1bd7d95` and app snapshot `93ae7d5`. M1 follows the agreed v1.1 corrections and exact frontend payline table.
- Local branch: `codex/local-production-animation`. Existing local thumbnail brief and notes preserved.
- Communication: Claude writes `docs/codex/FROM_CLAUDE.md`; Codex writes `docs/codex/INBOX_FOR_CLAUDE.md`. These are separate cloud/local checkouts with explicit Git handoffs.
- PF-THUMB-01 is acknowledged in Claude's mailbox and task plan. Claude owns generation; Codex owns `thumbnail/instructions.md` and saved-file verification. Final artwork is pending.

## Accepted work and order

| Assignment | Codex scope | Current dependency/status |
| --- | --- | --- |
| A — Full math model and production | `math/games/piggy_firefighters/**`, production package, math report, fixtures and run tooling | Supported-runtime M1 PASS: 64k trials / 118,001 rows, shared full-event bonus law verified; agreed freeze and M3 next |
| B — Full Spine authoring | Four rigs including five rescued-family skins; cut/paint registered parts, rig, animate, export and check | 4.2 static gate implemented, 19 checks pass; actual exports absent; original masters pending |
| PF-03 — Rig runtime | `src/game/anim/**`, `src/components/rigs/**`, `src/routes/rigs/**` inside app | Runtime reviewed: 10 tests, scoped compile and ESLint PASS. Viewer: 3 tests, scoped compile and muted empty-state browser PASS. Claude integration and real-art motion review pending |
| C — Focused local runtime captures | `qa/codex/**`; every mode, resume/replay, phone/popout, turbo, console | Wait for Claude's BUILD LANDED commit/build hash and real fixtures |
| D — Submission kit | `docs/submission/**`; actual paths, checksums, reviewer draft and measured checklist | Prepare from actual candidate; no upload |
| E — Blender sprite renders | `art-src/3d/renders/**`, app `static/assets/3d/**` | Blender executable present; wait for Claude's GLBs and per-asset dimensions |
| F — Copy audit | `docs/coordination/codex-copy-audit.md` | Six findings accepted by Claude; fixes assigned to his Phase B; measured copy awaits M3 |

M1: bounded 10,000-trial development families plus 1,000-trial additional 12/15-spin class banks and scenario fixtures. M2: agree corrections and tag exact model. M3: 350,000 actual simulation trials for EACH of the four bonus modes. Under agreed contract v1.2, publication rows are separate: direct Rescue/Inferno and Backdraft each 350,000; Alarm Call composes 700,001 rows from the two complete common bonus banks and one false-alarm outcome; base/ante add embedded bank rows to their nonbonus outcomes. The suggested 1,000,000 base/ante expansion is not scheduled as part of this intake. Keep the math process tree under 6 GB; serialize math work. Claude keeps ports 3036/3037 and 3003/3004; Codex selects other free localhost ports when needed.

## Local readiness

- Current project interpreter: `/Users/jbull/code/piggy-firefighters/math/env/bin/python`, Python 3.12.14, NumPy 2.2.5, SciPy 1.15.3, zstandard 0.23.0. Exact packages: `math/requirements-production.lock`; `pip check` passes.
- The earlier shared SDK interpreter combined Python 3.14.6 with unsupported NumPy 2.2.5 and exposed a statistics-report reduction defect. It is disallowed for production and was left unchanged. See `docs/math/RUNTIME.md`.
- Locked frontend dependencies installed with pnpm 10.5.0; no lockfile changes.
- Latest disk availability check: approximately 58 GiB. Recheck before launching production.
- A project-local environment now exists at `math/env`; no shared SDK or system Python environment was altered.
- `/Applications/Spine.app/Contents/MacOS/Spine` and cached 4.2.43 are present; editor launch NOT RUN.
- `/Applications/Blender.app/Contents/MacOS/Blender` is present; rendering NOT RUN.
- Production simulations: NOT RUN. Final M1: 64k actual trials / 118,001 unique rows; zero duplicates; 68k full-event/common-weight wrapper checks; all 76 input hashes unchanged. Six RTPs approximately 96.699999%; base/ante SD 14.4/9.5; base hit split 38%/16%/22%; ante ETL40b 0.75. Independent scalar verification matches all persisted LUTs. Peak 351.125 MiB, 159.916 seconds, clean process-group exit. Corrected watchdog: four lifecycle checks PASS.
- Animation preflight tooling: PASS on 19 focused checks, BLOCKED on missing real exports. Actual rig artwork/motion: NOT STARTED. Paid generation stays with Claude.

## Agreed work needed before production

1. Resolve draft numerical and event-contract objections in `qa/codex/math-contract-audit.md`, then verify the implemented model and costs.
2. Confirm the native simulation entrypoint, seed scheme, batch divisibility and isolated output paths. Produce exactly 350,000 completed outcomes per bonus mode, not merely a requested count.
3. Freeze and record math source hashes. Keep one production writer and bounded local resource usage.
4. Verify book counts, IDs, payout/event agreement, lookup-table alignment, weighted statistics, maximum payout, and required mode-specific behavior against the game contract.
5. Deliver logs, hashes and actual output paths. Separate generated-book results from weighted distribution statistics and platform approval.

## Animation acceptance direction

The owner brief calls for a firefighting game with original assets, line-based base play, a 15,000x maximum, and lower volatility than Piggy Builders 3. Contract v1.2.2 resolves the baseline, genuine Backdraft cap, shared bonus law, price and win-tier decisions. Original rig exports remain the animation-authoring dependency.

Animation review should inspect normal-speed gameplay: anticipation, primary action, impact, recovery, and readable result. Check distinct bonus entries and outcomes, character/prop articulation, coherent illustrated materials, sound synchronization, mobile legibility, and clean turbo/skip/reduced-motion completion. Static screenshots and valid animation files alone do not establish motion quality.

Do not start a second art/audio batch while Claude owns that asset family. Do not change payout semantics to serve animation timing. Do not report three-star approval from local craft checks.
