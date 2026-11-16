<script lang="ts">
	// A small piece of the hero art beside a section title (filler crops until the real art). Only in the art variants.
	import { getContext } from "svelte";

	let { n }: { n: number } = $props();
	const getArt = getContext<() => string>("wwt-art") ?? (() => "dots");
	const art = $derived(getArt());
	const src = $derived(
		art === "fingerprint" ? `/images/who-wrote-this/art/fp_emblem_${n}_a.webp` : art === "mosaic" ? `/images/who-wrote-this/art/mo_emblem_${n}.webp` : "",
	);
</script>

{#if src && n >= 1 && n <= 3}
	<img class="emblem {art}" {src} alt="" width="56" height="56" />
{/if}

<style>
	.emblem { width: 56px; height: 56px; flex: none; animation: emblem-in .8s cubic-bezier(.2, .7, .2, 1) both; }
	.emblem.mosaic { border-radius: 3px; box-shadow: 0 4px 14px rgba(20, 32, 45, .18); }
	.emblem.fingerprint { width: 64px; height: 64px; margin: -4px; }
	@keyframes emblem-in { from { opacity: 0; transform: rotate(-8deg) scale(.8); } }
	@media (prefers-reduced-motion: reduce) { .emblem { animation: none; } }
</style>
