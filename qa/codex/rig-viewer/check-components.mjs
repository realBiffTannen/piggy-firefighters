import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const requireApp = createRequire(path.join(root,'apps/piggy_firefighters/package.json'));
const {compile} = requireApp('svelte/compiler');
const dep = readdirSync(path.join(root,'node_modules/.pnpm')).find(n=>n.startsWith('svelte2tsx@') && n.includes('svelte@5.20.5'));
const requireTools = createRequire(path.join(root,'node_modules/.pnpm',dep,'node_modules/svelte2tsx/package.json'));
const {svelte2tsx} = requireTools('svelte2tsx');
const ts = requireTools('typescript');
const directories = ['apps/piggy_firefighters/src/routes/rigs'];
const ownFiles = directories.flatMap(d=>readdirSync(d).filter(n=>/\.(ts|svelte)$/.test(n)).map(n=>path.resolve(d,n)));
const virtual = new Map();
for (const file of ownFiles.filter(n=>n.endsWith('.svelte'))) {
 const source=readFileSync(file,'utf8');
 const {warnings}=compile(source,{filename:file,generate:'client',dev:true});
 if (warnings.length) throw new Error(`${file}: ${warnings.map(w=>w.message).join('\n')}`);
 virtual.set(file+'.tsx',svelte2tsx(source,{filename:file,isTsFile:true}).code);
}
const options={strict:true,noEmit:true,skipLibCheck:true,target:ts.ScriptTarget.ESNext,module:ts.ModuleKind.ESNext,moduleResolution:ts.ModuleResolutionKind.Bundler,allowSyntheticDefaultImports:true,esModuleInterop:true,jsx:ts.JsxEmit.Preserve,types:['svelte'],typeRoots:[path.join(root,'apps/piggy_firefighters/node_modules')],baseUrl:root};
const host=ts.createCompilerHost(options);
const oldRead=host.readFile, oldExists=host.fileExists;
host.readFile=file=>virtual.get(file)??oldRead(file);
host.fileExists=file=>virtual.has(file)||oldExists(file);
host.resolveModuleNames=(names,containing)=>names.map(name=> {
 const resolved=ts.resolveModuleName(name,containing,options,host).resolvedModule;
 if (name.endsWith('.svelte') && name.startsWith('.')) {
  const target=path.resolve(path.dirname(containing),name)+'.tsx';
  if(virtual.has(target)) return {resolvedFileName:target,extension:ts.Extension.Tsx};
 }
 return resolved;
});
const shim=requireTools.resolve('svelte2tsx/svelte-shims-v4.d.ts');
const jsx=requireTools.resolve('svelte2tsx/svelte-jsx-v4.d.ts');
const vite=path.join(path.dirname(requireApp.resolve('vite/package.json')), 'client.d.ts');
const program=ts.createProgram([...ownFiles.map(f=>f.endsWith('.svelte')?f+'.tsx':f),shim,jsx,vite],options,host);
const diagnostics=ts.getPreEmitDiagnostics(program).filter(d=>d.file&&ownFiles.some(f=>d.file.fileName===f||d.file.fileName===f+'.tsx'));
if(diagnostics.length) {
 console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCurrentDirectory:()=>root,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
 process.exitCode=1;
} else console.log(`PASS: ${ownFiles.length} viewer source files; Svelte compilation and scoped TypeScript diagnostics clear.`);
