<script lang="ts">
	// One of the hero's prints as a still mark in the page (a section's emblem, a showcase backdrop, the closing
	// bookend). Drawn once from the shared sprite cache; it inks in from its core when it first scrolls into view.
	//
	// Performance: a large print set as type costs tens of ms to set (more on an older machine), and the page has a
	// dozen of them, all below the first screen. Each is set a few ms at a time in idle moments once it comes within
	// about two and a half screens of the viewport (so a reader arriving at a section finds its prints set, and one who
	// stops at the top costs nothing more); when it is set as type, once the page's face has loaded, so it is set once.
	// It is hidden by its reveal until it is in view, so the reader never sees it unset.
	import { onMount } from "svelte";
	import { printSpriteLater, printAspect, type SpriteOpts } from "./print/sprites";
	import { FONT } from "./print/fingerprint";

	let { family, index = 0, color, px, clarity = 1, text = false, label = "" }:
		{ family: SpriteOpts["family"]; index?: number; color: string; px: number; clarity?: number; text?: boolean; label?: string } = $props();

	let el: HTMLCanvasElement;
	let wrap: HTMLSpanElement; // observed instead of the canvas: a fully clipped element never counts as in view
	let shown = $state(false);
	const w = $derived(Math.round(px * printAspect()));

	onMount(() => {
		let alive = true;
		const draw = (s: HTMLCanvasElement) => {
			if (!alive) return;
			const dpr = Math.min(2, devicePixelRatio || 1);
			el.width = Math.round(w * dpr); el.height = Math.round(px * dpr);
			const ctx = el.getContext("2d")!;
			ctx.clearRect(0, 0, el.width, el.height);
			ctx.drawImage(s, 0, 0, el.width, el.height);
		};
		const face = text && document.fonts?.load ? document.fonts.load(`500 12px ${FONT}`).catch(() => null) : Promise.resolve(null);
		const opts = () => ({ family, index, color, px, clarity, text, dpr: Math.min(2, devicePixelRatio || 1) });
		const set = () => face.then(() => { if (alive) void printSpriteLater(opts()).then(draw); });
		const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) { near.disconnect(); void set(); } }, { rootMargin: "250% 0px 250% 0px" });
		near.observe(wrap);
		const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { shown = true; io.disconnect(); } }, { rootMargin: "0px 0px -10% 0px" });
		io.observe(wrap);
		return () => { alive = false; near.disconnect(); io.disconnect(); };
	});
</script>

<span class="pmw" bind:this={wrap} style:width="{w}px" style:height="{px}px"><canvas bind:this={el} class="pm" class:shown style:width="{w}px" style:height="{px}px" role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : "true"}></canvas></span>

<style>
	.pmw { display: block; flex: none; }
	.pm { display: block; flex: none; clip-path: circle(0% at 50% 55%); transition: clip-path 1.4s cubic-bezier(.2, .7, .2, 1); }
	.pm.shown { clip-path: circle(75% at 50% 55%); }
	@media (prefers-reduced-motion: reduce) { .pm { clip-path: none; transition: none; } }
</style>
