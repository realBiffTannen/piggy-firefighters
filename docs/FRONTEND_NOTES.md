# PIGGY FIREFIGHTERS — frontend notes (base-game port, 2026-09-25)

Scope of this pass: the donor engine (LUCKY, `/home/user/lucky/apps/lucky`, read-only) ported into
`apps/piggy_firefighters` so a real round plays end to end against the mock RGS, for every mode of
`docs/GAME_CONTRACT.md` (v1.1). Pictures are PROCEDURAL PLACEHOLDERS; later lanes replace visuals only (Rescue /
Inferno scene art, Alarm Call card, Backdraft Spins polish, win-rung re-skin, audio, real art). The flow, the state and
the event contract below are what they build on.

## 1. What was ported, what changed

| Area | Status |
|---|---|
| Boot (`app.html`, `+layout.svelte`, hooks, bumper, splash hand-off, HUD mount, NoSelect, PlayNotice, ModalError) | kept; titles `PIGGY FIREFIGHTERS`, mute key `piggy-firefighters-muted` (layout bumper + `game/audio/audioManager.ts` GAME_ID), sign font renamed `StationSign` (Alfa Slab One), AnteConfirm dropped |
| Core state (`stateApp/Xstate/Layout/context/eventEmitter/types/stateNotice/replayLaunch/devFixture/prewarm/money/socialFloor/winLevelMap/generatedConfig`) | kept; QA flag `__LUCKY_QA` → `__PFF_QA` |
| Reels (`game/reels/*`, `components/reels/*`) | kept; `spinReels` LEGEND for the new ids, `paddingFor` picks basegame / antegame / backdraftgame / freegame / infernogame from the reveal's `gameType` + bonus (getter wired from `stateGame`, no import cycle) |
| Board / symbols (`Board*`, `ReelSymbol`, `Symbol`, `SymbolSprite`, `symbolMotion`, `Anticipation(s)`, `BoardFx`) | kept; ALARM/GALARM replace the donor scatters, L4 added, trigger count 3 (`constants.TRIGGER_ALARMS`), Blaze Wild via client-only `RawSymbol.blaze` → `sym_W_BLAZE` |
| Win presentation (`Win`, `WinCoins`, `WinRungs`, `roundTier`) | kept; `WIN_CAP_X = 15000`, rungs BIG → HUGE → MEGA → EPIC → MAX on placeholder signs/pieces |
| Scene (`SceneShutter` = Station 13 bay door, `TransitionFx`, `stateScene` moods base/rescue/inferno) | kept, re-pointed at placeholders; the optional Spine FX rig key is `fx_transition` (not registered yet, so every open is the three-haul lift) |
| Hold & Build (all of `components/build/*`, `game/build/*directors*`, houses, hats, gust/delivery, wolf/crate, FeatureDrops, Hat3D, WildSymbol, rigs route, prizes, mascotEvents, AmbientWorld) | DELETED |
| Generic kit (`buildTiming`, `pixiKit`, `motion`, `sceneTextures`, `stateScene`, `signPanel`, `audioDirector`) | moved to `game/fx/` (`buildTiming` → `fx/timing.ts`); `audioDirector` rewritten as the feature audio seam (firstCue fallbacks, silent until the audio lane ships cues) |
| NEW | `components/Paylines.svelte`, `LinePop.svelte`, `BackdraftFx.svelte`, `AlarmCallCard.svelte`, `rescue/RescueScene.svelte`, `game/rescue/{stateRescue.svelte,rescueDirector}.ts`, `game/format.ts`, `eslint.config.js` (flat config; the donor `.eslintrc.cjs` could not load under ESLint 9) |

## 2. File map (src/)

```
game/config.ts            gameID, 6 bet modes, 20 paylines (1-based lineIndex = index+1), paytable, padding strips (TODO math CSVs)
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
game/rulesContent.ts      rules sheet (CONTRACT fixed figures, MEASURED TODO placeholders, verbatim disclaimer)
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
bounded beat) → `setWin` (Win overlay < BIG, WinRungs ≥ BIG) → `setTotalWin` (HUD meter roll) → `finalWin`.

Natural trigger: `… setTotalWin` → `freeSpinTrigger` (alarm cells ring left→right + their win motion, fanfare) →
`rescueStart` (bay door closes with the intro card; under cover: rooms from the event, multiplier, spins, mood
rescue/inferno, gameType freegame, `claimWin('rescue')`, `setFeatureSpins(spins)`, the layout reserves the building band;
card press or 6 s (1.4 s autoplay/turbo) → door opens). Per bonus spin: `updateFreeSpin` (counter = total − amount) →
`reveal` → `douse` (sprays lower room fire with a flash, rescues mark rooms SAFE + Inferno prize on the sill, banner,
multiplier badge, `+N SPINS`, counter = `spinsLeft`) → [`buildingCleared` banner, rooms relit, building+1] → `winInfo` /
`setWin` → `setTotalWin` (scene TOTAL). End: `rescueEnd` (COMPLETE banner) → `freeSpinEnd` (WinRungs `endFeature` at
`roundCelebrationLevel` when ≥ BIG; door closes with the outro card showing the round MULTIPLE; under cover: scene off,
mood base, `releaseWin`, `setFeatureSpins(null)`; door opens) → `finalWin`.

Bought Rescue / Inferno: `rescueStart` first (reels streaming from the press are parked under the door). Alarm Call:
`alarmCall` → AlarmCallCard (rings, turns to the booked outcome, holds the HUD press gate, press or timeout) → either
`rescueStart {source: alarmCall}` … or `setTotalWin 0` → `finalWin 0`. Backdraft Spins: `backdraftSpinsStart`
(header plate on the frame, `claimWin('backdraftSpins')`, counter 5) → 5 × (`reveal` → `backdraft` → wins →
`updateFreeSpin` → `setTotalWin`) → `backdraftSpinsEnd` (rungs if ≥ BIG, release) → `finalWin`.

Cap: `wincap` sets `stateRescue.capped`; a capped spin's `setWin` inside a feature is not celebrated (the feature end
climbs to MAX once, with the capped round total). HUD: `ownsInput` while a feature or the door owns the play area;
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

`server/fixtures/*.json` + `index.json`, written by `tools/fixtures/make_fixtures.py` (deterministic). Line wins are
EVALUATED from the boards with the contract rules; bonuses are SIMULATED from their boards (douse / rescue / multiplier /
spins / prizes, cap clipping per v1.1 §6); boards are chosen, not drawn — dev books, not math books. Fixtures:
`base_nowin`, `base_win` (2 lines), `base_backdraft_win`, `base_trigger_rescue` (3 ALARM, 10+1 spins, one rescue),
`base_trigger_inferno` (GALARM, prizes), `rescue_buy` (a building cleared), `inferno_buy`, `alarm_call_rescue`,
`alarm_call_false`, `backdraft_spins` (multiplier Blaze Wilds, v1.1 §7), `max_win` (natural Inferno to the 15,000x cap).
Run: `PORT=3036 BOOKS_DIR=none node server/mock-rgs.mjs`, then `…?sessionID=local&rgs_url=127.0.0.1:3036&device=desktop&fixture=<name>`.
Smoke: `node qa/smoke/port/smoke.mjs [fixtures]` (screenshots + `results.json` in `qa/smoke/port/`).

## 6. Open items

- Padding strips in `config.ts` are placeholders: replace from `math/games/piggy_firefighters/reels/{BR0,BRA,BRB,FR0,FRI}.csv`.
- `rulesContent.MEASURED` are `MEASURED TODO` strings: fill from the published books with provenance comments (contract §9).
- Donor art directories still on disk under `static/assets/` (ambient, branding, build, buycards, environment, features,
  hat3d, maxwin, spine, splash/*.webp, sprites, ui_scene, winrungs) are UNREFERENCED by the app but SvelteKit copies
  `static/` into the build: they must be deleted (or excluded by the build) before any upload. Deleting them was not
  permitted in this lane's session.
- Audio: `static/assets/audio/lucky/*` and `game/audio/cueManifest.ts` are the audio lane's (donor cues still referenced).
- No portrait `symT_*` tiles / pose-B art / Spine rigs registered yet; `fx_transition` FX rig optional.
- Contract v1.1 leftovers (coordinator task list "Phase B"): per-room Trotter skin rotation art, RigStage slots,
  `animBeat` emission per ANIMATION_CONTRACT v1.1.
- `.eslintrc.cjs` (donor) is now dead (flat `eslint.config.js` wins); remove when convenient.
