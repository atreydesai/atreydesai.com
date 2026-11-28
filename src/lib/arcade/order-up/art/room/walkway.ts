/**
 * Open floor, for finding a way to a seat: where someone can walk in a room
 * with its counters and furniture where they are, and a path between two
 * points across it. The guests' line in and out is drawn by hand per venue;
 * this finds the rest (pickup to a seat, a seat back out, a dog to its spot).
 *
 * A point is open when it is clear of the room's walls (all but the
 * doorway), not behind the back walls, out of every counter and everything
 * that stands, and, for a venue served through a hatch, off its body.
 */
import type { PropSpec, Venue } from "./types.ts";

type Point = [number, number];
type Layout = Record<string, readonly [number, number] | number[]>;
interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  key: string;
}

export interface Walkway {
  v: Venue;
  /** Whether p is open; `allow` lists furniture someone may step into (the chair they sit on). */
  open(p: readonly number[], allow?: ReadonlySet<string>, wall?: number): boolean;
  /** A way from a to b over open floor, a first and b last, or null when there is none. */
  path(a: Point, b: Point, allow?: ReadonlySet<string>): Point[] | null;
  /** Whether the straight walk from a to b stays open. */
  clear(a: readonly number[], b: readonly number[], allow?: ReadonlySet<string>): boolean;
}

const STEP = 0.25;

export function walkway(v: Venue, layout: Layout, extra: readonly PropSpec[] = []): Walkway {
  const d = v.doorway;
  // The four edges, less the doorway: [ax, ay, bx, by].
  const walls: number[][] = [];
  const edge = (wall: string, a: Point, b: Point, len: number, alongX: boolean) => {
    const spans = d && d.wall === wall ? [[0, d.from], [d.to, len]] : [[0, len]];
    for (const [s0, s1] of spans) if (s1 - s0 > 1e-6) walls.push(alongX ? [s0, a[1], s1, b[1]] : [a[0], s0, b[0], s1]);
  };
  edge("right", [0, 0], [v.cols, 0], v.cols, true);
  edge("left", [0, 0], [0, v.rows], v.rows, false);
  edge("front-right", [v.cols, 0], [v.cols, v.rows], v.rows, false);
  edge("front-left", [0, v.rows], [v.cols, v.rows], v.cols, true);
  const boxes: Box[] = [];
  for (const at of Object.values(layout)) boxes.push({ x0: at[0] - 0.04, y0: at[1] - 0.04, x1: at[0] + 1.04, y1: at[1] + 1.04, key: "counter" });
  for (const p of [...v.props, ...(v.outside.props ?? []), ...extra]) {
    if (p.flat) continue;
    const w = p.w ?? 1;
    const dd = p.d ?? 1;
    // Thin pieces of the low front walls are walls; the doorway's gap is already left out of those.
    if ((w <= 0.3 && Math.abs(p.x + w - v.cols) < 0.05) || (dd <= 0.3 && Math.abs(p.y + dd - v.rows) < 0.05)) continue;
    boxes.push({ x0: p.x - 0.05, y0: p.y - 0.05, x1: p.x + w + 0.05, y1: p.y + dd + 0.05, key: p.key });
  }

  function open(p: readonly number[], allow?: ReadonlySet<string>, wall = 0.3) {
    const [x, y] = p;
    // Never behind the back walls, where the walls would be drawn under them.
    if ((x < 0.05 && y < v.rows + 0.6) || (y < 0.05 && x < v.cols + 0.6)) return false;
    if (v.doorway === null && x > -wall && y > -wall && x < v.cols + wall && y < v.rows + wall) return false;
    for (const [ax, ay, bx, by] of walls) {
      const dx = bx - ax,
        dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(x - ax - dx * t, y - ay - dy * t) < wall) return false;
    }
    for (const b of boxes) if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1 && !allow?.has(b.key)) return false;
    return true;
  }

  function clear(a: readonly number[], b: readonly number[], allow?: ReadonlySet<string>) {
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.05));
    for (let i = 0; i <= n; i++) if (!open([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n], allow)) return false;
    return true;
  }

  // The cells, once: open with nothing allowed; a search with something allowed checks those cells again.
  const x0 = -5,
    y0 = -5;
  const nx = Math.ceil((v.cols + 11) / STEP),
    ny = Math.ceil((v.rows + 11) / STEP);
  const base = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) base[j * nx + i] = open([x0 + (i + 0.5) * STEP, y0 + (j + 0.5) * STEP]) ? 1 : 0;
  const centre = (k: number): Point => [x0 + ((k % nx) + 0.5) * STEP, y0 + (Math.floor(k / nx) + 0.5) * STEP];

  function path(a: Point, b: Point, allow?: ReadonlySet<string>): Point[] | null {
    if (clear(a, b, allow)) return [a, b];
    const cellOpen = (k: number) => base[k] === 1 || (!!allow?.size && open(centre(k), allow));
    // Start and end on the nearest cells one can step to in a straight line.
    const near = (p: Point) => {
      const ci = Math.floor((p[0] - x0) / STEP),
        cj = Math.floor((p[1] - y0) / STEP);
      let best = -1,
        bd = Infinity;
      for (let j = cj - 3; j <= cj + 3; j++)
        for (let i = ci - 3; i <= ci + 3; i++) {
          if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
          const k = j * nx + i;
          const c = centre(k);
          const dist = Math.hypot(c[0] - p[0], c[1] - p[1]);
          if (dist < bd && cellOpen(k) && clear(p, c, allow)) {
            bd = dist;
            best = k;
          }
        }
      return best;
    };
    const s = near(a),
      e = near(b);
    if (s < 0 || e < 0) return null;
    // A* over the cells, eight ways.
    const g = new Float64Array(nx * ny).fill(Infinity);
    const from = new Int32Array(nx * ny).fill(-1);
    const done = new Uint8Array(nx * ny);
    const heap: [number, number][] = [];
    const push = (k: number, f: number) => {
      heap.push([f, k]);
      let i = heap.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (heap[parent][0] <= heap[i][0]) break;
        [heap[parent], heap[i]] = [heap[i], heap[parent]];
        i = parent;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1,
            r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top[1];
    };
    const ex = e % nx,
      ey = Math.floor(e / nx);
    const h = (k: number) => {
      const dx = Math.abs((k % nx) - ex),
        dy = Math.abs(Math.floor(k / nx) - ey);
      return Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
    };
    g[s] = 0;
    push(s, h(s));
    while (heap.length) {
      const k = pop();
      if (done[k]) continue;
      done[k] = 1;
      if (k === e) break;
      const i = k % nx,
        j = Math.floor(k / nx);
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = i + di,
            nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          const n = nj * nx + ni;
          if (done[n] || !cellOpen(n)) continue;
          // No cutting a corner between two closed cells.
          if (di && dj && (!cellOpen(j * nx + ni) || !cellOpen(nj * nx + i))) continue;
          const cost = g[k] + (di && dj ? 1.414 : 1);
          if (cost < g[n]) {
            g[n] = cost;
            from[n] = k;
            push(n, cost + h(n));
          }
        }
    }
    if (!done[e]) return null;
    const cells: Point[] = [];
    for (let k = e; k >= 0; k = from[k]) cells.unshift(centre(k));
    const raw: Point[] = [a, ...cells, b];
    // Pull the string: from each point, on to the furthest one in plain sight.
    const out: Point[] = [a];
    let i = 0;
    while (i < raw.length - 1) {
      let j = raw.length - 1;
      while (j > i + 1 && !clear(raw[i], raw[j], allow)) j--;
      out.push(raw[j]);
      i = j;
    }
    return out;
  }

  return { v, open, path, clear };
}
