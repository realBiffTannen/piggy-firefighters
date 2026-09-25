/** Preserve the native pf_rescued export; derive the CLI-omitted setup AABB from the five skins. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { SkeletonJson, Skeleton, MeshAttachment, Vector2, Physics } from
  '../../../../packages/pixi-svelte/node_modules/@esotericsoftware/spine-core/dist/index.js';

const RIG = 'pf_rescued';
const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(process.argv[2] ?? '');
const target = path.resolve(process.argv[3] ?? '');
if (!source.startsWith(here + path.sep) || !target.startsWith(here + path.sep) || source === target)
  throw new Error('Pass distinct source/target folders inside the pf_rescued authoring directory');
const rawBytes = await fs.readFile(path.join(source, `${RIG}.json`));
const raw = JSON.parse(rawBytes);
if (raw.skeleton.spine !== '4.2.43') throw new Error('Require actual pinned 4.2.43 native export');
const loader = { newMeshAttachment: (_skin, name) => new MeshAttachment(name) };
const data = new SkeletonJson(loader).readSkeletonData(raw);
const skeleton = new Skeleton(data);
const offset = new Vector2(), size = new Vector2();
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
const perSkin = {};
for (const skin of data.skins) {
  if (skin.name === 'default') continue;
  skeleton.setSkin(skin);
  skeleton.setToSetupPose();
  skeleton.updateWorldTransform(Physics.update);
  skeleton.getBounds(offset, size, []);
  if (![offset.x, offset.y, size.x, size.y].every(Number.isFinite) || size.x <= 0 || size.y <= 0)
    throw new Error(`Skin ${skin.name} has invalid setup bounds`);
  perSkin[skin.name] = { x: offset.x, y: offset.y, width: size.x, height: size.y };
  minX = Math.min(minX, offset.x); minY = Math.min(minY, offset.y);
  maxX = Math.max(maxX, offset.x + size.x); maxY = Math.max(maxY, offset.y + size.y);
}
if (!Object.keys(perSkin).length) throw new Error('No named skins in the export');
const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
raw.skeleton = { ...raw.skeleton, ...bounds };
await fs.mkdir(target); // A fresh output, never an edited native/export overwrite.
await fs.writeFile(path.join(target, `${RIG}.json`), JSON.stringify(raw, null, 2) + '\n');
const atlasText = await fs.readFile(path.join(source, `${RIG}.atlas`), 'utf8');
const atlasLines = atlasText.split(/\r?\n/);
const pages = atlasLines.filter((line, index) => line.endsWith('.png') && /^size\s*:/.test(atlasLines[index + 1] ?? ''));
if (!pages.length || pages.some(name => path.basename(name) !== name)) throw new Error('Unexpected native atlas page paths');
for (const name of [`${RIG}.atlas`, ...pages]) await fs.copyFile(path.join(source, name), path.join(target, name));
const sourceRecord = JSON.parse(await fs.readFile(path.join(source, '..', 'source-record.json'), 'utf8'));
const derivation = {
  status: sourceRecord.status ?? 'UNREVIEWED', nativeExportSha256: createHash('sha256').update(rawBytes).digest('hex'),
  runtime: 'spine-core4.2.74', method: 'per skin: Skeleton.setSkin; setToSetupPose; updateWorldTransform(Physics.update); getBounds; union of the five',
  bounds, perSkin, pages, change: 'Only skeleton x/y/width/height header values; original native export preserved',
};
await fs.writeFile(path.join(target, 'bounds-provenance.json'), JSON.stringify(derivation, null, 2) + '\n');
sourceRecord.runtime_export = derivation;
await fs.writeFile(path.join(target, 'source-record.json'), JSON.stringify(sourceRecord, null, 2) + '\n');
console.log(JSON.stringify({ target, bounds, pages }));
