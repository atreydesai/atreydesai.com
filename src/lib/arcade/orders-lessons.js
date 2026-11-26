// Order up's lessons: what the counter teaches, and when. A new player is
// walked through their first drink inside the live shift, one station at a
// time: the ticket on the rail, then each line of the making card pinned
// under the cup (the syrup, the ice, the tea, the shake), and where the
// motion is the lesson, the thing itself (the ladle over the cup, the
// sealer's needle, the tea's fill line once the tap is held). One short line
// sits beside it with pixel brackets round it. Each step stops the shift
// (the guests' patience, the arrivals, the clock and the bench) until the
// player makes its move, which brings play back and is made at once, so
// reading never costs a pearl. The drop and the stamp stop at the very
// moment to make them, the ladle right over the cup and the needle in the
// middle of the band, while a ghost shows the move. Continue counts a step
// as known without making it. One step at a time: the next waits for a
// short quiet (WALK_GAP) after the last has gone, and a station the player
// has already begun by then isn't taught.
//
// On every shift, nothing but the ticket's own line is said until the
// shift's first ticket is taken. While the device is still being walked
// through, that ticket is marked on the rail as well (ticketBeckon), even
// once its line has been continued.
//
// Later things (a guest losing patience, a sample, a tank running low, the
// critic, the special, the tip jar, the combo, what the receipt means) get
// one line each the first time they matter, only while the bench is empty,
// and a few seconds apart (THING_GAP). They stop the shift too, until the
// player continues, or acts (which counts as continuing), or their thing goes.
//
// Every line is worded so that doing exactly what it says works: the cup
// starts under the ordered tea's tap, and if it has been moved away the
// pour shows the arrows rather than Space; the drop waits for the right
// jar; and the Brew key shows only when it brews the tank in the loop.
//
// DOM-free: the component describes the counter in a `view`, asks
// `followLessons` each frame, and hands the answer to the shared coach
// (src/lib/arcade/core/coach.ts), which shows one lesson at a time and
// remembers them on the device.

import { CROSS_AT, GLANCE_AT, TEAS, TOPPINGS, mostImpatient, rulesFor, tankState } from "./orders-engine.js";
import { TEA_WORDS } from "./orders-labels.js";

/**
 * @typedef {{
 *   id: string, text: string, name?: string, keys?: string[], touch?: string,
 *   slow?: number, life?: number, minLife?: number, move?: boolean
 * }} Lesson
 * @typedef {import("./orders-engine.js").Tea} Tea
 * @typedef {import("./orders-engine.js").Topping} Topping
 * @typedef {import("./orders-engine.js").Station} Station
 */

/**
 * What a lesson points at. The component turns it into a place on screen.
 * - step: a line of the making card under the cup (`index` into CARD_STEPS).
 * - ticket, patience: a guest's ticket on the rail, or the patience line
 *   along its foot (`guest` is the guest's id, so it stays theirs as the
 *   rail shifts).
 * - sample: the Sample button.
 * - tap, brew: a tea's machine, or its Brew chip (`index` into TEAS).
 * - jar: a topping's jar on the counter (`index` into TOPPINGS).
 * - line: the cup's fill line; ladle: over the middle of the cup, where the
 *   ladle should be; gauge: the sealer's band.
 * - receipt, streak: the drink's receipt, or the combo line on it.
 * - tipjar: the tip jar at the counter's end.
 * @typedef {{
 *   kind: "step" | "ticket" | "patience" | "sample" | "tap" | "brew" | "jar" | "line" | "ladle" | "gauge" | "receipt" | "streak" | "tipjar",
 *   index: number,
 *   guest: number
 * }} Target
 */

/** @typedef {{ lesson: Lesson, at: Target }} LessonCue */

/**
 * The counter as the lessons see it. The component keeps one of these and
 * updates it in place each frame.
 * @typedef {{
 *   coarse: boolean,
 *   expert: boolean,
 *   started: boolean,
 *   tapIndex: number,
 *   jarIndex: number,
 *   holding: boolean,
 *   loaded: boolean,
 *   ladle: number,
 *   needle: number,
 *   cup: null | {
 *     guestId: number, station: Station, stations: Station[], busy: boolean,
 *     order: { tea: Tea }, tea: Tea | null, queue: Topping[], drops: number[], stampAt: number | null,
 *     sugar: number, ice: number, shakes: number
 *   },
 *   guests: Array<{ id: number, placed: boolean, left: number, patience: number, regular: { quirk?: string }, order: { tea: Tea } }>,
 *   tanks: number[],
 *   brewEnds: number[],
 *   samplesLeft: number,
 *   special: Tea,
 *   jar: number,
 *   receipt: null | { sentBack: boolean, combo: number },
 * }} LessonView
 * `started` is a ticket taken this shift; `holding` the tap held open;
 * `loaded` the ladle carrying a scoop; `ladle` where it is (-1 to 1, 0 over
 * the middle of the cup) and `needle` the sealer's needle (0 cold to 1),
 * each where its station is in play; `jar` the coins showing in the tip jar.
 */

/**
 * Seconds of play after a lesson has gone before the next step is shown,
 * so two never come in quick succession.
 */
export const WALK_GAP = 1;
/** Seconds of play after a thing has gone before the next thing is named. */
export const THING_GAP = 3;

/** A step stops the shift until its move is made, or Continue. */
const walk = { slow: 0, life: Infinity, minLife: 0.6, move: true };
/** A thing stops the shift too, until the player continues or acts, or its thing goes. */
const thing = { slow: 0, life: Infinity, minLife: 1.6 };

/** The making card's lines, in the order a drink is built. */
export const CARD_STEPS = /** @type {const} */ (["sugar", "ice", "pour", "scoop", "shake", "seal"]);

/** Each lesson: one short full sentence, eight words or fewer. @type {Readonly<Record<string, Lesson>>} */
export const LESSONS = Object.freeze({
  ticket: { id: "ticket", text: "Take this ticket to start their drink.", keys: ["Space"], touch: "tap", ...walk },
  ice: { id: "ice", text: "Add ice until the cup's marks are full.", keys: ["Space"], touch: "tap", ...walk },
  syrup: { id: "syrup", text: "Pump syrup until the bottle's marks are full.", keys: ["Space"], touch: "tap", ...walk },
  drop: { id: "drop", text: "Drop when the ladle is over the cup.", keys: ["Space"], touch: "tap", ...walk },
  shake: { id: "shake", text: "Shake fast until every mark fills.", keys: ["Space"], touch: "tap fast", ...walk },
  seal: { id: "seal", text: "Stamp when the needle is between the ticks.", keys: ["Space"], touch: "tap", ...walk },
  serve: { id: "serve", text: "Cleaner steps and shorter waits pay more.", ...thing },
  patience: { id: "patience", text: "They leave when this line runs out.", ...thing },
  sample: { id: "sample", text: "A sample buys the most restless guest time.", keys: ["S"], touch: "tap", ...thing },
  critic: { id: "critic", name: "the critic", text: "Their drink pays double, more if perfect.", ...thing },
  special: { id: "special", text: "Starred tea is today's special and pays extra.", ...thing },
  tipjar: { id: "tipjar", name: "tip jar", text: "Full, it pays points and a lost pearl.", ...thing },
  combo: { id: "combo", text: "Good drinks in a row multiply the points.", ...thing },
});

/**
 * Lessons whose line names the tea or topping. One id each, so a device
 * learns "the tap" once, whichever tea taught it.
 * @template {string} K
 * @param {readonly K[]} keys
 * @param {(key: K) => Lesson} make
 * @returns {Readonly<Record<K, Lesson>>}
 */
function each(keys, make) {
  return Object.freeze(/** @type {Record<K, Lesson>} */ (Object.fromEntries(keys.map((key) => [key, Object.freeze(make(key))]))));
}

/** The pour, with the cup under its tap: Space (or the tap itself) held. */
export const POUR_LESSONS = each(TEAS, (tea) => ({
  id: "pour",
  text: `Hold the ${TEA_WORDS[tea]} tap up to the line.`,
  keys: ["Space"],
  touch: "hold",
  ...walk,
}));
/** The same line once the cup has been moved under another tap: the arrows back first, never Space. */
export const POUR_MOVE_LESSONS = each(TEAS, (tea) => ({ ...POUR_LESSONS[tea], keys: ["←", "→"] }));
/** The scoop's jar, when the ladle is in another one. */
export const JAR_LESSONS = each(TOPPINGS, (kind) => ({
  id: "jar",
  text: `Pick the ${kind === "redbean" ? "red bean" : kind} jar for this scoop.`,
  keys: ["←", "→"],
  touch: "tap it",
  ...walk,
}));
/** A tank running low: the Brew chip, and B only when B brews this one (the tap the cup is under). */
export const BREW_LESSON = Object.freeze({ id: "brew", text: "Press Brew to refill this tank.", ...thing });
export const BREW_KEY_LESSON = Object.freeze({ ...BREW_LESSON, keys: ["B"] });
/**
 * The pour's tank ran dry: the way on, as a station's step (the cup is
 * under that tap, so B brews it). Let go first: a dry tap let go isn't
 * judged, and the pour carries on once it has brewed.
 */
export const BREW_DRY_LESSON = Object.freeze({ id: "dry", text: "Press Brew to refill this tank.", keys: ["B"], touch: "tap", ...walk });
export const BREW_DRY_HOLD_LESSON = Object.freeze({ ...BREW_DRY_LESSON, text: "Let go, then press Brew to refill it." });

/** Every line the counter can show, variants included (for checking the voice). */
export function allLessons() {
  return [
    ...Object.values(LESSONS),
    ...Object.values(POUR_LESSONS),
    ...Object.values(POUR_MOVE_LESSONS),
    ...Object.values(JAR_LESSONS),
    BREW_LESSON,
    BREW_KEY_LESSON,
    BREW_DRY_LESSON,
    BREW_DRY_HOLD_LESSON,
  ];
}

/** The lesson that teaches each station, so a drink knows what it still has to teach. */
export const STATION_LESSON = Object.freeze({
  ice: "ice",
  sugar: "syrup",
  pour: "pour",
  scoop: "drop",
  shake: "shake",
  seal: "seal",
});

/**
 * The moves made at a moment, and what that moment waits on: the drop with
 * the ladle over the cup, the stamp with the needle in the band.
 * @type {Readonly<Record<string, "ladle" | "needle">>}
 */
export const MOMENTS = Object.freeze({ drop: "ladle", seal: "needle" });

/** @returns {LessonCue} */
const blankCue = () => ({ lesson: LESSONS.ticket, at: { kind: "ticket", index: -1, guest: -1 } });

/**
 * Fills `into` (one object reused frame after frame) and returns it.
 * @param {LessonCue} into @param {Lesson} lesson @param {Target["kind"]} kind
 * @param {number} [index] @param {number} [guest]
 */
function aim(into, lesson, kind, index = -1, guest = -1) {
  into.lesson = lesson;
  into.at.kind = kind;
  into.at.index = index;
  into.at.guest = guest;
  return into;
}

/** The guest whose ticket the hand takes next, once it is up on the rail. @param {LessonView} view */
function nextTicket(view) {
  const guest = view.guests[mostImpatient(view.guests)];
  return guest && guest.placed ? guest : null;
}

/**
 * Whether the device still has a station of the walk-through to learn.
 * @param {(id: string) => boolean} learned
 */
export function walkUnlearned(learned) {
  for (const id of Object.values(STATION_LESSON)) if (!learned(id)) return true;
  return false;
}

/**
 * The lesson this moment needs, if the device still needs one: the next
 * station's action while a drink is on the bench, else (with the bench
 * empty) the ticket, or a thing that has just started to matter. The
 * answer is written into `into` (pass one to reuse it each frame).
 * @param {LessonView} view
 * @param {(id: string) => boolean} learned
 * @param {LessonCue} [into]
 * @returns {LessonCue | null}
 */
export function lessonNow(view, learned, into = blankCue()) {
  const cup = view.cup;
  if (cup) return stationLesson(view, cup, learned, into);
  if (!learned("ticket")) {
    const guest = nextTicket(view);
    return guest ? aim(into, LESSONS.ticket, "ticket", -1, guest.id) : null;
  }
  // On every shift, nothing else until its first ticket is taken (while the
  // device is still being walked through, that ticket is marked instead,
  // see ticketBeckon). Every thing still has its turn at a later empty bench.
  if (!view.started) return null;
  return thingLesson(view, learned, into);
}

/**
 * The ticket to mark on the rail while the walk-through waits for it: the
 * one the hand takes next, from when it is up until the shift's first
 * ticket is taken, for as long as the device is still being walked
 * through. The guest's id, or -1.
 * @param {LessonView} view
 * @param {(id: string) => boolean} learned
 */
export function ticketBeckon(view, learned) {
  if (view.cup || view.started) return -1;
  if (learned("ticket") && !walkUnlearned(learned)) return -1;
  return nextTicket(view)?.id ?? -1;
}

/**
 * What to do at the station the cup is at, if the device hasn't learned it.
 * @param {LessonView} view
 * @param {NonNullable<LessonView["cup"]>} cup
 * @param {(id: string) => boolean} learned
 * @param {LessonCue} into
 * @returns {LessonCue | null}
 */
function stationLesson(view, cup, learned, into) {
  // The syrup and the ice stay up through their settle (the last pump or
  // cube can still come back out); they are done as the cup moves on.
  if (cup.station === "sugar") return learned("syrup") ? null : aim(into, LESSONS.syrup, "step", CARD_STEPS.indexOf("sugar"));
  if (cup.station === "ice") return learned("ice") ? null : aim(into, LESSONS.ice, "step", CARD_STEPS.indexOf("ice"));
  if (cup.busy) return null;
  switch (cup.station) {
    case "pour": {
      const tea = cup.order.tea;
      const target = TEAS.indexOf(tea);
      const under = view.tapIndex === target;
      // The wrong tea is already in: no line would put it right.
      if (cup.tea && cup.tea !== tea) return null;
      // Its tank is brewing: nothing to do but wait.
      if (view.brewEnds[target] > 0) return null;
      // Its tank has run dry: the way on is to let go and brew, then pour the rest.
      if (tankState(view.tanks[target]) === "empty") {
        if (learned("dry") || learned("brew")) return null;
        return aim(into, view.holding ? BREW_DRY_HOLD_LESSON : BREW_DRY_LESSON, "brew", target);
      }
      if (view.holding) return under && !learned("pour") ? aim(into, POUR_LESSONS[tea], "line") : null;
      if (learned("pour")) return null;
      // The cup starts under its tea's tap: the card's tea line says which.
      if (under) return aim(into, POUR_LESSONS[tea], "step", CARD_STEPS.indexOf("pour"));
      // Moved away: Space would pour another tea, so on a keyboard the
      // arrows bring it back; on touch the ordered tap itself is held.
      return aim(into, view.coarse ? POUR_LESSONS[tea] : POUR_MOVE_LESSONS[tea], "tap", target);
    }
    case "scoop": {
      const wanted = cup.queue[cup.drops.length];
      if (!wanted) return null;
      const index = TOPPINGS.indexOf(wanted);
      if (view.jarIndex !== index) return learned("jar") ? null : aim(into, JAR_LESSONS[wanted], "jar", index);
      return view.loaded && !learned("drop") ? aim(into, LESSONS.drop, "ladle") : null;
    }
    case "shake":
      return learned("shake") ? null : aim(into, LESSONS.shake, "step", CARD_STEPS.indexOf("shake"));
    case "seal":
      return cup.stampAt === null && !learned("seal") ? aim(into, LESSONS.seal, "gauge") : null;
    default:
      return null;
  }
}

/**
 * Whether this drink still has a station to teach, from the one it is at.
 * @param {NonNullable<LessonView["cup"]>} cup
 * @param {(id: string) => boolean} learned
 */
export function walkPending(cup, learned) {
  for (let index = Math.max(0, cup.stations.indexOf(cup.station)); index < cup.stations.length; index++) {
    if (!learned(STATION_LESSON[cup.stations[index]])) return true;
  }
  return false;
}

/**
 * A thing that has just started to matter, with the bench empty.
 * @param {LessonView} view
 * @param {(id: string) => boolean} learned
 * @param {LessonCue} into
 * @returns {LessonCue | null}
 */
function thingLesson(view, learned, into) {
  // The receipt at the hand-off, and the combo line on it the first time it shows.
  if (view.receipt && !view.receipt.sentBack) {
    if (!learned("serve")) return aim(into, LESSONS.serve, "receipt");
    if (view.receipt.combo > 1 && !learned("combo")) return aim(into, LESSONS.combo, "streak");
  }

  // The guests waiting: the most restless, the critic, a special.
  let glancing = -1;
  let restless = -1;
  let critic = -1;
  let special = -1;
  let worst = Infinity;
  for (const guest of view.guests) {
    if (!guest.placed) continue;
    const share = guest.left / guest.patience;
    if (share <= GLANCE_AT && share < worst) {
      worst = share;
      glancing = guest.id;
      restless = share <= CROSS_AT ? guest.id : -1;
    }
    if (critic < 0 && guest.regular.quirk === "critic") critic = guest.id;
    if (special < 0 && guest.order.tea === view.special) special = guest.id;
  }

  if (glancing >= 0 && !learned("patience")) return aim(into, LESSONS.patience, "patience", -1, glancing);
  if (restless >= 0 && view.samplesLeft > 0 && !learned("sample")) return aim(into, LESSONS.sample, "sample");
  if (critic >= 0 && !learned("critic")) return aim(into, LESSONS.critic, "ticket", -1, critic);
  if (!learned("brew")) {
    for (let index = 0; index < view.tanks.length; index++) {
      if (view.brewEnds[index] === 0 && tankState(view.tanks[index]) !== "ok") {
        return aim(into, view.tapIndex === index ? BREW_KEY_LESSON : BREW_LESSON, "brew", index);
      }
    }
  }
  if (view.jar > 0 && !learned("tipjar")) return aim(into, LESSONS.tipjar, "tipjar");
  if (special >= 0 && !learned("special")) return aim(into, LESSONS.special, "ticket", -1, special);
  return null;
}

/**
 * Whether a thing's target has gone from the counter: its receipt cleared,
 * its guest served or gone, its tank brewing.
 * @param {LessonView} view @param {Target} at
 */
export function targetGone(view, at) {
  switch (at.kind) {
    case "receipt":
      return !view.receipt || view.receipt.sentBack;
    case "streak":
      return !view.receipt || view.receipt.combo <= 1;
    case "ticket":
    case "patience":
      for (const guest of view.guests) if (guest.id === at.guest) return false;
      return true;
    case "brew":
      return view.brewEnds[at.index] > 0 || tankState(view.tanks[at.index]) === "ok";
    default:
      return false;
  }
}

/**
 * Whether a station's step has already been begun without its lesson: a
 * pump in, a cube in, a shake made. The player has found it, so it isn't
 * taught on this drink (it counts as known once the station works).
 * @param {LessonView} view @param {string} id
 */
function begun(view, id) {
  const cup = view.cup;
  if (!cup) return false;
  if (id === "syrup") return cup.sugar > 0;
  if (id === "ice") return cup.ice > 0;
  if (id === "shake") return cup.shakes > 0;
  return false;
}

/**
 * Whether a move made at a moment is due now: the drop with the ladle over
 * the cup (where it lands clean), the stamp with the needle in the band.
 * Every other step is due as soon as its station is.
 * @param {LessonView} view @param {string} id
 */
export function atMoment(view, id) {
  const rules = rulesFor(view.expert);
  if (id === "drop") return Math.abs(view.ladle) <= rules.cupCenter;
  if (id === "seal") return view.needle >= rules.sealBand[0] && view.needle <= rules.sealBand[1];
  return true;
}

/**
 * Seconds from `time` until the ladle is next right over the middle of the
 * cup (where `ladleAt` is 0), always a little after `time`, so a game that
 * stops its clock there never stops it twice on the same crossing.
 * @param {number} time seconds since the swing began
 * @param {number} swing the swing's angular speed
 * @param {number} [offset] its phase at time 0 (the bench starts it out at one side)
 */
export function ladleCentreIn(time, swing, offset = Math.PI / 2) {
  if (!(swing > 0)) return Infinity;
  const k = Math.floor((swing * time + offset) / Math.PI) + 1;
  const until = (k * Math.PI - offset) / swing - time;
  return until > 1e-6 ? until : until + Math.PI / swing;
}

/**
 * Seconds from `time` until the sealer's needle is next at the middle of
 * the band, on its way up or down, always a little after `time`.
 * @param {number} time seconds since the seal began
 * @param {boolean} [expert]
 */
export function needleCentreIn(time, expert = false) {
  const { sealPeriod: period, sealBand: band } = rulesFor(expert);
  const middle = (band[0] + band[1]) / 2;
  // The needle climbs through `middle` at middle/2 of each cycle and falls through it at 1 - middle/2.
  const cycle = Math.floor(time / period);
  for (const at of [cycle + middle / 2, cycle + 1 - middle / 2, cycle + 1 + middle / 2, cycle + 2 - middle / 2]) {
    const until = at * period - time;
    if (until > 1e-6) return until;
  }
  return period;
}

/**
 * What the component keeps between frames: the lesson on screen and what
 * it points at (`cue`, null for none); the things named this shift
 * (`announced`); the game time before which no new step (`calm`) or new
 * thing (`quiet`) is shown; and the moment a step is waiting on (`waiting`:
 * the ladle or the needle), so the game can stop its clock right on it. The
 * two cue objects are reused every frame. Start a new shift with a fresh
 * memory, or clear `announced` and zero `calm` and `quiet`.
 * @typedef {{
 *   cue: LessonCue | null, announced: Set<string>, quiet: number, calm: number,
 *   waiting: "ladle" | "needle" | null, shown: LessonCue, next: LessonCue,
 *   knows: ((id: string) => boolean) | null
 * }} LessonMemory
 * A thing comes once a shift, and is counted on the device only once it
 * has been up long enough to read (or continued). `knows` is made once:
 * learned, or (for a thing) already named this shift.
 */

/** @returns {LessonMemory} */
export function lessonMemory() {
  return { cue: null, announced: new Set(), quiet: 0, calm: 0, waiting: null, shown: blankCue(), next: blankCue(), knows: null };
}

/**
 * Keeps the shared coach in step with the counter, once a frame. Asks what
 * this moment should teach; takes a station's lesson down uncounted once
 * its moment has gone (a tap pressed early, the cup dumped, the guest gone),
 * so the next drink teaches it; takes a thing down when what it points at
 * goes or a drink is started (counted once it has been up long enough to
 * read); and offers whatever is due, one at a time: a new step only after
 * WALK_GAP of play since the last lesson went, a new thing only after
 * THING_GAP since the last thing; never while tea is running (bar the dry
 * tap's line); never a station already begun; and the drop and the stamp
 * only at their moment (`memory.waiting` says which one is awaited). A
 * lesson already up follows its target (a ticket moving along the rail, the
 * pour's line once the tap is held). Returns whether the cue on screen is
 * new or now points somewhere else, so the component can measure it again.
 * @param {import("./core/coach.ts").Coach} coach
 * @param {LessonView} view
 * @param {LessonMemory} memory updated in place
 * @param {number} now the game's clock, in seconds (it stops while a lesson stops play)
 */
export function followLessons(coach, view, memory, now) {
  const { announced } = memory;
  memory.knows ??= (id) => coach.learned(id) || announced.has(id);
  let next = lessonNow(view, memory.knows, memory.next);
  const due = next ? next.lesson.id : null;
  const current = coach.current;
  memory.waiting = null;
  if (next && current?.id !== next.lesson.id) {
    const id = next.lesson.id;
    if (now < (next.lesson.move ? memory.calm : memory.quiet) || (view.holding && id !== "dry") || begun(view, id)) {
      next = null;
    } else if (!atMoment(view, id)) {
      memory.waiting = MOMENTS[id] ?? null;
      next = null;
    }
  }
  if (current && !coach.leaving) {
    if (current.move) {
      // Its moment has gone: down, uncounted, so the next drink teaches it.
      if (due !== current.id) {
        coach.dismiss();
        memory.cue = null;
      }
    } else if ((memory.cue && memory.cue.lesson.id === current.id && targetGone(view, memory.cue.at)) || view.cup) {
      // Its thing has gone, or a drink has been started.
      // Read: it fades where it was. Not yet: it comes down, and the next shift says it.
      if (coach.age >= (current.minLife ?? 0)) coach.done(current.id);
      else {
        coach.dismiss();
        memory.cue = null;
      }
    }
  }
  let moved = false;
  if (next) {
    const fresh = coach.current?.id !== next.lesson.id;
    if (!fresh || coach.offer(next.lesson)) {
      const shown = memory.shown;
      const was = memory.cue;
      moved =
        fresh || !was || was.at.kind !== next.at.kind || was.at.index !== next.at.index || was.at.guest !== next.at.guest;
      aim(shown, next.lesson, next.at.kind, next.at.index, next.at.guest);
      memory.cue = shown;
      // A thing is named once a shift (it then stops being asked for, and
      // simply runs its course); a station is asked for until it is done.
      if (fresh && !next.lesson.move) announced.add(next.lesson.id);
    }
  }
  const up = coach.current;
  if (!up) memory.cue = null;
  else {
    // The quiet runs from when the lesson has gone (faded out, or taken down).
    memory.calm = Math.max(memory.calm, now + WALK_GAP);
    memory.quiet = Math.max(memory.quiet, now + (up.move ? WALK_GAP : THING_GAP));
  }
  return moved;
}
