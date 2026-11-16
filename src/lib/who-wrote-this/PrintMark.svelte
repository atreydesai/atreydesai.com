<script lang="ts">
	// One of the hero's prints as a still mark in the page (a section's emblem, a showcase backdrop, the closing
	// bookend). Drawn once from the shared sprite cache; it inks in from its core when it first scrolls into view.
	import { onMount } from "svelte";
	import { printSprite, printAspect, type SpriteOpts } from "./print/sprites";

	let { family, index = 0, color, px, clarity = 1, text = false, label = "" }:
		{ family: SpriteOpts["family"]; index?: number; color: string; px: number; clarity?: number; text?: boolean; label?: string } = $props();

	let el: HTMLCanvasElement;
	let wrap: HTMLSpanElement; // observed instead of the canvas: a fully clipped element never counts as in view
	let shown = $state(false);
	const w = $derived(Math.round(px * printAspect()));

	onMount(() => {
		const draw = () => {
			const dpr = Math.min(2, devicePixelRatio || 1);
			const s = printSprite({ family, index, color, px, clarity, text, dpr });
			el.width = Math.round(w * dpr); el.height = Math.round(px * dpr);
			const ctx = el.getContext("2d")!;
			ctx.clearRect(0, 0, el.width, el.height);
			ctx.drawImage(s, 0, 0, el.width, el.height);
		};
		draw();
		document.fonts?.ready.then(draw);
		const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { shown = true; io.disconnect(); } }, { rootMargin: "0px 0px -10% 0px" });
		io.observe(wrap);
		return () => io.disconnect();
	});
</script>

<span class="pmw" bind:this={wrap} style:width="{w}px" style:height="{px}px"><canvas bind:this={el} class="pm" class:shown style:width="{w}px" style:height="{px}px" role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : "true"}></canvas></span>

<style>
	.pmw { display: block; flex: none; }
	.pm { display: block; flex: none; clip-path: circle(0% at 50% 55%); transition: clip-path 1.4s cubic-bezier(.2, .7, .2, 1); }
	.pm.shown { clip-path: circle(75% at 50% 55%); }
	@media (prefers-reduced-motion: reduce) { .pm { clip-path: none; transition: none; } }
</style>
