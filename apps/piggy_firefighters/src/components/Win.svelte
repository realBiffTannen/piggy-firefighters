<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };

	import { SMALL_WIN_MAX_BOOKED } from '../game/roundTier';

	/** Book amounts are integers x100 of the base bet. The COIN shower AND the count-up are reserved for
	 *  wins ABOVE 20x (owner rules, 2026-09-19 and 2026-09-20: "get rid of coin countups on small wins").
	 *  Since 2026-09-25 a win of 20x or less is not shown here at all (game/bookEventHandlerMap.ts
	 *  `showOrdinaryWin` skips this overlay; the HUD WIN meter carries the figure). */
	export const COIN_COUNTUP_MIN_AMOUNT = SMALL_WIN_MAX_BOOKED;
</script>

<script lang="ts">
	// THE WIN NUMBER. A small win (20x or less) does NOT count up: the final figure appears at once and
	// lands with a small punch. Above 20x the coin shower and the tier count-up take over (quick off the
	// mark with a long soft landing, game/reels/winMeter.ts `winRollEase`).
	// The HUD hides its own WIN meter while this overlay owns the win (one figure on screen at a time);
	// when the overlay leaves, the meter rolls up to the round total with the same easing (`setTotalWin`
	// in game/bookEventHandlerMap.ts -> game/reels/winMeter.ts).
	//
	// The figure sits on its own plaque (dark dusk navy, brass rim, ink outline; game/winCoinFountain.ts plaqueFor) so
	// it reads over any board, and the coin fountains rise out from BEHIND the plaque (components/WinCoins.svelte): the
	// digits are never dimmed and never crossed. Figure, plaque and fountains share one board-scaled frame (board
	// units, SYMBOL_SIZE per cell) so they keep their proportions on every layout.
	//
	// The plaque is sized on the figure's REAL ink (the gold font's glyph boxes: the '$' rises above the digits, the
	// comma's tail drops below them; game/winCoinFountain.ts inkBoxOf) and the figure is centred on that ink at every
	// scale the count uses (labelAt), so nothing crosses the rim. The count holds its first figure while the overlay
	// fades in, is capped for a per-spin win (countMs), lands without a cents-only stall (countLands), and the figure
	// fades out inside its own hold, so no ghost plaque rides over the next spin when the overlay's fade-out starts.
	//
	// The number is a PIXI.BitmapText driven from the board ticker: its text is only touched when the
	// formatted string actually changes, its scale is written straight onto the display object, and no
	// reactive prop runs at 60 Hz. Space / a press finishes the count at once, then dismisses.
	import { onMount } from 'svelte';
	import { Container, PIXI } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';
	import { CanvasSizeRectangle, MainContainer, OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';
	import { stateBet } from 'state-shared';

	import WinCoins from './WinCoins.svelte';
	import Grab from './scene/Grab.svelte';
	import { BOARD_SIZES, SYMBOL_SIZE } from '../game/constants';
	import { getContext } from '../game/context';
	import { formatBookAmount } from '../game/money';
	import { isSuperTurbo } from '../game/stateSpeed.svelte';
	import { prefersReducedMotion } from '../game/fx/timing';
	import { ease } from '../game/fx/motion';
	import { boardTicker } from '../game/reels/boardTicker';
	import { winRollEase } from '../game/reels/winMeter';
	import {
		PLAQUE_STYLE,
		WIN_FADE_MS,
		WIN_LAYER,
		countLands,
		countLeadMs,
		countMs,
		inkBoxOf,
		labelAt,
		outroMs,
		plaqueFor,
		plaqueMaxW,
		punchScale,
		type BitmapFontMetrics,
		type InkBox,
		type PlaqueBox,
	} from '../game/winCoinFountain';

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());

	let show = $state(false);
	let isCoinWin = $state(false);
	let counting = $state(false);
	let active = $state(false);
	/** the fountains spawn only while the figure counts (coins in the air finish their flight) */
	let coinsOn = $state(false);
	/** the plaque in board units, for the fountains; written once per win (a change while emitting restarts them) */
	let plaque = $state({ w: 480, h: 120 });
	let oncomplete = () => {};

	/* eslint-disable @typescript-eslint/no-explicit-any */
	let badge: PIXI.Container | undefined; // plate + label: the punch and the entrance scale them together
	let plate: PIXI.Graphics | undefined;
	let label: any;
	let amount = 0;
	let elapsed = 0;
	let duration = 0;
	let holdLeft = 0;
	let holdTotal = 0;
	let punch = -1; // ms since landing, -1 = not landed
	let intro = -1; // ms since the badge appeared, -1 = settled
	let fit = 1;
	let fontSize = SYMBOL_SIZE * 1.5;
	let ink: InkBox = { w: 0, cx: 0, top: 0, bottom: 0 };
	let shownText = '';
	let needsSetup = false;
	const PUNCH_MS = 300;
	const INTRO_MS = 240;

	/** The gold font's glyph metrics (Pixi caches a loaded bitmap font as `<family>-bitmap`), read once. */
	let goldMetrics: BitmapFontMetrics | null = null;
	const goldFont = (): BitmapFontMetrics | null => {
		if (goldMetrics) return goldMetrics;
		if (!PIXI.Cache.has('gold-bitmap')) return null;
		const font = PIXI.Cache.get('gold-bitmap') as PIXI.BitmapFont | undefined;
		if (!font?.chars) return null;
		const chars: BitmapFontMetrics['chars'] = {};
		for (const [c, d] of Object.entries(font.chars)) {
			chars[c] = { xOffset: d.xOffset, yOffset: d.yOffset, xAdvance: d.xAdvance, width: d.texture?.width ?? 0, height: d.texture?.height ?? 0 };
		}
		goldMetrics = { size: font.baseMeasurementFontSize, lineHeight: font.lineHeight, baseLineOffset: font.baseLineOffset, chars };
		return goldMetrics;
	};

	/** The widest plaque this viewport allows (board units): 90 % of the board, and at the punch's peak inside 95 % of the
	 *  screen (a phone's board runs edge to edge). */
	const maxPlaqueW = () => {
		const sl = context.stateGameDerived.sceneLayout();
		const viewW = sl.cell > 0 ? (sl.canvas.width * SYMBOL_SIZE) / sl.cell : BOARD_SIZES.width;
		return plaqueMaxW(BOARD_SIZES.width, viewW);
	};

	/** Scale the figure and keep its ink box centred on the plaque. */
	const placeLabel = (s: number) => {
		label.scale.set(s);
		const at = labelAt(ink, s);
		label.position.set(at.x, at.y);
	};

	// DEV ONLY (stripped from production builds): lets a capture script find the count-up
	const devMark = (state: 'counting' | 'landed' | 'idle') => {
		if (import.meta.env.DEV && typeof document !== 'undefined') {
			document.documentElement.dataset.pfWinFigure = state;
			document.documentElement.dataset.pfWinText = shownText;
		}
	};

	const setText = (text: string) => {
		if (!label || text === shownText) return;
		shownText = text;
		label.text = text;
	};

	const land = () => {
		if (!counting) return;
		counting = false;
		coinsOn = false;
		setText(formatBookAmount(amount));
		placeLabel(fit);
		punch = 0;
		devMark('landed');
	};

	/** The plaque: flat cel (one hard shadow tone), thick ink outline, brass rim with a rivet pair at each end. */
	const drawPlate = (g: PIXI.Graphics, b: PlaqueBox) => {
		const { w, h, r, ink: line, rimW } = b;
		const x = -w / 2;
		const y = -h / 2;
		g.clear();
		g.roundRect(x - line, y - line, w + 2 * line, h + 2 * line, r + line).fill({ color: PLAQUE_STYLE.ink });
		g.roundRect(x, y, w, h, r).fill({ color: PLAQUE_STYLE.rim });
		g.moveTo(x + r, y + rimW * 0.42)
			.lineTo(x + w - r, y + rimW * 0.42)
			.stroke({ width: Math.max(1, rimW * 0.34), color: PLAQUE_STYLE.rimLight, cap: 'round' });
		const ix = x + rimW;
		const iy = y + rimW;
		const iw = w - 2 * rimW;
		const ih = h - 2 * rimW;
		const ir = Math.max(1, r - rimW);
		const k = line * 0.5;
		g.roundRect(ix - k, iy - k, iw + 2 * k, ih + 2 * k, ir + k).fill({ color: PLAQUE_STYLE.ink });
		g.roundRect(ix, iy, iw, ih, ir).fill({ color: PLAQUE_STYLE.fill, alpha: PLAQUE_STYLE.fillAlpha });
		// the one hard shadow tone: the field's lower band, square on top, following the field's round bottom corners
		const top = iy + ih * 0.6;
		g.moveTo(ix, top)
			.lineTo(ix + iw, top)
			.lineTo(ix + iw, iy + ih - ir)
			.arcTo(ix + iw, iy + ih, ix + iw - ir, iy + ih, ir)
			.lineTo(ix + ir, iy + ih)
			.arcTo(ix, iy + ih, ix, iy + ih - ir, ir)
			.closePath()
			.fill({ color: PLAQUE_STYLE.shade });
		for (const p of b.rivets) {
			g.circle(p.x, p.y, b.rivetR + k).fill({ color: PLAQUE_STYLE.ink });
			g.circle(p.x, p.y, b.rivetR).fill({ color: PLAQUE_STYLE.rim });
			g.circle(p.x - b.rivetR * 0.32, p.y - b.rivetR * 0.32, b.rivetR * 0.32).fill({ color: PLAQUE_STYLE.rimLight });
		}
	};

	const setup = () => {
		needsSetup = false;
		fontSize = SYMBOL_SIZE * (isCoinWin ? 1.5 : 0.85);
		label.style.fontSize = fontSize;
		// fit the FINAL figure and its plaque once, on the figure's real ink; the count never resizes the line
		shownText = '';
		label.scale.set(1);
		const final = formatBookAmount(amount);
		setText(final);
		ink = inkBoxOf(final, label.width, fontSize, goldFont());
		const box = plaqueFor(ink, maxPlaqueW());
		fit = box.fit;
		if (plate) drawPlate(plate, box);
		setText(formatBookAmount(counting ? 0 : amount));
		placeLabel(fit * (counting ? 0.9 : 1));
		if (badge) badge.alpha = 1;
		// the fountains read the plaque; plaque + emit change in the same frame, so the emitter starts once
		plaque = { w: box.w, h: box.h };
		coinsOn = counting && isCoinWin && !prefersReducedMotion();
		intro = prefersReducedMotion() ? -1 : 0;
		badge?.scale.set(intro >= 0 ? 0.82 : 1);
		devMark(counting ? 'counting' : 'landed');
	};

	const tick = (dt: number) => {
		if (!active || !label) return;
		if (needsSetup) setup();
		if (intro >= 0 && badge) {
			intro += dt;
			const p = Math.min(1, intro / (stateBet.isTurbo ? INTRO_MS * 0.6 : INTRO_MS));
			badge.scale.set(0.82 + 0.18 * ease.backOut(p));
			if (p >= 1) intro = -1;
		}
		if (counting) {
			// `elapsed` starts below 0: the first figure holds while the overlay fades in
			elapsed += dt;
			const u = Math.min(1, Math.max(0, elapsed) / duration);
			const e = winRollEase(u);
			const value = Math.floor(amount * e);
			if (u >= 1 || countLands(value, amount)) {
				land();
				return;
			}
			setText(formatBookAmount(value));
			// the figure swells a little as it climbs (inside its plaque)
			placeLabel(fit * (0.9 + 0.1 * e));
			return;
		}
		holdLeft -= dt;
		const outro = prefersReducedMotion() ? 0 : outroMs(holdTotal);
		if (punch >= 0 && punch < PUNCH_MS) {
			punch += dt;
			// one overshoot and a settle, plate and figure together (a heavy plaque, a small kick)
			badge?.scale.set(prefersReducedMotion() ? 1 : punchScale(punch / PUNCH_MS));
		} else if (holdLeft > 0 && holdLeft < outro) {
			// the figure leaves inside its own hold: gone before the overlay's fade-out and the next spin
			const q = holdLeft / outro;
			if (badge) {
				badge.alpha = q;
				badge.scale.set(0.95 + 0.05 * q);
			}
		} else if (intro < 0) {
			badge?.scale.set(1);
		}
		if (holdLeft <= 0) {
			active = false;
			coinsOn = false;
			// never a ghost: whatever cut the hold short, the figure is gone before the round resumes
			if (badge) badge.alpha = 0;
			devMark('idle');
			oncomplete();
		}
	};

	const begin = (value: number, winLevelData: WinLevelData) => {
		amount = value;
		isCoinWin = value > COIN_COUNTUP_MIN_AMOUNT;
		const turbo = stateBet.isTurbo;
		// small wins: no count-up, the figure is simply there (duration 0 -> `counting` stays false below). Above 20x the
		// tier pace, capped for a per-spin win (game/winCoinFountain.ts countMs); the fade-in lead comes out of it.
		duration = isCoinWin ? countMs(winLevelData?.presentDuration ?? 0, turbo) : 0;
		const lead = countLeadMs(duration);
		// THE DWELL — how long the figure stays after it lands (owner, 2026-09-20).
		//
		// A small win used to leave in ~480 ms, too fast to read. It now holds ~2 s, but ONLY when
		// nothing is waiting on it: `setWin` in game/bookEventHandlerMap.ts awaits this overlay, so
		// the dwell is round time. An autoplay run, a held space bar and both fast tiers therefore
		// keep the old short dwell, and a press still cuts any of them short (`press` below).
		// Above 20x the card dwells longer too, so the total gets a beat.
		const unattended = stateBet.autoSpinsCounter <= 0 && !stateBet.isSpaceHold;
		holdLeft = isCoinWin
			? isSuperTurbo()
				? 500
				: turbo
					? 700
					: 1000
			: isSuperTurbo()
				? 110
				: turbo
					? 240
					: unattended
						? 2000
						: 480;
		holdTotal = holdLeft;
		elapsed = -lead;
		duration -= lead;
		punch = -1;
		needsSetup = true;
		counting = duration > 0;
		if (!counting) punch = 0;
		active = true;
	};

	context.eventEmitter.subscribeOnMount({
		winShow: () => (show = true),
		winHide: () => (show = false),
		winUpdate: async (emitterEvent) => {
			begin(emitterEvent.amount, emitterEvent.winLevelData);
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});

	const press = () => {
		if (!active) return;
		if (counting) land();
		else holdLeft = 0;
	};

	const build = (node: PIXI.Container) => {
		badge?.destroy({ children: true });
		badge = new PIXI.Container();
		plate = new PIXI.Graphics();
		label = new PIXI.BitmapText({
			text: '',
			style: { fontFamily: 'gold', fontSize: SYMBOL_SIZE * 0.85, align: 'center' },
		});
		label.anchor.set(0.5);
		badge.alpha = 0; // placed and shown by setup() on the first win
		badge.addChild(plate, label);
		node.addChild(badge);
	};

	onMount(() => {
		boardTicker.add(tick);
		return () => {
			boardTicker.remove(tick);
			badge?.destroy({ children: true });
			badge = undefined;
			plate = undefined;
			label = undefined;
		};
	});
</script>

<!-- `persistent`: the number's display objects are built once with the board, not on the win beat (a
     mount there measured as the longest frame of a winning round on a slow CPU).
     Draw order: each layer is a zIndexed DIRECT child of this FadeContainer's container (dimmer < coins < figure).
     pixi-svelte appends a late mount at the end of its parent, so source order alone never decided it (the figure used
     to sit under its own dimmer and coins), and MainContainer applies a zIndex to its INNER container only. -->
<FadeContainer {show} persistent duration={WIN_FADE_MS}>
	<Container zIndex={WIN_LAYER.dimmer} visible={isCoinWin}>
		<CanvasSizeRectangle backgroundColor={0x0b1c26} backgroundAlpha={0.45} />
	</Container>

	<Container zIndex={WIN_LAYER.coins}>
		<WinCoins emit={coinsOn} {plaque} />
	</Container>

	<Container zIndex={WIN_LAYER.figure}>
		<MainContainer>
			<Container x={layout.x} y={layout.y} scale={layout.scale}>
				<Grab ongrab={build} />
			</Container>
		</MainContainer>
	</Container>

	{#if active}
		<OnHotkey hotkey="Space" onpress={press} />
		<OnPressFullScreen onpress={press} />
	{/if}
</FadeContainer>
