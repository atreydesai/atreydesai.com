<script lang="ts">
    import { afterNavigate } from "$app/navigation";
    import PageShell from "$lib/components/PageShell.svelte";
    import { tick } from "svelte";
    import ResearchCard from "$lib/components/ResearchCard.svelte";
    import CustomSelect from "$lib/components/CustomSelect.svelte";
    import { papers, talks } from "$lib/content";
    import {
        PAGE_TRANSITION_DURATION_MS,
        PAGE_TRANSITION_SCROLL_BUFFER_MS,
    } from "$lib/motion";
    import { formatMonthYear } from "$lib/utils/date";

    let selectedYear: string = "all";
    let selectedTag: string = "all";
    let sortOrder: string = "year-desc";
    let highlightedPaperId: string | null = null;

    const sortOptions = [
        { value: "year-desc", label: "year descending" },
        { value: "year-asc", label: "year ascending" },
        { value: "title-asc", label: "title A–Z" },
        { value: "title-desc", label: "title Z–A" },
    ];

    $: sortLabel =
        sortOptions.find((option) => option.value === sortOrder)?.label ??
        sortOptions[0].label;

    function cycleSortOrder() {
        const currentIndex = sortOptions.findIndex(
            (option) => option.value === sortOrder,
        );
        sortOrder =
            sortOptions[(currentIndex + 1) % sortOptions.length].value;
    }

    function canonicalizeTalkTitle(title: string): string {
        return title.replace(/\s*\([^)]*\)\s*$/, "").trim();
    }

    function comparePapers(
        a: (typeof papers)[number],
        b: (typeof papers)[number],
        order: string,
    ): number {
        const titleAscending = a.title.localeCompare(b.title, undefined, {
            sensitivity: "base",
            numeric: true,
        });
        const priority = (a.priority ?? 99) - (b.priority ?? 99);

        switch (order) {
            case "year-asc":
                return a.year - b.year || priority || titleAscending;
            case "title-asc":
                return titleAscending || b.year - a.year;
            case "title-desc":
                return -titleAscending || b.year - a.year;
            default:
                return b.year - a.year || priority || titleAscending;
        }
    }

    afterNavigate(async () => {
        const hash = window.location.hash.slice(1);

        if (!hash) return;

        await tick();

        highlightedPaperId = hash;

        // Leave one frame of scheduling margin after the outgoing page transition
        // before measuring the deep-link target.
        setTimeout(() => {
            const el = document.getElementById(hash);
            if (el) {
                el.scrollIntoView({ behavior: "auto", block: "start" });
            }
        }, PAGE_TRANSITION_DURATION_MS + PAGE_TRANSITION_SCROLL_BUFFER_MS);

        setTimeout(() => {
            highlightedPaperId = null;
        }, 3000);
    });

    $: years = [...new Set(papers.map((p) => p.year))].sort(
        (a, b) => b - a,
    );
    $: tags = [...new Set(papers.flatMap((p) => p.tags))].sort();

    $: yearOptions = [
        { value: "all", label: "all years" },
        ...years.map((y) => ({ value: y.toString(), label: y.toString() })),
    ];

    $: tagOptions = [
        { value: "all", label: "all topics" },
        ...tags.map((t) => ({ value: t, label: t })),
    ];

    $: filteredPapers = papers.filter((paper) => {
        if (selectedYear !== "all" && paper.year !== parseInt(selectedYear))
            return false;
        if (selectedTag !== "all" && !paper.tags.includes(selectedTag))
            return false;
        return true;
    });

    $: sortedPapers = [...filteredPapers].sort((a, b) =>
        comparePapers(a, b, sortOrder),
    );

    $: published = sortedPapers.filter((p) => !p.classProject);
    $: classProjects = sortedPapers.filter((p) => p.classProject);

    $: papersByYear = published.reduce(
        (acc, paper) => {
            if (!acc[paper.year]) acc[paper.year] = [];
            acc[paper.year].push(paper);
            return acc;
        },
        {} as Record<number, typeof papers>,
    );

    $: sortedYears = Object.keys(papersByYear)
        .map(Number)
        .sort((a, b) => (sortOrder === "year-asc" ? a - b : b - a));

    $: activeFilters = selectedYear !== "all" || selectedTag !== "all";
    $: groupedTalks = Object.values(
        talks.reduce(
            (acc, talk) => {
                const title = canonicalizeTalkTitle(talk.title);
                const existing = acc[title];

                if (!existing) {
                    acc[title] = {
                        title,
                        type: talk.type,
                        appearances: [talk],
                    };
                } else {
                    existing.appearances.push(talk);
                }

                return acc;
            },
            {} as Record<
                string,
                {
                    title: string;
                    type: string;
                    appearances: typeof talks;
                }
            >,
        ),
    )
        .map((group) => ({
            ...group,
            appearances: [...group.appearances].sort(
                (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime(),
            ),
        }))
        .sort(
            (a, b) =>
                new Date(b.appearances[0].date).getTime() -
                new Date(a.appearances[0].date).getTime(),
        );

    $: talkGroups = groupedTalks.filter((g) => g.type === "research talk");
    $: presentationGroups = groupedTalks.filter((g) => g.type === "poster");

    function clearFilters() {
        selectedYear = "all";
        selectedTag = "all";
    }
</script>

<PageShell
    title="Research | Atrey Desai"
    description="Publications and preprints by Atrey Desai on NLP benchmarks, multimodal reasoning, and computational animal linguistics. Research from UMD CLIP Lab, UT Arlington ACL2 Lab, and Brown University."
    url="https://atreydesai.com/research/"
>
    <header slot="header" class="research-header">
        <h1 class="type-page-title text-ink-900 dark:text-cream-100">
            research
        </h1>

        <div class="research-controls" aria-label="Research controls">
            <div class="research-filters">
                <CustomSelect
                    options={yearOptions}
                    bind:value={selectedYear}
                    placeholder="all years"
                    ariaLabel="Filter by year"
                />

                <CustomSelect
                    options={tagOptions}
                    bind:value={selectedTag}
                    placeholder="all topics"
                    ariaLabel="Filter by topic"
                />
            </div>

            <div class="research-summary">
                <output class="research-count" aria-live="polite">
                    {filteredPapers.length} {filteredPapers.length === 1
                        ? "entry"
                        : "entries"}
                </output>

                <button
                    type="button"
                    class="research-sort"
                    on:click={cycleSortOrder}
                    title="Click to change sort order"
                    aria-label={`Sorted by ${sortLabel}. Click to change sort order.`}
                >
                    <span>sort</span>
                    {sortLabel}
                </button>

                {#if activeFilters}
                    <button
                        type="button"
                        class="research-clear"
                        on:click={clearFilters}
                    >
                        clear
                    </button>
                {/if}
            </div>
        </div>
    </header>

    {#if published.length > 0}
        <section class="mb-12">
            <div class="section-rule mb-5">
                <h2 class="section-heading mb-0">publications</h2>
                <div class="section-rule-line"></div>
            </div>

            {#if sortOrder === "year-desc" || sortOrder === "year-asc"}
                {#each sortedYears as year, yearIndex}
                    <div class="mb-8">
                        <div class="section-rule mb-4 gap-3 pl-1">
                            <p class="meta-label">{year}</p>
                            {#if yearIndex > 0}
                                <div class="section-rule-line"></div>
                            {/if}
                        </div>

                        <div class="space-y-3">
                            {#each papersByYear[year] as paper (paper.id)}
                                <ResearchCard
                                    {paper}
                                    variant="full"
                                    highlighted={paper.id === highlightedPaperId}
                                />
                            {/each}
                        </div>
                    </div>
                {/each}
            {:else}
                <div class="space-y-3">
                    {#each published as paper (paper.id)}
                        <ResearchCard
                            {paper}
                            variant="full"
                            highlighted={paper.id === highlightedPaperId}
                        />
                    {/each}
                </div>
            {/if}
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

    {#if talkGroups.length > 0}
        <section class="mb-12">
            <div class="section-rule mb-5">
                <h2 class="section-heading mb-0">talks</h2>
                <div class="section-rule-line"></div>
            </div>

            <div class="space-y-4">
                {#each talkGroups as talkGroup}
                    <article class="surface-card surface-card-hover p-4 md:p-5">
                        <h3
                            class="type-item-heading text-ink-900 dark:text-cream-100"
                        >
                            {talkGroup.title}
                        </h3>

                        <div class="mt-3 space-y-2.5">
                            {#each talkGroup.appearances as appearance}
                                <div class="text-sm text-ink-600 dark:text-cream-300">
                                    <p>
                                        {appearance.venue}, {formatMonthYear(appearance.date)}
                                    </p>

                                    {#if appearance.slides || appearance.video}
                                        <div
                                            class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs"
                                        >
                                            {#if appearance.slides}
                                                <a
                                                    href={appearance.slides}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="link-subtle"
                                                >
                                                    Slides
                                                </a>
                                            {/if}

                                            {#if appearance.video}
                                                <a
                                                    href={appearance.video}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="link-subtle"
                                                >
                                                    Video
                                                </a>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </article>
                {/each}
            </div>
        </section>
    {/if}

    {#if presentationGroups.length > 0}
        <section class="mb-12">
            <div class="section-rule mb-5">
                <h2 class="section-heading mb-0">presentations</h2>
                <div class="section-rule-line"></div>
            </div>

            <div class="space-y-4">
                {#each presentationGroups as talkGroup}
                    <article class="surface-card surface-card-hover p-4 md:p-5">
                        <h3
                            class="type-item-heading text-ink-900 dark:text-cream-100"
                        >
                            {talkGroup.title}
                        </h3>

                        <div class="mt-3 space-y-2.5">
                            {#each talkGroup.appearances as appearance}
                                <div class="text-sm text-ink-600 dark:text-cream-300">
                                    <p>
                                        {appearance.venue}, {formatMonthYear(appearance.date)}
                                    </p>

                                    {#if appearance.slides || appearance.video}
                                        <div
                                            class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs"
                                        >
                                            {#if appearance.slides}
                                                <a
                                                    href={appearance.slides}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="link-subtle"
                                                >
                                                    Slides
                                                </a>
                                            {/if}

                                            {#if appearance.video}
                                                <a
                                                    href={appearance.video}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="link-subtle"
                                                >
                                                    Video
                                                </a>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
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
                on:click={clearFilters}
            >
                Clear filters
            </button>
        </div>
    {/if}
</PageShell>

<style>
    .research-header {
        display: grid;
        gap: var(--space-3);
        margin-bottom: var(--space-5);
    }

    .research-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-4);
    }

    .research-filters,
    .research-summary {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
    }

    .research-filters {
        gap: var(--space-2);
    }

    .research-summary {
        gap: var(--space-1);
    }

    .research-controls :global(.select-trigger) {
        min-width: 7.75rem;
        min-height: 2rem;
        padding-block: var(--space-1);
    }

    .research-count {
        color: theme("colors.ink.500");
        font-family: var(--font-mono);
        font-size: 0.6875rem;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
    }

    .research-sort,
    .research-clear {
        min-height: 2rem;
        padding: var(--space-1) var(--space-1-5);
        color: theme("colors.ink.600");
        background: transparent;
        border: 0;
        border-radius: var(--radius-control);
        cursor: pointer;
        font-family: var(--font-mono);
        font-size: 0.6875rem;
        line-height: 1.25;
        transition:
            color var(--motion-base) var(--ease-standard),
            background-color var(--motion-base) var(--ease-standard);
    }

    .research-sort span {
        color: theme("colors.ink.400");
        font-style: italic;
    }

    .research-clear {
        color: theme("colors.accent.dark");
        text-decoration: underline;
        text-decoration-color: theme("colors.ink.300");
        text-underline-offset: 3px;
    }

    .research-sort:hover,
    .research-sort:focus-visible,
    .research-clear:hover,
    .research-clear:focus-visible {
        color: theme("colors.ink.900");
        background: theme("colors.cream.100");
    }

    :global(.dark) .research-count,
    :global(.dark) .research-sort {
        color: theme("colors.cream.400");
    }

    :global(.dark) .research-sort span {
        color: theme("colors.cream.500");
    }

    :global(.dark) .research-clear {
        color: theme("colors.accent.light");
        text-decoration-color: theme("colors.ink.600");
    }

    :global(.dark) .research-sort:hover,
    :global(.dark) .research-sort:focus-visible,
    :global(.dark) .research-clear:hover,
    :global(.dark) .research-clear:focus-visible {
        color: theme("colors.cream.100");
        background: theme("colors.ink.800");
    }

    @media (min-width: 768px) {
        .research-header {
            grid-template-columns: auto minmax(0, 1fr);
            align-items: center;
        }

        .research-controls {
            justify-content: flex-end;
        }
    }
</style>
