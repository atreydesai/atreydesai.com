// Small numeric helpers every game and engine was writing for itself. Pure
// and DOM-free, so engines and node tests import them as well as scenes.

/** `value` held between `low` and `high`. */
export const clamp = (value: number, low: number, high: number) => (value < low ? low : value > high ? high : value);

/** The point `t` of the way from `a` to `b`. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Smoothstep of a `t` already in 0..1 (not clamped). */
export const smooth = (t: number) => t * t * (3 - 2 * t);

/** Smoothstep of `value` between the edges `low` and `high`, clamped to 0..1. */
export function smoothstep(low: number, high: number, value: number) {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
}

/** `value` on a grid of `cell` (the arcade's pixel cell is 4 CSS px). */
export const snap = (value: number, cell = 4) => Math.round(value / cell) * cell;

/** 0..1 in `steps` equal steps, rounding up (a meter that shows any progress at all). */
export const quantizeUp = (t: number, steps: number) => Math.ceil(clamp(t, 0, 1) * steps) / steps;

/** 0..1 in `steps` equal steps, to the nearest. */
export const quantize = (t: number, steps: number) => Math.round(clamp(t, 0, 1) * steps) / steps;

/** Eases `current` toward `target` at `rate` per second, the same at any frame rate. */
export const damp = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-rate * dt));

/**
 * Moves `current` a share `min(1, rate · dt)` of the way to `target`: the
 * cheaper ease some scenes were tuned with. Prefer `damp` for anything new.
 */
export const approach = (current: number, target: number, rate: number, dt: number) =>
  current + (target - current) * Math.min(1, rate * dt);
