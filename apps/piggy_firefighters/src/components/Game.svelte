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
	import { stateApp } from '../game/stateApp';
	import EnableGameActor from './EnableGameActor.svelte';
	import ResumeBet from './ResumeBet.svelte';
	import AlertSound from './AlertSound.svelte';
	import PlayNotice from './notice/PlayNotice.svelte';
	import UiSound from './UiSound.svelte';
	import Background from './Background.svelte';
	import BoardFrame from './BoardFrame.svelte';
	import Board from './Board.svelte';
	import Anticipations from './Anticipations.svelte';
	import FeatureDrops from './FeatureDrops.svelte';
	import BoardFx from './BoardFx.svelte';
	import Win from './Win.svelte';
	import WinRungs from './WinRungs.svelte';
	import BuildScene from './build/BuildScene.svelte';
	import SceneShutter from './scene/SceneShutter.svelte';
	import BuildOrBust from './build/BuildOrBust.svelte';

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
		return stopChipWatch;
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

		<MainContainer>
			<BoardFrame />
		</MainContainer>

		<MainContainer>
			<Board />
			<Anticipations />
			<BoardFx />
			<FeatureDrops />
		</MainContainer>

		<!-- Standing pig mascot removed at the owner's request (2026-09-19); `mascotReact` broadcasts
		     (game/mascotEvents.ts) have no subscriber. The WILD reel symbol is unaffected. -->

		<BuildScene />
		<BuildOrBust />

		<Win />
		<!-- BIG / SUPER / MEGA / EPIC / MAX: the climbing site sign, for base wins and bonus totals alike -->
		<WinRungs />

		<!-- THE scene transition: the site roller shutter. Art-covered from the first
		     pixel to the last; mode cards ride on it (replaces BuildBonusCard). -->
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
