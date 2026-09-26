<script lang="ts" module>
	import {
		Emitter,
		upgradeConfig,
		type EmitterConfigV3,
		type EmitterConfigV2,
		type EmitterConfigV1,
	} from '@barvynkoa/particle-emitter';

	import type { LoadedSpriteSheet } from '../types';

	export type Props = Partial<Emitter> & {
		key: string;
		emitSpeed?: number;
		config: EmitterConfigV3 | EmitterConfigV2 | EmitterConfigV1;
	};
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';
	import { getContextApp, getContextParent } from '../context.svelte';
	import { propsSyncEffect } from '../utils.svelte';

	const props: Props = $props();
	const context = getContextApp();
	const parentContext = getContextParent();
	const textures = $derived(context.stateApp.loadedAssets?.[props.key] as LoadedSpriteSheet);
	const updatedConfig = $derived(upgradeConfig(props.config, textures));
	// svelte-ignore state_referenced_locally
	const emitter = new Emitter(parentContext.parent, updatedConfig);

	propsSyncEffect({ props, target: emitter, ignore: ['emit'] });

	$effect(() => {
		if (props.emit) emitter.init(updatedConfig);
	});

	// ONE named ticker callback, removed with the emitter: an anonymous add() outlived every unmount (each coin
	// show left a zombie callback holding its destroyed Emitter and config). An idle emitter — not asked to emit
	// and with no particle alive — is not updated at all.
	const tick = () => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		if (!props.emit && emitter.particleCount === 0) return;
		emitter.update(app.ticker.deltaMS * (props.emitSpeed || 0.00234));
	};
	context.stateApp.pixiApplication?.ticker.add(tick);

	onDestroy(() => {
		context.stateApp.pixiApplication?.ticker.remove(tick);
		emitter.emit = false;
		emitter.destroy();
	});
</script>
