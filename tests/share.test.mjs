import assert from "node:assert/strict";
import test from "node:test";

import { emojiRows, figure, playLink, scoreLine, sharedStats, shareText } from "../src/lib/arcade/share.ts";

const STACK = {
  gameId: "stack",
  game: "cup stack",
  expert: false,
  score: 38,
  unit: "cups",
  newBest: true,
  stats: [
    { label: "cups stacked", value: 38 },
    { label: "perfect drops", value: 12 },
    { label: "best streak", value: "×5" },
    { label: "personal best", value: 38 },
  ],
  lines: ["🟧🟧🟨🟧🟥", "🟧🟨"],
};

test("the shared text reads on its own: game, score, stats in words, the run, a link in", () => {
  assert.equal(
    shareText(STACK),
    [
      "🧋 cup stack",
      "38 cups, a new best",
      "perfect drops: 12",
      "best streak: ×5",
      "",
      "🟧🟧🟨🟧🟥",
      "🟧🟨",
      "",
      "atreydesai.com/?play=stack",
    ].join("\n"),
  );
});

test("expert says so, and a run with no lines and no stats still shares its score", () => {
  const text = shareText({
    ...STACK,
    expert: true,
    score: 0,
    newBest: false,
    stats: [
      { label: "cups stacked", value: 0 },
      { label: "perfect drops", value: 0 },
      { label: "best streak", value: "×0" },
      { label: "personal best", value: 4 },
    ],
    lines: ["  ", ""],
  });
  assert.equal(text, ["🧋 cup stack (expert)", "0 cups", "", "atreydesai.com/?play=stack"].join("\n"));
});

test("shared stats skip the personal best, the score repeated, and anything that came to nothing", () => {
  assert.deepEqual(
    sharedStats(
      [
        { label: "time on shift", value: "3:19" },
        { label: "cups caught", value: 141 },
        { label: "golden cups", value: 0 },
        { label: "average grade", value: "–" },
        { label: "distance", value: "0 m" },
        { label: "perfect catches", value: 38 },
        { label: "personal best", value: 1240 },
      ],
      1240,
      "points",
    ),
    [
      { label: "time on shift", value: "3:19" },
      { label: "cups caught", value: 141 },
      { label: "perfect catches", value: 38 },
    ],
  );
  // A stat that only counts the same thing as the score goes; one that
  // happens to share its number but not its noun stays.
  assert.deepEqual(sharedStats([{ label: "cups stacked", value: 12 }, { label: "best combo", value: 12 }], 12, "cups"), [
    { label: "best combo", value: 12 },
  ]);
  assert.equal(sharedStats(STACK.stats, 38, "cups", 1).length, 1);
});

test("figures group their thousands, words pass through, and the link carries only the game", () => {
  assert.equal(figure(13940), "13,940");
  assert.equal(figure("131 of 144"), "131 of 144");
  assert.equal(scoreLine(13940, "points", false), "13,940 points");
  assert.equal(scoreLine(1, "cups", true), "1 cup, a new best");
  assert.equal(scoreLine(0, "cups", false), "0 cups");
  assert.equal(playLink("lander"), "atreydesai.com/?play=lander");
});

test("emoji rows wrap a long run into a tidy block", () => {
  assert.deepEqual(emojiRows(["a", "b", "c", "d", "e"], 2, 2), ["ab", "cd…"]);
  assert.deepEqual(emojiRows([], 10, 3), []);
});
