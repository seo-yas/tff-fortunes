// Assemble the deployable site: page/ -> _site/, plus the engine.
// The real engine (engine/, from the cloud PR) wins; until it lands, page/engine-stub/ stands in.
import { cpSync, existsSync, rmSync, mkdirSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
const out = '_site';
mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) rmSync(`${out}/${f}`, { recursive: true, force: true });
cpSync('page', out, { recursive: true, filter: (p) => !p.includes('engine-stub') });
const ENGINE = process.env.ENGINE_DIR || 'engine'; // ENGINE_DIR: test a PR's engine without touching engine/
const real = existsSync(`${ENGINE}/fortune.mjs`);
mkdirSync(`${out}/engine`, { recursive: true });
cpSync(real ? ENGINE : 'page/engine-stub', `${out}/engine`, { recursive: true, filter: (p) => !/.test.mjs$/.test(p) });
writeFileSync(`${out}/engine/SOURCE.txt`, real ? 'engine/ (real)\n' : 'page/engine-stub (stub)\n');
// A fresh cache name per build, so a phone that loaded an older deploy swaps the whole cache on its next visit.
const stamp = `fff-${process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 8) : Date.now().toString(36)}`;
// The engine's data files (the real engine's lines.json, menu.json) are part of the required precache: a draw needs them offline.
// Top-level engine/*.json only: no fixtures, no folders.
const engineFiles = readdirSync(`${out}/engine`).filter((f) => f.endsWith('.json') && statSync(`${out}/engine/${f}`).isFile()).map((f) => `engine/${f}`);
let sw = readFileSync(`${out}/sw.js`, 'utf8');
sw = sw.replace("const VERSION = 'fff-v1';", `const VERSION = '${stamp}';`);
sw = sw.replace('const ENGINE_FILES = [];', `const ENGINE_FILES = ${JSON.stringify(engineFiles)};`);
writeFileSync(`${out}/sw.js`, sw);
if (existsSync('CNAME')) cpSync('CNAME', `${out}/CNAME`);
// cache.addAll is all-or-nothing: one missing file stops the worker installing and strands every phone on the old release. Fail here instead.
const coreLiteral = /const CORE = (\[[^;]*?\]);/.exec(sw)?.[1];
if (!coreLiteral) { console.error('build failed: could not read CORE out of _site/sw.js'); process.exit(1); }
const core = new Function('ENGINE_FILES', `return ${coreLiteral};`)(engineFiles);
const missing = [...core, ...engineFiles].filter((u) => !existsSync(`${out}/${u === './' ? 'index.html' : u}`));
if (missing.length) { console.error(`build failed: precache files missing from ${out}/: ${[...new Set(missing)].join(', ')}`); process.exit(1); }
if (engineFiles.some((f) => f.split('/').length !== 2)) { console.error('build failed: ENGINE_FILES must be top-level engine/*.json'); process.exit(1); }

console.log(`built ${out} with ${real ? 'real' : 'stub'} engine`);
