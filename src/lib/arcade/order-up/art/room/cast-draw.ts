/**
 * How each person in the room looks this moment: standing or mid-stride,
 * sitting (facing us or with their back to us), sipping, turned to whoever
 * shares their table, a child swinging their feet, a dog trotting, lying
 * down and thumping its tail. The moment is a time in seconds; the idle
 * movements step a few times a second, so a seated crowd needs no more than
 * the room's slow idle redraw, and with Reduce Motion everyone holds still.
 */
import type { Painter } from "../../../core/painter.ts";
import type { Light } from "../../../core/light.ts";
import type { Seat } from "./types.ts";
import type { Walker } from "./actors.ts";
import { chefSprite, guestSprite, sittingSprite, kidSprite, dogSprite, CARRY, type PersonSprite } from "./people.ts";

export interface Look {
  /** Names the picture, for caching it. */
  key: string;
  sprite: PersonSprite;
  /** A cup in hand, where it is relative to the feet. */
  carry?: PersonSprite;
  carryAt?: [number, number];
  /** Pixels up from the feet (a seat's height). */
  lift: number;
  flip: boolean;
}

const INK = "#2b2126";

function hash(text: string) {
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/** True for `on` seconds in every `period`, at a phase of its own for each `id`. */
const every = (t: number, id: string, period: number, on: number) => ((t + (hash(id) % 997) / 97) % period) < on;

/**
 * The look of someone at time `t`. `seat` is the seat they hold, `others`
 * everyone in the room (to find a table-mate to turn to). `step` is their
 * walk-cycle frame (0 standing).
 */
export function lookOf(w: Walker, step: number, seat: Seat | null, others: Iterable<Walker>, t: number, reduced = false): Look {
  if (reduced) t = 0;
  if (w.role === "chef") return { key: "chef|" + step, sprite: chefSprite(step), lift: 0, flip: w.flip };
  if (w.role === "dog") {
    const lying = w.pose === "lie";
    const wag = !reduced && (lying || step === 0) ? Math.floor(t * 3) % 2 : 0;
    return { key: `dog|${w.name}|${step}|${lying ? 1 : 0}|${wag}`, sprite: dogSprite(w.name, step, lying, wag), lift: 0, flip: w.flip };
  }
  const sitting = w.pose === "sit" && !!seat;
  if (w.role === "kid") {
    const swing = sitting && !reduced ? Math.floor(t * 2.2) % 2 : 0;
    return { key: `kid|${w.name}|${step}|${sitting ? 1 : 0}|${swing}`, sprite: kidSprite(w.name, step, sitting, swing), lift: sitting ? Math.max(0, seat!.height - 2) : 0, flip: sitting ? seat!.face[0] - seat!.face[1] < 0 : w.flip };
  }
  // A friend along for the visit looks like nobody else in the cast.
  const name = w.role === "pal" ? w.name + "&" : w.name;
  if (!sitting) {
    const carry = w.carrying ? CARRY : undefined;
    return { key: `${w.role}|${name}|${w.face}|${step}|${carry ? 1 : 0}`, sprite: guestSprite(name, w.face, step), carry, carryAt: w.flip ? [-9, -12] : [3, -12], lift: 0, flip: w.flip };
  }
  const back = seat!.face[0] < 0 || seat!.face[1] < 0;
  let flip = seat!.face[0] - seat!.face[1] < 0;
  // Turned to whoever shares the table, now and then.
  if (!back && seat!.table && every(t, w.id + "chat", 5, 2.2)) {
    for (const o of others) {
      if (o === w || o.pose !== "sit" || (o.role !== "guest" && o.role !== "pal" && o.role !== "kid")) continue;
      if (Math.hypot(o.x - w.x, o.y - w.y) > 1.4) continue;
      // Screen x runs with x - y.
      flip = o.x - o.y < w.x - w.y;
      break;
    }
  }
  const sip = !back && !reduced && every(t, w.id, 4.5, 0.9);
  const cup = w.carrying || w.role === "guest";
  const lift = Math.max(0, seat!.height - 2);
  return {
    key: `sit|${name}|${w.face}|${back ? 1 : 0}|${flip ? 1 : 0}|${sip ? 1 : 0}|${cup ? 1 : 0}`,
    sprite: sittingSprite(name, w.face, back),
    carry: cup && !back ? CARRY : undefined,
    carryAt: sip ? (flip ? [-4, -18] : [-2, -18]) : flip ? [-8, -9] : [2, -9],
    lift,
    flip,
  };
}

/** Paints a look with its feet at (x, y), lit like everyone else in the room. */
export function paintLook(p: Painter, light: Light, look: Look, x: number, y: number, share = 0.5) {
  const face = Math.round(Math.min(1, light.sun * share * (0.35 + 0.65 * light.elevation)) * 8) / 8;
  const lit = (palette: Record<string, string>) => Object.fromEntries(Object.entries(palette).map(([k, c]) => [k, light.lit(c, face)]));
  const w = look.sprite.grid[0].length;
  const h = look.sprite.grid.length;
  p.alpha(0.3, () => p.oval(INK, x, y, look.sprite.grid[0].length > 12 ? 5 : 4, 1.5));
  p.sprite(look.sprite.grid, lit(look.sprite.palette), x - Math.floor(w / 2), y - look.lift - h + 1, look.flip);
  if (look.carry && look.carryAt) p.sprite(look.carry.grid, lit(look.carry.palette), x + look.carryAt[0], y - look.lift + look.carryAt[1]);
}

/** A dog's lead: from its guest's hand to its collar, both feet points on screen. */
export function leadOf(dog: { x: number; y: number; flip: boolean }, owner: { x: number; y: number; flip: boolean; lift: number }): [number, number, number, number] {
  return [owner.x + (owner.flip ? -5 : 5), owner.y - owner.lift - 9, dog.x + (dog.flip ? -4 : 4), dog.y - 5];
}
