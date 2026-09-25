# PIGGY FIREFIGHTERS — frontend notes (base-game port, 2026-09-25)

Scope of this pass: the donor engine (LUCKY, `/home/user/lucky/apps/lucky`, read-only) ported into
`apps/piggy_firefighters` so a real round plays end to end against the mock RGS, for every mode of
`docs/GAME_CONTRACT.md` (v1.2.2 since the fix round of §7). Phase B (§8) switched every picture to the art lane's
delivered files, mounted Codex's rig slots and wired the `animBeat` contract; the flow, the state and the event contract
below are what everything builds on.

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

## 4. Delivered asset map (key -> file -> consumer)

Every file is the art lane's (tools/art/derive_*.py, provenance in art-src/generated/source-record.json), registered in
`game/assets.ts` (symbols, coins, font, Codex's `rigAssets`) and `game/assetsScene.ts` (everything else). Geometry a
component needs is read from the meta JSON beside the art through `game/artMeta.ts` (`artMeta.generated.ts`, written by
`tools/art/gen_art_meta.mjs` because Vite refuses module imports from static/; `qa/gate` fails when it drifts). No
`placeholder/` directory or tool exists any more.

| Key(s) | File (static/assets/) | Consumer |
|---|---|---|
| `sym_H1..sym_L4`, `sym_W`, `sym_ALARM`, `sym_GALARM` | `sprites/symbolsCartoon/sym_<ID>.webp` 384x384 | reels (SymbolSprite via constants SYMBOL_INFO_MAP), rules pay grid (hud.config `symbolCss`, same dir) |
| `sym_H1_b..sym_H4_b`, `sym_W_b` | `sprites/symbolsCartoon/sym_<ID>_b.webp` | SymbolSprite pose-B cut inside the high symbols' win (symbolMotion `poseBKey`); `sym_W_b` registered, the WILD win stays the punch |
| `sym_W_BLAZE` | `sprites/symbolsCartoon/sym_W_blaze.webp` | a Blaze Wild cell (RawSymbol.blaze, BLAZE_SYMBOL_INFO) |
| `symT_*` (same 17) | `sprites/symbolsCartoonTall/symT_<ID>.webp` 384x500 | SymbolSprite on stacked layouts (`sceneLayout().stacked`), incl. tall pose B |
| WILD badge rects | `sprites/symbolsCartoon*/manifest.json` `wild_badge` | `symbolMotion.WILD_BANNER` (square 120,209,143,129 / tall 123,242,137,142), SymbolSprite `SIGN`, BoardFx banner crop; `artMeta.WILD_BADGE` |
| `coins` | `winrungs/coins/coin_sheet.{json,webp}` 32 frames | WinCoins fountain |
| `goldFont` | `fonts/interGold/interGold.{xml,png}` (this title's brass build, tools/art/make_inter_gold_font.py) | Win, LinePop, WinRungs (`fontFamily: 'gold'`) |
| `bg_{base,backdraft,rescue,inferno}_{landscape,portrait}` | `environment/<mood>_{landscape 2039x1000, portrait 1242x2208}.webp` | Background (cover-fit; `stateScene.mood`, Backdraft Spins cross-fades to `backdraft`) |
| `scene_shutter_slats`, `scene_shutter_bar` | `splash/shutter_slats_tile.webp` 1024x512, `splash/shutter_bottom_bar.webp` 1024x115 | SceneShutter (the same files the DOM splash hand-off tiles) |
| `wordmark_small` | `branding/wordmark_small.webp` 683x327 | the stencil on the in-game bay door (SceneShutter) and on the splash's DOM door (Splash.svelte `stencilSrc`) |
| (DOM) | `branding/wordmark.png` 1366x654 | Splash wordmark |
| (DOM) | `splash/card_{chief,lines,backdraft,alarm,rescue,maxwin}.webp` 768x768 (`splash/manifest.json`) | SplashDeck (splash/copy.ts SPLASH_DECK, `splashAssetUrl`) |
| `scene_card_rescue`, `scene_card_alarm`, `scene_card_backdraft` | `splash/card_rescue.webp`, `card_alarm.webp`, `card_backdraft.webp` | SceneShutter intro card art, AlarmCallCard |
| `scene_card_inferno` | `buycards/inferno.webp` 768x512 (cover-fitted into the square frame) | SceneShutter Inferno intro card |
| (HUD) | `buycards/{ante,alarm-call,rescue,backdraft-spins,inferno}.webp` 768x512 | hud.config `assets.buyCardDir` + `betModeArt` |
| `board_frame` | `ui_scene/board_frame.webp` 1497x946 + `frame.meta.json` (opening 212..1279 x 178..761, rail period 241) | BoardFrame: four corner blocks + top rail tiled in whole periods + plain rails/posts + brass mid plates; the layout reserves the plate's own proportions (stateGame FRAME_OUT_*) |
| `cell_backplate` | `ui_scene/cell_backplate.webp` 963x645 | BoardFrame nine-slice behind the reels |
| `cell_frame_plain`, `cell_frame_locked`, `win_cell_frame` | `ui_scene/cell_frame_{plain,locked,win}.webp` 384x384 + `cells.meta.json` (hole rects -> nine-slice corner) | BoardFrame (plain on every cell, locked on Blaze cells), SymbolSprite win frame, Anticipation column frame |
| `line_plate` | `ui_scene/line_plate.webp` 307x291 | Paylines line-number plate (number on the cream field, `LINE_PLATE.textY`) |
| `rung_sign_{big,huge,mega,epic,max}` | `winrungs/signs/<rung>.webp` 1200x728 + `flat_manifest.json` (board / plank centres) | WinRungs sign + amount plank |
| `rung_piece_{coin,silver_coin,ember,spark,droplet,badge,helmet,boot,nozzle,hydrant_cap}` | `winrungs/pieces/<name>_sheet.webp` 1024x384 (24 frames of 128) | WinRungs tumbling pieces (PIECES per rung) |
| `rung_fx_{flare_horizontal,ring_shockwave,glint_4point,dust_puff,light_ray_wedge}` | `winrungs/fx/*.webp` | WinRungs flare / ring, SymbolSprite + BoardFx glint (dust / ray registered for FX use) |
| `maxwin_card_{landscape,portrait}` | `maxwin/max_win_card_{16x9 1600x900, portrait 900x1400}.webp` + `manifest.json` `titleSafeArea` | WinRungs MAX WIN card (title + multiple inside the safe area) |
| `rescue_facade`, `rescue_facade_inferno` | `features/rescue/block_facade{,_inferno}.webp` 1298x376 | RescueScene band above the frame (one reel column per `rooms.meta.json pitch_px`) |
| `rescue_room_<r>_<state>` (5 x 6) | `features/rescue/room_<r>_{roaring,smouldering,safe,inferno_*}.webp` ~234x390 at `box_in_facade` | RescueScene room per reel; fire level 2 / 1 / 0 (contract §5) picks the state |
| `rescue_ladder_segment`, `rescue_ladder_top` | `features/rescue/ladder_segment.webp` 299x530 (rung period 176.8), `ladder_top.webp` | RescueScene ladder from the truck to the block (wide layouts) |
| `rescue_hose_segment`, `rescue_hose_nozzle` | `features/rescue/hose_segment.webp` (tiles), `hose_nozzle.webp` | RescueScene hose + nozzle (hidden while the chief rig sprays) |
| `rescue_water_jet`, `rescue_water_splash`, `rescue_steam_puff` | `features/rescue/water_jet.webp`, `water_splash.webp`, `steam_puff.webp` | RescueScene douse FX (jet from the nozzle tip to the window, splash, steam where a fire goes out) with `hose_start/loop/end`, `steam` |
| `rescue_badge_blank` | `features/rescue/badge_blank.webp` 341x335 | RescueScene multiplier badge, BackdraftFx Blaze multiplier badge, Mascots `sign_hit` plate, the procedural rescued tag |
| `rescue_spins_plate` | `features/rescue/spins_plate_blank.webp` 567x216 | RescueScene BUILDING / TOTAL plates, the Backdraft Spins header plate, the feature banner |
| `rescue_jump_sheet` | `features/rescue/jump_sheet.webp` 716x389 | RescueScene sheet at the ladder foot (stacked: under the rescued window) |
| `pf_chief`, `pf_rookie`, `pf_dog`, `pf_rescued` | `spine/<rig>/<rig>.{json,atlas}` (Codex; absent today) | Codex's `rigAssets` (registered only when the export exists) -> RigStage slots (§8) |

Still code-drawn by design (the runtime's own FX per the animation contract): BackdraftFx flames / embers, BoardFx
symbol bursts and idle glint, Anticipation wash / sparks, the signPanel card boards, the Alarm Call card frame.

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
- `static/assets/hud/*.svg` are still byte-identical to LUCKY's (ART_REPORT §M): the HUD package's icons, to be
  replaced by originals before upload (HUD lane).
- Rig exports are absent (Codex): every RigStage slot is mounted and draws nothing; the procedural fallbacks play. The
  `sign_hit` plate, the rig-driven nozzle tip and the sheet catch are wired but unexercised until an export lands.
- Codex's `RigStage` takes its slot as a prop named `slot`; a literal `slot="…"` attribute on a component tag is
  Svelte's named-slot syntax (the compiler hands the child to the parent's `$$slots`, never to the component), so every
  mount passes it as a spread prop `{...{ slot: 'mascotLeft' as const }}`. A prop rename on Codex's side would remove
  the trap (request posted).
- The /rigs route is still moved out by `tools/build_dist.sh` (`flock`ed; dev watcher ignores `build/**`); an env
  flag in the rig lane's route would avoid the move.
- `fx_transition` FX rig optional (SceneShutter blast reveal stays dormant without it).
- `tsconfig.json` extends the generated `.svelte-kit/tsconfig.json` (needs a `svelte-kit sync` / dev run first). Residual
  svelte-check error: `packages/envs` (`$env/static/public`) — a workspace package, outside the app.
- `packages/pixi-svelte` must be built once (`pnpm --filter pixi-svelte build`) before dev / build / svelte-check.
- `server/fixtures_m1/index.json` lists 16 books (the brief said 17); `qa/smoke/port/smoke.mjs` runs whatever the index
  holds.

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

## 8. Phase B integration (2026-09-25)

**Delivered art everywhere (§4).** `static/assets/placeholder/` and `tools/placeholder/` are gone; no source, tool or
manifest references them (`grep -rn placeholder apps/piggy_firefighters/src tools qa server` finds only the two
unrelated words "loader GIFs" / "placeholders" in prose). The registry (`assets.ts`, `assetsScene.ts`) points at the
art lane's families; `hud.config.ts` serves the same symbol tiles to the rules pay grid and the delivered feature-buy
plates to the HUD; the splash deck, wordmark and door tiles come from `splash/` and `branding/`. New: pose-B keys
(`sym_*_b`, tall too) so the high symbols cut to their key pose in both sheets; the portrait `symT_*` sheet on stacked
layouts (incl. `symT_W_BLAZE`); `symbolMotion.WILD_BANNER` / SymbolSprite `SIGN` at the measured badge rects; the
Backdraft Spins world plate (`environment/backdraft_*`, mood `backdraft`, cross-faded in place by Background because
that feature has no door); the reel frame assembled from the plate's corners and tiled rails (BoardFrame, geometry
from `frame.meta.json`; the layout's FRAME_OUT_* are the plate's own proportions, post 0.5 cell desktop / 0.34
stacked, so the board gives up ~8 % height for a real truck panel), the riveted backplate and a plain cell frame per
cell (nine-slice), the red `locked` frame on Blaze Wild cells; the brass line plate on every winning line; the
delivered signs / pieces / max-win cards in WinRungs (plank and title-area geometry from the manifests); the Rescue
scene rebuilt on the facade band + per-room state sprites, ladder, hose + nozzle, water jet / splash / steam on douse,
blank badge and plates lettered at runtime, the jump sheet, and the Alarm Call card on the dispatch painting. Phones:
no gutter, so the rescued jump from the sill into the sheet held under their window instead of sliding a ladder.

**Rig runtime wiring (docs/ANIMATION_CONTRACT.md v1.1-v1.3).** `rigAssets` is spread into `assets.ts` (an entry
exists only where an export exists; none today, so no request and no error). `RigStage` is mounted, unconditionally,
at every slot: `mascotLeft` / `mascotRight` (components/Mascots.svelte, the gutters beside the frame or the ground
under it on phones), `cardPresenter` (SceneShutter intro cards, AlarmCallCard), `rescueRoom` x5 + `ladder` (path in
slot coordinates: ladder top -> sheet, or sill -> sheet on phones) + `sheet` (RescueScene), `winPlate` (WinRungs,
visible from tier 2). Fallback pictures are gated on `rigRegistry.has(rig)` only (the procedural rescued tag, the prop
hose / nozzle). Every beat of the contract table is broadcast through `eventEmitter` as `animBeat`
(game/fx/animBeats.ts): `spinStart` (reveal), `reelStop` / `alarmLand` (stateGame reel callbacks; `onSymbolLand` now
carries reel + 0-based row), `anticipationStart` / `anticipationEnd {hit}` (Anticipation), `lineWin` (winInfo),
`winTier` (setWin / feature ends), `maxWin` (tier 6), `backdraft`, `rescueEnter`, `douse` + one `rescue` per room
(skin = Codex's `rescuedSkin(room, building - 1)`), `buildingCleared`, `rescueExit`, `alarmCall` (as the card turns),
`bigWinStart` / `bigWinEnd` (WinRungs), `idle` every 10 s of a resting board and `reducedMotion` (game/fx/beatClock.ts),
`speedTier` (applySpeedTier). Amounts are bet multiples. Epochs: `animBeats` wraps Codex's `createPlaybackEpoch`; a new
round (teardownFeature), a stop / skip (skipFeature) and every deferred emission capture the epoch, so beats from a
skipped, turbo-collapsed or resumed round are dropped (`rescue` beats after a collapsed douse, the anticipation end).
`sign_hit` (v1.3): the rig's Spine event reaches components/Mascots.svelte through `onrigEvent` with the `head_top`
anchor; the runtime-owned plate (the blank brass badge lettered with the word the chief is acting on: "ALARM!", the
rung name, "MAX WIN!", "NICE SAVE!") pops there for 720 ms. `spray_on` / `spray_off` publish the chief's `nozzle_tip`
(game/fx/stateRig.svelte.ts) and the Rescue scene starts its water jet from it, hiding the prop hose. The procedural
slide calls Codex's `landingBus.publish()` on its actual arrival, so mounted sheet rigs still catch. With no export on
disk the game runs exactly as before: 0 console errors, no broken texture (captures below).

**Audio durations.** No presentation literal is tied to a cue any more: the base-bed swap reads the CURRENT bed's
`CUES[id].durationMs` (presentationDirector, two passes), the trigger-fanfare duck holds for the fanfare's authored
length (audio/index.ts), the bonus-entry duck for the flourish's opening (presentationDirector). The douse cues moved
from the director's book loop to the visible spray: `hose_start` + `hose_loop` when the jet leaves the nozzle,
`hose_end` when it ends, `steam` where a fire goes out (audioDirector.sprayStart / sprayEnd / steam). `audioManager.ts`
and `cueManifest.ts` untouched.

**Font.** `static/assets/fonts/interGold/*` was LUCKY's build (byte-identical to the donor). It is now this title's:
`tools/art/make_inter_gold_font.py` (adapted from the donor tool, reference only) rebuilds it from
`InterVariable.woff2` in the brass palette (ink #3B2313, face #E3AE3C, band #F5D26A, side #B8862B), same 113 glyphs,
em 184, line height 266 / base 194, family `gold`; win numbers, line pops and the rung plank render unchanged
(specimen `qa/art/interGold_specimen.png`; the WinRungs GOLD_INK_DY offset still holds).

**Smoke / captures.** `qa/smoke/port/smoke.mjs` now takes `FIXTURES_DIR` (the set the mock serves), `ALL_FIXTURES=1`
(the whole index) and `OUT_DIR`; the booked payout comes from the index row or the book itself (the M1 index has
none) and the expected rung from the contract §8 rule at the fixture's mode cost (the former hand table is gone).
`qa/phaseb/capture.mjs` captures splash / base / a base win / the buy sheet / Backdraft / Rescue (spray + rescue) /
Inferno / Alarm Call / an EPIC rung / MAX WIN in 1280x720 and 390x844 under `qa/phaseb/captures/` (gitignored PNGs);
DEV hooks `__pffScene`, `__pffLinePops` steer it. Results of this pass: SMOKE_RESULTS_PLACEHOLDER
