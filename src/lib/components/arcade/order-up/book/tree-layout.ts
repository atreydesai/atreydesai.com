/**
 * Lays an upgrade tree out like a survival game's tech tree: each root heads
 * its own columns, a node sits one row below the deepest thing it needs, a
 * parent stands over the middle of its children, and lines run at right
 * angles through a bus between rows. A node that needs several things hangs
 * under the deepest of them and draws a quieter line to each other one; a
 * need already implied by another (the bench, under a part made at it) gets
 * no line of its own. Positions depend only on
 * the tree, never on what the player owns, so buying never moves a tile.
 */
export interface TreeNode {
  id: string;
  requires: readonly string[];
}

export interface Placed {
  id: string;
  col: number;
  row: number;
}

/** One connector, as a polyline in grid units: column centres, a tile's foot and the top of its cell. */
export interface Wire {
  from: string;
  to: string;
  /** False for a second prerequisite, drawn quieter. */
  primary: boolean;
  points: [number, number][];
}

export interface TreeLayout {
  placed: Map<string, Placed>;
  cols: number;
  rows: number;
  wires: Wire[];
}

/**
 * `tile` is the share of a row the tile itself fills, from its top; the rest
 * is the gap the wires' bus runs through.
 */
export function layoutTree(nodes: readonly TreeNode[], tile = 0.72): TreeLayout {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const known = (id: string) => byId.has(id);
  // Row: the longest chain of requirements above a node.
  const row = new Map<string, number>();
  const depth = (id: string, seen: Set<string>): number => {
    const done = row.get(id);
    if (done !== undefined) return done;
    if (seen.has(id)) throw new Error("The upgrade tree has a cycle at " + id);
    seen.add(id);
    const needs = byId.get(id)!.requires.filter(known);
    const r = needs.length ? Math.max(...needs.map((p) => depth(p, seen))) + 1 : 0;
    seen.delete(id);
    row.set(id, r);
    return r;
  };
  for (const n of nodes) depth(n.id, new Set());

  // What each node needs, through any chain, to drop needs another one already implies.
  const above = new Map<string, Set<string>>();
  const ancestors = (id: string): Set<string> => {
    const done = above.get(id);
    if (done) return done;
    const all = new Set<string>();
    for (const p of byId.get(id)!.requires.filter(known)) {
      all.add(p);
      for (const a of ancestors(p)) all.add(a);
    }
    above.set(id, all);
    return all;
  };
  const direct = new Map<string, string[]>();
  for (const n of nodes) {
    const needs = n.requires.filter(known);
    const kept = needs.filter((p) => !needs.some((q) => q !== p && ancestors(q).has(p)));
    // The deepest need first: the node hangs under it.
    kept.sort((a, b) => row.get(b)! - row.get(a)! || needs.indexOf(a) - needs.indexOf(b));
    direct.set(n.id, kept);
  }

  // The tree that sets columns: each node hangs under its first prerequisite.
  const children = new Map<string, string[]>();
  const roots: string[] = [];
  for (const n of nodes) {
    const parent = direct.get(n.id)![0];
    if (parent) children.set(parent, [...(children.get(parent) ?? []), n.id]);
    else roots.push(n.id);
  }

  const col = new Map<string, number>();
  let next = 0;
  const place = (id: string) => {
    const kids = children.get(id) ?? [];
    if (!kids.length) {
      col.set(id, next++);
      return;
    }
    for (const k of kids) place(k);
    const cs = kids.map((k) => col.get(k)!).sort((a, b) => a - b);
    // Over the middle child, so a single child hangs straight down.
    col.set(id, cs[Math.floor((cs.length - 1) / 2)]);
  };
  for (const r of roots) {
    place(r);
  }

  const placed = new Map<string, Placed>();
  for (const n of nodes) placed.set(n.id, { id: n.id, col: col.get(n.id)!, row: row.get(n.id)! });

  const wires: Wire[] = [];
  for (const n of nodes) {
    const to = placed.get(n.id)!;
    direct.get(n.id)!.forEach((p, i) => {
      const from = placed.get(p)!;
      const x0 = from.col + 0.5,
        x1 = to.col + 0.5;
      // The bus runs through the gap just above the child's row, so a child several rows down drops straight to it.
      // A second need runs on its own lower line, so it never merges into the first's.
      const foot = from.row + tile,
        bus = to.row - (1 - tile) * (i === 0 ? 0.55 : 0.22);
      wires.push({
        from: p,
        to: n.id,
        primary: i === 0,
        points: x0 === x1 ? [[x0, foot], [x1, to.row]] : [[x0, foot], [x0, bus], [x1, bus], [x1, to.row]],
      });
    });
  }
  return {
    placed,
    cols: Math.max(1, next),
    rows: Math.max(1, ...[...row.values()].map((r) => r + 1)),
    wires,
  };
}
