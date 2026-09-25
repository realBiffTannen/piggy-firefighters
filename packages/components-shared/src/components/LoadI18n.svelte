<script lang="ts">
	// https://lingui.dev/installation#vite
	// https://lingui.dev/tutorials/javascript
	// https://lingui.dev/ref/vite-plugin

	import { stateI18nDerived } from 'state-shared';

	import { onMount, type Snippet } from 'svelte';

	import { stateUrlDerived, type Language } from 'state-shared';
	import type { MessagesMap } from 'utils-shared/i18n';

	type Props = {
		debug?: boolean;
		children: Snippet;
		messagesMap: MessagesMap;
	};

	const props: Props = $props();

	let loaded = $state(false);

	const loadMessages = (lang: Language) => {
		const messages = props.messagesMap[lang];
		if (props.debug) console.log({ messages });
		return messages;
	};

	onMount(() => {
		// Tolerate unknown/invalid ?lang= values by falling back to 'en' BEFORE
		// activate. Two failure modes otherwise: an unsupported tag ('xx') activates
		// an empty catalogue and Lingui renders raw message ids in place of copy,
		// and an invalid BCP-47 tag ('../etc') makes Intl.PluralRules throw at the
		// first translate — after mount, so the try/catch below never sees it.
		const requested = stateUrlDerived.lang();
		// OWN-PROPERTY guard, not a truthiness test: `messagesMap[requested]` is
		// truthy for inherited members too, so `?lang=toString` / `?lang=__proto__`
		// would otherwise resolve to a Function/object and activate a garbage
		// locale. `Object.hasOwn` only accepts a key the catalogue actually
		// declares; everything else falls back to 'en'.
		const lang: Language = Object.hasOwn(props.messagesMap, requested) ? requested : 'en';
		try {
			const messages = loadMessages(lang);
			stateI18nDerived.init(lang, messages);
		} catch (error) {
			console.error("Loading fallback locale 'en' because of error", error);
			try {
				const messages = loadMessages('en');
				stateI18nDerived.init('en', messages);
			} catch (error) {
				console.error("Loading fallback locale 'en' without any messages because of error", error);
				stateI18nDerived.init('en', {});
			}
		}
		loaded = true;
	});
</script>

{#if loaded}
	{@render props.children()}
{/if}
