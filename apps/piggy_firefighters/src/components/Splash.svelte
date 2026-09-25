<script lang="ts">
	/**
	 * LUCKY — the game's own DOM loading splash.
	 *
	 * Replaces the upstream web-sdk boot loaders (the two placeholder loader GIFs
	 * that used to mount in +layout.svelte). It is a DOM overlay ABOVE the Pixi
	 * canvas and the studio HUD, so nothing player-facing shows a donor loader or
	 * the donor Pixi splash.
	 *
	 * What is on it, in draw order:
	 *   - the ground (LUCKY: lacquer-red night, faint gold lattice, carved gold beams top and bottom);
	 *   - ONE wordmark;
	 *   - the intro-card deck (splash/SplashDeck.svelte, copy in splash/copy.ts);
	 *   - a real progress bar driven by the app's OWN asset load
	 *     (`stateApp.loadingProgress` / `stateApp.loaded`), not a fake timer;
	 *   - a press-anywhere gate that appears only once loading is genuinely done,
	 *     and that DOUBLES AS THE AUDIO-UNLOCK GESTURE (see `unlockAudio` below);
	 *   - a small publisher line kept on the loading surface for its life.
	 *
	 * THE PRESS IS NOT A PLAY. This overlay sits over everything and swallows the
	 * gesture (`stopPropagation` + `preventDefault`); the game's spin hotkey and
	 * spin button only come alive AFTER this splash flips `showLoadingScreen`
	 * false. The hand-off below keeps the game live BEHIND the shutter for a
	 * moment, so for that window the splash also holds the HUD's press gate
	 * (`holdPressGate`, the same one SceneShutter holds) and the shutter swallows
	 * every pointer and Space/Enter: no press during the transition can spin.
	 *
	 * HAND-OFF — "open the site". On the press this:
	 *   (1) calls `unlockAudio()` synchronously, inside the user gesture;
	 *   (2) slams the site's yellow roller shutter down over the splash (the same
	 *       art SceneShutter.svelte uses for every scene change in the game);
	 *   (3) with the shutter SHUT, does the hand-off proper, unchanged and in its
	 *       original order — `context.stateLayout.showLoadingScreen = false` so
	 *       Game.svelte mounts the board, then `html[data-splash-handoff='true']`
	 *       so the studio HUD bar / ante chip un-hide, then the splash unmounts;
	 *   (4) waits for the game to have painted behind the shutter, then rattles the
	 *       shutter up in three hauls to reveal it.
	 * The shutter is DOM + CSS keyframes (they run on the compositor, so the board
	 * mounting on the main thread cannot stutter them). No frame of it is black or
	 * blank: a painted steel colour sits under the slats while they decode.
	 * `html[data-splash-shutter]` reports drop → closed → lift → done for captures.
	 * Reduced motion: no shutter — the same hand-off, then a 250 ms cross-fade.
	 *
	 * WORDMARK. `static/assets/branding/wordmark.png`; if it ever fails to load,
	 * `onerror` keeps the CSS text lockup showing and nothing breaks.
	 *
	 * A REPLAY SESSION GETS NONE OF THE ABOVE: no ground, no deck, no gate, no
	 * shutter. It hands off by itself as soon as the assets are in. See
	 * `replayLaunch` below, and game/replayLaunch.ts for why.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { base } from '$app/paths';
	import { holdPressGate } from '@crashgalaxy/hud';

	import { getContext } from '../game/context';
	import { unlockAudio as engageAudio, subscribeGameAudio } from '../game/audio';
	import { audioDirector } from '../game/build/audioDirector';
	import SplashDeck from './splash/SplashDeck.svelte';
	import { SPLASH_SHUTTER, splashAssetUrl, splashText } from './splash/copy';
	import { isReplayLaunch } from '../game/replayLaunch';
	import { GAME_TITLE } from '../game/names';

	const context = getContext();

	/**
	 * REPLAY: NO SPLASH AT ALL (owner, 2026-09-20).
	 *
	 * A replay link is opened to look at ONE recorded round. Nothing on this
	 * overlay serves that: the advert deck sells features the viewer is not
	 * about to play, and the press-anywhere gate is a second press in front of
	 * the START REPLAY card the HUD already shows. So in a replay session this
	 * component renders nothing — no ground, no wordmark, no deck, no gate, no
	 * shutter — and instead performs the hand-off by itself the moment the
	 * assets are in: `showLoadingScreen` false so the board mounts UN-STARTED,
	 * and `data-splash-handoff` so the HUD's replay bar and its pre-roll card
	 * come up in the same frame, over the board. The publisher bumper is
	 * skipped from +layout.svelte for the same reason.
	 *
	 * It still MOUNTS in replay, because `subscribeGameAudio` below is the one
	 * registration of the emitter -> audio-manager bridge for the session.
	 *
	 * AUDIO. Losing the press means losing the gesture that unlocks WebAudio, so
	 * a replay session unlocks on the first gesture the player makes anywhere —
	 * in practice the START REPLAY press, which is exactly the beat the splash
	 * press used to be. See `armReplayAudioUnlock` below.
	 */
	const replayLaunch = isReplayLaunch();

	// Register the emitter → audio-manager bridge during component init (it uses
	// subscribeOnMount). Splash lives for the whole session, so this is the one
	// place the manager hears the HUD's button broadcasts and Build-or-Bust
	// anticipation/bust without touching any scene component.
	subscribeGameAudio(context.eventEmitter);

	// `base` keeps it correct under a versioned subpath deploy.
	const wordmarkSrc = `${base}/assets/branding/wordmark.png`;

	// Shutter art, resolved against the page (see splash/copy.ts).
	const slatsUrl = splashAssetUrl(SPLASH_SHUTTER.slatsTile);
	const barUrl = splashAssetUrl(SPLASH_SHUTTER.bottomBar);

	const copy = {
		aria: splashText('SPLASH_ARIA'),
		loading: splashText('SPLASH_LOADING'),
		press: splashText('SPLASH_PRESS'),
	};

	let dismissed = $state(false);
	let wordmarkOk = $state(false);

	const prefersReducedMotion =
		typeof window !== 'undefined' &&
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Safety net: if asset load ever stalls, don't trap the player behind the
	// splash forever — allow the gate after a generous grace period.
	let graceElapsed = $state(false);
	onMount(() => {
		const id = setTimeout(() => (graceElapsed = true), 12000);
		const disarm = replayLaunch ? armReplayAudioUnlock() : null;
		return () => {
			clearTimeout(id);
			disarm?.();
		};
	});

	const progress = $derived(Math.max(0, Math.min(100, context.stateApp.loadingProgress)));
	const ready = $derived(context.stateApp.loaded || graceElapsed);

	// Warm the shutter art (41 KB) so the first frame of the drop is already the
	// real slats. It is not drawn until the press, so it must never share the
	// wire with the first card: it is requested once card 1 has landed, or when
	// the gate comes up, whichever is first. If the press still beats it, the
	// door's painted steel and hazard paint stand in — never a void.
	let shutterWarmed = false;
	const warmShutter = () => {
		if (shutterWarmed || typeof Image === 'undefined') return;
		shutterWarmed = true;
		for (const url of [slatsUrl, barUrl]) {
			if (!url) continue;
			const img = new Image();
			img.decoding = 'async';
			img.src = url;
		}
	};
	$effect(() => {
		if (ready) warmShutter();
	});

	/**
	 * AUDIO-UNLOCK HOOK — the one gesture that starts sound.
	 *
	 * This runs inside the dismiss gesture (pointerup / keydown), a valid
	 * user-activation for WebAudio. It creates + resumes the shared AudioContext
	 * and starts the base music bed on the shared grid. It is idempotent and
	 * never throws — if audio cannot start, the game plays on silently.
	 */
	const unlockAudio = () => {
		engageAudio();
	};

	// ---- the hand-off -------------------------------------------------------------
	type ShutterPhase = 'off' | 'drop' | 'closed' | 'lift';
	// Budget: ~1.1 s press-to-clear on a desktop GPU. The drop and the lift are
	// fixed; the hold is however long the board takes to mount and paint (~150 ms).
	const DROP_MS = 420; // fall 235 + two bounces, see @keyframes shutter-drop
	const IMPACT_MS = 235; // the bar first hits the sill (56% of the drop)
	const HOLD_MS = 30; // shut, before we even ask whether the board has painted
	const LIFT_MS = 540; // three hauls, see @keyframes shutter-lift
	const HAULS_MS = [0, 195, 390]; // when each haul starts, inside the lift
	const CROSSFADE_MS = 250;

	let pressed = $state(false);
	let phase = $state<ShutterPhase>('off');
	let releaseGate: (() => void) | null = null;
	const timers = new Set<ReturnType<typeof setTimeout>>();
	const later = (fn: () => void, ms: number) => {
		const id = setTimeout(() => {
			timers.delete(id);
			fn();
		}, ms);
		timers.add(id);
	};

	const stamp = (value: string) => {
		if (typeof document !== 'undefined') document.documentElement.dataset.splashShutter = value;
	};

	/** The hand-off proper: the three original effects, in their original order. */
	const reveal = () => {
		if (dismissed) return;
		context.stateLayout.showLoadingScreen = false;
		if (typeof document !== 'undefined') {
			document.documentElement.dataset.splashHandoff = 'true';
		}
		dismissed = true;
	};

	/** Idempotent end of the transition: nothing left over the game, gate released. */
	const finish = () => {
		reveal(); // a failsafe path can land here first; the game must still open
		phase = 'off';
		releaseGate?.();
		releaseGate = null;
		timers.forEach(clearTimeout);
		timers.clear();
		stamp('done');
	};

	const lift = () => {
		if (phase !== 'closed') return;
		phase = 'lift';
		stamp('lift');
		HAULS_MS.forEach((ms, n) => later(() => phase === 'lift' && audioDirector.shutterHaul?.(n + 1), ms));
		later(finish, LIFT_MS + 160); // animationend normally gets there first
	};

	const closed = () => {
		if (phase !== 'drop') return;
		phase = 'closed';
		stamp('closed');
		reveal();
		// Lift only once the game has produced a frame behind the shutter: two
		// animation frames after the flip (rAF waits for the mount work), with a
		// timer beside it because rAF never fires in a hidden tab.
		let lifted = false;
		const liftOnce = () => {
			if (lifted) return;
			lifted = true;
			lift();
		};
		later(() => requestAnimationFrame(() => requestAnimationFrame(liftOnce)), HOLD_MS);
		later(liftOnce, HOLD_MS + 500);
	};

	const handOff = () => {
		if (pressed || dismissed || !ready) return;
		pressed = true;
		unlockAudio();
		releaseGate = holdPressGate();
		later(finish, 4000); // a held gate must never outlive the transition

		if (prefersReducedMotion) {
			stamp('lift');
			reveal(); // the splash's own fade-out IS the cross-fade
			later(finish, CROSSFADE_MS + 60);
			return;
		}
		phase = 'drop';
		stamp('drop');
		later(() => phase !== 'off' && audioDirector.shutterSlam?.(), IMPACT_MS);
		later(closed, DROP_MS + 140); // animationend normally gets there first
	};

	const onShutterAnimationEnd = (e: AnimationEvent) => {
		if (e.target !== e.currentTarget) return; // dust puffs end too
		if (phase === 'drop') closed();
		else if (phase === 'lift') finish();
	};

	// ---- replay: the hand-off with nobody to press it -----------------------------------
	/**
	 * The first gesture of a replay session unlocks audio — in practice the press
	 * on the HUD's START REPLAY card. Registered in the CAPTURE phase so it runs
	 * synchronously inside the gesture (a valid user-activation for WebAudio),
	 * and PASSIVE, so it cannot stop or cancel the event: the press it rides on
	 * still reaches the button underneath. Fires once, then unregisters itself.
	 */
	const armReplayAudioUnlock = () => {
		if (typeof window === 'undefined') return () => {};
		let done = false;
		const fire = () => {
			if (done) return;
			done = true;
			off();
			unlockAudio();
		};
		const opts = { capture: true, passive: true } as const;
		const off = () => {
			window.removeEventListener('pointerdown', fire, opts);
			window.removeEventListener('keydown', fire, opts);
			window.removeEventListener('touchstart', fire, opts);
		};
		window.addEventListener('pointerdown', fire, opts);
		window.addEventListener('keydown', fire, opts);
		window.addEventListener('touchstart', fire, opts);
		return off;
	};

	// Deliberately a plain flag, not `$state`: the effect must not take a
	// dependency on the thing it sets, or the hand-off re-enters its own effect.
	let replayHandedOff = false;
	$effect(() => {
		if (!replayLaunch || replayHandedOff || !ready) return;
		replayHandedOff = true;
		// No shutter, no fade: there is nothing on screen to transition away from.
		// `finish()` is the idempotent end of the hand-off — it reveals the board,
		// stamps the HUD in, clears the timers and marks the shutter done.
		finish();
	});

	onDestroy(() => {
		timers.forEach(clearTimeout);
		timers.clear();
		releaseGate?.();
		releaseGate = null;
	});

	// ---- gestures ---------------------------------------------------------------------
	const onPointer = (e: PointerEvent) => {
		e.stopPropagation();
		e.preventDefault();
		handOff();
	};

	/** Every press on the shutter stops here. One during the lift skips to the end. */
	const onShutterPress = (e: Event) => {
		e.stopPropagation();
		e.preventDefault();
		if (e.type === 'pointerup' && phase === 'lift') finish();
	};

	const onKey = (e: KeyboardEvent) => {
		if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Spacebar') return;
		if (pressed) {
			// the transition owns the key until it is over
			if (phase === 'off' && dismissed && !releaseGate) return;
			e.stopPropagation();
			e.preventDefault();
			if (phase === 'lift' && !e.repeat) finish();
			return;
		}
		if (!ready || dismissed) return;
		e.stopPropagation();
		e.preventDefault();
		handOff();
	};

	const PUFFS = Array.from({ length: 13 }, (_, i) => ({
		x: ((i + 0.5) / 13) * 100 + (((i * 37) % 11) - 5) * 0.5,
		drift: (((i * 53) % 17) - 8) * 1.1,
		size: 0.8 + (((i * 29) % 10) / 10) * 0.9,
		delay: ((i * 41) % 7) * 9,
	}));
</script>

<svelte:window onkeydowncapture={onKey} />

{#if !dismissed && !replayLaunch}
	<div
		class="splash"
		class:is-ready={ready}
		class:reduced={prefersReducedMotion}
		role="button"
		tabindex="0"
		aria-label={copy.aria}
		transition:fade={{ duration: prefersReducedMotion ? CROSSFADE_MS : 0 }}
		onpointerup={ready ? onPointer : undefined}
	>
		<div class="frame">
			<div class="stage">
				<div class="stage__deck">
					<SplashDeck {ready} paused={pressed} reducedMotion={prefersReducedMotion} onfirstcard={warmShutter} />
				</div>

				<!-- wordmark: the art, or the CSS text lockup if the art fails to load -->
				<div class="wordmark">
					<img
						class="wordmark__img"
						class:is-shown={wordmarkOk}
						src={wordmarkSrc}
						alt={GAME_TITLE}
						draggable="false"
						onload={() => (wordmarkOk = true)}
						onerror={() => (wordmarkOk = false)}
					/>
					{#if !wordmarkOk}
						<div class="lockup" aria-hidden="true">
							<span class="lockup__line lockup__line--top">{GAME_TITLE}</span>
						</div>
					{/if}
				</div>
			</div>

			<!-- progress OR the press-anywhere gate: never both -->
			<div class="band">
				{#if !ready}
					<div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
						<div class="bar__fill" style="width: {progress}%"></div>
					</div>
					<div class="band__label">{copy.loading} {Math.round(progress)}%</div>
				{:else}
					<div class="press">{copy.press}</div>
				{/if}
			</div>
		</div>
	</div>
{/if}

{#if phase !== 'off'}
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div
		class="shutter"
		data-phase={phase}
		aria-hidden="true"
		onpointerdown={onShutterPress}
		onpointerup={onShutterPress}
		onclick={onShutterPress}
	>
		<div class="shutter__door" onanimationend={onShutterAnimationEnd}>
			<div class="shutter__slats" style="background-image: url('{slatsUrl}')">
				<img class="shutter__stencil" src={wordmarkSrc} alt="" draggable="false" />
			</div>
			<div class="shutter__bar"><i style="background-image: url('{barUrl}')"></i></div>
		</div>
		<div class="shutter__housing"></div>
		<div class="shutter__dust">
			{#each PUFFS as puff, i (i)}
				<span style="left: {puff.x}%; --drift: {puff.drift}; --size: {puff.size}; --delay: {puff.delay}ms"></span>
			{/each}
		</div>
	</div>
{/if}

<style>
	.splash {
		--pw-blue: #123a5a;
		--pw-teal: #1f7a7a;
		--pw-cream: #f6ead2;
		--pw-brown: #3a2413;
		--pw-yellow: #f7c948;
		--pw-orange: #ef7d24;

		position: fixed;
		inset: 0;
		z-index: 2147483000; /* above the Pixi canvas and the studio HUD */
		container: pw-splash / size;
		overflow: hidden;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		touch-action: manipulation;
		background:
			/* LUCKY: a lacquer-red festival night with a faint gold lattice (was the donor blueprint grid) */
			repeating-linear-gradient(45deg, rgba(247, 201, 72, 0.05) 0 1px, transparent 1px 38px),
			repeating-linear-gradient(-45deg, rgba(247, 201, 72, 0.05) 0 1px, transparent 1px 38px),
			radial-gradient(120% 90% at 50% 18%, #9c1f1f 0%, #6e1010 46%, #2a0707 100%);
		color: var(--pw-cream);
		font-family: 'Inter', system-ui, sans-serif;
	}
	.splash.is-ready {
		cursor: pointer;
	}

	/*
	 * GEOMETRY. Every metric is derived from the splash's own box (cqw / cqh of
	 * the `pw-splash` container), never from a viewport guess, so the same rules
	 * hold in a 1440x900 window, the 400x225 mini-player and a 390x844 phone:
	 *
	 *   rows     masthead | stage | band   (the band is the press line's)
	 *   stage    landscape: board left, wordmark right
	 *            portrait:  wordmark, then board
	 *   board    as tall as the stage allows, never wider than its column
	 */
	.frame {
		--stripe: clamp(6px, 1.7cqh, 14px);
		--mast: clamp(14px, 5.2cqh, 48px);
		--band: clamp(36px, 12.5cqh, 104px);
		--gap: clamp(4px, 2.2cqh, 22px);
		--chain-h: clamp(10px, 5cqh, 46px);
		--dots-h: clamp(12px, 3.6cqh, 32px);
		--dots-gap: clamp(3px, 2cqh, 20px);
		--side: clamp(10px, 3cqw, 44px);
		--stage-h: calc(100cqh - 2 * var(--stripe) - var(--mast) - var(--band));

		/* landscape: the board takes the height, capped by its column */
		--board-avail: calc(var(--stage-h) - var(--chain-h) - var(--dots-h) - var(--dots-gap) - var(--gap));
		--board-w: min(40cqw, calc(var(--board-avail) * 0.84));
		--board-h: min(var(--board-avail), calc(var(--board-w) * 1.25));
		--wm-w: min(44cqw, 640px, calc(var(--stage-h) * 1.5));

		position: absolute;
		inset: 0;
		box-sizing: border-box;
		display: grid;
		grid-template-rows: var(--mast) minmax(0, 1fr) var(--band);
		padding: var(--stripe) var(--side);
	}

	/* carved gold beam top & bottom (LUCKY; was the donor hazard-stripe band) */
	.frame::before,
	.frame::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		height: var(--stripe);
		background:
			repeating-linear-gradient(90deg, transparent 0 26px, rgba(90, 14, 14, 0.55) 26px 30px),
			linear-gradient(180deg, #ffe08a 0%, var(--pw-yellow) 45%, #b8860b 100%);
		opacity: 0.95;
	}
	.frame::before { top: 0; }
	.frame::after { bottom: 0; }


	.stage {
		/* row 2 EXPLICITLY: the publisher line that used to occupy row 1 (the mast) is gone
		   (owner, 2026-09-19), and auto-placement would drop the stage into that 5cqh row and
		   the band into the middle — the whole splash then sits cut off at the top. */
		grid-row: 2;
		min-height: 0;
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: clamp(12px, 5cqw, 92px);
	}
	.stage__deck {
		flex: 0 0 auto;
	}

	.wordmark {
		flex: 0 0 auto;
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--wm-w);
	}
	.wordmark__img {
		display: none;
		width: 100%;
		height: auto;
		pointer-events: none;
		-webkit-user-drag: none;
		filter: drop-shadow(0 0.6cqh 1.2cqh rgba(0, 0, 0, 0.35));
	}
	.wordmark__img.is-shown {
		display: block;
	}

	/* fallback text lockup: chunky slab caps, cream face, brown outline, hazard accent */
	.lockup {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 0.86;
		font-family: 'LuckySign', 'Inter', system-ui, sans-serif;
		font-weight: 900;
		text-transform: uppercase;
		text-align: center;
	}
	.lockup__line {
		color: var(--pw-cream);
		letter-spacing: 0.02em;
		-webkit-text-stroke: clamp(2px, 0.6cqw, 7px) var(--pw-brown);
		paint-order: stroke fill;
		text-shadow:
			0 0.12em 0 rgba(58, 36, 19, 0.55),
			0 0 24px rgba(0, 0, 0, 0.35);
	}
	.lockup__line--top {
		font-size: calc(var(--wm-w) * 0.3);
		color: var(--pw-yellow);
	}

	/* ---- the band: progress, then the press line ---------------------------------------- */
	.band {
		grid-row: 3;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(3px, 1.3cqh, 12px);
		min-height: 0;
	}

	.bar {
		width: min(78cqw, 460px);
		height: clamp(8px, 2.1cqh, 18px);
		box-sizing: border-box;
		border-radius: 10px;
		background: rgba(0, 0, 0, 0.35);
		border: 2px solid var(--pw-brown);
		overflow: hidden;
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
	}
	.bar__fill {
		height: 100%;
		background: repeating-linear-gradient(
			-45deg,
			var(--pw-orange) 0 14px,
			var(--pw-yellow) 14px 28px
		);
		transition: width 0.25s ease-out;
	}
	.band__label {
		white-space: nowrap;
		padding-left: 0.18em;
		font-size: clamp(9px, 1.7cqh, 13px);
		font-weight: 700;
		letter-spacing: 0.18em;
		opacity: 0.85;
	}

	.press {
		width: 100%;
		text-align: center;
		white-space: nowrap; /* one line at every size: the font is sized to the box */
		/* letter-spacing adds a trailing gap after the last glyph; pad the left by
		   the same amount so the line stays optically centred. */
		padding-left: 0.22em;
		font-size: clamp(12px, min(4.1cqw, 6.4cqh), 28px);
		font-weight: 800;
		letter-spacing: 0.22em;
		color: var(--pw-cream);
		text-shadow: 0 2px 0 rgba(58, 36, 19, 0.6);
		animation: pulse 1.4s ease-in-out infinite;
	}
	.reduced .press {
		animation: none;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: translateY(0); }
		50% { opacity: 0.55; transform: translateY(1px); }
	}

	/* ---- portrait: wordmark, then the board ------------------------------------------------ */
	@container pw-splash (max-aspect-ratio: 9 / 10) {
		.frame {
			--wm-w: min(74cqw, 520px, 34cqh);
			--wm-h: calc(var(--wm-w) * 0.479); /* wordmark.png is 1366 x 654 */
			--board-avail: calc(
				var(--stage-h) - var(--wm-h) - var(--chain-h) - var(--dots-h) - var(--dots-gap) - 3 * var(--gap)
			);
			--board-w: min(86cqw, calc(var(--board-avail) * 0.84));
		}
		.stage {
			flex-direction: column;
			gap: calc(var(--gap) * 1.4);
		}
		.wordmark {
			order: -1;
		}
	}

	/* ---- the mini-player and other very short boxes: a wide board, title only ---- */
	@container pw-splash (max-height: 300px) {
		.frame {
			--board-w: min(40cqw, calc(var(--board-avail) * 1.18));
			--peek-display: none;
			--body-display: none;
		}
	}

	/* =========================================================================
	   THE SHUTTER — the hand-off. Same art, same moves as scene/SceneShutter:
	   a free fall onto the sill with a bounce and a kick of dust, then three
	   hauls back up. CSS keyframes only, so it keeps its frame rate while the
	   board mounts on the main thread behind it.
	   ========================================================================= */
	.shutter {
		position: fixed;
		inset: 0;
		z-index: 2147483001; /* over the splash it covers */
		container: pw-shutter / size;
		overflow: hidden;
		user-select: none;
		-webkit-user-select: none;
		touch-action: none;
		cursor: default;
	}

	.shutter__door {
		/* taller than the box, so the bounce never opens a gap at the top */
		position: absolute;
		left: 0;
		right: 0;
		top: -14cqh;
		height: 114cqh;
		display: flex;
		flex-direction: column;
		will-change: transform;
		transform: translateY(-101%);
	}
	.shutter[data-phase='drop'] .shutter__door {
		animation: shutter-drop 420ms linear both;
	}
	.shutter[data-phase='closed'] .shutter__door {
		transform: translateY(0);
	}
	.shutter[data-phase='lift'] .shutter__door {
		animation: shutter-lift 540ms linear both;
	}

	.shutter__slats {
		position: relative;
		flex: 1 1 0;
		min-height: 0;
		/* never a void: red lacquer under the slats while they decode (LUCKY shop-front boards, ART-B) */
		background-color: #8e1b1b;
		background-repeat: repeat;
		background-position: 0 100%;
		background-size: 100cqw auto;
	}
	/* a phone in portrait would make one tile's slats hair-thin: hold the slat
	   height and let the tile seam (with its rivets) fall on the centre line,
	   exactly as SceneShutter draws it */
	@container pw-shutter (max-aspect-ratio: 1 / 1) {
		.shutter__slats {
			background-size: max(100cqw, 635px) auto;
			background-position: 50cqw 100%;
		}
	}

	/* the wordmark, stencilled on the door */
	.shutter__stencil {
		position: absolute;
		left: 50%;
		bottom: 50cqh;
		width: min(56cqw, 78cqh, 760px);
		height: auto;
		transform: translate(-50%, 50%);
		filter: brightness(0);
		opacity: 0.17;
		pointer-events: none;
		-webkit-user-drag: none;
	}

	.shutter__bar {
		position: relative;
		flex: 0 0 auto;
		height: min(11.23cqw, 9cqh); /* 1024 x 115 art, capped like SceneShutter's */
		/* carved gold under the art, for the same never-a-void reason (LUCKY; was hazard paint) */
		background: linear-gradient(180deg, #ffe08a 0%, #f7c948 45%, #b8860b 100%);
		box-shadow: 0 0.8cqh 1.6cqh rgba(0, 0, 0, 0.45);
	}
	.shutter__bar i {
		position: absolute;
		inset: 0;
		background-repeat: no-repeat;
		background-size: 100% 100%;
	}

	/* soft shade under the (off-screen) housing the door rolls out of */
	.shutter__housing {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 10cqh;
		background: linear-gradient(180deg, rgba(42, 18, 0, 0.34), rgba(42, 18, 0, 0));
		pointer-events: none;
		opacity: 0;
	}
	.shutter[data-phase='drop'] .shutter__housing,
	.shutter[data-phase='closed'] .shutter__housing {
		opacity: 1;
	}
	.shutter[data-phase='lift'] .shutter__housing {
		opacity: 1;
		animation: shutter-housing-out 540ms linear both;
	}

	/* dust kicked up along the sill where the bar lands */
	.shutter__dust {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 0;
		pointer-events: none;
	}
	.shutter__dust span {
		position: absolute;
		bottom: -1cqh;
		width: calc(var(--size) * clamp(26px, 7cqh, 74px));
		height: calc(var(--size) * clamp(26px, 7cqh, 74px));
		margin-left: calc(var(--size) * clamp(26px, 7cqh, 74px) / -2);
		border-radius: 50%;
		background: radial-gradient(circle closest-side, rgba(233, 214, 174, 0.78) 0 35%, rgba(233, 214, 174, 0) 100%);
		opacity: 0;
		will-change: transform, opacity;
	}
	.shutter[data-phase='drop'] .shutter__dust span,
	.shutter[data-phase='closed'] .shutter__dust span,
	.shutter[data-phase='lift'] .shutter__dust span {
		/* `forwards`, not `both`: a backwards fill would show the puffs at full
		   strength for the whole fall, before the bar has hit anything */
		animation: shutter-dust 700ms cubic-bezier(0.15, 0.7, 0.3, 1) forwards;
		animation-delay: calc(235ms + var(--delay));
	}

	/* free fall (accelerating), impact, a bounce with weight, a second small one */
	@keyframes shutter-drop {
		0% {
			transform: translateY(-101%);
			animation-timing-function: cubic-bezier(0.55, 0, 1, 0.55);
		}
		56% {
			transform: translateY(0);
			animation-timing-function: cubic-bezier(0, 0, 0.35, 1);
		}
		70% {
			transform: translateY(-3.6%);
			animation-timing-function: cubic-bezier(0.6, 0, 1, 1);
		}
		84% {
			transform: translateY(0);
			animation-timing-function: cubic-bezier(0, 0, 0.35, 1);
		}
		92% {
			transform: translateY(-0.9%);
			animation-timing-function: cubic-bezier(0.6, 0, 1, 1);
		}
		100% {
			transform: translateY(0);
		}
	}

	/* three hauls on the chain, each one slipping back a touch before the next */
	@keyframes shutter-lift {
		0% {
			transform: translateY(0);
			animation-timing-function: cubic-bezier(0.1, 0.7, 0.2, 1);
		}
		27% {
			transform: translateY(-30%);
			animation-timing-function: ease-in-out;
		}
		36% {
			transform: translateY(-27.8%);
			animation-timing-function: cubic-bezier(0.1, 0.7, 0.2, 1);
		}
		63% {
			transform: translateY(-64%);
			animation-timing-function: ease-in-out;
		}
		72% {
			transform: translateY(-61.8%);
			animation-timing-function: cubic-bezier(0.3, 0, 0.6, 1);
		}
		100% {
			transform: translateY(-101%);
		}
	}

	@keyframes shutter-housing-out {
		0%, 70% { opacity: 1; }
		100% { opacity: 0; }
	}

	@keyframes shutter-dust {
		0% {
			transform: translate(0, 0) scale(0.35);
			opacity: 0.9;
		}
		100% {
			transform: translate(calc(var(--drift) * 1cqw), -130%) scale(1.9);
			opacity: 0;
		}
	}
</style>
