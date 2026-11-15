// Order up rules, kept free of the DOM (and of a bare Math.random) so they can
// be tested with node.
//
// Guests walk up to the counter, hand over a ticket that goes up on the rail,
// and wait. Every order sets a tea, a sugar level and an ice level the way a
// boba shop tickets them ("50% sugar, less ice"), and maybe toppings. The
// player takes one ticket at a time to the stations: drop the ice cubes in,
// pump the syrup, pour the tea to the ice line, pick each topping's jar and drop it from a swinging ladle, shake
// it, and stamp the seal while the sealer is hot. Every station grades out of
// 100, and the receipt mixes those with how long the guest waited. Around that:
// tea tanks run dry and need brewing, free samples buy an impatient guest time,
// a critic visits, and one tea is the day's special.
//
// Serving well pays three ways: good drinks in a row climb a combo that
// multiplies a drink's points, tips drop into a jar that pays a bonus (and buys
// back a lost pearl) when it fills, and a perfect drink cheers the whole line,
// buying everyone waiting a little patience. Guests' faces follow all of it.
//
// Expert mode is a lot harder, and every rule that changes takes an `expert`
// flag (false by default) so the same functions and tests cover both.

export const SHIFT_SECONDS = 120;
export const LIVES = 3;
export const MAX_TICKETS = 3;

/**
 * What changes in expert mode: more guests on the rail at once, fewer
 * samples, every grading window tighter, the ladle and the sealer faster,
 * the critic twice, and patience shorter (see paceForElapsed).
 */
export const RULES = {
  normal: {
    maxTickets: 3,
    samples: 3,
    cupCenter: 0.14,
    cupMouth: 0.32,
    sealPeriod: 1.1,
    sealBand: /** @type {readonly [number, number]} */ ([0.68, 0.86]),
    sealNear: 0.1,
    /** Pour error (as a share of the cup) graded 100, 80, 50 and 0. */
    pourSteps: /** @type {readonly number[]} */ ([0.03, 0.07, 0.14, 0.35]),
    /** Shake seconds graded 100, 60 and 30. */
    shakeSteps: /** @type {readonly number[]} */ ([1.4, 3, 5]),
    /** Ice one cube off, and two off; the same for sugar a pump off. */
    iceOff: /** @type {readonly number[]} */ ([60, 25]),
    activeRate: 0.4,
    critics: /** @type {readonly number[]} */ ([40]),
    comboSteps: /** @type {readonly number[]} */ ([3, 6]),
    cheer: 0.15,
  },
  expert: {
    maxTickets: 4,
    samples: 2,
    cupCenter: 0.1,
    cupMouth: 0.26,
    sealPeriod: 0.8,
    sealBand: /** @type {readonly [number, number]} */ ([0.71, 0.83]),
    sealNear: 0.07,
    pourSteps: /** @type {readonly number[]} */ ([0.02, 0.05, 0.1, 0.25]),
    shakeSteps: /** @type {readonly number[]} */ ([1.1, 2.4, 4]),
    iceOff: /** @type {readonly number[]} */ ([40, 0]),
    activeRate: 0.55,
    critics: /** @type {readonly number[]} */ ([35, 85]),
    comboSteps: /** @type {readonly number[]} */ ([3, 6, 10]),
    cheer: 0.1,
  },
};

/** @param {boolean} [expert] */
export function rulesFor(expert = false) {
  return expert ? RULES.expert : RULES.normal;
}

export const TEAS = /** @type {const} */ (["milk", "taro", "matcha", "strawberry"]);
/** Shelf order, which is also the order toppings are listed and scooped in. */
export const TOPPINGS = /** @type {const} */ (["pearls", "pudding", "jelly", "redbean"]);
export const ICE = /** @type {const} */ (["none", "less", "regular", "extra"]);
/** Sugar, as a share of a full sweet drink. */
export const SUGARS = /** @type {const} */ ([0, 25, 50, 75, 100]);

/** @typedef {typeof TEAS[number]} Tea */
/** @typedef {typeof TOPPINGS[number]} Topping */
/** @typedef {typeof ICE[number]} Ice */
/** @typedef {typeof SUGARS[number]} Sugar */
/** @typedef {{ kind: Topping, scoops: number }} ToppingLine */
/** @typedef {{ tea: Tea, sugar: Sugar, ice: Ice, toppings: ToppingLine[] }} Order */
/** @typedef {"hurry" | "patient" | "tipper" | "critic"} Quirk */
/** @typedef {{ name: string, tag: string, quirk?: Quirk, order?: { tea?: Tea, sugar?: Sugar, ice?: Ice, toppings?: ToppingLine[] } }} Regular */
/** @typedef {"ice" | "sugar" | "pour" | "scoop" | "shake" | "seal"} Station */
/** @typedef {"opening" | "steady" | "rush"} Phase */

/**
 * Where the tea should stop, as a share of the cup: more ice, less tea.
 * @type {Record<Ice, number>}
 */
export const FILL_LINE = { none: 0.9, less: 0.8, regular: 0.7, extra: 0.6 };
/** Past 1 the cup is spilling; this is as far as a pour can go. */
export const POUR_MAX = 1.12;
export const SHAKES_NEEDED = 8;
/** A ladle within this of the centre lands in the cup (expert: RULES.expert). */
export const CUP_MOUTH = RULES.normal.cupMouth;
/** A ladle within this of the centre is a clean drop. */
export const CUP_CENTER = RULES.normal.cupCenter;
/** The ticket being made drains patience slower: they can see you working. */
export const ACTIVE_PATIENCE_RATE = RULES.normal.activeRate;

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
  { name: "miso", tag: "all the ice", order: { ice: "extra" } },
  { name: "peaches", tag: "training for a marathon", quirk: "hurry", order: { sugar: 25 } },
  { name: "basil", tag: "matcha purist", order: { tea: "matcha", sugar: 0, toppings: [] } },
  { name: "tater", tag: "will photograph it first", quirk: "patient" },
  { name: "olive", tag: "ordering for the group chat" },
  { name: "figgy", tag: "third visit today", quirk: "tipper" },
  { name: "radish", tag: "double-parked outside", quirk: "hurry" },
  { name: "plum", tag: "one stamp from a free drink" },
  { name: "dill", tag: "asks how your day is going", quirk: "patient" },
  { name: "cocoa", tag: "up since four", order: { sugar: 100 } },
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
 * how fast the ladle swings. Expert sends guests much faster, with far less
 * patience, a scoop more on every drink, and a quicker ladle.
 * @param {number} elapsed
 * @param {boolean} [expert]
 */
export function paceForElapsed(elapsed, expert = false) {
  const phase = phaseForElapsed(elapsed);
  if (expert) {
    if (phase === "opening") {
      return { phase, arrivalEvery: 7.5, patience: 24, minScoops: 1, maxScoops: 2, swing: 3.1 };
    }
    if (phase === "steady") {
      return { phase, arrivalEvery: 6, patience: 21, minScoops: 2, maxScoops: 3, swing: 3.9 };
    }
    return { phase, arrivalEvery: 5, patience: 18, minScoops: 3, maxScoops: 4, swing: 4.7 };
  }
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
 * phase allows, to see how the place holds up. In expert a loaded drink is
 * more often split across two jars.
 * @param {number} elapsed
 * @param {Regular | null} [regular]
 * @param {() => number} [random]
 * @param {boolean} [expert]
 * @returns {Order}
 */
export function makeOrder(elapsed, regular = null, random = Math.random, expert = false) {
  const { minScoops, maxScoops } = paceForElapsed(elapsed, expert);
  const tea = pick(TEAS, random);
  const ice = pick(ICE, random);
  const sugar = pick(SUGARS, random);
  const span = maxScoops - minScoops + 1;
  const scoops =
    regular?.quirk === "critic" ? maxScoops : minScoops + (Math.floor(random() * span) % span);

  /** @type {ToppingLine[]} */
  let toppings = [];
  if (scoops > 0) {
    const first = pick(TOPPINGS, random);
    if (scoops >= 2 && random() < (expert ? 0.75 : 0.5)) {
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
    sugar: usual?.sugar ?? sugar,
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
 * @param {boolean} [expert]
 */
export function patienceFor(order, regular, elapsed, expert = false) {
  const base = paceForElapsed(elapsed, expert).patience + 3 * totalScoops(order);
  if (regular?.quirk === "hurry") return base * 0.7;
  if (regular?.quirk === "patient") return base * 1.4;
  if (regular?.quirk === "critic") return base * 0.9;
  return base;
}

/**
 * How fast the guest whose drink is on the bench loses patience, against
 * everyone else: they can see it being made.
 * @param {boolean} [expert]
 */
export function activePatienceRate(expert = false) {
  return rulesFor(expert).activeRate;
}

/**
 * The stations this drink visits, in order. Ice goes in first, cube by cube,
 * then the syrup, pump by pump, unless the order wants none of either; a
 * drink without toppings skips the ladle.
 * @param {Order} order
 * @returns {Station[]}
 */
export function stationsFor(order) {
  /** @type {Station[]} */
  const list = [];
  if (ICE_CUBES[order.ice] > 0) list.push("ice");
  if (sugarPumps(order.sugar) > 0) list.push("sugar");
  list.push("pour");
  if (totalScoops(order) > 0) list.push("scoop");
  list.push("shake", "seal");
  return list;
}

/**
 * Every scoop to drop, one entry each, in shelf order.
 * @param {Order} order
 * @returns {Topping[]}
 */
export function scoopQueue(order) {
  return order.toppings.flatMap((line) => Array(line.scoops).fill(line.kind));
}

// --- Ice: dropped in cube by cube before the pour ------------------------------

/**
 * Cubes each order asks for. One press drops one cube, the ticket shows one
 * cube icon per cube, and the cup marks one slot per cube, so the three
 * always agree.
 * @type {Record<Ice, number>}
 */
export const ICE_CUBES = { none: 0, less: 2, regular: 3, extra: 4 };
/** The most the cup will hold. */
export const ICE_MAX = 6;

/**
 * Right on is 100; a cube off is a near miss the guest will notice, two off
 * is barely their drink, and three off is a different drink. Expert marks a
 * cube off harder and two off as nothing.
 * @param {number} count cubes the player put in
 * @param {Ice} ice
 * @param {boolean} [expert]
 */
export function iceGrade(count, ice, expert = false) {
  const off = Math.abs(count - ICE_CUBES[ice]);
  if (off === 0) return 100;
  const [one, two] = rulesFor(expert).iceOff;
  if (off === 1) return one;
  if (off === 2) return two;
  return 0;
}

/**
 * How the ice stands against the order, for the cup's marks and the prompt.
 * @param {number} count
 * @param {Ice} ice
 * @returns {"short" | "right" | "over"}
 */
export function iceState(count, ice) {
  const target = ICE_CUBES[ice];
  if (count < target) return "short";
  if (count > target) return "over";
  return "right";
}

// --- Sugar: pumped from the syrup bottle, one pump a quarter ------------------

/** Each pump of syrup is this much sugar. */
export const SUGAR_STEP = 25;
/** The pump gives no more than this to one cup. */
export const SUGAR_MAX = 6;

/**
 * Pumps for a sugar level: 25% is one, 100% is four.
 * @param {number} sugar
 */
export function sugarPumps(sugar) {
  return Math.round(sugar / SUGAR_STEP);
}

/**
 * Graded like the ice: right on is 100, a pump off is noticed, two off is
 * barely their drink, three off is someone else's. Syrup can't be taken
 * back out, so too sweet stays too sweet. Expert marks a pump off harder.
 * @param {number} count pumps the player gave
 * @param {number} sugar
 * @param {boolean} [expert]
 */
export function sugarGrade(count, sugar, expert = false) {
  const off = Math.abs(count - sugarPumps(sugar));
  if (off === 0) return 100;
  const [one, two] = rulesFor(expert).iceOff;
  if (off === 1) return one;
  if (off === 2) return two;
  return 0;
}

/**
 * @param {number} count
 * @param {number} sugar
 * @returns {"short" | "right" | "over"}
 */
export function sugarState(count, sugar) {
  const target = sugarPumps(sugar);
  if (count < target) return "short";
  if (count > target) return "over";
  return "right";
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
 * further off than stopping short, because it spills. Expert's windows are
 * tighter.
 * @param {number} level
 * @param {Ice} ice
 * @param {boolean} [expert]
 */
export function pourGrade(level, ice, expert = false) {
  const line = FILL_LINE[ice];
  const err = level > line ? (level - line) * 1.3 : line - level;
  const [exact, near, far, none] = rulesFor(expert).pourSteps;
  return Math.round(
    piecewise(err, [
      [exact, 100],
      [near, 80],
      [far, 50],
      [none, 0],
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
 * @param {boolean} [expert] a smaller cup mouth and centre
 * @returns {"clean" | "rim" | "miss"}
 */
export function scoopResult(x, expert = false) {
  const { cupCenter, cupMouth } = rulesFor(expert);
  const distance = Math.abs(x);
  if (distance <= cupCenter) return "clean";
  if (distance <= cupMouth) return "rim";
  return "miss";
}

/**
 * @param {number} x
 * @param {boolean} [expert]
 */
export function scoopGrade(x, expert = false) {
  const result = scoopResult(x, expert);
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
 * @param {boolean} [expert]
 * @returns {{ result: "clean" | "rim" | "miss" | "wrong", grade: number }}
 */
export function judgeScoop(wanted, chosen, x, expert = false) {
  if (chosen !== wanted) return { result: "wrong", grade: 0 };
  return { result: scoopResult(x, expert), grade: scoopGrade(x, expert) };
}

// --- Shake: mash until it is mixed ---------------------------------------------

/**
 * A quick shake is a good one. Even a slow shake mixes the drink, so the grade
 * bottoms out at 30 rather than 0. Expert wants it quicker.
 * @param {number} seconds from the first shake to the last
 * @param {boolean} [expert]
 */
export function shakeGrade(seconds, expert = false) {
  const [quick, slow, slowest] = rulesFor(expert).shakeSteps;
  return Math.round(
    piecewise(seconds, [
      [quick, 100],
      [slow, 60],
      [slowest, 30],
    ]),
  );
}

// --- Seal: stamp while the sealer is hot enough --------------------------------

/** Seconds for the needle to rise and fall once (expert: RULES.expert.sealPeriod). */
export const SEAL_PERIOD = RULES.normal.sealPeriod;
/** The good part of the gauge, 0 cold to 1 scorching (expert: narrower). */
export const SEAL_BAND = RULES.normal.sealBand;

/**
 * The gauge needle: a triangle wave from 0 up to 1 and back, so it moves at a
 * steady speed the player can learn. Starts cold at time 0.
 * @param {number} time
 * @param {boolean} [expert] a quicker needle
 */
export function sealNeedle(time, expert = false) {
  const cycle = time / rulesFor(expert).sealPeriod;
  const phase = cycle - Math.floor(cycle);
  return phase < 0.5 ? 2 * phase : 2 - 2 * phase;
}

/**
 * @param {number} value needle position when stamped
 * @param {boolean} [expert]
 * @returns {"sealed" | "loose" | "scorched"}
 */
export function sealResult(value, expert = false) {
  const band = rulesFor(expert).sealBand;
  if (value < band[0]) return "loose";
  if (value > band[1]) return "scorched";
  return "sealed";
}

/**
 * A loose or scorched lid still holds the drink, so even a bad stamp keeps 40.
 * The tiny allowance keeps float error from moving the near edge.
 * @param {number} value
 * @param {boolean} [expert]
 */
export function sealGrade(value, expert = false) {
  const { sealBand: band, sealNear } = rulesFor(expert);
  const off = Math.max(band[0] - value, value - band[1], 0);
  if (off === 0) return 100;
  if (off <= sealNear + 1e-9) return 70;
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

export const SAMPLES_PER_SHIFT = RULES.normal.samples;

/** Samples in a shift: fewer in expert. @param {boolean} [expert] */
export function samplesFor(expert = false) {
  return rulesFor(expert).samples;
}

/** Tickets the rail holds at once: more in expert. @param {boolean} [expert] */
export function maxTickets(expert = false) {
  return rulesFor(expert).maxTickets;
}

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
/** The first guest at or after this many seconds is the critic, once a shift (twice in expert). */
export const CRITIC_AT = RULES.normal.critics[0];

/**
 * Whether the next guest through the door is the critic.
 * @param {number} elapsed
 * @param {boolean | number} seen how many times the critic has come in this shift (true is once)
 * @param {boolean} [expert]
 */
export function criticDue(elapsed, seen, expert = false) {
  const count = typeof seen === "number" ? seen : seen ? 1 : 0;
  const at = rulesFor(expert).critics[count];
  return at !== undefined && elapsed >= at;
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
 * `sugarCount` is the pumps of syrup given (left out, the order's own: right on).
 * @param {{ order: Order, tea: Tea, iceCount: number, sugarCount?: number, level: number, drops: number[], shakeSeconds: number, sealValue: number, patienceFraction: number, expert?: boolean }} drink
 */
export function gradeDrink({
  order, tea, iceCount, sugarCount = sugarPumps(order.sugar), level, drops, shakeSeconds, sealValue, patienceFraction,
  expert = false,
}) {
  if (tea !== order.tea) {
    return {
      accepted: false, reason: "wrong-tea", ice: 0, sugar: 0, pour: 0, scoop: null, shake: 0, seal: 0, wait: 0, total: 0,
    };
  }
  const ice = iceGrade(iceCount, order.ice, expert);
  const sugar = sugarGrade(sugarCount, order.sugar, expert);
  const pour = pourGrade(level, order.ice, expert);
  const scoop =
    totalScoops(order) > 0
      ? Math.round(drops.reduce((total, grade) => total + grade, 0) / Math.max(1, drops.length))
      : null;
  const shake = shakeGrade(shakeSeconds, expert);
  const seal = sealGrade(sealValue, expert);
  const wait = patienceFraction >= 0.5 ? 100 : Math.round(50 + patienceFraction * 100);
  const grades = scoop === null ? [ice, sugar, pour, shake, seal] : [ice, sugar, pour, scoop, shake, seal];
  const quality = grades.reduce((total, grade) => total + grade, 0) / grades.length;
  const total = Math.round(0.8 * quality + 0.2 * wait);
  return { accepted: true, reason: null, ice, sugar, pour, scoop, shake, seal, wait, total };
}

// --- The payoff: the combo, the tip jar, and the line cheering ------------------------

/** @param {number} total */
export function keepsStreak(total) {
  return total >= 80;
}

/**
 * The combo multiplier for a streak of good drinks: ×2 from the third in a
 * row, ×3 from the sixth, and in expert ×4 from the tenth.
 * @param {number} streak drinks in a row graded 80 or better, including this one
 * @param {boolean} [expert]
 */
export function comboFor(streak, expert = false) {
  const steps = rulesFor(expert).comboSteps;
  let multiplier = 1;
  for (const step of steps) if (streak >= step) multiplier += 1;
  return multiplier;
}

/**
 * Where a streak stands on the way to the next multiplier, for the score
 * ticket's pips: `filled` of `span` drinks done since the last step, or a
 * span of 0 at the top.
 * @param {number} streak
 * @param {boolean} [expert]
 */
export function comboProgress(streak, expert = false) {
  const steps = rulesFor(expert).comboSteps;
  const multiplier = comboFor(streak, expert);
  const from = multiplier === 1 ? 0 : steps[multiplier - 2];
  const to = steps[multiplier - 1];
  if (to === undefined) return { multiplier, filled: 0, span: 0 };
  return { multiplier, filled: streak - from, span: to - from };
}

/**
 * Points for a served drink: a base from its grade, a tip for a good one, a
 * little extra for the day's special, and double (plus a rave for a
 * near-perfect drink) when the critic is served, all multiplied by the combo
 * when the drink keeps the streak. The tip also drops into the jar as coins.
 * @param {number} total the receipt's total, 0–100
 * @param {Regular | null} regular
 * @param {number} streak drinks in a row graded 80 or better, including this one
 * @param {boolean} [special] whether the drink's tea is today's special
 * @param {boolean} [expert]
 */
export function pointsForDrink(total, regular, streak, special = false, expert = false) {
  const critic = regular?.quirk === "critic";
  let base = Math.max(1, Math.round(total / 10));
  let tip = total >= 90 ? 3 : total >= 80 ? 1 : 0;
  if (regular?.quirk === "tipper") tip *= 2;
  if (regular?.quirk === "hurry") tip = Math.ceil(tip * 1.5);
  if (critic) {
    base *= 2;
    tip *= 2;
  }
  const specialBonus = special ? SPECIAL_BONUS : 0;
  const criticBonus = critic && total >= 95 ? 5 : 0;
  const multiplier = keepsStreak(total) ? comboFor(streak, expert) : 1;
  return {
    points: (base + tip + specialBonus + criticBonus) * multiplier,
    base,
    tip,
    specialBonus,
    criticBonus,
    multiplier,
    coins: tip,
  };
}

/** Coins that fill the tip jar. */
export const JAR_SIZE = 12;
/** Points a full jar pays out. */
export const JAR_BONUS = 25;

/**
 * Drops coins into the jar. Each time it fills it pays out and starts again
 * from what spilled over.
 * @param {number} jar coins in the jar
 * @param {number} coins coins dropped in
 */
export function fillJar(jar, coins) {
  const sum = jar + Math.max(0, Math.floor(coins));
  return { jar: sum % JAR_SIZE, payouts: Math.floor(sum / JAR_SIZE) };
}

/**
 * What full jars pay: JAR_BONUS each, and each buys back a lost pearl.
 * @param {number} payouts
 * @param {number} lives pearls left
 */
export function jarPayout(payouts, lives) {
  return { points: payouts * JAR_BONUS, lives: Math.min(LIVES, lives + payouts) };
}

/**
 * A perfect drink cheers everyone else waiting: each gets back a share of
 * their patience (less in expert), up to full.
 * @param {number} left seconds of patience left
 * @param {number} patience their full patience
 * @param {boolean} [expert]
 */
export function cheer(left, patience, expert = false) {
  return Math.min(patience, left + rulesFor(expert).cheer * patience);
}

// --- Faces: how a guest looks while they wait, and as they leave ------------------------

/** Below this share of patience a guest starts glancing at the clock. */
export const GLANCE_AT = 0.6;
/** Below this they are cross, and their ticket earns the slab. */
export const CROSS_AT = 0.3;
/** Served with at least this share of patience left is served fast. */
export const FAST_SERVE = 0.8;

/**
 * @typedef {"calm" | "glance" | "cross"} WaitMood
 * @typedef {"starry" | "wow" | "content" | "meh" | "unimpressed" | "storm" | "sentBack"} Reaction
 */

/**
 * @param {number} share patience left, 0–1
 * @returns {WaitMood}
 */
export function waitingMood(share) {
  if (share > GLANCE_AT) return "calm";
  if (share > CROSS_AT) return "glance";
  return "cross";
}

/**
 * How a guest takes their drink: starry for a perfect one, surprised by a good
 * one that came fast, content with a good one, unmoved by a fine one, and
 * unimpressed by a sloppy one.
 * @param {number} total the receipt's total
 * @param {number} patienceFraction patience left when it was stamped, 0–1
 * @returns {Reaction}
 */
export function servedMood(total, patienceFraction) {
  if (total >= 95) return "starry";
  if (total >= 80) return patienceFraction >= FAST_SERVE ? "wow" : "content";
  if (total >= 55) return "meh";
  return "unimpressed";
}

/** One emoji per guest for the shared shift, by how they left. @type {Record<Reaction, string>} */
export const SHARE_FACES = {
  starry: "🤩",
  wow: "😮",
  content: "🙂",
  meh: "😐",
  unimpressed: "😒",
  storm: "😤",
  sentBack: "🙅",
};
