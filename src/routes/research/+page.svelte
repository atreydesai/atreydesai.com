<script lang="ts">
    import { onMount } from "svelte";
    import Seo from "$lib/components/Seo.svelte";
    import ResearchCard from "$lib/components/ResearchCard.svelte";
    import CustomSelect from "$lib/components/CustomSelect.svelte";
    import { papersData } from "$lib/content";
    import { formatDate } from "$lib/utils/date";
    import { Blend } from "@jis3r/icons";

    let selectedYear: string = "all";
    let selectedTag: string = "all";
    let showPreprints: boolean = true;
    let highlightedPaperId: string | null = null;

    onMount(() => {
        const hash = window.location.hash.slice(1);

        if (!hash) return;

        requestAnimationFrame(() => {
            const el = document.getElementById(hash);

            if (!el) return;

            el.scrollIntoView({ behavior: "smooth", block: "center" });
            highlightedPaperId = hash;

            setTimeout(() => {
                highlightedPaperId = null;
            }, 3000);
        });
    });

    $: years = [...new Set(papersData.papers.map((p) => p.year))].sort(
        (a, b) => b - a,
    );
    $: tags = [...new Set(papersData.papers.flatMap((p) => p.tags))].sort();

    $: yearOptions = [
        { value: "all", label: "All Years" },
        ...years.map((y) => ({ value: y.toString(), label: y.toString() })),
    ];

    $: tagOptions = [
        { value: "all", label: "All Topics" },
        ...tags.map((t) => ({ value: t, label: t })),
    ];

    $: filteredPapers = papersData.papers.filter((paper) => {
        if (selectedYear !== "all" && paper.year !== parseInt(selectedYear))
            return false;
        if (selectedTag !== "all" && !paper.tags.includes(selectedTag))
            return false;
        if (!showPreprints && paper.preprint) return false;
        return true;
    });

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
    <section class="mb-8 md:mb-10">
        <div class="section-rule mb-4">
            <h1
                class="heading-display mb-0 text-3xl text-ink-900 dark:text-cream-100"
            >
                research
            </h1>
            <div class="section-rule-line"></div>
        </div>

        <p class="max-w-2xl text-sm leading-6 text-ink-500 dark:text-cream-400">
            Publications, preprints, class projects, and talks in one place.
        </p>
    </section>

    <div class="surface-card mb-8 p-4">
        <div
            class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
            <div class="flex items-start gap-3">
                <div
                    class="rounded-full bg-accent/10 p-2 text-accent dark:bg-accent/20 dark:text-accent-light"
                >
                    <Blend size={16} />
                </div>

                <div>
                    <p class="meta-label mb-1">Filter</p>
                    <p
                        class="text-sm leading-6 text-ink-500 dark:text-cream-400"
                    >
                        Refine by year and topic without changing the reading
                        order.
                    </p>
                </div>
            </div>

            <div class="flex flex-wrap items-center gap-3">
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
                    class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink-200/70 bg-cream-100/80 px-3 py-2 text-sm text-ink-600 dark:border-ink-700 dark:bg-ink-900/70 dark:text-cream-300"
                >
                    <input
                        type="checkbox"
                        bind:checked={showPreprints}
                        class="h-4 w-4 rounded border-ink-300 accent-accent dark:border-ink-600"
                    />
                    <span>Show preprints</span>
                </label>
            </div>
        </div>
    </div>

    {#if published.length > 0}
        <section class="mb-12">
            <div class="section-rule mb-5">
                <h2 class="section-heading mb-0">publications</h2>
                <div class="section-rule-line"></div>
            </div>

            {#each sortedYears as year}
                {#if papersByYear[year]?.some((p) => !p.preprint && !p.classProject)}
                    <div class="mb-7">
                        <div class="section-rule mb-4 gap-3 pl-1">
                            <p class="meta-label">{year}</p>
                            <div class="section-rule-line"></div>
                        </div>

                        <div class="space-y-3">
                            {#each papersByYear[year].filter((p) => !p.preprint && !p.classProject) as paper (paper.id)}
                                <ResearchCard
                                    {paper}
                                    variant="full"
                                    highlighted={paper.id === highlightedPaperId}
                                />
                            {/each}
                        </div>
                    </div>
                {/if}
            {/each}
        </section>
    {/if}

    {#if showPreprints && preprints.length > 0}
        <section class="mb-12">
            <div class="section-rule mb-5">
                <h2 class="section-heading mb-0">preprints</h2>
                <div class="section-rule-line"></div>
            </div>

            <div class="space-y-3">
                {#each preprints as paper (paper.id)}
                    <ResearchCard
                        {paper}
                        variant="full"
                        highlighted={paper.id === highlightedPaperId}
                    />
                {/each}
            </div>
        </section>
    {/if}

    {#if classProjects.length > 0}
        <section class="mb-12">
            <div class="section-rule mb-5">
                <h2 class="section-heading mb-0">class projects</h2>
                <div class="section-rule-line"></div>
            </div>

            <div class="space-y-3">
                {#each classProjects as paper (paper.id)}
                    <ResearchCard
                        {paper}
                        variant="full"
                        highlighted={paper.id === highlightedPaperId}
                    />
                {/each}
            </div>
        </section>
    {/if}

    {#if papersData.talks.length > 0}
        <section class="mb-12">
            <div class="section-rule mb-5">
                <h2 class="section-heading mb-0">talks & presentations</h2>
                <div class="section-rule-line"></div>
            </div>

            <div class="space-y-4">
                {#each papersData.talks as talk}
                    <article class="surface-card p-4 md:p-5">
                        <p class="meta-label mb-2">{talk.type}</p>

                        <h3
                            class="text-lg font-semibold text-ink-900 dark:text-cream-100"
                        >
                            {talk.title}
                        </h3>

                        <p class="mt-2 text-sm text-ink-600 dark:text-cream-300">
                            {talk.venue} · {formatDate(talk.date, {
                                month: "short",
                                year: "numeric",
                            })}
                        </p>

                        {#if talk.slides || talk.video}
                            <div class="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
                                {#if talk.slides}
                                    <a
                                        href={talk.slides}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="link-subtle"
                                    >
                                        Slides
                                    </a>
                                {/if}

                                {#if talk.video}
                                    <a
                                        href={talk.video}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="link-subtle"
                                    >
                                        Video
                                    </a>
                                {/if}
                            </div>
                        {/if}
                    </article>
                {/each}
            </div>
        </section>
    {/if}

    {#if filteredPapers.length === 0}
        <div class="surface-card p-8 text-center">
            <p class="text-ink-500 dark:text-cream-400">
                No papers match your current filters.
            </p>

            <button
                type="button"
                class="link mt-3"
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
