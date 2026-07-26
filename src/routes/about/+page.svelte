<script lang="ts">
    import { onMount, tick } from "svelte";
    import { browser } from "$app/environment";
    import Seo from "$lib/components/Seo.svelte";
    import { aboutData } from "$lib/content";
    import { parseInline, escapeHtml } from "$lib/utils/text";

    // Sidenote layout: each footnote floats in the right margin beside its
    // marker, faint until you hover the note or the marker.
    let containerEl: HTMLElement;
    let noteTops: Record<number, number> = {};
    let notesReady = false;
    let hovered: number | null = null;
    let layoutRaf = 0;

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
            // Network/API hiccup: footnote 7 keeps its static fallback and
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
        return `I run a monthly ${market} market on Manifold, ${standing}.`;
    })();

    // Place each sidenote level with its marker, then push notes down just
    // enough that none overlap (classic Tufte-style margin note stacking).
    function layoutNotes() {
        if (!containerEl) return;
        if (!window.matchMedia("(min-width: 1280px)").matches) return;

        const containerTop =
            containerEl.getBoundingClientRect().top + window.scrollY;
        const entries = aboutData.footnotes
            .map((fn) => {
                const marker = document.querySelector(
                    `[data-footnote="${fn.id}"]`,
                );
                const note = document.getElementById(`fn-${fn.id}`);
                if (!marker || !note) return null;
                return {
                    id: fn.id,
                    markerTop:
                        marker.getBoundingClientRect().top +
                        window.scrollY -
                        containerTop,
                    height: note.offsetHeight,
                };
            })
            .filter((e): e is NonNullable<typeof e> => e !== null)
            .sort((a, b) => a.markerTop - b.markerTop);

        const tops: Record<number, number> = {};
        let prevBottom = 0;
        for (const e of entries) {
            const top = Math.max(e.markerTop, prevBottom);
            tops[e.id] = top;
            prevBottom = top + e.height + 16;
        }
        noteTops = tops;
        if (!notesReady) {
            // Let the computed tops paint before fading the notes in, so the
            // (transitioned) `top` doesn't animate from its initial 0.
            requestAnimationFrame(() => (notesReady = true));
        }
    }

    function scheduleLayout() {
        if (!browser) return;
        cancelAnimationFrame(layoutRaf);
        layoutRaf = requestAnimationFrame(layoutNotes);
    }

    onMount(() => {
        loadNow();

        // Small delay to ensure all dynamic content is rendered (including
        // from parseLinks), then position the sidenotes.
        setTimeout(() => {
            layoutNotes();

            // Hovering a marker brightens its note (the note's own hover is
            // handled in the template; markers come from @html, so listen here).
            document.querySelectorAll("[data-footnote]").forEach((marker) => {
                const id = parseInt(
                    marker.getAttribute("data-footnote") || "0",
                );
                marker.addEventListener("mouseenter", () => (hovered = id));
                marker.addEventListener("mouseleave", () => (hovered = null));
            });
        }, 100);

        // Re-measure when fonts land or the column reflows.
        document.fonts?.ready.then(scheduleLayout);
        const ro = new ResizeObserver(scheduleLayout);
        ro.observe(containerEl);
        window.addEventListener("resize", scheduleLayout);

        return () => {
            ro.disconnect();
            window.removeEventListener("resize", scheduleLayout);
            cancelAnimationFrame(layoutRaf);
        };
    });

    // Hovering a sidenote highlights its marker in the text (markers are
    // injected via @html, so toggle the class imperatively).
    $: if (browser) {
        document
            .querySelectorAll(".footnote-ref.fn-hot")
            .forEach((el) => el.classList.remove("fn-hot"));
        if (hovered != null) {
            document
                .querySelectorAll(`[data-footnote="${hovered}"]`)
                .forEach((el) => el.classList.add("fn-hot"));
        }
    }

    // Footnote 7's content swaps in live data after load: re-stack since
    // its height may change.
    $: if (browser && fn7Html) tick().then(scheduleLayout);

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
    url="https://atreydesai.com/about/"
/>

<!-- Centered layout container with footnotes on the side -->
<div class="relative" bind:this={containerEl}>
    <!-- Sidenotes (desktop only): each note sits in the right margin beside
         its marker, faint until hovered. -->
    <aside class="hidden xl:block absolute inset-y-0 right-8 w-56 z-10">
        <div class="relative h-full">
            {#each aboutData.footnotes as footnote (footnote.id)}
                <!-- svelte-ignore a11y-no-static-element-interactions -->
                <div
                    class="sidenote footnote-item text-xs text-ink-500 dark:text-ink-400 leading-relaxed"
                    class:fn-ready={notesReady}
                    class:fn-active={hovered === footnote.id}
                    style="top: {noteTops[footnote.id] ?? 0}px"
                    id="fn-{footnote.id}"
                    on:mouseenter={() => (hovered = footnote.id)}
                    on:mouseleave={() => (hovered = null)}
                >
                    <span class="font-medium text-accent-dark dark:text-accent-light"
                        >{footnote.id}.</span
                    >
                    {#if footnote.id === 7}{@html fn7Html}{:else}{footnote.content}{/if}
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
                                :
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
            <h2 class="section-heading">thoughts floating around in my head</h2>

            <div class="text-ink-700 dark:text-cream-300 space-y-4">
                <ul class="list-disc list-inside space-y-2">
                    {#each aboutData.thoughts as thought}
                        <li>{@html parseLinks(thought)}</li>
                    {/each}
                </ul>
            </div>
        </section>

        <!-- Mobile footnotes (shown at bottom wherever the sidenotes aren't) -->
        <div class="xl:hidden mt-12 pt-8">
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
        font-family: var(--font-mono);
        letter-spacing: -0.01em;
        color: theme("colors.accent.DEFAULT");
    }

    /* Margin sidenotes: absolutely positioned level with their markers
       (stacked apart when they'd overlap), faint until hovered: either the
       note itself or its marker in the text. Hidden until first layout so
       they don't flash at top: 0. */
    .sidenote {
        position: absolute;
        left: 0;
        right: 0;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    .sidenote.fn-ready {
        opacity: 0.45;
        transition:
            opacity 0.3s ease,
            top 0.3s cubic-bezier(0.22, 1, 0.36, 1);
    }
    .sidenote.fn-ready:hover,
    .sidenote.fn-ready.fn-active {
        opacity: 1;
    }

    /* Marker echo: while its sidenote is hovered, the in-text marker warms. */
    :global(.footnote-ref.fn-hot) {
        color: theme("colors.accent.dark");
    }

    .footnote-item {
        padding-left: 0;
    }

    /* The Manifold footnote pair [6][7]: hovering either one makes them
       see-saw: one rises while the other dips, then they swap. */
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
    /* -global- so the name survives Svelte's keyframe hashing: the
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
