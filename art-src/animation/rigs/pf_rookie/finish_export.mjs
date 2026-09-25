/** Preserve native exports; derive the CLI's omitted setup AABB from the actual export + atlas.
 *  Rookie variant of pf_chief/finish_export.mjs: the rig mixes region and mesh attachments, so the
 *  skeleton is loaded through AtlasAttachmentLoader over the real exported atlas (pages get a
 *  size-only stand-in texture; no pixels are read). Only skeleton x/y/width/height are added. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { SkeletonJson, Skeleton, Vector2, Physics, TextureAtlas, AtlasAttachmentLoader } from
  '../../../../packages/pixi-svelte/node_modules/@esotericsoftware/spine-core/dist/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(process.argv[2] ?? '');
const target = path.resolve(process.argv[3] ?? '');
if (!source.startsWith(here + path.sep) || !target.startsWith(here + path.sep) || source === target)
  throw new Error('Pass distinct source/target folders inside the Rookie authoring directory');
const rawBytes = await fs.readFile(path.join(source, 'pf_rookie.json'));
const raw = JSON.parse(rawBytes);
if (raw.skeleton.spine !== '4.2.43') throw new Error('Require actual pinned 4.2.43 native export');
const atlasText = await fs.readFile(path.join(source, 'pf_rookie.atlas'), 'utf8');
const atlas = new TextureAtlas(atlasText);
for (const page of atlas.pages) {
  const standIn = { width: page.width, height: page.height, setFilters() {}, setWraps() {}, dispose() {},
    getImage() { return { width: page.width, height: page.height }; } };
  page.setTexture(standIn);
}
const data = new SkeletonJson(new AtlasAttachmentLoader(atlas)).readSkeletonData(raw);
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
await fs.writeFile(path.join(target, 'pf_rookie.json'), JSON.stringify(raw, null, 2) + '\n');
const atlasLines = atlasText.split(/\r?\n/);
const pages = atlasLines.filter((line, index) => line.endsWith('.png') && /^size\s*:/.test(atlasLines[index + 1] ?? ''));
if (!pages.length || pages.some(name => path.basename(name) !== name)) throw new Error('Unexpected native atlas page paths');
for (const name of ['pf_rookie.atlas', ...pages]) await fs.copyFile(path.join(source, name), path.join(target, name));
const derivation = {
  status: 'FULL_RIG_UNREVIEWED', nativeExportSha256: createHash('sha256').update(rawBytes).digest('hex'),
  runtime: 'spine-core4.2.74', method: 'AtlasAttachmentLoader over the exported atlas; Skeleton.setToSetupPose; updateWorldTransform(Physics.update); getBounds',
  bounds, pages, change: 'Only skeleton x/y/width/height header values; original native export preserved',
};
await fs.writeFile(path.join(target, 'bounds-provenance.json'), JSON.stringify(derivation, null, 2) + '\n');
const sourceRecord = JSON.parse(await fs.readFile(path.join(source, '..', '..', 'source-record.json'), 'utf8'));
sourceRecord.runtime_export = derivation;
await fs.writeFile(path.join(target, 'source-record.json'), JSON.stringify(sourceRecord, null, 2) + '\n');
console.log(JSON.stringify({ target, bounds, pages }));
