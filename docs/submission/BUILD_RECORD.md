# PIGGY FIREFIGHTERS — frontend build record (finishing pass, 2026-09-25)

Written by the coordinator on 2026-09-25 (13:35–13:50 EDT). It describes the **staged** build at
`apps/piggy_firefighters/build/` produced by `./tools/build_dist.sh --no-sync` at commit **`968e8e8`** (tree clean apart
from the ignored `qa/build/` sidecar). `game/dist/` was synced from it at `968e8e8` (`game/BUILD_INFO.md`). Every check below is a machine check on
the staged bytes; no human has reviewed this build.

| Field | Value |
|---|---|
| Source commit | `dda8b38` on `claude/bold-bell-aoscdj` (HEAD at build start and end) |
| Command → result | `./tools/build_dist.sh --no-sync` → `provenance stamped: … (head dda8b38 +local changes, 1007 inputs, digest 98e8a0b59224…, index.html 7b4191926b8d…)`, `BUILD OK (staged …)`, `63M`; the "+local changes" is the untracked `qa/build/` sidecar only (`git status` otherwise clean) |
| Provenance | `build/provenance.json`: inputDigest `368350f200cf` over 1,007 build inputs (app `src` minus the held `/rigs` route, `static`, vendored HUD tarball, app configs, `packages/*/src`); `node qa/gate/check_provenance.mjs --dir apps/piggy_firefighters/build` → PASS |
| Bundle | `_app/immutable/bundle.BCHNHVOb.js`; `bundleStrategy: 'inline'` carries the same code inside `index.html` (sha256 `7b4191926b8d…`, full value in `provenance.json` `indexHtmlSha`) |
| Size / files | 712 regular files, 72,516 KiB (`du -sk`), `/rigs` viewer absent, `rigs.html` absent |
| Content hash | **sumsSha256 `caaefb837a5582e4490148ab4f642ae4c6acc1eb800124cb1d078f29eeeff1fe`** = sha256 of the `shasum -a 256` listing of every file sorted by path (`LC_ALL=C sort`), the LUCKY method. Re-derive after the sync with `(cd game/dist && find . -type f \| sed 's\|^\./\|\|' \| LC_ALL=C sort \| tr '\n' '\0' \| xargs -0 shasum -a 256) \| shasum -a 256` — it must match, since the sync is a byte copy |
| Not reproducible | SvelteKit stamps `_app/version.json` into the bundle, so a rebuild of the same commit gets a new bundle name; pin runtime evidence to this sumsSha256, not to a rebuild |
| What is in it | all four Spine rigs (`assets/spine/pf_chief` two pages, `pf_rookie`, `pf_dog`, `pf_rescued` three pages), the Blender 3D rung sheets (`assets/3d/winrungs`), 464 audio files, delivered art; 0 files with the donor sample bet-mode strings (`SAMURAI SPIN`, `example banner text`, `PLACE YOUR BET`), 0 `Stake Engine` |
| Subpath serving | `node qa/precheck/probe-subpath-serving.mjs --dir apps/piggy_firefighters/build` → **SUBPATH-SERVING PASS** (served at `/v70/`, booted against the fixtures mock, 0 failed same-origin requests, nothing escaped the mount, 0 external origins, Inter / StationSign / Lilita One loaded); evidence `qa/precheck/evidence/subpath-serving.json` |
| Smoke on the final source | `qa/smoke/final/results.json` — see the PROGRESS.md row of this pass for the per-fixture outcome (dev server 3003 + fixtures mock 3036, muted Chromium) |
| Not run (owner: no extensive tests) | full smoke matrix, five-cell renderer matrix on this exact tree, recorded rig motion review, listening pass, real-phone pass |

## After the owner syncs `game/dist`
1. `./tools/build_dist.sh` (rebuilds and rsyncs; the new stamp's digest must still be `98e8a0b59224…` if no input changed).
2. `node qa/gate/check_provenance.mjs --dir game/dist` → PASS, and the sumsSha256 derivation above.
3. Bind that hash in `docs/submission/PRE_UPLOAD_CHECKLIST.md` (rows "Frontend directory" / "Frontend build record") and commit `game/dist` + this file together.
