// Assemble the deployable site: page/ -> _site/, plus the engine.
// The real engine (engine/, from the cloud PR) wins; until it lands, page/engine-stub/ stands in.
import { cpSync, existsSync, rmSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
const out = '_site';
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) rmSync(`${out}/${f}`, { recursive: true, force: true });
cpSync('page', out, { recursive: true, filter: (p) => !p.includes('engine-stub') });
const ENGINE = process.env.ENGINE_DIR || 'engine'; // ENGINE_DIR: test a PR's engine without touching engine/
const real = existsSync(`${ENGINE}/fortune.mjs`);
mkdirSync(`${out}/engine`, { recursive: true });
cpSync(real ? ENGINE : 'page/engine-stub', `${out}/engine`, { recursive: true, filter: (p) => !/.test.mjs$/.test(p) });
writeFileSync(`${out}/engine/SOURCE.txt`, real ? 'engine/ (real)\n' : 'page/engine-stub (stub)\n');
if (existsSync('CNAME')) cpSync('CNAME', `${out}/CNAME`);
console.log(`built ${out} with ${real ? 'real' : 'stub'} engine`);
