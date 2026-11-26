// Order up's hand keys: which hold a key press opens, and which release to
// ignore. Space and Enter both work the hand, so each key holds the tap on
// its own, and letting go of one never closes a pour another is holding.
// An Enter that continued a lesson was used up by it, so its release does
// nothing at all. DOM-free, so the rules can be tested in node.

/** The keys that work the hand. */
export const HAND_KEYS = Object.freeze([" ", "Enter"]);

/**
 * The hold a key opens from `from` (the window, the hand button, a tap):
 * one per key, so keys never release each other's holds.
 * @param {string} from
 * @param {string} key the event's `key`
 */
export function keyHold(from, key) {
  return `${from}:${key === " " ? "space" : key.toLowerCase()}`;
}

/**
 * Keys whose press something else used (Enter continuing a lesson): each
 * one's next release is ignored.
 */
export function createKeyLatch() {
  /** @type {Set<string>} */
  const taken = new Set();
  return {
    /** This press was used up: its release does nothing. @param {string} key */
    take(key) {
      taken.add(key);
    },
    /** The key came up: true if its press was used up, so the release is ignored. @param {string} key */
    release(key) {
      return taken.delete(key);
    },
    /** Keys can't be seen coming up while the window is away: forget them. */
    clear() {
      taken.clear();
    },
  };
}

/** @typedef {ReturnType<typeof createKeyLatch>} KeyLatch */

/**
 * What a key's release does: the hold from `from` to let go of, or null
 * (not a hand key, or its press was used up).
 * @param {KeyLatch} latch
 * @param {string} from
 * @param {string} key the event's `key`
 */
export function releaseFor(latch, from, key) {
  if (!HAND_KEYS.includes(key)) return null;
  if (latch.release(key)) return null;
  return keyHold(from, key);
}
