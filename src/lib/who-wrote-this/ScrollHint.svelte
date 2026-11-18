<script lang="ts">
	// A "keep scrolling" hint for slow scrollers (Atrey, 16 Nov: "we want it to move along without them wondering if there
	// isn't anything to scroll"). When the reader has paused for a couple of seconds with more of the page below, a small
	// dark round arrow rises in the bottom-right corner; any scroll hides it, and a click moves on by about half a screen.
	// It stays away while the hero's own scroll cue is showing and once the closing band is reached.
	import { onMount } from "svelte";
	import { docBox, view as vp } from "./loop";

	let show = $state(false);
	const IDLE = 2200;

	onMount(() => {
		let last = performance.now();
		const onScroll = () => { last = performance.now(); if (show) show = false; };
		let finale: Element | null = null;
		const tick = setInterval(() => {
			if (document.hidden) return;
			// (the closing band's place is cached by the page's loop: no layout read here)
			finale ??= document.querySelector(".finale");
			const end = finale ? docBox(finale).top - vp.y : Infinity;
			const want = performance.now() - last > IDLE && end > (vp.h || innerHeight) * 0.9 && !document.querySelector(".ph .cue");
			if (want !== show) show = want;
		}, 400);
		addEventListener("scroll", onScroll, { passive: true });
		return () => { clearInterval(tick); removeEventListener("scroll", onScroll); };
	});
	const go = () => scrollBy({ top: innerHeight * 0.6, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
</script>

{#if show}
	<!-- a small round arrow in the bottom-right corner at every size: a centred pill sat on the sections' captions and
	     charts and blocked them (Atrey, 18 Nov) -->
	<button type="button" class="hint" onclick={go} aria-label="Keep scrolling" title="Keep scrolling">
		<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
	</button>
{/if}

<style>
	.hint {
		position: fixed; right: 20px; bottom: 20px; z-index: 20; display: grid; place-items: center; width: 40px; height: 40px; padding: 0;
		border-radius: 50%; background: #14202D; color: #fff; box-shadow: 0 8px 24px rgba(20, 32, 45, .25);
		animation: rise .45s cubic-bezier(.2, .7, .2, 1) both;
	}
	svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; animation: bob 1.3s ease-in-out infinite; }
	@keyframes rise { from { opacity: 0; transform: translateY(14px); } }
	@keyframes bob { 50% { transform: translateY(3px); } }
	/* on a phone it sits a little higher, clear of the browser's bottom bar */
	@media (max-width: 860px) {
		.hint { right: 12px; bottom: 76px; }
	}
	@media (prefers-reduced-motion: reduce) { .hint, svg { animation: none; } }
</style>
