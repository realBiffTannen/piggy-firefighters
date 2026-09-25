# PIGGY FIREFIGHTERS — continuation handover

Resume snapshot only; the ledger is `PROGRESS.md`. Refreshed 2026-09-25 by the coordinator (foundation).

## State
- Repo `realBiffTannen/piggy-firefighters`, branch `claude/bold-bell-aoscdj` (cloud checkout `/home/user/piggy-firefighters`).
- Foundation committed: workspace, packages, math SDK, docs (see `PROGRESS.md`). App `apps/piggy_firefighters`
  not yet created; math model not yet written; no assets generated.
- Codex (owner's Mac) holds: production simulations (350k per bonus mode) from tag `math-freeze-v1`, Spine rig
  lane per `docs/ANIMATION_CONTRACT.md`, `thumbnail/instructions.md`. Mailbox `docs/codex/FROM_CLAUDE.md`.

## First safe next action
Read `docs/codex/INBOX_FOR_CLAUDE.md` on Codex's latest `codex/*` branch (fetch), then `PROGRESS.md`. If the
math model is not committed: write `math/games/piggy_firefighters/**` per `docs/GAME_CONTRACT.md`, dev-run
`PF_SIMS=10000`, tag `math-freeze-v1`, announce in the mailbox. Never start a production simulation.

## Commands
`pnpm install` (root) · dev `cd apps/piggy_firefighters && pnpm dev` (:3003) · mock RGS `PORT=<own> node
server/mock-rgs.mjs` · build `./tools/build_dist.sh [--no-sync]` (never bare vite) · math dev run `cd math &&
PF_SIMS=10000 python3 games/piggy_firefighters/run.py`.
