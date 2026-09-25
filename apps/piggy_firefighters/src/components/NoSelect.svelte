<script lang="ts">
	import { onMount } from 'svelte';

	/**
	 * A slot is not a document: nothing on it is selectable, copyable, draggable or long-press
	 * callable (studio E33 directive, 2026-08-02; the cross-game gate is
	 * tools/sec7walk/probe-no-select.mjs). app.html already sets user-select:none on every element;
	 * this closes the event side — copy / cut / selectstart / contextmenu / dragstart — at the
	 * document, so no future component can opt back in by accident. Ported from piggy-christmas's
	 * NoSelect.svelte (same contract, same event list). Range inputs (the burger sliders) carry no
	 * text and are unaffected.
	 */
	const BLOCKED = ['copy', 'cut', 'selectstart', 'contextmenu', 'dragstart'] as const;

	onMount(() => {
		const block = (event: Event) => event.preventDefault();
		BLOCKED.forEach((type) => document.addEventListener(type, block));
		return () => BLOCKED.forEach((type) => document.removeEventListener(type, block));
	});
</script>
