import { createRequire } from 'node:module';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const app = path.join(root, 'apps/piggy_firefighters');
const requireApp = createRequire(path.join(app, 'package.json'));
const dep = readdirSync(path.join(root, 'node_modules/.pnpm'))
  .find(name => name.startsWith('svelte2tsx@') && name.includes('svelte@5.20.5'));
if (!dep) throw new Error('Existing Svelte/TypeScript tools are not installed');
const requireTools = createRequire(path.join(root, 'node_modules/.pnpm', dep, 'node_modules/svelte2tsx/package.json'));
const ts = requireTools('typescript');
const manager = path.join(app, 'src/game/audio/audioManager.ts');
const manifest = path.join(app, 'src/game/audio/cueManifest.ts');
const vite = path.join(path.dirname(requireApp.resolve('vite/package.json')), 'client.d.ts');
const kit = path.join(path.dirname(requireApp.resolve('@sveltejs/kit/package.json')), 'types/index.d.ts');
const program = ts.createProgram([manager, manifest, vite, kit], {
  strict: true, noEmit: true, skipLibCheck: true, types: [],
  target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
});
const diagnostics = ts.getPreEmitDiagnostics(program);
if (diagnostics.length) {
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCurrentDirectory: () => root, getCanonicalFileName: file => file, getNewLine: () => '\n',
  }));
  process.exitCode = 1;
} else console.log('PASS: audioManager and cueManifest TypeScript; installed HUD, SvelteKit and Vite declarations.');
