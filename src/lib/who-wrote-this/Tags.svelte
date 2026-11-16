<script lang="ts" module>
	export type Tag = {
		id: string;
		x: number; // viewport px of the point the tag names
		y: number;
		t: string;
		color?: string; // swatch colour (omit for no swatch)
		swatch?: "dot" | "square" | "ring" | "line" | "dash"; // mark style the swatch shows (default square)
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


	let { items }: { items: Tag[] } = $props();
</script>

<div class="tags" aria-hidden="true">
	{#each items as tg (tg.id)}
		<span class="tag at-{tg.at ?? 'right'}" class:strong={tg.strong} style:left="{tg.x}px" style:top="{tg.y}px" style:opacity={tg.alpha ?? 1} style:--c={tg.color ?? "var(--ink)"}>
			<span class="line">
				{#if tg.color}<i class="sw {tg.swatch ?? 'square'}"></i>{/if}
				{#if tg.icon}<Icon name={tg.icon} />{/if}
				<span class="t">{tg.t}</span>
			</span>
			{#if tg.sub}<span class="sub">{tg.sub}</span>{/if}
		</span>
	{/each}
</div>

<style>
	.tags { position: fixed; inset: 0; pointer-events: none; z-index: 3; }
	.tag { position: fixed; display: grid; gap: 1px; padding: 3px 8px; border-radius: 3px; background: rgba(243, 243, 239, .94); box-shadow: 0 2px 10px rgba(20, 32, 45, .08); font-size: 12.5px; font-weight: 600; color: var(--ink); white-space: nowrap; transition: opacity .3s, left .35s var(--ease, ease), top .35s var(--ease, ease); }
	.tag.strong { font-size: 14px; padding: 5px 10px; }
	.line { display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
	.line :global(svg) { width: 1em; height: 1em; color: var(--c); }
	.sub { font-size: 11.5px; font-weight: 500; color: var(--ink2); font-variant-numeric: tabular-nums; }
	.sw { flex: none; display: inline-block; width: 10px; height: 10px; background: var(--c); border-radius: 1px; }
	.sw.dot { border-radius: 50%; }
	.sw.ring { border-radius: 50%; background: transparent; border: 2px solid var(--c); }
	.sw.line { width: 16px; height: 2.5px; border-radius: 1px; }
	.sw.dash { width: 16px; height: 0; background: none; border-top: 2.5px dashed var(--c); }
	.at-right { transform: translate(10px, -50%); }
	.at-left { transform: translate(calc(-100% - 10px), -50%); }
	.at-above { transform: translate(-50%, calc(-100% - 8px)); }
	.at-below { transform: translate(-50%, 8px); }
	.at-center { transform: translate(-50%, -50%); }
	@media (prefers-reduced-motion: reduce) { .tag { transition: none; } }
</style>
