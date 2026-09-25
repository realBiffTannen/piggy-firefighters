<script lang="ts">
	// STATIC-SPRITE FALLBACK house body. Used only when a Spine house rig fails to
	// load (all five normally preload). Registers the same HouseHandle as the Spine
	// path so the build director never branches. Owns its own per-house audio (the
	// director no longer fires house/door/prize/collect cues — those follow the
	// picture: from the Spine rig events on the Spine path, and from these tween
	// milestones here).
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut, cubicInOut } from 'svelte/easing';

	import { Container, Sprite, Graphics, Text } from 'pixi-svelte';
	import { waitForTimeout } from 'utils-shared/wait';

	import { registerHouse } from '../../game/build/houseRegistry';
	import { dur } from '../../game/build/buildTiming';
	import { audioDirector } from '../../game/build/audioDirector';
	import { getContext } from '../../game/context';
	import type { JackpotKind } from '../../game/typesBookEvent';
	import TierBadge from './TierBadge.svelte';

	type Props = {
		reel: number;
		row: number;
		x: number;
		y: number;
		size: number;
		premium?: boolean;
		/** board index in an EXPANDED round (single-board bonuses: 0) */
		board?: number;
	};

	const { reel, row, x, y, size, premium = false, board = 0 }: Props = $props();

	const context = getContext();

	let tier = $state(0);
	let prizeText = $state('');
	let jackpot = $state<JackpotKind>(null);
	let showPrize = $state(false);

	const scale = new Tween(0.001, { duration: 0, easing: backOut });
	const bob = new Tween(0, { duration: 0, easing: cubicOut });
	const alpha = new Tween(1, { duration: 0, easing: cubicOut });
	const doorT = new Tween(0, { duration: 0, easing: cubicInOut });
	const prizePop = new Tween(0, { duration: 0, easing: backOut });

	const HOUSE = size * 1.16;
	const GROUND_Y = size * 0.44;
	const DOOR_W = size * 0.34;
	const DOOR_H = size * 0.4;
	const DOOR_TOP = GROUND_Y - DOOR_H;

	const JACKPOT_COLOR: Record<Exclude<JackpotKind, null>, number> = {
		minor: 0x46a6ff,
		major: 0xb476ff,
		grand: 0xffcb3a,
	};

	const setStatic = (t: number) => {
		tier = t;
		showPrize = false;
		jackpot = null;
		scale.set(t >= 1 ? 1 : 0.001, { duration: 0 });
		bob.set(0, { duration: 0 });
		alpha.set(1, { duration: 0 });
		doorT.set(0, { duration: 0 });
		prizePop.set(0, { duration: 0 });
	};

	const appear = async (t: number) => {
		tier = t;
		alpha.set(1, { duration: 0 });
		bob.set(-size * 0.14, { duration: 0 });
		scale.set(0.35, { duration: 0 });
		audioDirector.houseAppear(t); // impact accent at the drop-in
		await Promise.all([scale.set(1, { duration: dur(420) }), bob.set(0, { duration: dur(420) })]);
	};

	const upgradeTo = async (t: number) => {
		await scale.set(0.82, { duration: dur(140) });
		tier = t; // tier swap under the (effect) dust cover
		audioDirector.houseUpgrade(t);
		await scale.set(1.12, { duration: dur(200) });
		await scale.set(1, { duration: dur(160) });
	};

	const maxed = async () => {
		await scale.set(1.1, { duration: dur(150) });
		await scale.set(1, { duration: dur(220) });
	};

	const openDoor = async (text: string, jk: JackpotKind) => {
		prizeText = text;
		jackpot = jk;
		showPrize = false;
		audioDirector.doorLatch();
		await doorT.set(1, { duration: dur(360) });
		showPrize = true;
		audioDirector.prizeVisible(tier, jk);
		await prizePop.set(1, { duration: dur(260) });
	};

	const collect = async () => {
		audioDirector.collect();
		await prizePop.set(1.18, { duration: dur(120) });
		await prizePop.set(1, { duration: dur(120) });
		await waitForTimeout(dur(40));
		showPrize = false;
	};

	// collect off the director's coin-trail beat (parity with the Spine path).
	context.eventEmitter.subscribeOnMount({
		buildCoinTrail: ({ reel: r, row: rw, board: b }) => {
			if ((b ?? 0) !== board) return;
			if (r === reel && rw === row && showPrize) void collect();
		},
	});

	onMount(() => registerHouse(reel, row, { appear, upgradeTo, maxed, openDoor, collect, setStatic }, board));

	const doorScaleX = $derived(1 - doorT.current * 0.88);
	const plaqueScale = $derived(jackpot === 'grand' ? 1.35 : jackpot === 'major' ? 1.15 : 1);
</script>

{#if tier >= 1}
	<Container {x} {y} scale={scale.current} alpha={alpha.current}>
		<Sprite
			key={`house_t${tier}`}
			anchor={{ x: 0.5, y: 1 }}
			x={0}
			y={GROUND_Y + bob.current}
			width={HOUSE}
			height={HOUSE}
			tint={premium ? 0xffe9a8 : 0xffffff}
		/>
		<!-- the same tier medallion the Spine path draws (HouseView), so the fallback reads identically -->
		<TierBadge {tier} {size} />

		{#if doorT.current > 0.001 || showPrize}
			<Graphics
				draw={(g) => {
					g.roundRect(-DOOR_W / 2, DOOR_TOP, DOOR_W, DOOR_H, size * 0.05).fill({ color: premium ? 0x2a1c06 : 0x120d0a, alpha: 1 });
					g.roundRect(-DOOR_W / 2, DOOR_TOP, DOOR_W, DOOR_H, size * 0.05).stroke({ width: size * 0.028, color: premium ? 0xffcf6a : 0x6a4a2c, alpha: 1 });
				}}
			/>

			{#if showPrize}
				{#if jackpot}
					<Graphics
						x={0}
						y={DOOR_TOP - size * 0.16}
						scale={prizePop.current * plaqueScale}
						draw={(g) => {
							const w = size * 0.6;
							const h = size * 0.26;
							g.roundRect(-w / 2, -h / 2, w, h, h * 0.35).fill({ color: JACKPOT_COLOR[jackpot as Exclude<JackpotKind, null>], alpha: 1 });
							g.roundRect(-w / 2, -h / 2, w, h, h * 0.35).stroke({ width: size * 0.022, color: 0xffffff, alpha: 0.9 });
						}}
					/>
					<Text
						x={0}
						y={DOOR_TOP - size * 0.16}
						anchor={0.5}
						scale={prizePop.current * plaqueScale}
						text={prizeText}
						style={{ fontFamily: 'Inter, sans-serif', fontSize: size * 0.13, fontWeight: '800', fill: 0x1a1206, letterSpacing: 1 }}
					/>
				{:else}
					<Text
						x={0}
						y={DOOR_TOP + DOOR_H * 0.5}
						anchor={0.5}
						scale={prizePop.current}
						text={prizeText}
						style={{ fontFamily: 'Inter, sans-serif', fontSize: size * 0.16, fontWeight: '800', fill: 0xfff4d6, stroke: { color: 0x3a2410, width: size * 0.02 } }}
					/>
				{/if}
			{/if}

			<Container x={-DOOR_W / 2} y={DOOR_TOP} scale={{ x: doorScaleX, y: 1 }}>
				<Graphics
					draw={(g) => {
						g.roundRect(0, 0, DOOR_W, DOOR_H, size * 0.04).fill({ color: premium ? 0xc98a2c : 0x8a5a2c, alpha: 1 });
						g.rect(0, 0, size * 0.03, DOOR_H).fill({ color: 0x5a3a1c, alpha: 1 });
						g.circle(DOOR_W * 0.82, DOOR_H * 0.5, size * 0.02).fill({ color: 0x2a1a0c, alpha: 1 });
					}}
				/>
			</Container>
		{/if}
	</Container>
{/if}
