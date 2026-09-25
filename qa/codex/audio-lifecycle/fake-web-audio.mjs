// Web Audio boundary only: the manager itself is bundled unchanged and exercised through its API.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const requireApp = createRequire(path.join(root, 'apps/piggy_firefighters/package.json'));
const requireVite = createRequire(requireApp.resolve('vite/package.json'));
const { build } = requireVite('esbuild');
const audioPath = path.join(root, 'apps/piggy_firefighters/src/game/audio');
const managerBundle = await build({
  entryPoints: [path.join(audioPath, 'audioManager.ts')], bundle: true, write: false,
  format: 'cjs', platform: 'node', target: 'node22',
  external: ['$app/paths', './cueManifest'], define: { 'import.meta.env.DEV': 'false' },
});

const cue = (id, overrides = {}) => ({
  id, bus: 'sfx', files: [`audio/${id}.ogg`, `audio/${id}.m4a`], gain: 0.5,
  durationMs: 30000, priority: 9, maxInstances: 1, cooldownMs: 0, loop: false,
  ...overrides,
});
const music = (id, tempoBpm = 92, overrides = {}) => cue(id, {
  bus: 'music', loop: true, durationMs: 84000, loopStartMs: 60,
  loopEndMs: 60 + (tempoBpm === 92 ? 32 * 4 * 60000 / 92 : 76800), tempoBpm,
  ...overrides,
});
export const fixtureCues = {
  base_loop_a: music('base_loop_a'), base_loop_b: music('base_loop_b'),
  rescue_loop: music('rescue_loop', 100), inferno_loop: music('inferno_loop', 100),
  layer_fixture: music('layer_fixture'),
  ambient_station_loop: cue('ambient_station_loop', { loop: true }),
  loop_fixture: cue('loop_fixture', { loop: true }),
  held_fixture: cue('held_fixture'), one_fixture: cue('one_fixture'),
  other_fixture: cue('other_fixture'), cooldown_fixture: cue('cooldown_fixture', { cooldownMs: 100 }),
};
const MIX = { duckDb: [3, 6], duckAttackMs: [40, 80], duckReleaseMs: [250, 500] };

class Param {
  value = 1;
  calls = [];
  cancelScheduledValues(...args) { this.calls.push(['cancel', ...args]); }
  setValueAtTime(value, time) { this.value = value; this.calls.push(['set', value, time]); }
  setTargetAtTime(value, ...args) { this.value = value; this.calls.push(['target', value, ...args]); }
  linearRampToValueAtTime(value, time) { this.value = value; this.calls.push(['linear', value, time]); }
  exponentialRampToValueAtTime(value, time) { this.value = value; this.calls.push(['exponential', value, time]); }
  setValueCurveAtTime(curve, ...args) { this.value = curve.at(-1); this.calls.push(['curve', Array.from(curve), ...args]); }
}
class Node {
  connections = [];
  disconnected = false;
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.disconnected = true; }
}
class Source extends Node {
  playbackRate = new Param();
  startCalls = [];
  stopCalls = [];
  listeners = [];
  onended = null;
  start(...args) { this.startCalls.push(args); }
  stop(...args) { this.stopCalls.push(args); }
  addEventListener(type, callback) { if (type === 'ended') this.listeners.push(callback); }
  emitEnded() { this.onended?.(); for (const callback of this.listeners) callback(); }
}

export async function loadRealManifest() {
  const result = await build({ entryPoints: [path.join(audioPath, 'cueManifest.ts')], write: false, format: 'cjs', platform: 'node' });
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports });
  return module.exports;
}

export function createHarness() {
  let clockMs = 1000;
  let audioSeconds = 10;
  const sources = [], contexts = [], fetches = [], pending = new Map(), timers = new Map();
  let nextTimer = 0;
  class AudioContext {
    state = 'running';
    destination = new Node();
    constructor() { contexts.push(this); }
    get currentTime() { return audioSeconds; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    createGain() { const node = new Node(); node.gain = new Param(); return node; }
    createDynamicsCompressor() {
      const node = new Node();
      for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release']) node[key] = new Param();
      return node;
    }
    createBufferSource() { const source = new Source(); sources.push(source); return source; }
    decodeAudioData(bytes) {
      const id = new TextDecoder().decode(bytes);
      return new Promise((resolve, reject) => {
        if (pending.has(id)) throw new Error(`unexpected concurrent decode: ${id}`);
        pending.set(id, { resolve, reject });
      });
    }
  }
  const module = { exports: {} };
  const storage = new Map();
  const documentListeners = new Map();
  const document = {
    hidden: false,
    createElement: () => ({ canPlayType: () => '' }),
    addEventListener(type, callback) {
      const callbacks = documentListeners.get(type) ?? [];
      callbacks.push(callback); documentListeners.set(type, callbacks);
    },
  };
  const sandbox = {
    module, exports: module.exports, console,
    require(id) {
      if (id === '$app/paths') return { base: '' };
      if (id === './cueManifest') return { CUES: fixtureCues, MIX };
      throw new Error(`unexpected runtime import ${id}`);
    },
    window: { AudioContext }, performance: { now: () => clockMs },
    document,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    fetch: async url => {
      const id = path.basename(url).replace(/\.(ogg|m4a)$/, '');
      if (!fixtureCues[id]) throw new Error(`unexpected cue fetch ${id}`);
      fetches.push(id);
      return { ok: true, arrayBuffer: async () => new TextEncoder().encode(id).buffer };
    },
    setTimeout(callback, delay = 0) { const id = ++nextTimer; timers.set(id, { callback, due: clockMs + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  vm.runInNewContext(managerBundle.outputFiles[0].text, sandbox, { filename: 'production-audioManager.cjs' });
  const manager = module.exports.audioManager;
  const settle = async () => { await new Promise(resolve => setImmediate(resolve)); };
  const resolve = async id => {
    await settle();
    const item = pending.get(id);
    if (!item) throw new Error(`no pending decode for ${id}`);
    pending.delete(id);
    item.resolve({ id, duration: fixtureCues[id].durationMs / 1000, sampleRate: 48000, numberOfChannels: 2 });
    await settle();
  };
  return {
    manager, sources, contexts, fetches, pending, settle, resolve,
    sourcesFor: id => sources.filter(source => source.buffer?.id === id && source.startCalls.length),
    advance(ms) { clockMs += ms; audioSeconds += ms / 1000; },
    advanceWall(ms) { clockMs += ms; },
    setHidden(hidden) {
      document.hidden = hidden;
      for (const callback of documentListeners.get('visibilitychange') ?? []) callback();
    },
    get audioTime() { return audioSeconds; },
    async runTimers() {
      for (const [id, timer] of [...timers]) { timers.delete(id); timer.callback(); }
      await settle();
    },
    async unlock() {
      const promise = manager.unlock();
      await settle();
      if (pending.has('base_loop_a')) await resolve('base_loop_a');
      await promise;
      await settle();
    },
    async decode(...ids) {
      const promise = manager.ensureDecoded(ids);
      await settle();
      for (const id of ids) if (pending.has(id)) await resolve(id);
      await promise;
    },
  };
}
