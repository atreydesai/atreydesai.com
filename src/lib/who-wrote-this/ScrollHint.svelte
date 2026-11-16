<script lang="ts">
	// A "keep scrolling" hint for slow scrollers (Atrey, 16 Nov: "we want it to move along without them wondering if there
	// isn't anything to scroll"). When the reader has paused for a couple of seconds with more of the page below, a small
	// dark pill rises at the bottom of the screen; any scroll hides it, and a click moves on by about half a screen.
	// It stays away while the hero's own scroll cue is showing and once the closing band is reached.
	import { onMount } from "svelte";

	let show = $state(false);
	const IDLE = 2200;

	onMount(() => {
		let last = performance.now();
		const onScroll = () => { last = performance.now(); if (show) show = false; };
		const tick = setInterval(() => {
			if (document.hidden) return;
			const end = document.querySelector(".finale")?.getBoundingClientRect().top ?? Infinity;
			const want = performance.now() - last > IDLE && end > innerHeight * 0.9 && !document.querySelector(".ph .cue");
			if (want !== show) show = want;
		}, 400);
		addEventListener("scroll", onScroll, { passive: true });
		return () => { clearInterval(tick); removeEventListener("scroll", onScroll); };
	});
	const go = () => scrollBy({ top: innerHeight * 0.6, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
</script>

{#if show}
	<button type="button" class="hint" onclick={go} aria-label="Keep scrolling">
		Keep scrolling
		<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" /></svg>
	</button>
{/if}

<style>
	.hint {
		position: fixed; left: 50%; bottom: 22px; z-index: 20; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 8px;
		padding: 9px 14px 9px 16px; border-radius: 999px; background: #14202D; color: #fff; font-size: 13.5px; font-weight: 600;
		box-shadow: 0 8px 24px rgba(20, 32, 45, .25); animation: rise .45s cubic-bezier(.2, .7, .2, 1) both;
	}
	svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; animation: bob 1.3s ease-in-out infinite; }
	@keyframes rise { from { opacity: 0; transform: translate(-50%, 14px); } }
	@keyframes bob { 50% { transform: translateY(3px); } }
	/* on a phone the pill would sit on text: a small round arrow at the right edge instead */
	@media (max-width: 860px) {
		.hint { left: auto; right: 12px; bottom: 76px; width: 40px; height: 40px; padding: 0; justify-content: center; font-size: 0; gap: 0; transform: none; animation-name: rise-r; }
		svg { width: 14px; height: 14px; }
	}
	@keyframes rise-r { from { opacity: 0; transform: translateY(14px); } }
	@media (prefers-reduced-motion: reduce) { .hint, svg { animation: none; } }
</style>
