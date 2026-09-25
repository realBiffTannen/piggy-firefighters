<script lang="ts">
	// One build plot on the bonus board: the dirt lot (varied a little per cell so
	// fifteen plots do not read as one stamp), the cell frame, and the LOCK — once
	// a house stands here the plain steel frame snaps to a gold one with a rim
	// light, the way a held cell does on a cabinet hold-and-spin.
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut } from 'svelte/easing';

	import { Container, Graphics, Sprite } from 'pixi-svelte';

	import { stateBuild } from '../../game/build/stateBuild.svelte';
	import { dur, prefersReducedMotion } from '../../game/build/buildTiming';

	type Props = {
		reel: number;
		row: number;
		x: number;
		y: number;
		size: number;
		premium?: boolean;
		/** 0..1 breathing value from the scene (near-full shimmer / last spin) */
		shimmer?: number;
		board?: number;
	};
	const { reel, row, x, y, size: S, premium = false, shimmer = 0, board = 0 }: Props = $props();

	const tier = $derived(stateBuild.boards[board]?.tiers[`${reel}_${row}`] ?? 0);
	const locked = $derived(tier >= 1);

	// deterministic per-cell variety (presentation only)
	const h = (reel * 7 + row * 13 + reel * row * 3) % 10;
	const flip = h % 2 === 0 ? 1 : -1;
	const plotScale = 0.93 + ((h * 3) % 5) * 0.012;
	const plotTint = [0xffffff, 0xf3e7d6, 0xe9f0e2, 0xf7efe2, 0xe6ded2][h % 5];
	const plotRot = ((h % 3) - 1) * 0.012;
	const plotDx = (((h * 5) % 7) - 3) * 0.006 * S;

	const lockT = new Tween(0, { duration: 0, easing: backOut });
	const flash = new Tween(0, { duration: 0, easing: cubicOut });
	let wasLocked = false;
	$effect(() => {
		if (locked && !wasLocked) {
			wasLocked = true;
			if (prefersReducedMotion()) {
				void lockT.set(1, { duration: 0 });
			} else {
				void lockT.set(1, { duration: dur(420) });
				void flash.set(1, { duration: 0 }).then(() => flash.set(0, { duration: dur(620) }));
			}
		} else if (!locked && wasLocked) {
			wasLocked = false;
			void lockT.set(0, { duration: 0 });
		}
	});

	const GOLD = 0xffc53a;
	const half = S * 0.47;
</script>

<Container {x} {y}>
	<!-- recessed bay -->
	<Graphics
		zIndex={0}
		draw={(g) => {
			g.roundRect(-half, -half, half * 2, half * 2, S * 0.07).fill({ color: premium ? 0x2b2110 : 0x08303a, alpha: 0.9 });
			g.roundRect(-half, -half, half * 2, S * 0.2, S * 0.07).fill({ color: 0x000000, alpha: 0.16 });
			g.roundRect(-half, half - S * 0.3, half * 2, S * 0.3, S * 0.07).fill({ color: premium ? 0x6a4f17 : 0x0f4a55, alpha: 0.35 });
		}}
	/>

	<!-- the lot itself -->
	<Sprite
		zIndex={1}
		key="cellBackplate"
		anchor={{ x: 0.5, y: 1 }}
		x={plotDx}
		y={S * 0.455}
		width={S * 0.94 * plotScale * flip}
		height={(S * 0.94 * plotScale) / (963 / 645)}
		rotation={plotRot}
		tint={plotTint}
		alpha={locked ? 1 : 0.92}
	/>

	<!-- plain frame (always) -->
	<Graphics
		zIndex={2}
		alpha={Math.max(0, 1 - Math.min(1, lockT.current))}
		draw={(g) => {
			g.roundRect(-half, -half, half * 2, half * 2, S * 0.07).stroke({ width: S * 0.035, color: premium ? 0x7d6222 : 0x1d5f70, alpha: 0.95 });
			g.roundRect(-half + S * 0.03, -half + S * 0.03, half * 2 - S * 0.06, half * 2 - S * 0.06, S * 0.05).stroke({ width: S * 0.012, color: premium ? 0xd9b04a : 0x58b7c6, alpha: 0.35 });
		}}
	/>
	{#if shimmer > 0.01 && !locked}
		<Graphics
			zIndex={2}
			blendMode="add"
			alpha={shimmer}
			draw={(g) => {
				for (let i = 0; i < 3; i += 1) g.roundRect(-half - i * 2, -half - i * 2, half * 2 + i * 4, half * 2 + i * 4, S * 0.08).stroke({ width: S * 0.04, color: GOLD, alpha: 0.3 });
			}}
		/>
	{/if}

	<!-- LOCKED: gold frame + rim light -->
	{#if lockT.current > 0.001}
		<Container zIndex={3} scale={1.14 - 0.14 * Math.min(1.08, lockT.current)} alpha={Math.min(1, lockT.current * 1.6)}>
			<Graphics
				blendMode="add"
				alpha={0.55 + flash.current * 0.45}
				draw={(g) => {
					for (let i = 0; i < 5; i += 1) {
						const o = S * 0.012 * i;
						g.roundRect(-half - o, -half - o, half * 2 + o * 2, half * 2 + o * 2, S * 0.08).stroke({ width: S * 0.03, color: 0xffb21f, alpha: 0.2 - i * 0.03 });
					}
				}}
			/>
			<Graphics
				draw={(g) => {
					g.roundRect(-half, -half, half * 2, half * 2, S * 0.07).stroke({ width: S * 0.075, color: 0x5a3306 });
					g.roundRect(-half, -half, half * 2, half * 2, S * 0.07).stroke({ width: S * 0.05, color: GOLD });
					g.roundRect(-half + S * 0.012, -half + S * 0.012, half * 2 - S * 0.024, half * 2 - S * 0.024, S * 0.06).stroke({ width: S * 0.013, color: 0xfff2b8, alpha: 0.9 });
					// corner rivets
					for (const sx of [-1, 1])
						for (const sy of [-1, 1]) {
							g.circle(sx * (half - S * 0.005), sy * (half - S * 0.005), S * 0.036).fill({ color: 0x5a3306 });
							g.circle(sx * (half - S * 0.005), sy * (half - S * 0.005), S * 0.024).fill({ color: 0xffe08a });
						}
				}}
			/>
		</Container>
	{/if}

	<!-- lock flash -->
	{#if flash.current > 0.01}
		<Graphics
			zIndex={4}
			blendMode="add"
			alpha={flash.current * 0.55}
			draw={(g) => g.roundRect(-half, -half, half * 2, half * 2, S * 0.07).fill({ color: 0xfff0b0 })}
		/>
	{/if}
</Container>
