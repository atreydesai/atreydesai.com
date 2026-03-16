<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { ExternalLink, FileText, Twitter, Pause } from "lucide-svelte";
    import { Binary, Award, PenLine, X, Play } from "@jis3r/icons";

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

    let isHovered = false;
    let lightboxOpen = false;
    let showAnimated = false;

    onMount(() => {
        return () => {
            if (typeof document !== "undefined") {
                document.body.style.overflow = "";
            }
        };
    });

    function openLightbox() {
        if (!paper.image) return;

        lightboxOpen = true;
        showAnimated = false;

        if (typeof document !== "undefined") {
            document.body.style.overflow = "hidden";
        }
    }

    function closeLightbox() {
        lightboxOpen = false;
        showAnimated = false;

        if (typeof document !== "undefined") {
            document.body.style.overflow = "";
        }
    }

    function toggleAnimated() {
        showAnimated = !showAnimated;
    }

    function formatAuthors(authors: string[]): string {
        return authors
            .map((author) =>
                author.includes("Atrey Desai")
                    ? `<strong class="text-ink-900 dark:text-cream-100">${author}</strong>`
                    : author,
            )
            .join(", ");
    }

    function portal(node: HTMLElement) {
        document.body.appendChild(node);

        return {
            destroy() {
                node.remove();
            },
        };
    }

    $: isPreview = variant === "preview" || compact;
    $: isVideo =
        paper.imageAnimated?.endsWith(".mp4") ||
        paper.imageAnimated?.endsWith(".webm");
    $: hasLinks = Boolean(
        paper.arxiv ||
            paper.pdf ||
            paper.code ||
            paper.demo ||
            paper.twitter ||
            paper.blog,
    );
    $: surfaceClasses = [
        "surface-card",
        "overflow-hidden",
        "p-4",
        "md:p-5",
        "surface-card-hover",
        paper.highlight
            ? "border-accent/25 dark:border-accent/30"
            : "",
        highlighted
            ? "ring-2 ring-accent/35 ring-offset-2 ring-offset-cream-100 dark:ring-offset-ink-900"
            : "",
    ]
        .filter(Boolean)
        .join(" ");
</script>

<svelte:window on:keydown={(e) => e.key === "Escape" && closeLightbox()} />

<article id={paper.id} class="group relative">
    <div class={surfaceClasses}>
        {#if paper.highlight}
            <div
                class="absolute inset-y-0 left-0 w-[3px] origin-bottom scale-y-0 bg-accent transition-transform duration-300 ease-out group-hover:scale-y-100"
            ></div>
        {/if}

        <div
            class={`flex flex-col gap-4 ${paper.image ? "md:flex-row md:items-start md:gap-5" : ""}`}
        >
            <div class="min-w-0 flex-1">
                <div class="mb-2 flex flex-wrap items-center gap-2">
                    {#if paper.venue}
                        <span class="meta-label text-accent dark:text-accent-light">
                            {paper.venue}
                        </span>
                    {/if}

                    <span
                        class="rounded-full bg-cream-200 px-2.5 py-1 text-[0.72rem] font-medium text-ink-600 dark:bg-ink-700 dark:text-cream-300"
                    >
                        {paper.year}
                    </span>

                    {#if paper.preprint}
                        <span
                            class="rounded-full bg-accent/10 px-2.5 py-1 text-[0.72rem] font-medium text-accent dark:bg-accent/20 dark:text-accent-light"
                        >
                            preprint
                        </span>
                    {/if}
                </div>

                <h3
                    class={`text-balance font-semibold text-ink-900 dark:text-cream-100 ${isPreview ? "text-lg leading-snug" : "text-xl leading-snug"}`}
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

                <p
                    class={`mt-2 leading-relaxed text-ink-600 dark:text-cream-300 ${isPreview ? "text-sm" : "text-[0.95rem]"}`}
                >
                    {@html formatAuthors(paper.authors)}
                </p>

                {#if paper.awards.length > 0}
                    <div class="mt-3 flex flex-wrap gap-2">
                        {#each paper.awards as award}
                            <span
                                class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[0.72rem] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            >
                                <Award size={12} />
                                {award}
                            </span>
                        {/each}
                    </div>
                {/if}

                {#if paper.tldr && (isPreview || paper.highlight || paper.classProject)}
                    <p
                        class={`mt-3 text-ink-600 dark:text-cream-300 ${isPreview ? "text-sm leading-6" : "text-[0.95rem] leading-6"}`}
                    >
                        {paper.tldr}
                    </p>
                {/if}

                {#if !isPreview && paper.tags.length > 0}
                    <div class="mt-4 flex flex-wrap gap-2">
                        {#each paper.tags as tag}
                            <span
                                class="rounded-full bg-cream-200/80 px-2.5 py-1 text-[0.72rem] font-medium text-ink-500 dark:bg-ink-700 dark:text-cream-400"
                            >
                                {tag}
                            </span>
                        {/each}
                    </div>
                {/if}

                {#if hasLinks}
                    <div
                        class={`mt-4 flex flex-wrap gap-x-4 gap-y-2 ${isPreview ? "text-xs" : "text-sm"}`}
                    >
                        {#if paper.arxiv}
                            <a
                                href={paper.arxiv}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="link-subtle inline-flex items-center gap-1.5"
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
                                class="link-subtle inline-flex items-center gap-1.5"
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
                                class="link-subtle inline-flex items-center gap-1.5"
                            >
                                <Binary size={14} />
                                Code
                            </a>
                        {/if}

                        {#if paper.demo}
                            <a
                                href={paper.demo}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="link-subtle inline-flex items-center gap-1.5"
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
                                class="link-subtle inline-flex items-center gap-1.5"
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
                                class="link-subtle inline-flex items-center gap-1.5"
                            >
                                <PenLine size={14} />
                                Blog
                            </a>
                        {/if}
                    </div>
                {/if}
            </div>

            {#if paper.image}
                <div
                    class={`w-full md:flex-shrink-0 ${isPreview ? "md:w-36" : "md:w-44"}`}
                >
                    <button
                        type="button"
                        on:click={openLightbox}
                        on:mouseenter={() => (isHovered = true)}
                        on:mouseleave={() => (isHovered = false)}
                        class={`relative block aspect-[4/3] w-full overflow-hidden rounded-lg border border-ink-200/80 bg-cream-100 transition-transform duration-300 hover:scale-[1.01] dark:border-ink-700 dark:bg-ink-900 ${isPreview ? "md:mt-1" : ""}`}
                        aria-label={`Open image for ${paper.title}`}
                    >
                        <img
                            src={paper.image}
                            alt={`${paper.title} preview`}
                            class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
                            class:opacity-0={isHovered && Boolean(paper.imageAnimated)}
                            loading="lazy"
                        />

                        {#if paper.imageAnimated}
                            {#if isVideo}
                                <!-- svelte-ignore a11y-media-has-caption -->
                                <video
                                    src={paper.imageAnimated}
                                    class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
                                    class:opacity-0={!isHovered}
                                    autoplay
                                    loop
                                    muted
                                    playsinline
                                ></video>
                            {:else}
                                <img
                                    src={paper.imageAnimated}
                                    alt={`${paper.title} animated preview`}
                                    class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
                                    class:opacity-0={!isHovered}
                                    loading="lazy"
                                />
                            {/if}
                        {/if}

                        {#if paper.imageAnimated}
                            <div
                                class="absolute bottom-3 right-3 rounded-full bg-ink-900/75 p-1.5 text-cream-100 transition-opacity duration-300"
                                class:opacity-0={isHovered}
                            >
                                <Play size={12} />
                            </div>
                        {/if}
                    </button>
                </div>
            {/if}
        </div>
    </div>
</article>

{#if lightboxOpen && paper.image && browser}
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div class="lightbox-portal" use:portal>
        <div
            class="fixed inset-0 z-[9999] flex items-center justify-center bg-ink-900/95 p-4"
            on:click={closeLightbox}
            on:keydown={(e) => e.key === "Escape" && closeLightbox()}
            role="dialog"
            aria-modal="true"
            aria-label="Image lightbox"
            tabindex="-1"
        >
            <button
                type="button"
                class="absolute right-4 top-4 z-10 text-cream-100 transition-colors hover:text-cream-300"
                on:click|stopPropagation={closeLightbox}
                aria-label="Close lightbox"
            >
                <X size={32} />
            </button>

            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
                class="flex max-h-[80vh] max-w-3xl flex-col items-center"
                on:click|stopPropagation={() => {}}
                on:keydown|stopPropagation={() => {}}
            >
                {#if showAnimated && paper.imageAnimated}
                    {#if isVideo}
                        <!-- svelte-ignore a11y-media-has-caption -->
                        <video
                            src={paper.imageAnimated}
                            class="max-h-[70vh] max-w-full rounded-2xl object-contain"
                            autoplay
                            loop
                            muted
                            playsinline
                            controls
                        ></video>
                    {:else}
                        <img
                            src={paper.imageAnimated}
                            alt={`${paper.title} animated diagram`}
                            class="max-h-[70vh] max-w-full rounded-2xl object-contain"
                        />
                    {/if}
                {:else}
                    <img
                        src={paper.image}
                        alt={`${paper.title} diagram`}
                        class="max-h-[70vh] max-w-full rounded-2xl object-contain"
                    />
                {/if}

                {#if paper.imageAnimated}
                    <button
                        type="button"
                        class="mt-4 inline-flex items-center gap-2 rounded-full bg-ink-700 px-4 py-2 text-sm font-medium text-cream-100 transition-colors hover:bg-ink-600"
                        on:click|stopPropagation={toggleAnimated}
                    >
                        {#if showAnimated}
                            <Pause size={16} />
                            Show Static
                        {:else}
                            <Play size={16} />
                            Show Animated
                        {/if}
                    </button>
                {/if}

                <div class="mt-4 max-w-xl text-center text-sm text-cream-300">
                    <p class="mb-1 font-medium text-cream-100">{paper.title}</p>
                    {#if paper.imageDescription}
                        <p>{paper.imageDescription}</p>
                    {/if}
                </div>
            </div>
        </div>
    </div>
{/if}
