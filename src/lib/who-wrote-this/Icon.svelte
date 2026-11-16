<script lang="ts">
	// Bootstrap Icons (MIT), the paper's icon family, and the paper's venue marks, from icons.json
	// (built in the private llm-detectors repo by docs/launch_20261116/tools/build_icons.py).
	import icons from "./icons.json";

	let { name, class: cls = "", label = "" }: { name: string; class?: string; label?: string } = $props();

	const brands = icons.brand as Record<string, string>;
	const lab = icons.lab as Record<string, string>;
	const key = $derived(name === "open" ? "ai" : name);
	const brandSvg = $derived(
		brands[key]?.replace("<svg", `<svg class="ic brand ${cls}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}`),
	);
</script>

{#if brandSvg}
	{@html brandSvg}
{:else}
	<svg class="ic {cls}" viewBox="0 0 12 12" fill="currentColor" role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : "true"}>{@html lab[key] ?? ""}</svg>
{/if}

<style>
	:global(.wwt .ic) { width: 1em; height: 1em; flex: none; display: inline-block; vertical-align: -0.125em; overflow: visible; }
	:global(.wwt .ic.brand path), :global(.wwt .ic.brand rect), :global(.wwt .ic.brand circle), :global(.wwt .ic.brand polygon) { fill: currentColor !important; }
</style>
