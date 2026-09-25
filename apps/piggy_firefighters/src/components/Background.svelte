<script lang="ts">
	// The flat environment stills are gone: the background is the layered, living
	// site (components/scene/AmbientWorld.svelte). Day / blue hour / golden hour is
	// driven by `stateScene.mood`, which the build director flips only while the
	// roller shutter covers the play area — never by a bare cross-fade in view.
	import AmbientWorld from './scene/AmbientWorld.svelte';
</script>

<AmbientWorld />
