/** Serializable deterministic randomness: no wall clock in the engines. */
export function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function random(seed: number) {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return { seed: x >>> 0, value: (x >>> 0) / 4294967296 };
}
export function pick<T>(values: readonly T[], seed: number): T {
  return values[hash(String(seed)) % values.length];
}
export function dailySeed(date: string, mode: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Use a YYYY-MM-DD daily seed.");
  return hash("order-up:" + date + ":" + mode);
}
