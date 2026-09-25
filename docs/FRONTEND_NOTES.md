# PIGGY FIREFIGHTERS — frontend notes (base-game port, 2026-09-25)

Scope of this pass: the donor engine (LUCKY, `/home/user/lucky/apps/lucky`, read-only) ported into
`apps/piggy_firefighters` so a real round plays end to end against the mock RGS, for every mode of
`docs/GAME_CONTRACT.md` (v1.2.2 since the fix round of §7). Pictures are PROCEDURAL PLACEHOLDERS; later lanes replace visuals only (Rescue /
Inferno scene art, Alarm Call card, Backdraft Spins polish, win-rung re-skin, audio, real art). The flow, the state and
the event contract below are what they build on.

## 1. What was ported, what changed

| Area | Status |
|---|---|
| Boot (`app.html`, `+layout.svelte`, hooks, bumper, splash hand-off, HUD mount, NoSelect, PlayNotice, ModalError) | kept; titles `PIGGY FIREFIGHTERS`, mute key `piggy-firefighters-muted` (layout bumper + `game/audio/audioManager.ts` GAME_ID), sign font renamed `StationSign` (Alfa Slab One), AnteConfirm dropped |
| Core state (`stateApp/Xstate/Layout/context/eventEmitter/types/stateNotice/replayLaunch/devFixture/prewarm/money/socialFloor/winLevelMap/generatedConfig`) | kept; QA flag `__LUCKY_QA` → `__PFF_QA` |
| Reels (`game/reels/*`, `components/reels/*`) | kept; `spinReels` LEGEND for the new ids, `paddingFor` picks basegame / antegame / backdraftgame / freegame / infernogame from the reveal's `gameType` + bonus (getter wired from `stateGame`, no import cycle) |
| Board / symbols (`Board*`, `ReelSymbol`, `Symbol`, `SymbolSprite`, `symbolMotion`, `Anticipation(s)`, `BoardFx`) | kept; ALARM/GALARM replace the donor scatters, L4 added, trigger count 3 (`constants.TRIGGER_ALARMS`), Blaze Wild via client-only `RawSymbol.blaze` → `sym_W_BLAZE` |
| Win presentation (`Win`, `WinCoins`, `WinRungs`, `roundTier`, `roundStake`) | contract §8 v1.2.2: ONE client tier function `roundTier(W, S, capped)` (tier 0 when W ≤ S, then 15/30/50/100 × B, MAX on the cap), S from `config.betModes[mode].cost`; rungs BIG → HUGE → MEGA → EPIC → MAX at the same floors, once per round; the SDK `winLevel` is never read |
| Scene (`SceneShutter` = Station 13 bay door, `TransitionFx`, `stateScene` moods base/rescue/inferno) | kept, re-pointed at placeholders; the optional Spine FX rig key is `fx_transition` (not registered yet, so every open is the three-haul lift) |
| Hold & Build (all of `components/build/*`, `game/build/*directors*`, houses, hats, gust/delivery, wolf/crate, FeatureDrops, Hat3D, WildSymbol, rigs route, prizes, mascotEvents, AmbientWorld) | DELETED |
| Generic kit (`buildTiming`, `pixiKit`, `motion`, `sceneTextures`, `stateScene`, `signPanel`, `audioDirector`) | moved to `game/fx/` (`buildTiming` → `fx/timing.ts`); `audioDirector` rewritten as the feature audio seam (firstCue fallbacks, silent until the audio lane ships cues) |
| NEW | `components/Paylines.svelte`, `LinePop.svelte`, `BackdraftFx.svelte`, `AlarmCallCard.svelte`, `rescue/RescueScene.svelte`, `game/rescue/{stateRescue.svelte,rescueDirector}.ts`, `game/format.ts`, `eslint.config.js` (flat config; the donor `.eslintrc.cjs` could not load under ESLint 9) |

## 2. File map (src/)

```
game/config.ts            gameID, 6 bet modes (frozen math costs, ascending buy price), 20 paylines (1-based lineIndex = index+1),
                          paytable, padding strips GENERATED from math reels/*.csv (tools/reels/make_padding.py)
game/roundTier.ts         contract §8 tier rule (no imports; node-checked by qa/gate/check_round_tier.mjs)
game/roundStake.ts        the round's mode / charged cost S / total W / capped / tier, from the book (+ activeBetModeKey)
game/names.ts             GAME_TITLE, MODE_TITLE, FEATURE, MECHANIC, SYMBOL_NAME, CHARACTER  (the only place words live)
game/typesBookEvent.ts    SDK events + contract §8 custom events (backdraft, alarmCall, rescueStart, douse, buildingCleared,
                          rescueEnd, backdraftSpinsStart/End) + freeSpinTrigger / updateFreeSpin / freeSpinEnd
game/bookEventHandlerMap.ts  thin handlers; features route to game/rescue/rescueDirector.ts
game/rescue/stateRescue.svelte.ts  stateRescue (rooms, multiplier, building, spins, total, banner, capped, skip),
                          stateBackdraftSpins, stateAlarmCall, featureOwnsInput()
game/rescue/rescueDirector.ts  the feature flow (single writer of the state above and of stateScene.mood)
game/utils.ts             isFeatureRound (multi-reveal OR freeSpinTrigger/rescueStart/alarmCall/backdraftSpinsStart),
                          convertTorResumableBet (rewinds a mid-bonus resume to its start event / its freeSpinTrigger / its alarmCall)
game/actor.ts             onNewGameStart -> teardownFeature()
game/stateGame.svelte.ts  reels + sceneLayout (reserves BUILDING_BAND_CELLS above the frame while the Rescue scene is up)
game/rulesContent.ts      rules sheet (CONTRACT fixed figures, MEASURED = null until §9 → those sentences are omitted,
                          modes in ascending price, verbatim disclaimer)
hud.config.ts             HUD seam (6 modes, 4 buy cards + ante, copySubs, ownsInput, modalOpen, boardGeometry, symbolCss)
components/Game.svelte    Background | BoardFrame | RescueScene | Board, Anticipations, Paylines, BoardFx, BackdraftFx, LinePop |
                          Win | WinRungs | AlarmCallCard | SceneShutter
components/splash/copy.ts SPLASH_DECK (6 cards), FALLBACK copy (figures from config / CONTRACT), SPLASH_LOADING
```

## 3. Event flow (contract §4-§8)

Base / ante spin: `reveal` (reels land on the book board; `paylinesClear`) → [`backdraft` → BackdraftFx flash + flame
sweep left→right, each booked cell ignites into a Blaze Wild as the front passes (`rescueDirector.igniteCell`, re-applied
after the picture so the board is always the book's)] → `winInfo` (per win in book order: `paylineShow` path through
the cell centres from `config.paylines[lineIndex-1]`, `symbolWinFx`, `linePop` amount (× tag when `meta.multiplier` > 1),
await `boardWithAnimateSymbols` — every winning symbol completes — `paylineHide`; then `paylinesAll` for >1 win, a
bounded beat) → `setWin` (contract §8: round tier 0 = the win figure only, tier 1 = figure + small stinger, tier ≥ 2 =
WinRungs; `animBeat winTier`) → `setTotalWin` (HUD meter roll) → `finalWin`. A spin whose round continues into a bonus
(a later `freeSpinTrigger` / `rescueStart` / …) and every per-spin `setWin` inside a bonus get the ordinary figure only;
line jingles and symbol win sounds are silent on a tier-0 round.

Natural trigger: `… setTotalWin` → `freeSpinTrigger` (alarm cells ring left→right + their win motion, fanfare) →
`rescueStart` (bay door closes with the intro card; under cover: rooms from the event, multiplier, spins, mood
rescue/inferno, gameType freegame, `claimWin('rescue')`, `setFeatureSpins(spins)`, the layout reserves the building band;
card press or 6 s (1.4 s autoplay/turbo) → door opens). Per bonus spin: `updateFreeSpin` (counter = total − amount) →
`reveal` → `douse` (sprays lower room fire with a flash, rescues mark rooms SAFE + Inferno prize on the sill, banner,
multiplier badge, `+N SPINS`, counter = `spinsLeft`) → [`buildingCleared` banner, rooms relit, building+1] → `winInfo` /
`setWin` → `setTotalWin` (scene TOTAL). End: `rescueEnd` (COMPLETE banner, counter to 0, the book's rescued / buildings / multiplier kept for the card) →
`freeSpinEnd` (roundTier of the round total at the charged cost: `animBeat winTier`, WinRungs from BIG, the tier-sized
`rescue_/inferno_total_*` stinger, none at tier 0; door closes with the outro card showing the round MULTIPLE; under cover: scene off,
mood base, `releaseWin`, `setFeatureSpins(null)`; door opens) → `finalWin`.

Bought Rescue / Inferno: `rescueStart` first (reels streaming from the press are parked under the door). Alarm Call:
`alarmCall` → AlarmCallCard (rings, turns to the booked outcome, holds the HUD press gate, press or timeout) → either
`rescueStart {source: alarmCall}` … or `setTotalWin 0` → `finalWin 0`. Backdraft Spins: `backdraftSpinsStart`
(header plate on the frame, `claimWin('backdraftSpins')`, counter 5) → 5 × (`reveal` → `backdraft` → wins →
`updateFreeSpin` → `setTotalWin`) → `backdraftSpinsEnd` (roundTier: rungs from BIG, release) → `finalWin`.

Cap: `wincap` sets `stateRescue.capped` and zeroes the spins counter; a capped spin's `setWin` inside a feature gets the
ordinary figure (the feature end climbs to MAX once, with the capped round total).

Bay door (`SceneShutter`): every close / open / reset takes a run token and a superseded run never writes card /
mounted / covered / the press gate; `open()` is idempotent; the self-lift failsafe runs only while the door is idle
shut and is measured on the door's own clamped frame clock from the moment it FINISHED closing. The directors race every
door broadcast against a 45 s bound (then `shutterReset`), so an unattended round cannot hang on the door. A press on
a card that arrives before the director waits on it is latched; a stop press with no card up is `skipFeature()`.

Resume: the snapshot keeps `setTotalWin`, `reveal` and `backdraft`; `createBonusSnapshot` settles the last reveal's
board (+ its Blaze Wilds) before the rewound `freeSpinTrigger` rings the alarms. HUD: `ownsInput` while a feature or the door owns the play area;
`modalOpen` while PlayNotice or the Alarm Call card is up.

## 4. Placeholder inventory (what the art lane must deliver)

All under `apps/piggy_firefighters/static/assets/placeholder/`, generated by `tools/placeholder/make_placeholders.py`
(Pillow, theme palette, deterministic). Replace FILES in place (same path, size, framing); asset keys never change.

| Path | Size | Key / consumer | Deliver |
|---|---|---|---|
| `symbols/{h1..h4,l1..l4}.webp` | 384×384 RGBA, ~0.068 pad | `sym_H1..sym_L4` (reels, rules pay grid via hud `symbolCss`) | final symbol tiles (theme §3); optional 384×500 portrait `symT_*` and pose-B `sym_*_b` (register in `game/assets.ts`) |
| `symbols/w.webp` | 384×384 | `sym_W` | Chief Hamm WILD; the WILD badge must stay at `symbolMotion.WILD_BANNER.square` (x 62, y 204, w 262, h 98) or update that rect |
| `symbols/w_blaze.webp` | 384×384 | `sym_W_BLAZE` | Blaze Wild (W on fire) |
| `symbols/alarm.webp`, `galarm.webp` | 384×384 | `sym_ALARM`, `sym_GALARM` | Fire Alarm / Golden Alarm (+ tall anticipation tiles if wanted) |
| `fx/cell_frame.webp` | 384×384, 100 px corner nine-slice | `win_cell_frame` (SymbolSprite, Anticipation) | win / anticipation frame |
| `fx/glint_4point.webp`, `flare_horizontal.webp` (1024×128), `ring_shockwave.webp` (512) | | `rung_fx_*` | FX sprites |
| `rungs/sign_{big,huge,mega,epic,max}.webp` | 1200×728 (board ~y 338, amount plank y 634, 820 wide) | `rung_sign_*` (WinRungs) | firefighting rung signs (theme §5) |
| `rungs/piece_{coin,ember,droplet,badge}_sheet.webp` | 1024×384 = 8×3 cells of 128 | `rung_piece_*` | tumbling pieces |
| `rungs/maxwin_card_{landscape 1600×900, portrait 900×1400}.webp` | | `maxwin_card_*` | title-free max-win art (sky left / top for runtime words) |
| `coins/coin_sheet.{webp,json}` | 1024×512, 32 frames of 128, animation `coin` | `coins` (WinCoins) | coin/badge fountain sheet |
| `scene/bg_{base,rescue,inferno}_{landscape 2048×1024, portrait 1080×1920}.webp` | | `bg_*` (Background, cover-fit) | Station 13 dusk / block at night / red sky (+ ambient life later) |
| `scene/shutter_slats_tile.webp` 1024×512 tileable, `shutter_bottom_bar.webp` 1024×115 | | `scene_shutter_*` (SceneShutter) + splash copies in `splash/` | bay door |
| `scene/card_{rescue,inferno,backdraft,alarm}.webp` | 768×768, no text | `scene_card_*` (door intro card, Alarm Call card) | mode-card art |
| `splash/card_{chief,lines,backdraft,alarm,rescue,maxwin}.webp` | 768×768, no text | SplashDeck (manifest `splash/manifest.json`, mirrored in `static/assets/splash/manifest.json`) | splash deck, payload ≤ 1.2 MB |
| `branding/wordmark.png` | 1366×654 RGBA | Splash | wordmark |
| `buycards/{ante,backdraft-spins,alarm-call,rescue,inferno}.webp` | 768×512, subject in the middle 4:1 band, no text | HUD `betModeArt` | buy-card plates |

Not placeholders in pixels but placeholder PICTURES in code (replace the drawing, keep the state): `BoardFrame.svelte`
(truck panel), `rescue/RescueScene.svelte` (block, rooms, badge, banner, Backdraft Spins plate), `BackdraftFx.svelte`
(flash, flames, embers), `AlarmCallCard.svelte`, `Paylines.svelte` (line strokes + number plates), BoardFx bursts.

## 5. Dev fixtures

`server/fixtures/*.json` + `index.json`, written by `tools/fixtures/make_fixtures.py` (deterministic; costs = the frozen
MODE_COSTS; event order, binary `anticipation`, `reelSet` and the credited-amount `setWin.winLevel` as the math's
`game_events.py` / `game_executables.py`). `FIXTURES_DIR=server/fixtures_m1` serves the math lane's M1 books instead. Line wins are
EVALUATED from the boards with the contract rules; bonuses are SIMULATED from their boards (douse / rescue / multiplier /
spins / prizes, cap clipping per v1.1 §6); boards are chosen, not drawn — dev books, not math books. Fixtures:
`base_nowin`, `base_win` (2 lines), `base_backdraft_win`, `ante_win` (ALARM BOOST, 0.6x on a 1.5x stake: tier 0), `base_trigger_rescue` (3 ALARM, 10+1 spins, one rescue),
`base_trigger_inferno` (GALARM, prizes), `rescue_buy` (a building cleared), `inferno_buy`, `alarm_call_rescue`,
`alarm_call_false`, `backdraft_spins` (multiplier Blaze Wilds, v1.1 §7), `max_win` (natural Inferno to the 15,000x cap).
Run: `PORT=3036 BOOKS_DIR=none node server/mock-rgs.mjs`, then `…?sessionID=local&rgs_url=127.0.0.1:3036&device=desktop&fixture=<name>`.
Smoke: `node qa/smoke/port/smoke.mjs [fixtures]` (screenshots + `results.json` in `qa/smoke/port/`; a warm-up load
first, one session per fixture so an open round is never resumed by mistake, pass = booked payout + 0 console errors +
the contract §8 rung levels per fixture, recorded through the DEV hook `window.__pffRungs`). Door regression:
`node qa/smoke/port/shutter_race.mjs` (a 13 s main-thread stall during the lift; the next close must settle).
Gate (no browser): `node qa/gate/run.mjs` = mode costs vs the math, the §8 tier table, every cue id vs the manifest,
padding vs the reel CSVs.
Under SwiftShader a bonus fixture takes minutes (max_win ≈ 6.5 min even in turbo).

## 6. Open items

- `rulesContent.MEASURED` frequencies are `null` (their sentences are omitted from the sheet): fill from the published
  books with provenance comments (contract §9); RTP prints the contract's 96.70% until measured.
- Costs come from the frozen `MODE_COSTS`; when `math/publish/index.json` lands, `qa/gate/check_mode_costs.mjs` switches
  to it automatically and fails on any byte difference.
- `paddingFor` still picks the padding set from gameType + mode + bonus, not from the reveal's `reelSet` (the strips
  themselves are now the real CSVs).
- Donor art directories still on disk under `static/assets/` (branding, buycards, environment, features, maxwin, splash
  loose files, sprites, ui_scene, winrungs) — some now hold art-lane deliveries; whatever the app does not reference must
  be deleted or excluded before upload (art / coordinator decision). The empty `ambient`, `build`, `hat3d` dirs and the
  dead `.eslintrc.cjs` are gone.
- Placeholder art (art lane): the WILD placeholder helmet should read as a fire helmet with a long rear brim; the
  bay-door bottom rail is now a red / chrome / brass sill with reflective tape (no hazard chevrons).
  `static/assets/splash/shutter_bottom_bar.webp` (art lane) is not wired; the app serves `placeholder/`.
- `animBeat winTier` is emitted (base setWin, feature ends); the other ANIMATION_CONTRACT beats and RigStage slots are
  the rig lane's Phase B.
- The /rigs route is still moved out by `tools/build_dist.sh` (now `flock`ed; dev watcher ignores `build/**`); an env
  flag in the rig lane's route would avoid the move.
- No portrait `symT_*` tiles / pose-B art registered yet; `fx_transition` FX rig optional.
- `tsconfig.json` extends the generated `.svelte-kit/tsconfig.json` (needs a `svelte-kit sync` / dev run first). Residual
  svelte-check error: `packages/envs` (`$env/static/public`) — a workspace package, outside the app.
- `packages/pixi-svelte` must be built once (`pnpm --filter pixi-svelte build`) before dev / build / svelte-check.

## 7. Fix round after the port review (2026-09-25)

Blockers / majors fixed: bet-mode costs 12/18/50/90 in ascending order (config, fixtures, comments, gate); the bay-door
failsafe race (run tokens, idempotent open, idle-only frame-clock failsafe, bounded director waits, regression
`shutter_race.mjs`); contract §8 tier rule (`roundTier` / `roundStake`, no SDK `winLevel`, rungs once on the round total,
no stinger at tier 0, `animBeat winTier`); per-spin bonus wins and trigger-spin wins get the ordinary figure only; rules
copy per contract v1.2.1 / audit F (WILD placement, Backdraft scope, modes by price, splash "every paying symbol");
the audio seam renamed to the delivered ids (`alarmLand`/`galarmLand`/`wildLand`/`linesWin`, `ui_click_1`,
`base_loop_a/b`, `antic_miss`, the feature cues of docs/AUDIO_MAP.md; Build-or-Bust bridge and donor comments removed;
trigger fanfare once per round; escalation keyed to 3 alarms; `qa/gate/check_cue_ids.mjs`); resume restores the trigger
board. Minors: fixture generator aligned with the math + `ante_win`; mock RGS feature detection; dead-spin cue counts the
book's alarms; outro card prints the book's `rescueEnd`; counter zeroed on cap / end; stop press during a feature skips
holds; early card press latched; placeholder sill repainted; build lock + watcher ignore; stale comments.
