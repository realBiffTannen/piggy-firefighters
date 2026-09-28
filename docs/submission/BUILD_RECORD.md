# PIGGY FIREFIGHTERS — frontend build record

## 2026-09-28 (later) — contract v1.3.1 build (current upload candidate)

Same tree as the v1.3 record below plus the owner's "get rid of the display modals for small wins" change: win-tier floors
and the centred count-up threshold in COST units (`game/roundTier.ts`, contract §8 v1.3.1). Math untouched (`math-freeze-v2`).

| Field | Value |
|---|---|
| Source | the commit that carries this record (stamp: head `f6d1675 +local changes`, inputs byte-identical, provenance recomputed) |
| Command → result | `./tools/build_dist.sh` → `BUILD OK`, `game/dist` synced; built 2026-09-28T15:56:11Z |
| Provenance | inputDigest `8dc50bbd89db99b92dd4e4d19ad003f1b844f0bac319a8e96c09bb232f848f0e` over 1,098 inputs; `check_provenance` PASS |
| Bundle | `_app/immutable/bundle.DllHVmeT.js`; `index.html` sha256 `e31a210653efe3c44e0a2cc4c35d7873d5d52d2f077cc49aaa76734c57de90bf` |
| Size / files | 756 regular files, 66,964 KiB |
| Content hash | **sumsSha256 `b72bb9ac9bff82db204d00eab799663cb9adf49251bafac3dc3a2bbd2d07a66b`** |
| Gate / smoke | `node qa/gate/run.mjs` 14/14 OK; static smoke desktop + phone on the published v2 books, 0 console / page errors, 0 failed requests (`qa/smoke/static-2026-09-28/results_v131.json`); `qa/smoke/static-2026-09-28/tier_probe.mjs` prints the per-mode sign / plaque thresholds |

---

## 2026-09-28 — contract v1.3 build (superseded the same day by v1.3.1 above)

Written by the coordinator on 2026-09-28. `game/dist/` was built and synced by `./tools/build_dist.sh` from the tree
committed as **`34afb50`** (`claude/bold-bell-aoscdj`; the stamp records head `9a61961 +local changes` because the build ran
before that commit — the inputs are identical, proven by the provenance recomputation). Every check below is a machine
check on the synced bytes; no human has reviewed this build.

| Field | Value |
|---|---|
| Source commit | `34afb50` (build inputs); commits `10ef511` (math v2), `9a61961` (mascots out, Trotterville shield, card art), `34afb50` (two ante tiers, prices, 20,000x, math v2 promoted) |
| Command → result | `./tools/build_dist.sh` → `BUILD OK`, `game/dist` synced, 65M; built 2026-09-28T15:34:22Z |
| Provenance | `game/dist/provenance.json`: inputDigest `4ed05ff202b8223ae34cca0bc01570c9d6cd17440da9d9512a65b430044af02e` over 1,098 build inputs; `node qa/gate/check_provenance.mjs --dir game/dist` → PASS |
| Bundle | `_app/immutable/bundle.fThyBaRl.js`; `index.html` sha256 `ddd885ad7da4e3c7ef302472e996f8049103c8d72bbe4b41c03b0461ddc78c58` |
| Size / files | 756 regular files, 66,964 KiB (`du -sk`), `/rigs` viewer absent |
| Content hash | **sumsSha256 `304398d3b508ada1114432dbc7d964b03dc6f72086811f8e5e5ef6396a32a59b`** (the LUCKY method, see `game/BUILD_INFO.md` for the exact command) |
| Not reproducible | SvelteKit stamps `_app/version.json` into the bundle, so a rebuild of the same commit gets a new bundle name; pin runtime evidence to this sumsSha256 |
| What is in it | seven modes at the owner's prices, the HUD ante chooser (ALARM BOOST / FIVE-ALARM BOOST, CONFIRM, NO BOOST), 20,000x everywhere, two rigs (`pf_rookie`, `pf_rescued`), no mascots, the re-derived card art, 0 `Stake Engine` strings |
| Gate | `node qa/gate/run.mjs` 14/14 OK on these inputs (provenance PASS on `game/dist`) |
| Subpath serving / static smoke | see the 2026-09-28 `PROGRESS.md` row (run after this record was written) |
| Not run | fixture smoke matrix, renderer matrix, recorded rig motion review, real-phone pass |

---

## 2026-09-25 — finishing-pass build (superseded)


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
