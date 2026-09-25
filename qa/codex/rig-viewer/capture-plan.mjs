import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { RIG_DEFINITIONS, RESCUED_SKINS } from '../../../apps/piggy_firefighters/src/game/anim/rigLogic.ts';

export const RIGS = ['pf_chief', 'pf_rookie', 'pf_dog', 'pf_rescued'];
export const FRAMES = {
  desktop: { viewport: { width: 1360, height: 1000 }, logical: { width: 920, height: 600 }, scale: 1 },
  mobile: { viewport: { width: 390, height: 844 }, logical: { width: 360, height: 480 }, scale: 0.5 },
};
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Inspect only the named runtime export and the texture pages its atlas declares. */
export async function inspectRig(root, rig) {
  assert(RIGS.includes(rig), `Unknown rig: ${rig}`);
  const dir = path.resolve(root, rig);
  let jsonBytes, atlasBytes;
  try {
    [jsonBytes, atlasBytes] = await Promise.all([
      readFile(path.join(dir, `${rig}.json`)), readFile(path.join(dir, `${rig}.atlas`)),
    ]);
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const data = JSON.parse(jsonBytes);
  assert(/^4\.2(?:\.|$)/.test(data.skeleton?.spine ?? ''), `${rig}: expected Spine 4.2 export`);
  const clips = Object.keys(data.animations ?? {});
  const skins = Array.isArray(data.skins) ? data.skins.map(skin => skin.name) : Object.keys(data.skins ?? {});
  assert(clips.length && skins.length, `${rig}: export has no declared clips/skins`);
  const definition = RIG_DEFINITIONS[rig];
  const bones = (data.bones ?? []).map(bone => bone.name);
  const events = Object.keys(data.events ?? {});
  const requiredSkins = rig === 'pf_rescued' ? [...RESCUED_SKINS] : [];
  const contractCoverage = {
    requiredClips: [...definition.animations], missingClips: definition.animations.filter(name => !clips.includes(name)),
    requiredAnchors: [...definition.anchors], missingAnchors: definition.anchors.filter(name => !bones.includes(name)),
    requiredEvents: [...definition.events], missingEvents: definition.events.filter(name => !events.includes(name)),
    requiredSkins, missingSkins: requiredSkins.filter(name => !skins.includes(name)),
    note: 'Declaration coverage only; timelines, contacts and authored motion require separate review',
  };
  const pages = atlasBytes.toString('utf8').trim().split(/\r?\n\s*\r?\n/).map(block => block.split(/\r?\n/)[0].trim());
  assert(pages.length && pages.every(page => /\.png$/i.test(page)), `${rig}: atlas needs PNG pages`);
  const inputs = [[`${rig}.json`, jsonBytes], [`${rig}.atlas`, atlasBytes]];
  for (const page of new Set(pages)) {
    const file = path.resolve(dir, page);
    assert(!path.isAbsolute(page) && !page.includes('\\') && file.startsWith(dir + path.sep), `Unsafe atlas page outside export: ${page}`);
    const bytes = await readFile(file);
    assert(bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), `${rig}: invalid PNG page ${page}`);
    inputs.push([page, bytes]);
  }
  return { rig, spineVersion: data.skeleton.spine, clips, skins, contractCoverage,
    files: inputs.map(([name, bytes]) => ({ path: `${rig}/${name}`, bytes: bytes.length, sha256: sha256(bytes) })) };
}

export function planCases(rig, clips, skins, frames) {
  assert(clips.length && skins.length, 'No loaded clips or skins');
  const result = [];
  for (const frame of frames) {
    assert(FRAMES[frame], `Unknown frame: ${frame}`);
    for (const speed of [1, 0.25]) for (const skin of skins) for (const clip of clips) {
      assert(Number.isFinite(clip.duration) && clip.duration > 0 && clip.duration <= 60, `Invalid or unbounded clip duration: ${clip.name}`);
      const cycles = clip.loop ? 2 : 1;
      result.push({ key: JSON.stringify([rig, frame, speed, skin, clip.name]), rig, frame, speed, skin,
        clip: clip.name, duration: clip.duration, loop: clip.loop, cycles, playMs: Math.ceil(clip.duration * cycles / speed * 1000) });
    }
  }
  return result;
}

export function verifyServed(files, responses) {
  for (const file of files) {
    const matches = responses.filter(response => response.path === file.path);
    assert(matches.length, `Runtime export not fetched: ${file.path}`);
    assert(matches.every(response => response.sha256 === file.sha256 && response.bytes === file.bytes), `Runtime/disk export mismatch or changed bytes: ${file.path}`);
  }
}

/** Bind completion to one new PLAY row; older loops and prefix matches do not count. */
export function playbackEvidence(rows, { clip, skin, loop, afterId = -1, playId }) {
  const playText = `PLAY ${clip} · ${skin} · ${loop ? 'loop' : 'once'}`;
  if (playId === undefined) {
    const starts = rows.filter(row => row.id > afterId && row.text === playText);
    if (!starts.length) return null;
    playId = Math.max(...starts.map(row => row.id));
  }
  const later = rows.filter(row => row.id > playId);
  return { playId, boundaries: later.filter(row => row.text === `${loop ? 'LOOP' : 'COMPLETE'} ${clip}`).length,
    interrupted: later.some(row => row.text.startsWith('PLAY ')),
    rows: rows.filter(row => row.id >= playId) };
}

export function captureStatus({ expected, completed, missing, errors }) {
  if (errors.length || completed !== expected) return 'FAIL';
  if (!expected || missing.length) return 'BLOCKED';
  return 'CAPTURED';
}
