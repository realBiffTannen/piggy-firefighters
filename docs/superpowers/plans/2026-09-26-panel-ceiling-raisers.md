# Panel Ceiling Raisers (items 1–5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear every item the 2026-09-26 three-seat Stake review panel (`qa/stake-review/LEDGER.md`, iteration 1) named as standing between this build and 3/3: (1) phone mascots behind the HUD bar, (2) CSS-gradient splash furniture, (3) motion short of RICH (per-symbol win animation, donor motion tables, Backdraft Spins bookends, vector placeholder signs, a doubled Chief on big wins, no recorded motion review), (4) audio recorded as never listened to, plus two structural audio notes, (5) a nameable signature moment.

**Architecture:** Every change stays inside the app (`apps/piggy_firefighters/src`), the art tools (`tools/art`), the audio tools (`audio/tools`) and docs. Nothing touches `math/**`, `packages/**` or the vendored HUD tarball. The motion work extends mechanisms that already ship: the pose-B texture cut through a squash (`symbolMotion.ts` / `SymbolSprite.svelte`), the bay-door card director (`rescueDirector.ts` / `SceneShutter.svelte`), and the rig beat planner (`rigLogic.ts`). No new rendering system is added. New art comes from the existing paid pipeline (`tools/art/gen_art.py`, same-framing edits of accepted masters) and the existing derive scripts.

**Tech Stack:** Svelte 5 runes, PixiJS v8 via `pixi-svelte`, Spine 4.2 runtime (unchanged), Node 24 with TypeScript type-stripping for gate checks, Python 3 + Pillow for art derivation, Playwright (muted) for captures.

**Spec:** `docs/superpowers/specs/2026-09-25-piggy-firefighters-design.md` (design of record) together with the panel findings in `qa/stake-review/LEDGER.md` and `qa/stake-review/ledger.json` (iteration 1). Style law: `docs/PIGGY_FIREFIGHTERS_THEME.md`. Rig law: `docs/ANIMATION_CONTRACT.md`. Audio law: `docs/AUDIO_DESIGN_NOTES.md`.

## Global Constraints

- Player-facing copy says **Engine**, never "Stake Engine".
- Max win **15,000x** in every mode. The math is frozen at tag `math-freeze-v1`: no file under `math/**` changes.
- The pigs are the cast. No hard-hat, construction, police or LUCKY (lantern, dragon) wording or imagery. No donor asset may ship: every asset is original to this title.
- Art style: thick dark-brown ink, chunky rounded shapes, flat cel shading with one hard shadow tone. Palette: engine red `#D7262B`, brass gold `#E9B23B`, hydrant yellow `#F5D23C`, hose cream `#F4E9D2`, smoke blue-grey `#7C8AA0`, dusk navy `#1E2A4A`. Flame orange `#FF7A1A` is reserved for fire, Backdraft and win FX. No airbrushed gradients and no model-drawn lettering; letter locally in Alfa Slab One (`StationSign`).
- **Paid generation:** only `tools/art/gen_art.py` (OpenAI) and `audio/tools/gen_audio.mjs` (ElevenLabs) spend money. Both write every call to their lane's `source-record.json` automatically. There are no speculative rerolls: at most one redraw per named, visible defect, and the reason goes in `--note`. Keys come from the environment only (`OPENAI_API_KEY`, `ELEVENLABS_API_KEY`).
- **Builds:** only `./tools/build_dist.sh --no-sync`, which stages into `apps/piggy_firefighters/build`. Never run bare `vite build`. The rsync into `game/dist` is the owner's one-line action: `! ./tools/build_dist.sh`.
- Every browser launch is muted (`--mute-audio`; the smoke scripts already pass it).
- **Commits:** explicit paths, never `git add -A`, on branch `claude/bold-bell-aoscdj`. Each commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Win timing:** a symbol's win motion gates the round (`Board.svelte:52-58` awaits every symbol). Every win motion stays at or under **1000 ms** before turbo scaling (turbo ×0.5, super ×0.3).
- **Contract §8:** no celebration at or below the charged cost. Nothing in this plan adds a celebration path; tier logic (`roundTier.ts`) is untouched.
- **Owner verification rule (memory `feedback-minimal-testing-final-product`):** one cheap gate per change. That means a pure-logic check under `qa/gate/`, wired into `node qa/gate/run.mjs`, plus one capture pass at the end. No test matrices and no review panels unless the owner asks.

## Review Focus

These are the input classes most likely to hurt a player that no task's own check exercises. Each has its check in the owning task.

1. **HUD not yet measured.** On the first frames, and just after an orientation flip, `hudReserve.css` is `0` or stale. Mascots and the shutter bar must fall back to the mirror reserve and then settle once, with no oscillation. Owner: Task 2 (gate case `measured 0 → mirror`), with the capture in Task 12.
2. **Pose art not resident when a win plays.** The pose tiles load lazily. A win before they land must play the single-pose flourish, and must never draw `Texture.EMPTY` or change size. A win with only pose B must play the two-pose cut. Owner: Task 4 (gate cases `poses 0/1/2`).
3. **Turbo and Super Turbo.** The three-pose win is compressed to 500 ms or 300 ms, and every cut must still land at the bottom of a squash. The Backdraft card must auto-dismiss in 1400 ms under turbo or autoplay, and a stop/skip press must collapse it. Owner: Task 4 (gate: every cut sits where the squash is at least 0.12), Task 8 (it reuses `waitForCard`/`cardWaitMs` unchanged), and Task 12 captures `@turbo`.
4. **Resume mid-Backdraft Spins.** `utils.ts:38,59,61` treats `backdraftSpinsStart` as a feature entry. A resumed round must show the intro card once, then play on. It must never hang on the door, which `SHUTTER_BOUND_MS` and `FAILSAFE_MS` already bound. Owner: Task 8, step "resume capture".
5. **Reduced motion.** The shutter uses its 240 ms fade path, the plate-Chief entrance is instant, the badge pulse is off, and symbols keep the 150 ms alpha fade. Owner: Tasks 9 and 10 (guard in code), Task 4 (unchanged `FADE` path).

---

## Task 1: Viewport-aware capture harness

The panel's missing evidence was a recorded review at 1440×900 **and** 390×844. Every later task captures through this one script.

**Files:**
- Modify: `qa/smoke/review/contract/smoke.mjs:40-45`, `:131-134`, `:152-154`, `:163`, `:167-172`, `:211`

**Interfaces:**
- Produces: the env vars `VIEWPORT=<w>x<h>` (default `1440x900`) and `CAPTURE_EVERY_MS`. Output PNGs are named `<fixture>@<speed>@<w>x<h>.<nn>.png`. Tasks 2, 4, 8, 9, 10 and 12 use them.

- [ ] **Step 1: Add the viewport constants.** Insert these after line 43 (`const CAPTURE_EVERY_MS = …`):

```js
// VIEWPORT=390x844 runs the phone class (device=mobile, touch, dsf 2); the default stays the 1440x900 desktop run.
const [VW, VH] = (process.env.VIEWPORT ?? '1440x900').split('x').map(Number);
const PHONE = VW < 800;
const DEVICE = PHONE ? 'mobile' : 'desktop';
const VTAG = `@${VW}x${VH}`;
```

- [ ] **Step 2: Use them in `runOne`.** Replace line 133 and line 134 with:

```js
	const name = `${RESUME_RUN ? 'resume_' : ''}${fixture}@${speed}${VTAG}`;
	const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: PHONE ? 2 : 1, isMobile: PHONE, hasTouch: PHONE });
```

Then, in both URL templates at lines 153-154, replace `device=desktop` with `device=${DEVICE}`. Replace `await page.mouse.click(720, 450);` with `await page.mouse.click(VW / 2, VH / 2);`. In the warm-up context at line 211, use `{ viewport: { width: VW, height: VH } }` and `device=${DEVICE}`.

- [ ] **Step 3: Run it once at the phone size to prove it works.**

```bash
PORT=3036 BOOKS_DIR=none node server/mock-rgs.mjs &            # terminal 1
(cd apps/piggy_firefighters && pnpm dev) &                       # terminal 2, port 3003
GAME_URL=http://127.0.0.1:3003/ RGS_HOST=127.0.0.1:3036 VIEWPORT=390x844 CAPTURE_EVERY_MS=1500 \
  node qa/smoke/review/contract/smoke.mjs base_win@off
```

Expected: `qa/smoke/review/contract/base_win@off@390x844.png` plus numbered frames, and `results.json` with `passed: true` and `console_errors: 0`. Open one frame. The canvas should be portrait, with the HUD in its two-row phone layout. The mascots will still be behind the bar here; Task 2 fixes that.

- [ ] **Step 4: Commit**

```bash
git add qa/smoke/review/contract/smoke.mjs
git commit -m "qa: contract smoke takes VIEWPORT (phone class 390x844, device=mobile, touch)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 2: Mascots and shutter bar stand on the real HUD bar (item 1)

**Cause.** `stateGame.svelte.ts:188` computes `hudTop` from `hudReservedHeight(cw, ch)`. That is the HUD package's stylesheet mirror, and it reserves one row (78 px at 390×844). On every portrait screen narrower than 800 px, `hud.css:1769-1778` draws the info panel as its own second row, so the bar's real top is about 697 px, not 766. The package already measures its own `#hud` box into the exported rune `hudReserve.css` (`CrashGalaxyHud.svelte:888-904`). The app never reads it.

**Fix.** Add a `hudBarTop` layout field: the measured bar top, falling back to the mirror until the first measurement. Mascots (`Mascots.svelte:59`) and the shutter's landing line (`SceneShutter.svelte:90`) switch to it. The board keeps `hudTop`, whose layout, chip clearance and frame were verified; this fix does not reflow it.

**Files:**
- Create: `apps/piggy_firefighters/src/game/hudBar.ts`
- Create: `qa/gate/check_hud_bar.mjs`
- Modify: `qa/gate/run.mjs:5-11` (add the check)
- Modify: `apps/piggy_firefighters/src/game/stateGame.svelte.ts:3` (import), `:188-189` (compute), `:256` (return field)
- Modify: `apps/piggy_firefighters/src/components/Mascots.svelte:59`
- Modify: `apps/piggy_firefighters/src/components/scene/SceneShutter.svelte:90`

**Interfaces:**
- Produces: `hudBarTop(canvasHeight: number, measuredCss: number, mirrorReserve: number): number`, and the `SceneLayout.hudBarTop: number` field (screen px).

- [ ] **Step 1: Write the failing gate check** in `qa/gate/check_hud_bar.mjs`:

```js
#!/usr/bin/env node
/** The HUD bar top the mascots and the shutter stand on (game/hudBar.ts): the HUD's own measurement wins, the mirror
 *  stands in until it exists.   node qa/gate/check_hud_bar.mjs */
const { hudBarTop } = await import(new URL('../../apps/piggy_firefighters/src/game/hudBar.ts', import.meta.url).href);
const cases = [
	// [canvas h, measured css, mirror reserve, want, why]
	[844, 0, 78.38, 765.62, 'not measured yet: the mirror stands in'],
	[844, 147, 78.38, 697, '390x844 two-row phone bar: the measurement wins'],
	[900, 96, 96, 804, 'desktop: measurement and mirror agree'],
	[844, -5, 78.38, 765.62, 'a negative measurement is treated as none'],
	[100, 400, 78, 0, 'never above the canvas top'],
];
const problems = [];
for (const [ch, css, mirror, want, why] of cases) {
	const got = Math.round(hudBarTop(ch, css, mirror) * 100) / 100;
	if (got !== want) problems.push(`hudBarTop(${ch}, ${css}, ${mirror}) = ${got}, want ${want} (${why})`);
}
if (problems.length) {
	console.error(`check_hud_bar: FAIL\n  ${problems.join('\n  ')}`);
	process.exit(1);
}
console.log(`check_hud_bar: PASS (${cases.length} cases)`);
```

- [ ] **Step 2: Run it to see it fail.** Run `node qa/gate/check_hud_bar.mjs`. Expected: FAIL with `ERR_MODULE_NOT_FOUND … hudBar.ts`.

- [ ] **Step 3: Create `apps/piggy_firefighters/src/game/hudBar.ts`**:

```ts
/**
 * The top edge of the studio HUD bar, in canvas px. The HUD measures its own `#hud` box into `hudReserve.css`
 * (0 until the first measurement): that is the truth on every layout, including the two-row phone bar (hud.css,
 * portrait under 800 px) that the package's `hudReservedHeight` mirror under-reserves by a whole row. Until the
 * measurement lands, the mirror stands in.
 */
export const hudBarTop = (canvasHeight: number, measuredCss: number, mirrorReserve: number): number => {
	const reserve = measuredCss > 0 ? measuredCss : mirrorReserve;
	return Math.max(0, canvasHeight - reserve);
};
```

- [ ] **Step 4: Run the check to see it pass.** Run `node qa/gate/check_hud_bar.mjs`. Expected: `check_hud_bar: PASS (5 cases)`.

- [ ] **Step 5: Wire the field into the scene layout.** In `stateGame.svelte.ts`, change line 3 to:

```ts
import { hudReservedHeight, hudReserve } from '@crashgalaxy/hud';
```

Add `import { hudBarTop as measureHudBarTop } from './hudBar';` with the other local imports. After line 189 (`const hudTop = ch - reserve;`), add:

```ts
	// the bar's REAL top (the HUD's own measurement; hudBar.ts): what the mascots and the shutter stand on. The board
	// keeps `hudTop` (its verified band + ante-chip clearance); reading hudReserve.css here makes the memo re-run when
	// the HUD re-measures (mount, resize, the two-row phone bar).
	const barTop = measureHudBarTop(ch, hudReserve.css, reserve);
```

In the returned object, add `hudBarTop: barTop,` directly under `hudTop,`. Update the memo comment at lines 270-272: replace "the HUD reserve is a pure function of the canvas size" with "the HUD reserve mirror is a pure function of the canvas size; hudBarTop also follows the HUD's own measurement".

- [ ] **Step 6: Mascots stand on it.** In `Mascots.svelte:59`, replace

```ts
		const groundBottom = sl.toMainY(sl.hudTop);
```

with

```ts
		// the bar's measured top (hudBar.ts): on a phone the HUD's info panel is its own second row, above `hudTop`
		const groundBottom = sl.toMainY(sl.hudBarTop);
```

- [ ] **Step 7: The shutter bar lands on it.** In `SceneShutter.svelte:90`, replace `const landY = $derived(sl.hudTop + 2);` with:

```ts
	const landY = $derived(sl.hudBarTop + 2); // the bar lands on the HUD bar's measured top edge (hudBar.ts)
```

- [ ] **Step 8: Add the check to the gate.** In `qa/gate/run.mjs`, add `['node', ['qa/gate/check_hud_bar.mjs']],` after the `check_round_tier` line.

- [ ] **Step 9: Capture at the four phone widths and at desktop.** With the dev server and mock from Task 1 running:

```bash
for v in 375x667 390x844 412x915 430x932 1440x900; do
  GAME_URL=http://127.0.0.1:3003/ RGS_HOST=127.0.0.1:3036 VIEWPORT=$v node qa/smoke/review/contract/smoke.mjs base_nowin@off
done
```

Open each `base_nowin@off@<v>.png` and check:
- On the four phone sizes, the Chief and Ember stand fully above the balance/win panel, with their feet on its top edge, in the band between the board frame and the bar.
- If a phone band is too short and the mascots are hidden (`slots.visible` false), note which width. That is the designed behaviour, not a regression.
- At 1440×900 nothing has moved compared with the Task 1 desktop run.
- On a phone, trigger the bay door with `backdraft_spins@off` after Task 8, or `rescue_buy@off` now. Its bottom bar must land on the HUD bar's top, not behind the info panel.

- [ ] **Step 10: Commit**

```bash
git add apps/piggy_firefighters/src/game/hudBar.ts apps/piggy_firefighters/src/game/stateGame.svelte.ts \
  apps/piggy_firefighters/src/components/Mascots.svelte apps/piggy_firefighters/src/components/scene/SceneShutter.svelte \
  qa/gate/check_hud_bar.mjs qa/gate/run.mjs
git commit -m "fix(layout): mascots and shutter stand on the HUD's measured bar top (two-row phone bar)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 3: Symbol pose art: pose C for H1–H4 and W, poses B and C for the rest (item 3, paid)

Every paying symbol and both scatters get two authored key frames: **B**, the action peak, and **C**, the follow-through. H1–H4 and W already have B. The tall sheet needs its own masters, because the tall tiles are separate compositions.

**Cost** (per-call estimates from `art-src/generated/source-record.json`: square edit $0.21, tall edit $0.30):
- 19 square edits: H1_c, H2_c, H3_c, H4_c, W_c, then L1–L4 b and c, ALARM b and c, GALARM b and c, W_blaze b and c.
- 19 tall edits for the same ids.
- Total: **$9.69**. `gen_art.py` records each call.

**Files:**
- Create: `art-src/generated/prompts/symbols_sym_sq_<id>.txt` and `symbols_sym_tall_<id>.txt` for the 19 ids above (`<id>` lower case, e.g. `l1_b`, `w_blaze_c`)
- Modify: `tools/art/derive_symbols.py:14`, `:39-49` (pose ids and runtime keys)
- Modify: `tools/art/derive_symbols_tall.py` (the same id tables; it imports or mirrors `MATCHED`, so read its top 34 lines first)
- Modify: `tools/art/make_symbol_labels.py` (the `--bonus` pass must re-tile `ALARM_b/_c` and `GALARM_b/_c` with the BONUS tag, like their bases)
- Output: `apps/piggy_firefighters/static/assets/sprites/symbolsCartoon/sym_*_{b,c}.webp` and `symbolsCartoonTall/symT_*_{b,c}.webp`, plus both `manifest.json` files

**Interfaces:**
- Produces these runtime asset keys, which Task 4 reads:
  - `sym_<ID>_b` and `sym_<ID>_c`, for `ID ∈ {H1,H2,H3,H4,L1,L2,L3,L4,W,ALARM,GALARM}`
  - `sym_W_BLAZE_b` and `sym_W_BLAZE_c`
  - the same keys with `symT_` in place of `sym_`
- Files are named `sym_<ID>_<b|c>.webp`; the Blaze files are `sym_W_blaze_<b|c>.webp`.

- [ ] **Step 1: Write the 19 square prompt files.** Each file holds only the pose description; the shared preamble `_style_sprite_poseb.txt` is passed with `--preamble`. W and W_blaze prompts also get `--preamble art-src/generated/prompts/_wild_rules.txt` (the badge stays **blank**, because `derive_symbols` letters it).

| id | pose description (file content) |
|---|---|
| h1_c | `Follow-through pose: the same fire engine landing back down after its bounce, squashed low on its springs, the ladder raised to its highest, both headlights flashing with small flat four-point cream stars, one short flat grey puff behind the rear wheel.` |
| h2_c | `Follow-through pose: the same helmet tipped far back as if doffed in a salute, the brim flipped up, the brass front shield catching one big flat four-point cream sparkle.` |
| h3_c | `Follow-through pose: the same axe and halligan swung apart into a wide open V, a flat cream glint streak along the axe blade, two small flat orange sparks where they parted.` |
| h4_c | `Follow-through pose: the same extinguisher mid-spray, leaning back from the recoil, a short flat white foam burst from the black hose nozzle, the gauge needle kicked hard into the red.` |
| w_c | `Follow-through pose: the same Chief Hamm winking with a big grin, giving a thumbs-up with one hand and holding the same blank red badge level at chest height with the other.` |
| l1_b | `Win pose: the same brass nozzle spraying, a short flat cream-and-blue water arc bursting from the tip, the coiled cream hose tightened and lifted by the kick.` |
| l1_c | `Follow-through pose: the same hose whipping into an S curve, the brass nozzle tipped up, a small fan of flat blue water drops scattering from it.` |
| l2_b | `Win pose: the same wooden bucket tipped forward, a flat blue wave of water sloshing over the rim, two drops flying.` |
| l2_c | `Follow-through pose: the same bucket rocked back upright, a crown splash of flat blue water rising out of it, small droplets arcing out.` |
| l3_b | `Win pose: the same ladder section with its upper fly section sliding out half-way, the brass fittings glinting, still inside the same canvas bounds.` |
| l3_c | `Follow-through pose: the same ladder with the fly section fully out and locked, leaning a little, one flat four-point cream sparkle on the top rung, still inside the same canvas bounds.` |
| l4_b | `Win pose: the same pair of boots, one boot lifted high mid-stomp, the other planted, the yellow trim bright.` |
| l4_c | `Follow-through pose: the same boots both stamped down together, a flat tan dust puff bursting out at their soles.` |
| alarm_b | `Win pose: the same brass alarm bell on its red box, the clapper striking the left rim, the bell tipped right, two short curved ringing strokes each side, the box's lamp glowing bright cream.` |
| alarm_c | `Follow-through pose: the same alarm, the clapper striking the right rim, the bell tipped left, two short curved ringing strokes each side, the lamp glowing bright cream.` |
| galarm_b | `Win pose: the same golden alarm bell on its gold box, the clapper striking the left rim, the bell tipped right, two short curved ringing strokes each side, a warm rim light.` |
| galarm_c | `Follow-through pose: the same golden alarm, the clapper striking the right rim, the bell tipped left, two short curved ringing strokes each side, a warm rim light.` |
| w_blaze_b | `Win pose: the same flaming WILD plate with Chief Hamm lifting the blank red badge high in a big cheer, the orange flames around the plate flaring up taller, embers flying.` |
| w_blaze_c | `Follow-through pose: the same flaming WILD plate with Chief Hamm winking and giving a thumbs-up, the blank badge held level, the flames settling lower with a few embers.` |

- [ ] **Step 2: Dry-run every call** (no spend, nothing recorded). The refs are the accepted pose A masters. Every **C** pose also passes that symbol's **B** as the second ref, so the pair reads as one performance:

```bash
cd /Users/jbull/code/piggy-firefighters
P=art-src/generated/prompts; S=art-src/generated/symbols
gen() { python3 tools/art/gen_art.py symbols "$1" --size "$2" --transparent --quality high \
  --preamble $P/_style_sprite_poseb.txt $3 --prompt-file $P/symbols_$1.txt --ref "${@:4}" --note "$NOTE" $DRY; }
DRY=--dry-run
WILD="--preamble $P/_wild_rules.txt"
for id in l1 l2 l3 l4 alarm galarm; do
  NOTE="pose B (win key frame) for ${id^^}: same-framing edit of accepted pose A"
  gen sym_sq_${id}_b 1024x1024 "" $S/sym_sq_${id}.png
done
NOTE="pose B for W_blaze"; gen sym_sq_w_blaze_b 1024x1024 "$WILD" $S/sym_sq_w_blaze.png $S/sym_sq_w_b.png
```

Expected: one plan line per call and exit 0. Fix any usage error (exit 2) before spending anything.

- [ ] **Step 3: Spend: square pose B (7 calls), then square pose C (12 calls).** Run the Step 2 loop again with `DRY=` (empty). Open all seven B PNGs. If one has a named, visible defect (framing drift, a wrong object, lettering), redraw **that one** with `--force --note "<defect>"`. Then generate the C poses:

```bash
DRY=
for id in h1 h2 h3 h4 l1 l2 l3 l4 alarm galarm; do
  NOTE="pose C (follow-through) for ${id^^}: edit of pose A with pose B as the pose ref"
  gen sym_sq_${id}_c 1024x1024 "" $S/sym_sq_${id}.png $S/sym_sq_${id}_b.png
done
NOTE="pose C for W"; gen sym_sq_w_c 1024x1024 "$WILD" $S/sym_sq_w.png $S/sym_sq_w_b.png
NOTE="pose C for W_blaze"; gen sym_sq_w_blaze_c 1024x1024 "$WILD" $S/sym_sq_w_blaze.png $S/sym_sq_w_blaze_b.png
```

- [ ] **Step 4: Spend: the 19 tall poses.** First write `symbols_sym_tall_<id>.txt` for each of the 19 ids, with the same text as its square file. Each tall pose edits the tall pose A and takes the accepted **square** pose of the same id as the pose ref. This is how `sym_tall_h1_b` was made (`reference_paths` in the record).

```bash
for id in h1_c h2_c h3_c h4_c l1_b l1_c l2_b l2_c l3_b l3_c l4_b l4_c alarm_b alarm_c galarm_b galarm_c; do
  base=${id%_*}; NOTE="tall pose ${id#*_} for ${base^^}: edit of tall pose A, square pose as pose ref"
  gen sym_tall_$id 1024x1536 "" $S/sym_tall_$base.png $S/sym_sq_$id.png
done
for id in w_c w_blaze_b w_blaze_c; do
  base=${id%_*}; NOTE="tall pose for ${base}"; gen sym_tall_$id 1024x1536 "$WILD" $S/sym_tall_$base.png $S/sym_sq_$id.png
done
```

Check the spend: `python3 -c "import json;r=json.load(open('art-src/generated/source-record.json'));rows=r if isinstance(r,list) else next(v for v in r.values() if isinstance(v,list));print(round(sum(x.get('cost_estimate_usd') or 0 for x in rows[-38:]),2))"`. Expected: about `9.69`, more if Step 3 redrew anything.

- [ ] **Step 5: Teach the derive tools the new ids.** In `tools/art/derive_symbols.py`, replace lines 39-42 with:

```python
POSES = ("b", "c")  # b = the action key frame, c = the follow-through (symbolMotion.ts keySequence)
POSED = ["H1", "H2", "H3", "H4", "L1", "L2", "L3", "L4", "W", "ALARM", "GALARM", "W_blaze"]
MATCHED = {"W_blaze": "W", **{f"{sid}_{p}": sid for sid in POSED for p in POSES}}
ALL_IDS = BASE_IDS[:9] + ["W_blaze"] + BASE_IDS[9:] + [f"{sid}_{p}" for sid in POSED for p in POSES]
WILD_IDS = {"W", "W_blaze"} | {f"{w}_{p}" for w in ("W", "W_blaze") for p in POSES}
OPTIONAL = set()
```

Replace `runtime_key` (lines 44-49) with this version, which handles both poses:

```python
def runtime_key(sid, prefix="sym_"):
    """H1 -> sym_H1, W_blaze -> sym_W_BLAZE, H1_b -> sym_H1_b, W_blaze_c -> sym_W_BLAZE_c (pose suffix stays lower case)."""
    for p in POSES:
        if sid.endswith(f"_{p}"):
            return f"{prefix}{sid[:-2].upper()}_{p}"
    return f"{prefix}{sid.upper()}"
```

Then check the mapping: `python3 -c "import sys;sys.path.insert(0,'tools/art');import derive_symbols as d;print(d.runtime_key('W_blaze_b'), d.runtime_key('L1_c','symT_'))"`. Expected: `sym_W_BLAZE_b symT_L1_c`. Also update the module docstring at line 14 to "pose B / C = `<ID>_b` / `<ID>_c` for every symbol …".

Next, open `tools/art/derive_symbols_tall.py` lines 1-34. Wherever it builds its own id list or imports `MATCHED`/`ALL_IDS`, make it use the same tables; importing them from `derive_symbols` is preferred over copying. Finally, in `make_symbol_labels.py`, the `--bonus` pass must add the BONUS tag to `ALARM_b, ALARM_c, GALARM_b, GALARM_c` as well as the two bases: extend the id list it iterates.

- [ ] **Step 6: Derive and verify.**

```bash
python3 tools/art/derive_symbols.py --bonus-tag --strict && python3 tools/art/derive_symbols_tall.py --bonus-tag --strict
python3 tools/art/verify_art.py
node tools/art/gen_art_meta.mjs && node tools/art/gen_art_meta.mjs --check
```

Expected: 17 + 19 = 36 square tiles and 36 tall tiles, `--strict` with no PENDING or off-box tiles, and verify_art PASS. If `verify_art.py:78-79` pins the expected inventory, add the 19 new ids to it in this step. Open `qa/art/symbols_contact.png` and `symbols_tall_contact.png` (the paths `--contact` prints). Each row of A/B/C must read as one object at one size.

- [ ] **Step 7: Commit** the masters, prompts, record, tools and shipped tiles:

```bash
git add art-src/generated/prompts/symbols_sym_sq_*_[bc].txt art-src/generated/prompts/symbols_sym_tall_*_[bc].txt \
  art-src/generated/symbols/ art-src/generated/source-record.json \
  tools/art/derive_symbols.py tools/art/derive_symbols_tall.py tools/art/make_symbol_labels.py tools/art/verify_art.py \
  apps/piggy_firefighters/static/assets/sprites/symbolsCartoon/ apps/piggy_firefighters/static/assets/sprites/symbolsCartoonTall/ \
  apps/piggy_firefighters/src/game/artMeta.generated.ts
git commit -m "art: authored pose B + C key frames for every symbol (38 same-framing edits, \$9.69 recorded)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 4: Three-pose win performances + donor tables re-tuned (item 3)

**Files:**
- Modify: `apps/piggy_firefighters/src/game/symbolMotion.ts`: header lines 1-30, `Transform.pose` at `:39-40`, the LAND `H3` entry at `:99-105`, `:41` and `:302` comments, the WIN key-pose block at `:320-400`, `symbolMotion`/`poseBKey` at `:450-472`
- Modify: `apps/piggy_firefighters/src/components/SymbolSprite.svelte`: `:88-90` (texC), `:131-138` (`showPose`), `:245` (donor comment), `:349-352` (pose keys), `:392` (motion pick)
- Modify: `apps/piggy_firefighters/src/game/assets.ts:31-45` (pose tiles leave the boot set) and `apps/piggy_firefighters/src/game/lazyAssets.ts:249-255` (a pose loader)
- Modify: `apps/piggy_firefighters/src/components/BoardFx.svelte` (the WILD banner act stands down when the W has its own poses)
- Modify: `docs/PIGGY_FIREFIGHTERS_THEME.md:55` (tile sizes are 384² and 384×500)
- Create: `qa/gate/check_symbol_motion.mjs`, and add it to `qa/gate/run.mjs`

**Interfaces:**
- Consumes: the asset keys `sym_<ID>_{b,c}` and `symT_<ID>_{b,c}` from Task 3, which include `sym_W_BLAZE_{b,c}`.
- Produces:
  - `Transform.pose: 0 | 1 | 2`
  - `symbolMotion(name, 'land' | 'win', { emphasis?: boolean; poses?: 0 | 1 | 2 })`
  - `poseKey(assetKey: string, pose: 1 | 2): string`, which returns `` `${assetKey}_b` `` or `` `${assetKey}_c` ``
  - `symbolPoseEntries(set: SymbolSet)` in `assets.ts`
  - `ensureSymbolPoses(set: SymbolSet): Promise<void>` in `lazyAssets.ts`
  - `SYMBOL_POSE_NAMES: readonly string[]`, the names that own a sequence

- [ ] **Step 1: Write the failing gate check** `qa/gate/check_symbol_motion.mjs`:

```js
#!/usr/bin/env node
/** Symbol win motion (game/symbolMotion.ts): every performance returns to rest, stays <= 1000 ms, and every pose cut
 *  happens at the bottom of a squash (sy <= 0.88 of its held scale) so no cut is ever seen.
 *    node qa/gate/check_symbol_motion.mjs */
const M = await import(new URL('../../apps/piggy_firefighters/src/game/symbolMotion.ts', import.meta.url).href);
const problems = [];
const t = M.restTransform();
const sample = (m, p) => (M.resetTransform(t), m.sample(p, t), { ...t });
const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;
const NAMES = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'W', 'ALARM', 'GALARM'];
if (JSON.stringify([...M.SYMBOL_POSE_NAMES].sort()) !== JSON.stringify([...NAMES].sort())) problems.push(`SYMBOL_POSE_NAMES = ${M.SYMBOL_POSE_NAMES}`);
for (const name of NAMES) {
	for (const poses of [0, 1, 2]) {
		const m = M.symbolMotion(name, 'win', { poses });
		if (m.durationMs > 1000) problems.push(`${name} poses ${poses}: ${m.durationMs} ms > 1000`);
		const end = sample(m, 1);
		if (end.pose !== 0 || !near(end.sx, 1, 0.02) || !near(end.sy, 1, 0.02) || Math.abs(end.oy) > 1.5 || Math.abs(end.rot) > 0.5)
			problems.push(`${name} poses ${poses}: not at rest at p=1 (${JSON.stringify(end)})`);
		let prev = sample(m, 0).pose;
		const seen = new Set([prev]);
		for (let i = 1; i <= 2000; i += 1) {
			const s = sample(m, i / 2000);
			seen.add(s.pose);
			if (s.pose > poses) problems.push(`${name} poses ${poses}: shows pose ${s.pose} it does not have`);
			if (s.pose !== prev) {
				const before = sample(m, (i - 1) / 2000);
				const squashed = Math.min(before.sy / Math.max(before.sx, 1e-6), s.sy / Math.max(s.sx, 1e-6));
				if (squashed > 0.88) problems.push(`${name} poses ${poses}: cut ${prev}->${s.pose} at p=${(i / 2000).toFixed(3)} is not inside a squash (sy/sx ${squashed.toFixed(3)})`);
				prev = s.pose;
			}
		}
		if (poses === 2 && !(seen.has(1) && seen.has(2))) problems.push(`${name} poses 2: never shows both B and C`);
	}
}
if (M.poseKey('sym_W_BLAZE', 1) !== 'sym_W_BLAZE_b' || M.poseKey('symT_H1', 2) !== 'symT_H1_c') problems.push('poseKey naming');
if (problems.length) {
	console.error(`check_symbol_motion: FAIL\n  ${[...new Set(problems)].slice(0, 40).join('\n  ')}`);
	process.exit(1);
}
console.log(`check_symbol_motion: PASS (${NAMES.length} symbols x 3 pose sets)`);
```

- [ ] **Step 2: Run it to see it fail.** Run `node qa/gate/check_symbol_motion.mjs`. Expected: FAIL (`SYMBOL_POSE_NAMES = undefined`, and the `poses` option is not understood).

- [ ] **Step 3: Widen the pose field.** In `symbolMotion.ts` lines 38-40, make it `/** 0 = resting art (A), 1 = key frame B (the action), 2 = key frame C (the follow-through) */ pose: 0 | 1 | 2;`. Replace the `flash` doc at `:41` with `/** 0..1 additive flash (unused by the Firefighters set; kept for the transform's shape) */`, since the "legacy sign crop" wording is donor residue.

- [ ] **Step 4: Add the sequence sampler.** Insert this after `keyPose` (after line 361), reusing `squash`, `easeOutCubic`, `easeInCubic`, `TAU`, `HALF` and `B_SCALE`:

```ts
// ---- WIN: the three-frame performance (A -> B -> C -> A), every cut at the bottom of a squash ----------------------
const S_A = 0.14; // A sinks; cut to B
const S_B0 = 0.44; // B squashes ...
const S_B1 = 0.52; // ... cut to C
const S_C0 = 0.78; // C squashes ...
const S_C1 = 0.86; // ... cut back to A, which springs and settles
const springOut = (q: number, o: Transform, k: number) => {
	const spring = Math.exp(-7 * q) * Math.cos(TAU * 2.2 * q);
	o.sy = k * (1 - 0.3 * spring);
	o.sx = k * (1 + 0.2 * spring);
	o.oy = (1 - o.sy) * HALF;
};
const squashDown = (q: number, o: Transform, k: number) => {
	const e = easeInCubic(q);
	o.sy = k * (1 - 0.24 * e);
	o.sx = k * (1 + 0.16 * e);
	o.oy = (1 - o.sy) * HALF;
};
const keySequence =
	(holdB: Hold, holdC: Hold): Sampler =>
	(p, o) => {
		if (p < S_A) return squash(o, 0.26 * easeOutCubic(p / S_A), 0.7);
		if (p < S_B0) {
			o.pose = 1;
			const q = (p - S_A) / (S_B0 - S_A);
			springOut(q, o, B_SCALE);
			holdB(q, o);
			return;
		}
		if (p < S_B1) {
			o.pose = 1;
			squashDown((p - S_B0) / (S_B1 - S_B0), o, B_SCALE);
			return;
		}
		if (p < S_C0) {
			o.pose = 2;
			const q = (p - S_B1) / (S_C0 - S_B1);
			springOut(q, o, 1.04);
			holdC(q, o);
			return;
		}
		if (p < S_C1) {
			o.pose = 2;
			squashDown((p - S_C0) / (S_C1 - S_C0), o, 1.04);
			return;
		}
		const q = (p - S_C1) / (1 - S_C1);
		const spring = Math.exp(-5 * q) * Math.cos(TAU * 1.4 * q) * (1 - q);
		o.sy = 1 - 0.17 * spring;
		o.sx = 1 + 0.16 * spring;
		o.oy = (1 - o.sy) * HALF;
	};
```

- [ ] **Step 5: Replace `WIN_KEYPOSE` with one table of per-symbol holds.** This drives both the two-frame fallback (`keyPose(b)`) and the full sequence (`keySequence(b, c)`). Keep the four existing H1–H4 hold bodies verbatim as their `b`. Each `c` is the object's follow-through, and each `ms` is ≤ 1000:

```ts
type Holds = { ms: number; b: Hold; c: Hold };
const HOLDS: Record<string, Holds> = {
	// fire truck: B revs (the existing pump), C settles on its springs with a slow rock
	H1: { ms: 1000, b: /* existing H1 hold body */ (q, o) => { const env = decay2(q) * clamp01(q * 7); o.oy += 5 * Math.abs(Math.sin(TAU * 7 * q)) * env; o.ox += 2.5 * Math.sin(TAU * 14 * q) * env; o.rot = 2 * Math.sin(TAU * 7 * q + 0.4) * env; },
		c: (q, o) => { o.rot = -2.5 * Math.sin(TAU * 1.5 * q) * decay(q); } },
	// helmet: B judders (existing), C tips back in the salute and holds
	H2: { ms: 960, b: (q, o) => { const env = decay(q) * clamp01(q * 9); o.oy += 4.5 * Math.sin(TAU * 10 * q) * env; o.ox += 1.6 * Math.sin(TAU * 13 * q) * env; },
		c: (q, o) => { o.rot = -6 * easeOutCubic(clamp01(q * 3)) * decay(q); } },
	// axe & halligan: B clashes (existing flutter), C springs apart with a shiver
	H3: { ms: 1000, b: (q, o) => { const env = decay(q) * clamp01(q * 6); o.rot = 5 * Math.sin(TAU * 2 * q) * env; o.sx *= 1 + 0.04 * Math.sin(TAU * 3 * q) * env; o.oy += -4 * Math.sin(Math.PI * q) * env; },
		c: (q, o) => { o.sx *= 1 + 0.03 * Math.sin(TAU * 6 * q) * decay2(q); } },
	// extinguisher: B rings on its base (existing), C recoils from the spray
	H4: { ms: 960, b: (q, o) => { const env = decay2(q) * clamp01(q * 8); o.rot = 13 * Math.sin(TAU * 2.75 * q) * env; },
		c: (q, o) => { o.ox += -4 * Math.sin(Math.PI * clamp01(q * 2)) * decay(q); o.rot = -4 * decay2(q); } },
	// nozzle: B kicks with the jet, C whips
	L1: { ms: 900, b: (q, o) => { o.ox += -3 * Math.sin(TAU * 4 * q) * decay2(q); },
		c: (q, o) => { o.rot = 7 * Math.sin(TAU * 2 * q) * decay(q); } },
	// bucket: B tips and sloshes, C rocks back upright
	L2: { ms: 880, b: (q, o) => { o.rot = 8 * easeOutCubic(clamp01(q * 2)) * decay(q); },
		c: (q, o) => { o.rot = -5 * Math.sin(TAU * 1.5 * q) * decay2(q); } },
	// ladder: B extends (a rising stretch), C locks with a small bounce
	L3: { ms: 900, b: (q, o) => { o.oy += -5 * easeOutCubic(clamp01(q * 2)) * decay(q); },
		c: (q, o) => { o.oy += 3 * Math.abs(Math.sin(TAU * 2 * q)) * decay2(q); } },
	// boots: B lifts, C stamps (the heaviest impact of the set)
	L4: { ms: 860, b: (q, o) => { o.oy += -4 * Math.sin(Math.PI * q); },
		c: (q, o) => { o.oy += 2.5 * Math.abs(Math.sin(TAU * 3 * q)) * decay2(q); } },
	// Chief Hamm: B raises the badge in a cheer, C winks with the thumbs-up
	W: { ms: 1000, b: (q, o) => { o.oy += -5 * Math.sin(Math.PI * q) * decay(q); },
		c: (q, o) => { o.rot = 3 * Math.sin(TAU * 1.5 * q) * decay2(q); } },
	// alarm bell: B strikes left, C strikes right (the swing IS the ring)
	ALARM: { ms: 900, b: (q, o) => { o.rot = 9 * Math.sin(TAU * 3 * q) * decay(q); },
		c: (q, o) => { o.rot = -9 * Math.sin(TAU * 3 * q) * decay(q); } },
	GALARM: { ms: 1000, b: (q, o) => { o.rot = 9 * Math.sin(TAU * 3 * q) * decay(q); },
		c: (q, o) => { o.rot = -9 * Math.sin(TAU * 3 * q) * decay(q); } },
};
/** The symbols whose win is an authored key-frame performance (poses from game/assets.ts). */
export const SYMBOL_POSE_NAMES = Object.keys(HOLDS) as readonly string[];
const WIN_KEYPOSE: Record<string, Motion> = Object.fromEntries(Object.entries(HOLDS).map(([k, h]) => [k, { durationMs: h.ms, sample: keyPose(h.b) }]));
const WIN_SEQUENCE: Record<string, Motion> = Object.fromEntries(Object.entries(HOLDS).map(([k, h]) => [k, { durationMs: h.ms, sample: keySequence(h.b, h.c) }]));
```

Prettier formats these one-liners on commit. Keep the bodies as written. Then add the missing plain fallback for the golden alarm to `WIN_PLAIN`, reusing the ALARM flourish (it currently falls back to the bucket): `GALARM: { durationMs: 760, sample: WIN_PLAIN_ALARM_SAMPLE }`. To do that, lift the `ALARM` sample body at `:289-297` into `const WIN_PLAIN_ALARM_SAMPLE: Sampler = (p, o) => { … }` and reference it from both entries.

- [ ] **Step 6: Choose the motion from what is resident.** Replace `symbolMotion` and `poseBKey` (`:450-472`) with:

```ts
/**
 * Pick the motion for one symbol + state. `emphasis` upgrades an ALARM landing to the trigger pop. `poses` = how many
 * key frames of this tile are resident (game/lazyAssets.ts ensureSymbolPoses): 2 plays the A-B-C-A performance,
 * 1 the A-B-A cut, 0 the single-pose flourish, so a win that beats its art to the GPU still plays in full.
 */
export const symbolMotion = (
	symbolName: string,
	state: 'land' | 'win',
	opts: { emphasis?: boolean; poses?: 0 | 1 | 2 } = {},
): Motion => {
	if (state === 'land') {
		if (symbolName === 'ALARM' && opts.emphasis) return ALARM_TRIGGER;
		return LAND[symbolName] ?? FALLBACK_LAND;
	}
	const poses = opts.poses ?? 0;
	if (poses >= 2 && WIN_SEQUENCE[symbolName]) return WIN_SEQUENCE[symbolName];
	if (poses >= 1 && WIN_KEYPOSE[symbolName]) return WIN_KEYPOSE[symbolName];
	return WIN_PLAIN[symbolName] ?? FALLBACK_WIN;
};

/** A key frame's asset key: the tile on show plus `_b` (B) or `_c` (C): `sym_H1_b`, `symT_L2_c`, `sym_W_BLAZE_b`. */
export const poseKey = (assetKey: string, pose: 1 | 2): string => `${assetKey}_${pose === 1 ? 'b' : 'c'}`;
```

- [ ] **Step 7: Re-tune the donor LAND entry and rewrite the header.** Replace the `H3` LAND entry (`:99-105`) with a metal tool's answer to the impact:

```ts
	H3: {
		durationMs: 320,
		sample: (p, o) => {
			// axe & halligan: steel lands hard, a short stiff squash and a ringing shiver along the blade
			squash(o, hit(p, 0.06), 0.5);
			o.rot = 1.6 * osc(p, 9) * decay2(p);
		},
	},
```

In the header (lines 7-24), delete the sentence "(The per-symbol tables below were authored for the donor's symbol set; the motions carry over to the Firefighters art in the same slots and are re-tuned by the animation lane.)". Replace the `WIN` paragraph with: "WIN (0.86–1.0 s) the pay performance. Every symbol plays three authored key frames, A → B (the action) → C (the follow-through) → A, each cut at the bottom of a squash so the cut is never seen (`keySequence`). With only B resident it plays A → B → A (`keyPose`); with neither, the single-pose flourish (`WIN_PLAIN`)." Replace the `:302` comment's "the retired pig-sign crop in SymbolSprite never lights up the wrong region" with "nothing on the tile flashes; the banner act is BoardFx's". Replace the word "paper" wherever it still appears.

- [ ] **Step 8: Run the gate check.** Run `node qa/gate/check_symbol_motion.mjs`. Expected: PASS. If a symbol fails "not inside a squash", its `b`/`c` hold is adding `sy` at the cut. Multiply that hold's envelope by `clamp01(q * 6)` so it starts at 0.

- [ ] **Step 9: Load the pose tiles lazily, off the boot path.** In `assets.ts`, replace lines 31-45 so the boot sheet carries only pose A. The key frames get their own entries:

```ts
const SYMBOL_IDS = ['H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'W', 'ALARM', 'GALARM'] as const;
/** the win key frames (B = action, C = follow-through) of every symbol, the Blaze Wild included; fetched after boot by
 *  lazyAssets.ensureSymbolPoses (a win before they land plays the single-pose flourish, symbolMotion.ts) */
const POSES = ['b', 'c'] as const;

export type SymbolSet = 'sym' | 'symT';
/** Every resting tile of one symbol sheet, keyed `sym_*` / `symT_*` (the keys components/SymbolSprite.svelte reads). */
export const symbolSetEntries = (set: SymbolSet): Record<string, ReturnType<typeof sym>> => {
	const make = set === 'sym' ? sym : symT;
	const out: Record<string, ReturnType<typeof sym>> = {};
	for (const id of SYMBOL_IDS) out[`${set}_${id}`] = make(`${set}_${id}`);
	/** a W ignited by a Backdraft (contract §4: an ordinary W in the evaluated board, drawn on fire) */
	out[`${set}_W_BLAZE`] = make(`${set}_W_blaze`);
	return out;
};
/** The key frames of one sheet: `sym_H1_b`, `sym_H1_c`, … `sym_W_BLAZE_b` (files `sym_W_blaze_b.webp`). */
export const symbolPoseEntries = (set: SymbolSet): Record<string, ReturnType<typeof sym>> => {
	const make = set === 'sym' ? sym : symT;
	const out: Record<string, ReturnType<typeof sym>> = {};
	for (const p of POSES) {
		for (const id of SYMBOL_IDS) out[`${set}_${id}_${p}`] = make(`${set}_${id}_${p}`);
		out[`${set}_W_BLAZE_${p}`] = make(`${set}_W_blaze_${p}`);
	}
	return out;
};
```

Update the `:19` doc comment ("cuts to pose B inside the …") to say "plays its key frames (symbolPoseEntries, lazy)". In `lazyAssets.ts`, after `ensureSymbolSet` (`:249-254`), add the loader and import `symbolPoseEntries` beside `symbolSetEntries`:

```ts
/** The win key frames of one sheet (SymbolSprite asks on mount; deduped by ensureKeys). Low priority: queued behind
 *  whatever the budgeted uploader already holds. */
export const ensureSymbolPoses = async (set: SymbolSet): Promise<void> => {
	const entries = symbolPoseEntries(set);
	const keys = Object.keys(entries);
	await ensureKeys(keys, entries);
	await uploadTextureSources(sourcesOfKeys(keys));
};
```

Moving the 5 existing pose-B tiles out of boot removes 5 boot requests (10 on a stacked boot). Note that figure in the Task 12 build record.

- [ ] **Step 10: SymbolSprite plays what is resident.** In `SymbolSprite.svelte`:
  - Next to `texB` (`:89`), add `let texC: PIXI.Texture | undefined;` and `let tileKey = '';`. Change `shownPose` to `let shownPose: 0 | 1 | 2 = 0;`.
  - Replace `showPose` (`:131-138`) with:

```ts
	const showPose = (pose: 0 | 1 | 2) => {
		if (!sprite || pose === shownPose) return;
		const next = pose === 2 ? texC : pose === 1 ? texB : texA;
		if (!next) return;
		shownPose = pose;
		sprite.texture = next;
		fit(sprite, baseW, baseH);
	};
```

  - In the art effect, replace `texB = tex(poseBKey(name, chosenTall));` (`:351`) with the lines below, and add `import { ensureSymbolPoses } from '../game/lazyAssets';` beside `ensureSymbolSet`. Keep the key of the tile that is actually shown: the tall key when `chosenTall`, otherwise the square key.

```ts
			// the key frames come from the SAME sheet as the tile on show (one size, so a cut never resizes); resolved
			// again at win time, since they arrive after boot (ensureSymbolPoses)
			tileKey = chosen ? (chosenTall ? tallKey : key) : '';
			texB = undefined;
			texC = undefined;
			void ensureSymbolPoses(chosenTall ? 'symT' : 'sym');
```

  - In the state effect, replace the `const m = symbolMotion(…)` line (`:392`) with:

```ts
			if (state === 'win' && tileKey) {
				texB = tex(poseKey(tileKey, 1));
				texC = tex(poseKey(tileKey, 2));
			}
			const m = symbolMotion(name, state, { emphasis, poses: texB ? (texC ? 2 : 1) : 0 });
```

  - Update the import from `symbolMotion` from `poseBKey` to `poseKey`. Replace the `:245` comment "a gold shock ring and eight glint rays burst from under the hat" with "the golden alarm's land ring: a gold shock ring and eight glint rays".

- [ ] **Step 11: The WILD banner act stands down when the W plays its own frames.** In `BoardFx.svelte:420`, replace `wilds.forEach((pos) => startWildAct(pos.reel, pos.row));` with the block below. The banner crop of pose A would flash where the badge no longer is:

```ts
			// the W performs its own key frames once they are resident (symbolMotion keySequence): the banner crop of
			// pose A would flash where the badge no longer is, so the act runs only until then
			const la = app.stateApp.loadedAssets as Record<string, unknown> | undefined;
			const wildPosed = !!la && (!!la['sym_W_b'] || !!la['symT_W_b']);
			if (!wildPosed) wilds.forEach((pos) => startWildAct(pos.reel, pos.row));
```

- [ ] **Step 12: Fix the theme doc sizes.** In `docs/PIGGY_FIREFIGHTERS_THEME.md:55`, replace "square 88×88 and portrait 86×92" with "square 384×384 and portrait 384×500 tiles (pose A plus key frames B and C)".

- [ ] **Step 13: Add the gate and capture.** Add `['node', ['qa/gate/check_symbol_motion.mjs']],` to `qa/gate/run.mjs`. Then:

```bash
for v in 1440x900 390x844; do for s in off turbo; do
  GAME_URL=http://127.0.0.1:3003/ RGS_HOST=127.0.0.1:3036 VIEWPORT=$v CAPTURE_EVERY_MS=120 node qa/smoke/review/contract/smoke.mjs base_win@$s
done; done
```

`base_win` is a 500x full screen of trucks: H1 pays across the board. Step through the numbered frames. H1 must show A, then B, then C, then A. No frame may show an empty cell or a size jump. Repeat once with `base_backdraft_win@off` to see the W/Blaze and a low-symbol line. The trigger fixtures `base_trigger_rescue@off` and `base_trigger_inferno@off` show ALARM and GALARM.

- [ ] **Step 14: Commit**

```bash
git add apps/piggy_firefighters/src/game/symbolMotion.ts apps/piggy_firefighters/src/components/SymbolSprite.svelte \
  apps/piggy_firefighters/src/game/assets.ts apps/piggy_firefighters/src/game/lazyAssets.ts \
  apps/piggy_firefighters/src/components/BoardFx.svelte docs/PIGGY_FIREFIGHTERS_THEME.md \
  qa/gate/check_symbol_motion.mjs qa/gate/run.mjs
git commit -m "feat(motion): three-frame authored win performance for every symbol; donor land table re-tuned

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 5: Painted furniture and sign plates (items 2 and 3, paid: 2 calls, $0.60)

This task makes one transparent sheet of blank splash furniture and one sheet of blank sign plates for the bay-door cards. Both are cut locally.

**Files:**
- Create: `art-src/generated/prompts/scene_splash_furniture.txt` and `art-src/generated/prompts/scene_sign_plates.txt`
- Create: `tools/art/derive_furniture.py`
- Output: `apps/piggy_firefighters/static/assets/splash/{board,chain,nail,beam,dust,hazard}.webp` and `apps/piggy_firefighters/static/assets/ui_scene/plates/{station,gold,hazard,win,chain}.webp` plus `plates/manifest.json`

**Interfaces:**
- Produces the splash files `board.webp`, `chain.webp` (a vertical tile), `nail.webp`, `beam.webp` (a horizontal tile), `dust.webp` and `hazard.webp` (a 28×28 locally drawn stripe tile).
- Produces the plate files `station.webp`, `gold.webp`, `hazard.webp`, `win.webp` and `chain.webp`. The manifest has the form `{ "<name>": { "w": int, "h": int, "corner": int } }`. Task 7 reads it.

- [ ] **Step 1: Write the two prompts.** Follow the house rules: blank panels, lettering done locally, no gradients.

`scene_splash_furniture.txt`:
```
A sprite sheet on a genuinely transparent background, six separate items with wide empty space between them, none touching, arranged in two rows of three, all in the same flat cel cartoon style with thick dark-brown ink:
1. A wide BLANK wooden notice board made of four horizontal planks, warm brown wood (#9A6631) with one hard darker shadow tone, a brass bolt in each corner, a thin darker seam between planks, no text, no marks, face on, about 3:2.
2. A short straight vertical run of chunky steel chain, five links, smoke blue-grey (#7C8AA0) with a darker shadow tone, drawn so the top and bottom link ends could repeat.
3. One round steel nail head seen face on, smoke blue-grey with a cream highlight dot.
4. A long straight horizontal brass beam segment (#E9B23B) with a hydrant-yellow top edge and red tick stripes (#D7262B) evenly spaced, drawn so its left and right ends could repeat.
5. One soft cartoon dust puff made of three overlapping round clouds, pale tan (#E9D6AE) with a darker tan shadow tone.
6. Leave the sixth cell empty.
No text, no letters, no numbers, no logos, no gradients, no airbrush, no glow, no scenery.
```

`scene_sign_plates.txt`:
```
A sprite sheet on a genuinely transparent background, four separate BLANK hanging sign plates and one chain run, wide empty space between them, none touching, in the same flat cel cartoon style with thick dark-brown ink, each plate face on, wide 2:1, with a plain flat centre area free of any detail so text can be placed on it later, and all decoration kept to a border no deeper than one fifth of the plate's height:
1. An engine-red (#D7262B) riveted steel plate with a chrome top rail and four brass corner bolts.
2. A brass-gold (#E9B23B) premium plate with a raised gold rim and four brass corner bolts.
3. A hazard plate: a dusk-navy (#1E2A4A) centre with a border of flame-orange (#FF7A1A) and hydrant-yellow reflective diagonal bands, four steel corner bolts.
4. A win plate: a hose-cream (#F4E9D2) centre with a thick brass rim and small flat four-point stars at the corners.
5. A short straight vertical run of chunky brass chain, five links, whose ends could repeat.
No text, no letters, no numbers, no logos, no gradients, no airbrush, no glow, no scenery.
```

- [ ] **Step 2: Dry-run, then spend.** Use the sheet preamble that made the rung plaques, with one opaque-free style ref each. Refs: the wood of the splash cards; the rung sign plaque for the plates.

```bash
P=art-src/generated/prompts
for DRY in --dry-run ""; do
python3 tools/art/gen_art.py scene splash_furniture --size 1024x1536 --transparent --quality high \
  --preamble $P/_style_sheet.txt --prompt-file $P/scene_splash_furniture.txt \
  --ref art-src/generated/symbols/sym_sq_l3.png --note "splash furniture (replaces SplashDeck/Splash CSS-gradient planks, chains, nails, beam, dust)" $DRY
python3 tools/art/gen_art.py scene sign_plates --size 1024x1536 --transparent --quality high \
  --preamble $P/_style_sheet.txt --prompt-file $P/scene_sign_plates.txt \
  --ref art-src/generated/symbols/sym_sq_h2.png --note "bay-door card plates (replaces signPanel.ts vector PLACEHOLDER)" $DRY
done
```

Open both PNGs under `art-src/generated/scene/`. If a sheet has touching items or lettering, redraw that sheet once with `--force --note "<defect>"`.

- [ ] **Step 3: Write `tools/art/derive_furniture.py`.** It cuts each sheet by alpha connected components, orders them top-to-bottom then left-to-right, and names them from a fixed list. It draws the hazard tile locally at no cost. It writes webp through `art_common.save_webp` and records each plate's nine-slice corner.

```python
#!/usr/bin/env python3
"""Cut the splash-furniture and sign-plate sheets into shipped tiles (free; local).
   python3 tools/art/derive_furniture.py            # both sheets
Items are found as alpha connected components (alpha > 24), ordered top-to-bottom then left-to-right, trimmed, and
named from FURNITURE / PLATES. Plates get a nine-slice `corner` = 20 % of their shorter side (the prompt keeps every
decoration inside that border). The loading-bar hazard tile is drawn here, flat, 28 x 28."""
import json, os, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from art_common import save_webp  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
GEN = os.path.join(ROOT, 'art-src', 'generated', 'scene')
STATIC = os.path.join(ROOT, 'apps', 'piggy_firefighters', 'static', 'assets')
FURNITURE = ['board', 'chain', 'nail', 'beam', 'dust']
PLATES = ['station', 'gold', 'hazard', 'win', 'chain']
MAX_SIDE = {'board': 900, 'chain': 160, 'nail': 96, 'beam': 1024, 'dust': 256}
PLATE_MAX = 900


def components(im):
    a = im.getchannel('A').point(lambda v: 255 if v > 24 else 0)
    w, h = a.size
    px = a.load()
    seen = bytearray(w * h)
    boxes = []
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            if px[x, y] and not seen[y * w + x]:
                stack, x0, y0, x1, y1 = [(x, y)], x, y, x, y
                seen[y * w + x] = 1
                while stack:
                    cx, cy = stack.pop()
                    x0, y0, x1, y1 = min(x0, cx), min(y0, cy), max(x1, cx), max(y1, cy)
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny] and not seen[ny * w + nx]:
                            seen[ny * w + nx] = 1
                            stack.append((nx, ny))
                if (x1 - x0) * (y1 - y0) > 400:
                    boxes.append((x0, y0, x1 + 1, y1 + 1))
    rows = sorted(boxes, key=lambda b: b[1])
    out, band = [], []
    for b in rows:  # group into rows by vertical overlap, then left-to-right inside a row
        if band and b[1] > max(bb[3] for bb in band):
            out += sorted(band, key=lambda bb: bb[0])
            band = []
        band.append(b)
    return out + sorted(band, key=lambda bb: bb[0])


def fit(im, side):
    k = min(1.0, side / max(im.size))
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS) if k < 1 else im


def cut(sheet, names):
    im = Image.open(os.path.join(GEN, sheet)).convert('RGBA')
    boxes = components(im)
    if len(boxes) < len(names):
        sys.exit(f'{sheet}: found {len(boxes)} items, need {len(names)} ({names})')
    return {n: im.crop(b) for n, b in zip(names, boxes)}


def hazard_tile():
    t = Image.new('RGBA', (28, 28), (0xF5, 0xD2, 0x3C, 255))
    d = ImageDraw.Draw(t)
    for off in (-28, 0, 28):
        d.polygon([(off, 28), (off + 14, 28), (off + 28, 0), (off + 14, 0)], fill=(0xFF, 0x7A, 0x1A, 255))
    return t


def main():
    furn = cut('splash_furniture.png', FURNITURE)
    for n, im in furn.items():
        save_webp(fit(im, MAX_SIDE[n]), os.path.join(STATIC, 'splash', f'{n}.webp'))
    save_webp(hazard_tile(), os.path.join(STATIC, 'splash', 'hazard.webp'), lossless=True)
    plates = cut('sign_plates.png', PLATES)
    meta = {}
    for n, im in plates.items():
        im = fit(im, PLATE_MAX if n != 'chain' else 160)
        save_webp(im, os.path.join(STATIC, 'ui_scene', 'plates', f'{n}.webp'))
        meta[n] = {'w': im.width, 'h': im.height, 'corner': round(min(im.size) * 0.2)}
    os.makedirs(os.path.join(STATIC, 'ui_scene', 'plates'), exist_ok=True)
    with open(os.path.join(STATIC, 'ui_scene', 'plates', 'manifest.json'), 'w') as f:
        json.dump(meta, f, indent=1)
    print('derive_furniture: splash', sorted(furn), '+ hazard; plates', meta)


if __name__ == '__main__':
    main()
```

Before running, check `save_webp`'s real signature at `tools/art/art_common.py:445`: `save_webp(im, path, quality=90, lossless=False)`. Check whether it creates parent directories. If it does not, move the `os.makedirs(...)` above the first plate save.

- [ ] **Step 4: Derive and check the splash budget.**

```bash
python3 tools/art/derive_furniture.py
du -cb apps/piggy_firefighters/static/assets/splash/*.webp | tail -1
python3 tools/art/verify_art.py
```

The splash directory must stay at or under 1,258,291 B (`SPLASH_BUDGET`, 1.2 MB; it was 823,390 B before this task). If it is over, lower `MAX_SIDE['board']` to 720 and re-run. If `verify_art.py:78-79` lists the expected splash inventory, add the six new names there.

- [ ] **Step 5: Commit**

```bash
git add art-src/generated/prompts/scene_splash_furniture.txt art-src/generated/prompts/scene_sign_plates.txt \
  art-src/generated/scene/splash_furniture.png art-src/generated/scene/sign_plates.png art-src/generated/source-record.json \
  tools/art/derive_furniture.py tools/art/verify_art.py \
  apps/piggy_firefighters/static/assets/splash/{board,chain,nail,beam,dust,hazard}.webp \
  apps/piggy_firefighters/static/assets/ui_scene/plates/
git commit -m "art: painted splash furniture + blank bay-door sign plates (2 sheets, \$0.60 recorded)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 6: Splash without CSS-gradient furniture (item 2)

**Files:**
- Modify: `apps/piggy_firefighters/src/components/splash/SplashDeck.svelte:286-331`, `:379-394`, `:419`
- Modify: `apps/piggy_firefighters/src/components/Splash.svelte:447-451`, `:494-504`, `:594-598`, `:740`, `:757`, `:786`
- Modify: `apps/piggy_firefighters/src/components/splash/copy.ts:55-56` (an asset URL helper for sibling folders)
- Create: `qa/gate/check_splash_no_gradients.mjs`, and add it to `qa/gate/run.mjs`

**Interfaces:**
- Consumes: the Task 5 files `splash/{board,chain,nail,beam,dust,hazard}.webp`, and the boot-loaded `environment/base_{landscape,portrait}.webp`. The game already fetches the latter as `bg_base_<orientation>`, so reusing them costs no extra bytes.
- Produces: `assetUrl(path: string): string` in `copy.ts`.

- [ ] **Step 1: Write the failing gate check** `qa/gate/check_splash_no_gradients.mjs`:

```js
#!/usr/bin/env node
/** The splash draws its furniture with painted art, never CSS gradients (panel 2026-09-26, craft rung +0.67).
 *    node qa/gate/check_splash_no_gradients.mjs */
import { readFileSync } from 'node:fs';
const files = ['apps/piggy_firefighters/src/components/splash/SplashDeck.svelte', 'apps/piggy_firefighters/src/components/Splash.svelte'];
const ROOT = new URL('../..', import.meta.url).pathname;
const hits = [];
for (const f of files) {
	readFileSync(ROOT + f, 'utf8').split('\n').forEach((line, i) => {
		if (/gradient\(/.test(line)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
	});
}
if (hits.length) {
	console.error(`check_splash_no_gradients: FAIL (${hits.length})\n  ${hits.join('\n  ')}`);
	process.exit(1);
}
console.log('check_splash_no_gradients: PASS');
```

- [ ] **Step 2: Run it to see it fail.** Run `node qa/gate/check_splash_no_gradients.mjs`. Expected: FAIL listing 20 lines (11 in SplashDeck, 9 in Splash).

- [ ] **Step 3: Add a sibling-folder URL helper.** In `copy.ts`, after `splashAssetUrl` (`:55-56`), add:

```ts
/** Any shipped asset by its path under ./assets (resolved against document.baseURI, like splashAssetUrl). */
export const assetUrl = (path: string): string => new URL(`./assets/${path}`, document.baseURI).href;
```

If `splashAssetUrl` builds its URL differently (for example with a guard for SSR), mirror that exact form.

- [ ] **Step 4: SplashDeck.** In the `<script>`, import `splashAssetUrl` if it is not already imported. Define the URLs as CSS custom properties on the deck root element's `style`:

```svelte
style:--img-board={`url(${splashAssetUrl('board.webp')})`}
style:--img-chain={`url(${splashAssetUrl('chain.webp')})`}
style:--img-nail={`url(${splashAssetUrl('nail.webp')})`}
```

Then replace the gradient declarations:
- `.deck__peek` (`:286-287`): `background: var(--img-board) center / 100% 100% no-repeat; filter: brightness(0.72) saturate(0.9);`
- `.deck__nail--l/--r` (`:308`): `background: var(--img-nail) center / contain no-repeat;`
- `.card__chain--l/--r` (`:323-331`): `background: var(--img-chain) center top / 100% auto repeat-y;`
- `.card__board` (`:379-394`, all four bolt radials, the seam repeat and the wood linear): `border-image: var(--img-board) 22% fill / 0 stretch;` and delete the `background` gradients. Keep the existing `border` and inset `box-shadow` bevel (395-409); they are not gradients. Keep `.card--gold`'s ring.
- `.card__art` placeholder (`:419`): `background: #a8713a;` (flat ground while the card webp loads).

- [ ] **Step 5: Splash.** Set these custom properties on the `.splash` root:

```svelte
style:--img-stage-l={`url(${assetUrl('environment/base_landscape.webp')})`}
style:--img-stage-p={`url(${assetUrl('environment/base_portrait.webp')})`}
style:--img-beam={`url(${splashAssetUrl('beam.webp')})`}
style:--img-hazard={`url(${splashAssetUrl('hazard.webp')})`}
style:--img-dust={`url(${splashAssetUrl('dust.webp')})`}
```

Then replace the gradient declarations:
- `.splash` ground (`:449-451`): `background: #1e2a4a var(--img-stage-l) center / cover no-repeat;`. Add a rule `@media (max-aspect-ratio: 13/10) { .splash { background-image: var(--img-stage-p); } }`, and a `.splash::before { content: ''; position: absolute; inset: 0; background: rgba(30, 42, 74, 0.55); pointer-events: none; }` so the wordmark and deck read over the painted station. If `.splash` already has a `::before`, put the dim on the first child layer instead. Update the `:448` comment to "Station 13 at dusk: the base plate the game boots with (cache hit), dimmed".
- `.frame::before/::after` (`:503-504`): `background: var(--img-beam) left center / auto 100% repeat-x;` and update the `:494` comment to "the painted brass beam, top & bottom".
- `.bar__fill` (`:594-598`): `background: var(--img-hazard) left center / auto 100% repeat-x;`
- `.shutter__bar` fallback (`:740`): `background: #7c8aa0;` (the raster `<i>` still draws on top).
- `.shutter__housing` (`:757`): `background: rgba(42, 18, 0, 0.18);`
- `.shutter__dust span` (`:786`): `background: var(--img-dust) center / contain no-repeat;`

Finally, update `Splash.svelte:133-150` `warmShutter()` so it also warms `beam.webp` and `dust.webp`, and correct its "41 KB" comment to the measured size (`du -b` the four files).

- [ ] **Step 6: Run the check to see it pass.** Run `node qa/gate/check_splash_no_gradients.mjs`. Expected: PASS. Add it to `qa/gate/run.mjs`.

- [ ] **Step 7: Capture the splash.** Run `VIEWPORT=390x844` and `VIEWPORT=1440x900` smoke runs with `base_nowin@off` and `CAPTURE_EVERY_MS=400`. The first frames are the splash. Check:
  - Painted boards, chains, nails and beam.
  - The dimmed station plate behind them.
  - The hazard-striped load bar.
  - No empty boxes while images load; the flat colours stand in.

- [ ] **Step 8: Commit**

```bash
git add apps/piggy_firefighters/src/components/splash/SplashDeck.svelte apps/piggy_firefighters/src/components/Splash.svelte \
  apps/piggy_firefighters/src/components/splash/copy.ts qa/gate/check_splash_no_gradients.mjs qa/gate/run.mjs
git commit -m "feat(splash): painted furniture and the station plate replace every CSS gradient

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 7: Bay-door cards on painted plates, with per-card art and variant (item 3)

**Files:**
- Modify: `apps/piggy_firefighters/src/components/scene/SceneShutter.svelte:1-19` (the `ShutterCard` type), `:352`, `:516`, `:655-666` (chains and panel)
- Modify: `apps/piggy_firefighters/src/game/assetsScene.ts:60-69` (plate entries) and `:150` (the `LAZY_SETS.alarm` membership)
- Modify: `apps/piggy_firefighters/src/game/fx/signPanel.ts:4-10` (it becomes the fallback, not the placeholder)

**Interfaces:**
- Consumes: `ui_scene/plates/{station,gold,hazard,win,chain}.webp` and `plates/manifest.json` from Task 5.
- Produces:
  - `ShutterCard.art?: string`, a scene texture key such as `'scene_card_backdraft'`
  - `ShutterCard.variant?: SignVariant`
  - scene keys `scene_plate_station`, `scene_plate_gold`, `scene_plate_hazard`, `scene_plate_win` and `scene_plate_chain`

- [ ] **Step 1: Extend the card type.** In `SceneShutter.svelte` lines 1-19, add these to `ShutterCard`:

```ts
	/** the intro painting's scene key (default: Inferno if premium, else Rescue) */
	art?: string;
	/** the plate (default: premium gold, outro win, else station) */
	variant?: import('../../game/fx/signPanel').SignVariant;
```

- [ ] **Step 2: Resolve art and variant from the card.** Add these next to `cardArt` (`:516`) and use them at `:352` and `:516`:

```ts
	const cardArtKey = (c: ShutterCard | null | undefined) => c?.art ?? (c?.premium ? 'scene_card_inferno' : 'scene_card_rescue');
	const cardVariant = (c: ShutterCard | null | undefined): SignVariant => c?.variant ?? (c?.premium ? 'gold' : c?.kind === 'outro' ? 'win' : 'station');
	const PLATE_KEY: Record<SignVariant, string> = { station: 'scene_plate_station', gold: 'scene_plate_gold', hazard: 'scene_plate_hazard', win: 'scene_plate_win', muted: 'scene_plate_station' };
```

Change `:352` to load `['scene_shutter_slats', 'scene_shutter_bar', 'scene_plate_chain', PLATE_KEY[cardVariant(c)], c?.kind === 'intro' ? cardArtKey(c) : 'scene_shutter_bar']`. Change `:516` to `const cardArt = $derived(card?.kind === 'intro' ? sceneTex(cardArtKey(card)) : null);`. Import `type SignVariant` from `../../game/fx/signPanel`.

- [ ] **Step 3: Register the plates.** In `assetsScene.ts`, add these entries beside `scene_card_*` (`:66-69`), in the same shape those entries use:

```ts
	scene_plate_station: { src: u('ui_scene/plates/station.webp') },
	scene_plate_gold: { src: u('ui_scene/plates/gold.webp') },
	scene_plate_hazard: { src: u('ui_scene/plates/hazard.webp') },
	scene_plate_win: { src: u('ui_scene/plates/win.webp') },
	scene_plate_chain: { src: u('ui_scene/plates/chain.webp') },
```

Copy the exact helper and field names from the neighbouring `scene_card_rescue` entry. Add the five keys to `LAZY_SETS.alarm` (`:150`), which the directors await before the door drops.

- [ ] **Step 4: Draw the painted plate and chains, with the vector panel as the fallback.** In the static `staticBack` container (`:655-666`), replace the chain `<Graphics>` and the `drawSignPanel` `<Graphics>` with the block below. Read `corner` from the manifest by importing it (`import PLATES from '../../../static/assets/ui_scene/plates/manifest.json'`), or, if the app does not import JSON from `static/`, as a `const PLATE_CORNER_FRAC = 0.2` applied to the texture's shorter side (the same rule `derive_furniture.py` writes).

```svelte
						{@const plateTex = sceneTex(PLATE_KEY[cardVariant(card)])}
						{@const chainTex = sceneTex('scene_plate_chain')}
						{#each [-1, 1] as sx (sx)}
							{#if chainTex}
								<TilingSprite texture={chainTex} x={sx * lay.W * lay.s * 0.36 - lay.s * 0.09} y={-lay.cy - 40}
									width={lay.s * 0.18} height={lay.cy + 40 - (lay.H * lay.s) / 2 + lay.s * 0.1}
									tileScale={{ x: (lay.s * 0.18) / chainTex.width, y: (lay.s * 0.18) / chainTex.width }} />
							{/if}
						{/each}
						{#if plateTex}
							<Grab ongrab={(node) => mountPlate(node, plateTex, lay.W * lay.s, lay.H * lay.s)} />
						{:else}
							<Graphics draw={(g) => drawSignPanel(g as any, { w: lay.W * lay.s, h: lay.H * lay.s, s: lay.s, variant: cardVariant(card) })} />
						{/if}
```

If `pixi-svelte` exports no `TilingSprite` component, build the chain the same imperative way as the plate. Add `mountPlate` to the `<script>`, using `PIXI.NineSliceSprite` the way `BoardFrame.svelte:81` does:

```ts
	/** The painted plate, nine-sliced to the card (its border art never stretches; the flat centre does). */
	const mountPlate = (node: any, tex: any, w: number, h: number) => {
		const corner = Math.round(Math.min(tex.width, tex.height) * 0.2);
		const plate = new PIXI.NineSliceSprite({ texture: tex, leftWidth: corner, topHeight: corner, rightWidth: corner, bottomHeight: corner });
		plate.width = w;
		plate.height = h;
		plate.position.set(-w / 2, -h / 2);
		node.addChild(plate);
		return () => plate.destroy();
	};
```

Keep `cacheStatic('staticBack')`: the group is still static, so it is still cached as one texture.

- [ ] **Step 5: signPanel becomes the fallback.** In `signPanel.ts` lines 4-5, replace "PLACEHOLDER styling (the art lane may replace it with painted plates):" with "FALLBACK drawing, used only while the painted plate (ui_scene/plates, SceneShutter mountPlate) is not resident:".

- [ ] **Step 6: Capture.** Run `rescue_buy@off` and `inferno_buy@off` at `1440x900` and `390x844` with `CAPTURE_EVERY_MS=400`. The intro and outro cards must hang on painted chains from painted plates: red station for Rescue, gold for Inferno, cream/brass for both outros. The text must stay readable, since the outro slate knockout is unchanged.

- [ ] **Step 7: Commit**

```bash
git add apps/piggy_firefighters/src/components/scene/SceneShutter.svelte apps/piggy_firefighters/src/game/assetsScene.ts \
  apps/piggy_firefighters/src/game/fx/signPanel.ts
git commit -m "feat(shutter): painted plates and chains for the bay-door cards; cards carry their own art and variant

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 8: Backdraft Spins enters and leaves through the bay door (item 3)

**Files:**
- Modify: `apps/piggy_firefighters/src/game/rescue/rescueDirector.ts:396-427`

**Interfaces:**
- Consumes: `ShutterCard.art` and `.variant` from Task 7, plus the existing `shutter`, `waitForCard`, `cardExpected`, `pendingDismiss`, `assetsReady`, `spinsWord`, `celebrateRound`, `formatBookMultiple`, `MODE_TITLE` and `CONTRACT` (`rulesContent.ts:40`).

- [ ] **Step 1: Replace `backdraftSpinsStart` and `backdraftSpinsEnd`** with the following. Add `import { CONTRACT } from '../rulesContent';`.

```ts
// ---- Backdraft Spins: the bay door blown open, bookended by the door like Rescue ----------------------------------
export const backdraftSpinsStart = async (e: Ev<'backdraftSpinsStart'>) => {
	const [lo, hi] = CONTRACT.backdraftSpinsBlaze;
	cardExpected = true;
	pendingDismiss = false;
	// the card's painting (splash/card_backdraft via scene_card_backdraft) and the plates ride on the door
	await assetsReady('alarm');
	await shutter({
		type: 'shutterClose',
		card: {
			kind: 'intro',
			premium: false,
			art: 'scene_card_backdraft',
			variant: 'hazard',
			title: MODE_TITLE.backdraft_spins,
			subtitle: `${spinsWord(e.spins)} · ${lo}–${hi} Blaze Wilds every spin · ${CONTRACT.backdraftSpinsMultText}, added along a line`,
			hint: 'TAP OR PRESS SPACE',
		},
	});
	// ---- under cover: the bay door is blown open ---------------------------------------------------------------------
	await assetsReady('backdraft');
	stateBackdraftSpins.spins = e.spins;
	stateBackdraftSpins.spinsLeft = e.spins;
	stateBackdraftSpins.total = 0;
	stateBackdraftSpins.active = true;
	stateRescue.skip = false;
	claimWin('backdraftSpins');
	setFeatureSpins(e.spins);
	stateScene.mood = 'backdraft'; // swapped behind the door, not cross-faded in view
	audioDirector.backdraftSpinsStart();
	await waitForCard();
	await shutter({ type: 'shutterOpen' });
	await beat(300);
};

export const backdraftSpinsEnd = async (e: Ev<'backdraftSpinsEnd'>, bookEvents: BookEvent[]) => {
	const round = roundStakeOf(bookEvents, stateRescue.capped);
	const total = round.total || e.amount;
	stateRescue.skip = false;
	setFeatureSpins(0);
	audioDirector.backdraftSpinsEnd();
	await celebrateRound(round.tier, total);
	audioDirector.total(round.tier, 'backdraftSpins');
	stateBackdraftSpins.total = total;
	// the book's own figures for the card: how many Blaze Wilds lit, and the biggest multiplier among them
	const blazes = bookEvents.filter((ev): ev is Ev<'backdraft'> => ev.type === 'backdraft');
	const lit = blazes.reduce((n, ev) => n + ev.count, 0);
	const best = blazes.reduce((m, ev) => Math.max(m, ...ev.cells.map((c) => c.mult ?? 0)), 0);
	cardExpected = true;
	pendingDismiss = false;
	await shutter({
		type: 'shutterClose',
		card: {
			kind: 'outro',
			premium: false,
			variant: 'win',
			title: `${MODE_TITLE.backdraft_spins} COMPLETE`,
			subtitle: `${lit} Blaze Wilds${best > 0 ? ` · best ×${best}` : ''}`,
			value: formatBookMultiple(total),
			hint: 'TAP OR PRESS SPACE',
		},
	});
	await waitForCard();
	// ---- under cover: back to Station 13 ----------------------------------------------------------------------------
	stateBackdraftSpins.active = false;
	stateScene.mood = 'base';
	stateGame.gameType = 'basegame';
	releaseWin('backdraftSpins');
	setFeatureSpins(null);
	await shutter({ type: 'shutterOpen' });
};
```

- [ ] **Step 2: Type check.** Run `cd apps/piggy_firefighters && npx svelte-check --threshold error 2>&1 | tail -5`. Expected: 0 errors in `rescueDirector.ts` and `SceneShutter.svelte`. If `ev.cells[].mult` is optional, the `?? 0` already covers it.

- [ ] **Step 3: Capture the feature, and resume.** Run `backdraft_spins@off` and `backdraft_spins@turbo` at `1440x900` and `390x844` with `CAPTURE_EVERY_MS=500`. Check:
  - The door drops with the Backdraft painting on the hazard plate, and lifts on the burning-bay plate.
  - Five spins play, then the win rungs.
  - The door drops with the "BACKDRAFT SPINS COMPLETE" outro and the multiple, then lifts on base.
  - In `@turbo` both cards leave within about 1.4 s without a press.

Then check resume, which is Review Focus 4. Start the mock with `RESUME=backdraft_spins` and run `RESUME_RUN=1 … smoke.mjs backdraft_spins@off`. The intro card must show once and the round must finish (`passed: true`).

- [ ] **Step 4: Commit**

```bash
git add apps/piggy_firefighters/src/game/rescue/rescueDirector.ts
git commit -m "feat(backdraft-spins): bay-door intro and outro cards (hazard plate, Blaze count, best multiplier)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 9: One Chief on stage for big wins, with an entrance (item 3)

**Cause.** On a BIG+ climb, `WinRungs.svelte:635-638` shows the centred plate Chief (slot `winPlate`). Meanwhile the gutter/ground Chief (`mascotLeft`) also plays `big_win` (`rigLogic.ts:77`). The result is two Chiefs, and the reviewer's eye goes to the small one at the side.

**Files:**
- Modify: `apps/piggy_firefighters/src/game/anim/rigLogic.ts:77`, `:93`
- Modify: `apps/piggy_firefighters/src/components/WinRungs.svelte:635-638` (entrance)
- Create: `qa/gate/check_rig_beats.mjs`, and add it to `qa/gate/run.mjs`

**Interfaces:**
- Consumes: `planBeat(rig, slot, event, settings, index)` (`rigLogic.ts:55`).
- Produces: `mascotLeft` hides on `bigWinStart` with tier ≥ 2 and returns on `bigWinEnd`, `spinStart` or `rescueExit`. The gutter Chief cheers only tier 1.

- [ ] **Step 1: Write the failing gate check** `qa/gate/check_rig_beats.mjs`:

```js
#!/usr/bin/env node
/** One Chief on stage (game/anim/rigLogic.ts): BIG+ belongs to the plate chief; the gutter chief steps out and back.
 *    node qa/gate/check_rig_beats.mjs */
const { planBeat } = await import(new URL('../../apps/piggy_firefighters/src/game/anim/rigLogic.ts', import.meta.url).href);
const S = { speedTier: 0, reducedMotion: false };
const problems = [];
const expect = (label, got, pred) => { if (!pred(got)) problems.push(`${label}: ${JSON.stringify(got)}`); };
expect('gutter chief, tier 1 win', planBeat('pf_chief', 'mascotLeft', { beat: 'winTier', tier: 1, amount: 2, x: 2 }, S), (p) => p && p.steps[0].animation === 'win');
expect('gutter chief, tier 3 win', planBeat('pf_chief', 'mascotLeft', { beat: 'winTier', tier: 3, amount: 40, x: 40 }, S), (p) => p === null);
expect('gutter chief steps out on BIG+', planBeat('pf_chief', 'mascotLeft', { beat: 'bigWinStart', tier: 2 }, S), (p) => p && p.visible === false);
expect('gutter chief back after', planBeat('pf_chief', 'mascotLeft', { beat: 'bigWinEnd' }, S), (p) => p && p.visible === true);
expect('Ember keeps acting', planBeat('pf_dog', 'mascotRight', { beat: 'bigWinStart', tier: 2 }, S), (p) => p === null);
expect('plate chief enters', planBeat('pf_chief', 'winPlate', { beat: 'bigWinStart', tier: 2 }, S), (p) => p && p.visible === true);
if (problems.length) {
	console.error(`check_rig_beats: FAIL\n  ${problems.join('\n  ')}`);
	process.exit(1);
}
console.log('check_rig_beats: PASS (6 cases)');
```

- [ ] **Step 2: Run it to see it fail.** Run `node qa/gate/check_rig_beats.mjs`. Expected: FAIL on "gutter chief, tier 3 win" and "steps out".

- [ ] **Step 3: Change the two beat lines.** In `rigLogic.ts`, replace line 77 with:

```ts
    // tier 1 is the gutter chief's own cheer; BIG+ belongs to the plate chief under the rung sign (one Chief on stage)
    case 'winTier': return rig === 'pf_chief' && event.tier === 1 ? finish([once('win')]) : null;
```

Replace line 93 (`case 'bigWinStart': case 'bigWinEnd': return null; …`) with:

```ts
    // the gutter chief steps out while the plate chief holds the stage, and back when the sign leaves
    case 'bigWinStart': return slot === 'mascotLeft' && event.tier >= 2 ? { steps: [loop(rest)], visible: false } : null;
    case 'bigWinEnd': return slot === 'mascotLeft' ? { steps: [loop(rest)], visible: true } : null;
```

`spinStart` (`visible: slot !== 'ladder'`) and `rescueExit` already bring the actor back if `bigWinEnd` is missed.

- [ ] **Step 4: Run it to see it pass.** Run `node qa/gate/check_rig_beats.mjs`. Expected: PASS. Add it to `qa/gate/run.mjs`.

- [ ] **Step 5: Give the plate Chief an entrance.** In `WinRungs.svelte`, add a tween in the `<script>` (`Tween` from `svelte/motion` and `backOut` from `svelte/easing`):

```ts
	// the plate chief rises into place with the sign (reduced motion: instant)
	const plateIn = new Tween(0, { duration: 320, easing: backOut });
	$effect(() => {
		const on = plateTier >= 2;
		void plateIn.set(on ? 1 : 0, { duration: on && !prefersReducedMotion() ? 320 : 0 });
	});
```

Change the plate container (`:635`) to:

```svelte
		<Container x={plateSlot.x} y={plateSlot.y + (1 - plateIn.current) * plateSlot.h * 0.3} alpha={plateIn.current} visible={plateTier >= 2}>
```

- [ ] **Step 6: Capture a climb.** Run `base_win@off` (a 500x EPIC climb) at `1440x900` and `390x844` with `CAPTURE_EVERY_MS=300`. Check:
  - Only one Chief is visible during the climb: centred, under the sign, rising in.
  - The gutter/ground Chief is gone during the climb and back once the sign has left.
  - A tier-1 fixture (`base_backdraft_win`, if it pays under 15x) shows the gutter Chief's small `win` cheer.

- [ ] **Step 7: Commit**

```bash
git add apps/piggy_firefighters/src/game/anim/rigLogic.ts apps/piggy_firefighters/src/components/WinRungs.svelte \
  qa/gate/check_rig_beats.mjs qa/gate/run.mjs
git commit -m "feat(big-win): one Chief on stage (plate chief rises in; gutter chief steps out and back)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 10: The rescue set piece: the multiplier climbs per rescue (item 5)

**Cause.** The ladder slide into the jump sheet already plays: pf_rescued slides, lands and publishes `landingBus`, then the sheet rigs catch. But the multiplier badge is static text that jumps once, after all of a douse's rescues (`rescueDirector.ts:274-277`). The payoff of the moment is invisible.

**Fix.** The badge counts up **per rescue** and pulses on every change. The book's `e.multiplier` stays the final truth, assigned after the loop as it is today.

**Files:**
- Modify: `apps/piggy_firefighters/src/game/rescue/rescueDirector.ts:258-277` (stepwise multiplier)
- Modify: `apps/piggy_firefighters/src/components/rescue/RescueScene.svelte:459-466` (badge pulse)

**Interfaces:**
- Consumes: `CONTRACT.rescueStep` (1) and `CONTRACT.infernoStep` (2) from `rulesContent.ts:50-51`, and `stateRescue.multiplier`.

- [ ] **Step 1: Step the multiplier with each rescue.** In the `for (const rescue of e.rescues)` loop (`:258`), add this directly after `stateRescue.rescued += 1;`:

```ts
		// the badge climbs WITH the rescue it pays for (never past the book's figure for this douse, which lands below)
		const step = stateRescue.bonus === 'inferno' ? CONTRACT.infernoStep : CONTRACT.rescueStep;
		stateRescue.multiplier = Math.min(e.multiplier, stateRescue.multiplier + step);
```

Keep the existing `if (e.multiplier !== stateRescue.multiplier) { stateRescue.multiplier = e.multiplier; await beat(240); }` after the loop. It now fires only if the book's figure differs from the stepped one (for example on a resumed round), and it keeps the book the truth. `CONTRACT` is already imported by Task 8.

- [ ] **Step 2: Pulse the badge on every change.** In `RescueScene.svelte`, add a spring to the `<script>`:

```ts
	import { Spring } from 'svelte/motion';
	// the multiplier badge swells on every change (a rescue landed its +1x / +2x); reduced motion: no pulse
	const badgePulse = new Spring(1, { stiffness: 0.18, damping: 0.32 });
	let lastMult = stateRescue.multiplier;
	$effect(() => {
		const m = stateRescue.multiplier;
		if (m === lastMult) return;
		lastMult = m;
		if (prefersReducedMotion()) return;
		badgePulse.set(1.45, { instant: true });
		badgePulse.target = 1;
	});
```

Import `prefersReducedMotion` from wherever the file's neighbours import it (grep `prefersReducedMotion` in `components/`). Then change the badge container (`:459`) to `<Container x={badgeAt.x} y={badgeAt.y} scale={badgePulse.current}>`.

- [ ] **Step 3: Capture the set piece at both viewports.** Run `rescue_building_cleared@off` (23 rescues) at `1440x900` and `390x844` with `CAPTURE_EVERY_MS=250`. Check:
  - On desktop, the family member slides the ladder into the sheet, and the badge ticks `x1 → x2 → …` with a swell on each rescue.
  - On a phone, the jump from the window sill onto the sheet on the header beam reads, and the badge is visible and pulsing. Note the facade band's height at 390×844 in the Task 12 ledger row.
  - The badge's final value on each spin equals the book's (`douse.multiplier` in the fixture).

- [ ] **Step 4: Commit**

```bash
git add apps/piggy_firefighters/src/game/rescue/rescueDirector.ts apps/piggy_firefighters/src/components/rescue/RescueScene.svelte
git commit -m "feat(rescue): the multiplier badge climbs and swells with each rescue (book figure stays the truth)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Task 11: Audio: record the owner's listening pass (item 4)

The owner has listened to the build's audio. Three records still say nobody has, and a reviewer reading the repo takes them at their word.

**Files:**
- Modify: `audio/tools/audio_map.py:130` (the generator of `docs/AUDIO_MAP.md`; never hand-edit the generated file)
- Modify: `audio/README.md:10` and `:208`
- Modify: `docs/submission/PRE_UPLOAD_CHECKLIST.md:3`, `:62`
- Modify: `game/BUILD_INFO.md:18`
- Modify: `assets/SOUND_BIBLE.md:66-67` (stale "donor's 66,899 ms constant")
- Regenerate: `docs/AUDIO_MAP.md`

- [ ] **Step 1: Ask the owner for the pass's date and any notes** (one question) so the record is theirs, not invented. Use today's date if they give none: **2026-09-26**.

- [ ] **Step 2: Update the generator.** In `audio_map.py:130`, replace the string `'**Nobody has listened to any of this yet.**'` with `'**Owner listening pass: done (2026-09-26).**'`, using the owner's date. In the same function, remove the stale "`replaces` = the donor id the ported runtime still plays there (the runtime seam is a later frontend task)" wording. The runtime now asks for the new ids (`presentationDirector.ts`, `audioDirector.ts`). Change it to: "`replaces` = the donor id this cue superseded (history only; the runtime plays the new id)." Apply the same fix to the line-10 paragraph source. Then regenerate the map with `python3 audio/tools/audio_map.py`.

- [ ] **Step 3: Update the prose records.**
  - `audio/README.md:10`: change `**Human listening NOT RUN**` to `**Owner listening pass done 2026-09-26.**`
  - `audio/README.md:208`: change the line to `- Human listening: done by the owner, 2026-09-26.`
  - `PRE_UPLOAD_CHECKLIST.md:62`: change it to `- [x] Human listening pass (audio): done by the owner, 2026-09-26.`
  - `PRE_UPLOAD_CHECKLIST.md:3`: remove "listening pass" from the list of open human gates.
  - `BUILD_INFO.md:18`: remove "listening pass;" from the Not-run cell.
  - `SOUND_BIBLE.md:66-67`: change it to "the director reads each bed's authored length from the manifest (`cueMs`, presentationDirector.ts)".

- [ ] **Step 4: Commit**

```bash
git add audio/tools/audio_map.py audio/README.md docs/AUDIO_MAP.md docs/submission/PRE_UPLOAD_CHECKLIST.md game/BUILD_INFO.md assets/SOUND_BIBLE.md
git commit -m "docs(audio): record the owner's listening pass; drop stale donor-seam notes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11b (owner decision): longer station ambience and Backdraft Spins' own bed

Two seats also named two structural notes that a listening pass can clear by judgment. Run this sub-task **only if the owner's pass did not already accept them.**
- **Ambience:** `ambient_station_loop` is 14 s, so it repeats 4.3 times a minute under the base game and through Backdraft Spins.
- **Backdraft Spins bed:** Backdraft Spins plays a 31 s, 12-bar layer over the base bed. `AUDIO_DESIGN_NOTES.md:75-77` and `:133` ask for "a separate music track" per bonus.

Cost: 3 ElevenLabs SFX draws (15 s each) and 1 music composition (about 64 s). Check the quota first with `node audio/tools/gen_audio.mjs quota` (the floor is 25,000 characters).

- [ ] **Ambience to about 58 s.** In `audio/tools/roster.py:184`, add three more draws: `ambient_station_loop_b`, `_c` and `_d`. Use the same palette and `loop=True`, with prompts that vary one element each: "a hose reel rewinding", "a far truck bay door rolling", "a kettle ticking as it cools". In `build_audio.py:57`, make `ambient_station_loop` a 4-part concatenation. Follow the existing loop-cue code path for `(14.0, 400)`, cutting each draw to 14.5 s and joining with the 400 ms crossfade, for about 57.4 s. Then run `roster.py`, `gen_audio.mjs sfx audio/tools/jobs.json ambient_station_loop_b,ambient_station_loop_c,ambient_station_loop_d`, `build_audio.py sfx --only ambient_station_loop`, `mix.py`, `gen_manifest.mjs`, `measure.py` (it must PASS, including seams) and `audio_map.py`.
- [ ] **Own Backdraft Spins bed.** Add a plan `pf_backdraftbed92` (92 BPM, 24 bars, −16 LUFS, the same instrument palette as `pf_backdraft92` plus a melody line, sections ≥ loop + 1 bar) with cue `backdraft_spins_loop`. Then:
  - Generate it with `gen_audio.mjs music audio/tools/plans.json pf_backdraftbed92`, then `measure.py draws`, `build_audio.py music --only backdraft_spins_loop`, `mix.py`, `gen_manifest.mjs`.
  - In `presentationDirector.ts`, add a `backdraftSpins` state with `bonusIntro`-style entry and exit (stop the ambience, crossfade to `backdraft_spins_loop` in 600 ms, and `returnToBase` on exit).
  - In `audioDirector.ts:154-169`, call those instead of `addLayer`/`removeLayer`.
  - Keep `backdraft_spins_layer` in the manifest only if the anticipation or base uses it; otherwise drop it from `cues.json` with `roster.py`.
- [ ] Commit with explicit paths: `audio/tools/*`, `audio/cues.json`, `audio/source-record.json`, `audio/PROVENANCE.jsonl`, `audio/masters/<new>.wav`, the shipped `.ogg`/`.m4a`, `cueManifest.ts`, `docs/AUDIO_MAP.md`, and the two director files.

---

## Task 12: Build, gate, recorded motion review, ledger (items 1–5 evidence)

**Files:**
- Modify: `qa/stake-review/ledger.json` and `qa/stake-review/LEDGER.md` (a `fixes_applied` note under iteration 1; iteration 2 only if the owner asks for a new panel)
- Modify: `docs/submission/PRE_UPLOAD_CHECKLIST.md:64` (the motion review line)
- Create: `qa/smoke/review/contract/MOTION_REVIEW_2026-09-26.md`

- [ ] **Step 1: Stage a build.** Run `./tools/build_dist.sh --no-sync`. Expected: exit 0, and `apps/piggy_firefighters/build/provenance.json` stamped with the new HEAD.

- [ ] **Step 2: Owner syncs `game/dist`.** Ask the owner to run `! ./tools/build_dist.sh`; the auto-mode classifier blocks that rsync for the agent. Then run `node qa/gate/run.mjs`. Expected: `qa/gate: all checks passed`, including the five new checks: hud_bar, symbol_motion, splash_no_gradients and rig_beats, plus the existing provenance check against the new `game/dist`.

- [ ] **Step 3: The recorded motion review.** This is one capture pass at both viewports over the moments the panel listed. The server is the staged build or dev; the mock runs on `PORT=3036`.

```bash
for v in 1440x900 390x844; do for f in base_win@off base_win@turbo base_backdraft_win@off base_trigger_rescue@off \
  rescue_building_cleared@off inferno_buy@off backdraft_spins@off alarm_call_false@off max_win@off; do
  GAME_URL=http://127.0.0.1:3003/ RGS_HOST=127.0.0.1:3036 VIEWPORT=$v CAPTURE_EVERY_MS=400 node qa/smoke/review/contract/smoke.mjs $f
done; done
```

Write `MOTION_REVIEW_2026-09-26.md` with one row per moment: spin, anticipation, trigger → door, douse → ladder slide → sheet → badge, building cleared, Backdraft ignition, Backdraft door in/out, Alarm Call including the false-alarm fumble, BIG → MAX climb with one Chief, max-win card, and the phone mascots. Each row gives the viewport, the frame file names, and PASS or a named defect. Fix any defect in the owning task's files before continuing. `results.json` must show `passed: true` and `console_errors: 0` for all 18 runs.

- [ ] **Step 4: Close the checklist line.** In `PRE_UPLOAD_CHECKLIST.md:64`, record "Recorded motion review (gameplay, 1440×900 + 390×844): `qa/smoke/review/contract/MOTION_REVIEW_2026-09-26.md`". Leave the owner's art acceptance line as it is.

- [ ] **Step 5: Ledger note.** In `qa/stake-review/ledger.json` iteration 1, add `"fixes_applied": { "recorded_on": "<today>", "commit": "<HEAD>", "items": ["1 phone mascots on measured HUD bar top", "2 splash gradients -> painted furniture", "3 three-frame symbol wins, Backdraft door cards, painted plates, one Chief on stage, motion review recorded", "4 owner listening pass recorded", "5 per-rescue multiplier climb"] }`. Mirror it in `LEDGER.md`. Do **not** invent seat scores; iteration 2 exists only if the owner asks for a new panel.

- [ ] **Step 6: Commit**

```bash
git add qa/stake-review/ledger.json qa/stake-review/LEDGER.md docs/submission/PRE_UPLOAD_CHECKLIST.md \
  qa/smoke/review/contract/MOTION_REVIEW_2026-09-26.md qa/smoke/review/contract/results.json
git commit -m "qa: recorded motion review at 1440x900 + 390x844; ledger notes the ceiling-raiser fixes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

The coordinator pushes `claude/bold-bell-aoscdj` after the owner's review.

---

## Coverage map (panel item → task)

| Panel item | Task(s) |
|---|---|
| 1 Phone mascots behind the HUD bar (seat B −0.33; all seats) | 2 (capture: 1, 12) |
| 2 Splash CSS-gradient furniture (seat C +0.67 rung) | 5, 6 |
| 3a Authored win animation for L1–L4, W, ALARM, GALARM (and C frames for H1–H4) | 3, 4 |
| 3b Donor LAND/WIN tables and comments | 4 (steps 3, 5, 7, 10) |
| 3c Backdraft Spins entry/exit (door, intro card, outro total card) | 7, 8 |
| 3d Painted feature signs replacing `signPanel.ts` PLACEHOLDER | 5, 7 |
| 3e Big wins staged with the Chief centre stage | 9 |
| 3f Recorded motion review at 1440×900 + 390×844 | 1, 12 |
| 4 Audio judged by ear, plus ambience length and Backdraft bed | 11 (11b is the owner's decision) |
| 5 Signature set piece (rescue slide, climbing multiplier, both viewports) | 10, 12 |

**Spend:** art $10.29 (38 symbol edits + 2 sheets). Audio: none unless the owner opts into 11b (3 SFX draws + 1 music plan).
