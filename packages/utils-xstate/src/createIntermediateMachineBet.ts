import { setup, assign } from 'xstate';

import { context, type Context } from './machineContext';
import type { PrimaryMachines } from './types';

/**
 * ONE PRESS, ONE ROUND (LUCKY jurisdiction fix, qa/final_lucky/jurisdiction_r1.md violation 3).
 *
 * The stock SDK machine went `ending -> checkSpaceHold -> fetching` while `stateBet.isSpaceHold` was true, so a
 * held spacebar kept placing bets (and repeated an armed buy) with no confirmation and no counter — the
 * approval guideline's "no automatic consecutive bets from one click". The HUD still sets `isSpaceHold` on a
 * held key; this machine no longer reads it: every round started here ends at `end`. Repeated rounds come only
 * from the confirmed autoplay path (createIntermediateMachineAutoBet), which invokes this machine once per
 * counted round.
 */
export const createIntermediateMachineBet = ({
	newGame,
	playGame,
	endGame,
}: {
	newGame: PrimaryMachines['newGame'];
	playGame: PrimaryMachines['playGame'];
	endGame: PrimaryMachines['endGame'];
}) => {
	const machine =
		setup({
			types: {} as {
				context: Context;
			},
			actors: {
				newGame,
				playGame,
				endGame,
			},
		}).createMachine({
			context,
			id: 'bet',
			initial: 'fetching',
			states: {
				fetching: {
					invoke: {
						id: 'newGame',
						src: 'newGame',
						onDone: [
							{
								actions: assign(({ context: _, event }) => event.output),
								target: 'play',
							},
						],
						// output: ,
						onError: [
							{
								target: 'end',
							},
						],
					},
				},
				play: {
					invoke: {
						id: 'playGame',
						src: 'playGame',
						input: ({ context }) => ({
							bet: context.bet,
						}),
						onDone: [
							{
								target: 'ending',
							},
						],
					},
				},
				ending: {
					invoke: {
						id: 'endGame',
						src: 'endGame',
						input: ({ context }) => ({
							bet: context.bet,
							rawBet: context.rawBet,
						}),
						onDone: [
							{
								target: 'end',
							},
						],
					},
				},
				end: {
					type: 'final',
				},
			},
		});

	return machine;
};
