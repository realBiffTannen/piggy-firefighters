# PIGGY FIREFIGHTERS — pre-upload checklist

**DRAFT / NOT READY TO UPLOAD — written 2026-09-25 at HEAD `c111822` by lane S (submission kit); frontend rows rebound to the final staged tree at `dda8b38` by the coordinator.** No upload or publication was performed for this kit. The math payload is promoted, audited and hash-bound; the frontend candidate is a staged build only (`game/dist` is not synced — the coordinator makes the final build); the human gates (listening pass, real-phone pass, recorded rig motion review, art acceptance) are open. Every "pending" below is pending today; nothing here is a claim of Engine approval.

## Upload candidates and exact paths

| Candidate | Absolute local path | Status / hash binding |
| --- | --- | --- |
| Frontend directory | `/Users/jbull/code/piggy-firefighters/game/dist/` | **Pending the owner's sync.** The final tree is staged and hash-bound (next row); the rsync into `game/dist/` (`./tools/build_dist.sh` without `--no-sync`) was refused to the coordinator's session by the permission gate, so the owner runs it. After the sync the `game/dist` sumsSha256 must equal `d8b37183…`; if it does not, the sources changed — rebind. |
| Frontend staged candidate (the final tree, awaiting the byte-copy into `game/dist`) | `/Users/jbull/code/piggy-firefighters/apps/piggy_firefighters/build/` | Staged by `./tools/build_dist.sh --no-sync` at `dda8b38`: BUILD OK, 671 files / 60,512 KiB (63 MB), `build/provenance.json` stamped and PASS, sumsSha256 `d8b37183…`. The `/rigs` dev viewer route is held out of the build by the script. |
| Frontend build record | `/Users/jbull/code/piggy-firefighters/docs/submission/BUILD_RECORD.md` | Written 2026-09-25 for the staged build at `dda8b38`: 671 files / 60,512 KiB, bundle `bundle.CQq44m1H.js`, provenance digest `a422782d2344…` (PASS), **sumsSha256 `d8b37183c0da75acd63cfec822cf246879532a010d04a43f42b1aa8aef837d44`**, subpath-serving PASS. `game/BUILD_INFO.md` is written with the sync. |
| Math directory | `/Users/jbull/code/piggy-firefighters/math/publish/` | **PASS — bound today**: thirteen payload files (index + six books + six LUTs), 3,681,029,306 bytes, every sha256/byte count recomputed and EQUAL to `MANIFEST.json` (`qa/submission/math_package_manifest.json`). Plus `MANIFEST.json` itself (not part of the Engine payload; harmless to include). |
| Math publication manifest | `/Users/jbull/code/piggy-firefighters/math/publish/MANIFEST.json` | SHA-256 `dfc8bce40a6273f22eb27e7adfacdb3e909839ead3143186c7ac7eaf895d8096`, 20,076 bytes — this is the file's hash, not a hash of the directory. |
| Math independent audit | `/Users/jbull/code/piggy-firefighters/qa/codex/math/m3-audit.json` | SHA-256 `34532cd44e41a789ea57a548d0d84cd2b962bc8f787817b4bc6bb93c8a44c4b3` (equals `MANIFEST.json` → `independent_audit.sha256`); status PASS, 1,840,000 trials / 3,630,001 rows / 2,180,000 canonical links checked. |
| Math report | `/Users/jbull/code/piggy-firefighters/docs/math/MATH_PF_REPORT.md` | SHA-256 `f50d82266fdde00a709e5c7264076f87cd37116bfa3685238d4f8e5f18d55400`; production report `report.json` SHA-256 `4fccb1b7d95ebbd4c09a5509fe3c2be944016e64b3c4ba535250cb9c3a64164e` (per manifest; the 4.6 GiB production tree was not re-hashed for this kit). |
| Production fixtures | `/Users/jbull/code/piggy-firefighters/server/fixtures/` | 16 real-book fixtures + `index.json` (SHA-256 `4d373831657ff098250ffdcbdb97e2fa362477d660bd4f98a544262124102c57`) + `source-record.json`; ids resolve to their `payoutMultiplier` in the promoted LUTs (16/16, `MATH_HANDOFF.md`). Development evidence, not an upload. |
| Tile files | `/Users/jbull/code/piggy-firefighters/thumbnail/submission/{PiggyFirefighters-BG.png, PiggyFirefighters-FG.png, PiggyFirefighters-BG-16x9.png, PiggyFirefighters-FG-16x9.png, CrashGalaxy-Logo.png}` | Byte-identical copies of `thumbnail/{background,foreground}_{3_4,16_9}.png` (validator PASS 8/8 + 14/14 agent checks) and the provider mark rasterised from the shipped Crash Galaxy bumper. Sizes, hashes and the ≤ 3 MB pair check (1,608,463 and 986,199 bytes: PASS) in `thumbnail/submission/README.md`. Tile-editor preview and human art acceptance are separate. |

The frontend upload is the final `game/dist/` directory. `apps/piggy_firefighters/build/` is the staging location. The math upload is the **LOCAL complete `math/publish/` directory**, including all six Git-ignored `books_*.jsonl.zst` files (`.gitignore` line 69). A GitHub checkout, source archive or LUT/index-only copy is incomplete.

Do not include the mock RGS (`server/mock-rgs.mjs`), `server/fixtures*`, the Python environment (`math/env`), the production tree (`math/games/piggy_firefighters/library/`), `art-src/`, `audio/` masters or the source tree as a frontend or math upload.

## Math evidence and checksums

Game `piggy_firefighters`, 5×3, 20 fixed lines, six modes, RTP 96.70% (LUT-exact 0.96699999) in every mode, max win 15,000× base bet in every mode. Model frozen at annotated tag `math-freeze-v1` = commit `38a6c2f75d6b624eab2ae4efbcd55ed467075127` (76 frozen source files, `source_unchanged == true`). Production M3: 1,840,000 simulation trials → 3,630,001 publication rows, exit 0, `candidate_status PASS`, independent audit PASS. Evidence: `docs/math/MATH_PF_REPORT.md`, `docs/GAME_CONTRACT.md` §9, `docs/submission/MATH_HANDOFF.md`, `qa/codex/math/m3-audit.json`.

**Hash provenance: recomputed today**, not inherited. `qa/submission/math_package_manifest.json` re-read all thirteen files from disk (python `hashlib.sha256`, 16 MiB chunks; LUT rows by `wc -l`) and compared with `MANIFEST.json`: **EQUAL** on every file (sha256, bytes and LUT line counts). If any file is changed, replaced or repacked (`stakecli --repack` included), this binding no longer holds; rebind before upload.

| Absolute file path | Bytes | Rows | SHA-256 |
| --- | ---: | ---: | --- |
| `/Users/jbull/code/piggy-firefighters/math/publish/index.json` | 906 | — | `6d758b5ba5a070178caa43a762d19f883f9511eb2c306d8f6cb5f2f5222d82ac` |
| `/Users/jbull/code/piggy-firefighters/math/publish/books_base.jsonl.zst` | 912,009,754 | 940,000 | `a99461ac74deda54e2b7187724369ea42d90de16197ed2acc4d42b85a5f8a6be` |
| `/Users/jbull/code/piggy-firefighters/math/publish/lookUpTable_base_0.csv` | 22,041,327 | 940,000 | `73bd42fbc2b9f6c25ff992ce8c9f1b34a80983bd0a7ddbde0896b082cd9e95e8` |
| `/Users/jbull/code/piggy-firefighters/math/publish/books_ante.jsonl.zst` | 912,826,613 | 940,000 | `bbdca092385ef6179071de3ac62bc83cd649c7555dbec1dd5adee28a597601fc` |
| `/Users/jbull/code/piggy-firefighters/math/publish/lookUpTable_ante_0.csv` | 22,100,950 | 940,000 | `67909bf1b34b5c7e797ad946e8b3c7682fb94f840a87c45d54719a8d108ab235` |
| `/Users/jbull/code/piggy-firefighters/math/publish/books_backdraft_spins.jsonl.zst` | 187,904,416 | 350,000 | `89a0fddb65247b6e9062b0945af6f56e86980cd61447554deb0fbda88d1cdfe1` |
| `/Users/jbull/code/piggy-firefighters/math/publish/lookUpTable_backdraft_spins_0.csv` | 6,900,657 | 350,000 | `858f2227b762690fbfe1d42297a3566de385e0ce4449254f8bfd405748433831` |
| `/Users/jbull/code/piggy-firefighters/math/publish/books_alarm_call.jsonl.zst` | 795,277,191 | 700,001 | `24d548cee921eb3351724bff32766ecc708e2cf8466e7dc51395ffcf17ed5e3e` |
| `/Users/jbull/code/piggy-firefighters/math/publish/lookUpTable_alarm_call_0.csv` | 14,862,375 | 700,001 | `020e56183dbffc859a05ae5171e151d8c38fff89e935a2b5514db16939bd2381` |
| `/Users/jbull/code/piggy-firefighters/math/publish/books_rescue.jsonl.zst` | 372,117,903 | 350,000 | `8d6718567353e9e855aec809a7e414c50c16d3c082593e396493e560c2dcd28f` |
| `/Users/jbull/code/piggy-firefighters/math/publish/lookUpTable_rescue_0.csv` | 6,729,365 | 350,000 | `c4983ed172b8ef579e505a5c5543dd563c11972dd1cae24dbc7040e3e4b30e84` |
| `/Users/jbull/code/piggy-firefighters/math/publish/books_inferno.jsonl.zst` | 421,285,974 | 350,000 | `9d6660c9baece6dc5a16b8c9a0f637c6fba9b3ee7eeae710721ae65cb35b3d40` |
| `/Users/jbull/code/piggy-firefighters/math/publish/lookUpTable_inferno_0.csv` | 6,971,875 | 350,000 | `6beec9ce9b7b01523bb140c6a229b45c5911f3083eb1499c740526664eb59a96` |
| `/Users/jbull/code/piggy-firefighters/math/publish/MANIFEST.json` | 20,076 | — | `dfc8bce40a6273f22eb27e7adfacdb3e909839ead3143186c7ac7eaf895d8096` |

- [x] `index.json` names exactly six modes at costs base 1 / ante 1.5 / backdraft_spins 50 / alarm_call 12 / rescue 18 / inferno 90; `qa/gate/check_mode_costs.mjs` confirms `config.ts` and the fixtures match it byte for byte (run today, OK).
- [x] Production binding PASS for all six modes; RTP 0.96699999 every mode; every LUT payout within 0…1,500,000 and a multiple of 10; every mode carries a positive-weight 15,000× outcome (`MATH_HANDOFF.md`).
- [x] All thirteen files present in the exact local directory selected for upload, sizes and hashes EQUAL to `MANIFEST.json` (recomputed today).
- [ ] Coordinator confirms no math file changes between this binding and the upload; if `stakecli` repacks the books, record the repacked hashes separately and do not apply this binding to different bytes.

## Local gate evidence and remaining requirements

- [x] Frontend gate `node qa/gate/run.mjs` run today at `c111822`: 5/5 OK (mode costs vs `index.json`; 22 round-tier cases per contract §8; 190 cue references all in the 232-cue manifest; padding reels match the reel CSVs; art meta matches the served JSON).
- [x] Staged build `./tools/build_dist.sh --no-sync` at `c111822`: BUILD OK, 670 files / 60,514,679 bytes, dev-only `/rigs` route excluded.
- [x] Fixture smoke `qa/smoke/port/results.json` (2026-09-25T08:27Z, Chromium 141, dev server :3003 + mock RGS :3036, `--mute-audio`): 12/12 fixtures PASS, 0 console errors (base no-win/win/backdraft, ante, alarm_call false/rescue, rescue buy, inferno buy, base trigger rescue/inferno, max_win, backdraft_spins). This ran against the dev server, not the staged or final build.
- [x] Four Spine 4.2.43 rigs installed under `apps/piggy_firefighters/static/assets/spine/{pf_chief,pf_rookie,pf_dog,pf_rescued}` (json + atlas + pages); `check_contract.py` PASS ×4; viewer sanity frames under `qa/codex/rig-viewer/<rig>-final/` (`PROGRESS.md`, commits `9185703`, `abdd623`, `df6f2dd`, `75b148a`). Every rig is original to this title.
- [x] Original art (134 recorded OpenAI calls, `art-src/generated/source-record.json`; audit agent PASS with warnings), original audio (232 cues / 464 runtime files, `measure.py` PASS 16/16, −14 LUFS target), Blender-rendered win-rung solids and fountain coin (`769f254`, consumers `c111822`). Donor LUCKY art purged from `static/assets` (byte-identical files); donor audio replaced by the audio build (`PROGRESS.md`).
- [x] Player copy says "Engine" (never the two-word name); the general disclaimer paragraph (`rulesContent.ts:30` std, `:32` social, identical, 466 chars) hashes to `ec5f997f27964a30e2c1535fa618e173d899546d06846f44efaa1b069d75e8ee`, equal to the bound live-template read — [GENERAL_DISCLAIMER_AUDIT.md](GENERAL_DISCLAIMER_AUDIT.md). The coordinator's live re-scrape today (11:55 EDT) agrees; this lane's own single fetch got only the loading shell.
- [x] Tile files prepared and size-checked (`thumbnail/submission/README.md`); thumbnail validator PASS 8/8 and 14/14 agent checks (`thumbnail/source-record.json`).
- [x] Final tree built, stamped and hash-bound (`docs/submission/BUILD_RECORD.md`, sumsSha256 `d8b37183…`); subpath-serving probe PASS on that tree. - [ ] Owner syncs it into `game/dist` (`./tools/build_dist.sh`) and re-derives the same hash there.
- [ ] Confirm the audited disclaimer, the six mode prices, 96.70% and 15,000× render in the final artifact's rules sheet; recheck the live template if it changes before submission.
- [ ] Human listening pass (audio) — NOT RUN.
- [ ] Real-phone motion/usability pass (390×844 class device: layout, input, normal/turbo/super-turbo, audio, resume/replay) — NOT RUN; local mock evidence is not device evidence.
- [ ] Recorded per-clip motion review of the four rigs (the acceptance rule in `docs/ANIMATION_CONTRACT.md`) — NOT RUN by owner's instruction; the owner records the outcome or waives it explicitly.
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
4. Check the uploaded game through its real launch path: all six modes at their prices (1 / 1.5 / 12 / 18 / 50 / 90), the ALARM BOOST toggle, buy-card confirmation, resume/replay and the phone layout. Record this separately from local mock evidence.
5. Apply the tile layers from `thumbnail/submission/` (3:4 primary; 16:9 pair if the editor asks for it) and the provider logo; inspect the actual editor preview at small size. Complete the game metadata, disclaimer and short introduction using the final reviewed copy.
6. Record the outcome of the human items above (listening pass, phone pass, rig motion review, art acceptance) or waive each explicitly.
7. Submit/request review only for the owner-confirmed version pair. Record the submission reference and outstanding human items; no local PASS establishes Engine approval.
