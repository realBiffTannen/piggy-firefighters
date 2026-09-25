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
// Manifest files are [<id>.ogg, <id>.m4a]. Prefer AAC/m4a where supported
// (Chromium, Safari); fall back to ogg (Firefox). Decoded either way.
const pickFile = (files: string[]): string => {
	let useM4a = false;
	try {
		if (typeof document !== 'undefined') {
			const a = document.createElement('audio');
			useM4a = !!a.canPlayType && a.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '';
		}
	} catch {
		useM4a = false;
	}
	const m4a = files.find((f) => f.endsWith('.m4a'));
	const ogg = files.find((f) => f.endsWith('.ogg'));
	return (useM4a ? m4a : ogg) ?? files[0];
};
const urlFor = (cue: CueDef): string => `${base}/${pickFile(cue.files)}`;

/** Decoded inside the unlock gesture, before the first spin can possibly need them. */
const EVERYDAY_CUES = [
	'spin_start',
	'reel_stop_1',
	'reel_stop_2',
	'reel_stop_3',
	'reel_stop_4',
	'reel_stop_5',
	'hat_land_1',
	'hat_land_2',
	'hat_land_3',
	'hat_ladder_1',
	'hat_ladder_2',
	'hat_ladder_3',
	'ui_click',
	'ui_click_2',
	'ui_click_3',
	'bet_change',
	'pig_thud',
	'total_win_small',
	'total_win_mid',
	'total_win_big',
	'anticipation_layer',
	'reel_spin_loop',
	'spin_whoosh',
	DEFAULT_AMBIENCE,
	'sym_win_h1',
	'sym_win_h2',
	'sym_win_h3',
	'sym_win_h4',
	'sym_win_l1',
	'sym_win_l2',
	'sym_win_l3',
	'sym_win_w',
	'way_win_small',
	'way_win_mid',
	'hat_land_heavy',
	'hat_ladder_4',
	'hat_ladder_5',
	'antic_riser',
	'tension_hit',
	'tension_miss',
	'dead_spin_settle',
];

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
	/** Encoded bytes fetched ahead of the unlock gesture (no AudioContext needed), decoded on unlock. */
	private raw = new Map<string, Promise<ArrayBuffer | null>>();
	private decoding = new Map<string, Promise<AudioBuffer | null>>();

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

	private applyMaster() {
		if (!this.masterGain || !this.ctx) return;
		const g = this.muted ? 0 : this.masterStep / MASTER_MAX_STEP;
		this.masterGain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.015);
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
			const epoch = this.sceneEpoch;
			if (!this.ctx) this.buildGraph();
			if (!this.ctx) return; // no Web Audio: game continues silent
			if (this.ctx.state === 'suspended') await this.ctx.resume().catch(() => {});
			if (this.ctx.state !== 'running' || epoch !== this.sceneEpoch || this.unlocked) return;
			this.unlocked = true;
			this.installVisibility();
			this.pushLog('unlock', { state: this.ctx.state });
			const intent = this.bedIntent ?? { id: DEFAULT_BED, fadeMs: 400, crossfade: false };
			this.requestBed(intent.id, intent.fadeMs, intent.crossfade);
			const request = this.bedRequest;
			await this.ensureDecoded([intent.id]);
			void this.warmAll(EVERYDAY_CUES);
			void this.ensureDecoded([DEFAULT_AMBIENCE]).then(() => {
				if (epoch === this.sceneEpoch && request === this.bedRequest && this.isBaseBed(this.currentBedId)) {
					this.startSfxLoop(DEFAULT_AMBIENCE, 1500);
				}
			});
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
		const ctx = new Ctor();
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
			if (document.hidden) {
				this.transientEpoch++;
				for (const voice of [...this.oneShots]) this.stopVoice(voice);
				for (const id of this.heldVoices.keys()) this.stopHeld(id, 0);
				this.pushLog('hidden');
			} else {
				// Returning must NOT emit a backlog: we never queue one-shots, so
				// there is nothing to flush. Just resume and re-assert the bed once.
				this.ctx.resume().catch(() => {});
				this.pushLog('visible', { bed: this.currentBedId });
			}
		});
	}

	/** Best-effort resume of a browser-suspended context (autoplay throttling). */
	resume(): void {
		if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
	}

	get turboLevel(): number {
		return this.turbo;
	}
	setTurbo(level: number): void {
		const next = Math.max(0, Math.min(2, Math.round(level)));
		if (next !== this.turbo) this.transientEpoch++;
		this.turbo = next;
	}

	// ===== decode / preload ==================================================
	/**
	 * A one-shot that is fetched and decoded the first time it is asked for starts late — on the
	 * first spin, the first reel stop, the first win and every first feature moment, i.e. exactly when a
	 * new player is forming an opinion. So: the bytes are fetched while the splash is up (`prefetch`,
	 * no AudioContext needed), the everyday set is decoded inside the unlock gesture, and everything else
	 * short is decoded in the background right after (`warmAll`). Long music beds stay lazy (tens of MB
	 * decoded each) and are decoded by the presentation director before their scene starts.
	 */
	prefetch(ids: string[]): void {
		if (typeof fetch === 'undefined') return;
		for (const id of ids) {
			const cue = CUES[id];
			if (!cue || this.buffers.has(id) || this.raw.has(id)) continue;
			this.raw.set(
				id,
				fetch(urlFor(cue))
					.then((res) => (res.ok ? res.arrayBuffer() : null))
					.catch(() => null),
			);
		}
	}
	/** Every cue short enough to keep decoded for the whole session. */
	shortCueIds(): string[] {
		return Object.keys(CUES).filter((id) => CUES[id].durationMs <= 20000 && !id.startsWith('rung_bed_'));
	}
	private warming = false;
	async warmAll(first: string[]): Promise<void> {
		if (this.warming || !this.ctx) return;
		this.warming = true;
		await this.ensureDecoded(first);
		const rest = this.shortCueIds().filter((id) => !this.buffers.has(id));
		for (let i = 0; i < rest.length; i += 6) {
			await this.ensureDecoded(rest.slice(i, i + 6));
			// yield between batches so decoding never competes with a frame for long
			await new Promise((resolve) => setTimeout(resolve, 30));
		}
		this.pushLog('warm', { decoded: this.buffers.size });
	}
	async ensureDecoded(ids: string[]): Promise<void> {
		if (!this.ctx) return;
		await Promise.all(ids.map((id) => this.decode(id)));
	}
	private decode(id: string): Promise<AudioBuffer | null> {
		if (this.buffers.has(id)) return Promise.resolve(this.buffers.get(id)!);
		if (this.decoding.has(id)) return this.decoding.get(id)!;
		const cue = CUES[id];
		if (!cue || !this.ctx) return Promise.resolve(null);
		const ctx = this.ctx;
		const p = (async () => {
			try {
				const ahead = this.raw.get(id);
				const buf = (ahead && (await ahead)) || (await (await fetch(urlFor(cue))).arrayBuffer());
				this.raw.delete(id);
				const decoded = await ctx.decodeAudioData(buf);
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
		if (!this.transientReady() || !this.sfxUserGain || this.sfxLoops.has(id)) return;
		const cue = CUES[id];
		if (!cue || cue.bus !== 'sfx') return;
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
		this.sceneEpoch++;
		this.transientEpoch++;
		this.bedRequest++;
		this.requests.clear();
		// Fading voices are no longer in their maps, but are still scheduled sources.
		for (const voice of [...this.liveVoices]) if (voice !== retained) this.stopVoice(voice);
		this.beds.clear();
		if (retained) this.beds.set(retained.id, retained);
		this.currentBedId = retained?.id ?? null;
		this.layers.clear();
		this.heldVoices.clear();
		this.sfxLoops.clear();
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
		this.startBed(retained?.id ?? DEFAULT_BED, 700);
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
