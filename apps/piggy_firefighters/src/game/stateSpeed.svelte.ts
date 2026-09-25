/**
 * The speed ladder: off -> turbo -> super. The studio HUD owns the button and the shared
 * `stateBet.isTurbo` flag (true for BOTH fast tiers, which keeps every existing turbo trim working);
 * it reports the exact tier through `HudConfig.speed.onApply`, mirrored here so the reels and the win
 * beats can tell Super Turbo from Turbo. Speed only ever shortens presentation: outcomes, amounts and
 * the order of events are the book's and never change with the tier.
 */
import { untrack } from 'svelte';
import { stateBet, stateConfig } from 'state-shared';

import { audioManager } from './audio/audioManager';
import { animBeats } from './fx/animBeats';

export type SpeedTier = 'off' | 'turbo' | 'super';

export const stateSpeed = $state({ tier: 'off' as SpeedTier });

export const applySpeedTier = (tier: SpeedTier) => {
	stateSpeed.tier = tier;
	// the audio manager thins decorative accents and callers pick the short *_turbo variants
	const level = tier === 'super' ? 2 : tier === 'turbo' ? 1 : 0;
	audioManager.setTurbo(level);
	// the rigs skip long clips in Super Turbo (docs/ANIMATION_CONTRACT.md speedTier)
	animBeats.emit({ beat: 'speedTier', tier: level });
};

// QA ONLY, and never in a player's session (r4 qaseam, ruling "Reading A"): `window.__qaSetSpeedForTest`
// is installed ONLY when the harness set `globalThis.__PFF_QA = true` BEFORE the bundle ran (Playwright
// `page.addInitScript(() => { globalThis.__PFF_QA = true })` ahead of navigation). A page without that
// flag, production or otherwise, carries no such global.
//
// Cross-game cadence gate: tools/sec7walk/probe-super-turbo-cadence.mjs arms a tier through this hook
// before it measures round-to-round timing. That probe takes only --url / --extra and arms only
// `if (hookPresent)`, so against this game it must first gain an init-script option that sets __PFF_QA;
// without the flag it records hookPresent:false and measures the default tier, not Super Turbo.
//
// The hook calls only what the HUD's speed button calls (presentation pace, never an outcome), and it
// applies the same jurisdiction check as that button (crashgalaxy-hud CrashGalaxyHud.svelte applySpeed):
// `disabledTurbo` bans both fast tiers and `disabledSuperTurbo` bans the third. A banned request is
// ignored (nothing is written) and logged once per tier. A tier armed BEFORE /wallet/authenticate
// returned is re-checked when the jurisdiction lands, and collapsed to what it permits.
export const qaSeamsEnabled = (): boolean =>
	(globalThis as unknown as { __PFF_QA?: unknown }).__PFF_QA === true;

/** The tier the jurisdiction permits for a request: the HUD's collapse, applied to a QA request. */
export const permittedSpeedTier = (requested: SpeedTier): SpeedTier => {
	const j = stateConfig.jurisdiction ?? ({} as Partial<typeof stateConfig.jurisdiction>);
	if (requested === 'off') return 'off';
	if (j.disabledTurbo) return 'off';
	if (requested === 'super' && j.disabledSuperTurbo) return 'turbo';
	return requested;
};

const qaRefusalLogged = new Set<SpeedTier>();
const logQaRefusal = (tier: SpeedTier, why: string) => {
	if (qaRefusalLogged.has(tier)) return;
	qaRefusalLogged.add(tier);
	console.info(`[qa] __qaSetSpeedForTest('${tier}') ${why}: the jurisdiction bans this speed tier`);
};

if (typeof window !== 'undefined' && qaSeamsEnabled()) {
	// true once the QA hook armed a fast tier; the guard below acts only then, so a tier the HUD applied
	// (already collapsed by the HUD's own check) is never touched by QA code
	let qaArmed = false;
	(window as unknown as { __qaSetSpeedForTest?: (t: string) => boolean }).__qaSetSpeedForTest = (t) => {
		const tier: SpeedTier = t === 'super' || t === 'turbo' ? t : 'off';
		if (permittedSpeedTier(tier) !== tier) {
			logQaRefusal(tier, 'refused');
			return false;
		}
		stateBet.isTurbo = tier !== 'off';
		applySpeedTier(tier);
		qaArmed = tier !== 'off';
		return true;
	};
	// A ban that arrives AFTER the hook armed a tier (the call raced /wallet/authenticate) collapses that tier
	// exactly as the HUD would have; tiers the HUD itself applied are already collapsed and are left alone.
	$effect.root(() => {
		$effect(() => {
			const tier = stateSpeed.tier;
			const permitted = permittedSpeedTier(tier);
			if (permitted === tier || !qaArmed) return;
			untrack(() => {
				stateBet.isTurbo = permitted !== 'off';
				applySpeedTier(permitted);
				qaArmed = permitted !== 'off';
				logQaRefusal(tier, 'collapsed to ' + permitted + ' when the jurisdiction arrived');
			});
		});
	});
}

/** Super only counts while the shared turbo flag is also up (the jurisdiction guard can force it off). */
export const isSuperTurbo = (): boolean => stateSpeed.tier === 'super' && stateBet.isTurbo === true;

/** Multiplier for a presentation duration at the current tier (1 / 0.5 / 0.3). */
export const speedFactor = (): number => (isSuperTurbo() ? 0.3 : stateBet.isTurbo ? 0.5 : 1);
