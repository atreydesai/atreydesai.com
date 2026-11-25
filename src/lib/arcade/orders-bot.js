// A player for order up who never tires: the `?autoplay` bot in
// development, and, in node, a whole shift played on a model of the bench
// so a change to the rules can be measured (drinks served, sent back for
// the wrong tea, guests who walked out) before anyone plays it.
//
// The bot plays like a steady person: it takes whoever is closest to
// leaving, mashes the hand for syrup, ice and the shake, holds the tap and
// lets go a little either side of the line, drops when the ladle swings
// over the cup and stamps when the needle crosses the band, each a few
// hundredths of a second off, and reacts to anything new after a quarter of
// a second. Now and then (`slip`) it forgets to check the tap or the jar
// before it starts, as people do when the counter is busy.
//
// DOM-free. `simulateShift` takes the rules as a module, so the same bot can
// play an older version of them (the shift as it was) for comparison.

import { createRng } from "./core/rng.ts";

/** Seconds between presses when mashing the hand. */
const PRESS_GAP = 0.14;
/** Seconds the shake's presses come apart. */
const SHAKE_GAP = 0.12;

/**
 * @typedef {{ react: number, aim: number, slip: number }} BotSkill
 * `react`: seconds to respond to anything new; `aim`: the spread (s.d.,
 * seconds) of a timed press or release; `slip`: the chance of not checking
 * the tap or the jar before starting.
 */

/** A steady, careful player. @type {BotSkill} */
export const STEADY = Object.freeze({ react: 0.25, aim: 0.04, slip: 0 });

/**
 * @param {number} seed
 * @param {Partial<BotSkill>} [skill]
 */
export function createBot(seed, skill = {}) {
  const random = createRng(seed);
  return {
    skill: { ...STEADY, ...skill },
    random,
    /** Real seconds before the bot does anything else. */
    wait: 0,
    /** The cup (by guest) and station the bot last saw, so it reacts to a change and decides a station once. */
    seen: "",
    /** For the station in hand: whether it forgot to check, and when it means to press or let go. */
    lapse: false,
    fireAt: Infinity,
    letGo: 0,
  };
}

/** A normally spread number, mean 0 and s.d. 1. @param {() => number} random */
function gauss(random) {
  const u = Math.max(1e-9, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

/**
 * What the bot sees of the counter. Times are on the bench's clock.
 * @typedef {{
 *   now: number,
 *   cup: null | {
 *     guestId: number, station: string, busy: boolean, tea: string | null, orderTea: string,
 *     drops: number, queue: string[], stampAt: number | null, level: number, line: number,
 *     scoopStart: number, swing: number, loaded: boolean, sealStart: number, sealPeriod: number, band: readonly number[],
 *   },
 *   holding: boolean,
 *   dry: boolean,
 *   tapIndex: number,
 *   target: number,
 *   jarIndex: number,
 *   wanted: number,
 *   teaReady: boolean,
 *   lowTank: number,
 *   restless: boolean,
 *   ticket: boolean,
 * }} BotView
 * `dry` is the tap held open with its tank run out;
 * `target` is the ordered tea's tap and `wanted` the next scoop's jar;
 * `teaReady` the ordered tap can pour (not brewing); `lowTank` a tank to
 * brew (-1 for none); `restless` someone worth a sample; `ticket` a ticket
 * on the rail to take.
 */

/**
 * @typedef {"take" | "press" | "hold" | "release" | "left" | "right" | "brew" | "sample"} BotAction
 */

/**
 * The bot's next action this frame, if any.
 * @param {ReturnType<typeof createBot>} bot
 * @param {BotView} view
 * @param {number} dt real seconds since the last frame
 * @returns {BotAction | null}
 */
export function botAct(bot, view, dt) {
  bot.wait -= dt;
  const cup = view.cup;
  const { skill, random } = bot;
  // Something new on the bench: a moment to take it in, and a fresh decision.
  const seen = cup ? `${cup.guestId}:${cup.station}:${cup.drops}` : view.ticket ? "ticket" : "";
  if (seen !== bot.seen) {
    bot.seen = seen;
    bot.lapse = random() < skill.slip;
    bot.fireAt = Infinity;
    bot.letGo = cup ? cup.line + gauss(random) * skill.aim * 0.4 : 0;
    bot.wait = Math.max(bot.wait, skill.react * (0.8 + 0.4 * random()));
  }
  // A hold is let go on time, however busy the bot is; and at once if the
  // tap runs dry (a dry tap let go isn't judged: brew, then pour the rest).
  if (view.holding) return view.dry || (cup && cup.level >= bot.letGo) ? "release" : null;
  if (bot.wait > 0) return null;
  const pause = (seconds = skill.react) => (bot.wait = seconds * (0.8 + 0.4 * random()));

  if (view.restless) {
    pause();
    return "sample";
  }
  if (view.lowTank >= 0) {
    pause();
    return "brew";
  }
  if (!cup) {
    if (!view.ticket) return null;
    pause();
    return "take";
  }
  if (cup.busy) return null;
  switch (cup.station) {
    case "sugar":
    case "ice":
      pause(PRESS_GAP);
      return "press";
    case "pour":
      if (!bot.lapse && view.tapIndex !== view.target) {
        pause(0.12);
        return view.tapIndex < view.target ? "right" : "left";
      }
      if (!view.teaReady) return null;
      return "hold";
    case "scoop": {
      if (!bot.lapse && view.jarIndex !== view.wanted) {
        pause(0.12);
        return view.jarIndex < view.wanted ? "right" : "left";
      }
      if (!cup.loaded) return null;
      // The ladle is over the cup each half swing: aim at the next pass.
      if (bot.fireAt === Infinity) {
        const t = view.now - cup.scoopStart;
        const k = Math.max(0, Math.ceil((cup.swing * t - Math.PI / 2) / Math.PI));
        bot.fireAt = cup.scoopStart + (Math.PI / 2 + k * Math.PI) / cup.swing + gauss(random) * skill.aim;
      }
      if (view.now < bot.fireAt) return null;
      bot.fireAt = Infinity;
      pause(0.1);
      return "press";
    }
    case "shake":
      pause(SHAKE_GAP);
      return "press";
    case "seal": {
      if (cup.stampAt !== null) return null;
      if (bot.fireAt === Infinity) {
        // The needle rises through the band's middle once each period.
        const mid = (cup.band[0] + cup.band[1]) / 2;
        const t = view.now - cup.sealStart;
        const k = Math.max(0, Math.ceil(t / cup.sealPeriod - mid / 2 + 0.1));
        bot.fireAt = cup.sealStart + (k + mid / 2) * cup.sealPeriod + gauss(random) * skill.aim;
      }
      if (view.now < bot.fireAt) return null;
      bot.fireAt = Infinity;
      return "press";
    }
    default:
      return null;
  }
}

// --- A shift on a model of the bench ------------------------------------------------

/** The bench's beats, as the game times them (OrderUp.svelte; the hand-off from the rules). */
const BEATS = {
  walk: 1.6,
  syrupSettle: 0.22,
  iceSettle: 0.4,
  afterPour: 0.35,
  dip: 0.15,
  reload: 0.35,
  afterScoops: 0.4,
  afterShake: 0.25,
  minPour: 0.08,
};

/**
 * @typedef {{
 *   served: number, sentBack: number, walkouts: number, score: number, perfects: number,
 *   pearlsLeft: number, seconds: number,
 * }} ShiftResult
 */

/**
 * Plays one shift on a model of the bench with the given rules.
 * `tapAtTake`: the cup starts under the ordered tea's tap (else under the
 * last tap used); `jarAtScoop`: the ladle dips into the next wanted jar by
 * itself (else it stays in the last one), as the game does in normal.
 * @param {any} rules the orders-engine module (or an older one)
 * @param {{ seed: number, expert?: boolean, skill?: Partial<BotSkill>, tapAtTake?: boolean, jarAtScoop?: boolean, dt?: number }} options
 * @returns {ShiftResult}
 */
export function simulateShift(rules, { seed, expert = false, skill = {}, tapAtTake = true, jarAtScoop = !expert, dt = 1 / 60 }) {
  const R = rules;
  const handOff = R.HAND_OFF_SECONDS ?? 0.7;
  const random = createRng(seed ^ 0x5bd1e995);
  const bot = createBot(seed, skill);
  const cap = R.maxTickets(expert);
  const special = R.pickSpecial(random);
  /** @type {any[]} */
  let guests = [];
  /** @type {any} */
  let cup = null;
  let clock = 0;
  let nextId = 1;
  let ordersMade = 0;
  let criticsSeen = 0;
  let arrivalTimer = 0;
  let arrivalIn = 0;
  let tapIndex = 0;
  let jarIndex = 0;
  let holding = false;
  let samplesLeft = R.samplesFor(expert);
  /** @type {number[]} */
  const tanks = R.TEAS.map(() => R.TANK_CAPACITY);
  /** @type {number[]} */
  const brewEnds = R.TEAS.map(() => 0);
  let lives = R.LIVES;
  let streak = 0;
  let jar = 0;
  const result = { served: 0, sentBack: 0, walkouts: 0, score: 0, perfects: 0, pearlsLeft: 0, seconds: 0 };
  /** @type {any[]} */
  const recent = [];

  const addGuest = () => {
    const critic = R.criticDue(clock, criticsSeen, expert, result.served);
    const regular = critic ? R.CRITIC : R.pickRegular([...guests.map((g) => g.regular.name), ...recent], random);
    if (critic) criticsSeen += 1;
    const order = R.makeOrder(clock, regular, random, expert, ordersMade++);
    const patience = R.patienceFor(order, regular, clock, expert);
    guests.push({ id: nextId++, regular, order, patience, left: patience, placedAt: clock + BEATS.walk });
  };
  const leave = (/** @type {any} */ guest) => {
    guests = guests.filter((g) => g !== guest);
    recent.push(guest.regular.name);
    if (recent.length > 6) recent.shift();
  };
  const loseLife = () => {
    streak = 0;
    lives -= 1;
  };
  const enter = (/** @type {string} */ station) => {
    cup.station = station;
    cup.busyUntil = 0;
    if (station === "scoop") {
      cup.scoopStart = clock;
      cup.swing = R.paceForElapsed(clock, expert).swing;
      if (jarAtScoop) jarIndex = R.TOPPINGS.indexOf(cup.queue[0]);
      cup.loadedAt = clock + BEATS.dip;
    }
    if (station === "seal") cup.sealStart = clock;
  };
  const after = (/** @type {number} */ seconds, /** @type {() => void} */ run) => {
    cup.busyUntil = clock + seconds;
    cup.then = run;
  };
  const nextStation = () => cup.stations[cup.stations.indexOf(cup.station) + 1] ?? "pour";
  const commitPour = () => {
    holding = false;
    cup.pourGrade = R.pourGrade(cup.level, cup.order.ice, expert);
    const next = cup.stations.includes("scoop") ? "scoop" : "shake";
    after(BEATS.afterPour, () => enter(next));
  };
  const serve = () => {
    const guest = guests.find((g) => g.id === cup.guestId);
    const drink = cup;
    cup = null;
    if (!guest) return;
    const graded = R.gradeDrink({
      order: drink.order,
      tea: drink.tea,
      iceCount: drink.ice,
      sugarCount: drink.sugar,
      level: drink.level,
      drops: drink.drops,
      shakeSeconds: drink.shakeSeconds,
      sealValue: drink.sealValue,
      patienceFraction: Math.max(0, Math.min(1, guest.left / guest.patience)),
      expert,
    });
    leave(guest);
    if (!graded.accepted) {
      result.sentBack += 1;
      loseLife();
      return;
    }
    const nextStreak = R.keepsStreak(graded.total) ? streak + 1 : 0;
    const pay = R.pointsForDrink(graded.total, guest.regular, nextStreak, drink.order.tea === special, expert);
    streak = nextStreak;
    result.served += 1;
    result.score += pay.points;
    if (graded.total >= 95) {
      result.perfects += 1;
      for (const other of guests) other.left = R.cheer(other.left, other.patience, expert);
    }
    const filled = R.fillJar(jar, pay.coins);
    jar = filled.jar;
    if (filled.payouts) {
      const paid = R.jarPayout(filled.payouts, lives);
      result.score += paid.points;
      lives = paid.lives;
    }
  };
  const act = (/** @type {BotAction | null} */ action) => {
    if (!action) return;
    if (action === "take") {
      const index = R.mostImpatient(guests.filter((g) => clock >= g.placedAt));
      const guest = guests.filter((g) => clock >= g.placedAt)[index];
      if (!guest) return;
      const stations = R.stationsFor(guest.order);
      cup = {
        guestId: guest.id, order: guest.order, stations, station: stations[0], busyUntil: 0, then: null,
        sugar: 0, ice: 0, tea: null, level: 0, held: 0, pourGrade: null, queue: R.scoopQueue(guest.order), drops: [],
        scoopStart: 0, swing: 1, loadedAt: 0, shakes: 0, shakeStart: 0, shakeSeconds: null, sealStart: 0, sealValue: null, stampAt: null,
      };
      if (tapAtTake) tapIndex = R.TEAS.indexOf(guest.order.tea);
      return;
    }
    if (action === "sample") {
      const index = R.sampleTarget(guests, cup?.guestId ?? null);
      if (index >= 0 && samplesLeft > 0) {
        guests[index].left = R.sampleBoost(guests[index].left, guests[index].patience);
        samplesLeft -= 1;
      }
      return;
    }
    if (action === "brew") {
      const index = tanks.findIndex((tank, i) => brewEnds[i] === 0 && R.tankState(tank) !== "ok");
      if (index >= 0) brewEnds[index] = clock + R.BREW_SECONDS;
      return;
    }
    if (!cup || clock < cup.busyUntil) return;
    const station = cup.station;
    if (action === "left" || action === "right") {
      const step = action === "left" ? -1 : 1;
      if (station === "scoop") {
        jarIndex = Math.max(0, Math.min(R.TOPPINGS.length - 1, jarIndex + step));
        cup.loadedAt = Math.max(cup.loadedAt, clock + BEATS.dip);
      } else {
        tapIndex = Math.max(0, Math.min(R.TEAS.length - 1, tapIndex + step));
      }
      return;
    }
    if (action === "hold" && station === "pour" && brewEnds[tapIndex] === 0) {
      holding = true;
      cup.held = 0;
      return;
    }
    if (action === "release") {
      holding = false;
      // Let go at a dry tap: not judged, the pour waits for the brew.
      if (station === "pour" && cup.level >= BEATS.minPour && R.tankState(tanks[tapIndex]) !== "empty") commitPour();
      return;
    }
    if (action !== "press") return;
    if (station === "sugar") {
      cup.sugar += 1;
      if (cup.sugar >= R.sugarPumps(cup.order.sugar)) after(BEATS.syrupSettle, () => enter(nextStation()));
    } else if (station === "ice") {
      cup.ice += 1;
      if (cup.ice >= R.ICE_CUBES[cup.order.ice]) after(BEATS.iceSettle, () => enter(nextStation()));
    } else if (station === "scoop") {
      if (clock < cup.loadedAt) return;
      const wanted = cup.queue[cup.drops.length];
      const x = R.ladleAt(clock - cup.scoopStart, cup.swing, Math.PI / 2);
      cup.drops.push(R.judgeScoop(wanted, R.TOPPINGS[jarIndex], x, expert).grade);
      cup.loadedAt = clock + BEATS.reload;
      const next = cup.queue[cup.drops.length];
      if (!next) after(BEATS.afterScoops, () => enter("shake"));
      else if (jarAtScoop) jarIndex = R.TOPPINGS.indexOf(next);
    } else if (station === "shake") {
      cup.shakes += 1;
      if (cup.shakes === 1) cup.shakeStart = clock;
      if (cup.shakes >= R.SHAKES_NEEDED) {
        cup.shakeSeconds = clock - cup.shakeStart;
        after(BEATS.afterShake, () => enter("seal"));
      }
    } else if (station === "seal" && cup.stampAt === null) {
      cup.sealValue = R.sealNeedle(clock - cup.sealStart, expert);
      cup.stampAt = clock;
      after(handOff, serve);
    }
  };

  /** @type {BotView} */
  const view = /** @type {any} */ ({ cup: null });
  const seen = {
    guestId: 0, station: "", busy: false, tea: null, orderTea: "", drops: 0, queue: [], stampAt: null, level: 0, line: 0,
    scoopStart: 0, swing: 1, loaded: false, sealStart: 0, sealPeriod: R.rulesFor(expert).sealPeriod, band: R.rulesFor(expert).sealBand,
  };

  while (clock < R.SHIFT_SECONDS && lives > 0) {
    clock += dt;
    // Guests arrive, wait, and leave.
    const pace = R.paceForElapsed(clock, expert);
    arrivalTimer = Math.min(arrivalTimer + dt, pace.arrivalEvery);
    arrivalIn = Math.min(arrivalIn - dt, R.nextArrivalIn(pace, guests.length, arrivalTimer));
    if (arrivalIn <= 0 && guests.length < cap) {
      arrivalTimer = 0;
      arrivalIn = Infinity;
      addGuest();
    }
    for (const guest of [...guests]) {
      if (clock < guest.placedAt) continue;
      const mine = cup?.guestId === guest.id;
      if (mine && cup.stampAt !== null) continue;
      guest.left -= dt * (mine ? R.activePatienceRate(expert) : 1);
      if (guest.left <= 0) {
        leave(guest);
        result.walkouts += 1;
        loseLife();
        if (mine) {
          cup = null;
          holding = false;
        }
      }
    }
    tanks.forEach((_, i) => {
      if (brewEnds[i] > 0 && clock >= brewEnds[i]) {
        brewEnds[i] = 0;
        tanks[i] = R.TANK_CAPACITY;
      }
    });
    // The bench: beats come due, and the tap pours while held.
    if (cup && cup.then && clock >= cup.busyUntil) {
      const run = cup.then;
      cup.then = null;
      run();
    }
    if (cup && holding && cup.station === "pour") {
      cup.held += dt;
      const want = R.stepPour(cup.level, cup.held, dt) - cup.level;
      const drawn = R.drawFromTank(tanks[tapIndex], want);
      tanks[tapIndex] = drawn.tank;
      if (drawn.poured > 0) {
        if (!cup.tea) cup.tea = R.TEAS[tapIndex];
        cup.level = Math.min(R.POUR_MAX, cup.level + drawn.poured);
      }
      if (cup.level >= R.POUR_MAX) commitPour();
    }
    // What the bot sees, and what it does.
    view.now = clock;
    view.holding = holding;
    view.dry = holding && R.tankState(tanks[tapIndex]) === "empty";
    view.tapIndex = tapIndex;
    view.jarIndex = jarIndex;
    view.ticket = guests.some((g) => clock >= g.placedAt);
    const restlessIndex = R.sampleTarget(guests, cup?.guestId ?? null);
    view.restless = samplesLeft > 0 && restlessIndex >= 0 && guests[restlessIndex].left / guests[restlessIndex].patience < 0.3;
    view.lowTank = tanks.findIndex((tank, i) => brewEnds[i] === 0 && R.tankState(tank) !== "ok");
    if (cup) {
      seen.guestId = cup.guestId;
      seen.station = cup.station;
      seen.busy = clock < cup.busyUntil || !!cup.then;
      seen.tea = cup.tea;
      seen.orderTea = cup.order.tea;
      seen.drops = cup.drops.length;
      seen.queue = cup.queue;
      seen.stampAt = cup.stampAt;
      seen.level = cup.level;
      seen.line = R.FILL_LINE[cup.order.ice];
      seen.scoopStart = cup.scoopStart;
      seen.swing = cup.swing;
      seen.loaded = clock >= cup.loadedAt;
      seen.sealStart = cup.sealStart;
      view.cup = seen;
      view.target = R.TEAS.indexOf(cup.order.tea);
      view.wanted = Math.max(0, R.TOPPINGS.indexOf(cup.queue[cup.drops.length]));
      view.teaReady = brewEnds[tapIndex] === 0 && tanks[tapIndex] > 0.001;
    } else {
      view.cup = null;
    }
    act(botAct(bot, view, dt));
  }
  result.pearlsLeft = Math.max(0, lives);
  result.seconds = Math.min(clock, R.SHIFT_SECONDS);
  return result;
}
