// Emitter contract kept after the standing mascot was removed (owner, 2026-09-19): the build
// director still broadcasts these beats so a future performer can subscribe without new plumbing.
export type MascotReact =
	| 'hat'
	| 'celebrate'
	| 'big'
	| 'super'
	| 'mega'
	| 'epic'
	| 'max'
	| 'brace'
	| 'whistle'
	| 'point'
	| 'wipe'
	| 'thumbs'
	| 'look'
	| 'excited'
	| 'calm';
export type EmitterEventMascot = {
	type: 'mascotReact';
	react: MascotReact;
	/** Where the action is, as a 0..1 fraction across the board. */
	at?: number;
};
