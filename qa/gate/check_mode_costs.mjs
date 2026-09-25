#!/usr/bin/env node
/**
 * The frontend's bet-mode costs must equal the math's (docs/GAME_CONTRACT.md §2: config.ts matches
 * math/publish/index.json byte for byte). Source of truth, in order:
 *   1. math/publish/index.json (once the math lane publishes) — `modes[].{name,cost}`;
 *   2. until then the FROZEN model, math/games/piggy_firefighters/game_config.py MODE_COSTS (tag math-freeze-v1).
 * Also checked: the dev fixture index costs (server/fixtures/index.json) and that config.ts lists the buy modes in
 * ascending price (the HUD order of contract v1.2.1 §2).
 *
 *   node qa/gate/check_mode_costs.mjs      exit 1 on any difference
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../..', import.meta.url).pathname;
const problems = [];

// ---- the math ------------------------------------------------------------------------------------------------------
let mathCosts;
let source;
const publish = join(ROOT, 'math/publish/index.json');
if (existsSync(publish)) {
	const index = JSON.parse(readFileSync(publish, 'utf8'));
	mathCosts = Object.fromEntries((index.modes ?? []).map((m) => [m.name, Number(m.cost)]));
	source = 'math/publish/index.json';
} else {
	const py = readFileSync(join(ROOT, 'math/games/piggy_firefighters/game_config.py'), 'utf8');
	const m = py.match(/MODE_COSTS\s*=\s*\{([^}]*)\}/s);
	if (!m) {
		console.error('FAIL check_mode_costs: MODE_COSTS not found in game_config.py');
		process.exit(1);
	}
	mathCosts = Object.fromEntries([...m[1].matchAll(/'([a-z_]+)'\s*:\s*([0-9.]+)/g)].map((x) => [x[1], Number(x[2])]));
	source = 'math/games/piggy_firefighters/game_config.py MODE_COSTS';
}

// ---- config.ts -----------------------------------------------------------------------------------------------------
const configTs = readFileSync(join(ROOT, 'apps/piggy_firefighters/src/game/config.ts'), 'utf8');
const block = configTs.match(/betModes:\s*\{([\s\S]*?)\n\t\},/);
if (!block) {
	console.error('FAIL check_mode_costs: betModes block not found in config.ts');
	process.exit(1);
}
const configModes = [...block[1].matchAll(/^\s*([a-z_]+):\s*\{\s*cost:\s*([0-9.]+),[^}]*buyBonus:\s*(true|false)/gm)].map((x) => ({
	name: x[1],
	cost: Number(x[2]),
	buy: x[3] === 'true',
}));
const configCosts = Object.fromEntries(configModes.map((m) => [m.name, m.cost]));

const compare = (label, costs) => {
	for (const [name, cost] of Object.entries(mathCosts)) {
		if (!(name in costs)) problems.push(`${label}: mode '${name}' missing (math ${cost}x)`);
		else if (costs[name] !== cost) problems.push(`${label}: '${name}' costs ${costs[name]}x, the math says ${cost}x`);
	}
	for (const name of Object.keys(costs)) if (!(name in mathCosts)) problems.push(`${label}: mode '${name}' is not a math mode`);
};
compare('config.ts betModes', configCosts);

const buys = configModes.filter((m) => m.buy);
for (let i = 1; i < buys.length; i += 1)
	if (buys[i].cost < buys[i - 1].cost) problems.push(`config.ts betModes: buy modes not in ascending price (${buys.map((m) => `${m.name} ${m.cost}x`).join(', ')})`);

const fixtures = join(ROOT, 'server/fixtures/index.json');
if (existsSync(fixtures)) {
	const index = JSON.parse(readFileSync(fixtures, 'utf8'));
	if (index.costs) compare('server/fixtures/index.json costs', index.costs);
	for (const f of index.fixtures ?? [])
		if (f.cost !== undefined && mathCosts[f.mode] !== undefined && Number(f.cost) !== mathCosts[f.mode])
			problems.push(`server/fixtures/index.json fixture '${f.name}': cost ${f.cost}x, the math says ${mathCosts[f.mode]}x`);
}

if (problems.length) {
	console.error(`FAIL check_mode_costs (source: ${source})`);
	for (const p of problems) console.error('  ' + p);
	process.exit(1);
}
console.log(`OK check_mode_costs: config.ts and the dev fixtures match ${source}: ${Object.entries(mathCosts).map(([n, c]) => `${n} ${c}x`).join(', ')}`);
