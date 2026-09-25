/**
 * What the scene FX learn from the mounted rigs (docs/ANIMATION_CONTRACT.md: "FX ownership — water spray, steam, flame,
 * embers, coins and dust are the runtime's Pixi particles (Claude), spawned at the anchor world positions Codex's
 * RigActor exposes, timed by the Spine events"). components/Mascots.svelte writes these from `onrigEvent`; the Rescue
 * scene reads them. Positions are Pixi GLOBAL coordinates (a reader converts with its own container's `toLocal`).
 */
export const stateRig = $state({
	/** the chief's nozzle tip while `spray_on` .. `spray_off` (null when no chief rig is spraying) */
	nozzleTip: null as { x: number; y: number } | null,
	/** the last `sign_hit` contact (head_top anchor), with a sequence so a reader can react once per hit */
	signHit: { seq: 0, x: 0, y: 0 },
});
