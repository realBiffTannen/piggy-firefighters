<script lang="ts" module>
	import type { WinLevelData } from '../game/winLevelMap';

	export type EmitterEventWin =
		| { type: 'winShow' }
		| { type: 'winHide' }
		| { type: 'winUpdate'; amount: number; winLevelData: WinLevelData };

	/** Book amounts are integers x100 of the base bet. The COIN shower AND the count-up are reserved for
	 *  wins ABOVE 20x (owner rules, 2026-09-19 and 2026-09-20: "get rid of coin countups on small wins").
	 *  A win of 20x or less shows its final figure at once. */
	export const COIN_COUNTUP_MIN_AMOUNT = 20 * 100;
</script>

<script lang="ts">
	// THE WIN NUMBER. A small win (20x or less) does NOT count up: the final figure appears at once and
	// lands with a small punch. Above 20x the coin shower and the tier count-up take over (quick off the
	// mark with a long soft landing, game/reels/winMeter.ts `winRollEase`).
	// The HUD hides its own WIN meter while this overlay owns the win (one figure on screen at a time);
	// when the overlay leaves, the meter rolls up to the round total with the same easing (`setTotalWin`
	// in game/bookEventHandlerMap.ts -> game/reels/winMeter.ts).
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
	import { SYMBOL_SIZE } from '../game/constants';
	import { getContext } from '../game/context';
	import { formatBookAmount } from '../game/money';
	import { isSuperTurbo } from '../game/stateSpeed.svelte';
	import { prefersReducedMotion } from '../game/fx/timing';
	import { boardTicker } from '../game/reels/boardTicker';
	import { winRollEase } from '../game/reels/winMeter';

	const context = getContext();

	let show = $state(false);
	let isCoinWin = $state(false);
	let counting = $state(false);
	let active = $state(false);
	let oncomplete = () => {};

	/* eslint-disable @typescript-eslint/no-explicit-any */
	let root: PIXI.Container | undefined;
	let label: any;
	let amount = 0;
	let elapsed = 0;
	let duration = 0;
	let holdLeft = 0;
	let punch = -1; // ms since landing, -1 = not landed
	let fit = 1;
	let shownText = '';
	let needsSetup = false;
	const PUNCH_MS = 300;

	const setText = (text: string) => {
		if (!label || text === shownText) return;
		shownText = text;
		label.text = text;
	};

	const land = () => {
		if (!counting) return;
		counting = false;
		setText(formatBookAmount(amount));
		punch = 0;
	};

	const setup = () => {
		needsSetup = false;
		label.style.fontSize = SYMBOL_SIZE * (isCoinWin ? 1.5 : 0.85);
		// fit the FINAL figure once; the count never resizes the line
		shownText = '';
		label.scale.set(1);
		setText(formatBookAmount(amount));
		const maxWidth = context.stateGameDerived.boardLayout().width * 0.92;
		fit = Math.min(1, maxWidth / Math.max(1, label.width));
		setText(formatBookAmount(counting ? 0 : amount));
		label.scale.set(fit * (counting ? 0.9 : 1));
	};

	const tick = (dt: number) => {
		if (!active || !label) return;
		if (needsSetup) setup();
		if (counting) {
			elapsed += dt;
			const u = Math.min(1, elapsed / duration);
			setText(formatBookAmount(Math.floor(amount * winRollEase(u))));
			// the figure swells a little as it climbs
			label.scale.set(fit * (0.9 + 0.1 * winRollEase(u)));
			if (u >= 1) land();
			return;
		}
		if (punch >= 0 && punch < PUNCH_MS) {
			punch += dt;
			const p = Math.min(1, punch / PUNCH_MS);
			// one overshoot and a settle: 1 -> 1.16 -> 0.985 -> 1
			const k = prefersReducedMotion() ? 0 : Math.exp(-4.2 * p) * Math.sin(p * Math.PI * 2.2) * (1 - p);
			label.scale.set(fit * (1 + 0.3 * k));
		} else {
			label.scale.set(fit);
		}
		holdLeft -= dt;
		if (holdLeft <= 0) {
			active = false;
			oncomplete();
		}
	};

	const begin = (value: number, winLevelData: WinLevelData) => {
		amount = value;
		isCoinWin = value > COIN_COUNTUP_MIN_AMOUNT;
		const turbo = stateBet.isTurbo;
		// small wins: no count-up, the figure is simply there (duration 0 -> `counting` stays false below)
		duration = isCoinWin ? Math.max(winLevelData?.presentDuration ?? 0, 2200) * (turbo ? 0.5 : 1) : 0;
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
		elapsed = 0;
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
		root = node;
		label?.destroy();
		label = new PIXI.BitmapText({
			text: '',
			style: { fontFamily: 'gold', fontSize: SYMBOL_SIZE * 0.85, align: 'center' },
		});
		label.anchor.set(0.5);
		// the gold font's ink sits ~0.10 x fontSize below a Pixi 8 BitmapText anchor (see WinRungs GOLD_INK_DY)
		label.position.y = -SYMBOL_SIZE * 0.85 * 0.1;
		root.addChild(label);
	};

	onMount(() => {
		boardTicker.add(tick);
		return () => {
			boardTicker.remove(tick);
			label?.destroy();
			label = undefined;
		};
	});
</script>

<!-- `persistent`: the number's display objects are built once with the board, not on the win beat (a
     mount there measured as the longest frame of a winning round on a slow CPU) -->
<FadeContainer {show} persistent>
	{#if isCoinWin}
		<CanvasSizeRectangle backgroundColor={0x0b1c26} backgroundAlpha={0.45} />
		<!-- coins fly BEHIND the amount: the number is always the clearest thing on screen -->
		<WinCoins emit={counting} />
	{/if}

	<MainContainer zIndex={10}>
		<Container x={context.stateGameDerived.boardLayout().x} y={context.stateGameDerived.boardLayout().y}>
			<Grab ongrab={build} />
		</Container>
	</MainContainer>

	{#if active}
		<OnHotkey hotkey="Space" onpress={press} />
		<OnPressFullScreen onpress={press} />
	{/if}
</FadeContainer>
