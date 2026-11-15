// Order up's guests, drawn on the bench across the counter from the player:
// each walks in from the door on the right, stops at their spot, and holds up
// their ticket, which the component sends up to the rail; their face follows
// their patience while they wait and their drink when they leave; and the
// tips they leave fly into the jar at the counter's left end. The counter's
// edge hides them from the waist down, and everything on the counter (the
// cup, the jars, the tip jar) stands in front of them.
//
// The component owns the rules (who is waiting, how patient, what they were
// served) and tells the crowd; the crowd only moves and draws, and calls back
// when a ticket is held out, a coin lands, or the jar fills. It runs on the
// game's clock, so it freezes with a pause. Under Reduce Motion nobody walks:
// guests appear in place, their faces still change, and they stand a moment
// before they go.

import { SPRITE_PAD, addParticle, cachedSprite, drawParticles, stepParticles, type Particle } from "./art";
import { JAR_SIZE, waitingMood } from "./orders-engine.js";
import type { Reaction, WaitMood } from "./orders-engine.js";
import { COIN, EMOTES, FIGURE_ABOVE, FIGURE_W, JAR, JAR_H, JAR_W, TAKEAWAY, dropFor, figure } from "./orders-guests.js";
import type { Face } from "./orders-guests.js";

type Emote = keyof typeof EMOTES;

interface Walker {
  id: number;
  name: string;
  x: number;
  target: number;
  /** Walking up; holding the ticket out; waiting; leaving. */
  state: "in" | "handing" | "wait" | "out";
  /** Crowd time the state began. */
  since: number;
  /** Distance walked, which steps the bob. */
  stride: number;
  /** How they left, or a passing reaction (cheering a perfect drink). */
  reaction: Reaction | null;
  reactUntil: number;
  /** A served guest carries their drink off. */
  carrying: boolean;
  mood: WaitMood;
  /** When the clock bubble last showed. */
  clockAt: number;
  nextBlink: number;
  puffAt: number;
}

interface Coin {
  x0: number;
  y0: number;
  delay: number;
  age: number;
}

interface Note {
  x: number;
  y: number;
  text: string;
  life: number;
  maxLife: number;
}

export interface CrowdHooks {
  /** A guest holds their ticket out at (x, y) on the bench; call `hung` once it is on the rail. */
  hand(id: number, x: number, y: number): void;
  /** A coin landed in the jar; `count` is how many it now holds. */
  coin(count: number): void;
  /** The jar filled and emptied. */
  full(): void;
}

export interface CrowdState {
  walkers: Walker[];
  coins: Coin[];
  particles: Particle[];
  notes: Note[];
  jar: number;
  jarFlash: number;
  clock: number;
}

/** A served or departing guest stands this long with their face before walking. */
const LINGER = 0.55;
const LINGER_CROSS = 0.3;
const LINGER_STILL = 0.95;
/** A passing reaction (a cheer) lasts this long. */
const REACT_SECONDS = 1.1;
const COIN_FLIGHT = 0.45;
const COIN_GAP = 0.08;
const JAR_FLASH = 0.5;
const CLOCK_EVERY = 4.5;
const CLOCK_SHOWS = 1.3;
const HALO = "rgba(253, 248, 243, 0.85)";
const NOTE_INK = "#1a1a1a";
const NOTE_GOLD = "#ffd166";

const REACTION_EMOTES: Partial<Record<Reaction, Emote>> = {
  starry: "star",
  wow: "heart",
  content: "heart",
  unimpressed: "drop",
  storm: "anger",
  sentBack: "anger",
};

export class Crowd {
  walkers: Walker[] = [];
  coins: Coin[] = [];
  particles: Particle[] = [];
  notes: Note[] = [];
  /** Coins showing in the jar (it catches up with the game's count as they land). */
  jar = 0;
  jarFlash = 10;
  clock = 0;
  reduceMotion = false;

  width = 0;
  height = 0;
  /** Pixels per sprite cell. */
  fp = 4;
  /** The counter's top edge, in px: guests are cut off here, the jar stands on it. */
  base = 0;
  /** Where each guest stands, in px, left to right. */
  slots: number[] = [];
  /** The tip jar's left edge. */
  jarX = 0;
  /** Set by a new layout: whoever waits steps straight to their new spot on the next sync. */
  private snap = false;

  constructor(private hooks: CrowdHooks) {}

  layout(width: number, height: number, fp: number, base: number, slots: number[], jarX: number) {
    this.width = width;
    this.height = height;
    this.fp = fp;
    this.base = base;
    this.slots = slots;
    this.jarX = jarX;
    this.snap = true;
  }

  /** The door: just past the right edge. */
  private get door() {
    return this.width + (FIGURE_W / 2) * this.fp;
  }

  private find(id: number) {
    return this.walkers.find((walker) => walker.id === id);
  }

  /** A guest comes in for spot `slot`. Under Reduce Motion they are simply there, ticket out. */
  arrive(id: number, name: string, slot: number) {
    const target = this.slots[slot] ?? this.width / 2;
    const still = this.reduceMotion;
    const walker: Walker = {
      id,
      name,
      x: still ? target : this.door,
      target,
      state: still ? "handing" : "in",
      since: this.clock,
      stride: 0,
      reaction: null,
      reactUntil: 0,
      carrying: false,
      mood: "calm",
      clockAt: -99,
      nextBlink: this.clock + 1.5 + Math.random() * 2,
      puffAt: 0,
    };
    this.walkers.push(walker);
    if (still) this.handOut(walker);
  }

  private handOut(walker: Walker) {
    const hand = this.ticketAt(walker);
    this.hooks.hand(walker.id, hand.x, hand.y);
  }

  /** The ticket is on the rail (or the player took it straight from their hand). */
  hung(id: number) {
    const walker = this.find(id);
    if (!walker || walker.state === "out" || walker.state === "wait") return;
    walker.state = "wait";
    walker.since = this.clock;
  }

  /** Who is waiting, in ticket order, and how patient: moves each to their spot and sets their mood. */
  sync(list: Array<{ id: number; share: number }>) {
    list.forEach((guest, slot) => {
      const walker = this.find(guest.id);
      if (!walker || walker.state === "out") return;
      walker.target = this.slots[slot] ?? walker.target;
      if ((this.reduceMotion || this.snap) && walker.state !== "in") walker.x = walker.target;
      const mood = waitingMood(guest.share);
      if (mood !== walker.mood) {
        // The first glance at the clock gets the bubble straight away.
        if (mood === "glance") walker.clockAt = this.clock;
        walker.mood = mood;
      }
    });
    this.snap = false;
  }

  /** A guest leaves: served (with their drink and `coins` for the jar), sent back, or storming out. */
  leave(id: number, reaction: Reaction, coins = 0) {
    const walker = this.find(id);
    if (!walker) return;
    walker.state = "out";
    walker.since = this.clock;
    walker.reaction = reaction;
    walker.carrying = reaction !== "storm" && reaction !== "sentBack";
    if (reaction === "starry" && !this.reduceMotion) this.sparkle(walker, 10);
    const hand = this.ticketAt(walker);
    for (let index = 0; index < coins; index++) {
      if (this.reduceMotion) this.land();
      else this.coins.push({ x0: hand.x, y0: hand.y, delay: 0.2 + index * COIN_GAP, age: 0 });
    }
  }

  /** Where a guest stands now, or null if they aren't here. */
  xOf(id: number) {
    return this.find(id)?.x ?? null;
  }

  /** A passing reaction while they wait, such as cheering someone's perfect drink. */
  react(id: number, reaction: Reaction) {
    const walker = this.find(id);
    if (!walker || walker.state === "out") return;
    walker.reaction = reaction;
    walker.reactUntil = this.clock + REACT_SECONDS;
  }

  /** A short line over the jar, such as what it paid out. */
  note(text: string) {
    const x = this.jarX + (JAR_W / 2) * this.fp;
    this.notes.push({ x, y: this.base - (JAR_H + 2) * this.fp, text, life: 1.6, maxLife: 1.6 });
  }

  snapshot(): CrowdState {
    return {
      walkers: this.walkers,
      coins: this.coins,
      particles: this.particles,
      notes: this.notes,
      jar: this.jar,
      jarFlash: this.jarFlash,
      clock: this.clock,
    };
  }

  restore(state: CrowdState) {
    this.walkers = state.walkers;
    this.coins = state.coins;
    this.particles = state.particles;
    this.notes = state.notes;
    this.jar = state.jar;
    this.jarFlash = state.jarFlash;
    this.clock = state.clock;
  }

  reset(jar = 0) {
    this.walkers = [];
    this.coins = [];
    this.particles = [];
    this.notes = [];
    this.jar = jar;
    this.jarFlash = 10;
  }

  // --- Stepping -----------------------------------------------------------------

  step(dt: number) {
    this.clock += dt;
    this.jarFlash += dt;
    const fp = this.fp;
    for (let index = this.walkers.length - 1; index >= 0; index--) {
      const walker = this.walkers[index];
      const age = this.clock - walker.since;
      if (walker.state === "out") {
        const fast = walker.reaction === "storm" || walker.reaction === "sentBack";
        if (this.reduceMotion) {
          if (age >= LINGER_STILL) this.walkers.splice(index, 1);
          continue;
        }
        if (age >= (fast ? LINGER_CROSS : LINGER)) {
          const speed = (fast ? 1.5 : 0.95) * Math.max(320, this.width);
          walker.x += speed * dt;
          walker.stride += speed * dt;
          if (fast && this.clock >= walker.puffAt) {
            walker.puffAt = this.clock + 0.09;
            addParticle(this.particles, walker.x + (Math.random() - 0.5) * 6 * fp, this.top(walker) + 2 * fp, "#f3ece4", 30, -90);
          }
        }
        if (walker.x > this.door + FIGURE_W * fp) this.walkers.splice(index, 1);
        continue;
      }
      // Walking to their spot (in, or shuffling along when someone ahead leaves).
      const dx = walker.target - walker.x;
      if (Math.abs(dx) > 0.5) {
        const speed = Math.min(1100, Math.max(140, Math.abs(dx) * 5));
        const move = Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
        walker.x += move;
        walker.stride += Math.abs(move);
      } else {
        walker.x = walker.target;
      }
      if (walker.state === "in" && Math.abs(walker.target - walker.x) < 2) {
        walker.state = "handing";
        walker.since = this.clock;
        this.handOut(walker);
      }
      if (walker.reaction && this.clock >= walker.reactUntil) walker.reaction = null;
      if (!this.reduceMotion && this.clock >= walker.nextBlink + 0.14) {
        walker.nextBlink = this.clock + 2.2 + Math.random() * 2.6;
      }
      if (walker.mood === "glance" && this.clock - walker.clockAt > CLOCK_EVERY) walker.clockAt = this.clock;
    }

    for (let index = this.coins.length - 1; index >= 0; index--) {
      const coin = this.coins[index];
      coin.age += dt;
      if (coin.age >= coin.delay + COIN_FLIGHT) {
        this.coins.splice(index, 1);
        this.land();
      }
    }
    stepParticles(this.particles, dt);
    for (let index = this.notes.length - 1; index >= 0; index--) {
      const note = this.notes[index];
      note.life -= dt;
      note.y -= 10 * dt;
      if (note.life <= 0) this.notes.splice(index, 1);
    }
  }

  /** A coin lands in the jar; a full jar pays out and empties. */
  private land() {
    this.jar += 1;
    this.hooks.coin(this.jar);
    if (this.jar < JAR_SIZE) return;
    this.jar = 0;
    this.jarFlash = 0;
    if (!this.reduceMotion) {
      const x = this.jarX + (JAR_W / 2) * this.fp;
      const y = this.base - JAR_H * this.fp;
      for (let index = 0; index < 14; index++) addParticle(this.particles, x, y, "#f4c542", 120, 420);
    }
    this.hooks.full();
  }

  private sparkle(walker: Walker, count: number) {
    const head = this.top(walker);
    for (let index = 0; index < count; index++) {
      addParticle(this.particles, walker.x + (Math.random() - 0.5) * 10 * this.fp, head + 3 * this.fp, "#f4c542", 80, 160);
    }
  }

  // --- Drawing ------------------------------------------------------------------

  /** The figure's top edge, in px: FIGURE_ABOVE rows stand above the counter. */
  private top(walker: Walker) {
    return this.base - (FIGURE_ABOVE - dropFor(walker.name)) * this.fp;
  }

  /** Where a guest holds their ticket (and their tip): up by their right shoulder. */
  private ticketAt(walker: Walker) {
    return { x: walker.x + 5 * this.fp, y: this.top(walker) + 6 * this.fp };
  }

  private face(walker: Walker): Face {
    if (walker.reaction) return walker.reaction;
    if (walker.mood === "cross") return "cross";
    if (walker.mood === "glance") {
      // Eyes on the clock, then down at a watch, and back.
      return Math.floor((this.clock + walker.id * 0.37) / 1.1) % 2 ? "glanceAlt" : "glance";
    }
    if (!this.reduceMotion && this.clock >= walker.nextBlink && this.clock < walker.nextBlink + 0.14) return "blink";
    return "calm";
  }

  private emote(walker: Walker): Emote | null {
    if (walker.state === "out") return walker.reaction ? (REACTION_EMOTES[walker.reaction] ?? null) : null;
    if (walker.state !== "wait") return null;
    if (walker.reaction) return REACTION_EMOTES[walker.reaction] ?? null;
    if (walker.mood === "cross") {
      // The temper flickers, except under Reduce Motion, where it simply shows.
      return this.reduceMotion || Math.floor(this.clock * 3) % 3 ? "anger" : null;
    }
    if (walker.mood === "glance" && this.clock - walker.clockAt < CLOCK_SHOWS) return "clock";
    return null;
  }

  /** The guests, behind everything on the counter and cut off at its edge. */
  drawBack(g: CanvasRenderingContext2D) {
    if (!this.width || !this.walkers.length) return;
    g.save();
    g.beginPath();
    g.rect(0, 0, this.width, this.base);
    g.clip();
    // Those leaving walk behind everyone still waiting.
    const order = [...this.walkers].sort((a, b) => Number(b.state === "out") - Number(a.state === "out"));
    for (const walker of order) this.drawWalker(g, walker);
    g.restore();
  }

  /** The tip jar, coins in the air, the guests' emotes, and any note: in front of the bench. */
  drawFront(g: CanvasRenderingContext2D, font: string) {
    if (!this.width) return;
    const fp = this.fp;
    this.drawJar(g);
    for (const coin of this.coins) this.drawCoin(g, coin);
    for (const walker of this.walkers) {
      const emote = this.emote(walker);
      if (!emote) continue;
      const art = EMOTES[emote];
      const sprite = cachedSprite(`orders-emote-${emote}`, art.grid, fp, art.palette);
      const ex = Math.round(walker.x + (FIGURE_W / 2 - 1) * fp);
      const ey = Math.round(this.top(walker) - (emote === "clock" ? 3 : 1) * fp);
      g.drawImage(sprite, ex - SPRITE_PAD, Math.max(0, ey) - SPRITE_PAD);
    }
    drawParticles(g, this.particles);
    if (this.notes.length) {
      g.save();
      g.font = font;
      g.textAlign = "center";
      g.textBaseline = "middle";
      for (const note of this.notes) {
        const width = Math.ceil((g.measureText(note.text).width + 12) / 4) * 4;
        const x = Math.round(Math.max(width / 2 + 2, Math.min(this.width - width / 2, note.x)));
        const y = Math.round(Math.max(10, note.y));
        g.globalAlpha = Math.max(0, Math.min(1, (note.life / note.maxLife) * 2));
        g.fillStyle = NOTE_INK;
        g.fillRect(Math.round(x - width / 2), y - 10, width, 20);
        g.fillStyle = NOTE_GOLD;
        g.fillText(note.text, x, y + 0.5);
      }
      g.restore();
    }
  }

  private drawWalker(g: CanvasRenderingContext2D, walker: Walker) {
    const fp = this.fp;
    const face = this.face(walker);
    const { grid, palette } = figure(walker.name, face);
    const sprite = cachedSprite(`orders-guest-${walker.name}-${face}`, grid, fp, palette);
    const age = this.clock - walker.since;
    const leaving = walker.state === "out" && age > LINGER_CROSS;
    const moving = !this.reduceMotion && (walker.state === "in" || leaving || Math.abs(walker.target - walker.x) > 0.5);
    // A step bob while walking; a little hop for a perfect drink.
    let bob = moving && Math.floor(walker.stride / (2.5 * fp)) % 2 ? -fp : 0;
    if (!this.reduceMotion && walker.state === "out" && walker.reaction === "starry" && age < 0.4) {
      bob = -Math.round(Math.sin((age / 0.4) * Math.PI) * 2) * fp;
    }
    const left = Math.round(walker.x - (FIGURE_W / 2) * fp);
    const top = this.top(walker) + bob;
    g.drawImage(sprite, left - SPRITE_PAD, top - SPRITE_PAD);

    if (walker.state === "handing") {
      // An arm up by the shoulder, holding the ticket out.
      const ax = Math.round(walker.x + 4 * fp);
      g.fillStyle = "#2b2320";
      g.fillRect(ax - 1, top + 7 * fp - 1, 2 * fp + 2, 7 * fp + 2);
      g.fillStyle = palette.C;
      g.fillRect(ax, top + 9 * fp, 2 * fp, 5 * fp);
      g.fillStyle = palette.S;
      g.fillRect(ax, top + 7 * fp, 2 * fp, 2 * fp);
    }
    if (walker.carrying) {
      const cup = cachedSprite("orders-takeaway", TAKEAWAY.grid, fp, TAKEAWAY.palette, HALO);
      g.drawImage(cup, Math.round(walker.x + 1 * fp) - SPRITE_PAD, top + 11 * fp - SPRITE_PAD);
    }
  }

  private drawJar(g: CanvasRenderingContext2D) {
    const fp = this.fp;
    const left = Math.round(this.jarX);
    const top = Math.round(this.base - JAR_H * fp);
    const { inside } = JAR;
    // The glass, the coins inside it, then the outline over both.
    g.fillStyle = "rgba(214, 236, 242, 0.85)";
    g.fillRect(left + inside.left * fp, top + 2 * fp, inside.width * fp, (JAR_H - 3) * fp);
    const filled = Math.round((this.jar / JAR_SIZE) * inside.rows);
    for (let row = 0; row < filled; row++) {
      const y = top + (inside.top + inside.rows - 1 - row) * fp;
      g.fillStyle = row % 2 ? "#e0b13e" : "#f4c542";
      g.fillRect(left + inside.left * fp, y, inside.width * fp, fp);
      g.fillStyle = "#fbe08a";
      g.fillRect(left + (inside.left + (row % 3) * 2 + 1) * fp, y, fp, fp);
    }
    const jar = cachedSprite("orders-jar", JAR.grid, fp, JAR.palette, HALO);
    g.drawImage(jar, left - SPRITE_PAD, top - SPRITE_PAD);
    if (this.jarFlash < JAR_FLASH && !this.reduceMotion) {
      // A glint across the glass as it pays out.
      g.save();
      g.globalAlpha = 1 - this.jarFlash / JAR_FLASH;
      g.fillStyle = "#ffffff";
      g.fillRect(left + 2 * fp, top + 3 * fp, fp, (JAR_H - 5) * fp);
      g.fillRect(left + 4 * fp, top + 4 * fp, fp, 2 * fp);
      g.restore();
    }
  }

  private drawCoin(g: CanvasRenderingContext2D, coin: Coin) {
    if (coin.age < coin.delay) return;
    const u = Math.min(1, (coin.age - coin.delay) / COIN_FLIGHT);
    const fp = this.fp;
    const x1 = this.jarX + (JAR_W / 2 - 2) * fp;
    const y1 = this.base - (JAR_H - 1) * fp;
    const peak = Math.min(coin.y0, y1) - 8 * fp;
    const x = coin.x0 + (x1 - coin.x0) * u;
    const y = (1 - u) * (1 - u) * coin.y0 + 2 * (1 - u) * u * peak + u * u * y1;
    const sprite = cachedSprite("orders-coin", COIN.grid, fp, COIN.palette, HALO);
    g.drawImage(sprite, Math.round(x) - SPRITE_PAD, Math.round(y) - SPRITE_PAD);
  }
}
