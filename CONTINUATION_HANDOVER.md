# PIGGY FIREFIGHTERS — continuation handover

Resume snapshot only; the ledger is `PROGRESS.md`. Refreshed 2026-09-28 (owner re-price + mascot removal) by the coordinator.

## State
- **Where the work lives:** repo `realBiffTannen/piggy-firefighters`, branch `claude/bold-bell-aoscdj`, local checkout
  `/Users/jbull/code/piggy-firefighters`. The coordinator owns every lane (Codex idle; its 2026-09-25 instruction stands: finish
  here, no extensive testing). Today's commits: `10ef511` (math v2), `9a61961` (mascots out, Trotterville shield, card art),
  `34afb50` (two ante tiers, prices, 20,000x, math v2 promoted), then the `game/dist` build commit.
- **Owner rulings 2026-09-28:** no mascots (the `pf_chief` / `pf_dog` rigs are deleted; the Chief remains only as WILD, splash
  hero and thumbnail); Station 13 of the fictional **Trotterville Fire Department** (`names.ts DEPARTMENT`); modes re-priced —
  base 1x, ALARM BOOST `ante` 3x for exactly 5x the natural chance of each bonus, FIVE-ALARM BOOST `super_ante` 5x for 15x
  (second tier of the HUD ante chooser, `anteTiers` + `anteTierConfirm`), Alarm Call 15x, Rescue 25x, Backdraft 50x, Inferno 100x;
  max win 20,000x every mode; 100,000 simulation trials per mode. Contract v1.3.
- **Math: DONE at `math-freeze-v2`** = `10ef51124dd8d7fac81ae11c148e952012177e3f`. Production 2026-09-28 PASS (740,000 trials,
  1,520,001 rows, 2,121 s, 8 workers), independent audit PASS (`qa/codex/math/v2-audit.json`), payload promoted to
  `math/publish/` (`MANIFEST.json`; the seven `books_*.jsonl.zst` are gitignored and sit on disk here and in
  `math/games/piggy_firefighters/library/production-100k/`). RTP 0.967 every mode; SD/cost base 14.40 / ante 8.00 / super
  ante 7.37. Never modify `math/**` without a new freeze tag; `run.py` production requires `PF_FREEZE_TAG` (default v2).
- **Art:** Ember inpainted out of five card paintings (`*_nodog`), FIVE-ALARM BOOST card painted, the Chief's splash shield
  lettered (`tools/art/letter_card_crest.py`); six paid calls ($1.80 est.) recorded in `art-src/generated/source-record.json`.
- **Rigs:** two remain (`pf_rookie`, `pf_rescued`). `rigLogic.ts` / `RigStage.svelte` still carry inert mascot entries.
- **Frontend:** seven modes, HUD ante chooser with CONFIRM, rules sheet with the exact measured frequencies, 20,000x
  everywhere; win-tier floors and the count-up threshold in COST units (v1.3.1, owner: no display modals for small wins);
  `node qa/gate/run.mjs` 14/14 OK; `game/dist` rebuilt (see `game/BUILD_INFO.md`, sumsSha256 `b72bb9ac9bff…`).
- **Submission kit:** rebound 2026-09-28 (`docs/submission/PRE_UPLOAD_CHECKLIST.md`, `BUILD_RECORD.md`, `MATH_HANDOFF.md`,
  `qa/submission/math_package_manifest.json`). Human gates (real-phone pass, rig motion review, art acceptance) still open.

## First safe next action
Read the newest `PROGRESS.md` row (2026-09-28), then `docs/submission/PRE_UPLOAD_CHECKLIST.md`. `game/BUILD_INFO.md` describes the
upload candidate; rebuild only with `./tools/build_dist.sh` and re-record the tree hash there. Any math change needs a new freeze tag.

## Commands
`pnpm install` (root) · dev `cd apps/piggy_firefighters && pnpm dev` (:3003) · mock RGS `PORT=<own> BOOKS_DIR=none node
server/mock-rgs.mjs` (fixtures only; without `BOOKS_DIR=none` it indexes the 3.6 GB of books) · build `./tools/build_dist.sh
[--no-sync]` (never bare vite) · smoke `PLAYWRIGHT_MODULE=<a local playwright> node qa/smoke/port/smoke.mjs <fixture>` · rig gate
`python3 art-src/animation/tools/check_contract.py` · math audit `math/env/bin/python qa/codex/math/audit_publication.py …`.
