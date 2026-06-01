<script lang="ts">
    import { onMount, tick } from "svelte";
    import { browser } from "$app/environment";
    import Seo from "$lib/components/Seo.svelte";
    import { aboutData } from "$lib/content";
    import { parseInline, escapeHtml } from "$lib/utils/text";

    // Track which footnotes should be visible based on their markers
    let visibleFootnotes: Set<number> = new Set();
    let observer: IntersectionObserver | null = null;

    // Live "now" data (Manifold + Goodreads) from the /api/now endpoint.
    interface ReadingBook {
        title: string;
        author: string | null;
        url: string | null;
    }
    interface Manifold {
        netWorth: number;
        rank: number | null;
        market: { question: string; url: string } | null;
        profileUrl: string;
    }
    let manifoldNow: Manifold | null = null;
    let readingNow: ReadingBook[] | null = null;

    // 302847 -> "Ṁ303k", 840 -> "Ṁ840"
    function mana(n: number): string {
        const a = Math.abs(Math.round(n));
        return a >= 1000 ? `Ṁ${Math.round(a / 1000)}k` : `Ṁ${a}`;
    }
    async function loadNow() {
        try {
            const res = await fetch("/api/now");
            if (res.ok) {
                const data = await res.json();
                manifoldNow = data.manifold ?? null;
                readingNow = data.reading ?? null;
            }
        } catch {
            // Network/API hiccup — footnote 7 keeps its static fallback and
            // the "currently reading" line simply doesn't render.
        }
    }

    // Footnote 7's HTML: live Manifold standing when available, else the
    // static YAML fallback. Built as a string so both footnote render sites
    // (sidebar + mobile) can share it via {@html}.
    $: fn7Html = (() => {
        const m = manifoldNow;
        if (!m) {
            const f = aboutData.footnotes.find((x) => x.id === 7);
            return f ? escapeHtml(f.content) : "";
        }
        const market = m.market
            ? `<a href="${escapeHtml(m.market.url)}" target="_blank" rel="noopener noreferrer" class="link">${escapeHtml(m.market.question)}</a>`
            : "AI model releases";
        const standing =
            m.rank != null
                ? `currently <span class="fn-stat">#${m.rank}</span> in the world with a <span class="fn-stat">${mana(m.netWorth)}</span> net worth`
                : `a <span class="fn-stat">${mana(m.netWorth)}</span> net worth`;
        return `I run a monthly ${market} market on Manifold — ${standing}.`;
    })();

    onMount(() => {
        if (!browser) return;

        loadNow();

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

    // Parse markdown-style links, emphasis, and footnote markers in about-page text.
    const parseLinks = (text: string) =>
        parseInline(text, {
            italic: true,
            footnotes: true,
            strongClass: "text-ink-900 dark:text-cream-100",
        });
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
        class="hidden xl:block fixed right-8 top-24 w-56 z-10"
    >
        <div>
            {#each aboutData.footnotes as footnote (footnote.id)}
                <div
                    class="fn-collapse"
                    class:fn-open={visibleFootnotes.has(footnote.id)}
                    id="fn-{footnote.id}"
                >
                    <div
                        class="fn-inner footnote-item text-xs text-ink-500 dark:text-ink-400 leading-relaxed"
                    >
                        <span class="font-medium text-accent-dark dark:text-accent-light"
                            >{footnote.id}.</span
                        >
                        {#if footnote.id === 7}{@html fn7Html}{:else}{footnote.content}{/if}
                    </div>
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
                <h2 class="section-heading">professionally speaking...</h2>

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

            </div>
        </section>

        <!-- Personal Section -->
        <section class="mb-12">
            <h2 class="section-heading">personally speaking...</h2>

            <div
                class="prose prose-lg text-ink-700 dark:text-cream-300 space-y-4"
            >
                {#each aboutData.personal.descriptions as description}
                    <p>
                        {@html parseLinks(description)}
                    </p>
                {/each}

                <!-- Live "currently reading" from Goodreads (via /api/now),
                     rendered as a normal full-size paragraph. -->
                {#if readingNow && readingNow.length > 0}
                    <p>
                        Currently reading {#each readingNow as b, i}{#if i > 0}{i === readingNow.length - 1 ? " and " : ", "}{/if}{#if b.url}<a
                                    href={b.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="link">{b.title}</a
                                >{:else}{b.title}{/if}{/each}.
                    </p>
                {/if}

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

                <p class="text-ink-500 dark:text-ink-400">
                    p.s. take a peek at your devtools console — you may find
                    some fun hidden games. :)
                </p>
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
                        <li>{@html parseLinks(thought)}</li>
                    {/each}
                </ul>
            </div>
        </section>

        <!-- Mobile footnotes (shown at bottom) -->
        <div class="lg:hidden mt-12 pt-8">
            <h3 class="section-heading text-sm">footnotes</h3>
            <div class="space-y-4">
                {#each aboutData.footnotes as footnote}
                    <div
                        class="text-xs text-ink-500 dark:text-ink-400 leading-relaxed"
                    >
                        <span class="font-medium text-accent-dark dark:text-accent-light"
                            >{footnote.id}.</span
                        >
                        {#if footnote.id === 7}{@html fn7Html}{:else}{footnote.content}{/if}
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
        text-decoration: none;
        transition: color 0.2s;
    }

    :global(.footnote-ref:hover) {
        color: theme("colors.accent.dark");
    }

    /* Live figures inside footnote 7 (injected via @html). */
    :global(.fn-stat) {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
        letter-spacing: -0.01em;
        color: theme("colors.accent.DEFAULT");
    }

    /* Smoothly collapse/expand footnotes as their markers scroll in and out,
       so the visible ones reflow to fill the gap. Animating grid-template-rows
       (0fr -> 1fr) keeps every item — and its #fn-N anchor id — in the DOM,
       unlike add/remove transitions. */
    .fn-collapse {
        display: grid;
        grid-template-rows: 0fr;
        opacity: 0;
        margin-bottom: 0;
        pointer-events: none;
        transition:
            grid-template-rows 0.3s cubic-bezier(0.22, 1, 0.36, 1),
            opacity 0.3s ease,
            margin-bottom 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .fn-collapse.fn-open {
        grid-template-rows: 1fr;
        opacity: 1;
        margin-bottom: 1rem;
        pointer-events: auto;
    }
    .fn-inner {
        overflow: hidden;
        min-height: 0;
    }
    @media (prefers-reduced-motion: reduce) {
        .fn-collapse {
            transition: opacity 0.2s ease;
        }
    }

    .footnote-item {
        padding-left: 0;
    }

    /* The Manifold footnote pair [6][7]: hovering either one makes them
       see-saw — one rises while the other dips, then they swap. */
    :global(.footnote-ref[data-footnote="6"]),
    :global(.footnote-ref[data-footnote="7"]) {
        display: inline-block;
    }
    :global(.footnote-ref[data-footnote="6"]:hover),
    :global(
            .footnote-ref[data-footnote="6"]:has(
                    + .footnote-ref[data-footnote="7"]:hover
                )
        ) {
        animation: fn-seesaw 0.65s ease-in-out infinite;
    }
    :global(.footnote-ref[data-footnote="7"]:hover),
    :global(
            .footnote-ref[data-footnote="6"]:hover
                + .footnote-ref[data-footnote="7"]
        ) {
        animation: fn-seesaw 0.65s ease-in-out infinite reverse;
    }
    /* -global- so the name survives Svelte's keyframe hashing — the
       animation is referenced from :global() selectors above. */
    @keyframes -global-fn-seesaw {
        0%,
        100% {
            transform: translateY(0);
        }
        25% {
            transform: translateY(-3px);
        }
        75% {
            transform: translateY(3px);
        }
    }
    @media (prefers-reduced-motion: reduce) {
        :global(.footnote-ref[data-footnote="6"]),
        :global(.footnote-ref[data-footnote="7"]) {
            animation: none !important;
        }
    }
</style>
