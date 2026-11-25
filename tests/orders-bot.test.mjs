import assert from "node:assert/strict";
import test from "node:test";

import * as rules from "../src/lib/arcade/orders-engine.js";
import { STEADY, botAct, createBot, simulateShift } from "../src/lib/arcade/orders-bot.js";

const SEEDS = Array.from({ length: 24 }, (_, index) => index + 1);

/** Shifts played on many seeds, totalled. */
function shifts(options) {
  const total = { served: 0, sentBack: 0, walkouts: 0, score: 0, finished: 0 };
  for (const seed of SEEDS) {
    const result = simulateShift(rules, { seed, ...options });
    total.served += result.served;
    total.sentBack += result.sentBack;
    total.walkouts += result.walkouts;
    total.score += result.score;
    if (result.seconds >= rules.SHIFT_SECONDS - 0.05) total.finished += 1;
  }
  return total;
}

test("a steady player can serve a whole normal shift without losing a guest", () => {
  const total = shifts({});
  assert.equal(total.sentBack, 0);
  assert.ok(total.walkouts <= 1, `${total.walkouts} walked out over ${SEEDS.length} shifts`);
  assert.equal(total.finished, SEEDS.length, "every shift runs its full two minutes");
  assert.ok(total.served / SEEDS.length >= 11, `${(total.served / SEEDS.length).toFixed(1)} drinks a shift`);
});

test("expert is a lot harder, and still survivable for a steady player", () => {
  const normal = shifts({});
  const expert = shifts({ expert: true });
  assert.equal(expert.sentBack, 0);
  assert.ok(expert.finished >= SEEDS.length * 0.85, `${expert.finished} of ${SEEDS.length} shifts finished`);
  assert.ok(expert.score < normal.score * 0.85, "a lot harder");
});

test("starting the cup under the ordered tap ends wrong-tea send-backs", () => {
  const careless = { slip: 0.2 };
  const before = shifts({ skill: careless, tapAtTake: false, jarAtScoop: false });
  const after = shifts({ skill: careless });
  assert.ok(before.sentBack > SEEDS.length / 2, `a careless player sends ${before.sentBack} back when they must move the cup`);
  assert.equal(after.sentBack, 0);
  assert.ok(after.walkouts <= before.walkouts);
});

test("the bot waits to take in anything new, and lets go of the tap on time", () => {
  const bot = createBot(1);
  assert.deepEqual(bot.skill, STEADY);
  const view = {
    now: 0, cup: null, holding: false, dry: false, tapIndex: 0, target: 0, jarIndex: 0, wanted: 0, teaReady: true, lowTank: -1, restless: false, ticket: true,
  };
  // A ticket appears: nothing for a reaction time, then it is taken.
  assert.equal(botAct(bot, view, 0.05), null);
  let action = null;
  for (let t = 0; t < 1 && !action; t += 0.05) action = botAct(bot, view, 0.05);
  assert.equal(action, "take");
  // Holding the tap: let go once the tea is at (about) the line, however soon.
  view.cup = { guestId: 1, station: "pour", busy: false, tea: "milk", orderTea: "milk", drops: 0, queue: [], stampAt: null, level: 0.5, line: 0.8 };
  view.holding = true;
  assert.equal(botAct(bot, view, 0.01), null);
  view.cup.level = 0.9;
  assert.equal(botAct(bot, view, 0.01), "release");
});

test("a tap that runs dry mid-pour is let go, brewed, and poured on, so nobody waits on it", () => {
  const bot = createBot(2);
  const view = {
    now: 0, holding: true, dry: true, tapIndex: 1, target: 1, jarIndex: 0, wanted: 0, teaReady: false, lowTank: 1, restless: false, ticket: false,
    cup: { guestId: 1, station: "pour", busy: false, tea: "taro", orderTea: "taro", drops: 0, queue: [], stampAt: null, level: 0.3, line: 0.8 },
  };
  assert.equal(botAct(bot, view, 0.01), "release", "let go at once");
  view.holding = false;
  view.dry = false;
  let action = null;
  for (let t = 0; t < 1 && !action; t += 0.05) action = botAct(bot, view, 0.05);
  assert.equal(action, "brew");
  // Brewed: back on the tap.
  view.lowTank = -1;
  view.teaReady = true;
  action = null;
  for (let t = 0; t < 1 && !action; t += 0.05) action = botAct(bot, view, 0.05);
  assert.equal(action, "hold");
  // Over whole shifts, every tank that runs dry is brewed: no guest walks out waiting on one.
  let walkouts = 0;
  for (let seed = 1; seed <= 12; seed++) walkouts += simulateShift(rules, { seed }).walkouts;
  assert.ok(walkouts <= 1);
});
