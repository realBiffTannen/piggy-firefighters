/**
 * Where the reel model meets the display tree. components/reels/ReelColumn.svelte registers the live
 * PIXI container of every Svelte-rendered column here (there are two per reel: the masked resting
 * board and the unmasked performing board); components/reels/ReelStrips.svelte is the only writer.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const reelColumns: any[][] = [[], [], [], [], []];

export const registerReelColumn = (reelIndex: number, node: any) => {
	(reelColumns[reelIndex] ??= []).push(node);
	return () => {
		const list = reelColumns[reelIndex];
		const i = list ? list.indexOf(node) : -1;
		if (i >= 0) list.splice(i, 1);
	};
};
