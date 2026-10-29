// Writes tests/fixtures/draws-r1.json: the card picks of the round 1 engine
// (commit bd51ecd) for a fixed input x seed grid. The round 2 engine must
// reproduce every row. Run from anywhere: node scripts/make-draws-fixture.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { drawFortune, setBank, DISHES } from "../engine/fortune.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(ROOT, "tests", "fixtures", "draws-r1.json");
const ENGINE_COMMIT = "bd51ecd";

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

export function buildRows(bank, grid = GRID) {
  setBank(bank);
  return [...inputs(grid)].map((input) => toRow(drawFortune(input, bank)));
}

// One draw per line, so a diff of a changed pick reads as one line.
export function formatFixture(rows, grid = GRID) {
  const head = `{\n  "engine": "${ENGINE_COMMIT}",\n  "order": "names x birthdays x ratings x dishSets x seeds",\n  "grid": ${JSON.stringify(grid)},\n  "draws": [\n`;
  const body = rows.map((r) => `    ${JSON.stringify(r)}`).join(",\n");
  return `${head}${body}\n  ]\n}\n`;
}

function main() {
  const bank = JSON.parse(readFileSync(join(ROOT, "engine", "lines.json"), "utf8"));
  const rows = buildRows(bank);
  const text = formatFixture(rows);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  console.log(`rows=${rows.length} bytes=${Buffer.byteLength(text)} out=${OUT}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
