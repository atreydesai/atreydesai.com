<script lang="ts">
	// A minimal rail on the side: a faint chevron up, one small dot per section (the current one a short bar), a faint
	// chevron down. Up and down skip a whole section, past a pinned animation if the reader wants to; a dot jumps there.
	// The section's name shows on hover or focus. [ and ] also skip back and forward. Updates on scroll, never per frame.
	import { onMount } from "svelte";

	type Stop = { id: string; label: string };
	let { stops }: { stops: Stop[] } = $props();

	let current = $state(-1); // -1: above the first stop
	const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
	const tops = () => stops.map((s) => { const e = document.getElementById(s.id); return e ? e.getBoundingClientRect().top + scrollY : Infinity; });

	function go(i: number) {
		if (i < 0) { scrollTo({ top: 0, behavior: reduce() ? "instant" : "smooth" }); return; }
		const t = tops()[Math.min(i, stops.length - 1)];
		if (Number.isFinite(t)) scrollTo({ top: t - 8, behavior: reduce() ? "instant" : "smooth" });
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
	<button type="button" class="sn-chev" onclick={() => step(-1)} disabled={current < 0} aria-label="Previous section" title="Previous section  [">
		<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 7.5 6 4l3.5 3.5" /></svg>
	</button>
	{#each stops as s, i}
		<button type="button" class="sn-dot" class:on={current === i} onclick={() => go(i)} aria-label={s.label} aria-current={current === i ? "location" : undefined}>
			<i></i><span>{s.label}</span>
		</button>
	{/each}
	<button type="button" class="sn-chev" onclick={() => step(1)} disabled={current >= stops.length - 1} aria-label="Next section" title="Next section  ]">
		<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
	</button>
</nav>

<style>
	.sn { position: fixed; right: 10px; top: 50%; transform: translateY(-50%); z-index: 15; display: grid; justify-items: center; gap: 2px; opacity: .55; transition: opacity .2s; }
	.sn:hover, .sn:focus-within { opacity: 1; }
	.sn button { display: grid; place-items: center; width: 22px; height: 18px; color: #14202D; }
	.sn-chev svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
	.sn-chev:disabled { opacity: .25; cursor: default; }
	.sn-dot { position: relative; height: 14px; }
	.sn-dot i { width: 4px; height: 4px; border-radius: 2px; background: #5A6270; opacity: .5; transition: height .2s, opacity .2s; }
	.sn-dot:hover i { opacity: 1; }
	.sn-dot.on i { height: 12px; opacity: 1; background: #14202D; }
	.sn-dot span { position: absolute; right: calc(100% + 6px); top: 50%; transform: translateY(-50%); padding: 2px 7px; border-radius: 2px; background: #14202D; color: #fff; font-size: 12px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .12s; }
	.sn-dot:hover span, .sn-dot:focus-visible span { opacity: 1; }
	@media (max-width: 860px) {
		.sn { top: auto; bottom: 10px; transform: none; }
		.sn-dot { display: none; }
	}
	@media (prefers-reduced-motion: reduce) { .sn, .sn-dot i, .sn-dot span { transition: none; } }
</style>
