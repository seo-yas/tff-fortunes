import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  drawFortune, loadBank, zodiacFor, parseBirthday, parseRating,
  CAT_CARDS, DISH_CARDS, DISHES, SIGNS, RATINGS,
} from "./fortune.mjs";
import { GRID, inputs, toRow, buildRowsR2, formatFixtureR2 } from "../scripts/make-draws-fixture.mjs";

const bank = JSON.parse(readFileSync(new URL("./lines.json", import.meta.url), "utf8"));
const menu = JSON.parse(readFileSync(new URL("./menu.json", import.meta.url), "utf8"));
// Jess's fixed readings (tagline + text per cat card, 12 pantry omens), kept apart from the bank.
const readings = JSON.parse(readFileSync(new URL("./readings.json", import.meta.url), "utf8"));
const draw = (input) => drawFortune(input, bank, readings);

const SLOTS = ["tagline", "text", "omen", "closing"];
const ELEMENTS = ["fire", "earth", "air", "water"];
const MODALITIES = ["cardinal", "fixed", "mutable"];
const BIRTHDAYS = [null, "", "13-40", ...SIGNS.map((_, i) => ({ month: i + 1, day: 15 }))];
const DISH_SETS = [[], ["nope"], ...DISHES.map((d) => [d]), ["hex", "aloo"], DISHES, [{ id: "ichabod", way: "Vegan", rating: 5 }, { id: "brodo", rating: 1 }]];
const RATING_INPUTS = [null, 0, 9, 1, 2, 3, 4, 5, "Marry it", "meh"];

// Every string in the bank, with where it lives.
function allLines() {
  const out = [];
  const walk = (node, path) => {
    if (typeof node === "string") out.push({ path, line: node });
    else if (Array.isArray(node)) node.forEach((n, i) => walk(n, `${path}[${i}]`));
    else for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
  };
  walk(bank, "");
  return out;
}

// Spoken aloud at about 2.6 words a second, 15 words is under six seconds.
const MAX_WORDS = 15;
const MAX_DISH_WORDS = 13;

// The bank keeps the old keys for history; the round 2 engine reads only `closing`.
test("the bank has the slot counts the handoff asks for", () => {
  for (const c of [...CAT_CARDS, ...DISH_CARDS]) assert.ok(bank.opening[c.id]?.length >= 6, `opening.${c.id}`);
  assert.equal(Object.keys(bank.opening).length, CAT_CARDS.length + DISH_CARDS.length);
  for (const d of [...DISHES, "none"]) assert.ok(bank.dish[d]?.length >= 8, `dish.${d}`);
  for (const s of SIGNS) assert.ok(bank.sign[s]?.length >= 4, `sign.${s}`);
  assert.ok(bank.sign.none.length >= 4);
  for (const e of ELEMENTS) assert.ok(bank.element[e]?.length >= 4, `element.${e}`);
  for (const m of MODALITIES) assert.ok(bank.modality[m]?.length >= 4, `modality.${m}`);
  for (const r of ["1", "2", "3", "4", "5", "none"]) assert.ok(bank.rating[r]?.length >= 6, `rating.${r}`);
  assert.ok(bank.omen.length >= 40);
  assert.ok(bank.closing.length >= 24, `closing has ${bank.closing.length}`);
  assert.ok(!bank.closing.some((c) => /go get another hot dog/i.test(c)), "the hot dog closing is gone");
});

test("no duplicate lines anywhere in the bank", () => {
  const seen = new Map();
  const norm = (s) => s.toLowerCase().replace(/\{name\}/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  for (const { path, line } of allLines()) {
    const key = norm(line);
    assert.ok(!seen.has(key), `${path} repeats ${seen.get(key)}: "${line}"`);
    seen.set(key, path);
  }
});

test("every line reads aloud in under six seconds and is clean text", () => {
  for (const { path, line } of allLines()) {
    const words = line.trim().split(/\s+/).length;
    // Dish lines are read after "The second card is X. Sgt. Y says:", so they stay shorter.
    const max = path.startsWith("dish.") ? MAX_DISH_WORDS : MAX_WORDS;
    assert.ok(words <= max, `${path} has ${words} words: "${line}"`);
    assert.equal(line, line.trim(), `${path} has stray whitespace`);
    assert.ok(!/\{(?!name\})/.test(line), `${path} has an unknown placeholder`);
  }
});

test("no line names anyone but the cats", () => {
  const forbidden = /\b(jess|yas|jessica)\b/i;
  for (const { path, line } of allLines()) assert.ok(!forbidden.test(line), `${path}: "${line}"`);
});

test("menu.json is MENU from Jess's build, unchanged", () => {
  const src = readFileSync(new URL("../reference/jess-build/cards.js", import.meta.url), "utf8");
  const MENU = new Function(src.slice(src.indexOf("const MENU")) + ";return MENU")();
  assert.deepEqual(menu, MENU);
  assert.deepEqual(menu.map((m) => m.id), DISHES);
});

test("same submission and seed give the same reading", () => {
  const input = { name: "Ada Lovelace", birthday: "10-30", rating: 4, dishes: ["hex", "ghosted"], seed: 12345 };
  const a = draw(input);
  const b = draw({ ...input });
  assert.deepEqual(a, b);
  assert.equal(a.seed, 12345);
  assert.notEqual(draw({ ...input, seed: 12346 }).text, a.text);
});

test("a missing seed is drawn at random and returned so the reading can be replayed", () => {
  const a = draw({ name: "Bo" });
  assert.ok(Number.isInteger(a.seed) && a.seed >= 0 && a.seed < 2 ** 32);
  assert.deepEqual(draw({ name: "Bo", seed: a.seed }), a);
});

test("every slot is non-empty for every kind of input", () => {
  let seed = 1;
  for (const birthday of BIRTHDAYS)
    for (const dishes of DISH_SETS)
      for (const rating of RATING_INPUTS)
        for (const name of ["", "  ", "Mo", "Lady Pumpkin Spice"]) {
          const f = draw({ name, birthday, rating, dishes, seed: seed++ });
          for (const s of SLOTS) assert.ok(f.lines[s]?.trim(), `empty ${s}`);
          assert.ok(!/\{name\}|undefined|null/.test(f.text), f.text);
          assert.ok(f.cardId && f.title && f.numeral && f.cat?.name);
        }
});

test("a ticked dish is the second card: the fortune is always a cat card", () => {
  const want = { brodo: "The Devil", beetlejuice: "The Magician", ichabod: "The Horseman", hex: "The Tower", aloo: "The Phantom", ghosted: "The Star" };
  for (const d of DISHES) {
    const firsts = new Set();
    for (let seed = 0; seed < 200; seed++) {
      const f = draw({ dishes: [d], seed });
      assert.ok(CAT_CARDS.some((c) => c.id === f.cardId), `first card ${f.cardId} is a cat card`);
      const dishCard = DISH_CARDS.find((c) => c.dish === d);
      assert.equal(f.cat.cardId, dishCard.id);
      assert.equal(f.cat.title, want[d]);
      assert.notEqual(f.cardId, dishCard.restages);
      assert.equal(f.dish, d);
      assert.equal(f.dishName, dishCard.dishName);
      assert.equal(f.reading, readings.cards[f.cardId].text);
      assert.ok(["Sgt. Peppers", "Sgt. Sushi"].includes(f.cat.name));
      firsts.add(f.cardId);
    }
    assert.ok(firsts.size >= 15, `${d}: pull again reaches many cat cards (${firsts.size})`);
  }
});

test("same seed, same cards, with a dish ticked", () => {
  const input = { name: "Ada", dishes: ["aloo", "brodo"], rating: 5, seed: 987654321 };
  const a = draw(input);
  const b = draw({ ...input });
  assert.equal(a.cardId, b.cardId);
  assert.equal(a.cat.cardId, b.cat.cardId);
  assert.deepEqual(a, b);
});

test("two or more dishes draw among them, weighted by each dish's rating", () => {
  const hits = { hex: 0, aloo: 0 };
  for (let seed = 0; seed < 4000; seed++) hits[draw({ dishes: [{ id: "hex", rating: 4 }, { id: "aloo", rating: 1 }], seed }).dish]++;
  assert.ok(hits.hex > 2.5 * hits.aloo && hits.aloo > 0, JSON.stringify(hits));
  const seen = new Set();
  for (let seed = 0; seed < 600; seed++) seen.add(draw({ dishes: DISHES, seed }).dish);
  assert.equal(seen.size, DISHES.length);
});

test("no dish draws from all 24 cat cards", () => {
  const seen = new Set();
  for (let seed = 0; seed < 3000; seed++) {
    const f = draw({ seed });
    assert.ok(CAT_CARDS.some((c) => c.id === f.cardId));
    assert.notEqual(f.cat.cardId, f.cardId);
    assert.equal(f.dish, null);
    seen.add(f.cardId);
  }
  assert.equal(seen.size, 24);
});

test("every sign maps, with element and modality, on its first and last day", () => {
  const ranges = {
    aries: ["3-21", "4-19"], taurus: ["4-20", "5-20"], gemini: ["5-21", "6-20"], cancer: ["6-21", "7-22"],
    leo: ["7-23", "8-22"], virgo: ["8-23", "9-22"], libra: ["9-23", "10-22"], scorpio: ["10-23", "11-21"],
    sagittarius: ["11-22", "12-21"], capricorn: ["12-22", "1-19"], aquarius: ["1-20", "2-18"], pisces: ["2-19", "3-20"],
  };
  const el = { fire: ["aries", "leo", "sagittarius"], earth: ["taurus", "virgo", "capricorn"], air: ["gemini", "libra", "aquarius"], water: ["cancer", "scorpio", "pisces"] };
  const mod = { cardinal: ["aries", "cancer", "libra", "capricorn"], fixed: ["taurus", "leo", "scorpio", "aquarius"], mutable: ["gemini", "virgo", "sagittarius", "pisces"] };
  assert.deepEqual(Object.keys(ranges).sort(), [...SIGNS].sort());
  for (const [sign, days] of Object.entries(ranges)) {
    for (const d of days) {
      const z = zodiacFor(d);
      assert.equal(z.sign, sign, d);
      assert.ok(el[z.element].includes(sign));
      assert.ok(mod[z.modality].includes(sign));
      const f = draw({ birthday: d, seed: 7 });
      assert.deepEqual(f.zodiac, z);
    }
  }
  // Every day of the year maps to a sign.
  for (let m = 1; m <= 12; m++) for (let d = 1; d <= new Date(2024, m, 0).getDate(); d++) assert.ok(zodiacFor({ month: m, day: d }));
});

test("birthday formats: month and day only, year optional", () => {
  for (const b of ["10-30", "10/30", "1990-10-30", "--10-30", { month: 10, day: 30 }, { month: "10", day: "30" }, "10/30/1990"])
    assert.deepEqual(parseBirthday(b), { month: 10, day: 30 }, JSON.stringify(b));
  for (const b of [null, "", "2-30", "13-01", "soon", { month: 4 }]) assert.equal(parseBirthday(b), null, JSON.stringify(b));
  assert.equal(zodiacFor("2-29").sign, "pisces");
});

test("ratings by number or label", () => {
  RATINGS.forEach((r, i) => {
    assert.equal(parseRating(r), i + 1);
    assert.equal(parseRating(i + 1), i + 1);
    assert.equal(draw({ rating: r, seed: i }).rating, r);
  });
  assert.equal(parseRating(6), null);
});

test("all 24 readings and all 12 omens are reachable, and a seed always gives the same text", () => {
  const cards = new Set();
  const omens = new Set();
  for (let seed = 0; seed < 5000; seed++) {
    const f = draw({ name: "Sam", birthday: BIRTHDAYS[seed % BIRTHDAYS.length], dishes: DISH_SETS[seed % DISH_SETS.length], seed });
    cards.add(f.cardId);
    omens.add(f.omen);
    assert.equal(draw({ name: "Sam", birthday: BIRTHDAYS[seed % BIRTHDAYS.length], dishes: DISH_SETS[seed % DISH_SETS.length], seed }).text, f.text);
  }
  assert.equal(cards.size, 24);
  assert.deepEqual([...omens].sort(), [...readings.omens].sort());
});

test("every round 1 card pick is reproduced exactly (tests/fixtures/draws-r1.json)", () => {
  const fixture = JSON.parse(readFileSync(new URL("../tests/fixtures/draws-r1.json", import.meta.url), "utf8"));
  const all = [...inputs(fixture.grid)];
  assert.equal(all.length, fixture.draws.length);
  assert.deepEqual(fixture.grid, GRID, "the fixture grid is the script's grid");
  all.forEach((input, i) => assert.deepEqual(toRow(draw(input)), fixture.draws[i], JSON.stringify(input)));
});

test("round 2 golden: the full return objects match tests/fixtures/draws-r2.json byte for byte", () => {
  const file = readFileSync(new URL("../tests/fixtures/draws-r2.json", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  assert.equal(formatFixtureR2(buildRowsR2(bank, readings)), file);
  assert.ok(JSON.parse(file).draws.length <= 300);
});

const READING_FIELDS = ["tagline", "text"];

test("each cat card's tagline and reading are Jess's words, verbatim", () => {
  const ids = Object.keys(readings.cards);
  assert.deepEqual([...ids].sort(), CAT_CARDS.map((c) => c.id).sort());
  for (const c of CAT_CARDS) {
    for (const k of READING_FIELDS) assert.ok(readings.cards[c.id][k]?.trim(), `${c.id}.${k}`);
    // seeds that land on this card
    let hit = 0;
    for (let seed = 0; seed < 4000 && hit < 3; seed++) {
      const f = draw({ seed });
      if (f.cardId !== c.id) continue;
      hit++;
      assert.equal(f.tagline, readings.cards[c.id].tagline);
      assert.equal(f.reading, readings.cards[c.id].text);
      assert.equal(f.lines.tagline, f.tagline);
      assert.equal(f.lines.text, f.reading);
    }
    assert.ok(hit > 0, `${c.id} is drawn`);
  }
  assert.equal(readings.omens.length, 12);
});

test("the return shape: modeledBy names the first card's cat, text joins the four parts", () => {
  const names = { peppers: "Sgt. Peppers", sushi: "Sgt. Sushi", both: "Sgt. Peppers & Sgt. Sushi" };
  for (let seed = 0; seed < 300; seed++) {
    const f = draw({ name: "Ada Lovelace", birthday: "10-30", rating: 5, dishes: ["hex"], seed });
    assert.equal(f.modeledBy, names[CAT_CARDS.find((c) => c.id === f.cardId).cat]);
    assert.deepEqual(Object.keys(f.lines), ["tagline", "text", "omen", "closing"]);
    assert.ok(readings.omens.includes(f.omen));
    assert.equal(f.lines.omen, f.omen);
    assert.equal(f.lines.closing, f.closing);
    const stop = /[.!?…]$/.test(f.tagline) ? f.tagline : `${f.tagline}.`;
    assert.equal(f.text, [stop, f.reading, `Pantry omen: ${f.omen}.`, f.closing].join(" "));
    assert.ok(!f.text.includes("{name}"), "no placeholder left");
    assert.ok(bank.closing.map((l) => l.replace(/\{name\}/g, "Ada")).includes(f.closing));
  }
});

// Jess's own words are exempt (her copy mentions hot dogs, "brodo" and "your sign"); the parts the engine adds are not.
test("the omen line and closing never mention the dish, the sign, the rating, an element or a modality", () => {
  const menuNames = menu.map((m) => m.name);
  const dishWords = [...DISH_CARDS.map((c) => c.dishName), ...menuNames, ...DISHES];
  const starSigns = [...SIGNS, "zodiac", "horoscope", "star sign", "birth sign", "your sign"];
  const words = [...starSigns, ...dishWords, ...ELEMENTS, ...MODALITIES];
  const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hits = (text, list) => list.filter((w) => new RegExp(`(^|[^a-z])${esc(w)}($|[^a-z])`, "i").test(text));
  // Rating labels are matched as written, capitalised ("Good", "Fine"), so ordinary lowercase "good" is not a rating.
  const labelHits = (text) => RATINGS.filter((r) => new RegExp(`(^|[^A-Za-z])${esc(r)}($|[^A-Za-z])`).test(text));
  const parts = [...readings.omens.map((o) => `Pantry omen: ${o}.`), ...bank.closing.map((c) => c.replace(/\{name\}/g, "Ada"))];
  for (const part of parts) {
    assert.deepEqual(hits(part, words), [], part);
    assert.deepEqual(labelHits(part), [], part);
    assert.ok(!/hot dog/i.test(part) || !/go get another/i.test(part), part);
  }
  for (let seed = 0; seed < 500; seed++) {
    const f = draw({ name: "Ada", birthday: "10-30", rating: 5, dishes: ["brodo"], seed });
    assert.ok(!/go get another hot dog/i.test(f.text), f.text);
  }
});

test("loadBank reads lines.json AND readings.json next to the engine, and drawFortune then needs no arguments", async () => {
  const loaded = await loadBank();
  assert.deepEqual(loaded, bank);
  const input = { seed: 99, dishes: ["aloo"] };
  const bare = drawFortune(input);
  assert.deepEqual(bare, draw(input));
  assert.equal(bare.reading, readings.cards[bare.cardId].text);
  assert.throws(() => drawFortune(input, bank, {}), /No readings/);
});
