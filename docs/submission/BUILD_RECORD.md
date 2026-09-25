# PIGGY FIREFIGHTERS — frontend build record (finishing pass, 2026-09-25)

Written by the coordinator on 2026-09-25 (13:35–13:50 EDT). It describes the **staged** build at
`apps/piggy_firefighters/build/` produced by `./tools/build_dist.sh --no-sync` at commit **`dda8b38`** (tree clean apart
from the ignored `qa/build/` sidecar). `game/dist/` is NOT synced: the sync (`./tools/build_dist.sh` without `--no-sync`,
an `rsync -a --delete` of this staged tree into `game/dist/`) was refused to the coordinator's session by the harness
permission gate ("Modify Shared Resources") and is the owner's one-line action. Every check below is a machine check on
the staged bytes; no human has reviewed this build.

| Field | Value |
|---|---|
| Source commit | `dda8b38` on `claude/bold-bell-aoscdj` (HEAD at build start and end) |
| Command → result | `./tools/build_dist.sh --no-sync` → `provenance stamped: … (head dda8b38 +local changes, 1007 inputs, digest a422782d2344…, index.html 55a63f2da978…)`, `BUILD OK (staged …)`, `63M`; the "+local changes" is the untracked `qa/build/` sidecar only (`git status` otherwise clean) |
| Provenance | `build/provenance.json`: inputDigest `a422782d2344f11432b960d94ab531555b7b488f4a4b56e510c302fbc162f47f` over 1,007 build inputs (app `src` minus the held `/rigs` route, `static`, vendored HUD tarball, app configs, `packages/*/src`); `node qa/gate/check_provenance.mjs --dir apps/piggy_firefighters/build` → PASS |
| Bundle | `_app/immutable/bundle.CQq44m1H.js`; `bundleStrategy: 'inline'` carries the same code inside `index.html` (sha256 `55a63f2da978…`, full value in `provenance.json` `indexHtmlSha`) |
| Size / files | 671 regular files, 60,512 KiB (`du -sk`), `/rigs` viewer absent, `rigs.html` absent |
| Content hash | **sumsSha256 `d8b37183c0da75acd63cfec822cf246879532a010d04a43f42b1aa8aef837d44`** = sha256 of the `shasum -a 256` listing of every file sorted by path (`LC_ALL=C sort`), the LUCKY method. Re-derive after the sync with `(cd game/dist && find . -type f \| sed 's\|^\./\|\|' \| LC_ALL=C sort \| tr '\n' '\0' \| xargs -0 shasum -a 256) \| shasum -a 256` — it must match, since the sync is a byte copy |
| Not reproducible | SvelteKit stamps `_app/version.json` into the bundle, so a rebuild of the same commit gets a new bundle name; pin runtime evidence to this sumsSha256, not to a rebuild |
| What is in it | all four Spine rigs (`assets/spine/pf_chief` two pages, `pf_rookie`, `pf_dog`, `pf_rescued` three pages), the Blender 3D rung sheets (`assets/3d/winrungs`), 464 audio files, delivered art; 0 files with the donor sample bet-mode strings (`SAMURAI SPIN`, `example banner text`, `PLACE YOUR BET`), 0 `Stake Engine` |
| Subpath serving | `node qa/precheck/probe-subpath-serving.mjs --dir apps/piggy_firefighters/build` → **SUBPATH-SERVING PASS** (served at `/v70/`, booted against the fixtures mock, 0 failed same-origin requests, nothing escaped the mount, 0 external origins, Inter / StationSign / Lilita One loaded); evidence `qa/precheck/evidence/subpath-serving.json` |
| Smoke on the final source | `qa/smoke/final/results.json` — see the PROGRESS.md row of this pass for the per-fixture outcome (dev server 3003 + fixtures mock 3036, muted Chromium) |
| Not run (owner: no extensive tests) | full smoke matrix, five-cell renderer matrix on this exact tree, recorded rig motion review, listening pass, real-phone pass |

## After the owner syncs `game/dist`
1. `./tools/build_dist.sh` (rebuilds and rsyncs; the new stamp's digest must still be `a422782d2344…` if no input changed).
2. `node qa/gate/check_provenance.mjs --dir game/dist` → PASS, and the sumsSha256 derivation above.
3. Bind that hash in `docs/submission/PRE_UPLOAD_CHECKLIST.md` (rows "Frontend directory" / "Frontend build record") and commit `game/dist` + this file together.
