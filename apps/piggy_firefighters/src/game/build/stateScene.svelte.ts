/**
 * Scene-direction state shared by the ambient world, the roller shutter, the
 * frame and the mascot. The build director is the single writer of `mood` and
 * `staged`, and it only changes them WHILE THE SHUTTER IS CLOSED, so a player
 * never sees the world swap — they see the same place at a different hour when
 * the shutter rattles back up.
 */
export type SceneMood = 'day' | 'blue' | 'golden';

export const stateScene = $state({
	/** Time of day: base = day, Hold & Build = blue hour, Golden Build = golden hour. */
	mood: 'day' as SceneMood,
	/** The bonus build site is the visible board (flips behind the shutter). */
	staged: false,
	/** The shutter currently covers the play area. */
	covered: false,
	/** Presentation is in a win / reveal beat: ambient life events stay quiet. */
	busy: false,
});

export const moodForBonus = (premium: boolean): SceneMood => (premium ? 'golden' : 'blue');
