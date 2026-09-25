/**
 * Crash Galaxy — publisher brand bumper.
 *
 * A ~2.2s pre-roll that plays the publisher mark BEFORE the game's own loading
 * splash becomes visible, then dissolves to reveal it. Drop-in, self-contained:
 * no assets, no fonts, no network, no dependencies. The logo is inline vector
 * (traced from the master artwork) and the sting is synthesised with WebAudio,
 * so this file is the whole feature.
 *
 * Integration — the FIRST statement of the game's entry module:
 *
 *     import { mountBrandBumper } from './brand/crash-galaxy-bumper';
 *     mountBrandBumper();
 *
 * That is all it takes. The bumper paints over whatever is already on screen
 * (the game's inline `#splash`), never blocks asset loading, and removes
 * itself. If you want to hold the game's "Press to play" until the bumper is
 * finished, await the promise it returns:
 *
 *     const bumper = mountBrandBumper();
 *     await Promise.all([loadAssets(), bumper.done]);
 *
 * Behaviour contracts this file guarantees:
 *
 *  - Never blocks.        Returns synchronously; loading proceeds underneath.
 *  - Never traps input.   A tap/click/key fast-forwards it; it always removes
 *                         itself, and it is `pointer-events: none` once out.
 *  - Never breaks audio.  Browsers block audio before a user gesture. If the
 *                         AudioContext will not start, the bumper plays SILENT
 *                         and the context is closed. There is no deferred
 *                         sting that would fire over the game later.
 *  - Never fights QA.     `?skipSplash=1` and `?skipBrand=1` skip it entirely.
 *                         `document.documentElement.dataset.cgBumper` is
 *                         `"playing"` then `"done"`, and `window.__cgBumper`
 *                         exposes the same for probes.
 *  - Honours the user.    `prefers-reduced-motion: reduce` gets a short static
 *                         fade with no flight, shake, streaks or flash.
 *
 * Brand: the mark is pure black/white. The default `chrome` finish renders it
 * as brushed silver with a travelling specular, matching the metallic master
 * renders. Pass `finish: 'solid'` for flat white.
 */

export interface BrandBumperOptions {
  /** Where to mount. Default: `document.body`. */
  parent?: HTMLElement;
  /** Play the synthesised sting. Default: true. */
  sound?: boolean;
  /** Master volume 0..1 for the sting. Default: 0.55. */
  volume?: number;
  /**
   * Consulted once, right before the sting is scheduled. Return true to play
   * the bumper silently — wire this to the game's own mute state so a player
   * who muted last session does not get blasted on the next load.
   */
  muted?: () => boolean;
  /**
   * Time scale. 1 = the tuned ~2.2s cut. 0.8 is a snappier ~1.8s, 1.25 a more
   * cinematic ~2.8s. Clamped to 0.5..2.
   */
  scale?: number;
  /** 'chrome' (default) = brushed silver + specular sweep. 'solid' = flat white. */
  finish?: 'chrome' | 'solid';
  /** Field colour behind the mark. Default: '#05070c'. */
  background?: string;
  /** Stacking order. Default: 2147483000 — above every game splash we ship. */
  zIndex?: number;
  /** Force-skip without touching the URL (e.g. a replay/embed launch mode). */
  skip?: boolean;
  /** Called once the bumper has been removed from the DOM. */
  onDone?: () => void;
}

export interface BrandBumper {
  /** Resolves when the bumper is gone. Never rejects. */
  done: Promise<void>;
  /** Fast-forward to the outro immediately (what a tap does). */
  skip(): void;
}

/* ── Artwork ───────────────────────────────────────────────────────────────
 * Traced from crash-galaxy-black-whitebg.png at 1:1 with potrace, then the
 * potrace transform was flattened so these live directly in the lockup's
 * 1142x396 user space. See tools/trace-logo.mjs to regenerate.
 * The rocket occupies x 0..248; the two wordmark lines are drawn inside a
 * translate(397,37) group, in their own 745x338 space.                     */

const ROCKET_D = 'M227.1 3.6C171.1 24.2 132.9 64.5 113.2 123.8C109.4 135.2 109.4 135.2 99.3 139.5C39.3 164.8 3.8 208.4 0.4 261C-0.1 268.5 -0.1 268.5 2.1 265.5C20.4 241 54.7 224 99.1 217.5C118.3 214.8 116.9 214.2 122.5 227.2C144.4 278.6 147.1 324.2 130.1 355.7C126.8 361.7 126.9 361.7 137.2 352.7C164.4 329 185.6 292.3 193 256C196.5 239.1 196.7 198.2 193.4 189.6C193.1 188.9 197 183.8 201.9 178.2C243.5 130.5 258.4 62.2 240.4 1.7C239.7 -0.7 237.9 -0.4 227.1 3.6ZM70.5 262.4C48.3 269.5 31 295.4 19.6 339.1C14.9 356.8 10 385.7 10 395.2C10 396.3 18.7 391 32.3 381.7C75.5 352.2 105 314.5 105 288.6C105 269.6 88.2 256.8 70.5 262.4Z';
const CRASH_D = 'M32.1 1.6C18.7 5.2 9.7 13 4.7 25.2C2.1 31.7 0.8 78.9 3 89C12.9 133.9 88.1 131.1 90.8 85.7C91.2 79 91.2 79 79.1 79C67 79 67 79 67 82.3C67 103.8 34.7 107.6 28.5 86.8C26.3 79.3 26.3 41.6 28.6 34C35 12.6 67 17.2 67 39.5C67 42 67 42 79.1 42C91.3 42 91.3 42 90.8 34.5C89.2 9.2 61.5 -6.3 32.1 1.6ZM449.8 1.5C430 6.5 419.2 20.6 421.6 38.5C423.8 55.4 433.2 63.2 459.3 69.4C483.4 75.2 489.9 81.1 484.5 92.4C477.4 107.3 446.3 102.6 443.5 86.1C442.9 82.3 442.9 82.3 435.2 82.2C420.8 81.9 419.7 82.4 420.2 88.4C423.5 128 498.4 133.1 508.5 94.4C514.8 70.1 503.9 57.2 469.4 48.5C448.7 43.2 443.9 39.5 445.4 30C447.8 14.8 476.1 15.1 481.9 30.5C483.6 35.1 483.6 35.1 491.6 35.5C505.1 36.1 506.3 35.6 505.6 30.1C502.6 8.2 476.4 -5.2 449.8 1.5ZM143 60.5L143 119L155 119L167 119L167 98.6C167 75.2 166 77.3 177.4 77.8C184.6 78.1 184.6 78.1 195.4 98.6L206.2 119L219.6 119L233 119L229.1 111.2C226.9 107 221.5 96.7 217.1 88.5C207.7 71 208.2 72.8 212.3 70.8C232.5 60.9 236.5 29.1 219.4 13C209.1 3.3 203.6 2 169.8 2L143 2L143 60.5ZM191.4 22C206.5 25.4 210.1 47.2 197 55.3C192.6 58.1 169.4 59.3 167.9 56.9C166.9 55.3 166.7 22.7 167.7 21.7C168.7 20.7 186.9 20.9 191.4 22ZM311.3 5.7C310.4 8.8 280.2 111.5 278.4 117.2C277.9 118.8 278.9 119 289.9 119C300.4 119 301.9 118.8 302.4 117.2C302.6 116.3 304.3 110.2 306.1 103.7L309.4 92L327.9 92.2L346.5 92.5L350.4 105.7L354.3 119L366.8 119C378.2 119 379.2 118.9 378.5 117.3C378 115.7 354.9 39.8 346.7 12.2L343.6 2L327.9 2C312.2 2 312.2 2 311.3 5.7ZM340.5 72.9C339.6 73.8 318.5 74.2 316.4 73.3C314.3 72.5 314.3 72.3 320 51.5C323.1 39.9 326 29.1 326.4 27.5C327.1 25 328.3 28.3 334.1 48.4C337.9 61.6 340.8 72.6 340.5 72.9ZM553 60.5L553 119L565.5 119L578 119L578 94.5L578 70L596.5 70L615 70L615 94.5L615 119L627 119L639 119L639 60.5L639 2L627 2L615 2L615 25.5L615 49L596.5 49L578 49L578 25.5L578 2L565.5 2L553 2L553 60.5Z';
const GALAXY_D = 'M30.1 217.5C17.6 220.3 6.8 229.5 2.4 241.3C-0.9 250.4 -0.5 305.2 3.1 313.6C11.1 332.7 32.8 341.9 58.5 337.1C82.8 332.5 92 319.4 92 288.7L92 274L69 274L46 274L46 283.5L46 293L56.6 293C67.3 293 67.3 293 66.7 299.5C65 321.6 33 325.2 26.8 304.1C24.6 296.4 25 253.9 27.3 247.8C34.5 229.2 62.4 233.1 65.8 253.1C66.6 257.5 66.6 257.5 78 257.8C92.6 258.1 91.8 258.6 90.9 250.2C88.1 224.5 62.2 210.6 30.1 217.5ZM156.7 218.7C156.4 219.2 153.2 229.8 149.6 242.5C145.9 255.1 138.3 281.2 132.6 300.5C126.9 319.7 122.5 335.9 122.9 336.3C123.3 336.7 128.8 336.9 135 336.8C147.4 336.5 146 338.4 153 312.2C154.1 308 154.1 308 173 308L191.9 308L195 318.3C201.3 338.9 198.9 336.5 212.8 336.8C219.5 336.9 225 336.7 225 336.3C225 335.5 214.6 301.2 200 253.5C195.5 238.6 191.2 224.7 190.5 222.5C189.3 218.5 189.3 218.5 173.2 218.2C164.4 218.1 156.9 218.3 156.7 218.7ZM179.4 264C183.1 276.4 186.3 287.3 186.6 288.2C187.1 289.9 186 290 173 290C160 290 158.9 289.9 159.4 288.2C159.7 287.3 162.4 277 165.5 265.5C171.9 241.2 172.1 240.7 172.5 241.2C172.7 241.4 175.8 251.6 179.4 264ZM263 277.5L263 337L304.8 336.8L346.5 336.5L346.5 326.5L346.5 316.5L317.8 316.2L289 316L289 267L289 218L276 218L263 218L263 277.5ZM412.5 219.2C409.7 228.4 406.9 237.7 400.5 260C396.2 274.6 389.5 297.5 385.6 311C381.6 324.5 378.5 335.8 378.7 336.2C378.9 336.7 384.3 337 390.6 337C404 337 402.1 338.9 407 320.2L410.3 308L429.3 308.2C451 308.5 447.8 306.1 453.9 327C456.6 336.5 456.6 336.5 468.9 336.8C483.3 337.1 482.7 339.1 475.7 316.5C473.3 308.8 465.6 283.5 458.4 260.3L445.5 218L429.2 218C417.1 218 412.8 218.3 412.5 219.2ZM436.1 266C439.4 277.3 442.3 287.3 442.6 288.2C443.1 289.9 442 290 429 290C416 290 414.9 289.9 415.4 288.2C415.7 287.3 417.2 281.5 418.9 275.5C428.4 240.3 428.3 240.5 429.2 243.1C429.7 244.4 432.8 254.7 436.1 266ZM512.3 219.4C512.6 220.1 520.5 232.6 529.8 247.1C539.1 261.6 547 274.1 547.4 274.8C547.9 275.6 545.6 280.5 541.3 287.8C537.5 294.2 531.5 304.4 528 310.5C524.5 316.5 519.7 324.8 517.3 328.9C515 332.9 513 336.4 513 336.6C513 336.8 519 337 526.4 337C541.5 337 538.6 339.9 556.6 306.8C560.4 299.8 563.7 294 564 294C564.3 294 570.3 303.7 577.4 315.5L590.2 337L603.6 337C611 337 617 336.7 617 336.4C617 335.8 597.1 303.3 588.5 290C579.9 276.5 578.7 281.5 598 247.9L614.9 218.5L601.7 218.2C590.1 218 588.4 218.1 587.2 219.7C586.5 220.7 581.6 229.6 576.4 239.5C571.1 249.4 566.5 257.9 566.1 258.3C565.7 258.7 559.8 249.8 553 238.5L540.7 218L526.2 218C514.4 218 511.9 218.2 512.3 219.4ZM647.2 222.2C648.5 224.6 655 235.7 661.7 247C687.8 291.5 685 283.8 685 312.1L685 337L697.5 337L710 337L710 312.3C710 285.7 710.4 284.5 739.1 230.4C742.4 224.3 745 219 745 218.7C745 218.3 738.9 218 731.5 218C716.1 218 719.1 214.8 705.3 246.7C698.1 263.4 698.1 263.5 695.7 258.7C694.8 257 689.7 247.1 684.3 236.8L674.5 218L659.7 218C644.8 218 644.8 218 647.2 222.2Z';

const VB_W = 1142;
const VB_H = 396;
/** Rocket centroid in lockup user space — the origin of the whole bumper. */
const R_CX = 124;
const R_CY = 198;

/* ── Timeline (ms at scale 1) ─────────────────────────────────────────────
 * Every visual and every audio cue reads its time from here, so retiming the
 * cut is a single edit and picture stays locked to sound.                  */

const T = {
  /** Hairline horizon tick — the pre-roll "the projector is on" beat. */
  tick: 0,
  tickDur: 260,
  /** Rocket flight: enters bottom-left, overshoots, settles. */
  flight: 120,
  flightDur: 660,
  /** Impact — the rocket arrives at its lockup position. */
  impact: 780,
  flashDur: 150,
  shockDur: 640,
  shakeDur: 240,
  /** The shockwave "prints" the two wordmark lines as it passes them. */
  line1: 880,
  line2: 975,
  lineDur: 400,
  /** Specular sweep — starts once the second line has finished printing. */
  sheen: 1340,
  sheenDur: 560,
  /** Dissolve to the game's own loading splash. */
  out: 1900,
  outDur: 340,
  end: 2280,
} as const;

/* ── Guards ────────────────────────────────────────────────────────────── */

const MOUNT_ID = 'cg-brand-bumper';

function urlSkip(): boolean {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get('skipSplash') === '1' || q.get('skipBrand') === '1';
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function resolved(onDone?: () => void): BrandBumper {
  try {
    onDone?.();
  } catch {
    /* a throwing callback must not take the game down */
  }
  return { done: Promise.resolve(), skip() {} };
}

/* ── Sting ─────────────────────────────────────────────────────────────────
 * Synthesised, not sampled: zero bytes, no fetch, no decode, and it retimes
 * with the picture. Four layers, all hung off the same t0:
 *
 *   tick     25ms  filtered click — lands on the horizon hairline
 *   whoosh  660ms  noise through a rising bandpass + a sub ramp, panned L→R,
 *                  ending exactly on impact
 *   impact  1.2s   sine kick 130→38Hz + a lowpassed noise body + a sub tail
 *   bell    1.4s   three detuned partials through a highpass — the "galaxy"
 *                  shimmer that carries the wordmark reveal
 *   sheen   420ms  a quiet high sweep under the specular pass
 *
 * Everything runs into a soft-clip waveshaper so the stacked layers cannot
 * spit on cheap laptop speakers.                                          */

function makeNoise(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  // Lightly integrated white noise — closer to pink, less fizzy under a filter.
  let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    last = 0.92 * last + 0.08 * w;
    d[i] = w * 0.65 + last * 2.2;
  }
  return buf;
}

function softClipCurve(): Float32Array {
  const n = 1024;
  // Built over an explicit ArrayBuffer: WaveShaper.curve is typed against a
  // non-shared buffer, and `new Float32Array(n)` widens to ArrayBufferLike.
  const curve = new Float32Array(new ArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * 1.6) / Math.tanh(1.6);
  }
  return curve;
}

/**
 * Schedule the bumper's sting on any audio context, starting ~20ms out.
 *
 * Exported (and typed against `BaseAudioContext`) so it can be rendered and
 * measured in an `OfflineAudioContext` by a test, and so a game that wants the
 * publisher sting somewhere else can reuse it instead of re-deriving it.
 * `mountBrandBumper` calls this for you — you do not need it for integration.
 *
 * @param volume Master gain, 0..1.
 * @param s      Time scale, matching the bumper's `scale` option.
 */
export function scheduleBrandSting(ctx: BaseAudioContext, volume = 0.55, s = 1): void {
  const t0 = ctx.currentTime + 0.02;
  const at = (ms: number) => t0 + (ms / 1000) * s;
  const dur = (ms: number) => (ms / 1000) * s;

  const shaper = ctx.createWaveShaper();
  // Cast at the call site rather than annotating softClipCurve's return: TS
  // >= 5.7 types WaveShaperNode.curve as Float32Array<ArrayBuffer>, and the
  // generic form does not parse on the older TS some game repos still pin.
  shaper.curve = softClipCurve() as WaveShaperNode['curve'];
  shaper.oversample = '2x';

  const master = ctx.createGain();
  master.gain.value = Math.max(0, Math.min(1, volume));
  shaper.connect(master).connect(ctx.destination);

  const noiseBuf = makeNoise(ctx, 2.2 * s);

  // ── tick: the projector strikes ────────────────────────────────────────
  {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    const t = at(T.tick);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(bp).connect(g).connect(shaper);
    src.start(t);
    src.stop(t + 0.08);
  }

  // ── whoosh: the approach, resolving on the impact frame ────────────────
  {
    const t = at(T.flight);
    const len = dur(T.flightDur);

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.exponentialRampToValueAtTime(5200, t + len);

    // The floor here is 0.012, not the usual near-zero: an exponential ramp
    // from 0.0001 puts effectively all of its travel in the last 150ms, so the
    // riser is dead air for the first two thirds of the rocket's flight. A
    // 35:1 ratio still reads as a swell but is audible from the first frame.
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.012, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + len * 0.86);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);

    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(-0.75, t);
    pan.pan.linearRampToValueAtTime(0.2, t + len);

    src.connect(bp).connect(g).connect(pan).connect(shaper);
    src.start(t);
    src.stop(t + len + 0.1);

    // Sub under the whoosh — the thing you feel rather than hear.
    const sub = ctx.createOscillator();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(48, t);
    sub.frequency.exponentialRampToValueAtTime(184, t + len);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.008, t);
    sg.gain.exponentialRampToValueAtTime(0.22, t + len * 0.9);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.04);
    sub.connect(lp).connect(sg).connect(shaper);
    sub.start(t);
    sub.stop(t + len + 0.1);
  }

  // ── impact ─────────────────────────────────────────────────────────────
  {
    const t = at(T.impact);

    const kick = ctx.createOscillator();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(130, t);
    kick.frequency.exponentialRampToValueAtTime(38, t + 0.19);
    const kg = ctx.createGain();
    kg.gain.setValueAtTime(0.0001, t);
    kg.gain.exponentialRampToValueAtTime(0.9, t + 0.008);
    kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    kick.connect(kg).connect(shaper);
    kick.start(t);
    kick.stop(t + 0.6);

    const body = ctx.createBufferSource();
    body.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.34);
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.exponentialRampToValueAtTime(0.5, t + 0.01);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    body.connect(lp).connect(bg).connect(shaper);
    body.start(t);
    body.stop(t + 0.5);

    // Long sub tail so the hold does not feel empty.
    const tail = ctx.createOscillator();
    tail.type = 'sine';
    tail.frequency.setValueAtTime(56, t);
    tail.frequency.exponentialRampToValueAtTime(31, t + 1.2);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
    tail.connect(tg).connect(shaper);
    tail.start(t);
    tail.stop(t + 1.3);
  }

  // ── bell: the shimmer that carries the wordmark ────────────────────────
  {
    const t = at(T.line1) - 0.06;
    const partials: Array<[number, number, number]> = [
      // freq, gain, decay
      [1108, 0.2, 1.5],
      [1663, 0.13, 1.1],
      [2311, 0.09, 0.8],
      [3327, 0.05, 0.55],
    ];
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 700;
    hp.connect(shaper);
    for (const [f, gain, decay] of partials) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, t);
      // Slight downward drift keeps it from sounding like a test tone.
      o.frequency.exponentialRampToValueAtTime(f * 0.985, t + decay);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(hp);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
  }

  // ── sheen: barely there, but you miss it if it is gone ──────────────────
  {
    const t = at(T.sheen);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(5400, t);
    o.frequency.exponentialRampToValueAtTime(11500, t + 0.42);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.16);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g).connect(shaper);
    o.start(t);
    o.stop(t + 0.5);
  }
}

/**
 * Start audio only if the browser will let us start it NOW. Autoplay policy
 * blocks an AudioContext until a user gesture, and this bumper runs before any
 * gesture on a cold load. Rather than queue a sting that would fire over the
 * game seconds later, we run silent and let the game unlock audio at its own
 * press-to-play. Returns a teardown for the fast-forward path.
 */
function tryPlaySting(volume: number, s: number): () => void {
  const Ctor: typeof AudioContext | undefined =
    (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return () => {};

  let ctx: AudioContext;
  try {
    ctx = new Ctor();
  } catch {
    return () => {};
  }

  const close = () => {
    // PIGGY WORKERS PATCH (2026-09-19): `close()` on an already-closed context REJECTS (it does not
    // throw), and the timer teardown and the fast-forward teardown can both get here — the
    // unhandled "Cannot close a closed AudioContext" surfaced as a page error under QA. Guard
    // the state and swallow the rejection. Everything else in this file is the skill's verbatim.
    try {
      if (ctx.state !== 'closed') void ctx.close().catch(() => {});
    } catch {
      /* already closed */
    }
  };

  // resume() may resolve or reject; either way `state` is the truth.
  try {
    void ctx.resume().catch(() => {});
  } catch {
    /* older Safari */
  }

  if (ctx.state !== 'running') {
    close();
    return () => {};
  }

  try {
    scheduleBrandSting(ctx, volume, s);
  } catch {
    close();
    return () => {};
  }

  const stopAt = window.setTimeout(close, T.end * s + 900);
  return () => {
    window.clearTimeout(stopAt);
    close();
  };
}

/* ── Styles ───────────────────────────────────────────────────────────────
 * Injected rather than shipped as a .css file so the drop-in stays one file
 * and cannot be half-integrated. All timings are interpolated from T, so the
 * `scale` option retimes picture and sound together.                       */

function css(o: {
  s: number;
  bg: string;
  z: number;
  reduced: boolean;
}): string {
  const { s, bg, z } = o;
  const ms = (v: number) => `${Math.round(v * s)}ms`;

  if (o.reduced) {
    return `
#${MOUNT_ID}{position:fixed;inset:0;z-index:${z};display:grid;place-items:center;
  background:${bg};overflow:hidden;opacity:1;transition:opacity 260ms linear;
  -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
#${MOUNT_ID}.cgb-out{opacity:0;pointer-events:none}
#${MOUNT_ID} .cgb-stage{width:min(62vw,calc(62vh * ${VB_W / VB_H}),720px)}
#${MOUNT_ID} .cgb-lockup{width:100%;height:auto;display:block;
  animation:cgb-fade 420ms ease-out both}
#${MOUNT_ID} .cgb-stars,#${MOUNT_ID} .cgb-shock,#${MOUNT_ID} .cgb-flash,
#${MOUNT_ID} .cgb-horizon,#${MOUNT_ID} .cgb-sheen-band{display:none}
@keyframes cgb-fade{from{opacity:0}to{opacity:1}}`;
  }

  return `
#${MOUNT_ID}{position:fixed;inset:0;z-index:${z};display:grid;place-items:center;
  background:${bg};overflow:hidden;opacity:1;
  transition:opacity ${ms(T.outDur)} cubic-bezier(.4,0,.2,1);
  -webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;
  contain:layout paint}
#${MOUNT_ID}.cgb-out{opacity:0;pointer-events:none}
#${MOUNT_ID}.cgb-ff{transition-duration:180ms}

/* Faint deep-field wash so the black is not a dead flat plate. */
#${MOUNT_ID}::before{content:'';position:absolute;inset:-10%;pointer-events:none;
  background:radial-gradient(46% 40% at 50% 52%,rgba(190,205,235,.10) 0%,rgba(0,0,0,0) 70%);
  opacity:0;animation:cgb-wash ${ms(1500)} ease-out ${ms(T.impact - 40)} forwards}
@keyframes cgb-wash{from{opacity:0}to{opacity:1}}

/* Vignette, painted last so nothing leaks into the screen corners. */
#${MOUNT_ID}::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(78% 66% at 50% 50%,rgba(0,0,0,0) 45%,rgba(0,0,0,.72) 100%)}

/* ── pre-roll: a hairline horizon opens and closes ── */
#${MOUNT_ID} .cgb-horizon{position:absolute;left:50%;top:50%;height:1px;width:70vw;
  transform:translate(-50%,-50%) scaleX(0);transform-origin:50% 50%;
  background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.85) 50%,rgba(255,255,255,0) 100%);
  animation:cgb-horizon ${ms(T.tickDur)} cubic-bezier(.16,1,.3,1) ${ms(T.tick)} both}
@keyframes cgb-horizon{
  0%{transform:translate(-50%,-50%) scaleX(0);opacity:0}
  22%{opacity:1}
  55%{transform:translate(-50%,-50%) scaleX(1);opacity:.9}
  100%{transform:translate(-50%,-50%) scaleX(1) scaleY(.4);opacity:0}}

/* ── star field: streaks during the flight, points after ── */
#${MOUNT_ID} .cgb-stars{position:absolute;inset:0;pointer-events:none;
  animation:cgb-shake ${ms(T.shakeDur)} steps(1,end) ${ms(T.impact)} both}
#${MOUNT_ID} .cgb-stars i{position:absolute;display:block;height:1.5px;width:var(--w);
  border-radius:1px;background:#fff;opacity:0;will-change:transform,opacity;
  animation:cgb-streak var(--d) cubic-bezier(.2,.7,.2,1) var(--t) both}
@keyframes cgb-streak{
  0%{transform:translate(var(--dx),var(--dy)) rotate(-45deg) scaleX(3.2);opacity:0}
  18%{opacity:var(--o)}
  100%{transform:translate(0,0) rotate(-45deg) scaleX(.12);opacity:calc(var(--o) * .55)}}

/* ── impact ──
   Both of these are children of .cgb-stage, and the stage box is exactly the
   lockup's viewBox box — so a percentage position inside it lands on the
   rocket wherever the lockup has been scaled to. Anchoring them to the
   VIEWPORT instead would fire the shockwave out of empty space in the middle
   of the wordmark, because the rocket sits at the far left of the lockup. */
#${MOUNT_ID} .cgb-burst{position:absolute;
  left:${((R_CX / VB_W) * 100).toFixed(3)}%;top:${((R_CY / VB_H) * 100).toFixed(3)}%;
  pointer-events:none}

/* A bloom from the point of impact, not a flat white plate over the screen:
   softer to look at, and it keeps the flash tied to the event that caused it.
   One flash, ~150ms — well inside the three-per-second photosensitivity bar. */
#${MOUNT_ID} .cgb-flash{width:260vmax;height:260vmax;margin:-130vmax 0 0 -130vmax;
  border-radius:50%;opacity:0;mix-blend-mode:screen;
  background:radial-gradient(closest-side,rgba(255,255,255,.92) 0%,
    rgba(255,255,255,.5) 26%,rgba(255,255,255,0) 62%);
  animation:cgb-flash ${ms(T.flashDur)} ease-out ${ms(T.impact)} both}
@keyframes cgb-flash{0%{opacity:0}12%{opacity:.55}100%{opacity:0}}

#${MOUNT_ID} .cgb-shock{width:14vmax;height:14vmax;margin:-7vmax 0 0 -7vmax;
  border-radius:50%;border:2px solid rgba(255,255,255,.85);opacity:0;
  animation:cgb-shock ${ms(T.shockDur)} cubic-bezier(.16,1,.3,1) ${ms(T.impact)} both}
@keyframes cgb-shock{
  0%{transform:scale(.05);opacity:0;border-width:6px}
  10%{opacity:.9}
  100%{transform:scale(2.6);opacity:0;border-width:1px}}

/* ── stage ── */
#${MOUNT_ID} .cgb-stage{position:relative;
  width:min(64vw,calc(64vh * ${(VB_W / VB_H).toFixed(4)}),760px);
  animation:cgb-shake ${ms(T.shakeDur)} steps(1,end) ${ms(T.impact)} both,
            cgb-settle ${ms(T.outDur + 240)} cubic-bezier(.4,0,.2,1) ${ms(T.out - 120)} both}
@keyframes cgb-settle{from{transform:scale(1)}to{transform:scale(1.045)}}
@keyframes cgb-shake{
  0%{translate:0 0}12%{translate:-5px 4px}25%{translate:4px -4px}
  40%{translate:-3px -2px}56%{translate:3px 2px}72%{translate:-2px 1px}
  86%{translate:1px -1px}100%{translate:0 0}}

/* overflow:visible lets the rocket fly in from outside the lockup box. */
#${MOUNT_ID} .cgb-lockup{display:block;width:100%;height:auto;overflow:visible}

/* transform-origin is pinned to the rocket centroid in view-box units, NOT
   fill-box: the exhaust trail lives inside this group and would otherwise
   drag the group's bounding box (and so the scale origin) off the rocket. */
#${MOUNT_ID} .cgb-rocket{transform-box:view-box;transform-origin:${R_CX}px ${R_CY}px;
  will-change:transform,opacity;
  animation:cgb-launch ${ms(T.flightDur)} cubic-bezier(.16,.9,.24,1) ${ms(T.flight)} both}
@keyframes cgb-launch{
  0%{transform:translate(-680px,680px) scale(.42) rotate(-8deg);opacity:0}
  6%{opacity:1}
  /* overshoot past the mark, then fall back into the lockup */
  72%{transform:translate(38px,-38px) scale(1.075) rotate(1.5deg);opacity:1}
  100%{transform:translate(0,0) scale(1) rotate(0deg);opacity:1}}

/* Exhaust trail — rides the rocket group, so it needs no timing of its own. */
#${MOUNT_ID} .cgb-trail{opacity:0;
  animation:cgb-trail ${ms(T.flightDur + 260)} cubic-bezier(.3,.7,.2,1) ${ms(T.flight)} both}
@keyframes cgb-trail{0%{opacity:0}10%{opacity:.9}62%{opacity:.55}100%{opacity:0}}

/* ── wordmark: the shock front prints each line as it passes ── */
#${MOUNT_ID} .cgb-line{opacity:0;clip-path:inset(0 100% 0 0);
  transform-box:fill-box;transform-origin:0% 50%;will-change:clip-path,opacity}
#${MOUNT_ID} .cgb-l1{animation:cgb-print ${ms(T.lineDur)} cubic-bezier(.22,1,.3,1) ${ms(T.line1)} both}
#${MOUNT_ID} .cgb-l2{animation:cgb-print ${ms(T.lineDur)} cubic-bezier(.22,1,.3,1) ${ms(T.line2)} both}
@keyframes cgb-print{
  0%{opacity:0;clip-path:inset(0 100% 0 0);transform:translateX(-10px) scaleX(1.05)}
  14%{opacity:1}
  100%{opacity:1;clip-path:inset(0 0 0 0);transform:translateX(0) scaleX(1)}}

/* ── specular sweep over the finished lockup ──
   The band starts parked just off the left of the viewBox (x -380..-40) and
   travels 1600 USER UNITS, which is exactly the lockup's 1142 plus the band's
   own width and both parking gaps. Guessing a pixel distance here is how the
   sweep ends up still short of the mark when the bumper dissolves. */
#${MOUNT_ID} .cgb-sheen-band{opacity:0;
  animation:cgb-sheen ${ms(T.sheenDur)} cubic-bezier(.4,0,.35,1) ${ms(T.sheen)} both}
@keyframes cgb-sheen{
  0%{transform:translateX(0);opacity:0}
  10%{opacity:1}
  86%{opacity:1}
  100%{transform:translateX(1600px);opacity:0}}

/* The mark leaves last: wordmark dims a beat before the rocket. */
#${MOUNT_ID}.cgb-out .cgb-word{opacity:0;transition:opacity ${ms(T.outDur * 0.55)} ease-in}
`;
}

/* ── Markup ───────────────────────────────────────────────────────────── */

const SVG_NS = 'http://www.w3.org/2000/svg';

function buildLockup(finish: 'chrome' | 'solid', reduced: boolean): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'cgb-lockup');
  svg.setAttribute('viewBox', `0 0 ${VB_W} ${VB_H}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Crash Galaxy');

  const chrome = finish === 'chrome';
  const inkFill = chrome ? 'url(#cgb-ink)' : '#ffffff';

  // Trail geometry: a tapered quad from the rocket centroid back along the
  // reciprocal of the flight vector (-1,+1)/root2.
  const L = 900;
  const ux = -Math.SQRT1_2;
  const uy = Math.SQRT1_2;
  const tx = R_CX + ux * L;
  const ty = R_CY + uy * L;
  const px = Math.SQRT1_2;
  const py = Math.SQRT1_2;
  const nearW = 58;
  const farW = 3;
  const trailPts = [
    `${R_CX + px * nearW},${R_CY + py * nearW}`,
    `${R_CX - px * nearW},${R_CY - py * nearW}`,
    `${tx - px * farW},${ty - py * farW}`,
    `${tx + px * farW},${ty + py * farW}`,
  ].join(' ');

  svg.innerHTML = `
    <defs>
      <linearGradient id="cgb-ink" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#ffffff"/>
        <stop offset="34%"  stop-color="#e6eaf2"/>
        <stop offset="52%"  stop-color="#9aa4b6"/>
        <stop offset="68%"  stop-color="#d9dfea"/>
        <stop offset="100%" stop-color="#f4f7fc"/>
      </linearGradient>
      <linearGradient id="cgb-trailgrad" gradientUnits="userSpaceOnUse"
        x1="${R_CX}" y1="${R_CY}" x2="${tx}" y2="${ty}">
        <stop offset="0%"   stop-color="#ffffff" stop-opacity=".85"/>
        <stop offset="18%"  stop-color="#cfd8ea" stop-opacity=".45"/>
        <stop offset="100%" stop-color="#8fa0c0" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="cgb-sheengrad" gradientUnits="objectBoundingBox"
        x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(16 .5 .5)">
        <stop offset="35%" stop-color="#ffffff" stop-opacity="0"/>
        <stop offset="47%" stop-color="#ffffff" stop-opacity=".9"/>
        <stop offset="50%" stop-color="#ffffff" stop-opacity="1"/>
        <stop offset="53%" stop-color="#ffffff" stop-opacity=".9"/>
        <stop offset="65%" stop-color="#ffffff" stop-opacity="0"/>
      </linearGradient>
      <!-- <use> clones geometry only: it does NOT inherit the ancestor
           transform of the element it points at, so the wordmark's
           translate(397,37) has to be restated here or the specular would
           sweep two letter-shaped holes at the far left of the canvas. -->
      <clipPath id="cgb-lockclip">
        <use href="#cgb-p-rocket"/>
        <use href="#cgb-p-l1" transform="translate(397,37)"/>
        <use href="#cgb-p-l2" transform="translate(397,37)"/>
      </clipPath>
    </defs>

    <polygon class="cgb-trail" points="${trailPts}" fill="url(#cgb-trailgrad)"/>

    <g class="cgb-rocket">
      <path id="cgb-p-rocket" d="${ROCKET_D}" fill="${inkFill}"/>
    </g>
    <g class="cgb-word" transform="translate(397,37)">
      <path id="cgb-p-l1" class="cgb-line cgb-l1" d="${CRASH_D}" fill="${inkFill}"/>
      <path id="cgb-p-l2" class="cgb-line cgb-l2" d="${GALAXY_D}" fill="${inkFill}"/>
    </g>

    <g clip-path="url(#cgb-lockclip)" style="mix-blend-mode:screen" aria-hidden="true">
      <rect class="cgb-sheen-band" x="-380" y="-40" width="340" height="${VB_H + 80}"
        fill="url(#cgb-sheengrad)"/>
    </g>`;

  // The trail belongs to the flight, not the lockup — reduced motion has no
  // flight, so it must not sit there as a static wedge.
  if (reduced) svg.querySelector('.cgb-trail')?.remove();

  // The rocket group must carry the trail so they move together. Moving the
  // node after innerHTML keeps the markup above readable as a single lockup.
  const rocketG = svg.querySelector('.cgb-rocket');
  const trail = svg.querySelector('.cgb-trail');
  if (rocketG && trail) rocketG.insertBefore(trail, rocketG.firstChild);

  return svg;
}

function buildStars(count: number): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'cgb-stars';
  let html = '';
  for (let i = 0; i < count; i++) {
    // Biased away from dead centre so the lockup never sits in confetti.
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const w = 6 + Math.random() * 26;
    const o = 0.25 + Math.random() * 0.6;
    const reach = 180 + Math.random() * 420;
    const delay = Math.round(Math.random() * 160);
    const dur = 620 + Math.round(Math.random() * 520);
    html +=
      `<i style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;` +
      `--w:${w.toFixed(1)}px;--o:${o.toFixed(2)};` +
      `--dx:${reach.toFixed(0)}px;--dy:${(-reach).toFixed(0)}px;` +
      `--t:${delay}ms;--d:${dur}ms"></i>`;
  }
  wrap.innerHTML = html;
  return wrap;
}

/* ── Entry point ──────────────────────────────────────────────────────── */

/**
 * Mount and play the Crash Galaxy bumper. Safe to call before anything else
 * in the entry module; safe to call twice (the second call is a no-op that
 * resolves immediately).
 */
export function mountBrandBumper(options: BrandBumperOptions = {}): BrandBumper {
  const {
    parent,
    sound = true,
    volume = 0.55,
    muted,
    finish = 'chrome',
    background = '#05070c',
    zIndex = 2147483000,
    skip = false,
    onDone,
  } = options;

  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return resolved(onDone);
  }
  if (skip || urlSkip()) return resolved(onDone);
  if (document.getElementById(MOUNT_ID)) return resolved(onDone);

  const s = Math.max(0.5, Math.min(2, options.scale ?? 1));
  const reduced = prefersReducedMotion();
  const total = reduced ? 1100 : T.end * s;

  const host = parent ?? document.body;
  if (!host) return resolved(onDone);

  const style = document.createElement('style');
  style.id = `${MOUNT_ID}-style`;
  style.textContent = css({ s, bg: background, z: zIndex, reduced });
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = MOUNT_ID;
  root.setAttribute('aria-hidden', 'true');
  root.dataset.cgBumper = 'playing';

  if (!reduced) {
    const horizon = document.createElement('div');
    horizon.className = 'cgb-horizon';
    root.appendChild(horizon);
    root.appendChild(buildStars(46));
  }

  const stage = document.createElement('div');
  stage.className = 'cgb-stage';

  if (!reduced) {
    // Inside the stage, and BEFORE the lockup so the mark stays on top of its
    // own shockwave. Their position is a percentage of the stage box, which is
    // what pins them to the rocket rather than to the middle of the screen.
    const flash = document.createElement('div');
    flash.className = 'cgb-burst cgb-flash';
    const shock = document.createElement('div');
    shock.className = 'cgb-burst cgb-shock';
    stage.appendChild(flash);
    stage.appendChild(shock);
  }

  stage.appendChild(buildLockup(finish, reduced));
  root.appendChild(stage);

  host.appendChild(root);
  document.documentElement.dataset.cgBumper = 'playing';

  const silent = !sound || reduced || (() => {
    try {
      return muted?.() === true;
    } catch {
      return false;
    }
  })();
  const stopAudio = silent ? () => {} : tryPlaySting(volume, s);

  let settled = false;
  let outTimer = 0;
  let endTimer = 0;
  let resolveDone: () => void = () => {};

  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });

  const onGesture = (): void => {
    if (settled) return;
    // Fast-forward. A player who has seen the bumper two hundred times is out
    // of it in 190ms, and the promise still resolves through the same path.
    window.clearTimeout(outTimer);
    window.clearTimeout(endTimer);
    root.classList.add('cgb-ff', 'cgb-out');
    stopAudio();
    endTimer = window.setTimeout(settle, 190);
  };

  function settle(): void {
    if (settled) return;
    settled = true;
    window.clearTimeout(outTimer);
    window.clearTimeout(endTimer);
    stopAudio();
    root.removeEventListener('pointerdown', onGesture);
    window.removeEventListener('keydown', onGesture);
    root.remove();
    style.remove();
    document.documentElement.dataset.cgBumper = 'done';
    (window as unknown as { __cgBumper?: string }).__cgBumper = 'done';
    resolveDone();
    try {
      onDone?.();
    } catch {
      /* a throwing callback must not strand the game behind a dead overlay */
    }
  }

  outTimer = window.setTimeout(
    () => root.classList.add('cgb-out'),
    reduced ? 700 : T.out * s,
  );
  endTimer = window.setTimeout(settle, total + 60);

  root.addEventListener('pointerdown', onGesture, { once: true });
  window.addEventListener('keydown', onGesture, { once: true });

  (window as unknown as { __cgBumper?: string }).__cgBumper = 'playing';

  return { done, skip: onGesture };
}

export default mountBrandBumper;
