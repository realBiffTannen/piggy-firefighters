import { PUBLIC_CHROMATIC } from 'envs';
import { stateUrlDerived } from 'state-shared';
import { requestEndEvent } from 'rgs-requests';

import type { BaseBookEvent } from './types';

export function recordBookEvent<TBookEvent extends BaseBookEvent>({
	bookEvent,
}: {
	bookEvent: TBookEvent;
}) {
	if (PUBLIC_CHROMATIC || stateUrlDerived.replay()) {
		// Dev only: a shipped build keeps the console free of game information (approval checklist).
		if (import.meta.env.DEV) console.log('mock request end-event:', { index: bookEvent.index, type: bookEvent.type });
		return;
	}

	try {
		requestEndEvent({
			eventIndex: bookEvent.index,
			rgsUrl: stateUrlDerived.rgsUrl(),
			sessionID: stateUrlDerived.sessionID(),
		});
	} catch (error) {
		console.error(error);
	}
}

export function checkIsMultipleRevealEvents<TBookEvent extends BaseBookEvent>({
	bookEvents,
}: {
	bookEvents: TBookEvent[];
}) {
	const revealEventCount = bookEvents.filter((bookEvent) => bookEvent.type === 'reveal').length;
	const isMultipleReveals = revealEventCount > 1;
	return isMultipleReveals;
}
