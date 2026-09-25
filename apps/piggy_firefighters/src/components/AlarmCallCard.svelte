<script lang="ts" module>
	import type { AlarmCallOutcome } from '../game/typesBookEvent';

	export type EmitterEventAlarmCall =
		/** show the Alarm Call card, ring, turn to the BOOKED outcome, wait for a press (or `waitMs`), resolve */
		{ type: 'alarmCallShow'; outcome: AlarmCallOutcome; waitMs: number };
</script>

<script lang="ts">
	// ALARM CALL (contract §7, theme §4): Sprocket at the dispatch board; the card rings, then turns to RESCUE SPINS,
	// INFERNO RESCUE or a FALSE ALARM (a cat in a tree: nothing is awarded). The outcome is the book's `alarmCall.outcome`
	// and nothing else; the ring is a fixed beat, never a tease of odds.
	//
	// PLACEHOLDER CARD: a framed panel with the placeholder dispatch art (scene_card_alarm) and live text. While the
	// card waits for its press it holds the HUD press gate (so one Space dismisses it and does NOT start a round) and it
	// continues by itself after `waitMs` so an unattended / autoplay round never hangs.
	import { Container, Graphics, Text, BaseSprite } from 'pixi-svelte';
	import { OnHotkey } from 'components-shared';
	import { OnPressFullScreen } from 'components-layout';
	import { holdPressGate } from '@crashgalaxy/hud';

	import { getContext } from '../game/context';
	import { sceneTex } from '../game/fx/sceneTextures.svelte';
	import { prefersReducedMotion, isTurbo } from '../game/fx/timing';
	import { audioDirector } from '../game/fx/audioDirector';
	import { MODE_TITLE, MECHANIC } from '../game/names';
	import { stateAlarmCall } from '../game/rescue/stateRescue.svelte';

	const context = getContext();
	const cs = $derived(context.stateLayoutDerived.canvasSizes());

	let showing = $state(false);
	let revealed = $state(false);
	let live = $state(false);
	let outcome = $state<AlarmCallOutcome | null>(null);
	let done: (() => void) | null = null;
	let release: (() => void) | null = null;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const close = () => {
		if (!showing) return;
		clearTimeout(timer);
		live = false;
		showing = false;
		revealed = false;
		release?.();
		release = null;
		const d = done;
		done = null;
		d?.();
	};

	context.eventEmitter.subscribeOnMount({
		alarmCallShow: ({ outcome: o, waitMs }) =>
			new Promise<void>((resolve) => {
				close();
				outcome = o;
				done = resolve;
				showing = true;
				revealed = false;
				release = holdPressGate();
				const ring = prefersReducedMotion() ? 200 : isTurbo() ? 500 : 1100;
				timer = setTimeout(() => {
					revealed = true;
					stateAlarmCall.phase = 'revealed';
					audioDirector.alarmReveal(o);
					live = true;
					timer = setTimeout(close, waitMs);
				}, ring);
			}),
	});

	const title = $derived(
		outcome === 'inferno' ? MODE_TITLE.inferno : outcome === 'rescue' ? MODE_TITLE.rescue : MECHANIC.falseAlarm.toUpperCase(),
	);
	const subtitle = $derived(
		outcome === 'falseAlarm'
			? 'Only a cat stuck in a tree. No award this time.'
			: outcome === 'inferno'
				? 'The block is ablaze under a red sky. Move out!'
				: 'Five rooms are burning. Move out!',
	);

	const card = $derived.by(() => {
		const w = Math.min(cs.width * 0.86, 560);
		const h = Math.min(cs.height * 0.7, w * 1.15);
		return { w, h, x: cs.width / 2, y: cs.height * 0.45 };
	});
	const art = $derived(sceneTex('scene_card_alarm'));
	const INK = 0x3a2213;
	const style = (size: number, fill: number) => ({
		fontFamily: 'StationSign, Lilita One, Inter, sans-serif',
		fontSize: size,
		fill,
		align: 'center' as const,
		wordWrap: true,
		wordWrapWidth: card.w * 0.86,
		stroke: { color: INK, width: Math.max(2, size * 0.12), join: 'round' as const },
	});
</script>

{#if showing}
	<Container zIndex={45}>
		<Graphics draw={(g) => g.rect(0, 0, cs.width, cs.height).fill({ color: 0x0b1020, alpha: 0.62 })} />
		<Container x={card.x} y={card.y}>
			<Graphics
				draw={(g) => {
					g.roundRect(-card.w / 2, -card.h / 2, card.w, card.h, 22).fill(0x1e2a4a).stroke({ width: 8, color: INK });
					g.roundRect(-card.w / 2 + 10, -card.h / 2 + 10, card.w - 20, card.h - 20, 16).stroke({ width: 4, color: revealed && outcome === 'inferno' ? 0xe9b23b : 0xd7262b });
				}}
			/>
			{#if art}
				<BaseSprite texture={art} anchor={0.5} y={-card.h * 0.1} width={card.w * 0.62} height={card.w * 0.62} alpha={revealed ? 0.35 : 1} />
			{/if}
			<Text anchor={0.5} y={-card.h * 0.42} text={MODE_TITLE.alarm_call} style={style(card.w * 0.075, 0xf4e9d2)} />
			{#if !revealed}
				<Text anchor={0.5} y={card.h * 0.3} text="DISPATCH IS RINGING..." style={style(card.w * 0.05, 0xf5d23c)} />
			{:else}
				<Text anchor={0.5} y={-card.h * 0.08} text={title} style={style(card.w * 0.1, outcome === 'falseAlarm' ? 0xf4e9d2 : 0xf5d23c)} />
				<Text anchor={0.5} y={card.h * 0.14} text={subtitle} style={style(card.w * 0.045, 0xf4e9d2)} />
				<Text anchor={0.5} y={card.h * 0.36} text="TAP OR PRESS SPACE" style={style(card.w * 0.04, 0xf4e9d2)} />
			{/if}
		</Container>
	</Container>
	{#if live}
		<OnHotkey hotkey="Space" onpress={() => close()} />
		<OnPressFullScreen onpress={() => close()} />
	{/if}
{/if}
