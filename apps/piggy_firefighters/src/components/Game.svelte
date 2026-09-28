<script lang="ts">
	import { onMount } from 'svelte';

	import { EnablePixiExtension } from 'components-pixi';
	import { EnableHotkey } from 'components-shared';
	import { MainContainer } from 'components-layout';
	import { App } from 'pixi-svelte';

	// ModalError ALONE, not the SDK's <Modals>: every other SDK modal is replaced by the studio HUD, and the
	// generic insufficient-balance popup by the game's own PlayNotice (jurisdiction sweep r1, blocker + advisory 3).
	import ModalError from 'components-ui-html/src/components/ModalError.svelte';
	import { stateBet, stateReplay } from 'state-shared';
	import { stateHud } from '@crashgalaxy/hud';

	import { getContext } from '../game/context';
	import { watchAnteChip } from '../game/stateGame.svelte';
	import { prefetchGameAudio } from '../game/audio';
	import { prewarmTextures } from '../game/prewarm';
	import { ensureFeatureAssets } from '../game/lazyAssets';
	import { quality, measureOnce } from '../game/quality.svelte';
	import { ensureBlurAtlas } from '../game/reels/blurAtlas';
	import { startBeatClock } from '../game/fx/beatClock';
	import { stateApp } from '../game/stateApp';
	import { stateRescue, stateBackdraftSpins, stateAlarmCall } from '../game/rescue/stateRescue.svelte';
	import { stateScene } from '../game/fx/stateScene.svelte';
	import EnableGameActor from './EnableGameActor.svelte';
	import ResumeBet from './ResumeBet.svelte';
	import AlertSound from './AlertSound.svelte';
	import PlayNotice from './notice/PlayNotice.svelte';
	import UiSound from './UiSound.svelte';
	import Background from './Background.svelte';
	import BoardFrame from './BoardFrame.svelte';
	import Board from './Board.svelte';
	import Anticipations from './Anticipations.svelte';
	import BoardFx from './BoardFx.svelte';
	import Paylines from './Paylines.svelte';
	import LinePop from './LinePop.svelte';
	import BackdraftFx from './BackdraftFx.svelte';
	import RescueScene from './rescue/RescueScene.svelte';
	import AlarmCallCard from './AlarmCallCard.svelte';
	import Win from './Win.svelte';
	import WinRungs from './WinRungs.svelte';
	import SceneShutter from './scene/SceneShutter.svelte';

	// Owner, 2026-09-25: the HUD's ALARM BOOST chip hides while a bonus plays unless it is ON (app.html rule keyed on
	// this attribute: `html[data-pff-feature='on'] .ante-chip:not(.ante-chip--on)`). Rescue / Inferno stay active
	// through their outro card, so the chip is gone for the whole feature including the summary.
	$effect(() => {
		const on = stateRescue.active || stateBackdraftSpins.active || stateAlarmCall.active;
		if (typeof document !== 'undefined') document.documentElement.dataset.pffFeature = on ? 'on' : 'off';
	});

	const context = getContext();

	onMount(() => {
		context.stateLayout.showLoadingScreen = true;
		// keeps the board fit honest against the HUD's ante chip at every viewport size
		const stopChipWatch = watchAnteChip();
		// audio bytes start downloading behind the splash; they are decoded on the unlock press
		prefetchGameAudio();
		// dev server only: ?fixture=<name> pins the mock RGS to a deterministic book. The branch is
		// statically false in a production build, so the module never reaches the shipped bundle.
		if (import.meta.env.DEV) {
			void import('../game/devFixture').then(({ initDevFixture }) => initDevFixture());
		}
		// the ambient rig beats (idle every 10 s, reduced-motion changes), docs/ANIMATION_CONTRACT.md
		const stopBeatClock = startBeatClock();
		// DEV ONLY (stripped from production builds): the QA capture driver (qa/phaseb/capture.mjs) reads the scene state
		if (import.meta.env.DEV && typeof window !== 'undefined') {
			(window as unknown as { __pffScene?: unknown }).__pffScene = {
				get rescue() { return stateRescue.active; },
				get rescued() { return stateRescue.rescued; },
				get sprayed() { return stateRescue.rooms.reduce((n, r) => n + r.sprayed, 0); },
				get backdraftSpins() { return stateBackdraftSpins.active; },
				get alarm() { return stateAlarmCall.phase; },
				get covered() { return stateScene.covered; },
				get mood() { return stateScene.mood; },
				get blaze() { return context.stateGame.board.reduce((n, reel) => n + reel.reelState.symbols.filter((s) => s.rawSymbol.blaze).length, 0); },
				get spinning() { return context.stateGame.board.some((reel) => reel.reelState.motion !== 'stopped'); },
				// the 'low' tier's idle frame cap (the $effect below): what it decided and from what
				get idleCap() { return { ...idleCap, maxFPS: stateApp.pixiApplication?.ticker?.maxFPS ?? null }; },
			};
		}
		return () => {
			stopChipWatch();
			stopBeatClock();
		};
	});

	// AN ACTIVE ROUND'S STAKE CANNOT BE CHANGED UNTIL THAT ROUND HAS PLAYED OUT (approval checklist,
	// RGS resume). `/authenticate` seats the bet from the active round's `amount` and parks the round
	// in `stateBet.betToResume`; the HUD locks its bet controls while the game actor is busy, and the
	// resume machine makes it busy as soon as <ResumeBet /> mounts — but that is only after the
	// splash gate, and the HUD is live from the moment the gate opens. `stateHud.betLocked` is the
	// HUD's own second lock on the ladder, the stepper and the buy sheet; holding it for exactly as
	// long as a resumable round is parked closes that window from the other side. The resume machine
	// nulls the slot on the way in and busy takes over; a replay session has no bet controls at all.
	$effect(() => {
		stateHud.betLocked = !stateReplay.active && Boolean(stateBet.betToResume?.active);
	});

	/** One chunk of background work per idle period (requestIdleCallback where it exists, a macrotask elsewhere). */
	const idle = (): Promise<void> =>
		new Promise((resolve) => {
			const ric = (globalThis as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
			if (typeof ric === 'function') ric(() => resolve(), { timeout: 1500 });
			else setTimeout(resolve, 0);
		});

	// Upload every boot texture to the GPU while the splash is still up (game/prewarm.ts), then bake the reel
	// motion-blur atlas in an idle slot (game/reels/blurAtlas.ts is idempotent), so ReelStrips' mount behind the
	// shutter finds it built instead of paying 880 canvas draws on its own frame.
	let prewarmed = false;
	$effect(() => {
		if (prewarmed || !stateApp.loaded || !stateApp.pixiApplication) return;
		prewarmed = true;
		const app = stateApp.pixiApplication;
		void prewarmTextures(app, stateApp.loadedAssets as Record<string, unknown>).then(() =>
			idle().then(() => {
				ensureBlurAtlas(app, stateApp.loadedAssets as Record<string, unknown>);
			}),
		);
	});

	// AFTER THE GATE: the feature art the boot manifest no longer carries (game/lazyAssets.ts) is warmed in idle
	// chunks, in the order a session is likeliest to need it: the win-rung kit, the alarm / mode cards + Sprocket's
	// rig, the max-win cards, the Backdraft plate; then, unless the device is 'low', the Rescue block (decoded only:
	// its upload happens behind the bay door at rescueStart). On 'low' the Rescue set is fetched at rescueStart.
	// The quality tier's one frame-time measurement runs 2 s after the same flip (game/quality.svelte.ts).
	const warmAfterGate = async () => {
		// let the door finish lifting (Splash.svelte LIFT_MS + its margin) before any fetch competes with the first frames
		await new Promise((resolve) => setTimeout(resolve, 1200));
		for (const kind of ['winrungs', 'alarm', 'maxwin', 'backdraft'] as const) {
			await idle();
			await ensureFeatureAssets(kind);
		}
		if (quality.tier !== 'low') {
			await idle();
			await ensureFeatureAssets('rescue', { upload: false });
		}
	};
	let gated = false;
	$effect(() => {
		// `loaded` (reactive) rather than the Application object: init() has certainly run by then, so the ticker exists
		if (gated || context.stateLayout.showLoadingScreen || !stateApp.loaded || !stateApp.pixiApplication) return;
		gated = true;
		const app = stateApp.pixiApplication;
		setTimeout(() => measureOnce(app), 2000);
		void warmAfterGate();
	});

	let idleCap = { restful: false, tier: quality.tier, busy: false, covered: false, machineIdle: false, reelsStopped: false };
	// 'low' TIER ONLY: while nothing at all is happening (board idle: the round machine idle, every reel at rest — the
	// same facts components/Board.svelte mirrors into boardLife.idle — no feature, no reveal beat, no shutter) the
	// renderer runs at 30 fps; any change restores the uncapped rate through this same effect, i.e. on the spin press
	// before a reel lets go. The rate is never touched while a reel or a director beat is active.
	$effect(() => {
		// pixi-svelte assigns the Application before init() installs its ticker, and the ticker itself is not reactive:
		// `loaded` (assets load only after init) is the dependency that brings this effect back once the ticker exists
		const ticker = stateApp.loaded ? stateApp.pixiApplication?.ticker : undefined;
		if (!ticker) return;
		const machineIdle = context.stateXstateDerived.isIdle();
		const reelsStopped = context.stateGame.board.every((reel) => reel.reelState.motion === 'stopped');
		const restful =
			quality.tier === 'low' &&
			!context.stateLayout.showLoadingScreen &&
			!stateScene.busy &&
			!stateScene.covered &&
			!stateRescue.active &&
			!stateBackdraftSpins.active &&
			!stateAlarmCall.active &&
			machineIdle &&
			reelsStopped;
		idleCap = { restful, tier: quality.tier, busy: stateScene.busy, covered: stateScene.covered, machineIdle, reelsStopped };
		ticker.maxFPS = restful ? 30 : 0;
		return () => {
			ticker.maxFPS = 0;
		};
	});

	// The stock pixi <UI> bet bar and the SDK buy/autoplay/rules modals are gone:
	// the studio HUD (@crashgalaxy/hud, mounted in +layout.svelte) replaces them.
	// Of the SDK's <Modals> only ModalError is still mounted; the insufficient-balance
	// and autoplay-limit notices are the game's own <PlayNotice /> (HUD INTEGRATION §6b).
	//
	// The donor Pixi loading screen is gone too: the studio DOM splash (components/Splash.svelte, mounted in
	// +layout.svelte) owns the whole boot surface now. It reads the SAME
	// `stateApp.loadingProgress` / `stateApp.loaded`, shows the progress bar and
	// the press-anywhere gate, and on dismiss flips `showLoadingScreen` false —
	// which reveals the board below — and stamps `data-splash-handoff` for the HUD.
	// While `showLoadingScreen` is true this branch renders nothing but the
	// always-on Background, hidden under the splash.
</script>

<App>
	<EnableHotkey />
	<EnableGameActor />
	<EnablePixiExtension />

	<!-- Insufficient-balance alert cue: a reactive watch on the SDK modal state
	     (game/audio), fired exactly once per alert entry. Owns no visuals. -->
	<AlertSound />
	<UiSound />

	<Background />

	{#if context.stateLayout.showLoadingScreen}
		<!-- Splash (DOM, +layout.svelte) covers this; the board waits below. -->
	{:else}
		<ResumeBet />

		<MainContainer>
			<BoardFrame />
		</MainContainer>

		<MainContainer>
			<Board />
			<Anticipations />
			<!-- line paths through the cell centres, over the symbols, under the bursts and the pops -->
			<Paylines />
			<BoardFx />
			<BackdraftFx />
			<LinePop />
		</MainContainer>

		<MainContainer>
			<!-- the Rescue block above the reels (rooms, ladder, hose, badge, plates) + Backdraft Spins plate + the feature
			     banner; over the reels so a water jet can cross the board on its way to a window -->
			<RescueScene />
		</MainContainer>

		<Win />
		<!-- BIG / HUGE / MEGA / EPIC / MAX: the climbing sign, for base wins and feature totals alike -->
		<WinRungs />

		<!-- Alarm Call: the dispatch card (press to continue) -->
		<AlarmCallCard />

		<!-- THE scene transition: Station 13's bay door. Art-covered from the first pixel to the last; the mode
		     cards (Rescue / Inferno intro, feature total) ride on it. -->
		<SceneShutter />
	{/if}
</App>

<ModalError />
<PlayNotice />

<style>
	/* Carried over from the SDK's <Modals> (no longer mounted) so every rem-sized surface keeps its size:
	   ModalError and the HUD's one rem rule on phones. */
	:global(html) {
		font-size: 16px;
	}
	@media screen and (max-width: 500px) {
		:global(html) {
			font-size: 50%;
		}
	}
</style>
