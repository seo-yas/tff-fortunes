import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  drawFortune, loadBank, zodiacFor, parseBirthday, parseRating,
  CAT_CARDS, DISH_CARDS, DISHES, SIGNS, RATINGS,
} from "./fortune.mjs";

const bank = JSON.parse(readFileSync(new URL("./lines.json", import.meta.url), "utf8"));
const menu = JSON.parse(readFileSync(new URL("./menu.json", import.meta.url), "utf8"));

const SLOTS = ["opening", "dish", "sign", "rating", "omen", "closing"];
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
  assert.ok(bank.closing.length >= 24);
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
    assert.ok(words <= MAX_WORDS, `${path} has ${words} words: "${line}"`);
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
  const a = drawFortune(input, bank);
  const b = drawFortune({ ...input }, bank);
  assert.deepEqual(a, b);
  assert.equal(a.seed, 12345);
  assert.notEqual(drawFortune({ ...input, seed: 12346 }, bank).text, a.text);
});

test("a missing seed is drawn at random and returned so the reading can be replayed", () => {
  const a = drawFortune({ name: "Bo" }, bank);
  assert.ok(Number.isInteger(a.seed) && a.seed >= 0 && a.seed < 2 ** 32);
  assert.deepEqual(drawFortune({ name: "Bo", seed: a.seed }, bank), a);
});

test("every slot is non-empty for every kind of input", () => {
  let seed = 1;
  for (const birthday of BIRTHDAYS)
    for (const dishes of DISH_SETS)
      for (const rating of RATING_INPUTS)
        for (const name of ["", "  ", "Mo", "Lady Pumpkin Spice"]) {
          const f = drawFortune({ name, birthday, rating, dishes, seed: seed++ }, bank);
          for (const s of SLOTS) assert.ok(f.lines[s]?.trim(), `empty ${s}`);
          assert.ok(!/\{name\}|undefined|null/.test(f.text), f.text);
          assert.ok(f.cardId && f.title && f.numeral && f.cat?.name);
        }
});

test("every dish maps to its arcana and the second card is a different cat card", () => {
  const want = { brodo: "The Devil", beetlejuice: "The Magician", ichabod: "The Horseman", hex: "The Tower", aloo: "The Phantom", ghosted: "The Star" };
  for (const d of DISHES) {
    for (let seed = 0; seed < 200; seed++) {
      const f = drawFortune({ dishes: [d], seed }, bank);
      assert.equal(f.title, want[d]);
      assert.equal(f.dish, d);
      assert.ok(bank.opening[f.cardId].map((l) => l.replace("{name}", "friend")).includes(f.lines.opening));
      assert.ok(bank.dish[d].includes(f.lines.dish));
      const card = DISH_CARDS.find((c) => c.id === f.cardId);
      assert.notEqual(f.cat.cardId, card.restages);
      assert.ok(CAT_CARDS.some((c) => c.id === f.cat.cardId));
    }
  }
});

test("two or more dishes draw among them, weighted by each dish's rating", () => {
  const hits = { hex: 0, aloo: 0 };
  for (let seed = 0; seed < 4000; seed++) hits[drawFortune({ dishes: [{ id: "hex", rating: 4 }, { id: "aloo", rating: 1 }], seed }, bank).dish]++;
  assert.ok(hits.hex > 2.5 * hits.aloo && hits.aloo > 0, JSON.stringify(hits));
  const seen = new Set();
  for (let seed = 0; seed < 600; seed++) seen.add(drawFortune({ dishes: DISHES, seed }, bank).dish);
  assert.equal(seen.size, DISHES.length);
});

test("no dish draws from all 24 cat cards", () => {
  const seen = new Set();
  for (let seed = 0; seed < 3000; seed++) {
    const f = drawFortune({ seed }, bank);
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
      const f = drawFortune({ birthday: d, seed: 7 }, bank);
      assert.ok(bank.sign[sign].some((l) => f.lines.sign.startsWith(l)), f.lines.sign);
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
    assert.ok(bank.rating[i + 1].includes(drawFortune({ rating: r, seed: i }, bank).lines.rating));
  });
  assert.equal(parseRating(6), null);
});

test("10,000 seeds give 10,000 different readings", () => {
  const fixed = new Set();
  const mixed = new Set();
  for (let seed = 0; seed < 10000; seed++) {
    fixed.add(drawFortune({ name: "Sam", birthday: "10-30", rating: 5, dishes: ["hex"], seed }, bank).text);
    mixed.add(drawFortune({
      name: "Sam",
      birthday: BIRTHDAYS[seed % BIRTHDAYS.length],
      rating: RATING_INPUTS[seed % RATING_INPUTS.length],
      dishes: DISH_SETS[seed % DISH_SETS.length],
      seed: (seed * 2654435761) >>> 0,
    }, bank).text);
  }
  assert.equal(fixed.size, 10000);
  assert.equal(mixed.size, 10000);
});

test("loadBank reads lines.json next to the engine, and drawFortune then needs no bank argument", async () => {
  const loaded = await loadBank();
  assert.deepEqual(loaded, bank);
  assert.deepEqual(drawFortune({ seed: 99, dishes: ["aloo"] }), drawFortune({ seed: 99, dishes: ["aloo"] }, bank));
});
