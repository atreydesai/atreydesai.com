<script lang="ts">
	// A section's step dashes, clickable: one per guided step, the current one dark. Clicking a dash scrolls to that
	// step (the section passes `go`). Sits at the top of the narration card.
	let { count, current, go, label = "Step" }: { count: number; current: number; go: (i: number) => void; label?: string } = $props();
</script>

<nav class="dashes" aria-label="Steps">
	{#each Array(count) as _, i}
		<button type="button" class:on={current === i} class:past={current > i} aria-label="{label} {i + 1} of {count}" aria-current={current === i ? "step" : undefined} onclick={() => go(i)}><i></i></button>
	{/each}
</nav>

<style>
	.dashes { display: flex; gap: 2px; margin: -6px 0 2px -4px; }
	button { display: grid; place-items: center; width: 30px; height: 18px; padding: 0 4px; cursor: pointer; }
	i { display: block; width: 100%; height: 3px; border-radius: 2px; background: #C9C9C9; transition: background-color .25s; }
	button:hover i { background: #898989; }
	button.past i { background: #898989; }
	button.on i { background: #14202D; }
	@media (prefers-reduced-motion: reduce) { i { transition: none; } }
</style>
