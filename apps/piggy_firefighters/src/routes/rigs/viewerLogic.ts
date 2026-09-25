import type { RigName } from '../../game/anim/rigLogic';

export const RIG_NAMES: RigName[] = ['pf_chief', 'pf_rookie', 'pf_dog', 'pf_rescued'];
export const REFERENCE_HEIGHT: Record<RigName, number> = { pf_chief: 420, pf_rookie: 380, pf_dog: 220, pf_rescued: 260 };
export type PreviewMode = 'desktop' | 'mobile';
export type ViewerLog = { id: number; text: string };
export type RigInfo = { clips: { name: string; duration: number }[]; skins: string[]; version: string; width: number; height: number };

export const availableRigNames = (assets: Record<string, unknown>): RigName[] => RIG_NAMES.filter(name => name in assets);
export const isLoopClip = (name: string) => ['idle', 'idle_alt', 'sit_idle', 'run_loop', 'spray_loop', 'hold_sheet', 'wave_window', 'cheer'].includes(name);
export const appendLog = (rows: ViewerLog[], entry: ViewerLog): ViewerLog[] => [entry, ...rows].slice(0, 60);
export const previewFrame = (mode: PreviewMode) => mode === 'mobile'
  ? { width: 360, height: 480, scale: 0.5 }
  : { width: 920, height: 600, scale: 1 };
