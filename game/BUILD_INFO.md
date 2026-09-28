# PIGGY FIREFIGHTERS — build info

Written by the coordinator on 2026-09-28 (owner: "rebuild the game/dist when the math is done"). It describes the
`game/dist/` committed with this file, the frontend intended for upload: contract v1.3.1 (two ante tiers, owner prices,
20,000x cap, math freeze v2, win tiers and the count-up threshold in COST units), no mascots. Every check below is a machine check; no human has reviewed this build.

| Field | Value |
|---|---|
| Source tree | the tree committed with this file (v1.3.1: win tiers in cost units) on `claude/bold-bell-aoscdj`; the stamp says head `f6d1675 +local changes` because the build ran before that commit — every build input is byte-identical to it, which `node qa/gate/check_provenance.mjs --dir game/dist` proves by recomputing the input digest |
| Command → result | `./tools/build_dist.sh` → `provenance stamped … (head 9a61961 +local changes, 1098 inputs, digest 4ed05ff202b8…, index.html ddd885ad7da4…)`, `BUILD OK`, rsync to `game/dist`; built 2026-09-28T15:56:11Z |
| Provenance | `game/dist/provenance.json`: inputDigest `8dc50bbd89db99b92dd4e4d19ad003f1b844f0bac319a8e96c09bb232f848f0e` over 1,098 build inputs; `check_provenance` → PASS |
| Bundle | `_app/immutable/bundle.DllHVmeT.js` (bundleStrategy inline: the same code sits in `index.html`, sha256 `e31a210653efe3c44e0a2cc4c35d7873d5d52d2f077cc49aaa76734c57de90bf`) |
| Size / files | 756 regular files, 66,964 KiB; `/rigs` viewer absent, `rigs.html` absent |
| Content hash | **sumsSha256 `b72bb9ac9bff82db204d00eab799663cb9adf49251bafac3dc3a2bbd2d07a66b`** = sha256 of the `shasum -a 256` listing of every file sorted by path (`LC_ALL=C sort`, paths without the `./` prefix): `(cd game/dist && find . -type f \| sed 's\|^\./\|\|' \| LC_ALL=C sort \| tr '\n' '\0' \| xargs -0 shasum -a 256) \| shasum -a 256` |
| What is in it | win signs and the centred count-up measured against the round's charged cost (no BIG..EPIC sign under 15x the stake, no plaque under 20x the stake); seven bet modes (base 1x, ALARM BOOST 3x, FIVE-ALARM BOOST 5x, Alarm Call 15x, Rescue Spins 25x, Backdraft Spins 50x, Inferno Rescue 100x), 20,000x cap, the HUD ante chooser with CONFIRM; two Spine rigs only (`assets/spine/pf_rookie`, `pf_rescued` + their `spine-lod` pages) — `pf_chief` and `pf_dog` are gone; the new `buycards/super-ante.webp`, the Ember-free `buycards/ante`, `alarm-call`, `splash/card_alarm`, `card_lines`, `card_maxwin`, both `maxwin/` cards, and `splash/card_chief` with the Trotterville F.D. shield |
| Gate on these sources | `node qa/gate/run.mjs` 14/14 OK at the build inputs (mode costs vs `math/publish/index.json`, round tier, rung pacing, HUD bar, symbol motion, splash, rig beats, bonus font, cue ids, rescue phone, win coins, padding reels, art meta, rung light, provenance on `game/dist`) |
| Runtime evidence on this tree | static smoke (this tree served by `python3 -m http.server`, mock RGS on the published v2 books): see the 2026-09-28 row of `PROGRESS.md` |
| Not run | full fixture smoke matrix, renderer matrix, real-phone pass, recorded rig motion review, `mid` / `low` quality tiers on real hardware |
