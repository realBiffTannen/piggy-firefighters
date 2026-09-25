/** What a replayed round is, as the Replay Support section of the Game
 *  Approval Checklist requires it to be shown.
 *
 *  A replay never calls `/authenticate`, so none of this can be read off the
 *  session: the amount comes from the replay URL, the multipliers come from
 *  the `/bet/replay` response, and the mode name has to be resolved through
 *  the game's own bet-mode table so the window names the round the way the
 *  game does. Everything is in display units.
 */
export const stateReplay = $state({
	/** Is this session a replay at all. */
	active: false,
	/** RGS mode key, e.g. 'bonus4'. Raw; not for display. */
	modeKey: '',
	/** The base amount the round was played for — "Base Bet" / "Base Play". */
	baseAmount: 0,
	/** What the mode charges on top of the base — "Cost Multiplier" /
	 *  "Feature Multiplier". 1 for a base-game round. */
	costMultiplier: 1,
	/** What the round returned — "Payout Multiplier" / "Final Multiplier". */
	payoutMultiplier: 0,
	/** Has the player dismissed the opening summary and started the round. */
	started: false,
	/** Has the event sequence finished playing. Gates the replay-again button,
	 *  which the checklist places at the END of the sequence. */
	finished: false,
});

export const stateReplayDerived = {
	/** What the round cost: base amount x the mode's cost multiplier. */
	playCost: () => stateReplay.baseAmount * stateReplay.costMultiplier,
	/** What the round returned, in money: base amount x the payout multiplier.
	 *  Stake states a payout multiplier against the BASE amount, not against
	 *  the cost, so a 100x on a $1 base of a 100x buy is $100 and not $10,000. */
	payoutAmount: () => stateReplay.baseAmount * stateReplay.payoutMultiplier,
	reset: () => {
		stateReplay.active = false;
		stateReplay.modeKey = '';
		stateReplay.baseAmount = 0;
		stateReplay.costMultiplier = 1;
		stateReplay.payoutMultiplier = 0;
		stateReplay.started = false;
		stateReplay.finished = false;
	},
};
