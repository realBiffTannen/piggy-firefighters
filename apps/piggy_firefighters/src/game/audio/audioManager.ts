/**
 * Piggy Firefighters — the game audio manager.
 *
 * A single Web Audio graph:
 *
 *     source(s) ─▶ voiceGain ─▶ (music) duckGain ─▶ musicUserGain ─┐
 *                             └▶ (sfx)                sfxUserGain ──┴▶ masterGain ─▶ destination
 *
 * The player's MASTER / MUSIC / SFX gains (and mute) sit OUTSIDE the automated
 * duck node, so a ducking envelope can never override a player's setting. The
 * HUD's burger sliders and M-key mute drive this object through the `Sfx`
 * interface (see `sfx` getter): `setVolumeStep` (master 0..20), `setBusVolume`
 * (music/sfx, already-tapered linear gain), `toggleMute`, `volume`, `isMuted`.
 *
 * Nothing is created until `unlock()` runs inside a real user gesture (the splash
 * dismiss), so an untouched page is silent. If the AudioContext cannot start the
 * game keeps working — every method is guarded and never throws into a caller.
 *
 * Instrumentation: `window.__pwAudio` exposes a ring log of state changes and cue
 * starts plus `getState()` for the headless focused check (qa/round3/audio).
 */
import { base } from '$app/paths';

import { CUES, MIX, type CueDef } from './cueManifest';
import { staticTier } from '../quality.svelte';
import type { Sfx } from '@crashgalaxy/hud';

// ---- persistence (master step + mute only; the HUD persists music/sfx) ------
const GAME_ID = 'piggy-firefighters';
const MASTER_KEY = `${GAME_ID}-volume`;
const MUTED_KEY = `${GAME_ID}-muted`;
const MASTER_MAX_STEP = 20; // mirrors @crashgalaxy/hud VOLUME_MAX_STEP
const DEFAULT_BED = 'base_loop_a';
const DEFAULT_AMBIENCE = 'ambient_station_loop';

const lsGet = (k: string): string | null => {
	try {
		return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null;
	} catch {
		return null;
	}
};
const lsSet = (k: string, v: string): void => {
	try {
		if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
	} catch {
		/* sandboxed iframe: prefs just don't persist */
	}
};

// ---- codec pick -------------------------------------------------------------
// Manifest files are [<id>.ogg, <id>.m4a] (the generator orders them, and lists a cue only when both exist). Prefer
// AAC/m4a where supported (Chromium, Safari); fall back to ogg (Firefox). Decoded either way. The decision is made
// ONCE: it used to allocate an <audio> element and call canPlayType for every url, 223 times during the splash.
let useM4a: boolean | undefined;
const preferM4a = (): boolean => {
	if (useM4a === undefined) {
		useM4a = false;
		try {
			if (typeof document !== 'undefined') {
				const a = document.createElement('audio');
				useM4a = !!a.canPlayType && a.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '';
			}
		} catch {
			useM4a = false;
		}
	}
	return useM4a;
};
const urlFor = (cue: CueDef): string => `${base}/${cue.files[preferM4a() && cue.files.length > 1 ? 1 : 0]}`;

/**
 * The base-game HOT SET: every cue a first spin, a first win, a first alarm group or the splash shutter can ask for.
 * Decoded inside the unlock gesture IN PARALLEL with the base bed (the spin / reel-stop cues lead the list: Chromium
 * decodes on a pool, so they are playable before the shutter lifts, ahead of the 30 MB bed). Everything else short is
 * decoded in the background once the shutter is done (`warmAll` → the cold set), the `_turbo` variants on the first
 * turbo, and the long beds by the presentation director before their scene. Every id is asserted against the manifest
 * in DEV at module load, so a stale list fails loudly instead of decoding nothing.
 */
export const HOT_SET: readonly string[] = [
	'spin_start', 'spin_whoosh',
	'reel_stop_1', 'reel_stop_2', 'reel_stop_3', 'reel_stop_4', 'reel_stop_5', 'reel_spin_loop',
	'alarm_land_1', 'alarm_land_2', 'alarm_land_3', 'alarm_land_4', 'alarm_land_5', 'galarm_glint', 'wild_land',
	'line_win_small', 'line_win_mid',
	'sym_win_h1', 'sym_win_h2', 'sym_win_h3', 'sym_win_h4', 'sym_win_l1', 'sym_win_l2', 'sym_win_l3', 'sym_win_l4', 'sym_win_w',
	'total_win_small', 'total_win_mid', 'total_win_big',
	'ui_click_1', 'ui_click_2', 'ui_click_3', 'bet_change', 'ante_on', 'ante_off',
	'antic_riser', 'antic_riser_2', 'antic_hit', 'antic_miss', 'dead_spin_settle', 'anticipation_layer',
	DEFAULT_AMBIENCE, 'trigger_fanfare',
	'shutter_slam', 'shutter_haul_1', 'shutter_haul_2', 'shutter_haul_3',
];
const assertKnown = (label: string, ids: readonly string[]): void => {
	if (!import.meta.env.DEV) return;
	const missing = ids.filter((id) => !(id in CUES));
	if (missing.length) throw new Error(`audio ${label} names cues missing from the manifest: ${missing.join(', ')}`);
};
assertKnown('HOT_SET', HOT_SET);
const HOT = new Set(HOT_SET);

/** Buffers longer than this (the beds, tens of MB of PCM each) and the rung beds are EVICTED once nothing plays them
 *  and re-decoded from their kept bytes before the next scene (the director ensureDecoded()s ahead of every
 *  crossfade). Short cues are never evicted. */
const EVICTABLE_MS = 20000;
const RUNG_BED_PREFIX = 'rung_bed_';
const isEvictable = (id: string): boolean => (CUES[id]?.durationMs ?? 0) > EVICTABLE_MS || id.startsWith(RUNG_BED_PREFIX);
const TURBO_SUFFIX = '_turbo';
const isTurboId = (id: string): boolean => id.endsWith(TURBO_SUFFIX);
/** Cold cues a base spin can reach with no shutter in between (decoded before the feature-scene cues). */
const BASE_REACHABLE = /^(rung_|sign_impact_|count_ticker_|burst_|win_max|backdraft_|blaze_ignite|alert_insufficient|last_spin)/;
/** An idle slice between background batches (a short timeout where the browser has no idle callback). */
const idle = (timeoutMs = 250): Promise<void> =>
	new Promise((resolve) => {
		if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: timeoutMs });
		else setTimeout(resolve, 30);
	});
const BATCH = 6;

/** Any one-shot that could not start within this wall-time window is dropped. */
const LATE_ONESHOT_MS = 120;

// ---- log --------------------------------------------------------------------
type LogEntry = { t: number; kind: string; detail?: unknown };
const LOG_CAP = 600;

// ---- a live music bed voice -------------------------------------------------
interface Voice {
	source: AudioBufferSourceNode;
	gain: GainNode;
	dispose: () => void;
}
interface Bed extends Voice {
	id: string;
	loopStart: number; // seconds
	loopDur: number; // seconds
	anchorTime: number; // ctx time the loop offset below was true at
	anchorPhase: number; // seconds into [loopStart, loopStart+loopDur)
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const dbToGain = (db: number) => Math.pow(10, db / 20);
const midpoint = (r: readonly number[]) => (r[0] + r[1]) / 2;

class AudioManager implements Sfx {
	private ctx: AudioContext | null = null;
	private masterGain: GainNode | null = null;
	private musicUserGain: GainNode | null = null; // player MUSIC slider (outside duck)
	private sfxUserGain: GainNode | null = null; // player SFX slider
	private musicDuckGain: GainNode | null = null; // automated ducking (below user gain)

	private buffers = new Map<string, AudioBuffer>();
	/** Encoded bytes fetched ahead of the unlock gesture (no AudioContext needed), decoded on unlock. An evictable
	 *  bed KEEPS its bytes here after decoding, so an eviction costs a re-decode and never a refetch. */
	private raw = new Map<string, Promise<ArrayBuffer | null>>();
	private decoding = new Map<string, Promise<AudioBuffer | null>>();
	/** Ids no call site can reach (audio/index.ts lists them): never fetched, never decoded. */
	private excluded = new Set<string>();
	private turboFetched = false;
	private turboWarming = false;
	/** The cold set (short cues outside the hot set) is fetched + decoded only after the splash shutter is done. */
	private coldOpen: (() => void) | null = null;
	private coldGate = new Promise<void>((resolve) => {
		this.coldOpen = resolve;
	});
	/** The base bed a rung bed replaced for a celebration: kept decoded so the return crossfade is instant. */
	private rungReturnBed: string | null = null;
	/** Guards a pending suspend (mute / hidden) against an unmute or a return that raced it. */
	private suspendToken = 0;
	/** SFX loops asked for while the context could not play (muted → suspended, hidden): started on resume. */
	private wantedLoops = new Map<string, { fadeMs: number; level: number }>();

	private beds = new Map<string, Bed>(); // active music beds (usually one + a crossfade)
	private layers = new Map<string, Bed>(); // additive stems (e.g. anticipation)
	private currentBedId: string | null = null;
	private liveVoices = new Set<Voice>(); // includes fading voices removed from their active map
	private oneShots = new Set<Voice>();
	private sceneEpoch = 0;
	private transientEpoch = 0;
	private requests = new Map<string, number>();
	private bedRequest = 0;
	private bedIntent: { id: string; fadeMs: number; crossfade: boolean } | null = null;

	// per-cue concurrency + cooldown, and per-family coalescing
	private active = new Map<string, number>();
	private lastStartAt = new Map<string, number>();
	private familyLastAt = new Map<string, number>();

	private masterStep = MASTER_MAX_STEP;
	private muted = false;
	private turbo = 0; // 0 off, 1 turbo, 2 super-turbo
	private unlocked = false;
	private roundRobin = new Map<string, number>();

	// instrumentation
	log: LogEntry[] = [];
	private pushLog(kind: string, detail?: unknown) {
		this.log.push({ t: Math.round(now()), kind, detail });
		if (this.log.length > LOG_CAP) this.log.shift();
	}

	private transientReady(): boolean {
		return !!this.ctx && this.unlocked && this.ctx.state === 'running'
			&& !(typeof document !== 'undefined' && document.hidden);
	}
	private invalidateRequest(key: string): number {
		const token = (this.requests.get(key) ?? 0) + 1;
		this.requests.set(key, token);
		return token;
	}
	private requestValidity(key: string): () => boolean {
		const epoch = this.sceneEpoch;
		const token = this.invalidateRequest(key);
		return () => this.sceneEpoch === epoch && this.requests.get(key) === token;
	}
	private whenDecoded(id: string, valid: () => boolean, start: (buffer: AudioBuffer) => void): void {
		const buffer = this.buffers.get(id);
		if (buffer) { if (valid()) start(buffer); }
		else void this.decode(id).then((decoded) => { if (decoded && valid()) start(decoded); });
	}
	private trackVoice(source: AudioBufferSourceNode, gain: GainNode, ended: (voice: Voice) => void = () => {}): Voice {
		const voice: Voice = { source, gain, dispose: () => {
			if (!this.liveVoices.delete(voice)) return;
			source.onended = null;
			try { source.disconnect(); } catch { /* already disconnected */ }
			try { gain.disconnect(); } catch { /* already disconnected */ }
			ended(voice);
		} };
		this.liveVoices.add(voice);
		source.onended = voice.dispose;
		return voice;
	}
	private stopVoice(voice: Voice, fadeMs = 0, ramp = true): void {
		if (!this.liveVoices.has(voice)) return;
		const t = this.ctx?.currentTime ?? 0;
		const duration = Math.max(0, fadeMs) / 1000;
		try {
			if (duration && ramp) {
				voice.gain.gain.cancelScheduledValues(t);
				voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), t);
				voice.gain.gain.linearRampToValueAtTime(0.0001, t + duration);
			}
			voice.source.stop(t + (duration ? duration + 0.02 : 0));
		} catch { voice.dispose(); }
		if (!duration) voice.dispose();
	}

	constructor() {
		// Restore persisted master step + mute (the HUD reads `volume`/`isMuted`
		// on sync, so the slider, M-key and stored step never disagree).
		const rawStep = lsGet(MASTER_KEY);
		const n = rawStep === null ? NaN : Number(rawStep);
		if (Number.isFinite(n) && n >= 0 && n <= MASTER_MAX_STEP) this.masterStep = Math.round(n);
		this.muted = lsGet(MUTED_KEY) === '1';
	}

	// ===== Sfx interface (the HUD drives these) ==============================
	setVolumeStep(step: number): void {
		this.masterStep = Math.min(MASTER_MAX_STEP, Math.max(0, Math.round(step)));
		lsSet(MASTER_KEY, String(this.masterStep));
		this.applyMaster();
	}
	setBusVolume(bus: 'music' | 'sfx', gain: number): void {
		const g = clamp01(gain);
		const node = bus === 'music' ? this.musicUserGain : this.sfxUserGain;
		if (node && this.ctx) node.gain.setTargetAtTime(g, this.ctx.currentTime, 0.01);
		// remember the desired level for when the graph is (re)built
		if (bus === 'music') this.pendingMusicGain = g;
		else this.pendingSfxGain = g;
		this.pushLog('busVolume', { bus, gain: Number(g.toFixed(3)) });
	}
	get volume(): number {
		return this.masterStep;
	}
	get isMuted(): boolean {
		return this.muted;
	}
	toggleMute(): void {
		this.muted = !this.muted;
		lsSet(MUTED_KEY, this.muted ? '1' : '0');
		this.applyMaster();
		this.pushLog('mute', { muted: this.muted });
	}

	private pendingMusicGain = 1;
	private pendingSfxGain = 1;

	/**
	 * Master level — and the context's running state with it. Muted, the graph used to keep rendering the bed, the
	 * 14 s ambience, any layer and the compressor every quantum with the output thrown away; mute is persisted, so a
	 * player who muted once carried that audio-thread cost every session. Now mute ramps the master down and, once the
	 * ramp has landed (~60 ms), SUSPENDS the context; unmute resumes it first, then ramps up. `suspendToken` lets an
	 * unmute racing the pending suspend win. Beds and loops keep their scheduled state across a suspend
	 * (ctx.currentTime pauses with it, so phaseAt() stays consistent). `isMuted` reads the flag, never ctx.state.
	 */
	private applyMaster() {
		if (!this.masterGain || !this.ctx) return;
		const ctx = this.ctx;
		const token = ++this.suspendToken;
		if (this.muted) {
			this.masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
			this.suspendAfter(token, 60, 'mute');
			return;
		}
		const g = this.masterStep / MASTER_MAX_STEP;
		const ramp = () => {
			if (token !== this.suspendToken || !this.masterGain) return;
			this.masterGain.gain.setTargetAtTime(g, ctx.currentTime, 0.015);
		};
		if (ctx.state === 'suspended' && this.unlocked && !this.hiddenNow()) this.resumeContext(token).then(ramp, ramp);
		else ramp();
	}
	private hiddenNow(): boolean {
		return typeof document !== 'undefined' && document.hidden;
	}
	/** Suspend the context once nothing can be heard (muted, or the tab is hidden) unless a later call took the token. */
	private suspendAfter(token: number, delayMs: number, reason: string): void {
		setTimeout(() => {
			const ctx = this.ctx;
			if (!ctx || token !== this.suspendToken || !this.unlocked) return;
			if (!this.muted && !this.hiddenNow()) return;
			if (ctx.state !== 'running') return;
			ctx.suspend().then(() => this.pushLog('suspend', { reason }), () => {});
		}, delayMs);
	}
	/** Resume a context this manager suspended; SFX loops asked for while it was down start now. */
	private async resumeContext(token: number): Promise<void> {
		const ctx = this.ctx;
		if (!ctx || ctx.state !== 'suspended') return;
		try {
			await ctx.resume();
		} catch {
			return;
		}
		if (token !== this.suspendToken) return;
		if (this.muted || this.hiddenNow()) {
			// a mute / hide raced the resume: nothing can be heard, so go straight back to sleep
			ctx.suspend().catch(() => {});
			return;
		}
		this.pushLog('resume', { state: ctx.state });
		for (const [id, want] of this.wantedLoops) if (!this.sfxLoops.has(id)) this.startSfxLoop(id, want.fadeMs, want.level);
	}

	/** Master gain step (0..20) as a linear 0..1 factor — used to expose state. */
	get masterFactor(): number {
		return this.muted ? 0 : this.masterStep / MASTER_MAX_STEP;
	}
	/** The commanded bus target (what the HUD slider set). The node ramps to it
	 *  over ~50 ms via setTargetAtTime, so a same-tick `.value` read lags — this
	 *  is the meaningful "did the slider move the bus" value. */
	get musicGain(): number {
		return this.pendingMusicGain;
	}
	get sfxGain(): number {
		return this.pendingSfxGain;
	}
	/** Live node value (converges to the target); exposed for transparency. */
	get musicGainLive(): number {
		return this.musicUserGain?.gain.value ?? this.pendingMusicGain;
	}
	get sfxGainLive(): number {
		return this.sfxUserGain?.gain.value ?? this.pendingSfxGain;
	}
	get contextState(): string {
		return this.ctx?.state ?? 'none';
	}
	get currentBed(): string | null {
		return this.currentBedId;
	}
	get isUnlocked(): boolean {
		return this.unlocked;
	}

	// ===== lifecycle =========================================================
	/** Create + resume the context on a legitimate user gesture, then start the
	 *  base bed. Safe to call more than once. Never throws to the caller. */
	async unlock(): Promise<void> {
		try {
			if (this.unlocked) return;
			const epoch = this.sceneEpoch;
			if (!this.ctx) this.buildGraph();
			if (!this.ctx) return; // no Web Audio: game continues silent
			if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
			if (this.ctx.state !== 'running' || epoch !== this.sceneEpoch || this.unlocked) return;
			this.unlocked = true;
			this.installVisibility();
			this.pushLog('unlock', { state: this.ctx.state });
			// a player who starts muted: the context had to resume inside the gesture; the post-ramp suspend follows
			if (this.muted) this.applyMaster();
			const intent = this.bedIntent ?? { id: DEFAULT_BED, fadeMs: 400, crossfade: false };
			this.requestBed(intent.id, intent.fadeMs, intent.crossfade);
			const request = this.bedRequest;
			// The hot set decodes IN PARALLEL with the 30 MB bed (it used to wait behind it, so on a slow phone a fast
			// first spin found no spin_start / reel_stop_* buffer and the late gate dropped them). The ambience is in the
			// hot set and starts from the same wait rather than a third sequential decode.
			await Promise.all([this.ensureDecoded([intent.id]), this.ensureDecoded(HOT_SET)]);
			if (epoch === this.sceneEpoch && request === this.bedRequest && this.isBaseBed(this.currentBedId)) {
				this.startSfxLoop(DEFAULT_AMBIENCE, 1500);
			}
			void this.warmAll(HOT_SET);
			if (this.turbo >= 1) this.warmTurbo();
			// the shutter watcher (audio/index.ts) opens the cold gate at the hand-off; this is only the safety net
			setTimeout(() => this.openColdGate(), 10000);
		} catch (err) {
			this.pushLog('unlockError', String(err));
		}
	}

	private buildGraph() {
		const Ctor: typeof AudioContext | undefined =
			(typeof window !== 'undefined' &&
				(window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)) ||
			undefined;
		if (!Ctor) return;
		// A slot's cues are scheduled on frame events and tolerate 20-40 ms of output latency: below the high tier the
		// render quantum is the platform's 'balanced' size (fewer audio-thread wake-ups for a graph that always has a
		// bed + ambience + compressor running) instead of the smallest buffer the device allows.
		const ctx = new Ctor({ latencyHint: staticTier === 'high' ? 'interactive' : 'balanced' });
		this.ctx = ctx;
		this.masterGain = ctx.createGain();
		this.musicUserGain = ctx.createGain();
		this.sfxUserGain = ctx.createGain();
		this.musicDuckGain = ctx.createGain();

		this.musicDuckGain.gain.value = 1;
		this.musicUserGain.gain.value = this.pendingMusicGain;
		this.sfxUserGain.gain.value = this.pendingSfxGain;

		this.musicDuckGain.connect(this.musicUserGain);
		this.musicUserGain.connect(this.masterGain);
		this.sfxUserGain.connect(this.masterGain);
		// Safety limiter: many one-shots can land on one frame (five reel stops into a win stinger over
		// the bed). Without it the sum clips at the converter; with it peaks are caught transparently.
		const limiter = ctx.createDynamicsCompressor();
		limiter.threshold.value = -2.5;
		limiter.knee.value = 0;
		limiter.ratio.value = 20;
		limiter.attack.value = 0.002;
		limiter.release.value = 0.12;
		this.masterGain.connect(limiter);
		limiter.connect(ctx.destination);
		this.applyMaster();
	}

	private visibilityInstalled = false;
	private installVisibility() {
		if (this.visibilityInstalled || typeof document === 'undefined') return;
		this.visibilityInstalled = true;
		document.addEventListener('visibilitychange', () => {
			if (!this.ctx) return;
			const token = ++this.suspendToken;
			if (document.hidden) {
				this.transientEpoch++;
				for (const voice of [...this.oneShots]) this.stopVoice(voice);
				for (const id of this.heldVoices.keys()) this.stopHeld(id, 0);
				this.pushLog('hidden');
				// nothing can be heard: stop rendering the beds and loops too (they resume where they were)
				this.suspendAfter(token, 0, 'hidden');
			} else {
				// Returning must NOT emit a backlog: we never queue one-shots, so there is nothing to flush. Just resume
				// (a muted player's context stays asleep) and re-assert the bed once.
				if (!this.muted) void this.resumeContext(token);
				this.pushLog('visible', { bed: this.currentBedId });
			}
		});
	}

	/** Best-effort resume of a browser-suspended context (autoplay throttling). Never while muted or hidden. */
	resume(): void {
		if (this.ctx && this.ctx.state === 'suspended' && !this.muted && !this.hiddenNow()) {
			void this.resumeContext(++this.suspendToken);
		}
	}

	get turboLevel(): number {
		return this.turbo;
	}
	setTurbo(level: number): void {
		const next = Math.max(0, Math.min(2, Math.round(level)));
		if (next !== this.turbo) this.transientEpoch++;
		this.turbo = next;
		if (next >= 1) this.warmTurbo();
	}
	/** The `_turbo` variants (86 files, ~1.1 MB / ~19 MB PCM) are fetched and decoded on the FIRST turbo — a session
	 *  that never turns it on never pays for them. Until a variant is decoded its caller plays the base cue
	 *  (`isDecoded`), so no first turbo cue is dropped by the late gate. */
	private warmTurbo(): void {
		const ids = this.turboCueIds();
		if (!this.turboFetched) {
			this.turboFetched = true;
			void this.prefetchPaced(ids);
		}
		if (this.turboWarming || !this.ctx || !this.unlocked) return;
		this.turboWarming = true;
		void this.warmBatches(ids, 'turbo');
	}

	// ===== decode / preload ==================================================
	/**
	 * A one-shot that is fetched and decoded the first time it is asked for starts late — on the first spin, the first
	 * reel stop, the first win and every first feature moment, i.e. exactly when a new player is forming an opinion.
	 * But decoding EVERYTHING at boot cost 223 fetches during the splash and ~119 MB of resident PCM from the first
	 * spin (growing to ~259 MB once both base tunes, a bonus bed and the rung beds had played), the largest RAM item
	 * after the textures on a 2-3 GB phone. So the set is tiered:
	 *   - hot set (`HOT_SET`, 47 cues): bytes fetched at mount, decoded inside the unlock gesture, kept for the session;
	 *   - cold set (`coldCueIds`, the other short non-turbo cues a session may reach): fetched in chains of 8 and
	 *     decoded in idle-paced batches only after the splash shutter is done, kept for the session;
	 *   - `_turbo` variants: fetched + decoded on the first turbo (callers fall back to the base cue until then);
	 *   - unreferenced ids (`neverLoad`): never fetched, never decoded;
	 *   - beds (> 20 s) and rung beds: decoded by the presentation director before their scene, EVICTED once nothing
	 *     plays them (their bytes stay in `raw`, so the next scene re-decodes without a refetch).
	 */
	prefetch(ids: readonly string[]): void {
		if (typeof fetch === 'undefined') return;
		for (const id of ids) {
			const cue = CUES[id];
			if (!cue || this.excluded.has(id) || this.buffers.has(id) || this.raw.has(id)) continue;
			this.raw.set(
				id,
				fetch(urlFor(cue))
					.then((res) => (res.ok ? res.arrayBuffer() : null))
					.catch(() => null),
			);
		}
	}
	/** Fetch in chains of `chunk` requests with an idle slice between chains (never the whole set at once, so the
	 *  audio bytes never crowd out a texture the board is waiting for). Resolves when every chain has landed. */
	async prefetchPaced(ids: readonly string[], chunk = 8): Promise<void> {
		for (let i = 0; i < ids.length; i += chunk) {
			const slice = ids.slice(i, i + chunk);
			this.prefetch(slice);
			await Promise.all(slice.map((id) => this.raw.get(id)));
			await idle();
		}
	}
	/** Every cue short enough to keep decoded for the whole session (the tiers above pick from this). */
	shortCueIds(): string[] {
		return Object.keys(CUES).filter((id) => CUES[id].durationMs <= EVICTABLE_MS && !id.startsWith(RUNG_BED_PREFIX));
	}
	/** Short non-turbo cues outside the hot set that a session may reach (feature SFX, rung hits, counters). The cues a
	 *  BASE spin can reach without a scene change (a win-rung celebration, a Backdraft, the cap) come first; the
	 *  feature-scene cues follow, since a shutter or a card always precedes them. */
	coldCueIds(): string[] {
		const cold = this.shortCueIds().filter((id) => !HOT.has(id) && !isTurboId(id) && !this.excluded.has(id));
		const baseFirst = (id: string) => (BASE_REACHABLE.test(id) ? 0 : 1);
		return cold.sort((a, b) => baseFirst(a) - baseFirst(b));
	}
	/** The `_turbo` variants a caller can reach. */
	turboCueIds(): string[] {
		return this.shortCueIds().filter((id) => isTurboId(id) && !this.excluded.has(id));
	}
	/** Ids no call site can reach: never fetched, never decoded (asserted against the manifest in DEV). */
	neverLoad(ids: readonly string[]): void {
		assertKnown('UNREFERENCED_CUES', ids);
		for (const id of ids) this.excluded.add(id);
	}
	/** Is this cue's PCM resident right now? (callers pick a `_turbo` variant only once it is) */
	isDecoded(id: string): boolean {
		return this.buffers.has(id);
	}
	/** The cold set waits for this (audio/index.ts opens it when the splash shutter is done). Idempotent. */
	openColdGate(): void {
		this.coldOpen?.();
		this.coldOpen = null;
	}
	private warming = false;
	/** Decode the hot set now, then the cold set in the background once the shutter hand-off is over. */
	async warmAll(first: readonly string[]): Promise<void> {
		if (this.warming || !this.ctx) return;
		this.warming = true;
		await this.ensureDecoded(first);
		await this.coldGate;
		await this.warmBatches(this.coldCueIds(), 'cold');
	}
	/** Decode `ids` a few at a time with an idle slice between batches, so decoding never competes with a frame for long. */
	private async warmBatches(ids: readonly string[], label: string): Promise<void> {
		const todo = ids.filter((id) => !this.buffers.has(id));
		for (let i = 0; i < todo.length; i += BATCH) {
			await this.ensureDecoded(todo.slice(i, i + BATCH));
			await idle();
		}
		this.pushLog('warm', { set: label, count: todo.length, decoded: this.buffers.size });
	}
	async ensureDecoded(ids: readonly string[]): Promise<void> {
		if (!this.ctx) return;
		await Promise.all(ids.map((id) => this.decode(id)));
	}
	private decode(id: string): Promise<AudioBuffer | null> {
		if (this.buffers.has(id)) return Promise.resolve(this.buffers.get(id)!);
		if (this.decoding.has(id)) return this.decoding.get(id)!;
		const cue = CUES[id];
		if (!cue || !this.ctx) return Promise.resolve(null);
		const ctx = this.ctx;
		const evictable = isEvictable(id);
		const p = (async () => {
			try {
				const ahead = this.raw.get(id);
				let bytes = (ahead && (await ahead)) || null;
				if (!bytes) {
					bytes = await (await fetch(urlFor(cue))).arrayBuffer();
					if (evictable) this.raw.set(id, Promise.resolve(bytes));
				}
				// decodeAudioData DETACHES the bytes it is handed: an evictable bed decodes from a copy so its kept bytes
				// can decode again after an eviction; a short cue hands its bytes over and forgets them.
				if (!evictable) this.raw.delete(id);
				const decoded = await ctx.decodeAudioData(evictable ? bytes.slice(0) : bytes);
				this.buffers.set(id, decoded);
				this.pushLog('decoded', { id });
				return decoded;
			} catch (err) {
				this.pushLog('decodeError', { id, err: String(err) });
				return null;
			} finally {
				this.decoding.delete(id);
			}
		})();
		this.decoding.set(id, p);
		return p;
	}
	/** Drop an evictable buffer's PCM once no voice plays it and no request wants it. Short cues never go. */
	private releaseIfIdle(id: string): void {
		const buffer = this.buffers.get(id);
		if (!buffer || !isEvictable(id)) return;
		if (this.currentBedId === id || this.bedIntent?.id === id || this.rungReturnBed === id) return;
		if (this.beds.has(id) || this.layers.has(id)) return;
		for (const voice of this.liveVoices) if (voice.source.buffer === buffer) return;
		this.buffers.delete(id);
		this.pushLog('evict', { id });
	}
	/** Release named evictable buffers that nothing plays (a bed prepared for a round that took the other one). */
	release(ids: readonly string[]): void {
		for (const id of ids) this.releaseIfIdle(id);
	}
	/** Resident PCM in bytes (AudioBuffer length x channels x 4), for the focused check. */
	get residentPcmBytes(): number {
		let total = 0;
		for (const b of this.buffers.values()) total += b.length * b.numberOfChannels * 4;
		return total;
	}

	// ===== one-shot SFX ======================================================
	/**
	 * Play a one-shot cue, honouring the manifest's maxInstances + cooldown and
	 * an optional coalescing `family` window so a dense cluster reads as a
	 * sequence, not a stack. Decorative accents are dropped in Turbo.
	 */
	playCue(id: string, opts: { family?: string; coalesceMs?: number; rate?: number } = {}): void {
		const cue = CUES[id];
		if (!cue || cue.bus !== 'sfx') {
			if (cue && cue.bus === 'music') this.pushLog('playCueWrongBus', { id });
			return;
		}
		if (!this.transientReady()) return;
		const requestedAt = now();
		const epoch = this.sceneEpoch;
		const transient = this.transientEpoch;
		const options = { ...opts };
		if (!this.canStartCue(id, cue, options, requestedAt)) return;
		this.whenDecoded(id, () => {
			if (epoch !== this.sceneEpoch || transient !== this.transientEpoch || !this.transientReady()) return false;
			const lateMs = now() - requestedAt;
			if (lateMs > LATE_ONESHOT_MS) {
				this.pushLog('drop', { id, reason: 'late', lateMs: Math.round(lateMs) });
				return false;
			}
			return this.canStartCue(id, cue, options, now());
		}, (buffer) => {
			this.startOneShot(id, cue, buffer, options.rate);
			this.lastStartAt.set(id, now());
			if (options.family) this.familyLastAt.set(options.family, now());
		});
	}

	private canStartCue(id: string, cue: CueDef, opts: { family?: string; coalesceMs?: number }, t: number): boolean {
		if (this.turbo >= 1 && cue.priority <= 2) {
			this.pushLog('turboSkip', { id });
			return false;
		}
		// per-cue cooldown
		const last = this.lastStartAt.get(id) ?? -1e9;
		if (t - last < cue.cooldownMs) {
			this.pushLog('drop', { id, reason: 'cooldown' });
			return false;
		}
		// per-family coalescing (readable clusters)
		if (opts.family && opts.coalesceMs) {
			const fl = this.familyLastAt.get(opts.family) ?? -1e9;
			if (t - fl < opts.coalesceMs) {
				this.pushLog('coalesce', { id, family: opts.family });
				return false;
			}
		}
		// per-cue instance cap
		const act = this.active.get(id) ?? 0;
		if (act >= cue.maxInstances) {
			this.pushLog('drop', { id, reason: 'maxInstances', cap: cue.maxInstances });
			return false;
		}
		return true;
	}

	private startOneShot(id: string, cue: CueDef, buf: AudioBuffer, rate?: number) {
		if (!this.ctx || !this.sfxUserGain) return;
		const src = this.ctx.createBufferSource();
		src.buffer = buf;
		if (rate && rate > 0) src.playbackRate.value = rate;
		const g = this.ctx.createGain();
		// tiny ramp in to avoid clicks
		const t0 = this.ctx.currentTime;
		g.gain.setValueAtTime(0.0001, t0);
		g.gain.exponentialRampToValueAtTime(Math.max(0.0002, cue.gain), t0 + 0.008);
		src.connect(g);
		g.connect(this.sfxUserGain);
		this.active.set(id, (this.active.get(id) ?? 0) + 1);
		const voice = this.trackVoice(src, g, (ended) => {
			this.oneShots.delete(ended);
			this.active.set(id, Math.max(0, (this.active.get(id) ?? 1) - 1));
		});
		this.oneShots.add(voice);
		src.start(t0);
		this.pushLog('cue', { id, bus: 'sfx', gain: cue.gain });
	}

	// ===== held one-shots (the anticipation riser) ============================
	// A riser must start at 0, never loop, and END when the outcome is known. `playCue` cannot be stopped and
	// `startSfxLoop` starts at a random offset and loops (it is for ambience), so neither fits: measured
	// 2026-09-19, the 2.29 s `antic_riser` kept RISING 0.6-1.3 s after a 1.7 s reel hold had already resolved,
	// and with several held reels its one-instance cap dropped the restart and left ~1.1 s of hold silent.
	/** Is this id a registered cue? (lets a caller prefer a new cue and fall back while it does not exist yet) */
	hasCue(id: string): boolean {
		return id in CUES;
	}
	private heldVoices = new Map<string, Voice>();
	/** Start a stoppable one-shot from 0. Calling it again RESTARTS it (the previous voice fades in 40 ms). */
	playHeld(id: string, opts: { rate?: number; level?: number } = {}): void {
		if (!this.transientReady() || !this.sfxUserGain) return;
		const cue = CUES[id];
		if (!cue || cue.bus !== 'sfx') return;
		this.stopHeld(id, 40);
		const valid = this.requestValidity(`held:${id}`);
		const epoch = this.transientEpoch;
		const requestedAt = now();
		const options = { ...opts };
		this.whenDecoded(id, () => valid() && epoch === this.transientEpoch && this.transientReady()
			&& now() - requestedAt <= LATE_ONESHOT_MS, (buf) => this.startHeld(id, cue, buf, options));
	}
	private startHeld(id: string, cue: CueDef, buf: AudioBuffer, opts: { rate?: number; level?: number }) {
		const ctx = this.ctx!;
		const source = ctx.createBufferSource();
		source.buffer = buf;
		if (opts.rate && opts.rate > 0) source.playbackRate.value = opts.rate;
		const gain = ctx.createGain();
		const t0 = ctx.currentTime;
		gain.gain.setValueAtTime(0.0001, t0);
		gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, cue.gain * (opts.level ?? 1)), t0 + 0.012);
		source.connect(gain);
		gain.connect(this.sfxUserGain!);
		const voice = this.trackVoice(source, gain, (ended) => {
			if (this.heldVoices.get(id) === ended) this.heldVoices.delete(id);
		});
		this.heldVoices.set(id, voice);
		source.start(t0);
		this.pushLog('heldStart', { id, rate: opts.rate ?? 1 });
	}
	/** Fade a held one-shot out and stop it. Safe when nothing is playing. */
	stopHeld(id: string, fadeMs = 90): void {
		this.invalidateRequest(`held:${id}`);
		const voice = this.heldVoices.get(id);
		if (!voice) return;
		this.heldVoices.delete(id);
		this.stopVoice(voice, fadeMs);
		this.pushLog('heldStop', { id });
	}

	/** Round-robin one of several cue ids (presentation variety, not outcome). */
	playRoundRobin(family: string, ids: string[], opts: { coalesceMs?: number } = {}): void {
		const i = (this.roundRobin.get(family) ?? -1) + 1;
		this.roundRobin.set(family, i);
		this.playCue(ids[i % ids.length], { family, coalesceMs: opts.coalesceMs });
	}

	// ===== music beds ========================================================
	private bedGrid(cue: CueDef): { loopStart: number; loopDur: number } {
		const loopStart = (cue.loopStartMs ?? 0) / 1000;
		const loopEnd = (cue.loopEndMs ?? cue.durationMs) / 1000;
		return { loopStart, loopDur: Math.max(0.001, loopEnd - loopStart) };
	}

	/** Start a bed as the sole primary bed (idempotent: a running same-id bed is
	 *  kept). Used for the initial base bed on unlock and for teardown restore. */
	startBed(id: string, fadeMs = 400): void {
		this.requestBed(id, fadeMs, false);
	}

	/** Equal-power crossfade. Preserve phase only for compatible tempo/bar grids;
	 *  otherwise begin the incoming bed at bar one. An already-primary bed stays
	 *  playing, while its request still cancels any older pending switch. */
	crossfadeToBed(id: string, durationMs = 700): void {
		this.requestBed(id, durationMs, true);
	}
	private requestBed(id: string, durationMs: number, crossfade: boolean): void {
		const cue = CUES[id];
		if (!cue || cue.bus !== 'music') return;
		this.bedIntent = { id, fadeMs: durationMs, crossfade };
		const request = ++this.bedRequest;
		const epoch = this.sceneEpoch;
		// Preserve the latest intent before a user gesture without creating a context.
		if (!this.ctx || !this.unlocked || !this.musicDuckGain) return;
		// Even an idempotent request invalidates an older pending switch.
		if (this.currentBedId === id && this.beds.has(id)) return;
		this.whenDecoded(id, () => request === this.bedRequest && epoch === this.sceneEpoch,
			(buffer) => this.activateBed(id, cue, buffer, durationMs, crossfade));
	}
	private isBaseBed(id: string | null): boolean {
		return id === DEFAULT_BED || id === 'base_loop_b';
	}
	private compatibleGrid(a: CueDef, b: CueDef): boolean {
		const tempo = a.tempoBpm;
		if (!tempo || !Number.isFinite(tempo) || tempo <= 0 || tempo !== b.tempoBpm) return false;
		const bar = 240 / tempo; // authored 4/4 beds
		return [a, b].every(cue => {
			const duration = this.bedGrid(cue).loopDur;
			const bars = Math.round(duration / bar);
			return bars > 0 && Math.abs(duration - bars * bar) <= 0.005;
		});
	}
	private phaseAt(bed: Bed, time: number): number {
		return ((bed.anchorPhase - bed.loopStart + time - bed.anchorTime) % bed.loopDur + bed.loopDur) % bed.loopDur;
	}
	private activateBed(id: string, cue: CueDef, buf: AudioBuffer, durationMs: number, crossfade: boolean) {
		const ctx = this.ctx!;
		const dur = Math.max(0.1, durationMs / 1000);
		const startAt = ctx.currentTime + (crossfade ? 0.03 : 0.02);
		const outgoing = this.currentBedId ? this.beds.get(this.currentBedId) : undefined;
		const aligned = !!(crossfade && outgoing && this.compatibleGrid(CUES[outgoing.id], cue));
		const offset = aligned && outgoing ? this.phaseAt(outgoing, startAt) : 0;
		const incoming = this.spawnBed(id, cue, buf, startAt, offset);
		if (crossfade) this.equalPowerRamp(incoming.gain, 0, cue.gain, startAt, dur);
		else this.rampBedGain(incoming, 0.0001, cue.gain, durationMs / 1000);
		for (const bed of this.beds.values()) {
			if (crossfade && bed === outgoing) {
				this.equalPowerRamp(bed.gain, bed.gain.gain.value || CUES[bed.id].gain, 0, startAt, dur, true);
				this.stopVoice(bed, (dur + 0.05) * 1000, false);
			} else this.stopBedVoice(bed, 0.12);
		}
		this.beds.clear();
		this.beds.set(id, incoming);
		this.currentBedId = id;
		// A rung bed replaces the scene bed only for a celebration: that bed stays decoded for the return crossfade
		// (every other bed a crossfade retires is evicted once its voice ends, see releaseIfIdle).
		if (id.startsWith(RUNG_BED_PREFIX)) {
			if (outgoing && !outgoing.id.startsWith(RUNG_BED_PREFIX)) this.rungReturnBed = outgoing.id;
		} else this.rungReturnBed = null;
		// A layer from a different known tempo cannot remain under the new scene.
		for (const layerId of this.layers.keys()) {
			const layer = CUES[layerId];
			if (layer.tempoBpm && cue.tempoBpm && layer.tempoBpm !== cue.tempoBpm) this.removeLayer(layerId);
		}
		this.pushLog(crossfade ? 'bedCrossfade' : 'bedStart', crossfade
			? { to: id, durationMs, aligned } : { id, fadeMs: durationMs });
	}

	private spawnBed(id: string, cue: CueDef, buf: AudioBuffer, startAt: number, offsetInLoop: number): Bed {
		const ctx = this.ctx!;
		const { loopStart, loopDur } = this.bedGrid(cue);
		const src = ctx.createBufferSource();
		src.buffer = buf;
		src.loop = true;
		src.loopStart = loopStart;
		src.loopEnd = loopStart + loopDur;
		const g = ctx.createGain();
		g.gain.value = 0.0001;
		src.connect(g);
		g.connect(this.musicDuckGain!);
		const startOffset = loopStart + (offsetInLoop % loopDur);
		const voice = this.trackVoice(src, g, () => {
			if (this.beds.get(id)?.source === src) {
				this.beds.delete(id);
				if (this.currentBedId === id) this.currentBedId = null;
			}
			if (this.layers.get(id)?.source === src) this.layers.delete(id);
			// a crossfade completed (or a layer / rung bed stopped): the retired PCM goes unless something still wants it
			this.releaseIfIdle(id);
		});
		const bed = Object.assign(voice, {
			id,
			loopStart,
			loopDur,
			anchorTime: startAt,
			anchorPhase: startOffset,
		});
		src.start(startAt, startOffset);
		return bed;
	}

	// ===== SFX-bus loops (reel travel, site ambience) =========================
	private sfxLoops = new Map<string, Voice>();
	/** Start a looping SFX (idempotent). Unlike a music layer it is not grid-aligned and sits on the SFX bus. */
	startSfxLoop(id: string, fadeMs = 120, level = 1): void {
		const cue = CUES[id];
		if (!cue || cue.bus !== 'sfx') return;
		// remembered while the context cannot play (muted / hidden → suspended): started on resume, forgotten on stop
		this.wantedLoops.set(id, { fadeMs, level });
		if (!this.transientReady() || !this.sfxUserGain || this.sfxLoops.has(id)) return;
		const valid = this.requestValidity(`loop:${id}`);
		this.whenDecoded(id, () => valid() && this.transientReady(),
			(buffer) => this.startLoop(id, cue, buffer, fadeMs, level));
	}
	private startLoop(id: string, cue: CueDef, buf: AudioBuffer, fadeMs: number, level: number) {
		const ctx = this.ctx!;
		const source = ctx.createBufferSource();
		source.buffer = buf;
		source.loop = true;
		const gain = ctx.createGain();
		gain.gain.value = 0.0001;
		source.connect(gain);
		gain.connect(this.sfxUserGain!);
		const voice = this.trackVoice(source, gain, (ended) => {
			if (this.sfxLoops.get(id) === ended) this.sfxLoops.delete(id);
		});
		this.sfxLoops.set(id, voice);
		source.start(ctx.currentTime + 0.01, Math.random() * Math.max(0, buf.duration - 0.05));
		gain.gain.linearRampToValueAtTime(cue.gain * level, ctx.currentTime + 0.01 + fadeMs / 1000);
		this.pushLog('sfxLoopStart', { id });
	}
	stopSfxLoop(id: string, fadeMs = 160): void {
		this.wantedLoops.delete(id);
		this.invalidateRequest(`loop:${id}`);
		const loop = this.sfxLoops.get(id);
		if (!loop) return;
		this.sfxLoops.delete(id);
		this.stopVoice(loop, fadeMs);
		this.pushLog('sfxLoopStop', { id });
	}

	/** Add a synchronized additive stem under the primary bed (no bed swap). */
	addLayer(id: string, fadeMs = 300): void {
		if (!this.ctx || !this.unlocked || !this.musicDuckGain || this.layers.has(id)) return;
		const cue = CUES[id];
		if (!cue || cue.bus !== 'music') return;
		const valid = this.requestValidity(`layer:${id}`);
		this.whenDecoded(id, valid, (buffer) => this.startLayer(id, cue, buffer, fadeMs));
	}
	private startLayer(id: string, cue: CueDef, buf: AudioBuffer, fadeMs: number) {
		const primary = this.currentBedId ? this.beds.get(this.currentBedId) : undefined;
		const primaryCue = primary ? CUES[primary.id] : undefined;
		if (primaryCue?.tempoBpm && cue.tempoBpm && primaryCue.tempoBpm !== cue.tempoBpm) {
			this.pushLog('layerSkip', { id, reason: 'tempoMismatch', bed: primary?.id });
			return;
		}
		const startAt = this.ctx!.currentTime + 0.03;
		const offset = primary && primaryCue && this.compatibleGrid(primaryCue, cue) ? this.phaseAt(primary, startAt) : 0;
		const bed = this.spawnBed(id, cue, buf, startAt, offset);
		this.rampBedGain(bed, 0.0001, cue.gain, fadeMs / 1000);
		this.layers.set(id, bed);
		this.pushLog('layerAdd', { id });
	}
	removeLayer(id: string, fadeMs = 300): void {
		this.invalidateRequest(`layer:${id}`);
		const bed = this.layers.get(id);
		if (!bed) return;
		this.stopBedVoice(bed, fadeMs / 1000);
		this.layers.delete(id);
		this.pushLog('layerRemove', { id });
	}

	private rampBedGain(bed: Bed, from: number, to: number, durSec: number) {
		if (!this.ctx) return;
		const t0 = this.ctx.currentTime;
		bed.gain.gain.cancelScheduledValues(t0);
		bed.gain.gain.setValueAtTime(Math.max(0.0001, from), t0);
		bed.gain.gain.linearRampToValueAtTime(Math.max(0.0001, to), t0 + Math.max(0.02, durSec));
	}

	private equalPowerRamp(param: GainNode, from: number, to: number, startAt: number, durSec: number, fadeOut = false) {
		const N = 32;
		const curve = new Float32Array(N);
		for (let i = 0; i < N; i++) {
			const x = i / (N - 1);
			// equal-power: sin for fade-in, cos for fade-out
			const k = fadeOut ? Math.cos((x * Math.PI) / 2) : Math.sin((x * Math.PI) / 2);
			curve[i] = Math.max(0.0001, (fadeOut ? from : to) * k);
		}
		try {
			param.gain.cancelScheduledValues(startAt);
			param.gain.setValueAtTime(Math.max(0.0001, fadeOut ? from : 0.0001), startAt);
			param.gain.setValueCurveAtTime(curve, startAt, durSec);
		} catch {
			// setValueCurve overlaps can throw; fall back to a linear ramp
			param.gain.linearRampToValueAtTime(Math.max(0.0001, to), startAt + durSec);
		}
	}

	private stopBedVoice(bed: Bed, fadeSec: number) {
		this.stopVoice(bed, fadeSec * 1000);
	}

	// ===== ducking (music only; below the player gains) ======================
	/** Duck the music bus for an important cue. Defaults from the manifest mix. */
	duck(opts: { db?: number; attackMs?: number; releaseMs?: number; holdMs?: number } = {}): void {
		if (!this.ctx || !this.musicDuckGain) return;
		const db = opts.db ?? midpoint(MIX.duckDb);
		const attack = (opts.attackMs ?? midpoint(MIX.duckAttackMs)) / 1000;
		const release = (opts.releaseMs ?? midpoint(MIX.duckReleaseMs)) / 1000;
		const hold = (opts.holdMs ?? 250) / 1000;
		const g = this.musicDuckGain.gain;
		const t0 = this.ctx.currentTime;
		const floor = dbToGain(-Math.abs(db));
		g.cancelScheduledValues(t0);
		g.setValueAtTime(g.value, t0);
		g.linearRampToValueAtTime(floor, t0 + attack);
		g.setValueAtTime(floor, t0 + attack + hold);
		g.linearRampToValueAtTime(1, t0 + attack + hold + release);
		this.pushLog('duck', { db, attackMs: Math.round(attack * 1000), releaseMs: Math.round(release * 1000) });
	}

	// ===== teardown ==========================================================
	/** Cancel scene audio and restore base, retaining an already-running base bed.
	 *  Called on route teardown / a new game start between rounds. */
	teardownToBase(): void {
		const from = this.currentBedId;
		const retained = this.isBaseBed(from) && from ? this.beds.get(from) : undefined;
		const restore = retained?.id ?? DEFAULT_BED;
		this.sceneEpoch++;
		this.transientEpoch++;
		this.bedRequest++;
		this.requests.clear();
		// the restore target is the intent BEFORE the stops below run their eviction hooks, so it is never evicted
		this.bedIntent = { id: restore, fadeMs: 700, crossfade: false };
		this.rungReturnBed = null;
		// Fading voices are no longer in their maps, but are still scheduled sources.
		for (const voice of [...this.liveVoices]) if (voice !== retained) this.stopVoice(voice);
		this.beds.clear();
		if (retained) this.beds.set(retained.id, retained);
		this.currentBedId = retained?.id ?? null;
		this.layers.clear();
		this.heldVoices.clear();
		this.sfxLoops.clear();
		this.wantedLoops.clear();
		this.active.clear();
		this.lastStartAt.clear();
		this.familyLastAt.clear();
		// reset the duck to unity immediately (with a tiny ramp)
		if (this.musicDuckGain && this.ctx) {
			const t0 = this.ctx.currentTime;
			this.musicDuckGain.gain.cancelScheduledValues(t0);
			this.musicDuckGain.gain.setTargetAtTime(1, t0, 0.05);
		}
		this.pushLog('teardownToBase', { from });
		this.startBed(restore, 700);
		// a bed prepared for a scene that never came (or a tune retired mid-celebration) goes with the scene
		for (const id of [...this.buffers.keys()]) this.releaseIfIdle(id);
	}

	// ===== state snapshot (for the focused check) ============================
	getState() {
		return {
			contextState: this.contextState,
			unlocked: this.unlocked,
			currentBed: this.currentBedId,
			activeBeds: Array.from(this.beds.keys()),
			activeLayers: Array.from(this.layers.keys()),
			activeHeld: Array.from(this.heldVoices.keys()),
			activeSfxLoops: Array.from(this.sfxLoops.keys()),
			liveVoices: this.liveVoices.size,
			masterStep: this.masterStep,
			masterFactor: Number(this.masterFactor.toFixed(3)),
			muted: this.muted,
			musicGain: Number(this.musicGain.toFixed(3)),
			sfxGain: Number(this.sfxGain.toFixed(3)),
			musicGainLive: Number(this.musicGainLive.toFixed(3)),
			sfxGainLive: Number(this.sfxGainLive.toFixed(3)),
			duckGain: Number((this.musicDuckGain?.gain.value ?? 1).toFixed(3)),
			turbo: this.turbo,
			activeVoices: Array.from(this.active.entries()).filter(([, n]) => n > 0),
			decodedCount: this.buffers.size,
			decodedIds: Array.from(this.buffers.keys()),
			residentPcmMb: Number((this.residentPcmBytes / 1048576).toFixed(1)),
			baseLatencyMs: Number(((this.ctx?.baseLatency ?? 0) * 1000).toFixed(2)),
		};
	}
}

export const audioManager = new AudioManager();

// dev server only: instrumentation surface for the headless focused check
if (import.meta.env.DEV && typeof window !== 'undefined') {
	(window as unknown as { __pwAudio?: unknown }).__pwAudio = {
		get log() {
			return audioManager.log;
		},
		getState: () => audioManager.getState(),
		manager: audioManager,
	};
}
