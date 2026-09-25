# Codex local coordination — PF-20260925-01 / 02 / 03

## Owner instructions

- Coordinate with Claude Desktop on Piggy Firefighters.
- Codex owns a local 350,000-simulation run for each bonus mode.
- Give animation quality particular attention following Piggy Police's rejection.
- Paid game assets, music, sound effects and animation work are authorized as needed for the highest quality; coordinate generation ownership to prevent duplicate spend.
- Initial wait for Claude's handoff was satisfied by the source and ownership transfers below. The agreed math freeze is tagged and production is running.
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
- Latest integrated Claude checkpoint: `eda46c5`; no frozen math changes. Codex `1d9e6cc` (Chief sequence viewer) and `74818ab` (audio lifecycle) were acknowledged and merged by Claude as `d0d0113`.

## Accepted work and order

| Assignment | Codex scope | Current dependency/status |
| --- | --- | --- |
| A — Full math model and production | `math/games/piggy_firefighters/**`, production package, math report, fixtures and run tooling | Supported-runtime M1 PASS; exact freeze acknowledged/tagged; M3 RUNNING since 2026-09-25 04:29:39 UTC |
| B — Full Spine authoring | Four rigs including five rescued-family skins; cut/paint registered parts, rig, animate, export and check | Original Chief native v008 spray pilot anatomy accepted for extension; remaining seven clips in progress. Other parts await formal r2 acceptance. Full-family contract/motion review pending |
| PF-03 — Rig runtime | `src/game/anim/**`, `src/components/rigs/**`, `src/routes/rigs/**` inside app | Queue snapshot/cancellation fixes: 11 tests and 14-source compile PASS. Viewer: 9 tests, 5-source compile PASS; real v008 sequence normal/quarter, paused-pixel and 2-loop cancellation PASS. Mounted gameplay pending |
| Audio lifecycle transfer | `src/game/audio/audioManager.ts`, `qa/codex/audio-lifecycle/**` | Explicit early transfer in 422c2b5. 33 actual-manager tests and scoped strict TypeScript PASS; public signatures and caches retained. Listening and mounted synchronization pending |
| C — Focused local runtime captures | `qa/codex/**`; every mode, resume/replay, phone/popout, turbo, console | Wait for Claude's BUILD LANDED commit/build hash and real fixtures |
| D — Submission kit | `docs/submission/**`; actual paths, checksums, reviewer draft and measured checklist | Prepare from actual candidate; no upload |
| E — Blender sprite renders | `art-src/3d/renders/**`, app `static/assets/3d/**` | Blender executable present; wait for Claude's GLBs and per-asset dimensions |
| F — Copy audit | `docs/coordination/codex-copy-audit.md` | Six findings accepted by Claude; fixes assigned to his Phase B; measured copy awaits M3 |

M1: bounded 10,000-trial development families plus 1,000-trial additional 12/15-spin class banks and scenario fixtures. M2: agree corrections and tag exact model. M3: 350,000 actual simulation trials for EACH of the four bonus modes. Under agreed contract v1.2, publication rows are separate: direct Rescue/Inferno and Backdraft each 350,000; Alarm Call composes 700,001 rows from the two complete common bonus banks and one false-alarm outcome; base/ante add embedded bank rows to their nonbonus outcomes. The suggested 1,000,000 base/ante expansion is not scheduled as part of this intake. Keep the math process tree under 6 GB; serialize math work. Claude keeps ports 3036/3037 and 3003/3004; Codex selects other free localhost ports when needed.

## Local readiness

- Current project interpreter: `/Users/jbull/code/piggy-firefighters/math/env/bin/python`, Python 3.12.14, NumPy 2.2.5, SciPy 1.15.3, zstandard 0.23.0. Exact packages: `math/requirements-production.lock`; `pip check` passes.
- The earlier shared SDK interpreter combined Python 3.14.6 with unsupported NumPy 2.2.5 and exposed a statistics-report reduction defect. It is disallowed for production and was left unchanged. See `docs/math/RUNTIME.md`.
- Locked frontend dependencies installed with pnpm 10.5.0; no lockfile changes.
- Prelaunch disk availability check: approximately 58 GiB; this is not a current measurement.
- A project-local environment now exists at `math/env`; no shared SDK or system Python environment was altered.
- Spine 4.2.43 native CLI import/export of original Chief pilot v008 PASS without warnings. Native projects, copied source pixels/registration, raw exports and derived runtime setup bounds are preserved under `art-src/animation/rigs/pf_chief/drafts/`. No full-rig approval is implied.
- `/Applications/Blender.app/Contents/MacOS/Blender` is present; rendering NOT RUN.
- Production simulations: **RUNNING** since 2026-09-25 04:29:39 UTC. `math-freeze-v1` = `38a6c2f75d6b624eab2ae4efbcd55ed467075127`, acknowledged by Claude in `FROM_CLAUDE.md` and pushed. Exact launch metadata: `qa/codex/math/m3-launch.json`; exec session 62424, simulator process group 1510. Counts: 350k each bonus, 10k each additional bank, 200k nonbonus each base/ante; expected 1.84M trials and 3,630,001 rows. Two workers, 5120 MiB watchdog; no active-library reads or frozen input edits. Estimated 75–110 minutes; completion and acceptance not yet established.
- Final M1: 64k actual trials / 118,001 unique rows; zero duplicates; 68k full-event/common-weight wrapper checks; all 76 input hashes unchanged. Six RTPs approximately 96.699999%; base/ante SD 14.4/9.5; base hit split 38%/16%/22%; ante ETL40b 0.75. Independent scalar verification matches all persisted LUTs. Peak 351.125 MiB, 159.916 seconds, clean process-group exit. Corrected watchdog: four lifecycle checks PASS.
- Animation preflight tooling: 19 focused checks PASS. Chief v008 contains three actual spray clips; full ten-clip contract remains incomplete. Original rendered mid-start/loop/settled poses were inspected after elbow/cuff corrections. Six native authoring safeguards PASS. Paid generation stays with Claude.
- Independent completed-output audit and submission handoff are prepared (`qa/codex/math/audit_publication.py`, `docs/submission/MATH_HANDOFF.md`). Nine synthetic audit tests PASS; production audit NOT RUN until matching guard completion.
- Viewer runs on `http://127.0.0.1:3008/rigs`; incomplete native pilots require `?pilot=1`. Muted v008 browser evidence: `qa/codex/rig-viewer/sequence-v008-r1/report.json`; exact asset and source hashes are bound. Videos/PNGs are local evidence per the repository ignore rules.
- A simulation-linked idle-sleep assertion (`caffeinate -i -w1510`) is active per the owner; it releases when M3 exits. The unrelated pre-existing wake lock is left untouched.
- The follow-on production rig review found negative-bounds clipping and hidden win-plate douse events. Corrections are in progress under the owned runtime paths; these are separate from the passed development-viewer controls.

## Math sequence and remaining acceptance

1. Completed: resolve model objections, verify M1, agree v1.2.2 and freeze 76 input files.
2. Running: 350,000 actual trials per bonus mode plus the agreed auxiliary/natural counts, one bounded writer. Alarm Call draws from the composed canonical law; it is not 350k freshly simulated bonus histories.
3. Pending: successful completion, clean process group, production producer gates, independent exact-LUT/hash/shared-law/trial audit.
4. Pending: measured M3 report, accepted thirteen-file payload promotion, destination hashes and final submission handoff.
5. Pending external gates: hosted Engine, actual package replay/device checks and reviewer approval.

## Animation acceptance direction

The owner brief calls for a firefighting game with original assets, line-based base play, a 15,000x maximum, and lower volatility than Piggy Builders 3. Contract v1.2.2 resolves the baseline, genuine Backdraft cap, shared bonus law, price and win-tier decisions. Original full-family rig exports remain in progress. Claude's 16a4dae animation v1.3 direction assigns `sign_hit` to the decisive `point_reels` and `big_win` accent; the runtime owns lettering/plate flash and the mascot holds no painted sign.

Animation review should inspect normal-speed gameplay: anticipation, primary action, impact, recovery, and readable result. Check distinct bonus entries and outcomes, character/prop articulation, coherent illustrated materials, sound synchronization, mobile legibility, and clean turbo/skip/reduced-motion completion. Static screenshots and valid animation files alone do not establish motion quality.

Do not start a second art/audio batch while Claude owns that asset family. Do not change payout semantics to serve animation timing. Do not report three-star approval from local craft checks.
