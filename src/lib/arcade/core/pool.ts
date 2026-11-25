// A fixed pool of reusable things (particles, crumbs, sparks): allocated
// once, never garbage per frame. Live items are the first `count`, drawn in
// that order. A step walks them from the last to the first, and a dead one
// swaps with the last live one (already stepped), which is the order cup
// stack's bits and tea minus's particles have always been drawn in.

export interface Pool<T> {
  /** Every item, live ones first: draw `items[0]` to `items[count - 1]`. */
  readonly items: readonly T[];
  readonly count: number;
  /** A free item to fill in, or null when every one is live. */
  spawn(): T | null;
  /**
   * Steps every live item, last to first; `update` returns false to retire
   * it. `dt` is passed through, so the update can be one function made once.
   */
  step(update: (item: T, dt: number) => boolean, dt?: number): void;
  clear(): void;
}

export function createPool<T>(max: number, make: () => T): Pool<T> {
  const items = Array.from({ length: max }, make);
  let count = 0;
  return {
    items,
    get count() {
      return count;
    },
    spawn() {
      if (count >= max) return null;
      return items[count++];
    },
    step(update, dt = 0) {
      for (let i = count - 1; i >= 0; i--) {
        const item = items[i];
        if (update(item, dt)) continue;
        count--;
        items[i] = items[count];
        items[count] = item;
      }
    },
    clear() {
      count = 0;
    },
  };
}
