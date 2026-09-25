# PIGGY FIREFIGHTERS — build info

Written by the coordinator on 2026-09-25 (owner's instruction "rebuild the game/dist"). It describes the `game/dist/`
committed with this file, the frontend intended for upload. Every check below is a machine check; no human has reviewed
this build.

| Field | Value |
|---|---|
| Source commit | `ecec27c` on `claude/bold-bell-aoscdj` (HEAD at build start and end; tree clean apart from the ignored `qa/build/` sidecar) |
| Command → result | `./tools/build_dist.sh` → `provenance stamped … (head ecec27c, 1007 inputs, digest 51c3bb1c7b10…, index.html 8b7f13e5dee6…)`, `BUILD OK`, rsync to `game/dist` |
| Provenance | `game/dist/provenance.json`; `node qa/gate/check_provenance.mjs --dir game/dist` → PASS |
| Bundle | `_app/immutable/bundle.CCvmXjNR.js` (bundleStrategy inline: the same code sits in `index.html`) |
| Size / files | 671 regular files, 60,512 KiB; `/rigs` viewer absent, `rigs.html` absent |
| Content hash | **sumsSha256 `c1aed81b27cd7eeb3c00e9661edcec613d81fafefbd43bd6354903fd868474ee`** = sha256 of the `shasum -a 256` listing of every file sorted by path (`LC_ALL=C sort`) |
| What is in it | four Spine rigs, Blender 3D rung sheets, 464 audio files, delivered art; small-win figures removed; Backdraft Spins plate band; fitted outro title; ALARM BOOST chip hidden during a bonus unless ON |
| Runtime evidence on this code | smoke (dev server, muted Chromium): base_win, base_backdraft_win, backdraft_spins, inferno_buy, max_win (15,000x), alarm_call_false PASS, 0 console errors; captures of Backdraft Spins (phone + desktop) and the Inferno outro card (phone) inspected by eye |
| Not run | full smoke matrix, renderer matrix on this exact tree, recorded rig motion review, listening pass, real-phone pass |
