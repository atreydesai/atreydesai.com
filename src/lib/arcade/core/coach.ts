// In-game teaching, shared by every game. A lesson is one thing taught at
// the moment it first matters, inside the live game rather than on a card
// in front of it: where the game allows, play eases into slow motion, a
// callout sits beside the thing in the world (never up in the HUD, where
// the eye isn't), the game may draw a ghost of the move, and play eases
// back to speed once the player has done it. Each lesson is shown until it
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
  /** Time scale while the lesson holds: 1 teaches at full speed. */
  slow?: number;
  /** Real seconds before it ends by itself; Infinity waits for `done`. */
  life?: number;
  /** Real seconds it stays up at least, even once done (so it can be read). */
  minLife?: number;
  /** How many times it is done before the device stops showing it. */
  times?: number;
  /**
   * A move the player has to make now. It takes over from a lesson that
   * only names a thing (which then counts as seen), never from another move.
   */
  move?: boolean;
}

export interface Coach {
  /** The lesson on screen, if any. */
  readonly current: Lesson | null;
  /** Real seconds the current lesson has been up. */
  readonly age: number;
  /** The time scale to run the game at this frame (1 is full speed). */
  readonly scale: number;
  /** The current lesson has been done and is on its way out. */
  readonly leaving: boolean;
  /** The player has made the move; play is back at speed while the game sees whether it worked. */
  readonly acting: boolean;
  /** Whether the device has finished with a lesson. */
  learned(id: string): boolean;
  /**
   * Shows `lesson` if the device still needs it and nothing else is up (a
   * lesson on its way out, or one naming a thing when this is a move, gives
   * way). Returns true when it is (now or already) the current lesson.
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
  /** Advances by real seconds; returns the game's seconds for this frame. */
  step(realDt: number): number;
}

const STORE_KEY = "boba_coach_v1";
/** How quickly play eases into slow motion, and back out (seconds). */
const EASE_IN = 0.16;
const EASE_OUT = 0.25;
/** A lesson's callout stays up this long by default (real seconds). */
const DEFAULT_LIFE = 4.5;
const DEFAULT_MIN_LIFE = 0.9;
/** A finished lesson fades over this long before the next can take its place for good. */
const FADE = 0.3;

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
    get leaving() {
      return leaving;
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
      if (current && !leaving) {
        if (!lesson.move || current.move) return false;
        // A thing interrupted by a move counts as seen only if it was up long enough to read.
        if (age >= (current.minLife ?? DEFAULT_MIN_LIFE)) count(current.id);
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
    step(realDt) {
      const dt = Math.max(0, realDt);
      let target = 1;
      if (current) {
        age += dt;
        const life = current.life ?? DEFAULT_LIFE;
        const minLife = current.minLife ?? DEFAULT_MIN_LIFE;
        if (!leaving && age >= life) {
          // Ran its course without being done: it counts as seen once.
          count(current.id);
          leaving = true;
          leftAt = age;
        }
        if (leaving && age >= Math.max(minLife, leftAt + FADE)) retire();
        else if (!leaving && !acting) target = current.slow ?? 1;
      }
      const tau = target < scale ? EASE_IN : EASE_OUT;
      scale += (target - scale) * (1 - Math.exp(-dt / tau));
      if (Math.abs(target - scale) < 0.01) scale = target;
      return dt * scale;
    },
  };
}
