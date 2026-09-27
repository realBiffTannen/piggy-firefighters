<script lang="ts">
	// THE COIN FOUNTAIN of the in-feature win count-up (Win.svelte decides when; wins above 20x only).
	//
	// Two fountains, one per half of the figure's plaque, rise out from BEHIND its top edge and fan up and outward,
	// tumbling through this title's 32-frame Blender coin turntable (static/assets/3d/winrungs/coins), each coin from
	// its own start phase and in either spin direction, then fall away and fade. Win.svelte draws the plaque over this
	// layer, so a coin never crosses the digits. The launch speed tops out under a ceiling 0.6 cells over the reels' top
	// edge (game/winCoinFountain.ts coinCeiling), so no coin climbs over the Rescue plates (TOTAL / BUILDING / xN) or
	// the rescued pigs' windows.
	//
	// The config is particle-emitter V3, built in game/winCoinFountain.ts: pixi-svelte flattens the coin sheet into a
	// plain Texture[] and upgradeConfig would turn a V1 config into `textureRandom` (one frozen frame per coin, a
	// sticker spinning flat); a config with `behaviors` goes through unchanged.
	//
	// Units are board units (this container is scaled like the board) and times real seconds (emitSpeed). Emission:
	// `emit` starts a fresh run (ParticleEmitter re-inits), and `spawnChance` 0 stops spawning at once while the coins
	// already in the air finish their flight; an idle emitter with no coin alive is not updated at all.
	import { Container, ParticleEmitter } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { BOARD_SIZES } from '../game/constants';
	import { getContext } from '../game/context';
	import { qv } from '../game/quality.svelte';
	import { sceneTex } from '../game/fx/sceneTextures.svelte';
	import { COIN_BUDGET, COIN_TIME_SCALE, coinCeiling, coinFountainConfig } from '../game/winCoinFountain';

	type Props = {
		/** spawn while true */
		emit?: boolean;
		/** the figure's plaque in board units (game/winCoinFountain.ts plaqueFor) */
		plaque: { w: number; h: number };
	};

	const props: Props = $props();
	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());

	// the boot sheet's frames in turntable order (pff_coin_00 .. 31; a v8 Spritesheet labels each texture with its key)
	const frames = $derived.by(() => {
		const list = sceneTex('coins');
		if (!Array.isArray(list)) return [];
		return [...list].sort((a, b) => String(a?.label ?? '').localeCompare(String(b?.label ?? '')));
	});
	// the mid / low quality tiers carry fewer coins (game/quality.svelte)
	const budget = $derived(qv(COIN_BUDGET));
	// its own derived: `layout` changes at 60 Hz under the anticipation camera, the row pitch only with the layout type
	const ceiling = $derived(coinCeiling(BOARD_SIZES.height, layout.rowPitch));
	const left = $derived(coinFountainConfig(frames, -1, props.plaque, budget, ceiling));
	const right = $derived(coinFountainConfig(frames, 1, props.plaque, budget, ceiling));
	const spawnChance = $derived(props.emit ? 1 : 0);
</script>

<MainContainer>
	<Container x={layout.x} y={layout.y} scale={layout.scale}>
		<ParticleEmitter key="coins" config={left} emit={props.emit} emitSpeed={COIN_TIME_SCALE} {spawnChance} />
		<ParticleEmitter key="coins" config={right} emit={props.emit} emitSpeed={COIN_TIME_SCALE} {spawnChance} />
	</Container>
</MainContainer>
