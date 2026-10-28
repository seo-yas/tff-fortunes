// The six Halloween dishes (from Jess's build, reference/jess-build/cards.js MENU, unchanged)
// plus the arcana each dish card wears in the event video.
export const MENU = [
  { id: 'brodo', name: 'The Devil Wears Brodo', numeral: 'I', arcana: 'The Devil', desc: 'French onion sipping broth, charred apple cider, roasted garlic, crispy shallots' },
  { id: 'beetlejuice', name: 'Beet*lejuice', numeral: 'II', arcana: 'The Magician', desc: 'Blood-red roasted beet and walnut muhammara, tahini swirl, bat chips' },
  { id: 'ichabod', name: "Ichabod's Crunch", numeral: 'III', arcana: 'The Horseman', desc: 'Apple-butter mustard, pickled red onion, garlic aioli, cider doughnut crumbles', ways: ['Chicken sausage', 'Vegan'] },
  { id: 'hex', name: 'Hex & the City', numeral: 'IV', arcana: 'The Tower', desc: 'NYC street-cart red onion jam, spicy brown mustard, sauerkraut, nigella', ways: ['Beef', 'Vegan'] },
  { id: 'aloo', name: 'Aloo Boo', numeral: 'V', arcana: 'The Phantom', desc: 'Spiced smashed potatoes, tamarind-date glaze, mint-cilantro aioli, fried shallots, sev', ways: ['Beef', 'Vegan'] },
  { id: 'ghosted', name: 'Ghosted at the Motel', numeral: 'VI', arcana: 'The Star', desc: 'Apple-cranberry cider dump cake, cranberry-rosemary syrup, spiced maple pepitas' },
];

// Engine card ids that mean "this dish's card". Only dish ids: since the cat card is the fortune (Yas, 2026-10-28), a cat
// card such as the-star must never be read as the dish card that restages it.
export const DISH_ALIASES = Object.fromEntries(['brodo', 'beetlejuice', 'ichabod', 'hex', 'aloo', 'ghosted'].map((d) => [d, [d, `dish-${d}`]]));

export const RATINGS = ['Meh', 'Fine', 'Good', 'Real good', 'Marry it']; // same labels as the engine

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const SIGNS = [
  ['Capricorn', 1, 19], ['Aquarius', 2, 18], ['Pisces', 3, 20], ['Aries', 4, 19], ['Taurus', 5, 20], ['Gemini', 6, 20],
  ['Cancer', 7, 22], ['Leo', 8, 22], ['Virgo', 9, 22], ['Libra', 10, 22], ['Scorpio', 11, 21], ['Sagittarius', 12, 21],
];

// Sign from month + day. The sign starting in month m runs until SIGNS[m-1]'s last day; after it, the next sign.
export function signFor(month, day) {
  if (!month || !day) return '';
  const [name, , last] = SIGNS[month - 1];
  return day <= last ? name : SIGNS[month % 12][0];
}
