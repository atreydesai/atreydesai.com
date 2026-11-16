<script lang="ts">
	// Section navigation in the top bar, centred between the name and the site links: an up arrow, the sections by
	// short name (the current one in ink), a down arrow. Up and down skip a whole section; a name jumps there.
	// [ and ] also skip. Narrow screens show the arrows and the current section's name only. Updates on scroll.
	import { onMount } from "svelte";

	type Stop = { id: string; short: string; label: string };
	let { stops }: { stops: Stop[] } = $props();

	let current = $state(-1);
	const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
	const tops = () => stops.map((s) => { const e = document.getElementById(s.id); return e ? e.getBoundingClientRect().top + scrollY : Infinity; });
	function go(i: number) {
		if (i < 0) { scrollTo({ top: 0, behavior: reduce() ? "instant" : "smooth" }); return; }
		const t = tops()[Math.min(i, stops.length - 1)];
		if (Number.isFinite(t)) scrollTo({ top: t - 4, behavior: reduce() ? "instant" : "smooth" });
	}
	const step = (d: number) => go(Math.max(-1, Math.min(stops.length - 1, current + d)));

	onMount(() => {
		const update = () => {
			const ts = tops(), y = scrollY + innerHeight * 0.4;
			let c = -1;
			for (let i = 0; i < ts.length; i++) if (ts[i] <= y) c = i;
			if (c !== current) current = c;
		};
		const onKey = (e: KeyboardEvent) => {
			const t = e.target as HTMLElement;
			if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable]")) return;
			if (e.key === "]") { e.preventDefault(); step(1); }
			if (e.key === "[") { e.preventDefault(); step(-1); }
		};
		update();
		addEventListener("scroll", update, { passive: true });
		addEventListener("resize", update, { passive: true });
		addEventListener("keydown", onKey);
		return () => { removeEventListener("scroll", update); removeEventListener("resize", update); removeEventListener("keydown", onKey); };
	});
</script>

<nav class="sn" aria-label="Sections">
	<button type="button" class="chev" onclick={() => step(-1)} disabled={current < 0} aria-label="Previous section" title="Previous section  [">
		<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 7.5 6 4l3.5 3.5" /></svg>
	</button>
	<ol>
		{#each stops as s, i}
			<li><button type="button" class:on={current === i} onclick={() => go(i)} aria-current={current === i ? "location" : undefined} title={s.label}>{s.short}</button></li>
		{/each}
	</ol>
	<span class="cur" aria-hidden="true">{current >= 0 ? stops[current].short : stops[0].short}</span>
	<button type="button" class="chev" onclick={() => step(1)} disabled={current >= stops.length - 1} aria-label="Next section" title="Next section  ]">
		<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
	</button>
</nav>

<style>
	.sn { display: flex; align-items: center; gap: 4px; min-width: 0; }
	ol { list-style: none; margin: 0; padding: 0; display: flex; gap: 2px; }
	ol button { padding: 4px 8px; border-radius: 3px; font-size: 13px; color: #5A6270; white-space: nowrap; transition: color .15s, background-color .15s; }
	ol button:hover { color: #14202D; }
	ol button.on { color: #14202D; font-weight: 600; }
	.chev { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 3px; color: #14202D; }
	.chev:hover:not(:disabled) { background: rgba(20, 32, 45, .07); }
	.chev:disabled { opacity: .25; cursor: default; }
	.chev svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
	.cur { display: none; font-size: 13px; font-weight: 600; color: #14202D; white-space: nowrap; }
	@media (max-width: 980px) {
		ol { display: none; }
		.cur { display: inline; }
	}
	@media (prefers-reduced-motion: reduce) { ol button { transition: none; } }
</style>
