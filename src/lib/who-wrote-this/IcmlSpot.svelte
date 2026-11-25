<script lang="ts">
	// The ICML 2020 result, up front: in the masthead beside the title on a wide screen, under the deck on a phone.
	// The abstract's sentence, then the same reviews as two squares of 100 tiles (1 tile = 1% of the reviews): from the
	// review alone, and given the list of reviewers (a 2K-review subsample; a dashed line marks the most the list
	// allows). The button jumps to the section's wall (#which-human/reviews), where the full result is drawn.
	// Strings and numbers: content.json (the abstract's sentence, levels.items[2]) and rq3.json (`list`, `ui`), built
	// in the private llm-detectors repo by docs/launch_20261116/tools/build_rq3_data.py. Everything is in the
	// prerendered page at its final size, so nothing below it moves when the page wakes.
	import Icon from "./Icon.svelte";
	import C from "./content.json";
	import { list as R, ui } from "./rq3.json";
	import { FABLE, GRAY } from "./palette";

	const U: Record<string, string> = Object.fromEntries(ui.map((u) => [u.id, u.t]));
	const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));
	const pct = (p: number) => fill(U.pct, { pct: Math.round(p) });
	const level = C.levels.items.find((l) => l.target === "which-human")!;
	const says = level.fact;
	// the sentence's own percent, set in clay
	const at = says.indexOf(level.v ?? "");
	const parts = at < 0 ? [{ t: says, hl: false }] : [{ t: says.slice(0, at), hl: false }, { t: level.v!, hl: true }, { t: says.slice(at + level.v!.length), hl: false }];

	// a square of 100 tiles, filled from the bottom row up, left to right
	const S = 10, T = 11, G = 2; // tiles a side, tile and gap (viewBox units)
	const SIDE = S * T + (S - 1) * G;
	const xy = (i: number) => [(i % S) * (T + G), (S - 1 - Math.floor(i / S)) * (T + G)] as const;
	// the level k tiles reach, as a stair line just above them
	function stair(k: number) {
		const full = Math.floor(k / S), rem = k % S, y = (r: number) => SIDE - r * (T + G) + G / 2, x = (c: number) => c * (T + G) - G / 2;
		return rem === 0
			? `M${x(0)} ${y(full)}H${SIDE}`
			: `M${x(0)} ${y(full + 1)}H${x(rem)}V${y(full)}H${SIDE + G / 2}`;
	}
	const squares = [
		{ id: "without", k: Math.round(R.without.pct), num: pct(R.without.pct), t: U["list.without"], sub: "", max: 0 },
		{ id: "with", k: Math.round(R.with.pct), num: pct(R.with.pct), t: U["list.with"], sub: `${U["list.sub"]}; ${fill(U["list.max"], { pct: Math.round(R.max.pct) })}`, max: Math.round(R.max.pct) },
	];
</script>

<aside class="spot" aria-labelledby="spot-says">
	<!-- the venue's mark, then the abstract's sentence (no label above it: the page has no eyebrows) -->
	<p class="sp-says" id="spot-says"><Icon name="icml" class="venue" label={U["title.reviews"]} />{#each parts as p}{#if p.hl}<mark>{p.t}</mark>{:else}{p.t}{/if}{/each}</p>
	<div class="sp-pair">
		{#each squares as q, j}
			<figure class="sp-sq" class:strong={j === 1}>
				<p class="sp-num" style:color={FABLE.ink}>{q.num}</p>
				<svg viewBox="-2 -2 {SIDE + 4} {SIDE + 4}" role="img" aria-label="{q.num}: {q.t}">
					{#each { length: 100 } as _, i}
						{@const [x, y] = xy(i)}
						<rect {x} {y} width={T} height={T} rx="1" fill={i < q.k ? FABLE.strong : GRAY.unlit} style:--i={i} class:lit={i < q.k} />
					{/each}
					{#if q.max}<path d={stair(q.max)} class="max" />{/if}
				</svg>
				<figcaption>
					<span class="sp-t">{q.t}</span>
					{#if q.sub}<span class="sp-sub">{q.sub}</span>{/if}
				</figcaption>
			</figure>
		{/each}
	</div>
	<a class="sp-go" href="#which-human/reviews">{U["spot.go"]}<Icon name="arrow" class="down" /></a>
</aside>

<style>
	/* a card on the ground (prez: #F3F3EF field, no border, no shadow, radius 2 to 3 px) */
	.spot { background: var(--field); border-radius: 3px; padding: 20px 22px 22px; display: grid; gap: 14px; align-content: start; }
	.sp-says { font-size: 16px; line-height: 1.45; font-weight: 500; letter-spacing: -0.005em; color: var(--ink); text-wrap: pretty; }
	.sp-says :global(.ic.venue) { font-size: 17px; margin-right: 7px; vertical-align: -0.17em; }
	.sp-says mark { color: var(--fable); background: none; font-weight: 600; }
	.sp-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
	.sp-sq { margin: 0; display: grid; gap: 6px; align-content: start; }
	.sp-num { font-size: 34px; line-height: 1; font-weight: 600; letter-spacing: -0.03em; font-feature-settings: "tnum"; }
	.sp-sq svg { display: block; width: 100%; height: auto; aspect-ratio: 1; }
	.sp-sq figcaption { display: grid; gap: 1px; }
	.sp-t { font-size: 12.5px; line-height: 1.35; font-weight: 600; color: var(--ink); }
	.sp-sub { font-size: 11.5px; line-height: 1.35; color: var(--ink2); font-feature-settings: "tnum"; }
	.max { fill: none; stroke: var(--ink); stroke-width: 1.4; stroke-dasharray: 3 2.4; }
	/* the jump to the section's wall: the page's own button (transparent, a 1.25 px ink border, inverts on hover) */
	.sp-go { justify-self: start; display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border: 1.25px solid var(--ink); border-radius: 2px; font-size: 13px; font-weight: 500; text-decoration: none; transition: background-color .15s, color .15s; }
	.sp-go:hover { background: var(--ink); color: var(--field); }
	.sp-go :global(.ic.down) { transform: rotate(90deg); }
	/* the lit tiles come in one by one once, from the bottom row up (none under reduced motion) */
	@media (prefers-reduced-motion: no-preference) {
		rect.lit { animation: lit .5s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: calc(400ms + var(--i) * 9ms); }
		.strong rect.lit { animation-delay: calc(700ms + var(--i) * 9ms); }
		@keyframes lit { from { fill: #D3D3CC; } }
	}
	@media (max-width: 1023px) {
		.spot { padding: 18px 18px 20px; }
		.sp-pair { max-width: 420px; }
	}
</style>
