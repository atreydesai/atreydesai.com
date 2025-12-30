<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import ResearchCard from "$lib/components/ResearchCard.svelte";
    import CustomSelect from "$lib/components/CustomSelect.svelte";
    import { papersData } from "$lib/content";
    import { Blend } from "@jis3r/icons";

    // State for filtering
    let selectedYear: string = "all";
    let selectedTag: string = "all";
    let showPreprints: boolean = true;

    // Get unique years and tags
    $: years = [...new Set(papersData.papers.map((p) => p.year))].sort(
        (a, b) => b - a,
    );
    $: tags = [...new Set(papersData.papers.flatMap((p) => p.tags))].sort();

    // Create options for dropdowns
    $: yearOptions = [
        { value: "all", label: "All Years" },
        ...years.map((y) => ({ value: y.toString(), label: y.toString() })),
    ];

    $: tagOptions = [
        { value: "all", label: "All Topics" },
        ...tags.map((t) => ({ value: t, label: t })),
    ];

    // Filter papers
    $: filteredPapers = papersData.papers.filter((paper) => {
        if (selectedYear !== "all" && paper.year !== parseInt(selectedYear))
            return false;
        if (selectedTag !== "all" && !paper.tags.includes(selectedTag))
            return false;
        if (!showPreprints && paper.preprint) return false;
        return true;
    });

    // Group papers by year
    $: papersByYear = filteredPapers.reduce(
        (acc, paper) => {
            if (!acc[paper.year]) acc[paper.year] = [];
            acc[paper.year].push(paper);
            return acc;
        },
        {} as Record<number, typeof papersData.papers>,
    );

    $: sortedYears = Object.keys(papersByYear)
        .map(Number)
        .sort((a, b) => b - a);

    // Separate preprints, published, and class projects
    $: preprints = filteredPapers.filter((p) => p.preprint && !p.classProject);
    $: published = filteredPapers.filter((p) => !p.preprint && !p.classProject);
    $: classProjects = filteredPapers.filter((p) => p.classProject);
</script>

<Seo
    title="Research | Atrey Desai"
    description="Publications and preprints by Atrey Desai on NLP benchmarks, multimodal reasoning, and computational animal linguistics. Research from UMD CLIP Lab, UT Arlington ACL2 Lab, and Brown University."
    url="https://atreydesai.com/research"
/>

<div class="layout-main py-8 md:py-12">
    <h1 class="heading-display text-3xl text-ink-900 dark:text-cream-100 mb-8">
        research
    </h1>

    <!-- Filters -->
    <div
        class="flex flex-wrap items-center gap-4 mb-8 p-4 bg-cream-50 dark:bg-ink-800 rounded-lg"
    >
        <div
            class="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400"
        >
            <Blend size={16} />
            <span>Filter:</span>
        </div>

        <CustomSelect
            options={yearOptions}
            bind:value={selectedYear}
            placeholder="All Years"
        />
        <CustomSelect
            options={tagOptions}
            bind:value={selectedTag}
            placeholder="All Topics"
        />

        <label
            class="flex items-center gap-2 text-sm text-ink-600 dark:text-cream-400"
        >
            <input
                type="checkbox"
                bind:checked={showPreprints}
                class="rounded border-ink-300 dark:border-ink-600 accent-accent"
            />
            Show preprints
        </label>
    </div>

    <!-- Published Papers -->
    {#if published.length > 0}
        <section class="mb-12">
            <h2 class="section-heading">publications</h2>
            {#each sortedYears as year}
                {#if papersByYear[year]?.some((p) => !p.preprint && !p.classProject)}
                    <div class="mb-6">
                        <h3
                            class="text-sm font-medium text-ink-500 dark:text-ink-400 mb-2"
                        >
                            {year}
                        </h3>
                        <div class="stagger-children">
                            {#each papersByYear[year].filter((p) => !p.preprint && !p.classProject) as paper (paper.id)}
                                <ResearchCard {paper} />
                            {/each}
                        </div>
                    </div>
                {/if}
            {/each}
        </section>
    {/if}

    <!-- Preprints -->
    {#if showPreprints && preprints.length > 0}
        <section class="mb-12">
            <h2 class="section-heading">preprints</h2>
            <div class="stagger-children">
                {#each preprints as paper (paper.id)}
                    <ResearchCard {paper} />
                {/each}
            </div>
        </section>
    {/if}

    <!-- Class Projects -->
    {#if classProjects.length > 0}
        <section class="mb-12">
            <h2 class="section-heading">class projects</h2>
            <div class="stagger-children">
                {#each classProjects as paper (paper.id)}
                    <ResearchCard {paper} />
                {/each}
            </div>
        </section>
    {/if}

    <!-- Talks & Presentations -->

    {#if papersData.talks.length > 0}
        <section class="mb-12">
            <h2 class="section-heading">talks & presentations</h2>
            <div class="space-y-4">
                {#each papersData.talks as talk}
                    <div
                        class="py-3 border-b border-ink-100 dark:border-ink-800"
                    >
                        <h3
                            class="font-medium text-ink-900 dark:text-cream-100"
                        >
                            {talk.title}
                        </h3>
                        <p class="text-sm text-ink-600 dark:text-ink-400">
                            {talk.venue} · {new Date(
                                talk.date,
                            ).toLocaleDateString("en-US", {
                                month: "short",
                                year: "numeric",
                            })}
                            <span
                                class="ml-2 text-xs bg-cream-200 dark:bg-ink-700 px-2 py-0.5 rounded"
                                >{talk.type}</span
                            >
                        </p>
                        {#if talk.slides || talk.video}
                            <div class="flex gap-3 mt-2 text-sm">
                                {#if talk.slides}
                                    <a
                                        href={talk.slides}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="link-subtle">Slides</a
                                    >
                                {/if}
                                {#if talk.video}
                                    <a
                                        href={talk.video}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="link-subtle">Video</a
                                    >
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        </section>
    {/if}

    <!-- Empty state -->
    {#if filteredPapers.length === 0}
        <div class="text-center py-12 text-ink-500 dark:text-ink-400">
            <p>No papers match your current filters.</p>
            <button
                type="button"
                class="mt-2 link"
                on:click={() => {
                    selectedYear = "all";
                    selectedTag = "all";
                    showPreprints = true;
                }}
            >
                Clear filters
            </button>
        </div>
    {/if}
</div>
