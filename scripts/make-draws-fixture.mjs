// Writes tests/fixtures/draws-r1.json: the card picks of the round 1 engine
// (commit bd51ecd) for a fixed input x seed grid. The round 2 engine must
// reproduce every row. Run from anywhere: node scripts/make-draws-fixture.mjs
//
// With --r2 it writes tests/fixtures/draws-r2.json instead: the FULL return
// objects of the round 2 engine for every 10th input of the same grid. The
// node test and the browser test both check the engine against that file.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { drawFortune, setBank, setReadings, DISHES } from "../engine/fortune.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "tests", "fixtures", "draws-r1.json");
const OUT_R2 = join(ROOT, "tests", "fixtures", "draws-r2.json");
const ENGINE_COMMIT = "bd51ecd";
const R2_EVERY = 10; // 2880 grid inputs -> 288 rows

// The name only fills {name} in the lines, so it does not change the picks;
// it stays in the grid so the round 2 check covers it.
export const GRID = {
  names: ["", "Ada Lovelace"],
  birthdays: [null, "10-30", "03-21", "12-25"],
  ratings: [null, 1, 3, 5],
  dishSets: [
    [],
    ["hex"],
    ["aloo", "brodo"],
    [...DISHES],
    [{ id: "ichabod", way: "Vegan", rating: 5 }, { id: "brodo", rating: 1 }],
  ],
  seeds: [...Array.from({ length: 15 }, (_, i) => i), 12345, 987654321, 4294967295],
};

// Loop order is fixed: names x birthdays x ratings x dishSets x seeds.
export function* inputs(grid = GRID) {
  for (const name of grid.names)
    for (const birthday of grid.birthdays)
      for (const rating of grid.ratings)
        for (const dishes of grid.dishSets)
          for (const seed of grid.seeds) yield { name, birthday, rating, dishes, seed };
}

// Only the fields the Sheet row and the page depend on, in a fixed key order.
export function toRow(ret) {
  return {
    seed: ret.seed,
    cardId: ret.cardId,
    title: ret.title,
    numeral: ret.numeral,
    second: ret.cat.cardId,
    secondTitle: ret.cat.title,
    speaker: ret.cat.name,
    dish: ret.dish,
    dishName: ret.dishName,
    rating: ret.rating,
    zodiac: ret.zodiac,
  };
}

export function buildRows(bank, readings, grid = GRID) {
  setBank(bank);
  setReadings(readings);
  return [...inputs(grid)].map((input) => toRow(drawFortune(input, bank, readings)));
}

// Round 2: the full return objects, every R2_EVERY-th input of the grid.
export function buildRowsR2(bank, readings, grid = GRID) {
  return [...inputs(grid)]
    .filter((_, i) => i % R2_EVERY === 0)
    .map((input) => ({ input, out: drawFortune(input, bank, readings) }));
}

export function formatFixtureR2(rows, grid = GRID) {
  const head = `{\n  "engine": "round 2 (Jess's fixed reading)",\n  "order": "names x birthdays x ratings x dishSets x seeds, every ${R2_EVERY}th input",\n  "grid": ${JSON.stringify(grid)},\n  "draws": [\n`;
  const body = rows.map((r) => `    ${JSON.stringify(r)}`).join(",\n");
  return `${head}${body}\n  ]\n}\n`;
}

// One draw per line, so a diff of a changed pick reads as one line.
export function formatFixture(rows, grid = GRID) {
  const head = `{\n  "engine": "${ENGINE_COMMIT}",\n  "order": "names x birthdays x ratings x dishSets x seeds",\n  "grid": ${JSON.stringify(grid)},\n  "draws": [\n`;
  const body = rows.map((r) => `    ${JSON.stringify(r)}`).join(",\n");
  return `${head}${body}\n  ]\n}\n`;
}

function main() {
  const read = (f) => JSON.parse(readFileSync(join(ROOT, "engine", f), "utf8"));
  const bank = read("lines.json");
  const readings = read("readings.json");
  const r2 = process.argv.includes("--r2");
  const rows = r2 ? buildRowsR2(bank, readings) : buildRows(bank, readings);
  const text = r2 ? formatFixtureR2(rows) : formatFixture(rows);
  const out = r2 ? OUT_R2 : OUT;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, text);
  console.log(`rows=${rows.length} bytes=${Buffer.byteLength(text)} out=${out}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
