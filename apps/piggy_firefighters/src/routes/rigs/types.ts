export type RigIndexEntry = {
	id: string;
	title: string;
	atlas: string;
	skeleton: string;
	sourceCanvas: number;
	clips: { name: string; duration: number; loop: boolean; shipping: boolean; next?: string }[];
	events: string[];
	/** house rigs only: runtime prize label anchors */
	anchors?: { prize: string; collect: string };
	/** source px from the canvas centre to the rig origin (x right, y DOWN). Houses: 0,0 (cell centred). Mascot: floor contact. */
	origin?: { x: number; y: number };
	/** preview cells, css px offsets from the top-left of the right-hand column; `dpr` tells the capture script which pass owns it */
	cells?: { px: number; x: number; y: number; colour: number; dpr: number; label: string }[];
	/** overlay clips the preview fires at random intervals while a looping clip plays (e.g. blink on track 1) */
	overlays?: { clip: string; track: number; minGap: number; maxGap: number }[];
	sequences?: { label: string; clips: string[] }[];
	/** pose clips meant for a blend track (mascot look_l / look_r); the stage shows a slider when present */
	blendPoses?: { track: number; clips: string[]; note?: string };
	/** bone pairs that must stay glued together (measured by window.__rigs.measure) */
	/** `constraint`: the transform constraint that glues the pair; while its mix is below 1 (a released hand) the pair is not measured */
	attachChecks?: { bone: string; target: string; constraint?: string }[];
	caption?: string;
	/** source view height budget as a multiple of the canvas (default 1.12) */
	headroom?: number;
};
export type RigIndex = { generatedFrom: string; rigs: RigIndexEntry[] };

export type RigApi = {
	play: (clip: string, loop?: boolean) => void;
	queue: (clip: string, loop?: boolean) => void;
	seek: (clip: string, time: number) => void;
	setSpeed: (speed: number) => void;
	/** mascot eye-line: -1 (look_l) .. +1 (look_r), blended additively on track 2 */
	look: (amount: number) => void;
	/** per clip: worst distance (source units) between each attachCheck pair and the largest IK stretch, sampled on the 30 fps grid */
	measure: () => Record<string, { maxGap: number; maxStretch: number; maxStretchArm: number; maxStretchLeg: number; released: boolean; armFrame: number; armBone: string }>;
};
