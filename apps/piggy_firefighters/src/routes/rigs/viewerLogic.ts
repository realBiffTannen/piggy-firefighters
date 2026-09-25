import type { RigName } from '../../game/anim/rigLogic';

export const RIG_NAMES: RigName[] = ['pf_chief', 'pf_rookie', 'pf_dog', 'pf_rescued'];
export const REFERENCE_HEIGHT: Record<RigName, number> = { pf_chief: 420, pf_rookie: 380, pf_dog: 220, pf_rescued: 260 };
export type PreviewMode = 'desktop' | 'mobile';
export type ViewerLog = { id: number; text: string };
export type RigInfo = { clips: { name: string; duration: number }[]; skins: string[]; version: string; width: number; height: number;
  pilotOnly?: boolean; missingClips?: string[] };

/** Authoring only: a partial set of real clips may be reviewed before extending
 * the performance. Gameplay continues to require isUsableRigData's full contract. */
export function isUsablePilotRigData(value: unknown, required: {
  anchors: readonly string[]; events: readonly string[]; skins?: readonly string[];
}): boolean {
  if (!value || typeof value !== 'object') return false;
  const data = value as { version?: string; width?: number; height?: number;
    animations?: { name: string; duration: number; timelines: unknown[] }[];
    bones?: { name: string; parent?: unknown; x?: number; y?: number; rotation?: number; scaleX?: number; scaleY?: number; shearX?: number; shearY?: number }[];
    events?: { name: string }[]; skins?: { name: string }[];
    findAnimation?: unknown; findBone?: unknown; findSkin?: unknown };
  if (typeof data.version !== 'string' || !data.version.startsWith('4.2.') || !Number.isFinite(data.width) || !Number.isFinite(data.height)
    || !(Number(data.width) > 0) || !(Number(data.height) > 0)) return false;
  if (![data.findAnimation, data.findBone, data.findSkin].every(fn => typeof fn === 'function')) return false;
  if (![data.animations, data.bones, data.events, data.skins].every(Array.isArray)) return false;
  const root = data.bones?.[0];
  if (!root || root.name !== 'root' || root.parent != null) return false;
  if ((['x', 'y', 'rotation', 'shearX', 'shearY'] as const).some(key => (root[key] ?? 0) !== 0)
    || (root.scaleX ?? 1) !== 1 || (root.scaleY ?? 1) !== 1) return false;
  return !!data.animations?.length && data.animations.every(clip => typeof clip.name === 'string'
    && clip.name.length > 0 && Number.isFinite(clip.duration) && clip.duration > 0
    && Array.isArray(clip.timelines) && clip.timelines.length > 0)
    && required.anchors.every(name => data.bones?.some(bone => bone.name === name))
    && required.events.every(name => data.events?.some(event => event.name === name))
    && !!data.skins?.length && (required.skins ?? []).every(name => data.skins?.some(skin => skin.name === name));
}

export const availableRigNames = (assets: Record<string, unknown>): RigName[] => RIG_NAMES.filter(name => name in assets);
export const isLoopClip = (name: string) => ['idle', 'idle_alt', 'sit_idle', 'run_loop', 'spray_loop', 'hold_sheet', 'wave_window', 'cheer'].includes(name);
export const appendLog = (rows: ViewerLog[], entry: ViewerLog): ViewerLog[] => [entry, ...rows].slice(0, 60);
export const previewFrame = (mode: PreviewMode) => mode === 'mobile'
  ? { width: 360, height: 480, scale: 0.5 }
  : { width: 920, height: 600, scale: 1 };
