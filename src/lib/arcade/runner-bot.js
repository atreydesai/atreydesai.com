// Sugar rush's reference player: a competent runner that can read the
// course. The tests use it to prove long runs can be cleared on many seeds,
// and the demo uses it to play itself. It drives only the inputs a player
// has (jump, down, rush), so whatever it does a person could do.
//
// It tries a menu of short input plans (jump now or a little later, tap or
// hold, glide, slide, slam) against copies of the run, picks the one that
// keeps the cups safest, and hands over to a simple reflex between plans.
// DOM-free, like the engine.

import {
  BARREL_SPEED,
  BARREL_W,
  DRONE_SPEED,
  DRONE_W,
  GRAVITY,
  MANTLE,
  RUNNER_H,
  RUNNER_W,
  STEP,
  SUGAR_FULL,
  cloneRun,
  jumpReach,
  plumeBox,
  step,
  swingReach,
} from "./runner-engine.js";

/** @typedef {import("./runner-engine.js").RunState} RunState */
/** @typedef {import("./runner-engine.js").Input} Input */
/** @typedef {{ t: number, done: boolean, high: boolean }} PlanContext */
/** @typedef {{ kind: "reflex" | "jump" | "slam" | "slide", delay: number, hold: number, slamAt: number }} Plan */

const H = STEP;
const HALF_W = RUNNER_W / 2;

/**
 * Whether a roof lower than the feet is live from wall to wall: a wire
 * walk's wire runs the whole low roof between chimney tops, so that roof is
 * no ground to come down on. (Wires and skylights lying on an ordinary roof
 * are hopped as before.)
 * @param {RunState["chunks"][number]} c
 * @param {RunState["chunks"][number]["roofs"][number]} roof
 * @param {number} y the feet
 */
function liveBelow(c, roof, y) {
  if (roof.top >= y - 1) return false;
  return c.items.some((o) => o.type === "wire" && !o.hit && o.y0 === roof.top && o.x0 <= roof.x0 && o.x1 >= roof.x1);
}

/**
 * A cheap reflex for after a plan: jump at edges and things on the roof (a
 * full jump for anything lethal or tall), slide under low things, glide down.
 * @param {RunState} s
 * @param {PlanContext} mem remembers whether the jump under way is a full one
 * @returns {Input}
 */
export function reflex(s, mem) {
  const r = s.runner;
  const rush = s.sugar >= SUGAR_FULL && s.rush === 0 && !s.held.rush;
  if (r.cable) return { rush };
  if (!r.grounded) {
    // On a wire walk, a hop that would carry on past the top below (in a
    // rush, say) drops onto it with a slam.
    if (!r.slamming && r.vy < 150) {
      for (const c of s.chunks) {
        if (c.x1 < r.x || c.x0 > r.x) continue;
        for (const roof of c.roofs) {
          if (roof.x0 + 2 > r.x || roof.x1 - 4 < r.x || roof.top > r.y || liveBelow(c, roof, r.y)) continue;
          const after = c.roofs.find((o) => o.x0 === roof.x1);
          if (!after || !liveBelow(c, after, r.y)) continue;
          const fall = (r.vy + Math.sqrt(r.vy * r.vy + 2 * GRAVITY * (r.y - roof.top))) / GRAVITY;
          if (r.x + r.vx * fall > roof.x1 + HALF_W - 2) return { down: !s.held.down, rush };
        }
      }
    }
    // Glide down only over a gap (or a live roof) or out of a fast fall, never onto what is ahead.
    let below = false;
    for (const c of s.chunks) {
      if (c.x1 < r.x || c.x0 > r.x + r.vx * 0.3) continue;
      for (const roof of c.roofs) {
        if (roof.x1 > r.x && roof.x0 < r.x + r.vx * 0.3 && roof.top <= r.y + 1 && roof.top > r.y - 150 && !liveBelow(c, roof, r.y)) below = true;
      }
    }
    return { jump: (mem.high && r.jumpHold > 0) || (r.vy < 0 && (!below || r.vy < -450)), rush };
  }
  const front = r.x + HALF_W;
  const look = r.vx * 0.16;
  let jump = false;
  let high = false;
  let down = false;
  let ground = false;
  // On a wire walk: whether the roof ahead is live, where the surface
  // underfoot ends, and the next top beyond to come down on.
  let live = false;
  let edge = -Infinity;
  /** @type {null | RunState["chunks"][number]["roofs"][number]} */
  let next = null;
  /** @param {number} near @param {number} [closing] @param {number} [lead] */
  const ahead = (near, closing = r.vx, lead = 0.16) => {
    const gap = near - front;
    return gap >= 0 && gap <= closing * lead;
  };
  /** @param {number} near @param {number} [closing] */
  const overhead = (near, closing = r.vx) => {
    const gap = near - front;
    return gap >= -4 && gap <= closing * 0.08 + 4;
  };
  /** Something low over the runner already: stay down, whatever is ahead. */
  let under = false;
  for (const c of s.chunks) {
    if (c.x1 < r.x - 50 || c.x0 > front + look + 120) continue;
    for (const roof of c.roofs) {
      if (ahead(roof.x0) && roof.top > r.y + MANTLE) {
        jump = true;
        high = high || roof.top > r.y + 40;
      }
      if (roof.x0 <= front + look && roof.x1 >= front + look && roof.top >= r.y - 150 && roof.top <= r.y + MANTLE) {
        if (liveBelow(c, roof, r.y)) live = true;
        else ground = true;
      }
      if (Math.abs(roof.top - r.y) < 0.1 && roof.x0 <= r.x + HALF_W && roof.x1 >= r.x - HALF_W) edge = Math.max(edge, roof.x1);
      if (roof.x0 > front && roof.top > r.y - 60 && roof.top <= r.y + MANTLE + 20 && !liveBelow(c, roof, r.y) && (!next || roof.x0 < next.x0)) next = roof;
    }
    for (const gap of c.gaps) {
      // Over the railway, always a full jump, even from the very edge.
      if (gap.assist === "rail" && gap.x0 - front >= -RUNNER_W && gap.x0 - front <= look) high = true;
    }
    for (const o of c.items) {
      if (o.type === "ledge" && o.x0 <= front + look && o.x1 >= front + look && Math.abs(o.y - r.y) < 0.1) ground = true;
      if (o.type === "boards" && !o.gone && o.x0 <= front + look && o.x1 >= front + look && Math.abs(o.y - r.y) < 0.1 && o.at < 0) ground = true;
      if ("hit" in o && (o.hit || o.broken)) continue;
      switch (o.type) {
        case "ac":
        case "tank":
        case "crate":
          if (o.x0 <= front + look && o.x1 >= front + look && Math.abs(o.y1 - r.y) < 0.1) ground = true;
          if (ahead(o.x0) && o.y1 > r.y + 0.1 && o.y0 < r.y + RUNNER_H) {
            jump = true;
            high = high || o.y1 - r.y > 20;
          }
          break;
        case "wire":
        case "skylight":
          if (ahead(o.x0) && Math.abs(o.y0 - r.y) < 0.1) {
            jump = true;
            high = true;
          }
          break;
        case "steam":
          // The plume needs the top of a full jump: go early.
          if (ahead(plumeBox(o).x0, r.vx, 0.32) && Math.abs(o.y0 - r.y) < 0.1) {
            jump = true;
            high = true;
          }
          break;
        case "barrel":
          if ((o.state === "wait" || o.state === "roll") && ahead(o.x - BARREL_W / 2, r.vx + BARREL_SPEED) && Math.abs(o.y - r.y) < 0.1) jump = true;
          break;
        case "clothesline":
        case "billboard":
        case "neon":
          if (o.y0 < r.y + RUNNER_H && o.y1 > r.y) {
            if (overhead(o.x0)) down = true;
            if (r.sliding && o.x0 < front && o.x1 > r.x - HALF_W) under = true;
          }
          break;
        case "swing": {
          const span = swingReach(o);
          if (Math.abs(o.y - r.y) > 0.1) break;
          if (overhead(span.x0)) down = true;
          if (r.sliding && span.x0 < front && span.x1 > r.x - HALF_W) under = true;
          break;
        }
        case "drone":
          if (o.state === "fly" && overhead(o.x - DRONE_W / 2, r.vx + DRONE_SPEED) && o.y < r.y + RUNNER_H && o.y > r.y) down = true;
          break;
      }
    }
  }
  if (under) return { down: true, rush };
  // Over a live roof, hop once a tap comes down on the middle of the next
  // top (or at the very edge, if that comes first); anywhere else, at once.
  let wait = false;
  if (!ground && live && next) {
    const aim = Math.min((next.x0 + next.x1) / 2, next.x0 + 0.25 * r.vx);
    wait = r.x + jumpReach(r.vx, next.top - r.y, H) < aim && r.x < edge - 2;
  }
  if (!ground && !wait) jump = true;
  if (down) return { down: r.sliding || !s.held.down, rush };
  if (jump) {
    mem.high = high;
    return { jump: !s.held.jump, rush };
  }
  return { rush };
}

/**
 * @param {Plan["kind"]} kind
 * @param {number} [delay]
 * @param {number} [hold]
 * @param {number} [slamAt]
 * @returns {Plan}
 */
const plan = (kind, delay = 0, hold = 0, slamAt = -1) => ({ kind, delay, hold, slamAt });

/** Every plan the bot weighs: the reflex, then jumps, slams and slides at a few delays. */
export const PLANS = /** @type {Plan[]} */ ([plan("reflex")]);
for (const d of [0, 0.03, 0.06, 0.1, 0.15, 0.2, 0.27, 0.35, 0.45]) {
  for (const h of [H, 0.07, 0.14, 0.3, Infinity]) PLANS.push(plan("jump", d, h));
}
for (const d of [0, 0.08, 0.16, 0.25]) for (const a of [0.25, 0.4, 0.55]) PLANS.push(plan("jump", d, 0.3, a));
for (const d of [0, 0.1, 0.2]) for (const a of [0.15, 0.3]) PLANS.push(plan("jump", d, H, a));
for (const d of [0, 0.05, 0.1, 0.2, 0.3]) PLANS.push(plan("slam", d));
for (const d of [0, 0.05, 0.1, 0.18, 0.28]) for (const h of [H, 0.8]) PLANS.push(plan("slide", d, h));

/** @returns {PlanContext} */
const freshContext = () => ({ t: 0, done: false, high: false });

/**
 * The keys a plan holds at its moment `ctx.t`.
 * @param {Plan} p
 * @param {PlanContext} ctx
 * @param {RunState} s
 * @returns {Input}
 */
export function planInput(p, ctx, s) {
  if (p.kind === "reflex" || ctx.done) return reflex(s, ctx);
  const { t } = ctx;
  const r = s.runner;
  const rush = s.sugar >= SUGAR_FULL && s.rush === 0 && !s.held.rush;
  let jump = false;
  let down = false;
  let end = p.delay;
  if (p.kind === "jump") {
    jump = p.hold === Infinity ? t >= p.delay && !(r.grounded && t > p.delay + 0.05) : t >= p.delay && t < p.delay + p.hold;
    if (p.slamAt >= 0) down = Math.abs(t - (p.delay + p.slamAt)) < H / 2;
    end = p.delay + Math.max(p.hold === Infinity ? 0.05 : p.hold, p.slamAt) + H;
  } else if (p.kind === "slam") {
    down = Math.abs(t - p.delay) < H / 2;
    end = p.delay + H;
  } else {
    down = t >= p.delay && t < p.delay + p.hold;
    end = p.delay + p.hold;
  }
  if (t > end && (r.grounded || r.cable)) {
    ctx.done = true;
    return reflex(s, ctx);
  }
  return { jump, down, rush };
}

/**
 * What the bot values. A cup lost is nearly as bad as a fall; anything
 * lethal is worst of all. Spare cups are worth `spare` (the tests that check
 * the safe line set it to 0, so the bot never goes out of its way for one).
 * @typedef {{ spare?: number }} Values
 */

/**
 * Plays a plan forward on a copy of the run and scores what happened.
 * @param {RunState} s0
 * @param {Plan} p
 * @param {PlanContext} ctx0
 * @param {Values} [values]
 */
export function evaluate(s0, p, ctx0, values = {}) {
  const spareValue = values.spare ?? 0;
  const s = cloneRun(s0);
  const ctx = { ...ctx0 };
  let penalty = 0;
  let bonus = 0;
  const n = Math.round(1.3 / H);
  let tail = 0;
  for (let i = 0; i < n + tail; i++) {
    const events = step(s, planInput(p, ctx, s), H);
    ctx.t += H;
    for (const e of events) {
      if (e.type === "lethal") penalty += 3e6 - i;
      else if (e.type === "fall") penalty += 1e6 - i;
      else if (e.type === "hit") penalty += 8e5 - i;
      else if (e.type === "wall") penalty += 5e5;
      else if (e.type === "dry") penalty += 3e5;
      else if (e.type === "over") penalty += 1e6;
      else if (e.type === "spill") penalty += 4000 * e.amount;
      else if (e.type === "miss") penalty += 300;
      else if (e.type === "delivery") bonus += 400 + 400 * e.tea;
      else if (e.type === "pearl") bonus += 15;
      else if (e.type === "smash") bonus += 40;
      else if (e.type === "spare") bonus += spareValue;
    }
    if (s.status !== "running") break;
    // A plan that ends in the air is followed down, so a late fall still counts.
    if (i === n - 1 && !s.runner.grounded) tail = Math.round(0.8 / H);
    if (tail && i >= n && s.runner.grounded) break;
  }
  return { penalty, value: bonus - penalty };
}

/**
 * A bot to drive a run step by step.
 * @param {Values} [values]
 */
export function createBot(values = {}) {
  return { plan: PLANS[0], ctx: freshContext(), steps: 0, values };
}

/** @typedef {ReturnType<typeof createBot>} Bot */

/**
 * The keys the bot holds for the next step of `s`. Every sixth step it looks
 * 1.3 seconds ahead on its current plan; if that goes badly, it weighs every
 * plan and takes the best. Call once per step, then step the run with it.
 * @param {Bot} bot
 * @param {RunState} s
 * @returns {Input}
 */
export function botInput(bot, s) {
  if (bot.steps % 6 === 0 && s.status === "running") {
    const current = evaluate(s, bot.plan, bot.ctx, bot.values);
    if (current.penalty > 20) {
      let best = current.value;
      for (const candidate of PLANS) {
        const e = evaluate(s, candidate, freshContext(), bot.values);
        if (e.value > best + 1) {
          best = e.value;
          bot.plan = candidate;
          bot.ctx = freshContext();
        }
      }
    }
  }
  bot.steps += 1;
  const input = planInput(bot.plan, bot.ctx, s);
  bot.ctx.t += H;
  return input;
}

/**
 * Drives a run with the bot until it has gone `distance` further, or for
 * `seconds`, or past `stopX`. Returns every cup lost, and how the run ended
 * if it did, as short descriptions.
 * @param {RunState} s
 * @param {{ distance?: number, seconds?: number, stopX?: number, values?: Values }} [options]
 */
export function drive(s, { distance = Infinity, seconds = 120, stopX = Infinity, values = {} } = {}) {
  const bot = createBot(values);
  /** @type {string[]} */
  const lost = [];
  const from = s.distance;
  for (let i = 0; i < seconds / H && s.distance - from < distance && s.runner.x < stopX && s.status !== "over"; i++) {
    for (const e of step(s, botInput(bot, s), H)) {
      if (e.type === "fall" || e.type === "dry" || e.type === "hit" || e.type === "lethal") {
        const chunk = s.chunks.find((c) => c.x0 <= e.x && c.x1 >= e.x);
        lost.push(`${e.type}${e.what && e.what !== e.type ? ` (${e.what})` : ""} at ${Math.round(e.x)} in ${chunk?.pattern}`);
      }
    }
  }
  return lost;
}
