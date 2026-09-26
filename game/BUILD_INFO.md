# PIGGY FIREFIGHTERS — build info

Written by the verify lane of the low-end performance pass on 2026-09-26 (owner's instruction "build me the new
game/dist"). It describes the `game/dist/` committed with this file, the frontend intended for upload. Every check below
is a machine check; no human has reviewed this build. The submission record and checklist under `docs/submission/`
were rebound to this tree by the coordinator (`218f51a`).

| Field | Value |
|---|---|
| Source commit | `968e8e8` on `claude/bold-bell-aoscdj` (HEAD at build start and end; tree clean apart from the ignored `qa/build/` sidecar and `packages/pixi-svelte/dist`, rebuilt with `pnpm --filter pixi-svelte build` right before) |
| Command → result | `./tools/build_dist.sh` → `provenance stamped … (head 968e8e8, 1052 inputs, digest 98e8a0b59224…, index.html 7b4191926b8d…)`, `BUILD OK`, rsync to `game/dist` |
| Provenance | `game/dist/provenance.json`; `node qa/gate/check_provenance.mjs --dir game/dist` → PASS |
| Bundle | `_app/immutable/bundle.BCHNHVOb.js` (bundleStrategy inline: the same code sits in `index.html`); lodash no longer in it (`index.html` 1,514,173 → 1,398,056 B) |
| Size / files | 712 regular files, 72,516 KiB (+41 files: `assets/spine-lod/` 11,072 KiB lossless + half-size WebP rig atlases, `assets/lod/` 1,612 KiB 0.625× plates); `/rigs` viewer absent, `rigs.html` absent |
| Content hash | **sumsSha256 `caaefb837a5582e4490148ab4f642ae4c6acc1eb800124cb1d078f29eeeff1fe`** = sha256 of the `shasum -a 256` listing of every file sorted by path (`LC_ALL=C sort`, paths without the `./` prefix — the LUCKY method used by docs/submission/BUILD_RECORD.md; re-derived by the coordinator on the committed tree; with the `./` prefix kept the listing hashes to `104d4e22e78d…`) |
| What is in it | everything of the ecec27c tree plus the perf pass: boot manifest reduced to the base game (feature art, feature rigs, other-orientation symbol sheet and the cold audio set arrive lazily), quality tiers (`src/game/quality.svelte.ts`), LOD plates and half-size rig pages below the `high` tier, cached card / board shadow, pooled FX, hot-set audio with bed eviction, Inter subset (133,908 B), `interGold.webp` font page |
| Runtime evidence on this code | the input digest `98e8a0b5…` is the digest of the tree `qa/perf/after.json` measured (`qa/perf/REPORT.md`): boot, base_win, base_backdraft_win, backdraft_spins, inferno_buy on phone-lowend (390×844@3, CPU ×6) and laptop-old (1366×768@1, CPU ×4), all 10 ok, 0 console errors; the production bundle driven at `?quality=low` through the QA seam: 500x round completed, 30 fps idle cap live; smoke on the dev server of the same sources: base_win (50000) and backdraft_spins (5580) PASS, 0 console errors |
| Not run | max_win, alarm_call_false, base_trigger_rescue smokes on this exact tree; renderer matrix; recorded rig motion review; real-phone pass; the `mid` / `low` tiers on real hardware (headless Chromium reports no `deviceMemory`, so the harness scores `high`) |
