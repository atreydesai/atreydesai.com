// A fixed pool of reusable things (particles, chips, sparks): allocated
// once, never garbage per frame. Live items are the first `count`; a dead
// one swaps with the last live one.

export interface Pool<T> {
  readonly items: readonly T[];
  readonly count: number;
  /** A free item to fill in, or null when every one is live. */
  spawn(): T | null;
  /** Steps every live item; `update` returns false to retire it. */
  step(update: (item: T) => boolean): void;
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
    step(update) {
      for (let i = 0; i < count; ) {
        if (update(items[i])) {
          i++;
          continue;
        }
        count--;
        const dead = items[i];
        items[i] = items[count];
        items[count] = dead;
      }
    },
    clear() {
      count = 0;
    },
  };
}
