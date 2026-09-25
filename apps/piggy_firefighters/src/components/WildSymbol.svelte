<script lang="ts">
	// WILD reel symbol. The WILD art is Master Bao holding the red-and-gold WILD banner (sym_W w.webp,
	// and the 1:1.3 symT_W tile on stacked phone layouts). The donor's Spine rig and its `win` clip are
	// retired from the reels, so the WILD lands, wins and idles as a sprite like every other symbol. Its
	// win performance is sprite-only, no rig:
	//   - game/symbolMotion.ts `W`: a sink, a scale PUNCH (+17 %, grown from the base) and a damped
	//     settle — played by components/SymbolSprite.svelte like every other symbol's win;
	//   - components/BoardFx.svelte WILD BANNER: the banner cropped from the same texture
	//     (symbolMotion WILD_BANNER) flashes gold on the punch and on the settle (one flash in turbo),
	//     a gold glint runs along it, and a gold ring + star pop fires on the burst beat. BoardFx does
	//     this for every WILD cell in a paying way, since the way names the symbol the wild stood in for;
	//   - reduced motion: no flash, no punch — the symbol only fades.
	// Turbo / Super Turbo shorten it exactly like the other symbols' win bursts (duration x speedFactor).
	// components/Symbol.svelte renders SymbolSprite directly; this wrapper only remains for callers that
	// want a WILD by name.
	import SymbolSprite from './SymbolSprite.svelte';
	import { getSymbolInfo } from '../game/utils';
	import type { SymbolState } from '../game/types';

	type Props = {
		x?: number;
		y?: number;
		state: SymbolState;
		symbolInfo: ReturnType<typeof getSymbolInfo>;
		oncomplete?: () => void;
	};

	const props: Props = $props();
</script>

<SymbolSprite
	symbolInfo={props.symbolInfo}
	x={props.x}
	y={props.y}
	state={props.state}
	symbolName="W"
	oncomplete={props.oncomplete}
/>
