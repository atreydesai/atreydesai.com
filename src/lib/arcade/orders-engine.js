// Order up rules, kept free of the DOM so they can be tested with node.
//
// Tickets arrive on a rail, each asking for one tea and a few toppings. The
// player builds a cup and serves it; it goes to whichever open ticket it
// matches exactly, the most impatient first.

export const SHIFT_SECONDS = 90;
export const LIVES = 3;
export const MAX_TICKETS = 4;

export const TEAS = /** @type {const} */ (["milk", "taro", "matcha", "strawberry"]);
export const TOPPINGS = /** @type {const} */ (["pearls", "pudding", "jelly", "foam"]);

/** @typedef {typeof TEAS[number]} Tea */
/** @typedef {typeof TOPPINGS[number]} Topping */
/** @typedef {{ tea: Tea, toppings: Topping[] }} Order */
/** @typedef {{ tea: Tea | null, toppings: Topping[] }} Cup */
/** @typedef {{ order: Order, patienceLeft: number }} OpenTicket */
/** @typedef {"opening" | "steady" | "rush"} Phase */

/**
 * @param {number} elapsed
 * @returns {Phase}
 */
export function phaseForElapsed(elapsed) {
  if (elapsed < 25) return "opening";
  if (elapsed < 60) return "steady";
  return "rush";
}

/**
 * How often customers arrive, how long they wait, and how fussy they are.
 * @param {number} elapsed
 */
export function paceForElapsed(elapsed) {
  const phase = phaseForElapsed(elapsed);
  if (phase === "opening") {
    return { phase, arrivalEvery: 6, patience: 20, minToppings: 0, maxToppings: 1 };
  }
  if (phase === "steady") {
    return { phase, arrivalEvery: 4.5, patience: 16, minToppings: 1, maxToppings: 2 };
  }
  return { phase, arrivalEvery: 3.4, patience: 13, minToppings: 1, maxToppings: 3 };
}

/**
 * Toppings in shelf order, so equal sets compare and display the same way.
 * @param {Topping[]} toppings
 */
export function sortToppings(toppings) {
  return [...toppings].sort((a, b) => TOPPINGS.indexOf(a) - TOPPINGS.indexOf(b));
}

/**
 * @param {number} elapsed
 * @param {() => number} [random]
 * @returns {Order}
 */
export function makeOrder(elapsed, random = Math.random) {
  const { minToppings, maxToppings } = paceForElapsed(elapsed);
  const tea = TEAS[Math.floor(random() * TEAS.length) % TEAS.length];
  const count = minToppings + (Math.floor(random() * (maxToppings - minToppings + 1)) % (maxToppings - minToppings + 1));
  /** @type {Topping[]} */
  const pool = [...TOPPINGS];
  /** @type {Topping[]} */
  const picked = [];
  while (picked.length < count && pool.length) {
    const index = Math.floor(random() * pool.length) % pool.length;
    picked.push(pool.splice(index, 1)[0]);
  }
  return { tea, toppings: sortToppings(picked) };
}

/**
 * @param {Cup} cup
 * @param {Order} order
 */
export function sameDrink(cup, order) {
  return (
    cup.tea === order.tea &&
    cup.toppings.length === order.toppings.length &&
    order.toppings.every((topping) => cup.toppings.includes(topping))
  );
}

/**
 * Whether adding to this cup could still make the order.
 * @param {Cup} cup
 * @param {Order} order
 */
export function couldBecome(cup, order) {
  return (
    (cup.tea === null || cup.tea === order.tea) &&
    cup.toppings.every((topping) => order.toppings.includes(topping))
  );
}

/**
 * The open ticket this cup would go to: an exact match, closest to walking
 * out. Returns -1 when nobody ordered it.
 * @param {Cup} cup
 * @param {OpenTicket[]} tickets
 */
export function ticketFor(cup, tickets) {
  let best = -1;
  for (let index = 0; index < tickets.length; index++) {
    if (!sameDrink(cup, tickets[index].order)) continue;
    if (best < 0 || tickets[index].patienceLeft < tickets[best].patienceLeft) best = index;
  }
  return best;
}

/**
 * Points for a served drink, with a tip for speed and a bonus for a streak.
 * @param {Order} order
 * @param {number} patienceFraction patience left, 0–1
 * @param {number} combo drinks served in a row, including this one
 */
export function pointsForServe(order, patienceFraction, combo) {
  const tip = patienceFraction >= 0.6 ? 2 : patienceFraction >= 0.3 ? 1 : 0;
  const streak = Math.min(3, Math.floor(combo / 4));
  return { points: 2 + order.toppings.length + tip + streak, tip };
}

/**
 * Adds a topping, or takes it back out if it is already in.
 * @param {Cup} cup
 * @param {Topping} topping
 * @returns {Cup}
 */
export function toggleTopping(cup, topping) {
  const toppings = cup.toppings.includes(topping)
    ? cup.toppings.filter((item) => item !== topping)
    : sortToppings([...cup.toppings, topping]);
  return { tea: cup.tea, toppings };
}

/** @param {number} elapsed */
export function timeRemaining(elapsed) {
  return Math.max(0, Math.ceil(SHIFT_SECONDS - elapsed));
}
