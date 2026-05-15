<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { Twitter, Pause } from "lucide-svelte";
    import { Binary, Award, PenLine, X, Play, ChevronsUpDown, ChevronsDownUp, CircleArrowOutUpRight } from "@jis3r/icons";
    import FileText from "$lib/components/icons/FileText.svelte";

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
    let tldrOpen = false;
    let authorsExpanded = false;
    let authorsEl: HTMLElement | null = null;
    let isAuthorsOverflowing = false;
    let visibleCharCount = 0;

    function expandAuthors() {
        if (customCollapse) {
            visibleCharCount =
                paper.authors[0].length + 2 + paper.authors[1].length;
        } else if (authorsEl && authorsEl.scrollWidth > 0) {
            const ratio = authorsEl.clientWidth / authorsEl.scrollWidth;
            visibleCharCount = Math.max(0, Math.floor(authorChars.length * ratio) - 2);
        } else {
            visibleCharCount = 0;
        }
        authorsExpanded = true;
    }

    $: atreyIdx = paper.authors.findIndex((a) => a.includes("Atrey Desai"));
    $: customCollapse = atreyIdx > 1;
    $: collapsedAuthorList = customCollapse
        ? [
              paper.authors[0],
              paper.authors[1],
              "...",
              paper.authors[atreyIdx],
              ...(atreyIdx < paper.authors.length - 1 ? ["..."] : []),
          ]
        : paper.authors;
    $: hasHiddenAuthors = customCollapse || isAuthorsOverflowing;
    let triggerElement: HTMLElement | null = null;
    let dialogElement: HTMLElement | null = null;

    function checkAuthorsOverflow() {
        if (authorsEl) {
            isAuthorsOverflowing = authorsEl.scrollWidth > authorsEl.clientWidth + 1;
        }
    }

    $: authorChars = (() => {
        const out: { c: string; bold: boolean }[] = [];
        paper.authors.forEach((author, idx) => {
            const bold = author.includes("Atrey Desai");
            for (const ch of author) out.push({ c: ch, bold });
            if (idx < paper.authors.length - 1) {
                out.push({ c: ",", bold: false });
                out.push({ c: " ", bold: false });
            }
        });
        return out;
    })();

    $: authorGroups = (() => {
        const groups: { kind: "name" | "sep"; chars: { c: string; bold: boolean; i: number }[] }[] = [];
        let i = 0;
        paper.authors.forEach((author, idx) => {
            const bold = author.includes("Atrey Desai");
            const chars: { c: string; bold: boolean; i: number }[] = [];
            for (const ch of author) chars.push({ c: ch, bold, i: i++ });
            groups.push({ kind: "name", chars });
            if (idx < paper.authors.length - 1) {
                groups.push({
                    kind: "sep",
                    chars: [
                        { c: ",", bold: false, i: i++ },
                        { c: " ", bold: false, i: i++ },
                    ],
                });
            }
        });
        return groups;
    })();

    // Per-link hover states for icon animation triggering
    let hoveredLink: string | null = null;

    onMount(() => {
        checkAuthorsOverflow();
        window.addEventListener("resize", checkAuthorsOverflow);
        return () => {
            window.removeEventListener("resize", checkAuthorsOverflow);
            if (typeof document !== "undefined") {
                document.body.style.overflow = "";
            }
        };
    });

    function openLightbox(trigger: HTMLElement) {
        if (!paper.image) return;

        lightboxOpen = true;
        showAnimated = false;
        triggerElement = trigger;

        if (typeof document !== "undefined") {
            document.body.style.overflow = "hidden";
        }

        setTimeout(() => dialogElement?.focus(), 0);
    }

    function closeLightbox() {
        lightboxOpen = false;
        showAnimated = false;

        if (typeof document !== "undefined") {
            document.body.style.overflow = "";
        }

        triggerElement?.focus();
        triggerElement = null;
    }

    function trapFocus(e: KeyboardEvent) {
        if (!dialogElement) return;
        const focusable = Array.from(
            dialogElement.querySelectorAll<HTMLElement>(
                'button, [href], input, [tabindex]:not([tabindex="-1"])'
            )
        ).filter(el => !el.hasAttribute('disabled'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.key === "Tab") {
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        }
    }

    function toggleAnimated() {
        showAnimated = !showAnimated;
    }

    function formatAuthors(authors: string[]): string {
        return authors
            .map((author) => {
                if (author === "...") return "…";
                return author.includes("Atrey Desai")
                    ? `<strong class="text-ink-900 dark:text-cream-100">${author}</strong>`
                    : author;
            })
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
        "!rounded",
        "overflow-hidden",
        "p-4",
        "md:p-5",
        "surface-card-hover",
        "border-transparent",
        paper.highlight ? "border-transparent" : "",
        highlighted
            ? "ring-2 ring-accent/35 ring-offset-2 ring-offset-cream-100 dark:ring-offset-ink-900"
            : "",
    ]
        .filter(Boolean)
        .join(" ");
</script>

<svelte:window on:keydown={(e) => e.key === "Escape" && closeLightbox()} />

<article id={paper.id} class="group relative" style="scroll-margin-top: 80px">
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

                <div class="mt-2 min-w-0">
                    {#if authorsExpanded && hasHiddenAuthors}
                        <p
                            class={`leading-snug text-ink-600 dark:text-cream-300 ${isPreview ? "text-sm" : "text-[0.95rem]"}`}
                        >
                            {#each authorGroups as group}
                                {#if group.kind === "name"}
                                    <span class="inline-block whitespace-nowrap align-baseline">
                                        {#each group.chars as item}
                                            <span
                                                class="{item.i < visibleCharCount ? '' : 'char-reveal'} {item.bold ? 'font-semibold text-ink-900 dark:text-cream-100' : ''}"
                                                style="animation-delay: {(item.i - visibleCharCount) * 8}ms"
                                            >{item.c}</span>
                                        {/each}
                                    </span>
                                {:else}
                                    {#each group.chars as item}
                                        <span
                                            class={item.i < visibleCharCount ? '' : 'char-reveal'}
                                            style="animation-delay: {(item.i - visibleCharCount) * 8}ms"
                                        >{item.c === " " ? " " : item.c}</span>
                                    {/each}
                                {/if}
                            {/each}
                        </p>
                    {:else if hasHiddenAuthors}
                        <button
                            type="button"
                            on:click={expandAuthors}
                            class="block w-full overflow-hidden text-left"
                            aria-expanded={authorsExpanded}
                        >
                            <p
                                bind:this={authorsEl}
                                class={`truncate leading-snug text-ink-600 dark:text-cream-300 ${isPreview ? "text-sm" : "text-[0.95rem]"}`}
                            >
                                {@html formatAuthors(collapsedAuthorList)}
                            </p>
                        </button>
                    {:else}
                        <p
                            bind:this={authorsEl}
                            class={`truncate leading-snug text-ink-600 dark:text-cream-300 ${isPreview ? "text-sm" : "text-[0.95rem]"}`}
                        >
                            {@html formatAuthors(paper.authors)}
                        </p>
                    {/if}
                </div>

                {#if paper.venue || paper.awards.length > 0 || paper.preprint}
                    <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        {#if paper.venue}
                            <span class="font-serif italic text-ink-500 dark:text-cream-400 {isPreview ? 'text-sm' : 'text-[0.95rem]'}">
                                {paper.venue}{paper.year ? `, ${paper.year}` : ""}
                            </span>
                        {/if}
                        {#if paper.preprint}
                            <span class="pill text-accent dark:text-accent-light">preprint</span>
                        {/if}
                        {#each paper.awards as award, i}
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <span
                                class="pill text-ochre-dark dark:text-ochre-light"
                                on:mouseenter={() => (hoveredLink = `award-${i}`)}
                                on:mouseleave={() => (hoveredLink = null)}
                            >
                                <Award size={12} animate={hoveredLink === `award-${i}`} />
                                {award}
                            </span>
                        {/each}
                    </div>
                {/if}

                {#if hasLinks || paper.tldr}
                    <div
                        class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs"
                    >
                        {#if paper.tldr}
                            <button
                                type="button"
                                on:click={() => (tldrOpen = !tldrOpen)}
                                on:mouseenter={() => (hoveredLink = 'tldr')}
                                on:mouseleave={() => (hoveredLink = null)}
                                class="link-subtle inline-flex items-center gap-1.5"
                                aria-expanded={tldrOpen}
                            >
                                {#if tldrOpen}
                                    <ChevronsDownUp size={14} animate={hoveredLink === 'tldr'} />
                                {:else}
                                    <ChevronsUpDown size={14} animate={hoveredLink === 'tldr'} />
                                {/if}
                                tldr
                            </button>
                        {/if}
                        {#if paper.arxiv}
                            <a
                                href={paper.arxiv}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="link-subtle inline-flex items-center gap-1.5"
                                on:mouseenter={() => (hoveredLink = 'arxiv')}
                                on:mouseleave={() => (hoveredLink = null)}
                            >
                                <CircleArrowOutUpRight size={14} animate={hoveredLink === 'arxiv'} />
                                arxiv
                            </a>
                        {/if}

                        {#if paper.pdf}
                            <a
                                href={paper.pdf}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="link-subtle inline-flex items-center gap-1.5"
                                on:mouseenter={() => (hoveredLink = 'pdf')}
                                on:mouseleave={() => (hoveredLink = null)}
                            >
                                <FileText size={14} animate={hoveredLink === 'pdf'} />
                                pdf
                            </a>
                        {/if}

                        {#if paper.code}
                            <a
                                href={paper.code}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="link-subtle inline-flex items-center gap-1.5"
                                on:mouseenter={() => (hoveredLink = 'code')}
                                on:mouseleave={() => (hoveredLink = null)}
                            >
                                <Binary size={14} animate={hoveredLink === 'code'} />
                                code
                            </a>
                        {/if}

                        {#if paper.demo}
                            <a
                                href={paper.demo}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="link-subtle inline-flex items-center gap-1.5"
                                on:mouseenter={() => (hoveredLink = 'demo')}
                                on:mouseleave={() => (hoveredLink = null)}
                            >
                                <CircleArrowOutUpRight size={14} animate={hoveredLink === 'demo'} />
                                demo
                            </a>
                        {/if}

                        {#if paper.twitter}
                            <a
                                href={paper.twitter}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="link-subtle inline-flex items-center gap-1.5"
                                on:mouseenter={() => (hoveredLink = 'twitter')}
                                on:mouseleave={() => (hoveredLink = null)}
                            >
                                <Twitter size={14} />
                                twitter
                            </a>
                        {/if}

                        {#if paper.blog}
                            <a
                                href={paper.blog}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="link-subtle inline-flex items-center gap-1.5"
                                on:mouseenter={() => (hoveredLink = 'blog')}
                                on:mouseleave={() => (hoveredLink = null)}
                            >
                                <PenLine size={14} animate={hoveredLink === 'blog'} />
                                blog
                            </a>
                        {/if}
                    </div>
                {/if}

                {#if paper.tldr && tldrOpen}
                    <p
                        class={`mt-2 text-ink-600 dark:text-cream-300 ${isPreview ? "text-sm leading-6" : "text-[0.95rem] leading-6"}`}
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

            {#if paper.image}
                <div
                    class={`w-full md:flex-shrink-0 ${isPreview ? "md:w-24" : "md:w-32"}`}
                >
                    <button
                        type="button"
                        on:click={(e) => openLightbox(e.currentTarget)}
                        on:mouseenter={() => (isHovered = true)}
                        on:mouseleave={() => (isHovered = false)}
                        class={`relative block aspect-square w-full overflow-hidden rounded-lg border border-ink-200/80 bg-cream-100 transition-transform duration-300 hover:scale-[1.01] dark:border-ink-700 dark:bg-ink-900 ${isPreview ? "md:mt-1" : ""}`}
                        aria-label={`Open image for ${paper.title}`}
                    >
                        <picture>
                            <source
                                srcset={paper.image.replace(/\.(png|jpe?g)$/i, ".webp")}
                                type="image/webp"
                            />
                            <img
                                src={paper.image}
                                alt={`${paper.title} preview`}
                                width="800"
                                height="600"
                                class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
                                class:opacity-0={isHovered &&
                                    Boolean(paper.imageAnimated)}
                                loading="lazy"
                                decoding="async"
                            />
                        </picture>

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
            bind:this={dialogElement}
            class="fixed inset-0 z-[9999] flex items-center justify-center bg-ink-900/95 p-4"
            on:click={closeLightbox}
            on:keydown={(e) => { trapFocus(e); if (e.key === "Escape") closeLightbox(); }}
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

<style>
    .char-reveal {
        display: inline;
        opacity: 0;
        animation: charReveal 110ms ease-out forwards;
    }
    @keyframes charReveal {
        from { opacity: 0; }
        to { opacity: 1; }
    }
</style>
