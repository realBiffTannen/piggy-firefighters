# PIGGY FIREFIGHTERS — continuation handover

Resume snapshot only; the ledger is `PROGRESS.md`. Refreshed 2026-09-25 (finishing pass on the Mac) by the coordinator.

## State
- **Where the work lives:** repo `realBiffTannen/piggy-firefighters`, branch `claude/bold-bell-aoscdj`, local checkout
  `/Users/jbull/code/piggy-firefighters` (the former Codex checkout; Codex's branch `codex/local-production-animation` is frozen at
  `eda46c5`, its uncommitted work preserved verbatim in `d5531f0`). The owner's 2026-09-25 instruction: finish the game here, no
  extensive testing. The coordinator now owns every lane; the per-path ownership table in the design of record is historical.
- **Math: DONE.** Frozen `math-freeze-v1` = `38a6c2f75d6b624eab2ae4efbcd55ed467075127`; M3 production complete and audited PASS;
  payload promoted to `math/publish/` (index + LUTs + `MANIFEST.json` in git; the six `books_*.jsonl.zst` are gitignored and sit on
  disk here and in `math/games/piggy_firefighters/library/production-350k/`). Costs 1 / 1.5 / 12 / 18 / 50 / 90, RTP 0.967 every
  mode, cap 15,000x. Report `docs/math/MATH_PF_REPORT.md`; contract §9 filled. Never modify `math/**`.
- **Art / audio / thumbnails: DONE** (art-src + audio masters with provenance; 232 cues; PF-THUMB-01 tiles under `thumbnail/`).
- **Rigs: EXPORTED, static gate PASS ×4** (`static/assets/spine/<rig>/`); authoring scripts and native `.spine` drafts under
  `art-src/animation/rigs/<rig>/`. Recorded per-clip motion review and a human eye on mounted gameplay are NOT RUN.
- **Frontend: Phase B complete**, staged build OK; final `game/dist` build, one smoke fixture per mode, pre-submission remediation,
  jurisdiction sweep and the submission kit are the finishing pass's phase 2 (see the newest `PROGRESS.md` rows).

## First safe next action
Read the newest `PROGRESS.md` rows, then `docs/submission/PRE_UPLOAD_CHECKLIST.md`. If `game/BUILD_INFO.md` exists, the build it
describes is the upload candidate; rebuild only with `./tools/build_dist.sh` and re-record the tree hash there.

## Commands
`pnpm install` (root) · dev `cd apps/piggy_firefighters && pnpm dev` (:3003) · mock RGS `PORT=<own> BOOKS_DIR=none node
server/mock-rgs.mjs` (fixtures only; without `BOOKS_DIR=none` it indexes the 3.6 GB of books) · build `./tools/build_dist.sh
[--no-sync]` (never bare vite) · smoke `PLAYWRIGHT_MODULE=<a local playwright> node qa/smoke/port/smoke.mjs <fixture>` · rig gate
`python3 art-src/animation/tools/check_contract.py` · math audit `math/env/bin/python qa/codex/math/audit_publication.py …`.
