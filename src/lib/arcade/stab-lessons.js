// Straw stab's lessons: what the belt teaches, and when. The beat is the
// audio clock, so nothing here slows time: a lesson is a line beside the
// belt, a pen loop, a ghost, and a spotlight on the lane, while the music
// and the cups carry on at their own pace.
//
// A device's first run opens with a short practice (the engine's rule: the
// first few cups score nothing and cost nothing). Its line, "Stab when the
// cup reaches the notch.", stays up through it, while a pen loop shrinks onto
// the notch for each practice cup and lands there on its beat, and for the
// first two a ghost straw stabs on the beat to show it. Two good stabs in a
// row end the practice early.
//
// After that, each thing is named the first time it matters, at the moment
// it happens: the early and late notes, a perfect, a graze, a lost pearl
// (a cup let go, or a stab at the bare belt), a new song, nightfall's busier
// belt, the first golden cup and the first cup between the beats, and in
// expert the tighter windows. A line about a cup only ever comes up once
// that cup is the next one the straw needs to take, so following it never
// costs an earlier cup.
//
// Every line holds (readable, with Continue) for a bounded few seconds of
// real time, or until its cup is gone; lines leave a rest between them; and
// nothing but the practice shows while the practice is on.
//
// DOM-free: the component asks these functions what to teach and hands the
// answer to the shared coach (src/lib/arcade/core/coach.ts), which shows
// one lesson at a time and remembers them per device.

import { NORMAL, judgeStab } from "./stab-engine.js";

/**
 * @typedef {{
 *   id: string, text: string, name?: string, keys?: string[], touch?: string,
 *   slow?: number, life?: number, minLife?: number, move?: boolean, priority?: number
 * }} Lesson
 * @typedef {import("./stab-engine.js").StabRating} StabRating
 */

/** Seconds before the first practice cup's beat that the practice line comes up: about as it rides into view. */
export const PRACTICE_LEAD = 2;
/**
 * A line about a cup needs it at least this far (song seconds) from the
 * notch, so its loop is up before the stab. The closest two cups ever come
 * is half a beat at 164 bpm (183 ms); less the two frames a 30 Hz screen
 * takes to show the cup after the stab before it, that still clears this,
 * so a cup right behind one taken dead on can be taught.
 */
export const CUP_LEAD = 0.1;
/** Real seconds a line holds, readable with Continue, before it goes by itself. */
export const HOLD = 6;
/** Real seconds of no line between two lines, so they never run together. */
export const REST = 1.5;
/** The coach's own floor for how long a line stays up, for a lesson that names none. */
const DEFAULT_MIN_LIFE = 0.9;

/** A line about something that just happened at the notch. */
const aNote = { life: HOLD, minLife: 1.6 };
/** A line about a cup on the belt: it goes when its cup does, once it has been read. */
const aCup = { life: HOLD, minLife: 2.2 };
/**
 * A lost pearl or a new song outranks a note about timing (once that has
 * been read) and needs no rest before it: either can only be said as it
 * happens, and a new song comes round only so often.
 */
const aMoment = { ...aNote, priority: 1.5 };

/** Every lesson: one short full sentence, eight words or fewer. @type {Readonly<Record<string, Lesson>>} */
export const LESSONS = Object.freeze({
  // The practice: a move, so it outranks everything, and it holds until the
  // practice ends (its cups are on the beat, so that is a few seconds).
  stab: { id: "stab", text: "Stab when the cup reaches the notch.", keys: ["Space"], touch: "tap", move: true, life: Infinity, minLife: 1 },
  early: { id: "early", text: "Early means stab a little later.", ...aNote },
  late: { id: "late", text: "Late means stab a little sooner.", ...aNote },
  perfect: { id: "perfect", text: "Right on the beat scores the most.", ...aNote },
  graze: { id: "graze", text: "A graze still counts, for the fewest points.", ...aNote },
  miss: { id: "miss", text: "Each cup that goes by costs a pearl.", ...aMoment },
  bonk: { id: "bonk", text: "Stabbing the bare belt costs a pearl.", ...aMoment },
  song: { id: "song", text: "Listen for the new song's beat.", ...aMoment },
  night: { id: "night", text: "As night falls, more cups ride the belt.", ...aMoment },
  golden: { id: "golden", text: "Golden cups score double the base points.", ...aCup },
  offbeat: { id: "offbeat", text: "Some cups land between the beats.", ...aCup },
  expert: { id: "expert", text: "Expert judges tighter, so stab dead on.", ...aNote },
});

/**
 * @typedef {object} NextCup
 * The cup the straw needs to take next: the earliest one still waiting.
 * @property {number} time its beat, in song time
 * @property {number} beat where in its bar it falls (2.5 is between beats 2 and 3)
 * @property {boolean} golden
 */

/**
 * @template {NextCup} C
 * @typedef {{ lesson: Lesson, cup: C | null }} StabCue
 * What to teach, and the cup it is about (null: the notch itself).
 */

/**
 * The cup the straw needs to take next: the earliest still waiting. The
 * game keeps its cups in the order they were planned, which is beat order.
 * @template {{ resolved: boolean }} C
 * @param {readonly C[]} cups
 * @returns {C | null}
 */
export function nextWaiting(cups) {
  for (const cup of cups) if (!cup.resolved) return cup;
  return null;
}

/** @param {(id: string) => boolean} learned @param {Lesson[]} lessons */
const firstUnlearned = (learned, lessons) => lessons.find((lesson) => !learned(lesson.id)) ?? null;

/**
 * What the belt should teach now, from what is coming: the practice line as
 * its first cup rides in, then the first golden cup and the first cup between
 * the beats, each only once it is the next cup the straw needs (and far
 * enough off for its loop to be seen). During the practice, nothing else.
 * @template {NextCup} C
 * @param {{ now: number, next: C | null, practicing: boolean }} moment
 *   `now` is the song time on screen; `next` the earliest cup still waiting.
 * @param {(id: string) => boolean} learned
 * @returns {StabCue<C> | null}
 */
export function lessonNow({ now, next, practicing }, learned) {
  if (!next) return null;
  const ahead = next.time - now;
  if (practicing) {
    return !learned(LESSONS.stab.id) && ahead <= PRACTICE_LEAD ? { lesson: LESSONS.stab, cup: null } : null;
  }
  if (ahead < CUP_LEAD) return null;
  if (next.golden && !learned(LESSONS.golden.id)) return { lesson: LESSONS.golden, cup: next };
  if (next.beat % 1 !== 0 && !learned(LESSONS.offbeat.id)) return { lesson: LESSONS.offbeat, cup: next };
  return null;
}

const ORDER = { perfect: 0, good: 1, graze: 2 };

/**
 * What a stab teaches, said at the notch as it lands: a stab at the bare
 * belt costs a pearl; in expert, a stab the normal windows would have
 * rated better is told the windows are tighter; then the first perfect,
 * the first graze, and which way an early or late stab was off.
 * @param {{ result: StabRating | "bonk", error: number, practicing: boolean, expert: boolean }} stab
 *   `error` is the stab's signed seconds from its cup's beat (0 for a bonk).
 * @param {(id: string) => boolean} learned
 * @returns {Lesson | null}
 */
export function lessonForStab({ result, error, practicing, expert }, learned) {
  if (practicing) return null;
  if (result === "bonk") return firstUnlearned(learned, [LESSONS.bonk]);
  /** @type {Lesson[]} */
  const lessons = [];
  const wider = judgeStab(error, NORMAL);
  if (expert && wider && ORDER[wider] < ORDER[result]) lessons.push(LESSONS.expert);
  if (result === "perfect") lessons.push(LESSONS.perfect);
  else {
    if (result === "graze") lessons.push(LESSONS.graze);
    lessons.push(error < 0 ? LESSONS.early : LESSONS.late);
  }
  return firstUnlearned(learned, lessons);
}

/**
 * What a cup let go teaches: that it cost a pearl (never in the practice,
 * where it didn't).
 * @param {boolean} practicing
 * @param {(id: string) => boolean} learned
 */
export function lessonForMiss(practicing, learned) {
  return practicing ? null : firstUnlearned(learned, [LESSONS.miss]);
}

/**
 * What a new song teaches, on its first downbeat: nightfall's busier belt
 * where the tier has just stepped up, otherwise (or once that is known) to
 * listen for the new beat.
 * @param {{ tierRose: boolean, practicing: boolean }} change
 * @param {(id: string) => boolean} learned
 */
export function lessonForSong({ tierRose, practicing }, learned) {
  if (practicing) return null;
  return firstUnlearned(learned, tierRose ? [LESSONS.night, LESSONS.song] : [LESSONS.song]);
}

/**
 * Whether `next` may take the stage now. Nothing is cut off before it has
 * been up long enough to read; only a higher priority (a lost pearl or a
 * new song over a timing note, the practice over anything) takes over, and
 * then only once the line up has had its minimum. With nothing up, a line
 * waits for `REST` of quiet, except the practice, a lost pearl or a new
 * song, which can't wait for a later instance. A line already up is not
 * offered again.
 * Whether the coach then accepts it is still the coach's call.
 * @param {Lesson} next
 * @param {Lesson | null} current
 * @param {number} age real seconds the current lesson has been up
 * @param {number} [quiet] real seconds since the last lesson came down (Infinity: none yet this run)
 */
export function mayOffer(next, current, age, quiet = Infinity) {
  const rank = (/** @type {Lesson} */ lesson) => lesson.priority ?? (lesson.move ? 2 : 1);
  if (current) return current.id !== next.id && rank(next) > rank(current) && age >= (current.minLife ?? DEFAULT_MIN_LIFE);
  return rank(next) > 1 || quiet >= REST;
}

/**
 * How far into the straw's plunge the practice's ghost is, `since` song
 * seconds after its cup's beat (negative before it): 0 in the hand, 1 stuck
 * in the cup, or null when it isn't shown. The ghost takes the straw's own
 * plunge (eased in, `k²` over `plunge` seconds) started early by however
 * long the tip takes from the hand to the lid, so its tip is on the lid
 * exactly on the beat; it rides in the cup until `ride`. Under Reduce Motion
 * it shows only that contact pose, from the beat.
 * @param {number} since
 * @param {{ rest: number, lid: number, stuck: number, plunge: number, ride: number, reduce: boolean }} straw
 *   `rest`, `lid` and `stuck` are the tip's heights (px, downward): in the
 *   hand, on the cup's lid, and stuck in the cup.
 * @returns {number | null}
 */
export function ghostPlunge(since, { rest, lid, stuck, plunge, ride, reduce }) {
  if (since > ride) return null;
  const contact = Math.min(1, Math.max(0, (lid - rest) / (stuck - rest)));
  if (reduce) return since >= 0 ? contact : null;
  const toLid = plunge * Math.sqrt(contact);
  if (since < -toLid) return null;
  const k = Math.min(1, (since + toLid) / plunge);
  return k * k;
}
