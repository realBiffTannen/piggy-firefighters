/** Pure contract and beat planning; no renderer, timers, or game-round promises. */
export type RigName = 'pf_chief' | 'pf_rookie' | 'pf_dog' | 'pf_rescued';
export type RigSlot = 'mascotLeft' | 'mascotRight' | 'cardPresenter' | 'rescueRoom' | 'ladder' | 'sheet' | 'winPlate';
export type MotionSettings = { speedTier: 0 | 1 | 2; reducedMotion: boolean };
export type LadderPath = { fromX: number; fromY: number; toX: number; toY: number };
export const RESCUED_SKINS = ['grandma', 'twins', 'dad', 'baby', 'teen'] as const;
export type RescuedSkin = typeof RESCUED_SKINS[number];
type Cell = { reel: number; row: number };
export type EmitterEventAnim = { type: 'animBeat' } & (
  | { beat: 'spinStart'; mode: string; speedTier: 0 | 1 | 2 }
  | { beat: 'reelStop'; reel: number; symbols: string[] }
  | { beat: 'alarmLand'; reel: number; row: number; count: number; golden: boolean }
  | { beat: 'anticipationStart'; reel: number; hit?: boolean }
  | { beat: 'anticipationEnd'; reel: number; hit: boolean }
  | { beat: 'lineWin'; lineIndex: number; amount: number; symbol: string; kind: string | number }
  | { beat: 'winTier'; tier: number; amount: number; x: number }
  | { beat: 'backdraft'; cells: Cell[] }
  | { beat: 'rescueEnter'; bonus: 'rescue' | 'inferno'; source: string; spins: number; rooms: unknown[] }
  | { beat: 'douse'; sprays: { reel: number; from: number; to: number }[]; rescues: { reel: number; skin: string | number; prize?: number }[]; multiplier: number; spinsAdded: number }
  | { beat: 'rescue'; reel: number; skin: string | number; prize?: number; multiplier: number }
  | { beat: 'buildingCleared'; building: number; spinsAdded: number }
  | { beat: 'rescueExit'; total: number; multiplier: number; rescued: number; buildings: number }
  | { beat: 'alarmCall'; outcome: string | { falseAlarm?: boolean; type?: string; [key: string]: unknown } }
  | { beat: 'bigWinStart' | 'bigWinEnd'; tier: number; amount: number }
  | { beat: 'maxWin'; amount: number }
  | { beat: 'idle'; seconds: number }
  | { beat: 'speedTier'; tier: 0 | 1 | 2 }
  | { beat: 'reducedMotion'; on: boolean }
);
export const RIG_DEFINITIONS = {
  pf_chief: { loop: 'idle', animations: ['idle','idle_alt','win','big_win','point_reels','spray_start','spray_loop','spray_end','celebrate','sad'], anchors: ['nozzle_tip','grip_l','grip_r','head_top'], events: ['step','spray_on','spray_off','sign_hit'] },
  pf_rookie: { loop: 'idle', animations: ['idle','fumble','card_flip','hold_sheet','catch','celebrate','sad'], anchors: ['sheet_l','sheet_r'], events: ['flip','catch'] },
  pf_dog: { loop: 'sit_idle', animations: ['sit_idle','bark','run_loop','celebrate','hold_sheet'], anchors: ['sheet_l','sheet_r'], events: ['bark'] },
  pf_rescued: { loop: 'wave_window', animations: ['wave_window','slide','land','cheer'], anchors: ['feet'], events: ['land'] },
} as const;

export function rescuedSkin(room: number, building: number): RescuedSkin {
  const index = ((Math.trunc(room) + Math.trunc(building)) % 5 + 5) % 5;
  return RESCUED_SKINS[index];
}
export function resolveSkin(skin: string | number | undefined, room = 0, building = 0): RescuedSkin {
  if (typeof skin === 'string' && RESCUED_SKINS.includes(skin as RescuedSkin)) return skin as RescuedSkin;
  return rescuedSkin(typeof skin === 'number' && Number.isFinite(skin) ? skin : room, typeof skin === 'number' ? 0 : building);
}
export const motionTimeScale = (settings: MotionSettings) => settings.reducedMotion ? 0 : settings.speedTier === 1 ? 1.5 : 1;
export const defaultLoop = (rig: RigName, slot: RigSlot) => slot === 'sheet' ? 'hold_sheet' : RIG_DEFINITIONS[rig].loop;
export type ClipStep = { animation: string; loop: boolean; holdSeconds?: number };
export type BeatPlan = { steps: ClipStep[]; travel?: boolean; skin?: RescuedSkin; visible?: boolean };
const once = (animation: string): ClipStep => ({ animation, loop: false });
const loop = (animation: string): ClipStep => ({ animation, loop: true });

export function planBeat(rig: RigName, slot: RigSlot, event: EmitterEventAnim, settings: MotionSettings, index = 0): BeatPlan | null {
  const rest = defaultLoop(rig, slot);
  const finish = (clips: ClipStep[], extra: Partial<BeatPlan> = {}): BeatPlan => ({
    steps: settings.reducedMotion || settings.speedTier === 2 ? [loop(rest)] : [...clips, loop(rest)],
    ...extra,
    travel: Boolean(extra.travel) && !settings.reducedMotion && settings.speedTier !== 2,
  });
  switch (event.beat) {
    case 'spinStart': return { steps: [loop(rest)], ...(slot === 'rescueRoom' ? {} : { visible: slot !== 'ladder' && slot !== 'winPlate' }) };
    case 'speedTier': case 'reducedMotion': return { steps: [loop(rest)] };
    case 'alarmLand': return rig === 'pf_chief' ? finish([once('point_reels')]) : null;
    case 'anticipationStart': return rig === 'pf_dog' ? finish([once('bark')]) : null;
    case 'winTier': return rig === 'pf_chief' && event.tier > 0 ? finish([once(event.tier > 1 ? 'big_win' : 'win')]) : null;
    case 'douse': return rig === 'pf_chief' && event.sprays.length > 0 ? finish([once('spray_start'), { ...loop('spray_loop'), holdSeconds: 0.8 }, once('spray_end')]) : null;
    case 'rescue':
      if (rig === 'pf_rescued' && (slot === 'ladder' || index === event.reel)) {
        if (slot === 'rescueRoom') return { steps: [loop('wave_window')], visible: false };
        return finish([once('slide'), once('land')], { travel: true, skin: resolveSkin(event.skin, event.reel), visible: true });
      }
      // Sheet performers remain holding until the ladder actor actually arrives.
      return null;
    case 'rescueEnter': return rig === 'pf_rescued' ? { steps: [loop(rest)], skin: rescuedSkin(index, 0), visible: slot !== 'ladder' } : null;
    case 'buildingCleared':
      if (rig === 'pf_rescued') return { steps: [loop(rest)], skin: rescuedSkin(index, event.building), visible: slot !== 'ladder' };
      return finish([once('celebrate')]);
    case 'rescueExit': return { steps: [loop(rest)], visible: slot !== 'ladder' && slot !== 'winPlate' };
    case 'alarmCall': {
      const falseAlarm = typeof event.outcome === 'string' ? /^(falseAlarm|false_alarm|false-alarm)$/.test(event.outcome) : event.outcome.falseAlarm === true || event.outcome.type === 'falseAlarm';
      return rig === 'pf_rookie' ? finish([once(falseAlarm ? 'sad' : 'card_flip')]) : rig === 'pf_chief' && falseAlarm ? finish([once('sad')]) : null;
    }
    case 'bigWinStart': return slot === 'winPlate' && event.tier >= 2 ? finish([once('big_win')], { visible: true }) : null;
    case 'bigWinEnd': return slot === 'winPlate' ? { steps: [loop(rest)], visible: false } : null;
    case 'maxWin': return rig === 'pf_chief' ? finish([once('celebrate')]) : null;
    case 'idle': return rig === 'pf_chief' ? finish([{ ...loop('idle_alt'), holdSeconds: 5 }]) : rig === 'pf_rookie' && slot !== 'sheet' ? finish([once('fumble')]) : null;
    default: return null;
  }
}

/** Sheet reactions start at the ladder arrival, never at the rescue departure. */
export function planLanding(rig: RigName, settings: MotionSettings): BeatPlan | null {
  if (rig !== 'pf_rookie' && rig !== 'pf_dog') return null;
  const rest = loop('hold_sheet');
  return { steps: settings.reducedMotion || settings.speedTier === 2
    ? [rest] : [once(rig === 'pf_rookie' ? 'catch' : 'celebrate'), rest] };
}

/** Completion callbacks from an interrupted clip cannot advance its replacement. */
export function createPlaybackEpoch() {
  let epoch = 0;
  let disposed = false;
  return { begin: () => ++epoch, isCurrent: (value: number) => !disposed && value === epoch, dispose: () => { disposed = true; epoch++; } };
}

/** Runtime safety check; the authored-export checker remains the stronger acceptance gate. */
export function isUsableRigData(rig: RigName, value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const data = value as { version?: string; width?: number; height?: number; animations?: { name: string; duration: number; timelines: unknown[] }[]; bones?: { name: string }[]; events?: { name: string }[]; skins?: { name: string }[]; findAnimation?: unknown; findBone?: unknown; findSkin?: unknown };
  if (typeof data.version !== 'string' || !data.version.startsWith('4.2.') || !(Number(data.width) > 0) || !(Number(data.height) > 0)) return false;
  if (typeof data.findAnimation !== 'function' || typeof data.findBone !== 'function' || typeof data.findSkin !== 'function') return false;
  if (![data.animations, data.bones, data.events, data.skins].every(Array.isArray)) return false;
  const definition = RIG_DEFINITIONS[rig];
  return definition.animations.every(name => data.animations?.some(clip => clip?.name === name && clip.duration > 0 && Array.isArray(clip.timelines) && clip.timelines.length > 0))
    && definition.anchors.every(name => data.bones?.some(bone => bone?.name === name))
    && definition.events.every(name => data.events?.some(event => event?.name === name))
    && (rig !== 'pf_rescued' || RESCUED_SKINS.every(name => data.skins?.some(skin => skin?.name === name)));
}
