# PIGGY FIREFIGHTERS

A Piggy-family slot for the Engine platform: 5×3, **20 lines**, max win **15,000x**, RTP 96.7%, firefighting
theme. Contract `docs/GAME_CONTRACT.md` · theme `docs/PIGGY_FIREFIGHTERS_THEME.md` · design of record
`docs/superpowers/specs/2026-09-25-piggy-firefighters-design.md` · rules for agents `CLAUDE.md` / `AGENTS.md` ·
ledger `PROGRESS.md` · resume `CONTINUATION_HANDOVER.md` · Codex mailbox `docs/codex/`.

## Layout
- `apps/piggy_firefighters/` — SvelteKit + Svelte 5 + PixiJS v8 client (pixi-svelte), studio HUD `@crashgalaxy/hud`.
- `packages/` — Stake web-sdk workspace packages (shared with the family).
- `math/` — Stake Engine math SDK; game model `math/games/piggy_firefighters/` (frozen at `math-freeze-v1`);
  production outputs `math/publish/` (Codex).
- `server/mock-rgs.mjs` + `server/fixtures/` — local RGS for dev/QA. `game/dist/` — the upload build.
- `art-src/`, `audio/`, `thumbnail/` — sources and provenance (`source-record.json` in each lane).

## Commands
`pnpm install` · `cd apps/piggy_firefighters && pnpm dev` (port 3003) · `PORT=3036 node server/mock-rgs.mjs` ·
`./tools/build_dist.sh [--no-sync]` · math dev run `cd math && PF_SIMS=10000 python3 games/piggy_firefighters/run.py`.
