<script lang="ts">
	import { page } from "$app/state";
	import { explainers } from "$lib/explainers";

	// ?only=<paper id> renders a single explainer, for focused visual QA.
	const only = $derived(page.url.searchParams.get("only"));
	const entries = $derived(Object.entries(explainers).filter(([id]) => !only || id === only));
</script>

<div class="page-shell page-shell-standard" data-justify="off">
	{#each entries as [id, Explainer]}
		{#if Explainer}
			<section class="mb-12">
				<h2 class="section-heading">{id}</h2>
				<div class="flex flex-wrap items-start gap-6">
					<div class="w-40"><Explainer size="card" label={id} /></div>
					<div class="w-[360px]"><Explainer size="card" label={id} /></div>
					<div class="w-[520px] bg-ink-900 p-4"><Explainer size="stage" label={id} /></div>
				</div>
			</section>
		{/if}
	{/each}
</div>
