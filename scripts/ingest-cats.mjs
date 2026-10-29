// Pull the 24 cat cards from the vault art folder into page/cards/cats/ as 480x720 AVIF (engraved hatching: AVIF is ~55 KB, WebP ~80 KB).
// usage: node scripts/ingest-cats.mjs [artDir]
// Takes, per card id, the file named in manifest.json if present, else the newest <id>*.png|jpg|webp.
import { readdirSync, existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ART = process.argv[2] || 'C:/TFF/Haque Brain v2/04-The-Freckled-Fork/brand/photos/arcana-source/generated/fortunes-r1';
const OUT = 'page/cards/cats';
const IDS = ['the-fool', 'the-magician', 'the-high-priestess', 'the-empress', 'the-emperor', 'the-hierophant', 'the-lovers',
  'the-chariot', 'strength', 'the-hermit', 'wheel-of-fortune', 'justice', 'the-hanged-one', 'death', 'temperance', 'the-devil',
  'the-tower', 'the-star', 'the-moon', 'the-sun', 'judgement', 'the-world', 'the-pet-parade', 'the-pass'];

let manifest = {};
const mf = join(ART, 'manifest.json');
if (existsSync(mf)) {
  const m = JSON.parse(readFileSync(mf, 'utf8'));
  // accept {id: file}, {cards: [{id, file}]} or [{id, file|path}]
  const list = Array.isArray(m) ? m : Array.isArray(m.cards) ? m.cards : Object.entries(m).map(([id, file]) => ({ id, file }));
  for (const c of list) if (c && c.id) manifest[c.id] = c.file || c.path || c.filename;
}
const files = readdirSync(ART).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
const done = [], missing = [];
for (const id of IDS) {
  let src = manifest[id] && join(ART, manifest[id]);
  if (!src || !existsSync(src)) {
    const cands = files.filter((f) => f.toLowerCase().startsWith(id)).map((f) => join(ART, f));
    cands.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    src = cands[0];
  }
  if (!src) { missing.push(id); continue; }
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', 'scale=480:720:force_original_aspect_ratio=increase,crop=480:720,format=yuv420p', '-c:v', 'libaom-av1', '-still-picture', '1', '-crf', '38', '-cpu-used', '4', join(OUT, `${id}.avif`)]);
  done.push(id);
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify(done) + '\n');
console.log(`ingested ${done.length}/24; missing: ${missing.join(', ') || 'none'}`);
remeasureBoxes();

// measure-boxes.py globs cats/*.avif and writes boxes.json relative to its cwd, so it runs inside page/cards.
function remeasureBoxes() {
  const script = resolve('scripts/measure-boxes.py');
  const run = spawnSync('python', [script], { cwd: 'page/cards', stdio: 'inherit' });
  if (run.error || run.status !== 0) {
    const why = run.error ? run.error.message : `exit ${run.status}`;
    console.error(`WARNING: page/cards/cats/boxes.json is now STALE (measure-boxes.py failed: ${why}).`);
    console.error('Fix Python (3 with Pillow and numpy), then run: cd page/cards && python ../../scripts/measure-boxes.py');
    process.exit(1);
  }
  console.log('re-measured page/cards/cats/boxes.json');
}
