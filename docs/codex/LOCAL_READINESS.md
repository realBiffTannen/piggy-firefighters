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
| A — Full math model and production | `math/games/piggy_firefighters/**`, production package, math report, fixtures and run tooling | M1 calculations/state implementation underway; major contract objections resolved by v1.1 |
| B — Full Spine authoring | Four rigs including five rescued-family skins; cut/paint registered parts, rig, animate, export and check | Local Spine executable and cached 4.2.43 present; original masters and clarified animation contract pending |
| PF-03 — Rig runtime | `src/game/anim/**`, `src/components/rigs/**`, `src/routes/rigs/**` inside app | Exclusive transfer accepted; nonblocking runtime implementation underway |
| C — Focused local runtime captures | `qa/codex/**`; every mode, resume/replay, phone/popout, turbo, console | Wait for Claude's BUILD LANDED commit/build hash and real fixtures |
| D — Submission kit | `docs/submission/**`; actual paths, checksums, reviewer draft and measured checklist | Prepare from actual candidate; no upload |
| E — Blender sprite renders | `art-src/3d/renders/**`, app `static/assets/3d/**` | Blender executable present; wait for Claude's GLBs and per-asset dimensions |
| F — Copy audit | `docs/coordination/codex-copy-audit.md` | Wait for actual copy and measured math |

M1: at most 10,000 development outcomes per mode across `base`, `ante`, `backdraft_spins`, `alarm_call`, `rescue`, `inferno`, plus scenario fixtures. M2: agree corrections and tag exact model. M3: exactly 350,000 outcomes for EACH of the four bonus modes. The suggested 1,000,000 base/ante expansion is not scheduled as part of this intake. Keep the math process tree under 6 GB; serialize math work. Claude keeps ports 3036/3037 and 3003/3004; Codex selects other free localhost ports when needed.

## Local readiness

- Verified interpreter: `/Users/jbull/code/math-sdk/env/bin/python`, Python 3.14.6.
- Imports verified: numpy, scipy, zstandard.
- Locked frontend dependencies installed with pnpm 10.5.0; no lockfile changes.
- Initial disk availability: approximately 67 GiB. Recheck before launching generation.
- Existing SDK detector expects another venv name and reports missing environment; the interpreter above was tested directly. Do not reinstall or alter the shared SDK to resolve that naming mismatch.
- `/Applications/Spine.app/Contents/MacOS/Spine` and cached 4.2.43 are present; editor launch NOT RUN.
- `/Applications/Blender.app/Contents/MacOS/Blender` is present; rendering NOT RUN.
- Production simulations: NOT RUN. Animation preflight tooling: IN PROGRESS. Actual rig artwork/motion: NOT STARTED. Paid generation stays with Claude.

## Agreed work needed before production

1. Resolve draft numerical and event-contract objections in `qa/codex/math-contract-audit.md`, then verify the implemented model and costs.
2. Confirm the native simulation entrypoint, seed scheme, batch divisibility and isolated output paths. Produce exactly 350,000 completed outcomes per bonus mode, not merely a requested count.
3. Freeze and record math source hashes. Keep one production writer and bounded local resource usage.
4. Verify book counts, IDs, payout/event agreement, lookup-table alignment, weighted statistics, maximum payout, and required mode-specific behavior against the game contract.
5. Deliver logs, hashes and actual output paths. Separate generated-book results from weighted distribution statistics and platform approval.

## Animation acceptance direction

The owner brief calls for a firefighting game with original assets, line-based base play, a 15,000x maximum, and lower volatility than Piggy Builders 3. The current draft contract needs the latest donor baseline and a legitimate Backdraft maximum; these objections were sent to Claude before implementation of the affected rules.

Animation review should inspect normal-speed gameplay: anticipation, primary action, impact, recovery, and readable result. Check distinct bonus entries and outcomes, character/prop articulation, coherent illustrated materials, sound synchronization, mobile legibility, and clean turbo/skip/reduced-motion completion. Static screenshots and valid animation files alone do not establish motion quality.

Do not start a second art/audio batch while Claude owns that asset family. Do not change payout semantics to serve animation timing. Do not report three-star approval from local craft checks.
