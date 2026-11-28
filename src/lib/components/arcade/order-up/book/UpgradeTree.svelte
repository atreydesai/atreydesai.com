<script lang="ts" module>
  import type { ArtRef } from "#lib/arcade/order-up/content/schema.ts";
  import type { Sprite } from "#lib/arcade/order-up/art/icons.ts";

  /** One node as the tree shows it; the page that owns the rules says what each is and what it costs. */
  export interface TreeItem {
    id: string;
    requires: readonly string[];
    name: string;
    /** owned; open (can be had now); locked (needs something first); shut (a rival branch was chosen). */
    state: "owned" | "open" | "locked" | "shut";
    /** A drawn sign for the node; else a machine at a tier; else `art`. */
    sprite?: Sprite | null;
    machine?: string;
    tier?: number;
    art?: ArtRef;
    /** What it does better, and what it gives up, each a short line. */
    gains?: readonly string[];
    costs?: readonly string[];
    /** The key's label, e.g. "Build it, $45.00", shown whenever the node can be acted on. */
    action?: string;
    /** False keeps the key but disables it (short of cash, say). */
    ready?: boolean;
    /** How many are held, for parts made again and again. */
    count?: number;
    /** The one in use, of rivals that can all be owned. */
    fitted?: boolean;
    /** Why it can't be had yet, e.g. "Needs a copper coil." */
    reason?: string;
  }
</script>

<script lang="ts">
  // An upgrade tree drawn like a survival game's tech tree: a column for each
  // root, a row for each step deeper, right-angled wires between, and the
  // path you own lit. Picking a tile writes it up in the panel beside the
  // tree, whose keys stay put. Positions come from the tree's shape alone, so
  // buying never moves a tile (`tree-layout.ts`).
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import Icon from "../Icon.svelte";
  import Machine from "../Machine.svelte";
  import { layoutTree } from "./tree-layout.ts";

  let {
    items,
    picked = $bindable(""),
    act,
    label = "Upgrades",
  }: { items: readonly TreeItem[]; picked?: string; act: (id: string) => void; label?: string } = $props();

  const TILE = 0.72;
  // The layout depends only on ids and what each needs, not on what is owned.
  const shape = $derived(JSON.stringify(items.map((i) => [i.id, i.requires])));
  const layout = $derived.by(() => {
    void shape;
    return layoutTree(items, TILE);
  });
  const byId = $derived(new Map(items.map((i) => [i.id, i])));

  // Tiles bought, made or fitted while the tree is open flash once; ones owned before don't.
  let before = new Map<string, string>();
  let fresh = $state<string[]>([]);
  $effect(() => {
    const now = new Map(items.map((i) => [i.id, i.state + ":" + (i.count ?? 0) + ":" + (i.fitted ? 1 : 0)]));
    const changed = before.size ? [...now].filter(([id, v]) => before.get(id) !== v && v.startsWith("owned")).map(([id]) => id) : [];
    before = now;
    if (changed.length) {
      fresh = [];
      queueMicrotask(() => (fresh = changed));
    }
  });
  const current = $derived(byId.get(picked) ?? items.find((i) => i.state === "open") ?? items[0]);
  const STATE: Record<TreeItem["state"], string> = { owned: "owned", open: "can be had", locked: "locked", shut: "closed by another branch" };

  function move(event: KeyboardEvent, it: TreeItem) {
    const here = layout.placed.get(it.id)!;
    const step: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = step[event.key];
    if (!d) return;
    event.preventDefault();
    // The nearest tile that way: along the axis first, then the smallest sideways drift.
    const best = [...layout.placed.values()]
      .filter((p) => (d[0] ? Math.sign(p.col - here.col) === d[0] : Math.sign(p.row - here.row) === d[1]))
      .sort((a, b) => {
        const da = d[0] ? [Math.abs(a.col - here.col), Math.abs(a.row - here.row)] : [Math.abs(a.row - here.row), Math.abs(a.col - here.col)];
        const db = d[0] ? [Math.abs(b.col - here.col), Math.abs(b.row - here.row)] : [Math.abs(b.row - here.row), Math.abs(b.col - here.col)];
        return da[0] - db[0] || da[1] - db[1];
      })[0];
    if (!best) return;
    picked = best.id;
    (event.currentTarget as HTMLElement).parentElement?.querySelector<HTMLElement>(`[data-node="${best.id}"]`)?.focus();
  }
</script>

<div class="upgrade-tree">
  <div class="tree-scroll">
    <div class="tree" role="group" aria-label={label} style:--cols={layout.cols} style:--rows={layout.rows}>
      <svg class="wires" viewBox="0 0 {layout.cols} {layout.rows}" preserveAspectRatio="none" aria-hidden="true">
        {#each layout.wires as w (w.from + ">" + w.to)}
          <polyline
            points={w.points.map(([x, y]) => x + "," + y).join(" ")}
            class:quiet={!w.primary}
            class:lit={byId.get(w.from)?.state === "owned" && byId.get(w.to)?.state === "owned"}
            vector-effect="non-scaling-stroke"
          />
        {/each}
      </svg>
      {#each items as it (it.id)}
        {@const p = layout.placed.get(it.id)!}
        <button
          type="button"
          class="node is-{it.state}"
          class:is-fitted={it.fitted}
          class:ou-gain={fresh.includes(it.id)}
          data-node={it.id}
          style:--c={p.col}
          style:--r={p.row}
          aria-pressed={current?.id === it.id}
          aria-label={it.name + ", " + STATE[it.state]}
          title={it.name}
          onclick={() => (picked = it.id)}
          onkeydown={(e) => move(e, it)}
        >
          <span class="pic">
            {#if it.sprite}<PixelIcon grid={[...it.sprite.grid]} palette={it.sprite.palette} px={2} />{:else if it.machine}<Machine
                id={it.machine}
                tier={it.tier ?? 1}
                size={44}
              />{:else}<Icon art={it.art} size={34} />{/if}
          </span>
          {#if it.count}<span class="count">{it.count}</span>{/if}
          {#if it.state === "locked"}
            <svg class="mark lock" viewBox="0 0 7 8" aria-hidden="true" shape-rendering="crispEdges"
              ><path d="M2 0h3v1h1v3h1v4H0V4h1V1h1zm0 1v3h3V1z" /></svg
            >
          {:else if it.state === "owned"}
            <svg class="mark tick" viewBox="0 0 7 6" aria-hidden="true" shape-rendering="crispEdges"
              ><path d="M6 0h1v2H6v1H5v1H4v1H3v1H2V5H1V4H0V2h1v1h1v1h1V3h1V2h1V1h1z" /></svg
            >
          {/if}
        </button>
      {/each}
    </div>
  </div>

  {#if current}
    <aside class="node-panel" aria-live="polite">
      <span class="big">
        {#if current.sprite}<PixelIcon grid={[...current.sprite.grid]} palette={current.sprite.palette} px={4} />{:else if current.machine}<Machine
            id={current.machine}
            tier={current.tier ?? 1}
            size={72}
          />{:else}<Icon art={current.art} size={56} />{/if}
      </span>
      <h3>{current.name}</h3>
      <ul class="lines">
        {#each current.gains ?? [] as g (g)}<li class="gain"><b aria-hidden="true">+</b>{g}</li>{/each}
        {#each current.costs ?? [] as c (c)}<li class="cost"><b aria-hidden="true">−</b>{c}</li>{/each}
      </ul>
      <div class="foot">
        {#if current.reason}<p class="why">{current.reason}</p>{/if}
        {#if current.action}
          <button type="button" class="boba-key is-primary" disabled={current.ready === false} onclick={() => act(current.id)}
            >{current.action}</button
          >
        {/if}
      </div>
    </aside>
  {/if}
</div>

<style>
  .upgrade-tree {
    --cw: 76px;
    --rh: 88px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 15rem;
    gap: 16px;
    align-items: start;
    min-height: 0;
  }

  .tree-scroll {
    min-width: 0;
    max-height: 100%;
    padding: 6px 4px 10px;
    overflow: auto;
  }

  .tree {
    position: relative;
    width: calc(var(--cols) * var(--cw));
    height: calc(var(--rows) * var(--rh));
  }

  .wires {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }

  .wires polyline {
    fill: none;
    stroke: var(--lg-line, #4a3c3b);
    stroke-width: 3;
    stroke-linejoin: miter;
  }

  .wires polyline.quiet {
    stroke-dasharray: 4 4;
  }

  .wires polyline.lit {
    stroke: #9aa86a;
  }

  .node {
    position: absolute;
    left: calc(var(--c) * var(--cw) + (var(--cw) - 60px) / 2);
    top: calc(var(--r) * var(--rh));
    display: grid;
    place-items: center;
    width: 60px;
    height: calc(var(--rh) * 0.72);
    padding: 0;
    border: 0;
    color: var(--lg-text, #e9dccb);
    background: var(--lg-chip, #2f2627);
    box-shadow: inset 0 0 0 2px var(--lg-line, #4a3c3b);
    clip-path: var(--notch);
    cursor: pointer;
  }

  .node .pic {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    overflow: hidden;
  }

  .node.is-locked .pic,
  .node.is-shut .pic {
    opacity: 0.38;
    filter: grayscale(0.7);
  }

  .node.is-shut::after {
    content: "";
    position: absolute;
    inset: 10px;
    background: linear-gradient(to top right, transparent calc(50% - 1.5px), #8a7a72 calc(50% - 1.5px) calc(50% + 1.5px), transparent calc(50% + 1.5px));
  }

  .node.is-owned {
    box-shadow: inset 0 0 0 2px #9aa86a;
  }

  /* The kit in use: the page's main thing, in orange. */
  .node.is-fitted {
    box-shadow: inset 0 0 0 3px var(--lg-orange, #c9462f);
  }

  .count {
    position: absolute;
    top: 4px;
    right: 6px;
    color: var(--lg-cream, #f6e6c2);
    font: 700 12px/1 var(--font-display);
  }

  .node[aria-pressed="true"] .count {
    color: #3a2c28;
  }

  .node[aria-pressed="true"] {
    background: var(--lg-cream, #f6e6c2);
    box-shadow: inset 0 0 0 2px var(--lg-cream, #f6e6c2);
  }

  .node:focus-visible {
    outline: 2px solid var(--lg-orange-hi, #e0703f);
    outline-offset: 2px;
  }

  .mark {
    position: absolute;
    right: 6px;
    bottom: 6px;
    width: 12px;
    height: 13px;
    fill: var(--lg-muted, #a8968a);
  }

  .mark.tick {
    width: 13px;
    height: 11px;
    fill: #9aa86a;
  }

  .node[aria-pressed="true"] .mark {
    fill: #5a4a44;
  }

  .node-panel {
    position: sticky;
    top: 0;
    display: grid;
    grid-template-rows: auto auto 1fr auto auto;
    gap: 8px;
    min-height: 19rem;
    padding: 14px;
    background: var(--lg-chip, #2f2627);
    clip-path: var(--notch);
  }

  .big {
    display: grid;
    place-items: center;
    height: 84px;
    overflow: hidden;
  }

  .node-panel h3 {
    margin: 0;
    color: var(--lg-cream, #f6e6c2);
    font: 700 17px/1.2 var(--font-display);
  }

  .lines {
    display: grid;
    align-content: start;
    gap: 4px;
    margin: 0;
    padding: 0;
    font-size: 13px;
    line-height: 1.35;
    list-style: none;
  }

  .lines li {
    display: grid;
    grid-template-columns: 14px 1fr;
  }

  .gain {
    color: #c7d39a;
  }

  .cost {
    color: #e8a487;
  }

  .why {
    margin: 0;
    color: var(--lg-muted, #a8968a);
    font-size: 12px;
  }

  .foot {
    display: grid;
    gap: 6px;
    min-height: 44px;
    align-content: end;
  }

  .foot .boba-key {
    min-height: 44px;
  }
</style>
