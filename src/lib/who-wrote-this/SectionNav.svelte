<script lang="ts">
	// Section navigation that lives in two places. At the top of the page it sits in the header, between the name and
	// the site links: the sections by short name, with up and down arrows. Once the reader scrolls past the header, the
	// names fly to a quiet rail on the left and shrink into dots (FLIP: each rail item starts where its name was);
	// scrolling back up sends them home the same way. Up and down skip a whole section; a name or dot jumps there;
	// [ and ] also skip. Updates on scroll and on the header leaving view, never per frame.
	import { onMount, tick } from "svelte";

	type Stop = { id: string; short: string; label: string };
	let { stops }: { stops: Stop[] } = $props();

	let current = $state(-1);
	let within = $state(0); // how far through the current section, 0 to 1 (its rail bar fills with it)
	let rail = $state(false); // the header has scrolled away: show the left rail
	let home: HTMLElement;
	const inlineEls: HTMLElement[] = $state([]);
	const railEls: HTMLElement[] = $state([]);
	const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
	const tops = () => stops.map((s) => { const e = document.getElementById(s.id); return e ? e.getBoundingClientRect().top + scrollY : Infinity; });
	function go(i: number) {
		// jumps are instant: a smooth scroll played every section's animations on the way, a speed run (Marzena, 16 Nov)
		if (i < 0) { scrollTo({ top: 0, behavior: "instant" }); return; }
		const t = tops()[Math.min(i, stops.length - 1)];
		if (Number.isFinite(t)) scrollTo({ top: t - 4, behavior: "instant" });
	}
	const step = (d: number) => go(Math.max(-1, Math.min(stops.length - 1, current + d)));

	// fly each item from where it was (in the other layout) to where it is now
	async function fly(toRail: boolean) {
		const from = (toRail ? inlineEls : railEls).map((e) => e?.getBoundingClientRect());
		await tick();
		if (reduce()) return;
		const to = toRail ? railEls : inlineEls;
		to.forEach((el, i) => {
			const a = from[i];
			if (!el || !a) return;
			const b = el.getBoundingClientRect();
			const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
			el.animate([{ transform: `translate(${dx}px, ${dy}px)`, opacity: 0.4 }, { transform: "none", opacity: 1 }], { duration: 520, delay: i * 26, easing: "cubic-bezier(.2,.7,.2,1)", fill: "backwards" });
			const label = el.querySelector(".fly");
			label?.animate(toRail ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: i * 26, fill: "backwards" });
		});
	}

	onMount(() => {
		const update = () => {
			const ts = tops(), y = scrollY + innerHeight * 0.4;
			let c = -1;
			for (let i = 0; i < ts.length; i++) if (ts[i] <= y) c = i;
			if (c !== current) current = c;
			if (c >= 0) {
				const end = c + 1 < ts.length ? ts[c + 1] : (document.querySelector(".finale")?.getBoundingClientRect().top ?? innerHeight) + scrollY;
				const w = Math.max(0, Math.min(1, (y - ts[c]) / Math.max(1, end - ts[c])));
				if (Math.abs(w - within) > 0.005) within = w;
			}
		};
		const io = new IntersectionObserver(([e]) => {
			const next = !e.isIntersecting && e.boundingClientRect.top < 0;
			if (next !== rail) { rail = next; fly(next); }
		});
		io.observe(home);
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
		return () => { io.disconnect(); removeEventListener("scroll", update); removeEventListener("resize", update); removeEventListener("keydown", onKey); };
	});
</script>

<!-- in the header -->
<nav class="sn" class:away={rail} bind:this={home} aria-label="Sections" aria-hidden={rail}>
	<button type="button" class="chev" onclick={() => step(-1)} disabled={current < 0} aria-label="Previous section" tabindex={rail ? -1 : 0}>
		<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 7.5 6 4l3.5 3.5" /></svg>
	</button>
	<ol>
		{#each stops as s, i}
			<li><button type="button" bind:this={inlineEls[i]} class:on={current === i} onclick={() => go(i)} aria-current={current === i ? "location" : undefined} title={s.label} tabindex={rail ? -1 : 0}>{s.short}</button></li>
		{/each}
	</ol>
	<button type="button" class="chev" onclick={() => step(1)} disabled={current >= stops.length - 1} aria-label="Next section" tabindex={rail ? -1 : 0}>
		<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
	</button>
</nav>

<!-- the rail, on the left, once the header has gone -->
<nav class="rail" class:on={rail} aria-label="Sections" aria-hidden={!rail}>
	<button type="button" class="chev" onclick={() => step(-1)} disabled={current < 0} aria-label="Previous section" title="Previous section  [" tabindex={rail ? 0 : -1}>
		<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 7.5 6 4l3.5 3.5" /></svg>
	</button>
	{#each stops as s, i}
		<button type="button" class="dot" bind:this={railEls[i]} class:cur={current === i} class:done={current > i} onclick={() => go(i)} aria-label={s.label} aria-current={current === i ? "location" : undefined} tabindex={rail ? 0 : -1}>
			<i><b style:transform="scaleY({current > i ? 1 : current === i ? within : 0})"></b></i><span class="fly">{s.short}</span><span class="tip">{s.short}</span>
		</button>
	{/each}
	<button type="button" class="chev" onclick={() => step(1)} disabled={current >= stops.length - 1} aria-label="Next section" title="Next section  ]" tabindex={rail ? 0 : -1}>
		<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
	</button>
</nav>

<style>
	/* in the header */
	.sn { display: flex; align-items: center; gap: 4px; min-width: 0; transition: opacity .25s; }
	.sn.away { opacity: 0; pointer-events: none; }
	.sn ol { list-style: none; margin: 0; padding: 0; display: flex; gap: 2px; }
	.sn ol button { padding: 4px 8px; border-radius: 3px; font-size: 13px; color: #5A6270; white-space: nowrap; }
	.sn ol button:hover { color: #14202D; }
	.sn ol button.on { color: #14202D; font-weight: 600; }
	.chev { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 3px; color: #14202D; }
	.chev:hover:not(:disabled) { background: rgba(20, 32, 45, .07); }
	.chev:disabled { opacity: .25; cursor: default; }
	.chev svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }

	/* the rail, on the left */
	.rail { position: fixed; left: 10px; top: 50%; transform: translateY(-50%); z-index: 15; display: grid; justify-items: center; gap: 2px; padding: 6px 3px; border-radius: 16px; background: rgba(243, 243, 239, .92); box-shadow: 0 2px 10px rgba(20, 32, 45, .08); opacity: 0; pointer-events: none; transition: opacity .25s; }
	.rail.on { opacity: .92; pointer-events: auto; }
	.rail.on:hover, .rail.on:focus-within { opacity: 1; }
	/* one bar per section: done ones dark, the current one filling as the reader goes through it, the rest pale (Ty, 16 Nov) */
	.dot { position: relative; display: grid; place-items: center; width: 24px; height: 34px; }
	.dot i { position: relative; width: 5px; height: 26px; border-radius: 3px; background: #C9CBC7; overflow: hidden; transition: width .2s; }
	.dot i b { position: absolute; inset: 0; background: #14202D; transform-origin: top center; transition: transform .15s linear; }
	.dot:hover i, .dot.cur i { width: 7px; }
	.dot .fly { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 13px; color: #14202D; white-space: nowrap; opacity: 0; pointer-events: none; }
	.dot .tip { position: absolute; left: calc(100% + 6px); top: 50%; transform: translateY(-50%); padding: 2px 7px; border-radius: 2px; background: #14202D; color: #fff; font-size: 12px; white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity .12s; }
	.dot:hover .tip, .dot:focus-visible .tip { opacity: 1; }
	@media (max-width: 980px) {
		.sn ol { display: none; }
		.rail { top: auto; bottom: 10px; transform: none; }
		.rail .dot { display: none; }
	}
	/* phones: no rail; its arrows sat on the text (the keep-scrolling hint and the header's links remain) */
	@media (max-width: 600px) {
		.rail { display: none; }
	}
	@media (prefers-reduced-motion: reduce) { .sn, .rail, .dot i, .dot .tip { transition: none; } }
</style>
