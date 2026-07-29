<script lang="ts">
    import { Award } from "@jis3r/icons";
    import AuthorList from "$lib/components/research/AuthorList.svelte";
    import PaperLinks from "$lib/components/research/PaperLinks.svelte";
    import PaperMedia from "$lib/components/research/PaperMedia.svelte";

    export let paper: {
        id: string;
        title: string;
        authors: string[];
        year: number;
        venue: string | null;
        arxiv: string | null;
        pdf: string | null;
        code: string | null;
        demo: string | null;
        twitter: string | null;
        blog: string | null;
        tags: string[];
        tldr: string | null;
        awards: string[];
        preprint: boolean;
        featured: boolean;
        highlight: boolean;
        priority: number;
        image: string | null;
        imageAnimated: string | null;
        imageDescription: string | null;
        classProject?: boolean;
    };

    export let compact = false;
    export let highlighted = false;
    export let variant: "preview" | "full" = "full";

    let tldrOpen = false;

    // Per-pill hover states for award icon animation triggering
    let hoveredLink: string | null = null;

    // Hovering anywhere on the card plays the explainer animation.
    let cardHovered = false;

    $: isPreview = variant === "preview" || compact;
    $: surfaceClasses = [
        "surface-card",
        "overflow-hidden",
        "p-4",
        "md:p-5",
        "surface-card-hover",
        highlighted
            ? "ring-2 ring-accent/35 ring-offset-2 ring-offset-cream-100 dark:ring-offset-ink-900"
            : "",
    ]
        .filter(Boolean)
        .join(" ");
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<article
    id={paper.id}
    class="group relative"
    style="scroll-margin-top: 80px"
    on:mouseenter={() => (cardHovered = true)}
    on:mouseleave={() => (cardHovered = false)}
>
    <div class={surfaceClasses}>
        {#if paper.highlight}
            <!-- Bottom-left corner accent: SVG with rounded ends + matching arc -->
            <div class="absolute -bottom-px -left-px w-10 h-10 pointer-events-none origin-bottom-left scale-0 transition-transform duration-300 ease-out group-hover:scale-100">
                <svg width="40" height="40" overflow="visible" xmlns="http://www.w3.org/2000/svg">
                    <!-- Up the left side, arc through BL corner, right along bottom -->
                    <path d="M 2 2 L 2 26 A 12 12 0 0 0 14 38 L 38 38"
                        fill="none" stroke="#E85D4C" stroke-width="4"
                        stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <!-- Top-right corner accent -->
            <div class="absolute -top-px -right-px w-10 h-10 pointer-events-none origin-top-right scale-0 transition-transform duration-300 ease-out group-hover:scale-100">
                <svg width="40" height="40" overflow="visible" xmlns="http://www.w3.org/2000/svg">
                    <!-- Down the right side, arc through TR corner, left along top -->
                    <path d="M 38 38 L 38 14 A 12 12 0 0 0 26 2 L 2 2"
                        fill="none" stroke="#E85D4C" stroke-width="4"
                        stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
        {/if}

        <div
            class={`flex flex-col gap-4 ${paper.image ? "md:flex-row md:items-start md:gap-5" : ""}`}
        >
            <div class="min-w-0 flex-1">
                <h3
                    class="type-item-heading text-ink-900 dark:text-cream-100"
                >
                    {#if paper.arxiv}
                        <a
                            href={paper.arxiv}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="transition-colors duration-200 hover:text-accent dark:hover:text-accent-light"
                        >
                            {paper.title}
                        </a>
                    {:else}
                        {paper.title}
                    {/if}
                </h3>

                <AuthorList authors={paper.authors} {isPreview} />

                {#if paper.venue || paper.awards.length > 0 || paper.preprint}
                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        {#if paper.venue}
                            <span class="font-serif italic text-ink-500 dark:text-cream-400 {isPreview ? 'text-sm' : 'text-sm'}">
                                {paper.venue}{paper.year ? `, ${paper.year}` : ""}
                            </span>
                        {/if}
                        {#if paper.preprint}
                            <span class="pill bg-accent/10 text-accent-dark dark:bg-accent/15 dark:text-accent-light">preprint</span>
                        {/if}
                        {#each paper.awards as award, i}
                            <!-- Status pills get a tinted fill so they read
                                 louder than the neutral tag pills. -->
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <span
                                class="pill bg-ochre/15 font-medium text-ochre-dark dark:bg-ochre-dark/30 dark:text-ochre-light"
                                on:mouseenter={() => (hoveredLink = `award-${i}`)}
                                on:mouseleave={() => (hoveredLink = null)}
                            >
                                <Award size={12} animate={hoveredLink === `award-${i}`} />
                                {award}
                            </span>
                        {/each}
                    </div>
                {/if}

                <PaperLinks {paper} bind:tldrOpen />

                {#if paper.tldr && tldrOpen}
                    <p
                        class="type-body-small mt-2 text-ink-600 dark:text-cream-300"
                    >
                        {paper.tldr}
                    </p>
                {/if}

                {#if !isPreview && paper.tags.length > 0}
                    <div class="mt-3 flex flex-wrap gap-2">
                        {#each paper.tags as tag}
                            <span class="pill">{tag}</span>
                        {/each}
                    </div>
                {/if}
            </div>

            <PaperMedia {paper} {isPreview} active={cardHovered} />
        </div>
    </div>

</article>
