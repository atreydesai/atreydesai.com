<script lang="ts" module>
	export type Tag = {
		id: string;
		x: number; // viewport px of the point the tag names
		y: number;
		t: string;
		color?: string; // swatch colour (omit for no swatch)
		swatch?: "dot" | "square" | "ring" | "hollow" | "line" | "dash"; // mark style the swatch shows (default square; hollow = outlined square)
		icon?: string; // Icon name before the words (e.g. a lab logo, bulb, pen)
		sub?: string; // a second, smaller line (a number, a count)
		at?: "above" | "below" | "left" | "right" | "center"; // where the tag sits relative to the point
		strong?: boolean; // the key item: larger, ink text
		alpha?: number;
	};
</script>

<script lang="ts">
	// Labels that sit on the picture itself, so nobody has to look to the side panel and back to learn what a colour
	// or a group means. Each tag is HTML (crisp, selectable, paper text) placed at viewport coordinates the section's
	// layout computes for its marks; a swatch can show the colour and mark style it names. Marker and words never
	// wrap apart. Use inside a section while it owns the canvas:
	//   <Tags items={[{ id: "fable", x, y, t: "Claude Fable 5.2", color: MODEL["Claude Fable 5.2"], at: "right" }]} />
	import Icon from "./Icon.svelte";


	// follow: no easing on position, so tags stay glued to something that moves with the page (a pinned card)
	// Performance: a tag is placed by a transform on its wrapper (not left/top), so moving it, and easing it to a new
	// place, needs no layout: the easing runs on the compositor. The wrapper sits at the point; the tag inside it keeps
	// its own offset from the point (its at-* side), so the words land exactly where left/top put them.
	let { items, follow = false }: { items: Tag[]; follow?: boolean } = $props();
</script>

<div class="tags" class:follow aria-hidden="true">
	{#each items as tg (tg.id)}
		<span class="pos" style:transform="translate({tg.x}px, {tg.y}px)">
			<span class="tag at-{tg.at ?? 'right'}" class:strong={tg.strong} style:opacity={tg.alpha ?? 1} style:--c={tg.color ?? "var(--ink)"}>
				<span class="line">
					{#if tg.color}<i class="sw sw-{tg.swatch ?? 'square'}"></i>{/if}
					{#if tg.icon}<Icon name={tg.icon} />{/if}
					<span class="t">{tg.t}</span>
				</span>
				{#if tg.sub}<span class="sub">{tg.sub}</span>{/if}
			</span>
		</span>
	{/each}
</div>

<style>
	.tags { position: fixed; inset: 0; pointer-events: none; z-index: 3; }
	.pos { position: fixed; left: 0; top: 0; transition: transform .35s var(--ease, ease); }
	/* One label style for every chart (style guide, launch page labels): plain words in ink on a squared backing in the
	   ground's own colour, so on the dotted ground a label reads as text and on tiles or prints it still masks them. No
	   shadow (the guide keeps shadows for tooltips) and no light card, which read as buttons. A colour key is the same
	   label with its swatch. The padding and sizes are the ones the sections' layout maths assumes (TAG_H, tagW). */
	.tag { position: relative; display: grid; gap: 1px; padding: 3px 8px; border-radius: 2px; background: rgba(232, 232, 227, .92); font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; transition: opacity .3s; }
	.tag.strong { font-size: 14px; padding: 5px 10px; }
	.line { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
	.line :global(svg) { width: 1em; height: 1em; color: var(--c); }
	.sub { font-size: 11.5px; font-weight: 500; color: var(--ink2); font-variant-numeric: tabular-nums; }
	.sw { flex: none; display: inline-block; width: 10px; height: 10px; background: var(--c); border-radius: 1px; }
	/* sw-* names: the site's Tailwind utilities (.ring, …) would otherwise style these */
	.sw-dot { border-radius: 50%; }
	.sw-ring { border-radius: 50%; background: transparent; border: 2px solid var(--c); }
	.sw-hollow { background: transparent; border: 1.5px solid var(--c); }
	.sw-line { width: 16px; height: 2.5px; border-radius: 1px; }
	.sw-dash { width: 16px; height: 2.5px; border: 0; background: repeating-linear-gradient(90deg, var(--c) 0 5px, transparent 5px 8px); }
	/* beside the point: the words (not the backing, which no longer shows on the ground) start 10 px from it, so a
	   label set at a mark's edge lines up with the mark */
	.at-right { transform: translate(2px, -50%); }
	.at-left { transform: translate(calc(-100% - 2px), -50%); }
	.at-above { transform: translate(-50%, calc(-100% - 8px)); }
	.at-below { transform: translate(-50%, 8px); }
	.at-center { transform: translate(-50%, -50%); }
	.follow .pos { transition: none; }
	@media (prefers-reduced-motion: reduce) { .tag, .pos { transition: none; } }
</style>
