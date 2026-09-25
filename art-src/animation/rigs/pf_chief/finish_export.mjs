/** Preserve native exports; derive missing CLI AABB metadata from their actual setup geometry. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { SkeletonJson, Skeleton, MeshAttachment, Vector2, Physics } from
  '../../../../packages/pixi-svelte/node_modules/@esotericsoftware/spine-core/dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(process.argv[2] ?? '');
const target = path.resolve(process.argv[3] ?? '');
if (!source.startsWith(here + path.sep) || !target.startsWith(here + path.sep) || source === target)
  throw new Error('Pass distinct source/target folders inside the Chief authoring directory');
const rawBytes = await fs.readFile(path.join(source, 'pf_chief.json'));
const raw = JSON.parse(rawBytes);
if (raw.skeleton.spine !== '4.2.43') throw new Error('Require actual pinned4.2.43 native export');
const loader = { newMeshAttachment: (_skin, name) => new MeshAttachment(name) };
const data = new SkeletonJson(loader).readSkeletonData(raw);
const skeleton = new Skeleton(data);
skeleton.setToSetupPose();
skeleton.updateWorldTransform(Physics.update);
const offset = new Vector2(), size = new Vector2();
skeleton.getBounds(offset, size, []);
if (![offset.x, offset.y, size.x, size.y].every(Number.isFinite) || size.x <= 0 || size.y <= 0)
  throw new Error('Actual setup geometry has invalid bounds');
const bounds = { x: offset.x, y: offset.y, width: size.x, height: size.y };
raw.skeleton = { ...raw.skeleton, ...bounds };
await fs.mkdir(target); // A fresh output, never an edited native/export overwrite.
await fs.writeFile(path.join(target, 'pf_chief.json'), JSON.stringify(raw, null, 2) + '\n');
const atlasText = await fs.readFile(path.join(source, 'pf_chief.atlas'), 'utf8');
const atlasLines = atlasText.split(/\r?\n/);
const pages = atlasLines.filter((line, index) => line.endsWith('.png') && /^size\s*:/.test(atlasLines[index + 1] ?? ''));
if (!pages.length || pages.some(name => path.basename(name) !== name)) throw new Error('Unexpected native atlas page paths');
for (const name of ['pf_chief.atlas', ...pages]) await fs.copyFile(path.join(source, name), path.join(target, name));
const sourceRecord = JSON.parse(await fs.readFile(path.join(source, '..', 'source-record.json'), 'utf8'));
const derivation = {
  status: sourceRecord.status ?? 'UNREVIEWED', nativeExportSha256: createHash('sha256').update(rawBytes).digest('hex'),
  runtime: 'spine-core4.2.74', method: 'Skeleton.setToSetupPose; updateWorldTransform(Physics.update); getBounds',
  bounds, change: 'Only skeleton x/y/width/height header values; original native export preserved',
};
await fs.writeFile(path.join(target, 'bounds-provenance.json'), JSON.stringify(derivation, null, 2) + '\n');
sourceRecord.runtime_export = derivation;
await fs.writeFile(path.join(target, 'source-record.json'), JSON.stringify(sourceRecord, null, 2) + '\n');
console.log(JSON.stringify({ target, bounds }));
