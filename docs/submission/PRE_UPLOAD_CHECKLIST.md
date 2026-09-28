# PIGGY FIREFIGHTERS — pre-upload checklist

**REBOUND 2026-09-28 by the coordinator to contract v1.3 (math-freeze-v2, two ante tiers, owner prices, 20,000x) and the `34afb50` build of `game/dist`.** No upload or publication was performed. The math payload is promoted, audited and hash-bound; `game/dist` is built, stamped and hash-bound; the human gates (real-phone pass, recorded rig motion review, art acceptance) remain open. Nothing here is a claim of Engine approval.

## Upload candidates and exact paths

| Candidate | Absolute local path | Status / hash binding |
| --- | --- | --- |
| Frontend directory | `/Users/jbull/code/piggy-firefighters/game/dist/` | **Synced 2026-09-28 from the `34afb50` tree** (`./tools/build_dist.sh`, provenance PASS on `game/dist`, 756 files / 66,964 KiB, bundle `bundle.fThyBaRl.js`); **sumsSha256 `304398d3b508ada1114432dbc7d964b03dc6f72086811f8e5e5ef6396a32a59b`** — `game/BUILD_INFO.md`. |
| Frontend staged candidate | `/Users/jbull/code/piggy-firefighters/apps/piggy_firefighters/build/` | The same bytes as `game/dist` (the script stages there, then rsyncs). The `/rigs` dev viewer route is held out of the build by the script. |
| Frontend build record | `/Users/jbull/code/piggy-firefighters/docs/submission/BUILD_RECORD.md` | 2026-09-28 record: provenance digest `4ed05ff202b8…` (PASS), `index.html` sha256 `ddd885ad7da4…`, sumsSha256 `304398d3b508…`. |
| Math directory | `/Users/jbull/code/piggy-firefighters/math/publish/` | **PASS — bound 2026-09-28**: fifteen payload files (index + seven books + seven LUTs), 1,568,941,459 bytes, every sha256 / byte count / LUT row count recomputed and EQUAL to `MANIFEST.json` (`qa/submission/math_package_manifest.json`). Plus `MANIFEST.json` itself (not part of the Engine payload; harmless to include). |
| Math publication manifest | `/Users/jbull/code/piggy-firefighters/math/publish/MANIFEST.json` | SHA-256 `988b20d96c8ead74feb09c80ea6ca984b03ca0539d22681b98ed228d014e05a9` — the file's hash, not a hash of the directory. |
| Math independent audit | `/Users/jbull/code/piggy-firefighters/qa/codex/math/v2-audit.json` | SHA-256 `2eb5213b033c4038841163f590caca9dc1f3d018761d37658d0969df30468c4c` (equals `MANIFEST.json` → `independent_audit.sha256`); status PASS, 740,000 trials / 1,520,001 rows / 960,000 canonical links checked. |
| Math report | `/Users/jbull/code/piggy-firefighters/docs/math/MATH_PF_REPORT.md` | SHA-256 `c2745e3a3e89492f54683b004b24f49d84c4e91a7a2e046f87b296756822b5b0`; production report `report.json` SHA-256 `f30c729ffcb025fdf9c2db2900d68cc64077dddb2959cd9267712b5778fe3042` (per manifest). |
| Production fixtures | `/Users/jbull/code/piggy-firefighters/server/fixtures/` | 22 real-book fixtures + `index.json` (SHA-256 `4e947f658751793fa612ed9dc03da91c7daa35efa29891c02526e287e5a37b56`) + `source-record.json`; ids are publication ids of the promoted LUTs. Development evidence, not an upload. |
| Tile files | `/Users/jbull/code/piggy-firefighters/thumbnail/submission/{PiggyFirefighters-BG.png, PiggyFirefighters-FG.png, PiggyFirefighters-BG-16x9.png, PiggyFirefighters-FG-16x9.png, CrashGalaxy-Logo.png}` | Byte-identical copies of `thumbnail/{background,foreground}_{3_4,16_9}.png` (validator PASS 8/8 + 14/14 agent checks) and the provider mark rasterised from the shipped Crash Galaxy bumper. Sizes, hashes and the ≤ 3 MB pair check (1,608,463 and 986,199 bytes: PASS) in `thumbnail/submission/README.md`. Tile-editor preview and human art acceptance are separate. |

The frontend upload is the final `game/dist/` directory. `apps/piggy_firefighters/build/` is the staging location. The math upload is the **LOCAL complete `math/publish/` directory**, including all seven Git-ignored `books_*.jsonl.zst` files (`.gitignore` line 69). A GitHub checkout, source archive or LUT/index-only copy is incomplete.

Do not include the mock RGS (`server/mock-rgs.mjs`), `server/fixtures*`, the Python environment (`math/env`), the production tree (`math/games/piggy_firefighters/library/`), `art-src/`, `audio/` masters or the source tree as a frontend or math upload.

## Math evidence and checksums

Game `piggy_firefighters`, 5×3, 20 fixed lines, seven modes (base 1 / ante 3 / super_ante 5 / alarm_call 15 / rescue 25 / backdraft_spins 50 / inferno 100), RTP 96.70% (LUT-exact 0.96699999) in every mode, max win 20,000× base bet in every mode. Model frozen at annotated tag `math-freeze-v2` = commit `10ef51124dd8d7fac81ae11c148e952012177e3f` (`source_unchanged == true`). Production 2026-09-28: 740,000 simulation trials → 1,520,001 publication rows, exit 0, `candidate_status PASS`, independent audit PASS. Evidence: `docs/math/MATH_PF_REPORT.md`, `docs/GAME_CONTRACT.md` §9, `docs/submission/MATH_HANDOFF.md`, `qa/codex/math/v2-audit.json`.

**Hash provenance: recomputed 2026-09-28**, not inherited. `qa/submission/math_package_manifest.json` re-read all fifteen files from disk (python `hashlib.sha256`, 16 MiB chunks; LUT rows by `wc -l`) and compared with `MANIFEST.json`: **EQUAL** on every file (sha256, bytes and LUT line counts). If any file is changed, replaced or repacked (`stakecli --repack` included), this binding no longer holds; rebind before upload.

| Absolute file path | Bytes | Rows | SHA-256 |
| --- | ---: | ---: | --- |
| `/Users/jbull/code/piggy-firefighters/math/publish/books_alarm_call.jsonl.zst` | 243,439,640 | — | `79c49a2b1e15e142812bfb5d06884216a8c835bf7de0584887ae2553bb9369bd` |
| `/Users/jbull/code/piggy-firefighters/math/publish/books_ante.jsonl.zst` | 331,501,423 | — | `334831210060c174952edba552683dba5064b85ab8cffbbd1e53f0d82f3993f9` |
| `/Users/jbull/code/piggy-firefighters/math/publish/books_backdraft_spins.jsonl.zst` | 53,693,881 | — | `9ef66dd9e713172c0be3045f9ed48081bb9a30c0c3804dcbed1e74b1c873a096` |
| `/Users/jbull/code/piggy-firefighters/math/publish/books_base.jsonl.zst` | 331,197,756 | — | `8b211860ff99c7449716778aa8acb5fbcaa8dcec739781fa4c9681c1a7f83dc9` |
| `/Users/jbull/code/piggy-firefighters/math/publish/books_inferno.jsonl.zst` | 126,529,569 | — | `a098b7ca411cdacd12ddec2e03cb2a0b63897ff642ef2e6b20232f839e65c069` |
| `/Users/jbull/code/piggy-firefighters/math/publish/books_rescue.jsonl.zst` | 116,341,775 | — | `75eae6e1ae594117d7103f843fb18f99bc17a502686dac9c49eb1706b6bd235d` |
| `/Users/jbull/code/piggy-firefighters/math/publish/books_super_ante.jsonl.zst` | 331,443,763 | — | `1053cf90079c0cef6f5a0ce1765b074589e33fbe340dbe1b38b9b07ba945ed34` |
| `/Users/jbull/code/piggy-firefighters/math/publish/index.json` | 1,061 | — | `5aa72518f50ce1f7640db2109191158880303dbc9ae1272b22c741021c586edf` |
| `/Users/jbull/code/piggy-firefighters/math/publish/lookUpTable_alarm_call_0.csv` | 4,283,430 | 200001 | `bdb82bf1b06d199ba9929c18983b5b1b6e126d103c47806ae0d18f1a28938f87` |
| `/Users/jbull/code/piggy-firefighters/math/publish/lookUpTable_ante_0.csv` | 8,188,966 | 340000 | `f015a3a38b13317c285f2a6a9c7b704c048c3389e0740c11ca4d402dc47b693a` |
| `/Users/jbull/code/piggy-firefighters/math/publish/lookUpTable_backdraft_spins_0.csv` | 1,929,319 | 100000 | `b63b6bc191670d84f06ae3ecdf6d99d5c17dd52d90867b29e3fd19dd1e44bfd7` |
| `/Users/jbull/code/piggy-firefighters/math/publish/lookUpTable_base_0.csv` | 8,091,934 | 340000 | `03445cf397512db2fe93ebe2564ac4801c32edf1aa2969ee831e1ce3790afcf1` |
| `/Users/jbull/code/piggy-firefighters/math/publish/lookUpTable_inferno_0.csv` | 1,985,797 | 100000 | `a35523e0aaddc2e6c3d611d1c214254668e7772883e22bbd7a848a64b2f9df92` |
| `/Users/jbull/code/piggy-firefighters/math/publish/lookUpTable_rescue_0.csv` | 1,885,172 | 100000 | `22f881af26761348c0a15e394e2110976a9df8c28aadc2230c5be9c8a17d0de2` |
| `/Users/jbull/code/piggy-firefighters/math/publish/lookUpTable_super_ante_0.csv` | 8,427,973 | 340000 | `729f17745a7a1e68b84c381ff2a9342b013c868737f7ebdb46de3e6f49eaba03` |
| `/Users/jbull/code/piggy-firefighters/math/publish/MANIFEST.json` | 10,775 | — | `988b20d96c8ead74feb09c80ea6ca984b03ca0539d22681b98ed228d014e05a9` |

- [x] `index.json` names exactly seven modes at costs base 1 / ante 3 / super_ante 5 / backdraft_spins 50 / alarm_call 15 / rescue 25 / inferno 100; `qa/gate/check_mode_costs.mjs` confirms `config.ts` and the fixtures match it byte for byte (run 2026-09-28, OK).
- [x] Production binding PASS for all seven modes; RTP 0.96699999 every mode; every LUT payout within 0…2,000,000 and a multiple of 10; every mode carries a positive-weight 20,000× outcome (`MATH_HANDOFF.md`).
- [x] All fifteen files present in the exact local directory selected for upload, sizes and hashes EQUAL to `MANIFEST.json` (recomputed 2026-09-28).
- [ ] Coordinator confirms no math file changes between this binding and the upload; if `stakecli` repacks the books, record the repacked hashes separately and do not apply this binding to different bytes.

## Local gate evidence and remaining requirements

- [x] Frontend gate `node qa/gate/run.mjs` run 2026-09-28 on the `34afb50` inputs: 14/14 OK (mode costs vs `index.json`; 22 round-tier cases; rung pacing; HUD bar; symbol motion; splash; rig beats; bonus font; 172 cue references in the 232-cue manifest; rescue phone; win coins; padding reels match the v2 reel CSVs; art meta; rung light; provenance PASS on `game/dist`).
- [x] Final build `./tools/build_dist.sh` from the `34afb50` tree: BUILD OK, 756 files / 66,964 KiB, dev-only `/rigs` route excluded, provenance PASS, sumsSha256 `304398d3b508…`.
- [x] Fixture smoke `qa/smoke/port/results.json` (2026-09-25T08:27Z, Chromium 141, dev server :3003 + mock RGS :3036, `--mute-audio`): 12/12 fixtures PASS, 0 console errors (base no-win/win/backdraft, ante, alarm_call false/rescue, rescue buy, inferno buy, base trigger rescue/inferno, max_win, backdraft_spins). This ran against the dev server, not the staged or final build.
- [x] Two Spine 4.2.43 rigs installed under `apps/piggy_firefighters/static/assets/spine/{pf_rookie,pf_rescued}` (json + atlas + pages); the `pf_chief` and `pf_dog` mascot rigs were removed on the owner's instruction 2026-09-28. Every rig is original to this title.
- [x] Original art (134 recorded OpenAI calls, `art-src/generated/source-record.json`; audit agent PASS with warnings), original audio (232 cues / 464 runtime files, `measure.py` PASS 16/16, −14 LUFS target), Blender-rendered win-rung solids and fountain coin (`769f254`, consumers `c111822`). Donor LUCKY art purged from `static/assets` (byte-identical files); donor audio replaced by the audio build (`PROGRESS.md`).
- [x] Player copy says "Engine" (never the two-word name); the general disclaimer paragraph (`rulesContent.ts:30` std, `:32` social, identical, 466 chars) hashes to `ec5f997f27964a30e2c1535fa618e173d899546d06846f44efaa1b069d75e8ee`, equal to the bound live-template read — [GENERAL_DISCLAIMER_AUDIT.md](GENERAL_DISCLAIMER_AUDIT.md). The coordinator's live re-scrape today (11:55 EDT) agrees; this lane's own single fetch got only the loading shell.
- [x] Tile files prepared and size-checked (`thumbnail/submission/README.md`); thumbnail validator PASS 8/8 and 14/14 agent checks (`thumbnail/source-record.json`).
- [x] Final tree built, stamped, synced into `game/dist` and hash-bound (`docs/submission/BUILD_RECORD.md`, sumsSha256 `304398d3b508…`); static smoke and subpath-serving probe: see the 2026-09-28 `PROGRESS.md` row.
- [ ] Confirm the audited disclaimer, the seven mode prices, 96.70% and 20,000× render in the final artifact's rules sheet; recheck the live template if it changes before submission.
- [x] Human listening pass (audio): done by the owner, 2026-09-26.
- [ ] Real-phone motion/usability pass (390×844 class device: layout, input, normal/turbo/super-turbo, audio, resume/replay) — NOT RUN; local mock evidence is not device evidence.
- [ ] Recorded per-clip motion review of the two remaining rigs (the acceptance rule in `docs/ANIMATION_CONTRACT.md`) — NOT RUN by owner's instruction; the owner records the outcome or waives it explicitly.
- [x] Recorded gameplay motion review (1440×900 + 390×844, the moments the 2026-09-26 panel named): `qa/smoke/review/contract/MOTION_REVIEW_2026-09-26.md` — 41 moments judged from frames; defects and their dispositions in `qa/stake-review/LEDGER.md`.
- [ ] Owner's art/animation acceptance (faces, costume consistency, tile appearance in the real editor) — pending.
- [ ] Jurisdiction/social copy: the social variants in `rulesContent.ts` and the HUD floor were swept in Codex copy audit F (`3eb40d5`) and the port fix round; a final read of the built artifact against the stake.us prohibited-term table (win feature, play amount, coins, balance, respin, get bonus, token…) is owed on the final bytes.
- [ ] `STAKE_REVIEW_INTRODUCTION_COMMENT.md` reflects completed evidence at posting time and never claims a prior rating or rejection is cleared by machine checks.
- [ ] No post-kit frontend/art/audio/animation edit is left outside the final artifact binding; rerun only the checks the change affects and rebind.

Evidence destinations: `qa/submission/` (this kit), `qa/gate/`, `qa/smoke/port/`, `qa/codex/math/`, `qa/codex/rig-viewer/`, `thumbnail/submission/`.

## Verified local CLI command shapes — examples only

Read-only help inspected for the installed `/Users/jbull/.local/bin/stakecli`, version **2.0.0-beta.1 (35ecfbf580a3, built 2026-07-31)**: `stakecli --help`, `stakecli upload --help`, `stakecli publish --help`, `stakecli --version`. No upload, publish, compliance scan, repack, login or update command was run.

The owner must confirm the actual Engine team and game slugs before use. Neither the GitHub owner, the `providerName: 'fable'` in `config.ts`, nor the Crash Galaxy brand proves the remote team slug. Replace the two values below first:

```sh
PF_TEAM='REPLACE_WITH_VERIFIED_TEAM_SLUG'
PF_GAME='REPLACE_WITH_VERIFIED_GAME_SLUG'

stakecli upload --team "$PF_TEAM" --game "$PF_GAME" --type front --path '/Users/jbull/code/piggy-firefighters/game/dist' --direct
stakecli upload --team "$PF_TEAM" --game "$PF_GAME" --type math --path '/Users/jbull/code/piggy-firefighters/math/publish' --direct
```

These are upload-only shapes: no `--publish`, `--update-approval-version`, `--yes`, `--repack` or `--estimate-repack`. The subcommand help describes `--compliance` as advisory ("reported issues never block upload or publish"); it is not a substitute for the bound math proof. `stakecli publish <math|front> <path>` uploads **and** publishes, so it is not an "activate the already-uploaded version" command; interactive math publish always runs compliance and asks for confirmation. Authentication is a session id (`STAKE_SID`) or the keyring; keep it out of files, logs and this kit.

## Owner's manual handoff

1. Confirm the intended remote team, game slug, jurisdiction/configuration and account before sending files; keep credentials out of comments and evidence.
2. Wait for the coordinator's final `game/dist` build and `game/BUILD_INFO.md`; select that directory and the full local `math/publish/` (books included). Record the local hashes/build commit and the remote frontend/math version ids returned by upload.
3. In the Engine console, confirm which frontend and math versions are selected/published together. Upload completion is not proof that publication succeeded; preserve the response and resolve any error before requesting review.
4. Check the uploaded game through its real launch path: all seven modes at their prices (1 / 3 / 5 / 15 / 25 / 50 / 100), the ante chooser with CONFIRM, the ALARM BOOST toggle, buy-card confirmation, resume/replay and the phone layout. Record this separately from local mock evidence.
5. Apply the tile layers from `thumbnail/submission/` (3:4 primary; 16:9 pair if the editor asks for it) and the provider logo; inspect the actual editor preview at small size. Complete the game metadata, disclaimer and short introduction using the final reviewed copy.
6. Record the outcome of the human items above (listening pass, phone pass, rig motion review, art acceptance) or waive each explicitly.
7. Submit/request review only for the owner-confirmed version pair. Record the submission reference and outstanding human items; no local PASS establishes Engine approval.
