<script lang="ts">
	/**
	 * PIGGY FIREFIGHTERS splash — the intro-card deck.
	 *
	 * One station notice board hangs from two nails on chains; every ~3.5 s it is
	 * unhooked and the next one is hung in its place (slide + swing + settle, the
	 * pivot is the nails — not a fade). Dots, swipe, a tap while loading, and the
	 * arrow keys all move it. It is DOM and CSS only and owns no loading state:
	 * nothing here can slow, pause or gate the asset load.
	 *
	 * PRELOAD BUDGET. Only card 1 is requested on the first frame. Each later card
	 * is requested when the one before it has landed (one connection, in deck
	 * order), and auto-advance only ever moves to a card whose art has arrived —
	 * so the deck never rotates onto an empty frame. A manual jump to a card that
	 * has not arrived requests it at once; the board shows its painted ground and
	 * its caption until the art fades in.
	 *
	 * THE PRESS. This component never starts the game. A swipe or a dot is
	 * consumed here (stopPropagation); a plain tap on the board is consumed only
	 * while the game is still loading (it turns the card). Once the gate is up a
	 * tap on the board bubbles to Splash.svelte untouched — "press anywhere" still
	 * means anywhere.
	 *
	 * REDUCED MOTION. No auto-advance, no travel, no swing: manual moves cross-fade.
	 */
	import { onMount } from 'svelte';

	import { SPLASH_DECK, splashAssetUrl, splashText } from './copy';

	type Props = {
		/** the press gate is up: a tap on the board belongs to the splash, not the deck */
		ready: boolean;
		/** the hand-off has started: stop the clock */
		paused: boolean;
		reducedMotion: boolean;
		/** card 1's art has landed (or failed): the wire is free for art drawn later */
		onfirstcard?: () => void;
	};
	const props: Props = $props();

	const ADVANCE_MS = 3500;
	const LEAVE_MS = 460;
	const COUNT = SPLASH_DECK.length;

	const cards = SPLASH_DECK.map((card) => ({
		...card,
		src: splashAssetUrl(card.art),
		title: splashText(card.titleKey),
		body: splashText(card.bodyKey),
		// the Chief and the max-win card wear the gold board
		gold: ['chief', 'maxwin'].includes(card.id),
	}));

	let index = $state(0);
	let leaving = $state(-1);
	let dir = $state(1);
	let moved = $state(false); // the first board settles in place; later ones are hung
	let held = $state(false); // pointer is down on the deck: the clock waits
	let hidden = $state(false); // tab hidden: the clock waits

	let wanted = $state(cards.map((_, i) => i === 0));
	let loaded = $state(cards.map(() => false));

	let leaveTimer: ReturnType<typeof setTimeout> | undefined;

	const go = (next: number, direction: number) => {
		const target = ((next % COUNT) + COUNT) % COUNT;
		if (target === index) return;
		wanted[target] = true;
		dir = direction;
		leaving = index;
		index = target;
		moved = true;
		clearTimeout(leaveTimer);
		leaveTimer = setTimeout(() => (leaving = -1), LEAVE_MS);
	};

	/** The clock only ever turns to a card whose art is already here. */
	const autoNext = (): boolean => {
		for (let step = 1; step < COUNT; step += 1) {
			const candidate = (index + step) % COUNT;
			if (loaded[candidate]) {
				go(candidate, 1);
				return true;
			}
		}
		return false;
	};

	$effect(() => {
		// Re-armed by a turn or a pause change — NOT by an arrival: on a slow
		// connection four arrivals in a row would otherwise keep restarting the
		// clock and hold the first board up for far longer than its 3.5 s. If the
		// clock runs out before any other card has landed, it looks again shortly.
		void index;
		if (props.reducedMotion || props.paused || held || hidden) return;
		let id: ReturnType<typeof setTimeout>;
		const tick = () => {
			if (!autoNext()) id = setTimeout(tick, 400);
		};
		id = setTimeout(tick, ADVANCE_MS);
		return () => clearTimeout(id);
	});

	const onArtSettled = (i: number, ok: boolean) => {
		if (ok) loaded[i] = true;
		if (i === 0) props.onfirstcard?.();
		// chain the next request either way: one bad file must not starve the deck
		if (i + 1 < COUNT) wanted[i + 1] = true;
	};

	// ---- pointer: swipe turns, dot jumps, tap turns only while loading -----------
	let downX = 0;
	let downY = 0;
	let downId = -1;

	const onDown = (e: PointerEvent) => {
		downX = e.clientX;
		downY = e.clientY;
		downId = e.pointerId;
		held = true;
		try {
			(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		} catch {
			/* capture is a nicety: without it a swipe that ends off the deck is a tap */
		}
	};

	const onUp = (e: PointerEvent) => {
		held = false;
		if (e.pointerId !== downId) return;
		downId = -1;
		const dx = e.clientX - downX;
		const dy = e.clientY - downY;
		const swipe = Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy) * 1.2;
		if (swipe) {
			e.stopPropagation();
			e.preventDefault();
			go(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
			return;
		}
		if (props.ready) return; // the gate is up: this tap starts the game
		e.stopPropagation();
		go(index + 1, 1);
	};

	const onCancel = () => {
		held = false;
		downId = -1;
	};

	const onDot = (e: PointerEvent, i: number) => {
		e.stopPropagation();
		e.preventDefault();
		held = false;
		downId = -1;
		go(i, i > index ? 1 : -1);
	};

	const onKey = (e: KeyboardEvent) => {
		if (props.paused) return;
		if (e.key === 'ArrowRight') go(index + 1, 1);
		else if (e.key === 'ArrowLeft') go(index - 1, -1);
	};

	onMount(() => {
		const onVisibility = () => (hidden = document.hidden);
		onVisibility();
		document.addEventListener('visibilitychange', onVisibility);
		return () => {
			document.removeEventListener('visibilitychange', onVisibility);
			clearTimeout(leaveTimer);
		};
	});
</script>

<svelte:window onkeydown={onKey} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="deck"
	class:reduced={props.reducedMotion}
	class:is-first={!moved}
	style="--dir: {dir}"
	data-splash-deck
	data-card={cards[index].id}
	onpointerdown={onDown}
	onpointerup={onUp}
	onpointercancel={onCancel}
>
	<div class="deck__hang">
		<!-- the next boards in the stack, peeking out behind the one on the nails -->
		<div class="deck__peek deck__peek--b" aria-hidden="true"></div>
		<div class="deck__peek deck__peek--a" aria-hidden="true"></div>

		<!-- the two nails the chains hang from: they never move -->
		<span class="deck__nail deck__nail--l" aria-hidden="true"></span>
		<span class="deck__nail deck__nail--r" aria-hidden="true"></span>

		{#each cards as card, i (card.id)}
			<article
				class="card"
				class:card--gold={card.gold}
				class:is-active={i === index}
				class:is-leaving={i === leaving}
				aria-hidden={i !== index}
				data-card-id={card.id}
			>
				<span class="card__chain card__chain--l" aria-hidden="true"></span>
				<span class="card__chain card__chain--r" aria-hidden="true"></span>
				<div class="card__board">
					<div class="card__art">
						{#if wanted[i] && card.src}
							<img
								class:is-in={loaded[i]}
								src={card.src}
								alt=""
								draggable="false"
								decoding="async"
								onload={() => onArtSettled(i, true)}
								onerror={() => onArtSettled(i, false)}
							/>
						{/if}
					</div>
					<div class="card__caption">
						<h2 class="card__title">{card.title}</h2>
						<p class="card__body">{card.body}</p>
					</div>
				</div>
			</article>
		{/each}
	</div>

	<div class="deck__dots">
		{#each cards as card, i (card.id)}
			<span class="dot" class:is-on={i === index} data-dot={i} onpointerup={(e) => onDot(e, i)}>
				<i></i>
			</span>
		{/each}
	</div>
</div>

<style>
	/*
	 * Geometry comes from the splash (Splash.svelte sets --board-w / --board-h /
	 * --chain-h / --dots-h from the real splash box). Everything inside a board is
	 * in cqw of THAT board, so the type, frame and bolts scale with it and no
	 * viewport needs its own numbers.
	 */
	.deck {
		--wood: #9a6631;
		--wood-dark: #6f451f;
		--wood-light: #b98548;
		--outline: #2a1a0d;
		--beam: #3a2413;
		--cream: #f6ead2;
		--gold: #f7c948;
		--gold-deep: #d99a20;

		position: relative;
		/* NOT a container: --board-w / --board-h carry cqw of the SPLASH box and
		   must resolve against it. The board below is the container instead. */
		width: var(--board-w, 320px);
		padding-top: var(--chain-h, 24px);
		touch-action: none;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}

	.deck__hang {
		position: relative;
		container-type: inline-size; /* cqw below here = the board's width */
		width: 100%;
		height: var(--board-h, 400px);
	}

	/* ---- the stack behind ---------------------------------------------------------- */
	.deck__peek {
		display: var(--peek-display, block);
		position: absolute;
		inset: 0;
		border-radius: 4.2cqw;
		border: max(2px, 1.3cqw) solid var(--outline);
		background:
			repeating-linear-gradient(180deg, transparent 0 24.2%, rgba(42, 26, 13, 0.4) 24.2% 25%),
			linear-gradient(180deg, #7d5126, #6a431e);
		box-shadow: 0 2cqw 4cqw rgba(0, 0, 0, 0.3);
	}
	.deck__peek--a {
		transform: translate(2.4cqw, 0.4cqw) rotate(3deg);
	}
	.deck__peek--b {
		transform: translate(-2.2cqw, 0.8cqw) rotate(-4deg);
		filter: brightness(0.82);
	}

	/* ---- nails + chains ------------------------------------------------------------ */
	.deck__nail {
		position: absolute;
		z-index: 4;
		top: calc(var(--chain-h, 24px) * -1 - 1.5cqw);
		width: 4.2cqw;
		height: 4.2cqw;
		min-width: 7px;
		min-height: 7px;
		border-radius: 50%;
		background: radial-gradient(circle at 36% 34%, #e8edf3 0 16%, #9aa6b4 18% 56%, #4a5462 58% 100%);
		box-shadow:
			0 0 0 max(1.5px, 0.7cqw) var(--outline),
			0 1cqw 1.6cqw rgba(0, 0, 0, 0.4);
	}
	.deck__nail--l { left: 17.9cqw; }
	.deck__nail--r { right: 17.9cqw; }

	.card__chain {
		position: absolute;
		top: calc(var(--chain-h, 24px) * -1);
		height: calc(var(--chain-h, 24px) + 1.4cqw);
		width: 2.4cqw;
		min-width: 5px;
		background:
			radial-gradient(
				ellipse 50% 50% at 50% 50%,
				transparent 0 22%,
				var(--outline) 25% 40%,
				#aeb6c2 43% 68%,
				var(--outline) 71% 96%,
				transparent 100%
			)
			center bottom / 100% max(6px, 2.9cqw) repeat-y;
	}
	.card__chain--l { left: 18.8cqw; }
	.card__chain--r { right: 18.8cqw; }

	/* ---- a board --------------------------------------------------------------------- */
	.card {
		position: absolute;
		inset: 0;
		z-index: 1;
		margin: 0;
		visibility: hidden;
		container-type: inline-size;
		/* the pivot is the nails, so a turn reads as a hung sign swinging */
		transform-origin: 50% calc(var(--chain-h, 24px) * -1);
		will-change: transform, opacity;
	}
	.card.is-leaving {
		visibility: visible;
		z-index: 2;
		animation: deck-unhook 440ms cubic-bezier(0.5, 0, 0.9, 0.6) both;
	}
	.card.is-active {
		visibility: visible;
		z-index: 3;
		animation: deck-hang 820ms cubic-bezier(0.2, 0.8, 0.3, 1) both;
	}
	.deck.is-first .card.is-active {
		animation: deck-settle 900ms ease-out both;
	}
	.deck.reduced .card.is-active {
		animation: deck-fade-in 250ms linear both;
	}
	.deck.reduced .card.is-leaving {
		animation: deck-fade-out 250ms linear both;
	}

	.card__board {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		gap: 2.2cqw;
		padding: 3.4cqw;
		border-radius: 4.2cqw;
		border: max(3px, 1.5cqw) solid var(--outline);
		background:
			/* corner bolts */
			radial-gradient(circle closest-side, #cbb896 0 24%, #6a4f2f 27% 62%, var(--beam) 65% 94%, transparent 100%)
				left 0.5cqw top 0.5cqw / 2.5cqw 2.5cqw no-repeat,
			radial-gradient(circle closest-side, #cbb896 0 24%, #6a4f2f 27% 62%, var(--beam) 65% 94%, transparent 100%)
				right 0.5cqw top 0.5cqw / 2.5cqw 2.5cqw no-repeat,
			radial-gradient(circle closest-side, #cbb896 0 24%, #6a4f2f 27% 62%, var(--beam) 65% 94%, transparent 100%)
				left 0.5cqw bottom 0.5cqw / 2.5cqw 2.5cqw no-repeat,
			radial-gradient(circle closest-side, #cbb896 0 24%, #6a4f2f 27% 62%, var(--beam) 65% 94%, transparent 100%)
				right 0.5cqw bottom 0.5cqw / 2.5cqw 2.5cqw no-repeat,
			/* plank seams: a dark line with a light lip under it */
			repeating-linear-gradient(
				180deg,
				transparent 0 24%,
				rgba(111, 69, 31, 0.7) 24% 24.7%,
				rgba(185, 133, 72, 0.45) 24.7% 25%
			),
			linear-gradient(180deg, #a57038 0%, var(--wood) 45%, #8c5a2a 100%);
		box-shadow:
			inset 0 0.7cqw 0 rgba(215, 165, 100, 0.55),
			inset 0 -0.9cqw 0 rgba(60, 34, 12, 0.35),
			0 1.4cqw 0 rgba(0, 0, 0, 0.28),
			0 3.4cqw 6cqw rgba(0, 0, 0, 0.38);
	}
	.card--gold .card__board {
		border-color: var(--outline);
		box-shadow:
			inset 0 0.7cqw 0 rgba(255, 224, 140, 0.6),
			inset 0 -0.9cqw 0 rgba(60, 34, 12, 0.35),
			0 0 0 max(1.5px, 0.7cqw) var(--gold),
			0 1.4cqw 0 rgba(0, 0, 0, 0.28),
			0 3.4cqw 6cqw rgba(0, 0, 0, 0.38);
	}

	.card__art {
		position: relative;
		flex: 1 1 0;
		min-height: 0;
		overflow: hidden;
		border-radius: 2.4cqw;
		border: max(2px, 1.1cqw) solid var(--outline);
		/* painted ground: a board whose art is still on the wire is never an empty hole */
		background: linear-gradient(180deg, #58b4ea 0%, #a9dcf5 46%, #c99355 47%, #a8713a 100%);
	}
	.card__art::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 1.5cqw;
		box-shadow: inset 0 0 0 max(1px, 0.5cqw) rgba(243, 217, 164, 0.9);
		pointer-events: none;
	}
	.card__art img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: 50% 42%;
		opacity: 0;
		transition: opacity 260ms ease-out;
		pointer-events: none;
		-webkit-user-drag: none;
		user-select: none;
	}
	.card__art img.is-in {
		opacity: 1;
	}

	.card__caption {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.6cqw;
		text-align: center;
	}
	.card__title {
		margin: 0;
		font-family: 'StationSign', 'Inter', system-ui, sans-serif;
		font-weight: 400;
		font-size: clamp(10px, 6.9cqw, 40px);
		line-height: 1.06;
		letter-spacing: 0.015em;
		text-wrap: balance;
		color: var(--cream);
		/* dark outline + the wordmark's gold side-shadow, drawn with shadows so it
		   never depends on paint-order support */
		text-shadow:
			0.22cqw 0 0 var(--outline),
			-0.22cqw 0 0 var(--outline),
			0 0.22cqw 0 var(--outline),
			0 -0.22cqw 0 var(--outline),
			0.16cqw 0.16cqw 0 var(--outline),
			-0.16cqw 0.16cqw 0 var(--outline),
			0.16cqw -0.16cqw 0 var(--outline),
			-0.16cqw -0.16cqw 0 var(--outline),
			0 0.75cqw 0 var(--outline);
	}
	.card--gold .card__title {
		color: var(--gold);
	}
	.card__body {
		display: var(--body-display, block);
		margin: 0;
		width: 100%;
		box-sizing: border-box;
		padding: 1.7cqw 2.6cqw;
		border-radius: 1.8cqw;
		background: rgba(42, 26, 13, 0.9);
		box-shadow: inset 0 0 0 max(1px, 0.35cqw) rgba(243, 217, 164, 0.28);
		font-family: 'Inter', system-ui, sans-serif;
		font-weight: 700;
		font-size: clamp(10.5px, 3.75cqw, 20px);
		line-height: 1.24;
		text-wrap: balance;
		color: var(--cream);
	}

	/* ---- dots -------------------------------------------------------------------------- */
	.deck__dots {
		position: relative;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: center;
		height: var(--dots-h, 28px);
		margin-top: var(--dots-gap, 6px);
	}
	.dot {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		min-height: 14px;
		padding: 0 clamp(3px, 1.2cqw, 8px);
		cursor: pointer;
	}
	.dot i {
		display: block;
		width: clamp(5px, 2.1cqw, 11px);
		height: clamp(5px, 2.1cqw, 11px);
		border-radius: 999px;
		background: rgba(246, 234, 210, 0.42);
		box-shadow: 0 0 0 max(1.5px, 0.4cqw) rgba(42, 26, 13, 0.85);
		transition:
			width 260ms cubic-bezier(0.3, 1.5, 0.5, 1),
			background-color 200ms linear;
	}
	.dot.is-on i {
		width: clamp(14px, 6cqw, 30px);
		background: var(--gold);
	}
	.deck.reduced .dot i {
		transition: none;
	}

	/* ---- the turn ----------------------------------------------------------------------- */
	/* lifted off its nails, tipped, and carried away */
	@keyframes deck-unhook {
		0% {
			transform: translate(0, 0) rotate(0deg);
			opacity: 1;
		}
		26% {
			transform: translate(0, -3.5%) rotate(calc(var(--dir) * 3deg));
			opacity: 1;
		}
		100% {
			transform: translate(calc(var(--dir) * -64%), 4%) rotate(calc(var(--dir) * -12deg));
			opacity: 0;
		}
	}
	/* carried in, dropped on the nails, swings out on the chains and settles */
	@keyframes deck-hang {
		0% {
			transform: translate(calc(var(--dir) * 62%), -7%) rotate(calc(var(--dir) * 10deg));
			opacity: 0;
		}
		16% {
			opacity: 1;
		}
		46% {
			transform: translate(0, 1.2%) rotate(calc(var(--dir) * -3.6deg));
		}
		64% {
			transform: translate(0, 0) rotate(calc(var(--dir) * 2deg));
		}
		80% {
			transform: translate(0, 0) rotate(calc(var(--dir) * -0.9deg));
		}
		91% {
			transform: translate(0, 0) rotate(calc(var(--dir) * 0.35deg));
		}
		100% {
			transform: translate(0, 0) rotate(0deg);
			opacity: 1;
		}
	}
	/* the first board is already on its nails on frame one: it only swings to rest */
	@keyframes deck-settle {
		0% { transform: rotate(-2.6deg); }
		30% { transform: rotate(1.7deg); }
		55% { transform: rotate(-0.9deg); }
		78% { transform: rotate(0.35deg); }
		100% { transform: rotate(0deg); }
	}
	@keyframes deck-fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes deck-fade-out {
		from { opacity: 1; }
		to { opacity: 0; }
	}
</style>
