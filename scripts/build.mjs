// Assemble the deployable site: page/ -> _site/, plus the engine.
// The real engine (engine/, from the cloud PR) wins; until it lands, page/engine-stub/ stands in.
import { cpSync, existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
const out = '_site';
rmSync(out, { recursive: true, force: true });
cpSync('page', out, { recursive: true, filter: (p) => !p.includes('engine-stub') });
const real = existsSync('engine/fortune.mjs');
mkdirSync(`${out}/engine`, { recursive: true });
cpSync(real ? 'engine' : 'page/engine-stub', `${out}/engine`, { recursive: true, filter: (p) => !/[\/]test/.test(p) });
writeFileSync(`${out}/engine/SOURCE.txt`, real ? 'engine/ (real)\n' : 'page/engine-stub (stub)\n');
if (existsSync('CNAME')) cpSync('CNAME', `${out}/CNAME`);
console.log(`built ${out} with ${real ? 'real' : 'stub'} engine`);
