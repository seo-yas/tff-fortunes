// Freckled Fork Fortunes: the reading engine.
// Pure ESM, no dependencies, runs in the browser and in Node.
// A reading is a deterministic function of (submission, seed, bank).

export const CATS = { peppers: "Sgt. Peppers", sushi: "Sgt. Sushi" };

// The 24 cat cards (ids match the card-art brief, fortunes-r1/<id>.png).
// `cat` is who is on the card: "peppers", "sushi" or "both".
export const CAT_CARDS = [
  { id: "the-fool", numeral: "0", title: "The Fool", cat: "sushi" },
  { id: "the-magician", numeral: "I", title: "The Magician", cat: "peppers" },
  { id: "the-high-priestess", numeral: "II", title: "The High Priestess", cat: "sushi" },
  { id: "the-empress", numeral: "III", title: "The Empress", cat: "peppers" },
  { id: "the-emperor", numeral: "IV", title: "The Emperor", cat: "peppers" },
  { id: "the-hierophant", numeral: "V", title: "The Hierophant", cat: "peppers" },
  { id: "the-lovers", numeral: "VI", title: "The Lovers", cat: "both" },
  { id: "the-chariot", numeral: "VII", title: "The Chariot", cat: "both" },
  { id: "strength", numeral: "VIII", title: "Strength", cat: "peppers" },
  { id: "the-hermit", numeral: "IX", title: "The Hermit", cat: "sushi" },
  { id: "wheel-of-fortune", numeral: "X", title: "Wheel of Fortune", cat: "both" },
  { id: "justice", numeral: "XI", title: "Justice", cat: "sushi" },
  { id: "the-hanged-one", numeral: "XII", title: "The Hanged One", cat: "peppers" },
  { id: "death", numeral: "XIII", title: "Death", cat: "sushi" },
  { id: "temperance", numeral: "XIV", title: "Temperance", cat: "sushi" },
  { id: "the-devil", numeral: "XV", title: "The Devil", cat: "peppers" },
  { id: "the-tower", numeral: "XVI", title: "The Tower", cat: "sushi" },
  { id: "the-star", numeral: "XVII", title: "The Star", cat: "peppers" },
  { id: "the-moon", numeral: "XVIII", title: "The Moon", cat: "both" },
  { id: "the-sun", numeral: "XIX", title: "The Sun", cat: "peppers" },
  { id: "judgement", numeral: "XX", title: "Judgement", cat: "both" },
  { id: "the-world", numeral: "XXI", title: "The World", cat: "both" },
  { id: "the-pet-parade", numeral: "XXII", title: "The Pet Parade", cat: "both" },
  { id: "the-pass", numeral: "XXIII", title: "The Pass", cat: "both" },
];

// The six dish cards from the event video. `restages` is the cat card
// it stands in for, so that card is never drawn as its second card.
export const DISH_CARDS = [
  { id: "dish-brodo", dish: "brodo", numeral: "XV", title: "The Devil", dishName: "The Devil Wears Brodo", restages: "the-devil" },
  { id: "dish-beetlejuice", dish: "beetlejuice", numeral: "I", title: "The Magician", dishName: "Beet*lejuice", restages: "the-magician" },
  { id: "dish-ichabod", dish: "ichabod", numeral: "XIII", title: "The Horseman", dishName: "Ichabod's Crunch", restages: "death" },
  { id: "dish-hex", dish: "hex", numeral: "XVI", title: "The Tower", dishName: "Hex & the City", restages: "the-tower" },
  { id: "dish-aloo", dish: "aloo", numeral: "XVIII", title: "The Phantom", dishName: "Aloo Boo", restages: "the-moon" },
  { id: "dish-ghosted", dish: "ghosted", numeral: "XVII", title: "The Star", dishName: "Ghosted at the Motel", restages: "the-star" },
];

export const DISHES = DISH_CARDS.map((c) => c.dish);
export const RATINGS = ["Meh", "Fine", "Good", "Real good", "Marry it"];

// [sign, element, modality, start month, start day]; each sign runs to the next one's start.
const ZODIAC = [
  ["capricorn", "earth", "cardinal", 1, 1],
  ["aquarius", "air", "fixed", 1, 20],
  ["pisces", "water", "mutable", 2, 19],
  ["aries", "fire", "cardinal", 3, 21],
  ["taurus", "earth", "fixed", 4, 20],
  ["gemini", "air", "mutable", 5, 21],
  ["cancer", "water", "cardinal", 6, 21],
  ["leo", "fire", "fixed", 7, 23],
  ["virgo", "earth", "mutable", 8, 23],
  ["libra", "air", "cardinal", 9, 23],
  ["scorpio", "water", "fixed", 10, 23],
  ["sagittarius", "fire", "mutable", 11, 22],
  ["capricorn", "earth", "cardinal", 12, 22],
];
export const SIGNS = ZODIAC.slice(1).map((z) => z[0]);
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// Accepts { month, day }, "MM-DD", "MM/DD", "YYYY-MM-DD", "--MM-DD" or a Date.
// Returns { month, day } or null when there is no usable birthday.
export function parseBirthday(birthday) {
  if (birthday == null || birthday === "") return null;
  let month, day;
  if (birthday instanceof Date) {
    if (isNaN(birthday)) return null;
    month = birthday.getMonth() + 1;
    day = birthday.getDate();
  } else if (typeof birthday === "object") {
    month = Number(birthday.month);
    day = Number(birthday.day);
  } else {
    const m = String(birthday).trim().match(/^(?:(?:\d{4}|-)-)?(\d{1,2})[-/](\d{1,2})(?:[-/]\d{2,4})?$/);
    if (!m) return null;
    month = Number(m[1]);
    day = Number(m[2]);
  }
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > DAYS_IN_MONTH[month - 1]) return null;
  return { month, day };
}

export function zodiacFor(birthday) {
  const md = parseBirthday(birthday);
  if (!md) return null;
  let hit = ZODIAC[0];
  for (const z of ZODIAC) if (md.month > z[3] || (md.month === z[3] && md.day >= z[4])) hit = z;
  return { sign: hit[0], element: hit[1], modality: hit[2] };
}

// 1-5, "3", or a label from RATINGS (any case). Returns 1-5 or null.
export function parseRating(rating) {
  if (rating == null || rating === "") return null;
  const n = Number(rating);
  if (Number.isInteger(n) && n >= 1 && n <= 5) return n;
  const i = RATINGS.findIndex((r) => r.toLowerCase() === String(rating).trim().toLowerCase());
  return i < 0 ? null : i + 1;
}

// Accepts ["hex", ...] or [{ id: "hex", way: "Vegan", rating: 4 }, ...].
// Unknown ids are dropped; a repeated dish counts once.
export function parseDishes(dishes) {
  const out = [];
  for (const d of Array.isArray(dishes) ? dishes : dishes == null ? [] : [dishes]) {
    const id = String(typeof d === "object" && d ? d.id : d).trim().toLowerCase();
    if (!DISHES.includes(id) || out.some((o) => o.id === id)) continue;
    out.push({ id, rating: typeof d === "object" && d ? parseRating(d.rating) : null });
  }
  return out;
}

export function firstName(name) {
  const first = String(name ?? "").trim().split(/\s+/)[0] || "";
  return first.slice(0, 24);
}

export function randomSeed() {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 2 ** 32) >>> 0;
}

// mulberry32: small, fast, good enough to shuffle a deck.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

function weighted(rand, items, weight) {
  const total = items.reduce((s, it) => s + weight(it), 0);
  let r = rand() * total;
  for (const it of items) if ((r -= weight(it)) < 0) return it;
  return items[items.length - 1];
}

let loadedBank = null;
let loadedReadings = null;

// Use your own bank (e.g. in tests, or if the page inlines it).
export function setBank(bank) {
  loadedBank = bank;
  return bank;
}

// Jess's readings live apart from the line bank: { cards: { <cardId>: { tagline, text } }, omens: [12] }.
export function setReadings(readings) {
  loadedReadings = readings;
  return readings;
}

async function readJson(url) {
  if (url.protocol !== "file:") {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not load ${url.href}: HTTP ${res.status}`);
    return res.json();
  }
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(url, "utf8"));
}

// Fetches lines.json and readings.json next to this file. Works over http(s) in
// the browser (and from the service-worker cache) and from disk in Node.
// Returns the line bank; the readings are stored for drawFortune.
export async function loadBank(base = import.meta.url) {
  const [lines, readings] = await Promise.all(
    ["./lines.json", "./readings.json"].map((f) => readJson(new URL(f, base))),
  );
  setReadings(readings);
  return setBank(lines);
}

const fill = (line, name) => line.replace(/\{name\}/g, name);
const withStop = (tagline) => (/[.!?…]$/.test(tagline) ? tagline : `${tagline}.`);
const MODELED_BY = { peppers: CATS.peppers, sushi: CATS.sushi, both: `${CATS.peppers} & ${CATS.sushi}` };

/**
 * drawFortune({ name, birthday, rating, dishes, seed }, bank?, readings?)
 * -> { cardId, title, numeral, cat, dishName, modeledBy, tagline, reading, omen, closing,
 *      lines: { tagline, text, omen, closing }, text, seed, zodiac, dish, rating }
 *
 * Jess's fixed reading (2026-10-29): the message is cute, funny and positive and
 * never about what they ate, their sign or their rating. `tagline` and `reading`
 * are her words for the first card, verbatim; `omen` is one of her 12 pantry
 * omens; `closing` is a line from the bank. `text` joins them.
 * The same submission and seed always give the same reading. `seed` is a
 * 32-bit unsigned integer; when absent a crypto-random one is drawn and
 * returned so the page can store it with the submission.
 * The name only fills {name} in the closing and is not HTML-escaped; the page
 * must insert `text` as text.
 */
export function drawFortune(input = {}, bank = loadedBank, readings = loadedReadings ?? bank?.readings) {
  if (!bank) throw new Error("No line bank: call loadBank() or setBank(lines) first, or pass the bank.");
  if (!readings?.cards || !readings.omens) throw new Error("No readings: call loadBank() or setReadings(readings) first, or pass the readings.");
  const seed = input.seed == null || input.seed === "" ? randomSeed() : Number(input.seed) >>> 0;
  const rand = rng(seed);

  const name = firstName(input.name) || "friend";
  const zodiac = zodiacFor(input.birthday);
  const dishes = parseDishes(input.dishes);
  const rating = parseRating(input.rating);

  // Yas, 2026-10-28 (after the first iPhone pulls): the 24 cat cards are the fortune; what they ate is the second card.
  // The dish is drawn first (weighted by its rating) so the cat card can avoid the arcana that dish card restages.
  const dishPick = dishes.length ? weighted(rand, dishes, (x) => x.rating ?? 3) : null;
  const dishCard = dishPick ? DISH_CARDS.find((c) => c.dish === dishPick.id) : null;

  // The first card: always a cat card (never the one the dish card restages, so the two never show the same arcana).
  const card = pick(rand, CAT_CARDS.filter((c) => c.id !== dishCard?.restages));

  // The second card: the dish card when they ticked one, else another cat card (never the first, never what it restages).
  const second = dishCard ?? pick(rand, CAT_CARDS.filter((c) => c.id !== card.id));
  // The voice stays a cat: the second cat card's cat, or, for a dish second card, the first card's cat.
  const voice = dishCard ? card.cat : second.cat;
  const speakerKey = voice === "both" ? pick(rand, ["peppers", "sushi"]) : voice;
  const speaker = CATS[speakerKey];

  // Everything above is the round 1 pick order and must not change (tests/fixtures/draws-r1.json).
  const mine = readings.cards[card.id];
  if (!mine) throw new Error(`No reading for card ${card.id}.`);
  const omen = pick(rand, readings.omens);
  const closing = fill(pick(rand, bank.closing), name);
  const lines = { tagline: mine.tagline, text: mine.text, omen, closing };
  const text = [withStop(mine.tagline), mine.text, `Pantry omen: ${omen}.`, closing].join(" ");

  return {
    cardId: card.id,
    title: card.title,
    numeral: card.numeral,
    dishName: dishCard?.dishName ?? null,
    cat: { cardId: second.id, title: second.title, numeral: second.numeral, name: speaker },
    modeledBy: MODELED_BY[card.cat],
    tagline: mine.tagline,
    reading: mine.text,
    omen,
    closing,
    lines,
    text,
    seed,
    zodiac,
    dish: dishPick?.id ?? null,
    rating: rating ? RATINGS[rating - 1] : null,
  };
}
