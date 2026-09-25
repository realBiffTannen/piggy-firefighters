/**
 * ANIMATION BEATS — the game's side of docs/ANIMATION_CONTRACT.md v1.1 (§Beats).
 *
 * Every rig-facing moment is ONE emitter event type, `animBeat`, broadcast through the game's eventEmitter; Codex's
 * runtime subscribes in game/anim/beatBus.ts. Beats are fire-and-forget: nothing here returns a promise, nothing here
 * is awaited by a director, and a beat that fails to broadcast never reaches a caller.
 *
 * EPOCHS. A beat scheduled for later (a landing wave, a queued rescue) belongs to the round it was scheduled in. The
 * epoch (Codex's `createPlaybackEpoch`, read from game/anim/rigLogic.ts) is bumped at every new round, skip and
 * feature teardown, and a deferred beat whose epoch is no longer current is DROPPED — so a skipped, turbo-collapsed or
 * resumed round never leaks stale acting into the next presentation.
 */
import { eventEmitter } from '../eventEmitter';
import { createPlaybackEpoch, type EmitterEventAnim } from '../anim/rigLogic';

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** one beat of the contract table, without the emitter's `type` */
export type AnimBeat = DistributiveOmit<EmitterEventAnim, 'type'>;

const epoch = createPlaybackEpoch();
let current = epoch.begin();

const broadcast = (beat: AnimBeat) => {
	try {
		eventEmitter.broadcast({ type: 'animBeat', ...beat } as EmitterEventAnim);
	} catch {
		/* presentation only: a rig beat never breaks a round */
	}
};

export const animBeats = {
	/** A new round, a skip or a teardown: every beat still pending from the previous presentation is dropped. */
	newEpoch: (): number => {
		current = epoch.begin();
		return current;
	},
	/** The epoch a caller should capture before an await, to drop its own later beats if the round moved on. */
	epoch: (): number => current,
	isCurrent: (value: number): boolean => epoch.isCurrent(value),
	/** Broadcast now. With `at`, only if that epoch is still the current one. */
	emit: (beat: AnimBeat, at?: number): void => {
		if (at !== undefined && !epoch.isCurrent(at)) return;
		broadcast(beat);
	},
	/** Broadcast after `ms`, unless the round has moved on by then. */
	later: (ms: number, beat: AnimBeat): void => {
		const at = current;
		setTimeout(() => animBeats.emit(beat, at), Math.max(0, ms));
	},
};
