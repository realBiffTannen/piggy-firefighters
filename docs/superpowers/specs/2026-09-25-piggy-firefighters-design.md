# PIGGY FIREFIGHTERS — design of record (2026-09-25)

Coordinator: Claude (cloud session, branch `claude/bold-bell-aoscdj`). Implementation: Opus subagents under
Claude for frontend / art / audio / integration; **Codex (owner's Mac)** for production math simulations, run
tooling, evidence, and the Spine animation lane. Owner decisions are quoted; everything else is the
coordinator's and marked ASSUMED where it matters.

## What PIGGY FIREFIGHTERS is

A new Piggy-family slot (same engine lineage as `piggy-builders-3` → `piggy-police` → `lucky`: SvelteKit + Svelte 5
+ PixiJS v8 via pixi-svelte, the Stake web-sdk workspace packages, the studio HUD `@crashgalaxy/hud`, the
Stake Engine math SDK) that is **line-based (5×3, 20 lines)** with a firefighting theme, **max win 15,000x**,
**25–35% lower volatility than piggy-builders-3**. Everything the player sees and hears is original to this
title; the three sibling repos are read-only references for look, feel and pipelines. Contract:
`docs/GAME_CONTRACT.md`. Theme: `docs/PIGGY_FIREFIGHTERS_THEME.md`. Rigs: `docs/ANIMATION_CONTRACT.md`.

## Owner requirements (verbatim intent, 2026-09-25)

1. "Build out piggy-firefighters from end to end" using piggy-builders-3, piggy-police and lucky "as read only
   references for the art direction and feel".
2. "Focus on making perfect animations, sound effects, visual effects, transitions, cards, win rungs, gameplay
   thoroughness, bonus uniqueness, asset quality, use of elevenlabs and the openai_api_key along with the
   meshy_api_key and spine where it helps increase the overall quality of the game."
3. "Focus only on building the frontend with no extensive testing and only make enough math to be able to do a
   reasonable test run (i.e. 10k simulations per run while testing locally)." — Claude's dev math is 10k books
   per mode; **production simulations are Codex's** (350,000 per bonus mode, owner via Codex).
4. "Line based game with a max win of 15000x and a 25-35% lower volatility than piggy-builders-3, with other
   math at your own discretion."
5. "All of the artwork and assets should be unique to piggy firefighters."
6. Audio per the attached panel notes (`docs/AUDIO_DESIGN_NOTES.md`): anticipation is the most important sound,
   per-reel stops differ, pleasant beats loud, variation for long sessions, win tiers each get a cue, no
   celebration at or below the bet, mute control, −14 LUFS normalisation with ducking.
7. "Use fable sparingly"; "coordinate with codex so you don't overspend"; "push to main on the piggy-firefighters
   repo when both codex and you have finished executing your work" — main is pushed only after BOTH lanes have
   verified outputs (Codex PING PF-20260925-01).
8. Owner via Codex (2026-09-25): spend "whatever it takes on the highest-quality sound effects, audio, images and
   other assets for THIS application, aiming for a 3-star title". Claude owns every paid generation (OpenAI
   images, ElevenLabs audio, Meshy 3D) so nothing is commissioned twice; Codex launches none.
9. Owner commission **PF-THUMB-01**: premium tiles in 3:4 and 16:9 (see §Thumbnails).

## Ownership (single writer per path — disjoint)

| Lane | Writer | Paths |
|---|---|---|
| Coordination, ledgers, contract, theme, specs | **Claude** | `README.md`, `CLAUDE.md`, `AGENTS.md`, `PROGRESS.md`, `CONTINUATION_HANDOVER.md`, `docs/**` except the Codex paths below, `docs/codex/FROM_CLAUDE.md` (append-only) |
| Math MODEL source (rules → books) | **Claude until `math-freeze-v1`**, then frozen; changes only by a new contract version agreed in the mailbox | `math/games/piggy_firefighters/{game_*.py,gamestate.py,run.py,reels/**}`, `math/src/**`, `math/utils/**`, `math/optimization_program/**` |
| Math PRODUCTION (350k / bonus mode), run tooling, evidence, publish | **Codex** | `math/games/piggy_firefighters/library/**` (generated), `math/publish/**`, `math/games/piggy_firefighters/tools/**`, `tools/codex/**`, `docs/math/**`, `qa/codex/**`, `docs/codex/INBOX_FOR_CLAUDE.md`, `docs/codex/LOCAL_READINESS.md` |
| Dev math (10k) + dev fixtures | Claude | `server/fixtures/**`, `qa/dev_math/**` |
| Frontend (engine, scenes, HUD glue, copy, rules) | Claude | `apps/piggy_firefighters/**` except `static/assets/spine/**`, `packages/**`, `server/**`, `game/**`, `tools/**` except `tools/codex/**` |
| Art (OpenAI, Meshy, derive tools) | Claude | `art-src/**` except `art-src/animation/rigs/**`, `apps/piggy_firefighters/static/assets/**` except `spine/**`, `thumbnail/**` except `thumbnail/instructions.md`, `assets/**` |
| Audio (ElevenLabs, encode, manifest) | Claude | `audio/**`, `apps/piggy_firefighters/static/assets/audio/**`, `apps/piggy_firefighters/src/game/audio/cueManifest.ts`, `docs/AUDIO_MAP.md` |
| Spine rigs (authoring + exports) | **Codex** (after mailbox agreement, per `docs/ANIMATION_CONTRACT.md`) | `art-src/animation/rigs/**`, `apps/piggy_firefighters/static/assets/spine/**` |
| Thumbnail brief | **Codex** | `thumbnail/instructions.md` |

Codex delivers on a `codex/*` branch and states the commit in `docs/codex/INBOX_FOR_CLAUDE.md`; Claude merges
Codex-owned paths into `claude/bold-bell-aoscdj` verbatim. Nobody edits another lane's path; report instead.

## Math plan

- Claude writes the model (`math/games/piggy_firefighters`), runs `PF_SIMS=10000` per mode, solves weights with
  the deterministic `game_weights.py` solver (family pattern, no Rust optimizer), packages a dev publish tree,
  cuts dev fixtures, checks the contract's targets roughly, then commits + tags **`math-freeze-v1`** and posts
  the commit in `docs/codex/FROM_CLAUDE.md`. Until that tag the model is a DRAFT: Codex builds tooling against it
  but launches no production run.
- Codex runs production from the frozen tag: `base`/`ante` 1,000,000 recommended (unique books, family
  convention), `backdraft_spins`/`alarm_call`/`rescue`/`inferno` **350,000 each**; verifies RTP, SD band, hit
  rates, trigger rates, platform limits, uniqueness; publishes `math/publish/**` + `docs/math/MATH_PF_REPORT.md`
  + fills contract §9 via the mailbox (Claude edits the contract file).
- Run command (all lanes): `cd math && PF_SIMS=<n> PF_THREADS=<t> PF_MODES=<a,b> python3 games/piggy_firefighters/run.py`
  (python ≥ 3.11; deps `math/requirements.txt`). Books are seeded per sim so thread count never changes a book.

## Frontend plan (Claude; Opus subagents; workflows per subsystem)

Base engine port (lines, wins, anticipation, speed tiers, resume/replay, HUD, splash + bumper, notices,
rules) → Backdraft → Rescue Spins / Inferno scene (building, hose, rescues, multiplier, next building) →
Alarm Call card → Backdraft Spins → win rungs + max win → buy cards + ante → audio integration → art
integration → rigs (fallbacks first) → build `game/dist` via `tools/build_dist.sh` → smoke against the mock RGS
with dev fixtures → ledger.

## Thumbnails (owner commission PF-THUMB-01, 2026-09-25)

Premium tiles, **exactly one pig firefighter (Chief Hamm, the game's final hero identity)** per tile on a
**low-colour background** (one dominant hue + at most two closely related tones, strong separation from the
hero), exceptional face/eyes/expression, clean silhouette, no other people/animals, no busy city/fire backdrop,
no clutter, no donor art, no baked text/logo/star claims/watermark. Deliberate compositions per aspect (same
identity, not a crop): portrait keeps quiet title space ABOVE; landscape keeps quiet space LEFT with the hero
toward the RIGHT. Files under `thumbnail/`: `foreground_3_4.png` + `background_3_4.png` + `preview_3_4.png` at
**1536×2048**; `foreground_16_9.png` + `background_16_9.png` + `preview_16_9.png` at **2048×1152**;
`source-record.json` (sources, prompts, model, cost, background RGB/hex, sha256 of every file, alpha inspection
result, reviews at full size and at 120×160 / 320×180). Foregrounds genuine RGBA; backgrounds opaque RGB.
Codex's brief is `thumbnail/instructions.md` (Codex-owned); Codex verifies the delivered layers.

## Verification (proportional; owner: no extensive testing)

Per lane the family's own checks: fit-to-box for symbols, audio kit measurements (−14 LUFS integrated, TP ≤ −1
dBTP, loop joins), `check_contract.py` for rigs, `tools/build_dist.sh --no-sync` for the client, one muted
Chromium smoke run per mode against the mock RGS with dev fixtures (recorded under `qa/smoke/`). Codex: the
production math report and Stake platform limit checks.

## Deliverables

`game/dist/` (upload frontend), `math/publish/` (Codex), `thumbnail/` layers, `art-src` + `audio` masters with
provenance, `docs/GAME_CONTRACT.md` §9 filled, `PROGRESS.md` + `CONTINUATION_HANDOVER.md`, all on
`claude/bold-bell-aoscdj`; `main` only when both lanes have verified outputs.
