<script lang="ts">
	import SymbolSprite from './SymbolSprite.svelte';
	import { getSymbolInfo } from '../game/utils';
	import type { SymbolState, RawSymbol } from '../game/types';
	import { stateGame } from '../game/stateGame.svelte';

	type Props = {
		x?: number;
		y?: number;
		state: SymbolState;
		rawSymbol: RawSymbol;
		oncomplete?: () => void;
		loop?: boolean;
		/** a row outside the window: no landing, no idle life */
		quiet?: boolean;
		/** false while this symbol's twin on the other board is the one on show */
		active?: boolean;
	};

	const props: Props = $props();
	const symbolInfo = $derived(getSymbolInfo({ rawSymbol: props.rawSymbol, state: props.state }));
	// A hard hat that helps complete the trigger (6 or more on the spin) gets the
	// louder land pop, synced with the trigger cue.
	const hatEmphasis = $derived(
		(props.rawSymbol.name === 'HAT' || props.rawSymbol.name === 'GHAT') && stateGame.scatterCounter >= 6,
	);
</script>

<!-- Every symbol, the WILD included, is a cartoon sprite moved by game/symbolMotion.ts. The WILD is
     Master Bao holding the WILD banner (sym_W w.webp; symT_W on stacked phone layouts) and has no rig:
     its win is the symbolMotion `W` punch + settle played here, plus the BoardFx WILD BANNER
     performance over the cell (banner flash, glint, ring + star pop). SymbolSprite's own sign flash
     stays dark for the WILD (`W` keeps flash = 0). -->
<SymbolSprite
	{symbolInfo}
	x={props.x}
	y={props.y}
	state={props.state}
	symbolName={props.rawSymbol.name}
	emphasis={hatEmphasis}
	quiet={props.quiet}
	active={props.active}
	oncomplete={props.oncomplete}
/>
