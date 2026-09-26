export const createGetEmptyPaddedBoard = ({
	reelsDimensions,
}: {
	reelsDimensions: { x: number; y: number };
}) => {
	// plain loops, not `Array.from({ length }, cb)`: Rollup treats the callback's return values of that builtin as
	// non-escaping and may constant-fold later reads of the literals it built (seen on the reel objects, 2026-09-25)
	const getEmptyBoard = () => {
		const board: null[][] = [];
		for (let reel = 0; reel < reelsDimensions.x; reel += 1) {
			const column: null[] = [];
			for (let row = 0; row < reelsDimensions.y + 2; row += 1) column.push(null);
			board.push(column);
		}
		return board;
	};

	return { getEmptyBoard };
};
