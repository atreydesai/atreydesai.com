<script lang="ts">
    import { afterNavigate } from "$app/navigation";
    import PageShell from "$lib/components/PageShell.svelte";
    import { tick } from "svelte";
    import ResearchCard from "$lib/components/ResearchCard.svelte";
    import CustomSelect from "$lib/components/CustomSelect.svelte";
    import { papers, talks } from "$lib/content";
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

        // Wait for the layout's page transition (out: 350ms) to finish so the
        // outgoing page is removed from the DOM before we measure scroll position.
        setTimeout(() => {
            const el = document.getElementById(hash);
            if (el) {
                el.scrollIntoView({ behavior: "auto", block: "start" });
            }
        }, 400);

        setTimeout(() => {
            highlightedPaperId = null;
        }, 3000);
    });

    $: years = [...new Set(papers.map((p) => p.year))].sort(
        (a, b) => b - a,
    );
    $: tags = [...new Set(papers.flatMap((p) => p.tags))].sort();

    $: yearOptions = [
        { value: "all", label: "All Years" },
        ...years.map((y) => ({ value: y.toString(), label: y.toString() })),
    ];

    $: tagOptions = [
        { value: "all", label: "All Topics" },
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
    heading="research"
>
    <div class="mb-8 flex flex-wrap items-center gap-3">
        <CustomSelect
            options={yearOptions}
            bind:value={selectedYear}
            placeholder="All Years"
            ariaLabel="Filter by year"
        />

        <CustomSelect
            options={tagOptions}
            bind:value={selectedTag}
            placeholder="All Topics"
            ariaLabel="Filter by topic"
        />

        {#if activeFilters}
            <button
                type="button"
                class="text-xs font-medium text-ink-500 underline decoration-ink-300 underline-offset-[3px] transition-colors hover:text-ink-800 dark:text-cream-400 dark:decoration-ink-600 dark:hover:text-cream-100"
                on:click={clearFilters}
            >
                Clear filters
            </button>
        {/if}
    </div>

    <div class="-mt-3 mb-6 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500 dark:text-cream-400">
        <button
            type="button"
            class="transition-colors hover:text-ink-900 dark:hover:text-cream-100"
            on:click={clearFilters}
            title="Clear filters"
        >
            {filteredPapers.length} {filteredPapers.length === 1 ? "entry" : "entries"}
        </button>
        <button
            type="button"
            class="underline decoration-dotted decoration-ink-300 underline-offset-[3px] transition-colors hover:text-ink-900 dark:decoration-ink-600 dark:hover:text-cream-100"
            on:click={cycleSortOrder}
            title="Click to change sort order"
            aria-label={`Sorted by ${sortLabel}. Click to change sort order.`}
        >
            sorted by {sortLabel}
        </button>
    </div>

    {#if published.length > 0}
        <section class="mb-12">
            <div class="section-rule mb-5">
                <h2 class="section-heading mb-0">publications</h2>
                <div class="section-rule-line"></div>
            </div>

            {#if sortOrder === "year-desc" || sortOrder === "year-asc"}
                {#each sortedYears as year}
                    <div class="mb-7">
                        <div class="section-rule mb-4 gap-3 pl-1">
                            <p class="meta-label">{year}</p>
                            <div class="section-rule-line"></div>
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
                    <article class="surface-card !rounded surface-card-hover p-4 md:p-5">
                        <h3
                            class="text-lg font-semibold text-ink-900 dark:text-cream-100"
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
                    <article class="surface-card !rounded surface-card-hover p-4 md:p-5">
                        <h3
                            class="text-lg font-semibold text-ink-900 dark:text-cream-100"
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
