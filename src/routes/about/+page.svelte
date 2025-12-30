<script lang="ts">
    import { onMount, tick } from "svelte";
    import { browser } from "$app/environment";
    import Seo from "$lib/components/Seo.svelte";
    import { aboutData } from "$lib/content";
    import Markdown from "$lib/components/Markdown.svelte";

    // Track which footnotes should be visible based on their markers
    let visibleFootnotes: Set<number> = new Set();
    let observer: IntersectionObserver | null = null;

    onMount(() => {
        if (!browser) return;

        // Small delay to ensure all dynamic content is rendered (including from parseLinks)
        setTimeout(() => {
            // Find all footnote markers and observe them
            const markers = document.querySelectorAll("[data-footnote]");

            observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        const id = parseInt(
                            entry.target.getAttribute("data-footnote") || "0",
                        );
                        if (entry.isIntersecting) {
                            visibleFootnotes.add(id);
                        } else {
                            // Hide when not intersecting (scrolled past or above)
                            visibleFootnotes.delete(id);
                        }
                        visibleFootnotes = visibleFootnotes; // Trigger reactivity
                    });
                },
                {
                    threshold: 0,
                    rootMargin: "-64px 0px -40% 0px", // Account for header, track middle of viewport
                },
            );

            markers.forEach((marker) => observer?.observe(marker));
        }, 100);

        return () => observer?.disconnect();
    });

    // Helper to parse markdown-style links and footnotes in text
    function parseLinks(text: string): string {
        // Convert **text** to <strong>text</strong>
        text = text.replace(
            /\*\*([^*]+)\*\*/g,
            '<strong class="text-ink-900 dark:text-cream-100">$1</strong>',
        );
        // Convert *text* to <span class="emphasized">text</span>
        text = text.replace(
            /\*([^*]+)\*/g,
            '<span class="text-ink-900 dark:text-cream-100">$1</span>',
        );
        // Convert [text](url) to <a href="url" class="link">text</a>
        text = text.replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer" class="link">$1</a>',
        );
        // Convert [^N] to footnote markers
        text = text.replace(
            /\[\^(\d+)\]/g,
            '<sup class="footnote-ref" data-footnote="$1">[$1]</sup>',
        );
        return text;
    }
</script>

<Seo
    title="About | Atrey Desai"
    description="Learn about Atrey Desai - CS & Linguistics student at University of Maryland, researching NLP at CLIP Lab under Prof. Rudinger and Prof. Boyd-Graber."
    url="https://atreydesai.com/about"
/>

<!-- Centered layout container with footnotes on the side -->
<div class="relative">
    <!-- Footnotes Sidebar (desktop only) - positioned absolutely on the right -->
    <aside
        class="hidden lg:block fixed right-4 xl:right-8 top-24 w-48 xl:w-56 z-10"
    >
        <div class="space-y-4">
            {#each aboutData.footnotes as footnote}
                <div
                    class="footnote-item text-xs text-ink-500 dark:text-ink-400 leading-relaxed transition-all duration-300"
                    class:opacity-100={visibleFootnotes.has(footnote.id)}
                    class:opacity-0={!visibleFootnotes.has(footnote.id)}
                    class:translate-y-0={visibleFootnotes.has(footnote.id)}
                    class:translate-y-2={!visibleFootnotes.has(footnote.id)}
                    class:pointer-events-auto={visibleFootnotes.has(
                        footnote.id,
                    )}
                    class:pointer-events-none={!visibleFootnotes.has(
                        footnote.id,
                    )}
                    id="fn-{footnote.id}"
                >
                    <span class="font-medium text-accent">{footnote.id}.</span>
                    {footnote.content}
                </div>
            {/each}
        </div>
    </aside>

    <!-- Main content - centered like other pages -->
    <div class="layout-main py-8 md:py-12">
        <!-- Professional Section -->
        <section class="mb-12">
            <h1
                class="heading-display text-3xl text-ink-900 dark:text-cream-100 mb-6"
            >
                who am i?
            </h1>

            <div
                class="prose prose-lg text-ink-700 dark:text-cream-300 space-y-4"
            >
                <p class="text-serif text-xl">
                    <em>professionally speaking...</em>
                </p>

                <p>
                    {@html parseLinks(aboutData.professional.intro)}
                </p>

                {#each aboutData.professional.paragraphs as paragraph}
                    <p>
                        {@html parseLinks(
                            paragraph.text,
                        )}{#if paragraph.footnote}<sup
                                class="footnote-ref"
                                data-footnote={paragraph.footnote}
                                >[{paragraph.footnote}]</sup
                            >{/if}
                    </p>
                {/each}

                <p>
                    {@html parseLinks(
                        aboutData.professional.researchInterests.intro,
                    )}
                </p>
                <ol class="list-decimal list-inside space-y-1 ml-4">
                    {#each aboutData.professional.researchInterests.items as item}
                        <li>{@html parseLinks(item)}</li>
                    {/each}
                </ol>
            </div>
        </section>

        <hr class="border-dotted border-ink-200 dark:border-ink-700 my-8" />

        <!-- Personal Section -->
        <section class="mb-12">
            <h2 class="section-heading">personally...</h2>

            <div
                class="prose prose-lg text-ink-700 dark:text-cream-300 space-y-4"
            >
                <p>
                    {@html parseLinks(aboutData.personal.description)}
                </p>

                <p>
                    <span class="text-ink-500 dark:text-ink-400"
                        >other interests:</span
                    >
                    {@html parseLinks(aboutData.personal.interests)}
                </p>

                {#if aboutData.personal.blogs.length > 0}
                    <p>
                        <span class="text-ink-500 dark:text-ink-400"
                            >blogs i like:</span
                        >
                        {#each aboutData.personal.blogs as blog, i}
                            <a
                                href={blog.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="link">{blog.name}</a
                            >{#if i < aboutData.personal.blogs.length - 1},
                            {/if}
                        {/each}
                    </p>
                {/if}
            </div>
        </section>

        <hr class="border-dotted border-ink-200 dark:border-ink-700 my-8" />

        <!-- Where are you from -->
        <section class="mb-12">
            <h2 class="section-heading">where are you from?</h2>

            <div class="text-ink-700 dark:text-cream-300">
                <p>
                    {@html parseLinks(aboutData.location.text)}
                </p>
            </div>
        </section>

        <hr class="border-dotted border-ink-200 dark:border-ink-700 my-8" />

        <!-- Why does this website look like this -->
        <section class="mb-12">
            <h2 class="section-heading">
                why does this website look like this?
            </h2>

            <div class="text-ink-700 dark:text-cream-300 space-y-4">
                <p>
                    <span class="text-ink-500 dark:text-ink-400"
                        >inspiration:</span
                    >
                    {aboutData.website.inspiration}
                </p>

                {#if aboutData.website.inspirationList.length > 0}
                    <ul class="space-y-2 text-sm">
                        {#each aboutData.website.inspirationList as site}
                            <li>
                                <a
                                    href={site.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="link font-medium">{site.name}</a
                                >
                                —
                                <span class="text-ink-500 dark:text-ink-400"
                                    >{site.description}</span
                                >
                            </li>
                        {/each}
                    </ul>
                {/if}

                <p>
                    <span class="text-ink-500 dark:text-ink-400"
                        >built with:</span
                    >
                    {@html parseLinks(aboutData.website.builtWith)}
                </p>
            </div>
        </section>

        <hr class="border-dotted border-ink-200 dark:border-ink-700 my-8" />

        <!-- Things I'm thinking about -->
        <section class="mb-12">
            <h2 class="section-heading">things i'm thinking about lately</h2>

            <div class="text-ink-700 dark:text-cream-300 space-y-4">
                <ul class="list-disc list-inside space-y-2">
                    {#each aboutData.thoughts as thought}
                        <li>{thought}</li>
                    {/each}
                </ul>
            </div>
        </section>

        <!-- Mobile footnotes (shown at bottom) -->
        <div
            class="lg:hidden mt-12 pt-8 border-t border-ink-200 dark:border-ink-700"
        >
            <h3 class="section-heading text-sm">footnotes</h3>
            <div class="space-y-4">
                {#each aboutData.footnotes as footnote}
                    <div
                        class="text-xs text-ink-500 dark:text-ink-400 leading-relaxed"
                    >
                        <span class="font-medium text-accent"
                            >{footnote.id}.</span
                        >
                        {footnote.content}
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    /* Use :global() for footnote styles since they're dynamically generated via @html */
    :global(.footnote-ref) {
        font-size: 0.75rem;
        line-height: 1;
        vertical-align: super;
        color: theme("colors.accent.DEFAULT");
        cursor: pointer;
        transition: color 0.2s;
    }

    :global(.footnote-ref:hover) {
        color: theme("colors.accent.dark");
    }

    .footnote-item {
        padding-left: 0.75rem;
        border-left: 2px solid theme("colors.accent.DEFAULT");
    }
</style>
