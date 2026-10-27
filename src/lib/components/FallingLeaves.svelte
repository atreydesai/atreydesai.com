<script lang="ts">
  // Autumn leaves drifting down the homepage's right margin and piling up at
  // the bottom of the screen, drawn as a grid of small rounded cells: a leaf's
  // interior is solid squares, its ragged edge is set in characters by how
  // much of each cell it covers, and its stem is a single stroke glyph. Each
  // leaf turns from one autumn colour at the stem toward another at the tip.
  //
  // A falling leaf sways and tumbles (a flip squashes it across its midrib and
  // shows the paler underside). The pointer stirs falling leaves along, and a
  // click in the margin sends a gust out from that point.
  //
  // A leaf knows where it will rest before it gets there. Once it is a couple
  // of lengths above the pile it picks its spot, and from then on it falls
  // just as before, only steering toward that spot as it goes: it stops
  // tumbling, lies down, foreshortens, and crumples (the blade ripples, its
  // far half curls in, a maple's lobes pull together), and it lands exactly
  // there, so baking it into the pile changes nothing on screen. Its spot is
  // where its footprint comes to rest: sliding down slopes, and off any side
  // it overhangs until its centre is over what holds it up.
  //
  // The pile is solved by events, never by a running loop, so a leaf at rest
  // stays exactly where it is. Only when leaves leave it (kicked up by a
  // brisk sweep or a click, or slipping out under the screen once the pile is
  // full) is its footing worked out again, and any leaf that lost its footing
  // falls again, the same way, to its new spot. Baked leaves cost no more to
  // draw than one image each.
  //
  // The canvas lives on <body>, not in the page: page transitions transform
  // the page layer, which would drag a fixed element along mid-route. It sits
  // only in the margin to the right of the content column, never under text,
  // and is hidden where that margin is too narrow to hold a leaf. Reduce
  // Motion leaves one still frame (with a pile). Colors are canvas rendering,
  // so they are hard-coded.
  import { onMount } from "svelte";
  import { dev } from "$app/environment";
  import { arcadeScreen } from "$lib/boba";

  /** Grid cell, in CSS pixels. */
  const CELL = 6;
  /** Content column (page-shell-standard) is 820px wide, centred. */
  const COLUMN_PX = 820;
  /** Below this viewport width the margin can't hold a leaf. */
  const SHOW_QUERY = "(min-width: 1080px)";
  const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
  /** Lowkey: leaves are drawn faint. */
  const ALPHA = { light: 0.5, dark: 0.42 };
  /** Falling leaves per 1000px of margin height. */
  const DENSITY = 7;
  /** Leaves the pile holds per 100px of margin width; past that, a leaf on
   *  the floor slips out under the screen. */
  const PILE_PER_100PX = 4.5;
  /** Share of the screen's height the pile may reach; a leaf that would come
   *  to rest above it takes the lowest spot within reach instead. */
  const PILE_MAX_SHARE = 0.16;
  /** Cells a resting leaf may slide while it finds its footing. */
  const SLIDE_CELLS = 16;
  /** Blade lengths above the pile at which a leaf picks its spot. */
  const AIM_LENGTHS = 2.2;
  /** Px/s: the most a leaf steers (or slides) sideways toward its spot. */
  const STEER_SPEED = 30;
  const GLYPHS = ".:-=+*#%";
  /** Samples per cell side; a cell with every sample inside is a square. */
  const SS = 3;
  /** Px/s: however hard a leaf is pushed, it drifts rather than flies. */
  const MAX_SPEED = 200;
  /** How far a resting leaf sinks into the leaves under it, px. */
  const NESTLE = CELL * 0.7;
  /** Seconds of falling simulated before the first frame, so the pile is
   *  already started on load. */
  const HEAD_START_S = 40;

  // Autumn, weighted toward reds and oranges, with some browns, a few golds,
  // and the odd leaf that hasn't turned yet.
  const PALETTE: [string, number][] = [
    ["#b8322a", 3], // crimson
    ["#d9472b", 3], // scarlet
    ["#d9682a", 3], // burnt orange
    ["#e0812f", 2], // pumpkin
    ["#a4471f", 2], // rust
    ["#7e2a2a", 2], // maroon
    ["#8a3251", 1], // wine
    ["#8a5a33", 2], // brown
    ["#d99a2b", 1], // amber
    ["#e2b33a", 1], // gold
    ["#7d8a3a", 1], // olive
  ];
  const GINKGO = ["#e2b33a", "#d99a2b", "#a9a53c"];
  type Shape = "ovate" | "oak" | "maple" | "ginkgo";
  const SHAPES: [Shape, number][] = [
    ["maple", 3],
    ["ovate", 3],
    ["oak", 3],
    ["ginkgo", 1],
  ];

  interface Pose {
    x: number;
    y: number;
    angle: number;
    flip: number;
    /** 0 is a fresh, flat blade; 1 is fully crumpled. */
    crumple: number;
  }

  /** Each grid column a resting leaf covers, with its top and bottom edge. */
  type Footprint = Map<number, { top: number; bottom: number }>;

  /** A leaf steering toward its resting place: where it started steering
   *  (height and pose), and where it will rest. */
  interface Approach {
    y0: number;
    from: { angle: number; flip: number; crumple: number };
    to: Pose;
    cols: Footprint;
  }

  interface Leaf {
    shape: Shape;
    rgb: [number, number, number];
    /** The colour it turns toward at its tip, and how far. */
    tip: [number, number, number];
    turn: number;
    /** Blade length, px. */
    len: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    fall: number;
    swayAmp: number;
    swayRate: number;
    phase: number;
    tilt: number;
    swing: number;
    spin: number;
    spinVel: number;
    flip: number;
    flipRate: number;
    flipBoost: number;
    crumple: number;
    /** How it will lie: off level by `restTilt`, foreshortened to `flat` of
     *  its width, crumpled to `restCrumple`. */
    restTilt: number;
    flat: number;
    restCrumple: number;
    seed: number;
    approach: Approach | null;
    /** Slipping out under the screen: it falls past the floor and is gone. */
    leaving: boolean;
  }

  /** A leaf in the pile, baked into a sprite at `pose`. */
  interface Rest {
    leaf: Leaf;
    pose: Pose;
    cols: Footprint;
    sprite: HTMLCanvasElement;
    sx: number;
    sy: number;
  }

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
  const weighted = <T,>(xs: readonly [T, number][]) => {
    let r = Math.random() * xs.reduce((a, [, w]) => a + w, 0);
    for (const [x, w] of xs) if ((r -= w) < 0) return x;
    return xs[0][0];
  };
  const hex = (h: string) =>
    [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  /** The angle nearest `angle` at which a leaf lies level. */
  const level = (angle: number) => {
    const off = ((((angle - Math.PI / 2) % Math.PI) + Math.PI * 1.5) % Math.PI) - Math.PI / 2;
    return angle - off;
  };
  const bottomOf = (cols: Footprint) => {
    let b = -Infinity;
    for (const e of cols.values()) b = Math.max(b, e.bottom);
    return b;
  };
  /** A footprint moved by whole cells. */
  const shifted = (cols: Footprint, dc: number, dr: number): Footprint =>
    new Map([...cols].map(([c, e]) => [c + dc, { top: e.top + dr * CELL, bottom: e.bottom + dr * CELL }]));

  /** Is (u, v) inside the blade? u is across the midrib, v runs stem (0) to
   *  tip (1), both in units of the blade length. Crumpling pulls a maple's
   *  lobes in, so a crushed one stops reading as a star. */
  function inside(shape: Shape, u: number, v: number, crumple: number): boolean {
    const au = Math.abs(u);
    switch (shape) {
      case "ovate": {
        if (v <= 0 || v >= 1) return false;
        return au < 0.34 * Math.pow(Math.sin(Math.PI * v), 0.8) * (1 - 0.3 * v);
      }
      case "oak": {
        if (v <= 0.02 || v >= 1) return false;
        const w = 0.34 * Math.pow(Math.sin(Math.PI * v), 0.75) * (1 - 0.2 * v);
        return au < w * (0.74 + 0.26 * Math.cos(v * Math.PI * 9));
      }
      case "maple": {
        const dy = v - 0.5;
        const r = Math.hypot(u, dy);
        const th = Math.atan2(u, dy);
        const lobes = 0.24 * (1 - 0.6 * crumple);
        let f = 0.26 + lobes * Math.pow(Math.abs(Math.cos(2.5 * th)), 1.6);
        // The sinus at the stem.
        f *= 1 - 0.75 * Math.exp(-((Math.abs(th) - Math.PI) ** 2) / 0.12);
        return r < f;
      }
      case "ginkgo": {
        const dy = v - 0.02;
        const r = Math.hypot(u, dy);
        const th = Math.atan2(u, dy);
        if (Math.abs(th) > 0.8) return false;
        // A fan with the notch at the top of its rim.
        const rim = 0.86 * (1 - 0.32 * Math.exp(-(th * th) / 0.012)) - 0.06 * th * th;
        return r < rim && r > 0.02;
      }
    }
  }

  /** Shade at (u, v): darker along the midrib and the side veins. */
  function shade(shape: Shape, u: number, v: number): number {
    const au = Math.abs(u);
    if (shape === "ginkgo") {
      // Fan veins radiate from the stem.
      const th = Math.atan2(u, v);
      return (th * 9 + 20) % 1 < 0.18 ? 0.86 : 1;
    }
    if (au < 0.03) return 0.72;
    if (shape === "maple") {
      const th = Math.atan2(u, v - 0.5);
      return Math.abs(Math.cos(2.5 * th)) > 0.97 ? 0.82 : 1;
    }
    return ((v - 1.5 * au) * 7 + 10) % 1 < 0.16 ? 0.86 : 1;
  }

  // A per-cell grain, so a leaf's squares aren't one flat colour.
  const grain = (i: number, j: number, seed: number) => {
    const h = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453;
    return 0.93 + 0.12 * (h - Math.floor(h));
  };

  /** Rasterize a leaf in a pose onto the screen grid: paint it into `ctx`,
   *  record the columns it covers into `cols`, or both. */
  function raster(leaf: Leaf, pose: Pose, ctx: CanvasRenderingContext2D | null, cols?: Footprint) {
    const cos = Math.cos(pose.angle);
    const sin = Math.sin(pose.angle);
    const face = Math.cos(pose.flip);
    const squash = Math.max(Math.abs(face), 0.12);
    const lift = face < 0 ? 0.3 : 0; // the underside is paler
    const cr = pose.crumple;
    const s = leaf.seed;
    const [r, g, b] = leaf.rgb;
    const [tr, tg, tb] = leaf.tip;
    const L = leaf.len;
    // The blade's centre sits at the pose; v runs along the rotated y axis,
    // from the stem end (v = 0) to the tip (v = 1). Crumpling ripples the
    // blade, roughens its edge, and curls its far half in toward the midrib.
    const local = (sx: number, sy: number) => {
      const dx = sx - pose.x;
      const dy = sy - pose.y;
      const px = (dx * cos + dy * sin) / L;
      const py = (-dx * sin + dy * cos) / L;
      let u = px / squash;
      let v = py + 0.5;
      if (cr > 0) {
        u += cr * 0.05 * Math.sin(v * 11 + s) * Math.sin(u * 9 + s * 1.7);
        v += cr * 0.04 * Math.sin((u + v) * 17 + s * 2.3);
        u *= 1 + cr * (0.5 * Math.max(0, v - 0.45) + 0.12 * Math.sin(v * 23 + u * 31 + s));
      }
      return [u, v] as const;
    };
    // The stem: from a little inside the blade's base (blades taper to
    // nothing there, so it would float free), back along the axis.
    const sx0 = pose.x + 0.42 * L * sin;
    const sy0 = pose.y - 0.42 * L * cos;
    const ex = 0.28 * L * sin;
    const ey = -0.28 * L * cos;
    const stemGlyph =
      Math.abs(sin) < 0.38 * Math.abs(cos)
        ? "|"
        : Math.abs(cos) < 0.38 * Math.abs(sin)
          ? "-"
          : sin * cos < 0
            ? "\\"
            : "/";
    const mark = (i: number, j: number) => {
      const col = cols?.get(i);
      const top = j * CELL;
      if (!col) cols?.set(i, { top, bottom: top + CELL });
      else {
        col.top = Math.min(col.top, top);
        col.bottom = Math.max(col.bottom, top + CELL);
      }
    };

    const reach = L * 0.75;
    const i0 = Math.floor((pose.x - reach) / CELL);
    const i1 = Math.ceil((pose.x + reach) / CELL);
    const j0 = Math.floor((pose.y - reach) / CELL);
    const j1 = Math.ceil((pose.y + reach) / CELL);
    const sq = CELL - 1.4;
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const cx = (i + 0.5) * CELL;
        const cy = (j + 0.5) * CELL;
        let hits = 0;
        for (let a = 0; a < SS; a++) {
          for (let c = 0; c < SS; c++) {
            const [u, v] = local(i * CELL + ((a + 0.5) * CELL) / SS, j * CELL + ((c + 0.5) * CELL) / SS);
            if (inside(leaf.shape, u, v, cr)) hits++;
          }
        }
        if (hits === 0) {
          // Stem cells: within half a cell of the stem's segment.
          const t = Math.max(0, Math.min(1, ((cx - sx0) * ex + (cy - sy0) * ey) / (ex * ex + ey * ey)));
          if (Math.hypot(cx - (sx0 + ex * t), cy - (sy0 + ey * t)) < CELL * 0.5) {
            if (ctx) {
              ctx.fillStyle = `rgb(${r * 0.7},${g * 0.7},${b * 0.7})`;
              ctx.fillText(stemGlyph, cx, cy);
            }
          }
          continue;
        }
        mark(i, j);
        if (!ctx) continue;
        const [u, v] = local(cx, cy);
        // Crumpled leaves are a little drier and darker.
        const k = shade(leaf.shape, u, v) * grain(i, j, s) * (1 - 0.12 * cr);
        // Turning toward the tip colour along the blade.
        const m = Math.max(0, Math.min(1, v)) * leaf.turn;
        const cr0 = r + (tr - r) * m;
        const cg0 = g + (tg - g) * m;
        const cb0 = b + (tb - b) * m;
        const rr = Math.min(255, cr0 * k + (255 - cr0) * lift);
        const gg = Math.min(255, cg0 * k + (255 - cg0) * lift);
        const bb = Math.min(255, cb0 * k + (255 - cb0) * lift);
        ctx.fillStyle = `rgb(${rr},${gg},${bb})`;
        if (hits === SS * SS) {
          ctx.beginPath();
          ctx.roundRect(cx - sq / 2, cy - sq / 2, sq, sq, 1);
          ctx.fill();
        } else {
          ctx.fillText(GLYPHS[Math.min(GLYPHS.length - 1, hits - 1)], cx, cy);
        }
      }
    }
  }

  onMount(() => {
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = [
      // A canvas keeps its intrinsic 300x150 unless sized outright, so the
      // margin's box is given as left/width/height, not as insets.
      "position:fixed",
      "top:0",
      `left:calc(50% + ${COLUMN_PX / 2}px)`,
      `width:calc(50% - ${COLUMN_PX / 2}px)`,
      "height:100%",
      "z-index:var(--layer-base)",
      "pointer-events:none",
      "opacity:0",
      "transition:opacity 0.8s ease",
      // Soften the edge nearest the text, so leaves fade rather than clip.
      "mask-image:linear-gradient(to right,transparent,#000 22%)",
      "-webkit-mask-image:linear-gradient(to right,transparent,#000 22%)",
    ].join(";");
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d")!;

    const show = matchMedia(SHOW_QUERY);
    const reduce = matchMedia(REDUCE_QUERY);
    let width = 0;
    let height = 0;
    let dpr = 1;
    let falling: Leaf[] = [];
    let pile: Rest[] = [];
    /** The pile's surface: the top of the highest resting leaf per column. */
    let surface = new Map<number, number>();
    let target = 0;
    let raf = 0;
    let last = 0;
    let time = 0;
    let arcadeOpen = false;
    let started = false;
    let font = "sans-serif";
    const pointer = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: -1 };

    function makeLeaf(scattered: boolean): Leaf {
      const shape = weighted(SHAPES);
      const len = rand(40, 60) * (shape === "maple" ? 1.1 : 1);
      const base = shape === "ginkgo" ? pick(GINKGO) : weighted(PALETTE);
      return {
        shape,
        rgb: hex(base),
        tip: hex(shape === "ginkgo" ? pick(GINKGO) : weighted(PALETTE)),
        turn: rand(0.2, 0.75),
        len,
        x: rand(width * 0.32, width * 0.86),
        y: scattered ? rand(-len, height * 0.6) : rand(-len * 3, -len),
        vx: 0,
        vy: 0,
        fall: rand(16, 30),
        swayAmp: rand(8, 18),
        swayRate: rand(0.5, 0.9),
        phase: rand(0, Math.PI * 2),
        tilt: rand(-Math.PI, Math.PI),
        swing: rand(0.35, 0.7),
        spin: 0,
        spinVel: 0,
        flip: rand(0, Math.PI * 2),
        flipRate: rand(0.25, 0.7),
        flipBoost: 0,
        crumple: rand(0, 0.25),
        restTilt: rand(-0.35, 0.35),
        flat: rand(0.45, 0.7),
        restCrumple: rand(0.4, 0.85),
        seed: Math.random() * 100,
        approach: null,
        leaving: false,
      };
    }

    const angleOf = (leaf: Leaf) => leaf.tilt + leaf.swing * Math.sin(time * leaf.swayRate + leaf.phase) + leaf.spin;

    /** How far along its approach a leaf is, 0 to 1, by height. */
    const progress = (leaf: Leaf, a: Approach) =>
      a.to.y > a.y0 ? Math.max(0, Math.min(1, (leaf.y - a.y0) / (a.to.y - a.y0))) : 1;

    function poseOf(leaf: Leaf): Pose {
      const a = leaf.approach;
      if (a) {
        // Its tumble dies away into the resting pose as it nears its spot.
        const t = smooth(progress(leaf, a));
        const sway = leaf.swing * (1 - t) * Math.sin(time * leaf.swayRate + leaf.phase);
        return {
          x: leaf.x,
          y: leaf.y,
          angle: a.from.angle + (a.to.angle - a.from.angle) * t + sway,
          flip: a.from.flip + (a.to.flip - a.from.flip) * t,
          crumple: a.from.crumple + (a.to.crumple - a.from.crumple) * t,
        };
      }
      return { x: leaf.x, y: leaf.y, angle: angleOf(leaf), flip: leaf.flip, crumple: leaf.crumple };
    }

    const surfaceAt = (col: number) => surface.get(col) ?? height;

    function rebuildSurface() {
      surface = new Map();
      for (const r of pile) {
        for (const [col, { top }] of r.cols) surface.set(col, Math.min(surfaceAt(col), top));
      }
    }

    /** The pile's surface with the spots that approaching leaves are headed
     *  for already taken, so two leaves don't aim for the same place. */
    function claimed(except: Leaf) {
      const claims = new Map(surface);
      for (const leaf of falling) {
        if (leaf === except || !leaf.approach) continue;
        for (const [c, e] of leaf.approach.cols) claims.set(c, Math.min(claims.get(c) ?? height, e.top));
      }
      return (c: number) => claims.get(c) ?? height;
    }

    /** The highest point of the pile (or the floor) under a falling leaf. */
    function groundUnder(leaf: Leaf) {
      const c0 = Math.floor((leaf.x - leaf.len * 0.35) / CELL);
      const c1 = Math.ceil((leaf.x + leaf.len * 0.35) / CELL);
      let ground = Infinity;
      for (let c = c0; c <= c1; c++) ground = Math.min(ground, surfaceAt(c));
      return ground;
    }

    /** Find where a footprint comes to rest on `under`, starting at its own
     *  position: the whole cells across (k) and down (rows) it moves.
     *  It slides one cell at a time toward any spot within two cells that
     *  is a whole cell lower, and while its centre isn't over the columns
     *  holding it up, it slides off the side it overhangs. It never slides
     *  uphill or out of the margin. */
    function solve(base: Footprint, under: (col: number) => number, x: number, len: number) {
      const lo = width * 0.3;
      const hi = width - len * 0.45;
      const fits = (k: number) => x + k * CELL >= lo && x + k * CELL <= hi;
      const rows = (k: number) => {
        let drop = Infinity;
        for (const [c, e] of base) drop = Math.min(drop, under(c + k) - e.bottom + NESTLE);
        return Math.floor(drop / CELL);
      };
      // The column under its centre of mass.
      let mass = 0;
      let moment = 0;
      for (const [c, e] of base) {
        const cells = (e.bottom - e.top) / CELL;
        mass += cells;
        moment += c * cells;
      }
      const centre = moment / mass;

      let k = 0;
      if (!fits(0)) k = x < lo ? Math.ceil((lo - x) / CELL) : -Math.ceil((x - hi) / CELL);
      let r = rows(k);
      // Ties go with the breeze: downward and to the right.
      let heading = 1;
      for (let step = 0; step < SLIDE_CELLS; step++) {
        let moved = false;
        for (const dir of [heading, -heading]) {
          for (const reach of [1, 2]) {
            if (!fits(k + dir * reach)) break;
            if (rows(k + dir * reach) >= r + 1) {
              k += dir;
              r = rows(k);
              heading = dir;
              moved = true;
              break;
            }
          }
          if (moved) break;
        }
        if (moved) continue;
        let left = Infinity;
        let right = -Infinity;
        for (const [c, e] of base) {
          if (under(c + k) - (e.bottom + r * CELL) + NESTLE < CELL) {
            left = Math.min(left, c);
            right = Math.max(right, c);
          }
        }
        if (centre >= left - 0.5 && centre <= right + 0.5) break;
        const dir = centre < left ? -1 : 1;
        if (!fits(k + dir) || rows(k + dir) < r) break;
        k += dir;
        r = rows(k);
        heading = dir;
      }
      return { k, rows: r };
    }

    /** Where a leaf lying in `pose` comes to rest. Too high a spot gives way
     *  to the lowest spot within reach. */
    function spotFor(leaf: Leaf, pose: Pose, under: (col: number) => number) {
      const base: Footprint = new Map();
      raster(leaf, pose, null, base);
      let { k, rows } = solve(base, under, pose.x, leaf.len);
      let top = Infinity;
      for (const e of base.values()) top = Math.min(top, e.top + rows * CELL);
      if (height - top > height * PILE_MAX_SHARE) {
        let lowest = { k, rows };
        for (let d = -SLIDE_CELLS; d <= SLIDE_CELLS; d++) {
          const x = pose.x + (k + d) * CELL;
          if (x < width * 0.3 || x > width - leaf.len * 0.45) continue;
          let drop = Infinity;
          for (const [c, e] of base) drop = Math.min(drop, under(c + k + d) - e.bottom + NESTLE);
          const r = Math.floor(drop / CELL);
          if (r > lowest.rows) lowest = { k: k + d, rows: r };
        }
        const settled = solve(shifted(base, lowest.k, lowest.rows), under, pose.x + lowest.k * CELL, leaf.len);
        k = lowest.k + settled.k;
        rows = lowest.rows + settled.rows;
      }
      return {
        to: { ...pose, x: pose.x + k * CELL, y: pose.y + rows * CELL },
        cols: shifted(base, k, rows),
      };
    }

    /** Pick the spot a falling leaf is headed for, in the pose it will rest
     *  in: lying down near level, foreshortened, crumpled. Picking again
     *  (when the pile changes under it) starts a new approach from exactly
     *  where it is, and never sends it back up: a spot that is now above it
     *  is kept rather than moved. */
    function aim(leaf: Leaf) {
      const now = poseOf(leaf);
      const pose: Pose = {
        x: leaf.x,
        y: leaf.y,
        angle: level(now.angle) + leaf.restTilt,
        flip: Math.round(now.flip / Math.PI) * Math.PI + Math.sign(Math.sin(now.flip) || 1) * Math.acos(leaf.flat),
        crumple: Math.max(leaf.crumple, leaf.restCrumple),
      };
      const { to, cols } = spotFor(leaf, pose, claimed(leaf));
      if (leaf.approach && to.y < leaf.y + CELL) return;
      // Carry the sway over exactly: what has faded stays faded, and the
      // swing already in the angle isn't counted twice.
      const faded = leaf.approach ? 1 - smooth(progress(leaf, leaf.approach)) : 1;
      leaf.swing *= faded;
      leaf.swayAmp *= faded;
      const swaying = leaf.swing * Math.sin(time * leaf.swayRate + leaf.phase);
      leaf.approach = {
        y0: leaf.y,
        from: { angle: now.angle - swaying, flip: now.flip, crumple: now.crumple },
        to,
        cols,
      };
    }

    /** Stop steering (a gust or the pointer took it): it falls on from
     *  exactly the pose it was in. */
    function release(leaf: Leaf) {
      if (!leaf.approach) return;
      const now = poseOf(leaf);
      Object.assign(leaf, {
        tilt: now.angle,
        swing: rand(0.2, 0.4),
        spin: 0,
        phase: -time * leaf.swayRate,
        flip: now.flip,
        crumple: now.crumple,
        approach: null,
      });
    }

    /** It has reached its spot: bake it there, exactly as it was drawn. */
    function land(leaf: Leaf) {
      const a = leaf.approach!;
      const rest: Rest = { leaf, pose: a.to, cols: a.cols, sprite: document.createElement("canvas"), sx: 0, sy: 0 };
      bake(rest);
      pile.push(rest);
      leaf.approach = null;
      rebuildSurface();
      reaim();
    }

    /** When the pile changes, a leaf on its way down keeps its spot, unless
     *  what was under that spot is gone: then it just falls further,
     *  straight down, never sideways at the last moment. A spot that another
     *  leaf now partly covers is kept too; it rests overlapping a little, as
     *  leaves in a pile do. */
    function reaim() {
      for (const leaf of falling) {
        const a = leaf.approach;
        if (!a) continue;
        const under = claimed(leaf);
        let drop = Infinity;
        for (const [c, e] of a.cols) drop = Math.min(drop, under(c) - e.bottom + NESTLE);
        const rows = Math.floor(drop / CELL);
        if (rows < 1) continue;
        a.to = { ...a.to, y: a.to.y + rows * CELL };
        a.cols = shifted(a.cols, 0, rows);
      }
    }

    /** Bake a resting leaf into its sprite, on the screen grid. */
    function bake(r: Rest) {
      const reach = r.leaf.len * 0.75;
      const i0 = Math.floor((r.pose.x - reach) / CELL);
      const j0 = Math.floor((r.pose.y - reach) / CELL);
      const span = Math.ceil((reach * 2) / CELL) + 2;
      r.sprite.width = Math.ceil(span * CELL * dpr);
      r.sprite.height = Math.ceil(span * CELL * dpr);
      const sctx = r.sprite.getContext("2d")!;
      sctx.setTransform(dpr, 0, 0, dpr, -i0 * CELL * dpr, -j0 * CELL * dpr);
      sctx.font = `${CELL * 1.3}px ${font}`;
      sctx.textAlign = "center";
      sctx.textBaseline = "middle";
      raster(r.leaf, r.pose, sctx);
      r.sx = i0 * CELL;
      r.sy = j0 * CELL;
    }

    /** Lift a resting leaf out of the pile as a falling leaf, in exactly the
     *  pose it rested in, starting from still. */
    function unrest(r: Rest): Leaf {
      const leaf = r.leaf;
      Object.assign(leaf, {
        x: r.pose.x,
        y: r.pose.y,
        vx: 0,
        vy: 0,
        tilt: r.pose.angle,
        swing: 0,
        spin: 0,
        spinVel: 0,
        phase: -time * leaf.swayRate,
        flip: r.pose.flip,
        flipBoost: 0,
        crumple: r.pose.crumple,
        approach: null,
      });
      falling.push(leaf);
      return leaf;
    }

    /** After leaves leave the pile, work its footing out again, lowest
     *  leaves first so each rests on where the ones under it end up. A leaf
     *  that lost its footing falls again, gently, to its new spot. */
    function collapse() {
      const order = [...pile].sort((a, b) => bottomOf(b.cols) - bottomOf(a.cols));
      const floor = new Map<number, number>();
      const under = (c: number) => floor.get(c) ?? height;
      const kept: Rest[] = [];
      for (const r of order) {
        const { k, rows } = solve(r.cols, under, r.pose.x, r.leaf.len);
        let cols = r.cols;
        if (rows > 0 || (k !== 0 && rows >= 0)) {
          cols = shifted(r.cols, k, rows);
          const leaf = unrest(r);
          const to = { ...r.pose, x: r.pose.x + k * CELL, y: r.pose.y + rows * CELL };
          leaf.approach = {
            y0: r.pose.y,
            from: { angle: r.pose.angle, flip: r.pose.flip, crumple: r.pose.crumple },
            to,
            cols,
          };
        } else kept.push(r);
        for (const [c, e] of cols) floor.set(c, Math.min(under(c), e.top));
      }
      pile = pile.filter((r) => kept.includes(r));
      rebuildSurface();
    }

    /** Send a resting leaf back into the air. */
    function launch(r: Rest, vx: number, vy: number) {
      const leaf = unrest(r);
      Object.assign(leaf, { vx, vy, swing: rand(0.35, 0.7), spinVel: rand(-4, 4), flipBoost: 4 });
    }

    function resize() {
      const rect = canvas.getBoundingClientRect();
      const lastWidth = width;
      const grew = height ? rect.height - height : 0;
      width = rect.width;
      height = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      target = Math.max(3, Math.min(9, Math.round((height / 1000) * DENSITY)));
      while (falling.filter((l) => !l.leaving).length < target) falling.push(makeLeaf(true));
      if (lastWidth && Math.abs(width - lastWidth) > 1) {
        // The pile is laid out on the old grid; start a new one.
        pile = [];
        surface = new Map();
        for (const leaf of falling) {
          leaf.approach = null;
          leaf.x = Math.min(leaf.x, width * 0.86);
        }
      } else if (grew) {
        // The pile sits on the bottom edge, so it moves with it, by whole
        // cells; working its footing out again takes up any remainder.
        const rows = Math.round(grew / CELL);
        for (const r of pile) {
          r.pose = { ...r.pose, y: r.pose.y + rows * CELL };
          r.cols = shifted(r.cols, 0, rows);
          r.sy += rows * CELL;
        }
        rebuildSurface();
        collapse();
        reaim();
      }
    }

    function step(dt: number) {
      time += dt;
      const breeze = 6 * Math.sin(time * 0.07);
      const stirring = time - pointer.t < 0.1;
      const pointerSpeed = Math.hypot(pointer.vx, pointer.vy);

      for (const leaf of [...falling]) {
        const a = leaf.approach;
        // Down at its height but not yet over its spot: it slides along the
        // surface the rest of the way, easing in, and rests once it's there.
        if (a && leaf.y >= a.to.y) {
          leaf.y = a.to.y;
          leaf.vy = 0;
          const gap = a.to.x - leaf.x;
          if (Math.abs(gap) > 0.5) {
            const pace = Math.max(8, Math.min(STEER_SPEED, Math.abs(gap) * 3));
            leaf.x += Math.sign(gap) * Math.min(Math.abs(gap), pace * dt);
            continue;
          }
          leaf.x = a.to.x;
          falling.splice(falling.indexOf(leaf), 1);
          land(leaf);
          if (falling.filter((l) => !l.leaving).length < target) falling.push(makeLeaf(false));
          continue;
        }
        const t = a ? smooth(progress(leaf, a)) : 0;
        // The same drift as ever; on approach the sway fades and the drift
        // bends toward the spot, arriving there as the leaf comes down.
        const sway = leaf.swayAmp * (1 - t) * Math.cos(time * leaf.swayRate + leaf.phase);
        const ease = 1 - Math.exp(-1.4 * dt);
        let wantX = breeze + sway;
        if (a) {
          // No faster sideways than a leaf's own drift, so it never swerves;
          // whatever is left when it gets down, it slides.
          const eta = Math.max(0.15, (a.to.y - leaf.y) / Math.max(leaf.vy, 6));
          const steer = Math.max(-STEER_SPEED, Math.min(STEER_SPEED, (a.to.x - leaf.x) / eta));
          wantX += (steer - wantX) * Math.min(1, 0.4 + t);
        }
        leaf.vx += (wantX - leaf.vx) * (a ? 1 - Math.exp(-3 * dt) : ease);
        leaf.vy += (leaf.fall - leaf.vy) * ease;
        leaf.x += leaf.vx * dt;
        leaf.y += leaf.vy * dt;
        if (!a) {
          leaf.spin += leaf.spinVel * dt;
          leaf.spinVel *= Math.exp(-1.6 * dt);
          leaf.flipBoost *= Math.exp(-1.2 * dt);
          leaf.flip += (leaf.flipRate + leaf.flipBoost) * dt;
        }

        // Stirred by a passing pointer, in proportion to how fast it moves.
        const dx = leaf.x - pointer.x;
        const dy = leaf.y - pointer.y;
        const reach = leaf.len * 1.3;
        const d2 = dx * dx + dy * dy;
        if (stirring && d2 < reach * reach && pointerSpeed > 40) {
          release(leaf);
          // The push lasts the 0.1s after each move, so `dt * 6` makes each
          // move worth about a third of the pointer's speed at the centre.
          const fall = (1 - Math.sqrt(d2) / reach) * dt * 6;
          leaf.vx += pointer.vx * 0.35 * fall;
          leaf.vy += pointer.vy * 0.35 * fall;
          // Brushing past one side turns it, like a push off-centre.
          leaf.spinVel += ((pointer.vx * dy - pointer.vy * dx) / (reach * reach)) * 2 * fall;
          leaf.flipBoost += Math.min(6, pointerSpeed / 120) * fall;
        }

        // Soft walls: a pushed leaf drifts back into the margin rather than
        // leaving it, so a gust never empties the margin.
        if (!leaf.approach) {
          const lo = width * 0.32;
          const hi = width * 0.86;
          if (leaf.x < lo) leaf.vx += (lo - leaf.x) * 4 * dt;
          if (leaf.x > hi) leaf.vx -= (leaf.x - hi) * 4 * dt;
        }
        const speed = Math.hypot(leaf.vx, leaf.vy);
        if (speed > MAX_SPEED) {
          leaf.vx *= MAX_SPEED / speed;
          leaf.vy *= MAX_SPEED / speed;
        }

        if (leaf.leaving) {
          if (leaf.y - leaf.len > height) falling.splice(falling.indexOf(leaf), 1);
          continue;
        }
        if (leaf.approach) {
          // Never past its height; the slide (or the landing) is next frame.
          leaf.y = Math.min(leaf.y, leaf.approach.to.y);
        } else if (leaf.vy > 0 && groundUnder(leaf) - (leaf.y + leaf.len * 0.38) < leaf.len * AIM_LENGTHS) {
          aim(leaf);
        } else if (leaf.y < -height || leaf.x < -width || leaf.x > width * 2) {
          Object.assign(leaf, makeLeaf(false));
        }
      }

      // A brisk sweep through the pile kicks the leaves it passes back up.
      if (stirring && pointerSpeed > 350) {
        const kicked = pile.filter((r) => Math.hypot(r.pose.x - pointer.x, r.pose.y - pointer.y) < r.leaf.len * 0.55);
        if (kicked.length) {
          pile = pile.filter((r) => !kicked.includes(r));
          for (const r of kicked) launch(r, pointer.vx * 0.3, Math.min(0, pointer.vy * 0.3) - 70);
          collapse();
          reaim();
        }
      }

      // Past the pile's capacity, a leaf on the floor slips out under the
      // screen, one at a time, falling on as it always has, and the leaves
      // it held up fall into the gap.
      const capacity = Math.round((width / 100) * PILE_PER_100PX);
      if (pile.length > capacity && !falling.some((l) => l.leaving)) {
        const floored = pile.filter((r) => bottomOf(r.cols) >= height - CELL);
        if (floored.length) {
          const out = pick(floored);
          pile = pile.filter((r) => r !== out);
          // It slides out lying as it lay: no tumbling on the way.
          const leaf = unrest(out);
          leaf.leaving = true;
          leaf.flipRate = 0;
          leaf.swayAmp *= 0.4;
          collapse();
          reaim();
        }
      }
    }

    function gust(x: number, y: number) {
      const lifted = pile.filter((r) => Math.hypot(r.pose.x - x, r.pose.y - y) < 80);
      if (lifted.length) {
        pile = pile.filter((r) => !lifted.includes(r));
        for (const r of lifted) {
          const dx = r.pose.x - x;
          const fall = 1 - Math.hypot(dx, r.pose.y - y) / 80;
          launch(r, Math.sign(dx || 1) * rand(30, 90) * fall, -rand(70, 150) * (0.4 + 0.6 * fall));
        }
        collapse();
      }
      for (const leaf of falling) {
        const dx = leaf.x - x;
        const dy = leaf.y - y;
        const d = Math.hypot(dx, dy) || 1;
        const fall = Math.max(0, 1 - d / 200);
        if (!fall) continue;
        release(leaf);
        const push = 190 * fall;
        leaf.vx += (dx / d) * push;
        leaf.vy += (dy / d) * push - 40 * fall;
        leaf.spinVel += (Math.random() < 0.5 ? -1 : 1) * 5 * fall;
        leaf.flipBoost += 9 * fall;
      }
      reaim();
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      const dark = document.documentElement.classList.contains("dark");
      ctx.globalAlpha = dark ? ALPHA.dark : ALPHA.light;
      for (const r of pile) ctx.drawImage(r.sprite, r.sx, r.sy, r.sprite.width / dpr, r.sprite.height / dpr);
      ctx.font = `${CELL * 1.3}px ${font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const leaf of falling) raster(leaf, poseOf(leaf), ctx);
    }

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }

    function stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    }

    // Live: the margin, Reduce Motion, and the arcade overlay can all change
    // while the page is open.
    function sync() {
      const visible = show.matches;
      canvas.style.display = visible ? "block" : "none";
      stop();
      if (!visible || arcadeOpen) return;
      font = getComputedStyle(document.documentElement).getPropertyValue("--font-ui").trim() || font;
      resize();
      if (!started) {
        // Let the pile get going before anyone sees it.
        started = true;
        for (let t = 0; t < HEAD_START_S; t += 1 / 30) step(1 / 30);
      }
      if (reduce.matches) {
        draw();
      } else {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    }

    function onMove(event: PointerEvent) {
      if (reduce.matches || !raf) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const dt = Math.max(0.008, time - pointer.t);
      if (pointer.x > -1e3 && dt < 0.2) {
        pointer.vx = Math.max(-1500, Math.min(1500, (x - pointer.x) / dt));
        pointer.vy = Math.max(-1500, Math.min(1500, (y - pointer.y) / dt));
      } else {
        pointer.vx = pointer.vy = 0;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.t = time;
    }

    function onDown(event: PointerEvent) {
      if (reduce.matches || !raf) return;
      const rect = canvas.getBoundingClientRect();
      // Only a click in the margin itself: never one meant for the page.
      if (event.clientX < rect.left || (event.target as Element)?.closest?.("a, button, input, select, textarea, label")) return;
      gust(event.clientX - rect.left, event.clientY - rect.top);
    }

    const onResize = () => {
      if (show.matches && !arcadeOpen) {
        resize();
        if (!raf) draw();
      }
    };
    const theme = new MutationObserver(() => {
      if (!raf && show.matches) draw();
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const unsubscribe = arcadeScreen.subscribe((screen) => {
      arcadeOpen = screen !== null;
      sync();
    });
    show.addEventListener("change", sync);
    reduce.addEventListener("change", sync);
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    requestAnimationFrame(() => (canvas.style.opacity = "1"));
    // Dev-only handle for QA: the live leaves, the pile, and the canvas.
    if (dev) {
      (window as unknown as { __leaves?: unknown }).__leaves = {
        canvas,
        get falling() {
          return falling;
        },
        get pile() {
          return pile;
        },
        gust,
        poseOf,
        raster,
        /** Fast-forward the simulation by `seconds`. */
        advance(seconds: number) {
          for (let t = 0; t < seconds; t += 1 / 30) step(1 / 30);
          draw();
        },
      };
    }

    return () => {
      stop();
      unsubscribe();
      theme.disconnect();
      show.removeEventListener("change", sync);
      reduce.removeEventListener("change", sync);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      // Fade out with the page rather than vanishing.
      canvas.style.transition = "opacity 0.18s ease";
      canvas.style.opacity = "0";
      setTimeout(() => canvas.remove(), 200);
    };
  });
</script>
