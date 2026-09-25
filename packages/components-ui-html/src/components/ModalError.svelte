<script lang="ts">
	import { Popup } from 'components-shared';
	import { zIndex } from 'constants-shared/zIndex';
	import { stateModal } from 'state-shared';

	import BaseContent from './BaseContent.svelte';

	/** This modal is `persistent` — there is no close button — so whatever it
	 *  prints is the last thing the player reads. It must be a sentence, and it
	 *  must say what to do next.
	 *
	 *  Nothing here may be JSON.stringify'd onto the screen.
	 *  `JSON.stringify(new Error('Failed to fetch'))` is exactly "{}" (name,
	 *  message and stack are all non-enumerable), which is what an unreachable
	 *  rgs_url used to render: "Sorry, something went wrong." above a box
	 *  containing the two characters "{}". The earlier `JSON.stringify(error)`
	 *  fallback was added to stop "[object Object]" and swapped one unreadable
	 *  token for another.
	 *
	 *  Three shapes arrive here and all three are read defensively:
	 *    - the RGS envelope `{ error: { statusCode, code, message } }`
	 *      (rgs-fetcher now guarantees it for transport and non-JSON failures
	 *      too, so `message` is already player-facing English);
	 *    - `{ error: <string>, message: <string> }`, thrown by
	 *      utils-xstate/src/createPrimaryMachines.ts;
	 *    - a bare string.
	 *  Anything else falls back to a fixed human sentence rather than to a
	 *  serialisation of the object. */
	const asText = (value: unknown) =>
		typeof value === 'string' && value.trim() ? value.trim() : '';

	const FALLBACK_MESSAGE =
		'The game could not complete that request. Please reload the game, and contact support if it keeps happening.';

	const describe = (error: any) => ({
		code: asText(error?.error?.code) || asText(error?.code) || asText(error?.error),
		message:
			asText(error?.error?.message) ||
			asText(error?.message) ||
			asText(error) ||
			FALLBACK_MESSAGE,
	});
</script>

{#if stateModal.modal?.name === 'error'}
	<Popup zIndex={zIndex.modal} persistent onclose={() => (stateModal.modal = null)}>
		<BaseContent maxWidth="100%">
			{@const described = describe(stateModal.modal?.error)}
			<span>Sorry, something went wrong.</span>
			<div class="scrollY error-text">
				{#if described.code}
					<span>{described.code}</span>
				{/if}
				<p>{described.message}</p>
			</div>
		</BaseContent>
	</Popup>
{/if}

<style lang="scss">
	.error-text {
		max-height: 100px;
		max-width: 480px;
		border-radius: 8px;
		border: 1px solid red;
		white-space: normal;
		padding: 1rem;
	}
</style>
