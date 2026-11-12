// Order up rules, kept free of the DOM (and of a bare Math.random) so they can
// be tested with node.
//
// Customers queue tickets on a rail. The player takes one ticket at a time to
// the stations: scoop the ice, pour the tea to the ice line, pick each
// topping's jar and drop it from a swinging ladle, shake it, and stamp the seal
// while the sealer is hot. Every station grades out of 100, and the receipt
// mixes those with how long the customer waited. Around that: tea tanks run dry
// and need brewing, free samples buy an impatient guest time, a critic visits
// once a shift, and one tea is the day's special.

export const SHIFT_SECONDS = 120;
export const LIVES = 3;
export const MAX_TICKETS = 3;

export const TEAS = /** @type {const} */ (["milk", "taro", "matcha", "strawberry"]);
/** Shelf order, which is also the order toppings are listed and scooped in. */
export const TOPPINGS = /** @type {const} */ (["pearls", "pudding", "jelly", "redbean"]);
export const ICE = /** @type {const} */ (["none", "light", "full"]);

/** @typedef {typeof TEAS[number]} Tea */
/** @typedef {typeof TOPPINGS[number]} Topping */
/** @typedef {typeof ICE[number]} Ice */
/** @typedef {{ kind: Topping, scoops: number }} ToppingLine */
/** @typedef {{ tea: Tea, ice: Ice, toppings: ToppingLine[] }} Order */
/** @typedef {"hurry" | "patient" | "tipper" | "critic"} Quirk */
/** @typedef {{ name: string, tag: string, quirk?: Quirk, order?: { tea?: Tea, ice?: Ice, toppings?: ToppingLine[] } }} Regular */
/** @typedef {"pour" | "scoop" | "shake" | "seal"} Station */
/** @typedef {"opening" | "steady" | "rush"} Phase */

/**
 * Where the tea should stop, as a share of the cup: more ice, less tea.
 * @type {Record<Ice, number>}
 */
export const FILL_LINE = { none: 0.9, light: 0.75, full: 0.6 };
/** Past 1 the cup is spilling; this is as far as a pour can go. */
export const POUR_MAX = 1.12;
export const SHAKES_NEEDED = 8;
/** A ladle within this of the centre lands in the cup. */
export const CUP_MOUTH = 0.32;
/** A ladle within this of the centre is a clean drop. */
export const CUP_CENTER = 0.14;
/** The ticket being made drains patience slower: they can see you working. */
export const ACTIVE_PATIENCE_RATE = 0.4;

/** @type {Regular[]} */
export const REGULARS = [
  { name: "mochi", tag: "studies here, orders rarely", quirk: "patient" },
  { name: "tofu", tag: "in a hurry, always", quirk: "hurry" },
  { name: "pip", tag: "first boba ever" },
  { name: "bean", tag: "counting out exact change" },
  { name: "juniper", tag: "no ice, ever", order: { ice: "none" } },
  { name: "noodle", tag: "between two classes", quirk: "hurry" },
  { name: "clementine", tag: "tips like it's a wedding", quirk: "tipper" },
  { name: "biscuit", tag: "extra pearls, obviously", order: { toppings: [{ kind: "pearls", scoops: 2 }] } },
  { name: "sesame", tag: "reading the whole menu", quirk: "patient" },
  { name: "dumpling", tag: "taro or nothing", order: { tea: "taro" } },
  { name: "yuzu", tag: "on a call, pointing" },
  { name: "pickles", tag: "brought their own straw" },
  { name: "waffles", tag: "here for the wifi", quirk: "patient" },
  { name: "miso", tag: "all the ice", order: { ice: "full" } },
  { name: "peaches", tag: "training for a marathon", quirk: "hurry" },
  { name: "basil", tag: "matcha purist", order: { tea: "matcha", toppings: [] } },
  { name: "tater", tag: "will photograph it first", quirk: "patient" },
  { name: "olive", tag: "ordering for the group chat" },
  { name: "figgy", tag: "third visit today", quirk: "tipper" },
  { name: "radish", tag: "double-parked outside", quirk: "hurry" },
  { name: "plum", tag: "one stamp from a free drink" },
  { name: "dill", tag: "asks how your day is going", quirk: "patient" },
  { name: "cocoa", tag: "up since four" },
  { name: "nori", tag: "strawberry, for the colour", order: { tea: "strawberry" } },
  { name: "pepper", tag: "late for band practice", quirk: "hurry" },
  { name: "maple", tag: "calls everyone chef", quirk: "tipper" },
  { name: "tangerine", tag: "on a first date" },
  { name: "bao", tag: "just finished an exam", quirk: "tipper" },
  { name: "ginger", tag: "allergic to waiting", quirk: "hurry" },
  { name: "kiwi", tag: "the usual, please", order: { tea: "milk", toppings: [{ kind: "pudding", scoops: 1 }] } },
  { name: "sprout", tag: "can barely see over the counter" },
  { name: "pesto", tag: "writing a novel in the corner", quirk: "patient" },
  { name: "rye", tag: "walked here in the rain" },
  { name: "honey", tag: "knows the playlist by heart" },
  { name: "tahini", tag: "no ice, extra opinions", order: { ice: "none" } },
  { name: "crouton", tag: "skipped lunch for this", quirk: "hurry" },
  { name: "pudding", tag: "orders their namesake", order: { toppings: [{ kind: "pudding", scoops: 1 }] } },
  { name: "lychee", tag: "visiting from out of town", quirk: "tipper" },
  { name: "oats", tag: "new haircut, feeling brave" },
  { name: "chai", tag: "here by mistake, staying anyway", quirk: "patient" },
];

/**
 * One item from a list. The modulo guards against a random() that returns 1.
 * @template T
 * @param {readonly T[]} items
 * @param {() => number} random
 * @returns {T}
 */
function pick(items, random) {
  return items[Math.floor(random() * items.length) % items.length];
}

/**
 * Straight lines between breakpoints, flat past either end. `points` is
 * sorted by x.
 * @param {number} x
 * @param {ReadonlyArray<readonly [number, number]>} points
 */
function piecewise(x, points) {
  if (x <= points[0][0]) return points[0][1];
  for (let index = 1; index < points.length; index++) {
    const [x1, y1] = points[index];
    if (x <= x1) {
      const [x0, y0] = points[index - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}

// --- The shift --------------------------------------------------------------

/**
 * @param {number} elapsed
 * @returns {Phase}
 */
export function phaseForElapsed(elapsed) {
  if (elapsed < 30) return "opening";
  if (elapsed < 80) return "steady";
  return "rush";
}

/**
 * How often customers arrive, how long they wait, how much they pile on, and
 * how fast the ladle swings.
 * @param {number} elapsed
 */
export function paceForElapsed(elapsed) {
  const phase = phaseForElapsed(elapsed);
  if (phase === "opening") {
    return { phase, arrivalEvery: 10, patience: 34, minScoops: 0, maxScoops: 1, swing: 2.4 };
  }
  if (phase === "steady") {
    return { phase, arrivalEvery: 8, patience: 30, minScoops: 1, maxScoops: 2, swing: 3.0 };
  }
  return { phase, arrivalEvery: 6.5, patience: 26, minScoops: 2, maxScoops: 3, swing: 3.6 };
}

/** An empty counter (nobody on the line, no cup in progress) refills this fast. */
export const EMPTY_LINE_WAIT = 0.8;

/**
 * Seconds until the next guest comes through the door. Normally the pace's
 * interval since the last arrival, but a player who has cleared the line
 * never stands around for long: with nobody waiting it is at most
 * EMPTY_LINE_WAIT. Never negative; a full line holding someone at the door is
 * the caller's business.
 * @param {{ arrivalEvery: number }} pace
 * @param {number} waiting guests on the line, counting the one being made
 * @param {number} timer seconds since the last arrival
 */
export function nextArrivalIn(pace, waiting, timer) {
  const due = Math.max(0, pace.arrivalEvery - timer);
  return waiting === 0 ? Math.min(due, EMPTY_LINE_WAIT) : due;
}

/** @param {number} elapsed */
export function timeRemaining(elapsed) {
  return Math.max(0, Math.ceil(SHIFT_SECONDS - elapsed));
}

// --- Customers and orders ------------------------------------------------------

/**
 * A regular who is not already at the counter. If everyone is, anyone will do,
 * so the rail never stalls.
 * @param {string[]} exclude names to skip
 * @param {() => number} [random]
 * @returns {Regular}
 */
export function pickRegular(exclude, random = Math.random) {
  const free = REGULARS.filter((regular) => !exclude.includes(regular.name));
  return pick(free.length ? free : REGULARS, random);
}

/**
 * A random drink for this point in the shift, with a regular's usual order
 * laid over the top of it. The critic always orders the most toppings the
 * phase allows, to see how the place holds up.
 * @param {number} elapsed
 * @param {Regular | null} [regular]
 * @param {() => number} [random]
 * @returns {Order}
 */
export function makeOrder(elapsed, regular = null, random = Math.random) {
  const { minScoops, maxScoops } = paceForElapsed(elapsed);
  const tea = pick(TEAS, random);
  const ice = pick(ICE, random);
  const span = maxScoops - minScoops + 1;
  const scoops =
    regular?.quirk === "critic" ? maxScoops : minScoops + (Math.floor(random() * span) % span);

  /** @type {ToppingLine[]} */
  let toppings = [];
  if (scoops > 0) {
    const first = pick(TOPPINGS, random);
    if (scoops >= 2 && random() < 0.5) {
      // Two kinds, never the same one twice: a main topping and a single extra.
      const second = pick(TOPPINGS.filter((kind) => kind !== first), random);
      toppings = [
        { kind: first, scoops: scoops - 1 },
        { kind: second, scoops: 1 },
      ];
    } else {
      toppings = [{ kind: first, scoops }];
    }
    toppings.sort((a, b) => TOPPINGS.indexOf(a.kind) - TOPPINGS.indexOf(b.kind));
  }

  const usual = regular?.order;
  return {
    tea: usual?.tea ?? tea,
    ice: usual?.ice ?? ice,
    toppings: usual?.toppings ? usual.toppings.map((line) => ({ ...line })) : toppings,
  };
}

/** @param {Order} order */
export function totalScoops(order) {
  return order.toppings.reduce((total, line) => total + line.scoops, 0);
}

/**
 * Seconds a customer will wait. Bigger orders buy more time, since they take
 * longer to make.
 * @param {Order} order
 * @param {Regular | null} regular
 * @param {number} elapsed
 */
export function patienceFor(order, regular, elapsed) {
  const base = paceForElapsed(elapsed).patience + 3 * totalScoops(order);
  if (regular?.quirk === "hurry") return base * 0.7;
  if (regular?.quirk === "patient") return base * 1.4;
  if (regular?.quirk === "critic") return base * 0.9;
  return base;
}

/**
 * The stations this drink visits, in order. A drink without toppings skips
 * the ladle. Ice goes in at the pour station, before the tea.
 * @param {Order} order
 * @returns {Station[]}
 */
export function stationsFor(order) {
  return totalScoops(order) > 0 ? ["pour", "scoop", "shake", "seal"] : ["pour", "shake", "seal"];
}

/**
 * Every scoop to drop, one entry each, in shelf order.
 * @param {Order} order
 * @returns {Topping[]}
 */
export function scoopQueue(order) {
  return order.toppings.flatMap((line) => Array(line.scoops).fill(line.kind));
}

// --- Ice: scooped in by hand before the pour ----------------------------------

/** @type {Record<Ice, number>} */
export const ICE_SCOOPS = { none: 0, light: 1, full: 2 };
/** The most the bin will give one cup. */
export const ICE_MAX = 3;

/**
 * One scoop off is a near miss the guest will notice; two off is a different
 * drink.
 * @param {number} count scoops the player put in
 * @param {Ice} ice
 */
export function iceGrade(count, ice) {
  const off = Math.abs(count - ICE_SCOOPS[ice]);
  if (off === 0) return 100;
  if (off === 1) return 40;
  return 0;
}

// --- Pour: hold to pour, release at the line ---------------------------------------

/**
 * The stream picks up the longer it is held, so a long hold overshoots.
 * @param {number} heldSeconds
 * @returns {number} cup-shares per second
 */
export function pourRate(heldSeconds) {
  return 0.35 + 0.2 * Math.min(1, heldSeconds / 1.5);
}

/**
 * @param {number} level
 * @param {number} heldSeconds
 * @param {number} dt
 */
export function stepPour(level, heldSeconds, dt) {
  return Math.min(POUR_MAX, level + pourRate(heldSeconds) * dt);
}

/**
 * How close the pour stopped to the ice line. Overfilling counts a little
 * further off than stopping short, because it spills.
 * @param {number} level
 * @param {Ice} ice
 */
export function pourGrade(level, ice) {
  const line = FILL_LINE[ice];
  const err = level > line ? (level - line) * 1.3 : line - level;
  return Math.round(
    piecewise(err, [
      [0.03, 100],
      [0.07, 80],
      [0.14, 50],
      [0.35, 0],
    ]),
  );
}

// --- Scoop: a ladle swings over the cup, press to drop -------------------------

/**
 * Where the ladle is, from -1 to 1; 0 is over the middle of the cup.
 * @param {number} time
 * @param {number} swing
 * @param {number} [offset]
 */
export function ladleAt(time, swing, offset = 0) {
  return Math.sin(swing * time + offset);
}

/**
 * @param {number} x where the ladle was when dropped
 * @returns {"clean" | "rim" | "miss"}
 */
export function scoopResult(x) {
  const distance = Math.abs(x);
  if (distance <= CUP_CENTER) return "clean";
  if (distance <= CUP_MOUTH) return "rim";
  return "miss";
}

/** @param {number} x */
export function scoopGrade(x) {
  const result = scoopResult(x);
  if (result === "clean") return 100;
  if (result === "rim") return 60;
  return 0;
}

/**
 * A drop from the wrong jar is worth nothing however well it lands; from the
 * right jar it is graded by where the ladle was.
 * @param {Topping} wanted
 * @param {Topping} chosen
 * @param {number} x where the ladle was when dropped
 * @returns {{ result: "clean" | "rim" | "miss" | "wrong", grade: number }}
 */
export function judgeScoop(wanted, chosen, x) {
  if (chosen !== wanted) return { result: "wrong", grade: 0 };
  return { result: scoopResult(x), grade: scoopGrade(x) };
}

// --- Shake: mash until it is mixed ---------------------------------------------

/**
 * A quick shake is a good one. Even a slow shake mixes the drink, so the grade
 * bottoms out at 30 rather than 0.
 * @param {number} seconds from the first shake to the last
 */
export function shakeGrade(seconds) {
  return Math.round(
    piecewise(seconds, [
      [1.4, 100],
      [3, 60],
      [5, 30],
    ]),
  );
}

// --- Seal: stamp while the sealer is hot enough --------------------------------

/** Seconds for the needle to rise and fall once. */
export const SEAL_PERIOD = 1.1;
/** The good part of the gauge, 0 cold to 1 scorching. */
export const SEAL_BAND = /** @type {const} */ ([0.68, 0.86]);
/** How far outside the band still counts as close. */
const SEAL_NEAR = 0.1;

/**
 * The gauge needle: a triangle wave from 0 up to 1 and back, so it moves at a
 * steady speed the player can learn. Starts cold at time 0.
 * @param {number} time
 */
export function sealNeedle(time) {
  const cycle = time / SEAL_PERIOD;
  const phase = cycle - Math.floor(cycle);
  return phase < 0.5 ? 2 * phase : 2 - 2 * phase;
}

/**
 * @param {number} value needle position when stamped
 * @returns {"sealed" | "loose" | "scorched"}
 */
export function sealResult(value) {
  if (value < SEAL_BAND[0]) return "loose";
  if (value > SEAL_BAND[1]) return "scorched";
  return "sealed";
}

/**
 * A loose or scorched lid still holds the drink, so even a bad stamp keeps 40.
 * The tiny allowance keeps float error from moving the near edge.
 * @param {number} value
 */
export function sealGrade(value) {
  const off = Math.max(SEAL_BAND[0] - value, value - SEAL_BAND[1], 0);
  if (off === 0) return 100;
  if (off <= SEAL_NEAR + 1e-9) return 70;
  return 40;
}

// --- Tanks: every pour drains its tea, an empty tank brews ------------------------

/** Cup-shares in a full tank, about four drinks. */
export const TANK_CAPACITY = 3.2;
/** At or below this the tap warns. */
export const TANK_LOW = 0.9;
export const BREW_SECONDS = 5;

/**
 * A tap can only give what is left, so a pour from a nearly empty tank comes
 * up short.
 * @param {number} tank cup-shares left
 * @param {number} amount cup-shares asked for
 */
export function drawFromTank(tank, amount) {
  const poured = Math.max(0, Math.min(amount, tank));
  return { poured, tank: Math.max(0, tank - poured) };
}

/**
 * @param {number} tank
 * @returns {"empty" | "low" | "ok"}
 */
export function tankState(tank) {
  if (tank <= 0.001) return "empty";
  if (tank <= TANK_LOW) return "low";
  return "ok";
}

// --- Samples: a free taste buys patience -------------------------------------------

export const SAMPLES_PER_SHIFT = 3;
/** Share of a guest's full patience that a sample gives back. */
export const SAMPLE_BOOST = 0.4;

/**
 * @param {number} left seconds of patience the guest has left
 * @param {number} patience their full patience
 */
export function sampleBoost(left, patience) {
  return Math.min(patience, left + SAMPLE_BOOST * patience);
}

/**
 * Who most needs a sample: the guest closest to walking out as a share of
 * their own patience, since a patient guest with ten seconds left is fine and
 * a hurried one is not. `exceptId` skips someone, such as the drink in hand.
 * @param {Array<{ id: unknown, left: number, patience: number }>} guests
 * @param {unknown} [exceptId]
 * @returns {number} an index into guests, or -1 when there is nobody
 */
export function mostImpatient(guests, exceptId = null) {
  let best = -1;
  let bestFraction = Infinity;
  guests.forEach((guest, index) => {
    if (exceptId !== null && guest.id === exceptId) return;
    const fraction = guest.left / guest.patience;
    if (fraction < bestFraction) {
      best = index;
      bestFraction = fraction;
    }
  });
  return best;
}

/** A guest above this share of their patience doesn't need a sample yet. */
export const SAMPLE_WORTH = 0.85;

/**
 * Who a sample should go to: the most impatient guest (skipping `exceptId`),
 * but only if they are below SAMPLE_WORTH of their patience, so a sample is
 * never spent on someone happy to wait.
 * @param {Array<{ id: unknown, left: number, patience: number }>} guests
 * @param {unknown} [exceptId]
 * @returns {number} an index into guests, or -1 when nobody needs one
 */
export function sampleTarget(guests, exceptId = null) {
  const index = mostImpatient(guests, exceptId);
  if (index < 0) return -1;
  const guest = guests[index];
  return guest.left / guest.patience < SAMPLE_WORTH ? index : -1;
}

// --- The critic and the special -------------------------------------------------------

/** @type {Regular} */
export const CRITIC = { name: "the critic", tag: "writes for the weekly", quirk: "critic" };
/** The first guest at or after this many seconds is the critic, once a shift. */
export const CRITIC_AT = 40;

/**
 * @param {number} elapsed
 * @param {boolean} seen whether the critic has already come in this shift
 */
export function criticDue(elapsed, seen) {
  return !seen && elapsed >= CRITIC_AT;
}

/** Extra points for serving the day's special tea. */
export const SPECIAL_BONUS = 2;

/**
 * Today's special, one of the teas.
 * @param {() => number} [random]
 * @returns {Tea}
 */
export function pickSpecial(random = Math.random) {
  return pick(TEAS, random);
}

// --- The receipt -----------------------------------------------------------------

/** @param {number} grade */
export function gradeWord(grade) {
  if (grade >= 95) return "spot on";
  if (grade >= 80) return "good";
  if (grade >= 55) return "fine";
  return "sloppy";
}

/**
 * Grades a finished drink. The wrong tea is sent back outright; anything else
 * is accepted and marked on how well each station went and how long it took.
 * `drops` holds each scoop's grade (judgeScoop's grade, so a wrong jar is 0).
 * @param {{ order: Order, tea: Tea, iceCount: number, level: number, drops: number[], shakeSeconds: number, sealValue: number, patienceFraction: number }} drink
 */
export function gradeDrink({ order, tea, iceCount, level, drops, shakeSeconds, sealValue, patienceFraction }) {
  if (tea !== order.tea) {
    return {
      accepted: false, reason: "wrong-tea", ice: 0, pour: 0, scoop: null, shake: 0, seal: 0, wait: 0, total: 0,
    };
  }
  const ice = iceGrade(iceCount, order.ice);
  const pour = pourGrade(level, order.ice);
  const scoop =
    totalScoops(order) > 0
      ? Math.round(drops.reduce((total, grade) => total + grade, 0) / Math.max(1, drops.length))
      : null;
  const shake = shakeGrade(shakeSeconds);
  const seal = sealGrade(sealValue);
  const wait = patienceFraction >= 0.5 ? 100 : Math.round(50 + patienceFraction * 100);
  const grades = scoop === null ? [ice, pour, shake, seal] : [ice, pour, scoop, shake, seal];
  const quality = grades.reduce((total, grade) => total + grade, 0) / grades.length;
  const total = Math.round(0.8 * quality + 0.2 * wait);
  return { accepted: true, reason: null, ice, pour, scoop, shake, seal, wait, total };
}

/**
 * Points for a served drink: a base from its grade, a tip for a good one, a
 * bonus for keeping good drinks coming, a little extra for the day's special,
 * and double (plus a rave for a near-perfect drink) when the critic is served.
 * @param {number} total the receipt's total, 0–100
 * @param {Regular | null} regular
 * @param {number} streak drinks in a row graded 80 or better, including this one
 * @param {boolean} [special] whether the drink's tea is today's special
 */
export function pointsForDrink(total, regular, streak, special = false) {
  const critic = regular?.quirk === "critic";
  let base = Math.max(1, Math.round(total / 10));
  let tip = total >= 90 ? 3 : total >= 80 ? 1 : 0;
  if (regular?.quirk === "tipper") tip *= 2;
  if (regular?.quirk === "hurry") tip = Math.ceil(tip * 1.5);
  if (critic) {
    base *= 2;
    tip *= 2;
  }
  const streakBonus = total >= 80 ? Math.min(3, Math.floor(streak / 3)) : 0;
  const specialBonus = special ? SPECIAL_BONUS : 0;
  const criticBonus = critic && total >= 95 ? 5 : 0;
  return {
    points: base + tip + streakBonus + specialBonus + criticBonus,
    base,
    tip,
    streakBonus,
    specialBonus,
    criticBonus,
  };
}

/** @param {number} total */
export function keepsStreak(total) {
  return total >= 80;
}
