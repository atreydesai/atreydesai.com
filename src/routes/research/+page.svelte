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
    let showPreprints: boolean = true;
    let highlightedPaperId: string | null = null;

    function canonicalizeTalkTitle(title: string): string {
        return title.replace(/\s*\([^)]*\)\s*$/, "").trim();
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
        if (!showPreprints && paper.preprint) return false;
        return true;
    });

    $: papersByYear = filteredPapers.reduce(
        (acc, paper) => {
            if (!acc[paper.year]) acc[paper.year] = [];
            acc[paper.year].push(paper);
            return acc;
        },
        {} as Record<number, typeof papers>,
    );

    $: sortedYears = Object.keys(papersByYear)
        .map(Number)
        .sort((a, b) => b - a);

    $: preprints = filteredPapers.filter((p) => p.preprint && !p.classProject);
    $: published = filteredPapers.filter((p) => !p.preprint && !p.classProject);
    $: classProjects = filteredPapers.filter((p) => p.classProject);
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
</script>

<PageShell
    title="Research | Atrey Desai"
    description="Publications and preprints by Atrey Desai on NLP benchmarks, multimodal reasoning, and computational animal linguistics. Research from UMD CLIP Lab, UT Arlington ACL2 Lab, and Brown University."
    url="https://atreydesai.com/research"
    heading="research"
>
    <div class="mb-8 flex flex-wrap items-center gap-3">
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

    {#if talkGroups.length > 0}
        <section class="mb-12">
            <div class="section-rule mb-5">
                <h2 class="section-heading mb-0">talks</h2>
                <div class="section-rule-line"></div>
            </div>

            <div class="space-y-4">
                {#each talkGroups as talkGroup}
                    <article class="surface-card !rounded surface-card-hover border-transparent p-4 md:p-5">
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
                    <article class="surface-card !rounded surface-card-hover border-transparent p-4 md:p-5">
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
</PageShell>
