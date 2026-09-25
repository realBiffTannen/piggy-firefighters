<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	import { getContextEventEmitter } from 'utils-event-emitter';
	import { stateConfig } from 'state-shared';

	import type { EmitterEventHotKey } from '../types';

	const context = getContextEventEmitter<EmitterEventHotKey>();
	const PREVENT_DEFAULT_KEYS = ['Space', 'ArrowUp', 'ArrowDown'];
	const EXCLUDED_TAGS = ['input', 'textarea', 'select'];

	const getValidElement = (e: KeyboardEvent) =>
		!EXCLUDED_TAGS.includes((e?.target as HTMLElement | null)?.tagName?.toLowerCase() as string);

	// Jurisdictions can forbid the spacebar-bet hotkey via the authenticate
	// response; Space still preventDefaults (no page scroll) but never
	// broadcasts, so neither spin-on-space nor space-hold can fire.
	const spacebarBlocked = (key: string) =>
		key === 'Space' && stateConfig.jurisdiction?.disabledSpacebar === true;

	function handleKeydown(e: KeyboardEvent) {
		if (getValidElement(e)) {
			const isSpace = e.key === ' ';
			const key = isSpace ? 'Space' : e.key;
			if (PREVENT_DEFAULT_KEYS.includes(key)) e.preventDefault();
			if (spacebarBlocked(key)) return;
			// ONE PRESS, ONE BET: the OS auto-repeats a held key as a stream of keydowns. Only the first one of a
			// held spacebar is a press; the repeats are dropped so a held key can never start a second round
			// (qa/final_lucky/jurisdiction_r1.md violation 3; the bet machine no longer repeats on isSpaceHold).
			if (key === 'Space' && e.repeat) return;
			if (key) context.eventEmitter.broadcast({ type: 'hotKey', key, action: 'keyDown' });
		}
	}

	function handleKeyup(e: KeyboardEvent) {
		if (getValidElement(e)) {
			const isSpace = e.key === ' ';
			const key = isSpace ? 'Space' : e.key;
			if (PREVENT_DEFAULT_KEYS.includes(key)) e.preventDefault();
			if (spacebarBlocked(key)) return;
			if (key) context.eventEmitter.broadcast({ type: 'hotKey', key, action: 'keyUp' });
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeydown);
		window.addEventListener('keyup', handleKeyup);
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleKeydown);
		window.removeEventListener('keyup', handleKeyup);
	});
</script>
