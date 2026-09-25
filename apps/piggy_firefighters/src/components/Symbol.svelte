<script lang="ts">
	import SymbolSprite from './SymbolSprite.svelte';
	import { getSymbolInfo } from '../game/utils';
	import type { SymbolState, RawSymbol } from '../game/types';
	import { stateGame } from '../game/stateGame.svelte';
	import { SCATTER_SYMBOLS, TRIGGER_ALARMS } from '../game/constants';

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
	// An alarm that helps complete the trigger (3 or more on the spin) gets the louder land pop, synced with the
	// trigger cue.
	const alarmEmphasis = $derived(SCATTER_SYMBOLS.has(props.rawSymbol.name) && stateGame.scatterCounter >= TRIGGER_ALARMS);
</script>

<!-- Every symbol, the WILD included, is a sprite moved by game/symbolMotion.ts. The WILD is Chief Hamm holding the
     WILD badge (sym_W; a Backdraft's Blaze Wild draws sym_W_BLAZE) and has no rig yet: its win is the symbolMotion
     `W` punch + settle played here, plus the BoardFx WILD BANNER performance over the cell. -->
<SymbolSprite
	{symbolInfo}
	x={props.x}
	y={props.y}
	state={props.state}
	symbolName={props.rawSymbol.name}
	emphasis={alarmEmphasis}
	quiet={props.quiet}
	active={props.active}
	oncomplete={props.oncomplete}
/>
