<script lang="ts">
	import { onMount, type Snippet } from 'svelte';

	import { requestAuthenticate, requestReplay } from 'rgs-requests';
	import {
		stateUrlDerived,
		stateBet,
		stateConfig,
		stateModal,
		stateReplay,
		stateUi,
	} from 'state-shared';
	import {
		API_AMOUNT_MULTIPLIER,
		resolveBetLevels,
		selectBetMenuOptions,
		snapToBetLevel,
		resolveRoundResume,
		type RgsBetConfig,
	} from 'constants-shared/bet';

	import type { MessagesMap } from 'utils-shared/i18n';

	type Props = { children: Snippet; messagesMap?: MessagesMap };

	const props: Props = $props();

	// Tell the RGS the language the game RENDERS, not the one the URL asked for. LoadI18n activates a tag only
	// when the catalogue owns it (own-property test) and renders 'en' otherwise, so `?lang=de` on an
	// English-only build must declare 'en' here too (ledger: language-channel-and-locale-safety, axis C).
	// Without a map threaded in, the requested tag is sent unchanged.
	const activatedLang = () => {
		const requested = stateUrlDerived.lang();
		return !props.messagesMap || Object.hasOwn(props.messagesMap, requested) ? requested : 'en';
	};

	let authenticated = $state(false);

	const authenticate = async () => {
		try {
			const authenticateData = await requestAuthenticate({
				rgsUrl: stateUrlDerived.rgsUrl(),
				sessionID: stateUrlDerived.sessionID(),
				language: activatedLang(),
			});

			// error
			if (authenticateData?.error) throw authenticateData;

			// balance
			if (authenticateData?.balance) {
				// Example of authenticateData.balance
				// {
				// 		"amount": 10000000000000000,
				// 		"currency": "USD"
				// },
				stateBet.currency = authenticateData.balance.currency;
				stateBet.balanceAmount = authenticateData.balance.amount / API_AMOUNT_MULTIPLIER;
			}

			// config
			if (authenticateData?.config) {
				// Example of authenticateData.config
				// {
				// 	"gameID": "37_test-lines",
				// 	"minBet": 100000,
				// 	"maxBet": 1000000000,
				// 	"stepBet": 10000,
				// 	"defaultBetLevel": 1000000,
				// 	"betLevels": [100000, 200000, ..., 1000000000],
				// 	"betModes": {},
				// 	"jurisdiction": {
				// 			"socialCasino": false,
				// 			"disabledFullscreen": false,
				// 			"disabledTurbo": false,
				// 			"disabledSuperTurbo": false,
				// 			"disabledAutoplay": false,
				// 			"disabledSlamstop": false,
				// 			"disabledSpacebar": false,
				// 			"disabledBuyFeature": false,
				// 			"displayNetPosition": false,
				// 			"displayRTP": false,
				// 			"displaySessionTimer": false,
				// 			"minimumRoundDuration": 0
				// 	}
				// }
				// MERGE, NEVER REPLACE (GT-24, 2026-09-16). A wholesale assign
				// meant an /authenticate reply WITHOUT a `jurisdiction` object
				// replaced all twelve defaults above with `undefined`, and the
				// first HUD read of `stateConfig.jurisdiction.<flag>` threw an
				// uncaught TypeError — the game could not spin. Merging keeps the
				// declared defaults ("no restriction") for every field the
				// operator did not send, and still lets a sent field win.
				stateConfig.jurisdiction = {
					...stateConfig.jurisdiction,
					...(authenticateData?.config?.jurisdiction ?? {}),
				};

				// EVERY betting parameter the RGS sends is applied: betLevels,
				// minBet, maxBet and stepBet. resolveBetLevels clamps a declared
				// ladder to the operator's bounds and, when no ladder is declared,
				// synthesises one from min/max/step — so an operator who sends
				// only bounds still gets a working stepper instead of an empty
				// menu. Nothing falls back to a client-side ladder.
				const rgsBet = (authenticateData.config ?? {}) as RgsBetConfig;
				const levels = resolveBetLevels(rgsBet);
				if (levels.length) {
					stateConfig.betAmountOptions = levels.map((level) => level / API_AMOUNT_MULTIPLIER);
					// Spread across the ladder the RGS actually sent. The fixed
					// index list this replaces was tuned for a 39-level ladder: it
					// showed four amounts out of a ten-level ladder and hid
					// everything above index 38 of a longer one.
					stateConfig.betMenuOptions = selectBetMenuOptions(stateConfig.betAmountOptions);
				}
				const options = stateConfig.betAmountOptions;
				stateConfig.minBetAmount = Number.isFinite(rgsBet.minBet)
					? (rgsBet.minBet as number) / API_AMOUNT_MULTIPLIER
					: (options[0] ?? 0);
				stateConfig.maxBetAmount = Number.isFinite(rgsBet.maxBet)
					? (rgsBet.maxBet as number) / API_AMOUNT_MULTIPLIER
					: (options[options.length - 1] ?? Infinity);
				stateConfig.stepBetAmount = Number.isFinite(rgsBet.stepBet)
					? (rgsBet.stepBet as number) / API_AMOUNT_MULTIPLIER
					: 0;

				// The opening bet is the operator's defaultBetLevel, never a
				// client-side constant — snapped onto the resolved ladder, because
				// assertBetCanBeSubmitted refuses any amount that is not an RGS
				// level and an off-ladder default would leave the spin button
				// permanently disabled. An ACTIVE round below overrides it; a
				// finished one must not.
				const requestedDefault = authenticateData.config?.defaultBetLevel;
				if (Number.isFinite(requestedDefault)) {
					const snapped = snapToBetLevel(requestedDefault as number, levels);
					stateBet.betAmount = (snapped ?? (requestedDefault as number)) / API_AMOUNT_MULTIPLIER;
				} else if (options.length && !options.includes(stateBet.betAmount)) {
					stateBet.betAmount = options[0];
				}
			}

			// round
			if (authenticateData?.round) {
				// Example of authenticateData.round
				// {
				// 	"betID": 62277967,
				// 	"amount": 1000000,
				// 	"payout": 33400000,
				// 	"payoutMultiplier": 33.4,
				// 	"active": true,
				// 	"state": [...],
				// 	"mode": "BONUS",
				// 	"event": null
				// }

				// `/authenticate` returns the last round whether or not it is
				// still open, so `active` is what separates "resume this" from
				// "this already finished". Reading the amount off a FINISHED
				// round was why a reload kept the previous bet instead of
				// returning to the operator's default: set $0.10, spin it out,
				// reload, and $0.10 came back as though it were the default.
				const round = authenticateData.round;
				const resume = resolveRoundResume(round);

				if (resume.resumeState) {
					// @ts-ignore
					stateBet.betToResume = round;
				}

				// Only an ACTIVE round restores the bet.
				if (resume.restoreBet) {
					const betAmountValue = (round?.amount as number) / API_AMOUNT_MULTIPLIER;
					stateBet.betAmount = betAmountValue;
					stateBet.wageredBetAmount = betAmountValue;
				}

				// Likewise the mode: a finished BONUS round must not leave the
				// game armed in BONUS after a reload.
				if (resume.applyMode) {
					stateBet.activeBetModeKey = round?.mode as string;
				}
			}
		} catch (error) {
			console.error(error);
			stateModal.modal = { name: 'error', error };
		}
	};

	// A replay whose round did not load has nothing to summarise. Flag it on the document so the game can
	// withdraw the replay summary card: left up, it states "Payout Multiplier 0x / Total Win 0.00" with a
	// START control, drawn over the error modal that is the only true statement on screen. The rule that
	// withdraws it is `html[data-replay-error] .replay-preroll` in apps/lucky/src/app.html (the card is the
	// protected HUD's, so the game hides it rather than editing it; app.html ships without comments).
	const markReplayFailed = () => {
		if (typeof document !== 'undefined') document.documentElement.dataset.replayError = 'true';
	};

	const handleReplay = async () => {
		try {
			await replay();
		} catch (error) {
			markReplayFailed();
			// Replay had no boundary at all: anything thrown between here and the
			// betToResume assignment (an unreachable rgs_url, a malformed body)
			// rejected out of onMount, `authenticated` never became true, and
			// NOTHING mounted — the preloader faded to a blank page with no modal
			// on it, because the error modal itself lives inside the children this
			// component gates. `authenticate()` has carried this boundary since it
			// was written; replay is the same contract.
			console.error(error);
			stateModal.modal = { name: 'error', error };
		}
	};

	const replay = async () => {
		const baseAmount = stateUrlDerived.amount() / API_AMOUNT_MULTIPLIER || 0;
		stateBet.betAmount = baseAmount;
		stateBet.wageredBetAmount = baseAmount;
		stateBet.activeBetModeKey = stateUrlDerived.mode();

		// The replay window has to state what the round was before it plays it
		// (approval checklist, Replay Support). The base amount is known from
		// the URL; the two multipliers arrive with the round below.
		stateReplay.active = true;
		stateReplay.modeKey = stateUrlDerived.mode();
		stateReplay.baseAmount = baseAmount;
		stateReplay.started = false;
		stateReplay.finished = false;

		// Replay never calls authenticate, so nothing else ever sets the
		// currency: without this the meters format a GC/SC/EUR round with the
		// 'USD' default. The optional ?currency= param is part of the replay
		// URL contract.
		// The value is player-supplied and lands in Intl.NumberFormat, which
		// throws a RangeError for anything that is not a well-formed 3-alpha
		// code. Accept only that shape; a malformed code is ignored rather than
		// carried into the money formatter.
		const replayCurrency = stateUrlDerived.currency();
		if (replayCurrency && /^[A-Za-z]{3}$/.test(replayCurrency))
			stateBet.currency = replayCurrency.toUpperCase() as typeof stateBet.currency;

		const data = await requestReplay({
			rgsUrl: stateUrlDerived.rgsUrl(),
			game: stateUrlDerived.game(),
			mode: stateUrlDerived.mode(),
			version: stateUrlDerived.version(),
			event: stateUrlDerived.event(),
			// Replay is initiated WITH a language: it never calls authenticate,
			// so this request is the only place the language is declared.
			lang: activatedLang(),
		});

		// A failed replay fetch (bad event id, RGS error) must surface, not get
		// stuffed into betToResume as if it were round data — that played as a
		// silent dead board with no error UI.
		if (data?.error) {
			markReplayFailed();
			stateModal.modal = { name: 'error', error: data };
			return;
		}

		if (data) {
			// The round's own figures, straight off the RGS response — never
			// re-derived from what the presentation happens to draw.
			const replayed = data as { payoutMultiplier?: number; costMultiplier?: number };
			if (Number.isFinite(replayed.payoutMultiplier)) {
				// `payoutMultiplier` on the wire is a PLAIN MULTIPLE, not a book
				// amount in hundredths: Stake's own OpenAPI schema defines
				// PayoutMultiplier as "Payout / Amount"
				// (packages/rgs-fetcher/src/schema.ts:168-172). The book integer
				// IS in hundredths, and the RGS divides by 100 before it puts the
				// number on the wire — so dividing again here applied the same
				// conversion twice. Against the real RGS a book of 80 (0.8x) on a
				// EUR 2.20 bet displayed "0.01x" / "EUR 0.0176" instead of 0.8x /
				// EUR 1.76. It survived locally only because piggy-farm's mock
				// echoed the raw book integer, so the two errors cancelled against
				// the mock and against nothing else (mock fixed alongside this:
				// server/mock-rgs.mjs /bet/replay and /wallet/play).
				stateReplay.payoutMultiplier = replayed.payoutMultiplier as number;
			}
			// costMultiplier is NOT scaled: the RGS states a mode's cost as a
			// plain multiple (bonus4 = 125x), and the mode table agrees.
			if (Number.isFinite(replayed.costMultiplier) && (replayed.costMultiplier as number) > 0) {
				stateReplay.costMultiplier = replayed.costMultiplier as number;
			}

			// @ts-ignore
			stateBet.betToResume = {
				...data,
				event: '0',
				active: true,
				mode: stateUrlDerived.mode(),
			};
		}
	};

	onMount(async () => {
		try {
			if (stateUrlDerived.replay()) {
				stateUi.config.mode = 'replay';
				await handleReplay();
			} else {
				stateUi.config.mode = 'default';
				await authenticate();
			}
		} finally {
			// The shell mounts even when boot failed. ModalError renders inside
			// props.children(), so leaving this false paints an empty page and the
			// player is told nothing at all — the failure has to be visible.
			authenticated = true;
		}
	});
</script>

{#if authenticated}
	{@render props.children()}
{/if}
