<script lang="ts">
	// TIER MEDALLION (owner, 2026-09-19: "it should be obvious when a house is a higher tier
	// than another"). Tier used to be carried ONLY by house art detail, which does not survive
	// small cells, and neighbouring tiers share a palette (1/2 both warm cottages, 4/5 both
	// cream and gold): in a Golden Expanded round a Tier 4 mansion beside a Tier 5 palace could
	// not be told apart at ~85 px cells, let alone the ~40 px phone cells.
	//
	// A number, not pips: one digit still reads at a 14 px medallion where five dots do not,
	// it is colour-blind safe, and "bigger number = higher tier" needs no explanation. The fill
	// ALSO steps per tier (4 and 5 deliberately far apart in hue) for an at-a-glance read.
	//
	// Static drawing only: no ticker, no tween, no grabbed node. The parent's own pulse scales
	// it with the house, and the digit changes when the parent's reactive tier changes (under
	// the rig's dust cover on an upgrade). Nothing here can hold a beat.
	import { Container, Graphics, Text } from 'pixi-svelte';

	type Props = {
		/** 1..5; anything else draws nothing */
		tier: number;
		/** the cell's pixel size (the medallion scales with it) */
		size: number;
	};
	const { tier, size }: Props = $props();

	const FILL = [0, 0xb9860f, 0x8a5a2b, 0xc0392b, 0x3e6fb0, 0x7a3fc0]; // straw, wood, brick, slate, royal
	const RIM = [0, 0x3a2608, 0x2a1a0d, 0x3d0f0a, 0x0f2440, 0xffd24a]; // tier 5 alone wears a gold rim
	const t = $derived(Math.round(tier));
	const ok = $derived(t >= 1 && t <= 5);
	// Floor of 8.5: on a phone's ~37 px expanded cells a proportional medallion put a ~7 px digit on screen,
	// readable only just. At that size the house art is unreadable anyway, so the tier IS the information and
	// the medallion is allowed to take a bigger share of the cell. Cells of ~50 px and up are unaffected.
	const r = $derived(Math.max(8.5, size * 0.17)); // 37 px cell -> 8.5; 85 px -> 14.5; 190 px -> 32
	// top-left of the cell: clear of the door, where the prize label and the collect flight live
	const cx = $derived(-size / 2 + r * 1.15);
	const cy = $derived(-size / 2 + r * 1.15);
</script>

{#if ok}
	<Container x={cx} y={cy}>
		{#key `${t}_${Math.round(r)}`}
			<Graphics
				draw={(g) => {
					g.circle(0, r * 0.12, r * 1.06).fill({ color: 0x000000, alpha: 0.35 }); // soft drop
					g.circle(0, 0, r * 1.12).fill({ color: RIM[t] });
					g.circle(0, 0, r * 0.92).fill({ color: FILL[t] });
					g.ellipse(-r * 0.22, -r * 0.4, r * 0.5, r * 0.26).fill({ color: 0xffffff, alpha: 0.22 }); // top sheen
				}}
			/>
			<Text
				text={String(t)}
				anchor={0.5}
				y={-r * 0.04}
				style={{
					fontFamily: 'Lilita One, Inter, system-ui, sans-serif',
					fontWeight: '900',
					fontSize: r * 1.5,
					fill: 0xffffff,
					stroke: { color: 0x160c04, width: Math.max(1.5, r * 0.22) },
				}}
			/>
		{/key}
	</Container>
{/if}
