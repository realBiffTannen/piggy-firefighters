<script lang="ts">
	import { Container, ParticleEmitter } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { fountain as baseConfig } from 'constants-shared/particleConfig';

	import { getContext } from '../game/context';

	type Props = {
		emit?: boolean;
	};

	const props: Props = $props();
	const context = getContext();

	// Coin show for wins above 20x only (Win.svelte decides). Textures are the game's own
	// 3D-tumbling gold coin (128 px cells), so the scale is larger than the old template's.
	const config = {
		...baseConfig,
		scale: { start: 0.85, end: 1.05, minimumScaleMultiplier: 0.8 },
		frequency: 0.11,
		maxParticles: 60,
		lifetime: { min: 3.2, max: 3.8 },
	};
</script>

<MainContainer>
	<Container
		x={context.stateGameDerived.boardLayout().x}
		y={context.stateGameDerived.boardLayout().y}
	>
		<ParticleEmitter {config} key="coins" emit={props.emit} />
	</Container>
</MainContainer>
