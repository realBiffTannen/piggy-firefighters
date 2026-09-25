<script lang="ts">
	// RESCUE SCENE — Rescue Spins / Inferno Rescue (contract §5-§6, theme §4), plus the Backdraft Spins header plate
	// (contract §7) and the feature banner.
	//
	// PLACEHOLDER PICTURE, HONEST STATE. Everything drawn here READS game/rescue/stateRescue.svelte.ts, which only the
	// rescue director writes, from the book: the apartment block above the reels with one room per reel column and its
	// fire level (2 roaring / 1 smouldering / 0 SAFE), a spray flash when a W on that reel douses it, the Inferno
	// instant prize on the sill of a rescued room, the building number, the global multiplier badge and the running
	// TOTAL (the HUD's own WIN readout is claimed by the scene: claimWin('rescue')). The spins counter is the HUD's
	// (setFeatureSpins). The art lane replaces these Graphics/Text with the painted block, the ladder, the pigs and the
	// hose arcs; the director and this state do not change.
	//
	// Laid out in BOARD-LOCAL units (SYMBOL_SIZE per cell, reel 0 at x = REEL_PADDING cells), inside the band the scene
	// layout reserves above the frame while the scene is up (stateGame BUILDING_BAND_CELLS).
	import { onMount } from 'svelte';
	import { Container, Graphics, Text, PIXI } from 'pixi-svelte';

	import Grab from '../scene/Grab.svelte';
	import { getContext } from '../../game/context';
	import { SYMBOL_SIZE, REEL_PADDING, BOARD_SIZES } from '../../game/constants';
	import { formatBookAmount } from '../../game/money';
	import { MODE_TITLE, BUILDING, trotterSkin } from '../../game/names';
	import { prefersReducedMotion } from '../../game/fx/timing';
	import { boardTicker } from '../../game/reels/boardTicker';
	import { stateRescue, stateBackdraftSpins } from '../../game/rescue/stateRescue.svelte';

	const context = getContext();
	const S = SYMBOL_SIZE;
	const W = BOARD_SIZES.width;
	const INK = 0x3a2213;
	const CREAM = 0xf4e9d2;

	const sl = $derived(context.stateGameDerived.sceneLayout());
	const bl = () => context.stateGameDerived.boardLayout();
	const H = $derived(BOARD_SIZES.height * sl.rowPitch);
	const inferno = $derived(stateRescue.bonus === 'inferno');

	// the band above the frame, in board-local units
	const bandTop = $derived(-(sl.frameTopCells + sl.buildingBandCells) * S);
	const bandH = $derived(sl.buildingBandCells * S);
	const roofH = $derived(bandH * 0.28);
	const winTop = $derived(bandTop + roofH + bandH * 0.06);
	const winH = $derived(bandH * 0.6);
	const cellX = (reel: number) => (reel + REEL_PADDING) * S;

	const fireColor = (fire: number, rescued: boolean) => (rescued || fire <= 0 ? 0x1e2a4a : fire >= 2 ? 0xff5a1a : 0xffb347);
	const fireLabel = (fire: number, rescued: boolean) => (rescued || fire <= 0 ? 'SAFE' : fire >= 2 ? 'FIRE 2' : 'FIRE 1');

	// ---- one-shot spray flashes + the banner fade, from ONE ticker ---------------------------------------------------
	let sprayNodes: (PIXI.Container | undefined)[] = [];
	const sprayT = [0, 0, 0, 0, 0].map(() => 1);
	const lastSprayed = [0, 0, 0, 0, 0];
	let bannerNode: PIXI.Container | undefined;
	let bannerT = 1;
	let lastBanner = 0;

	$effect(() => {
		stateRescue.rooms.forEach((room) => {
			if (room.sprayed !== lastSprayed[room.reel]) {
				lastSprayed[room.reel] = room.sprayed;
				sprayT[room.reel] = 0;
			}
		});
	});
	$effect(() => {
		if (stateRescue.bannerSeq !== lastBanner) {
			lastBanner = stateRescue.bannerSeq;
			bannerT = 0;
		}
	});

	const tick = (dt: number) => {
		const reduced = prefersReducedMotion();
		for (let r = 0; r < 5; r += 1) {
			const node = sprayNodes[r];
			if (!node || node.destroyed) continue;
			sprayT[r] = Math.min(1, sprayT[r] + dt / 520);
			node.visible = sprayT[r] < 1;
			node.alpha = 1 - sprayT[r];
			if (!reduced) node.scale.set(1 + 0.25 * sprayT[r]);
		}
		if (bannerNode && !bannerNode.destroyed) {
			bannerT = Math.min(1, bannerT + dt / 1500);
			bannerNode.visible = bannerT < 1 && !!stateRescue.banner;
			const inP = Math.min(1, bannerT / 0.12);
			bannerNode.alpha = bannerT < 0.75 ? inP : 1 - (bannerT - 0.75) / 0.25;
			if (!reduced) bannerNode.scale.set(0.85 + 0.15 * inP);
		}
	};

	onMount(() => {
		boardTicker.add(tick);
		return () => boardTicker.remove(tick);
	});

	const titleStyle = (size: number, fill = CREAM) => ({
		fontFamily: 'StationSign, Lilita One, Inter, sans-serif',
		fontSize: size,
		fill,
		align: 'center' as const,
		stroke: { color: INK, width: Math.max(2, size * 0.14), join: 'round' as const },
	});
</script>

<Container x={bl().x} y={bl().y} scale={bl().zoomScale} pivot={{ x: W / 2, y: H / 2 }}>
	{#if stateRescue.active && bandH > 0}
		<!-- the block: brick facade, roof strip with the building number, total and multiplier badge -->
		<Graphics
			draw={(g) => {
				g.roundRect(-S * 0.08, bandTop, W + S * 0.16, bandH, S * 0.08).fill(inferno ? 0x5a1a14 : 0x6e3a2a).stroke({ width: 4, color: INK });
				g.rect(-S * 0.08, bandTop, W + S * 0.16, roofH).fill(inferno ? 0x2a0a08 : 0x3a2418);
				for (let y = bandTop + roofH + S * 0.12; y < bandTop + bandH - 4; y += S * 0.14) g.rect(-S * 0.04, y, W + S * 0.08, 2).fill({ color: 0x000000, alpha: 0.18 });
			}}
		/>
		<!-- building number at the left, the running TOTAL right-aligned before the multiplier badge (never overlapping) -->
		<Text anchor={{ x: 0, y: 0.5 }} x={S * 0.05} y={bandTop + roofH / 2} text={`${BUILDING} ${stateRescue.building}`} style={titleStyle(roofH * 0.5)} />
		<Text anchor={{ x: 1, y: 0.5 }} x={W - S * 0.72} y={bandTop + roofH / 2} text={`TOTAL ${formatBookAmount(stateRescue.total)}`} style={titleStyle(roofH * 0.5, 0xf5d23c)} />
		<Container x={W - S * 0.32} y={bandTop + roofH / 2}>
			<Graphics draw={(g) => g.circle(0, 0, roofH * 0.62).fill(inferno ? 0xe9b23b : 0xd7262b).stroke({ width: 4, color: INK })} />
			<Text anchor={0.5} text={`x${stateRescue.multiplier}`} style={titleStyle(roofH * 0.55)} />
		</Container>

		{#each stateRescue.rooms as room (room.reel)}
			<Container x={cellX(room.reel)} y={winTop + winH / 2}>
				<Graphics
					draw={(g) => {
						const w = S * 0.78;
						g.roundRect(-w / 2, -winH / 2, w, winH, S * 0.06).fill(fireColor(room.fire, room.rescued)).stroke({ width: 5, color: INK });
						g.rect(-w / 2, winH / 2 - S * 0.06, w, S * 0.08).fill(0xc9c2b8).stroke({ width: 3, color: INK });
						if (!room.rescued && room.fire > 0) {
							// cartoon flames licking out of the window: one lick per fire level
							for (let i = 0; i < room.fire + 1; i += 1) {
								const x = (i - room.fire / 2) * S * 0.2;
								g.moveTo(x, -winH * 0.45).bezierCurveTo(x + S * 0.08, -winH * 0.1, x + S * 0.06, winH * 0.2, x, winH * 0.3).bezierCurveTo(x - S * 0.06, winH * 0.2, x - S * 0.08, -winH * 0.1, x, -winH * 0.45).fill({ color: 0xf5d23c, alpha: 0.85 });
							}
						}
					}}
				/>
				<Text anchor={0.5} y={winH * 0.22} text={fireLabel(room.fire, room.rescued)} style={titleStyle(S * 0.17)} />
				{#if room.rescued}
					<!-- the rescued Trotter (placeholder label for the rig skin: theme §2 rotation) -->
					<Text anchor={0.5} y={-winH * 0.36} text={trotterSkin(room.reel, stateRescue.building).toUpperCase()} style={titleStyle(S * 0.11, 0xf4e9d2)} />
				{/if}
				{#if room.rescued && room.prize}
					<Text anchor={0.5} y={-winH * 0.18} text={`+${formatBookAmount(room.prize)}`} style={titleStyle(S * 0.15, 0xf5d23c)} />
				{/if}
				<!-- the spray flash when a W on this reel douses the room (placeholder for the hose arc + steam) -->
				<Container visible={false}>
					<Grab ongrab={(node) => (sprayNodes[room.reel] = node)} />
					<Graphics draw={(g) => g.roundRect(-S * 0.45, -winH / 2 - S * 0.05, S * 0.9, winH + S * 0.1, S * 0.08).fill({ color: 0x8ccaf5, alpha: 0.75 })} />
					<Text anchor={0.5} text="SPLASH!" style={titleStyle(S * 0.16, 0xffffff)} />
				</Container>
			</Container>
		{/each}
	{/if}

	{#if stateBackdraftSpins.active}
		<!-- Backdraft Spins header plate on the frame's header beam (theme §4: "the 5-spin counter on a brass plate") -->
		<Container x={W / 2} y={-(sl.frameTopCells * S) / 2}>
			<Graphics draw={(g) => g.roundRect(-S * 1.9, -S * 0.2, S * 3.8, S * 0.4, S * 0.1).fill(0xe9b23b).stroke({ width: 4, color: INK })} />
			<Text
				anchor={0.5}
				text={`${MODE_TITLE.backdraft_spins} · ${stateBackdraftSpins.spinsLeft} LEFT · ${formatBookAmount(stateBackdraftSpins.total)}`}
				style={{ ...titleStyle(S * 0.2, INK), stroke: { color: CREAM, width: 3, join: 'round' as const } }}
			/>
		</Container>
	{/if}

	<!-- the feature banner ('RESCUED!', '+1 SPIN', 'NEXT BUILDING · +5 SPINS', 'RESCUE SPINS COMPLETE') -->
	<Container x={W / 2} y={H / 2} visible={false}>
		<Grab ongrab={(node) => (bannerNode = node)} />
		{#if stateRescue.banner}
			<Graphics draw={(g) => g.roundRect(-S * 2.3, -S * 0.36, S * 4.6, S * 0.72, S * 0.18).fill({ color: 0x1e2a4a, alpha: 0.88 }).stroke({ width: 5, color: 0xff7a1a })} />
			<Text anchor={0.5} text={stateRescue.banner} style={titleStyle(S * 0.3, 0xf5d23c)} />
		{/if}
	</Container>
</Container>
