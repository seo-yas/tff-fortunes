// Who's who. Swap these two names if we guessed wrong.
const CATS = { A: "Sgt. Peppers", B: "Sgt. Sushi", both: "Sgt. Peppers & Sgt. Sushi" };

// scene: sky top, sky bottom, motif
const CARDS = [
  { n: "0", title: "The Fool", photo: "1949", cat: "B", sky: ["#e9b864", "#c97b4a"], motif: "sun",
    key: "Leap first, ask later",
    text: "You wandered into a motel parking lot on a Friday night for a hot dog and stayed for the people... that's the whole lesson. Say yes to the weird invitation this winter. The ones who look a little ridiculous are usually having the best time." },
  { n: "I", title: "The Magician", photo: "0816", cat: "B", sky: ["#5d7a6a", "#2f4038"], motif: "stars",
    key: "You already have the ingredients",
    text: "Everything you need is already in the pantry, honey. Stop waiting on the perfect recipe and cook with what's in front of you. The magic lives in the nerve it took to show up wearing that costume." },
  { n: "II", title: "The High Priestess", photo: "8063", cat: "B", sky: ["#3f4a63", "#1f2536"], motif: "moon",
    key: "Trust the gut you fed tonight",
    text: "You know more than you're letting on. That quiet little voice that said come out tonight was right, and it'll be right again in December when everyone wants a piece of you. Keep a few evenings sacred... the soup can wait for you." },
  { n: "III", title: "The Empress", photo: "1323", cat: "A", sky: ["#d9a066", "#a3593a"], motif: "leaves",
    key: "Abundance, belly up",
    text: "This is your sign to be soft. Take the second helping and then take up the whole couch. The season is harvesting and so are you... let people pour into you for once. Plenty is a thing you're allowed to receive." },
  { n: "IV", title: "The Emperor", photo: "4829", cat: "B", sky: ["#b4543a", "#6e2c22"], motif: "sun",
    key: "Hold your ground (and your people)",
    text: "Somebody's got you. Look around this room... these are folks who will carry you when your legs go stiff in February. Build the table you want to sit at and make the rules generous. Structure is just love with good posture." },
  { n: "VI", title: "The Lovers", photo: "1261", cat: "both", sky: ["#c98b7a", "#7c4a4f"], motif: "sun",
    key: "Curl up next to your person",
    text: "Two bodies, one blanket, zero shame. Whoever you curl toward this winter, let them see you mid-yawn. Belonging shows up at your sleepiest... let it. Text the one you're thinking about right now." },
  { n: "VII", title: "The Chariot", photo: "1214", cat: "both", sky: ["#e0b25c", "#9a6b3c"], motif: "hills",
    key: "Two engines, one direction",
    text: "You don't have to pull this year to the finish line alone. Find your other sphinx and steer together, even if one of you is clearly napping on the job. Momentum looks a lot like company." },
  { n: "VIII", title: "Strength", photo: "2354", cat: "A", sky: ["#e4bd73", "#b5774a"], motif: "sun",
    key: "Soft belly, strong heart",
    text: "Real strength is showing your belly in a room full of strangers and trusting nobody's gonna poke it. You made it through a whole year... sprawl out and take up space. Gentleness is the flex, baby." },
  { n: "IX", title: "The Hermit", photo: "2065", cat: "A", sky: ["#4c5a52", "#232b27"], motif: "lantern",
    key: "Go inward, come back warm",
    text: "Curl up. Light one candle. The holidays are loud and you're allowed to leave the party early and call it self respect. Go deep into the quiet for a minute... then come back out and tell us what you found. We'll save you a seat." },
  { n: "X", title: "Wheel of Fortune", photo: "2586", cat: "both", sky: ["#a7b39a", "#5f6e5a"], motif: "wheel",
    key: "What goes around comes back to the table",
    text: "Up, down, belly up, belly down. The year turned on you a few times and here you are anyway, fed and in good company. Luck is just showing up enough times that the wheel lands on you... and tonight it did." },
  { n: "XI", title: "Justice", photo: "6801", cat: "B", sky: ["#8f6a4e", "#4a3527"], motif: "scales",
    key: "You deserve what you ordered",
    text: "That look you just gave your plate? Fair. Weigh things honestly this season, including what you give and what you let yourself take. Settle the beef... and forgive the dump cake for being a little messy." },
  { n: "XII", title: "The Hanged One", photo: "4193", cat: "A", sky: ["#6f8a7c", "#2f4038"], motif: "leaves",
    key: "Hang loose, see it upside down",
    text: "Some seasons ask you to stop pushing and just dangle there. Let the leaves fall. Look at your whole life from the wrong angle for a minute... it's amazing what looks charming from down here. Surrender is a strategy." },
  { n: "XIV", title: "Temperance", photo: "1101", cat: "both", sky: ["#d7b48a", "#9c7a5a"], motif: "cups",
    key: "A little of this, a little of that",
    text: "Mix the sweet with the sharp. Pour a bit of yourself into other people and let them top you back up. This winter, the magic is in the blend... old friends stirred in with the brand new ones from tonight." },
  { n: "XVII", title: "The Star", photo: "2973", cat: "A", sky: ["#2e3a52", "#151b29"], motif: "stars",
    key: "Hope with tinsel on it",
    text: "The lights are coming. After a long, weird year, you get to be hopeful without apologizing for it. Let yourself want things for next year out loud. Somebody under that tree is rooting for you... probably a cat, but still." },
  { n: "XVIII", title: "The Moon", photo: "8061", cat: "B", sky: ["#3a4660", "#141a26"], motif: "moon",
    key: "Not everything has to make sense yet",
    text: "Halloween is the one night it's fine to not know what you are. Let the fog roll in. The path gets clearer when you stop squinting at it... wear the costume, trust your night eyes, and keep walking toward the ones who feel like home." },
  { n: "XIX", title: "The Sun", photo: "4201", cat: "A", sky: ["#f0c766", "#d98b45"], motif: "sun",
    key: "Unbothered and glowing",
    text: "Lie down in the warm spot. Joy is just sitting there on the rug, sugar... waiting for you to roll over into it. Let the short days be bright anyway." },
  { n: "XX", title: "Judgement", photo: "2355", cat: "both", sky: ["#cf9a5c", "#7d4d33"], motif: "sun",
    key: "Somebody's calling your name",
    text: "That itch you've had about a fresh start? Answer it. The end of the year is a good time to rise from the rug and say what you actually want. Forgive last year's version of you... she was doing her best with what was in the fridge." },
  { n: "XXI", title: "The World", photo: "0699", cat: "both", sky: ["#8ba28f", "#4b6352"], motif: "wreath",
    key: "You made it all the way around",
    text: "Full circle and a full belly. Look at you... finishing a whole year and ending it in a motel lot with strangers who are now sort of your people. That's the world, babe. Come sit back down at the table whenever you need it." }
];

// little "pantry omens" for extra flavor, picked at random
const OMENS = [
  "a second bowl of broth", "an unexpected invitation", "apple butter on everything",
  "a long phone call with an old friend", "candlelight on a Tuesday", "the last slice, given away",
  "a borrowed sweater", "a new standing dinner date", "leaves crunching on the way home",
  "a dish you finally nail", "a cat on your lap at the worst possible time", "somebody saving you a seat"
];

const MENU = [
  { id: "brodo", name: "The Devil Wears Brodo", desc: "French onion sipping broth, charred apple cider, roasted garlic, crispy shallots" },
  { id: "beetlejuice", name: "Beet*lejuice", desc: "Blood-red roasted beet and walnut muhammara, tahini swirl, bat chips" },
  { id: "ichabod", name: "Ichabod's Crunch", desc: "Apple-butter mustard, pickled red onion, garlic aioli, cider doughnut crumbles", ways: ["Chicken sausage", "Vegan"] },
  { id: "hex", name: "Hex & the City", desc: "NYC street-cart red onion jam, spicy brown mustard, sauerkraut, nigella", ways: ["Beef", "Vegan"] },
  { id: "aloo", name: "Aloo Boo", desc: "Spiced smashed potatoes, tamarind-date glaze, mint-cilantro aioli, fried shallots, sev", ways: ["Beef", "Vegan"] },
  { id: "ghosted", name: "Ghosted at the Motel", desc: "Apple-cranberry cider dump cake, cranberry-rosemary syrup, spiced maple pepitas" }
];
