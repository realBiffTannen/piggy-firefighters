/**
 * What the scene FX learn from the mounted rigs (docs/ANIMATION_CONTRACT.md: "FX ownership — water spray, steam, flame,
 * embers, coins and dust are the runtime's Pixi particles (Claude), spawned at the anchor world positions Codex's
 * RigActor exposes, timed by the Spine events"). components/Mascots.svelte writes these from `onrigEvent`; the Rescue
 * scene reads them. Positions are Pixi GLOBAL coordinates (a reader converts with its own container's `toLocal`).
 */
import type { RigHandle } from '../anim/rigTypes';

export const stateRig = $state({
	/** the chief's nozzle tip while `spray_on` .. `spray_off` (null when no chief rig is spraying) */
	nozzleTip: null as { x: number; y: number } | null,
	/** the last `sign_hit` contact (head_top anchor), with a sequence so a reader can react once per hit */
	signHit: { seq: 0, x: 0, y: 0 },
	/** the mascot slots are on screen (a stacked layout without room for them hides the chief: the Rescue scene then
	 *  keeps its own hose and nozzle, and no rig event of his reaches the FX) */
	chiefOnStage: false,
});

// The mounted chief's handle (components/Mascots.svelte `onready`), kept out of the reactive state: the Rescue scene
// asks it for the nozzle tip at the moment a jet is drawn, so the FIRST jet of a douse leaves his nozzle too (the
// director's state change lands before the clip's `spray_on` frame).
let chief: RigHandle | null = null;
export const setChiefHandle = (handle: RigHandle | null): void => {
	chief = handle;
};
/** the chief rig's `nozzle_tip` in Pixi global coordinates, or null when no visible chief rig is mounted */
export const chiefNozzleTip = (): { x: number; y: number } | null => (stateRig.chiefOnStage && chief ? chief.getBoneWorldPosition('nozzle_tip') : null);
