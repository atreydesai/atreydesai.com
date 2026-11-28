import type { Badge } from "./schema.ts";

/**
 * Badges, made from their pattern: ten milestones for each of twelve counts.
 * The busiest counts climb to a thousand, the rest to a hundred and twenty;
 * each milestone after the first opens nine days after the one before, and
 * each count a day after the one listed before it.
 */
const COUNTS = [
  ["served", "cups served", "long"],
  ["perfect", "perfect skills", "long"],
  ["tips", "tip coins", "long"],
  ["stories", "stories finished", "short"],
  ["recipes", "recipes stamped", "long"],
  ["chores", "chores finished", "short"],
  ["harvests", "harvests", "short"],
  ["deliveries", "deliveries", "short"],
  ["tasteoffs", "taste-offs won", "short"],
  ["gulls", "birds shooed", "short"],
  ["machines", "machine tiers", "short"],
  ["days", "days open", "short"],
] as const;

const STEPS = {
  long: [1, 5, 10, 25, 50, 100, 200, 400, 750, 1000],
  short: [1, 3, 5, 10, 20, 35, 50, 75, 100, 120],
};

const seedOf = (id: string) => [...id].reduce((n, c) => n + c.charCodeAt(0), 0);

export const BADGES: readonly Badge[] = COUNTS.flatMap(
  ([metric, label, scale], m) =>
    STEPS[scale].map((target, k) => {
      const id = `${metric}-${target}`;
      return {
        id,
        name: `${target} ${label}`,
        day: k === 0 ? 1 : 9 * k + m,
        art: { kind: "badge", motif: id, color: "#91a17d", seed: seedOf(id) },
        metric,
        target,
        reward: "pin-" + id,
      };
    }),
);
