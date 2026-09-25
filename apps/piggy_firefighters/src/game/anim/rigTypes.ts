import type { RigName, RigSlot, LadderPath, RescuedSkin } from './rigLogic';
export type RigHandle = {
  rig: RigName;
  getBoneWorldPosition: (name: string) => { x: number; y: number } | null;
};
export type RigAnimationEvent = {
  rig: RigName;
  slot: RigSlot;
  index: number;
  name: string;
  /** Snapshot of every required anchor in Pixi global coordinates, at the event. */
  anchors: Record<string, { x: number; y: number }>;
};
export type RigActorProps = {
  rig: RigName;
  slot: RigSlot;
  index?: number;
  x?: number;
  y?: number;
  scale?: number;
  reducedMotion?: boolean;
  speedTier?: 0 | 1 | 2;
  skin?: RescuedSkin;
  path?: LadderPath;
  onready?: (handle: RigHandle) => void;
  ondispose?: (rig: RigName, index: number) => void;
  onrigEvent?: (event: RigAnimationEvent) => void;
};
