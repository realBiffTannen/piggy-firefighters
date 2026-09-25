<script lang="ts" module>
	// RETIRED (wave 5): the intro / outro mode cards now RIDE ON THE ROLLER SHUTTER
	// (components/scene/SceneShutter.svelte), which also owns their press gate.
	// This module only keeps the emitter type that game/typesEmitterEvent.ts
	// imports, so that file (another owner's) needs no edit. It renders nothing
	// and is no longer mounted by Game.svelte.
	import type { BonusKind } from '../../game/typesBookEvent';

	export type EmitterEventBuildCard =
		| { type: 'buildCardShow'; kind: 'intro' | 'outro'; bonus: BonusKind; premium: boolean }
		| { type: 'buildCardHide' };
</script>
