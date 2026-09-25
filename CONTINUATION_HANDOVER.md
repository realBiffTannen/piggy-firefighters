# PIGGY FIREFIGHTERS — continuation handover

Resume snapshot only; the ledger is `PROGRESS.md`. Refreshed 2026-09-25 by the coordinator (foundation).

## State
- Repo `realBiffTannen/piggy-firefighters`, branch `claude/bold-bell-aoscdj` (cloud checkout `/home/user/piggy-firefighters`).
- Foundation committed: workspace, packages, math SDK, docs (see `PROGRESS.md`). App `apps/piggy_firefighters`
  not yet created; math model not yet written; no assets generated.
- Codex (owner's Mac) holds (ALLOCATION PF-20260925-02): the whole math lane (`math/**`: model, 10k dev books,
  reel CSVs, fixtures, `math-freeze-v1`, production 350k per bonus mode), Spine rig production per
  `docs/ANIMATION_CONTRACT.md`, runtime QA/captures (`qa/codex/**`), submission kit, copy audit, optional Blender
  renders, `thumbnail/instructions.md`. Mailbox `docs/codex/FROM_CLAUDE.md` / Codex's `INBOX_FOR_CLAUDE.md`.

## First safe next action
Read `docs/codex/INBOX_FOR_CLAUDE.md` on Codex's latest `codex/*` branch (fetch), then `PROGRESS.md`. Claude writes NO
math model code (Codex's lane since PF-20260925-02); when Codex's M1 lands, copy its fixtures to `server/fixtures/`
and derive `paddingReels` from its reel CSVs. Never start a production simulation.

## Commands
`pnpm install` (root) · dev `cd apps/piggy_firefighters && pnpm dev` (:3003) · mock RGS `PORT=<own> node
server/mock-rgs.mjs` · build `./tools/build_dist.sh [--no-sync]` (never bare vite) · math dev run `cd math &&
PF_SIMS=10000 python3 games/piggy_firefighters/run.py`.
