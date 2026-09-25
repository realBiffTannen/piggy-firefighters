export * from './components/index';
export * from './utils.svelte';
export * from './types';
export * from './createApp.svelte';
export * from './context.svelte';
// Raw PIXI for app code that builds display trees imperatively (apps do not depend on pixi.js
// directly under pnpm's strict layout; this keeps ONE module instance).
export * as PIXI from 'pixi.js';
