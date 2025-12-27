<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import ExternalLink from "lucide-svelte/icons/external-link";
    import FileText from "lucide-svelte/icons/file-text";
    import Code from "lucide-svelte/icons/code";
    import Award from "lucide-svelte/icons/award";
    import Twitter from "lucide-svelte/icons/twitter";
    import PenLine from "lucide-svelte/icons/pen-line";
    import X from "lucide-svelte/icons/x";

    export let paper: {
        id: string;
        title: string;
        authors: string[];
        year: number;
        venue: string;
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
        image: string | null;
        imageDescription: string | null;
    };

    export let compact = false;

    // Image lightbox
    let lightboxOpen = false;

    function openLightbox() {
        if (paper.image) {
            lightboxOpen = true;
            if (typeof document !== "undefined") {
                document.body.style.overflow = "hidden";
            }
        }
    }

    function closeLightbox() {
        lightboxOpen = false;
        if (typeof document !== "undefined") {
            document.body.style.overflow = "";
        }
    }

    // Highlight the author's name
    function formatAuthors(authors: string[]): string {
        return authors
            .map((author) =>
                author.includes("Atrey Desai")
                    ? `<strong class="text-ink-900 dark:text-cream-100">${author}</strong>`
                    : author,
            )
            .join(", ");
    }
</script>

<svelte:window on:keydown={(e) => e.key === "Escape" && closeLightbox()} />

<article
    class="group py-4 {compact
        ? ''
        : 'border-b border-ink-100 dark:border-ink-800'}"
    id={paper.id}
>
    <div class="flex flex-col md:flex-row gap-4">
        <!-- Content -->
        <div class="flex-1">
            <!-- Title -->
            <h3
                class="text-lg font-semibold text-ink-900 dark:text-cream-100 mb-1 group-hover:text-ink-700 dark:group-hover:text-cream-200 transition-colors"
            >
                {#if paper.arxiv}
                    <a
                        href={paper.arxiv}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="hover:underline"
                    >
                        {paper.title}
                    </a>
                {:else}
                    {paper.title}
                {/if}
            </h3>

            <!-- Authors -->
            <p class="text-sm text-ink-600 dark:text-ink-300 mb-2">
                {@html formatAuthors(paper.authors)}
            </p>

            <!-- Venue and Year -->
            <p class="text-sm text-ink-500 dark:text-ink-400 mb-2">
                <span class="italic">{paper.venue}</span>, {paper.year}
                {#if paper.preprint}
                    <span
                        class="ml-2 text-xs bg-cream-300 dark:bg-ink-700 px-2 py-0.5 rounded"
                        >preprint</span
                    >
                {/if}
            </p>

            <!-- Awards -->
            {#if paper.awards.length > 0}
                <div class="flex flex-wrap gap-2 mb-2">
                    {#each paper.awards as award}
                        <span
                            class="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded"
                        >
                            <Award size={12} />
                            {award}
                        </span>
                    {/each}
                </div>
            {/if}

            <!-- TL;DR -->
            {#if paper.tldr && !compact}
                <p class="text-sm text-ink-600 dark:text-ink-300 mb-3">
                    <span class="font-medium">TL;DR:</span>
                    {paper.tldr}
                </p>
            {/if}

            <!-- Tags -->
            {#if !compact}
                <div class="flex flex-wrap gap-2 mb-3">
                    {#each paper.tags as tag}
                        <span class="pill text-xs">{tag}</span>
                    {/each}
                </div>
            {/if}

            <!-- Links -->
            <div class="flex flex-wrap gap-3 text-sm">
                {#if paper.arxiv}
                    <a
                        href={paper.arxiv}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link-subtle inline-flex items-center gap-1"
                    >
                        <ExternalLink size={14} />
                        arXiv
                    </a>
                {/if}
                {#if paper.pdf}
                    <a
                        href={paper.pdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link-subtle inline-flex items-center gap-1"
                    >
                        <FileText size={14} />
                        PDF
                    </a>
                {/if}
                {#if paper.code}
                    <a
                        href={paper.code}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link-subtle inline-flex items-center gap-1"
                    >
                        <Code size={14} />
                        Code
                    </a>
                {/if}
                {#if paper.demo}
                    <a
                        href={paper.demo}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link-subtle inline-flex items-center gap-1"
                    >
                        <ExternalLink size={14} />
                        Demo
                    </a>
                {/if}
                {#if paper.twitter}
                    <a
                        href={paper.twitter}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link-subtle inline-flex items-center gap-1"
                    >
                        <Twitter size={14} />
                        Twitter
                    </a>
                {/if}
                {#if paper.blog}
                    <a
                        href={paper.blog}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link-subtle inline-flex items-center gap-1"
                    >
                        <PenLine size={14} />
                        Blog
                    </a>
                {/if}
            </div>
        </div>

        <!-- Image with clickable lightbox (if available) -->
        {#if !compact}
            <div class="w-full md:w-40 flex-shrink-0">
                {#if paper.image}
                    <button
                        type="button"
                        on:click={openLightbox}
                        class="w-full h-32 md:h-full rounded-lg overflow-hidden cursor-pointer group/img transition-transform duration-300 hover:scale-[1.02]"
                    >
                        <img
                            src={paper.image}
                            alt="{paper.title} preview"
                            class="w-full h-full object-cover"
                            loading="lazy"
                        />
                    </button>
                {:else}
                    <!-- Placeholder for image -->
                    <div
                        class="w-full h-32 md:h-full bg-cream-200 dark:bg-ink-800 rounded-lg flex items-center justify-center text-ink-400 dark:text-ink-500 text-xs"
                    >
                        [diagram]
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</article>

<!-- Image Lightbox -->
{#if lightboxOpen && paper.image}
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div
        class="fixed inset-0 z-50 bg-ink-900/95 flex items-center justify-center p-4"
        on:click={closeLightbox}
        on:keydown={(e) => e.key === "Escape" && closeLightbox()}
        role="dialog"
        aria-modal="true"
        aria-label="Image lightbox"
        tabindex="-1"
    >
        <!-- Close button -->
        <button
            type="button"
            class="absolute top-4 right-4 text-cream-100 hover:text-cream-300 transition-colors z-10"
            on:click|stopPropagation={closeLightbox}
            aria-label="Close lightbox"
        >
            <X size={32} />
        </button>

        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="max-w-3xl max-h-[80vh] flex flex-col items-center"
            on:click|stopPropagation={() => {}}
        >
            <img
                src={paper.image}
                alt="{paper.title} diagram"
                class="max-w-full max-h-[70vh] object-contain rounded-lg"
            />

            <!-- Description -->
            <div class="mt-4 text-cream-300 text-sm text-center max-w-xl">
                <p class="font-medium text-cream-100 mb-1">{paper.title}</p>
                {#if paper.imageDescription}
                    <p>{paper.imageDescription}</p>
                {/if}
            </div>
        </div>
    </div>
{/if}
