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
	import Mascots from './Mascots.svelte';
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

	// Upload every texture to the GPU while the splash is still up (see game/prewarm.ts).
	let prewarmed = false;
	$effect(() => {
		if (prewarmed || !stateApp.loaded || !stateApp.pixiApplication) return;
		prewarmed = true;
		void prewarmTextures(stateApp.pixiApplication, stateApp.loadedAssets as Record<string, unknown>);
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

		<!-- Chief Hamm and Ember beside the reels (rig slots mascotLeft / mascotRight; nothing draws until a rig lands) -->
		<Mascots />

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
