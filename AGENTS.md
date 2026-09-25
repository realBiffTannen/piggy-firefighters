# PIGGY FIREFIGHTERS — rules for every agent (Codex, Opus, Claude). Same content as CLAUDE.md.

- Design of record: `docs/superpowers/specs/2026-09-25-piggy-firefighters-design.md`. Contract:
  `docs/GAME_CONTRACT.md`. Theme bible: `docs/PIGGY_FIREFIGHTERS_THEME.md`. Rigs: `docs/ANIMATION_CONTRACT.md`.
  Ledger: `PROGRESS.md` (single writer: the coordinator; lanes append under their own heading only). Resume
  snapshot: `CONTINUATION_HANDOVER.md`. Codex mailbox: `docs/codex/FROM_CLAUDE.md` (Claude, append-only) /
  `docs/codex/INBOX_FOR_CLAUDE.md` (Codex, on its `codex/*` branch).
- Ownership is per path (spec §Ownership). Never edit another lane's path; report instead.
- **Production math is Codex's** (`math/publish/**`, `math/games/piggy_firefighters/library/**`, `docs/math/**`,
  `tools/codex/**`, `qa/codex/**`). The math MODEL (`math/games/piggy_firefighters/*.py`, `reels/`) is frozen at
  tag `math-freeze-v1`; do not read `math/games/piggy_firefighters/library` while a generation runs.
- Player-facing copy says **Engine**, never "Stake Engine". Max win **15,000x** in every mode. Pigs ARE the cast
  (Piggy family); no hard-hat / construction / police / LUCKY (lantern, dragon) wording or imagery, and no donor
  asset may ship — every asset is original to this title.
- Builds only via `./tools/build_dist.sh` (`--no-sync` stages in `apps/piggy_firefighters/build`; without it,
  rsyncs to `game/dist`). Never bare `vite build` (it never exits). Dev server: `cd apps/piggy_firefighters &&
  pnpm dev` (port 3003); mock RGS: `node server/mock-rgs.mjs` (`PORT=` per lane, default 3036; never share a
  mock between lanes).
- Every browser launch muted (`--mute-audio`). No secrets in files or logs; keys via the environment only
  (`OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `MESHY_API_KEY`).
- Spine: author/export with **4.2.43**; runtime `spine-pixi-v8` 4.2.x. Never open the rigs in 4.3.x. FX rigs may
  be 4.3.23 exported down to 4.2. Rig interface: `docs/ANIMATION_CONTRACT.md`.
- Paid generation (OpenAI images, ElevenLabs audio, Meshy 3D) is Claude's lane only: record every call in the
  lane's `source-record.json` (model, prompt, refs, cost estimate); reuse accepted outputs; no speculative
  rerolls; Codex launches none.
- Audio: −14 LUFS integrated, TP ≤ −1 dBTP, ducking under win cues, no celebration at or below the bet,
  per-reel stop variation, anticipation only while a trigger is still possible (`docs/AUDIO_DESIGN_NOTES.md`).
- Commit with explicit paths, never `git add -A`; the coordinator pushes `claude/bold-bell-aoscdj`; `main` only
  when both lanes have verified outputs.
