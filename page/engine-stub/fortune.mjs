// STUB engine. Same signature and return shape as engine/fortune.mjs (cloud PR).
// scripts/build.mjs ships the real engine/ whenever it exists; this file only fills the gap.

const DISH_CARD = {
  brodo: { cardId: 'dish-brodo', title: 'The Devil Wears Brodo', numeral: 'XV' },
  beetlejuice: { cardId: 'dish-beetlejuice', title: 'Beet*lejuice', numeral: 'I' },
  ichabod: { cardId: 'dish-ichabod', title: "Ichabod's Crunch", numeral: 'XIII' },
  hex: { cardId: 'dish-hex', title: 'Hex & the City', numeral: 'XVI' },
  aloo: { cardId: 'dish-aloo', title: 'Aloo Boo', numeral: 'XVIII' },
  ghosted: { cardId: 'dish-ghosted', title: 'Ghosted at the Motel', numeral: 'XVII' },
};

export const CAT_CARDS = [
  ['the-fool', '0', 'The Fool'], ['the-magician', 'I', 'The Magician'], ['the-high-priestess', 'II', 'The High Priestess'],
  ['the-empress', 'III', 'The Empress'], ['the-emperor', 'IV', 'The Emperor'], ['the-hierophant', 'V', 'The Hierophant'],
  ['the-lovers', 'VI', 'The Lovers'], ['the-chariot', 'VII', 'The Chariot'], ['strength', 'VIII', 'Strength'],
  ['the-hermit', 'IX', 'The Hermit'], ['wheel-of-fortune', 'X', 'Wheel of Fortune'], ['justice', 'XI', 'Justice'],
  ['the-hanged-one', 'XII', 'The Hanged One'], ['death', 'XIII', 'Death'], ['temperance', 'XIV', 'Temperance'],
  ['the-devil', 'XV', 'The Devil'], ['the-tower', 'XVI', 'The Tower'], ['the-star', 'XVII', 'The Star'],
  ['the-moon', 'XVIII', 'The Moon'], ['the-sun', 'XIX', 'The Sun'], ['judgement', 'XX', 'Judgement'],
  ['the-world', 'XXI', 'The World'], ['the-pet-parade', 'XXII', 'The Pet Parade'], ['the-pass', 'XXIII', 'The Pass'],
].map(([cardId, numeral, title]) => ({ cardId, numeral, title }));

const SIGNS = [
  ['Capricorn', 1, 19], ['Aquarius', 2, 18], ['Pisces', 3, 20], ['Aries', 4, 19], ['Taurus', 5, 20], ['Gemini', 6, 20],
  ['Cancer', 7, 22], ['Leo', 8, 22], ['Virgo', 9, 22], ['Libra', 10, 22], ['Scorpio', 11, 21], ['Sagittarius', 12, 21],
];

export function signFor(birthday) {
  const m = /(\d{1,2})-(\d{1,2})$/.exec(String(birthday || ''));
  if (!m) return null;
  const month = +m[1], day = +m[2];
  const [name] = SIGNS.find(([, mm, last]) => mm === month && day <= last) || SIGNS[month % 12];
  return name;
}

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

export function newSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

export function drawFortune({ name = '', birthday = '', rating = 3, dishes = [], seed = newSeed() } = {}) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const known = dishes.filter((d) => DISH_CARD[d]);
  const dish = known.length ? DISH_CARD[pick(known)] : null; // the cat card is the fortune; the dish is the second card
  const card = pick(CAT_CARDS);
  const cat = dish || pick(CAT_CARDS.filter((c) => c.cardId !== card.cardId));
  const tagline = 'Leap first, ask later';
  const reading = `${name || 'Friend'}, the deck has been waiting for you. Say yes to the weird invitation this winter.`;
  const omen = 'a jar opens on the first try this week';
  const closing = 'See you after dark.';
  const lines = { tagline, text: reading, omen, closing };
  return {
    cardId: card.cardId, title: card.title, numeral: card.numeral, dishName: dish ? dish.title : null,
    cat: { cardId: cat.cardId, title: cat.title, numeral: cat.numeral, name: 'Sgt. Sushi' },
    modeledBy: 'Sgt. Sushi', tagline, reading, omen, closing, lines,
    text: [tagline + '.', reading, `Pantry omen: ${omen}.`, closing].join(' '), seed, stub: true,
  };
}
