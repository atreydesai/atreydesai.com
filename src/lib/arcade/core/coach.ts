// In-game teaching, shared by every game. A lesson is one thing taught at
// the moment it first matters, inside the live game rather than on a card
// in front of it: where the game allows, play stops (or, for a lesson that
// asks for it, eases into slow motion), a callout sits beside the thing in
// the world (never up in the HUD, where the eye isn't), the game may draw a
// ghost of the move, and play comes back to speed once the player has
// continued or made the move. Each lesson is shown until it
// has been done `times` times on this device, then never again.
//
// DOM-free apart from guarded storage, so the rules can be tested in node.

import type { GameId } from "#lib/boba.ts";

export interface Lesson {
  /** Unique within the game; the device remembers it by this. */
  id: string;
  /** One line, in the arcade's voice: what to do, or what the thing is for. */
  text: string;
  /** For a first sighting: the thing's name, set in italic before the line. */
  name?: string;
  /** Keys shown as chips on a keyboard device. */
  keys?: string[];
  /** The gesture on touch ("tap", "hold"), shown there instead of the keys. */
  touch?: string;
  /**
   * Time scale while the lesson holds: 0 pauses play outright (anything
   * important), a fraction slows it, 1 teaches at full speed.
   */
  slow?: number;
  /** Real seconds before it ends by itself; Infinity waits for `done`. */
  life?: number;
  /** Real seconds it stays up at least, even once done (so it can be read). */
  minLife?: number;
  /** How many times it is done before the device stops showing it. */
  times?: number;
  /** A move the player has to make now (`acted`/`done` resolve it). */
  move?: boolean;
  /**
   * Which lesson gives way to which: a higher priority takes over from a
   * lower one. Defaults: a thing 1, a move 2. A power-up sits between them,
   * and a hazard about to be met above a power-up but below a move.
   */
  priority?: number;
  // The coach never reads the fields below: they are for a game that holds
  // play some other way than slowing it (spill holds its room), carried on
  // the lesson so the game needn't keep a second record of it.
  /** It holds the game while it explains (spill: the planning dial, or a room's result). */
  hold?: boolean;
  /** False: it offers no Continue, since doing what it asks is how it ends (spill's Pour). */
  continuable?: boolean;
  /**
   * The part of the game it belongs to, which ends it as the next begins
   * (spill: "plan", "pour", "result", or "any").
   */
  during?: string;
}

export interface Coach {
  /** The lesson on screen, if any. */
  readonly current: Lesson | null;
  /** Real seconds the current lesson has been up. */
  readonly age: number;
  /** The time scale to run the game at this frame (1 is full speed). */
  readonly scale: number;
  /** Play is stopped for the current lesson, which still holds (its scale has reached 0). */
  readonly paused: boolean;
  /** The current lesson has been done and is on its way out. */
  readonly leaving: boolean;
  /** The last part of leaving, after it has been readable long enough: the callout fades now. */
  readonly fading: boolean;
  /** The player has made the move; play is back at speed while the game sees whether it worked. */
  readonly acting: boolean;
  /** Whether the device has finished with a lesson. */
  learned(id: string): boolean;
  /**
   * Shows `lesson` if the device still needs it and nothing else is up, or
   * what is up has a lower priority (a move also takes over from a lesson on
   * its way out; anything else waits for it to fade). Returns true when it
   * is (now or already) the current lesson.
   */
  offer(lesson: Lesson): boolean;
  /** The player did it: counts toward `times`, and play eases back to speed. */
  done(id?: string): void;
  /**
   * The player made the move the current lesson asks for: play eases back to
   * speed, but the lesson stays up uncounted until the game calls `done`
   * (it worked) or `dismiss` (it didn't, so the next instance teaches it).
   */
  acted(id: string): void;
  /** Takes the current lesson down without counting it (a missed move, the run ended). */
  dismiss(): void;
  /** A fresh run: no lesson, full speed at once. */
  reset(): void;
  /** Counts a lesson as learned without showing it (the player already knows). */
  skip(id: string): void;
  /**
   * Advances lessons by `realDt`, the real seconds since the last frame
   * (uncapped, so a hold lasts as long on a slow device as a fast one), and
   * returns this frame's game seconds: `gameDt` (the game's own capped
   * step, real seconds by default) at the lesson's time scale.
   */
  step(realDt: number, gameDt?: number): number;
}

const STORE_KEY = "boba_coach_v1";
/** How quickly play eases into slow motion, and back out (seconds). */
const EASE_IN = 0.16;
const EASE_OUT = 0.25;
/** How quickly play comes to a stop for a lesson that pauses: a beat, not a jolt. */
const PAUSE_IN = 0.06;
/** A lesson's callout stays up this long by default (real seconds). */
const DEFAULT_LIFE = 4.5;
const DEFAULT_MIN_LIFE = 0.9;
/** A finished lesson fades over this long, once it has been up its minimum. */
const FADE = 0.3;

const priorityOf = (lesson: Lesson) => lesson.priority ?? (lesson.move ? 2 : 1);

type Store = Partial<Record<GameId, Record<string, number>>>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Storage can be off: the lessons may show again next visit, that's all.
  }
}

/** Forgets every lesson for `game` (or every game), so they all show again. */
export function resetLessons(game?: GameId) {
  if (!game) {
    writeStore({});
    return;
  }
  const store = readStore();
  delete store[game];
  writeStore(store);
}

/**
 * The coach for one game. `persist: false` keeps what it learns to this
 * coach alone (tests, or a game that wants a lesson every run).
 */
export function createCoach(game: GameId, { persist = true } = {}): Coach {
  const counts: Record<string, number> = { ...(persist ? (readStore()[game] ?? {}) : {}) };
  let current: Lesson | null = null;
  let age = 0;
  let scale = 1;
  let leaving = false;
  let leftAt = 0;
  let acting = false;

  const need = (lesson: Lesson) => (counts[lesson.id] ?? 0) < (lesson.times ?? 1);

  function count(id: string) {
    counts[id] = (counts[id] ?? 0) + 1;
    if (!persist) return;
    const store = readStore();
    store[game] = { ...(store[game] ?? {}), [id]: counts[id] };
    writeStore(store);
  }

  function retire() {
    current = null;
    age = 0;
    leaving = false;
    acting = false;
  }

  return {
    get current() {
      return current;
    },
    get age() {
      return age;
    },
    get scale() {
      return scale;
    },
    get paused() {
      return !!current && !leaving && !acting && scale === 0;
    },
    get leaving() {
      return leaving;
    },
    get fading() {
      return !!current && leaving && age >= Math.max(current.minLife ?? DEFAULT_MIN_LIFE, leftAt);
    },
    get acting() {
      return acting;
    },
    learned(id) {
      return (counts[id] ?? 0) > 0;
    },
    offer(lesson) {
      if (current?.id === lesson.id) return true;
      if (!need(lesson)) return false;
      if (current && leaving && !lesson.move) return false;
      if (current && !leaving) {
        if (priorityOf(lesson) <= priorityOf(current)) return false;
        // A thing interrupted counts as seen if it was up long enough to read;
        // a move never counts until it has worked.
        if (!current.move && age >= (current.minLife ?? DEFAULT_MIN_LIFE)) count(current.id);
      }
      current = lesson;
      age = 0;
      leaving = false;
      acting = false;
      return true;
    },
    done(id) {
      if (id && current?.id !== id) {
        // Done before it was ever shown: the player already knows it.
        if ((counts[id] ?? 0) === 0) count(id);
        return;
      }
      if (!current || leaving) return;
      count(current.id);
      leaving = true;
      leftAt = age;
    },
    acted(id) {
      if (current?.id === id && !leaving) acting = true;
    },
    dismiss() {
      retire();
    },
    reset() {
      retire();
      scale = 1;
    },
    skip(id) {
      if ((counts[id] ?? 0) === 0) count(id);
    },
    step(realDt, gameDt = realDt) {
      // Real time, but never a leap: a tab coming back after a minute is not a
      // minute of lesson (games pause when hidden, so frames are rarely this long).
      const dt = Math.min(Math.max(0, realDt), 1);
      let target = 1;
      if (current) {
        age += dt;
        const life = current.life ?? DEFAULT_LIFE;
        const minLife = current.minLife ?? DEFAULT_MIN_LIFE;
        if (!leaving && !acting && age >= life) {
          // Ran its course without being done. A thing counts as seen; a move
          // that was never made comes down uncounted, to be taught again (one
          // being attempted is left for the game to judge).
          if (current.move) {
            retire();
            target = 1;
          } else {
            count(current.id);
            leaving = true;
            leftAt = age;
          }
        }
        if (current && leaving && age >= Math.max(minLife, leftAt) + FADE) retire();
        else if (current && !leaving && !acting) target = current.slow ?? 1;
      }
      const tau = target < scale ? (target === 0 ? PAUSE_IN : EASE_IN) : EASE_OUT;
      scale += (target - scale) * (1 - Math.exp(-dt / tau));
      if (Math.abs(target - scale) < 0.01) scale = target;
      // The scale applies to the game's capped step, so a slow device still slows.
      return Math.max(0, gameDt) * scale;
    },
  };
}
