<script lang="ts">
	// Controls arrive after the story. While the reader scrolls through a section's guided steps the panel shows only
	// the narration card; on the last step (or once the reader has passed it) the section's controls slide in under
	// the card, so the first read is never a wall of buttons. Use: <Reveal show={step >= LAST}> ...controls... </Reveal>
	import type { Snippet } from "svelte";

	let { show, label = "Explore", children }: { show: boolean; label?: string; children: Snippet } = $props();
</script>

<div class="reveal" class:show inert={!show} aria-hidden={!show}>
	<div class="inner">
		<p class="kicker">{label}</p>
		<div class="body">{@render children()}</div>
	</div>
</div>

<style>
	.reveal { display: grid; grid-template-rows: 0fr; opacity: 0; transform: translateY(6px); transition: grid-template-rows .45s var(--ease, ease), opacity .35s, transform .45s var(--ease, ease); }
	.inner { overflow: hidden; min-height: 0; }
	.reveal.show { grid-template-rows: 1fr; opacity: 1; transform: none; }
	.kicker { font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink2); margin: 2px 0 6px; }
	.body { display: grid; gap: 8px; }
	@media (prefers-reduced-motion: reduce) { .reveal { transition: none; } }
</style>
