<script lang="ts">
    import { onMount, tick } from "svelte";
    import { browser } from "$app/environment";
    import Seo from "$lib/components/Seo.svelte";
    import { aboutData } from "$lib/content";
    import { parseInline, escapeHtml } from "$lib/utils/text";
    import type { ManifoldNow, ReadingNow } from "../api/now/+server";

    // Sidenote layout: each footnote floats in the right margin beside its
    // marker, faint until you hover the note or the marker.
    let containerEl: HTMLElement;
    let noteTops: Record<number, number> = {};
    let notesReady = false;
    let hovered: number | null = null;
    let layoutRaf = 0;

    // Matches the `xl:` breakpoint the two footnote renderings switch on.
    const SIDENOTE_QUERY = "(min-width: 1280px)";
    // Server-render and first paint assume the bottom list, which is the
    // rendering that exists without JS.
    let wideNotes = false;

    // Live "now" data (Manifold + Goodreads) from the /api/now endpoint.
    let manifoldNow: ManifoldNow | null = null;
    let readingNow: ReadingNow | null = null;

    // Footnotes whose text is replaced with live data from /api/now.
    const READING_FN = 4;
    const MANIFOLD_FN = 6;

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
            // Network/API hiccup: the Manifold footnote keeps its static
            // fallback and the "currently reading" line simply doesn't render.
        }
    }

    function fallbackHtml(id: number): string {
        const f = aboutData.footnotes.find((x) => x.id === id);
        return f ? escapeHtml(f.content) : "";
    }

    // "3 hours ago" under a day, "110 days ago" after.
    function sinceHtml(at: number): string {
        const hours = Math.floor(Math.max(0, Date.now() - at) / 3_600_000);
        if (hours < 1) return "less than an hour ago";
        const [n, unit] = hours < 24 ? [hours, "hour"] : [Math.floor(hours / 24), "day"];
        return `<span class="fn-stat">${n}</span> ${unit}${n === 1 ? "" : "s"} ago`;
    }

    $: readingBooks = readingNow?.books ?? [];

    // The reading footnote only exists alongside the live "currently reading"
    // line, so it's left out of both footnote lists when that line is.
    $: footnotes = aboutData.footnotes.filter(
        (f) => f.id !== READING_FN || readingBooks.length > 0,
    );

    // The reading footnote's HTML: how long since the last Goodreads progress.
    $: readingFnHtml = readingNow?.updatedAt
        ? `Though this may be outdated, my last progress update was ${sinceHtml(readingNow.updatedAt)}.`
        : fallbackHtml(READING_FN);

    // The Manifold footnote's HTML: live standing when available, else the
    // static YAML fallback. Built as a string so both footnote render sites
    // (sidebar + mobile) can share it via {@html}.
    $: manifoldFnHtml = (() => {
        const m = manifoldNow;
        if (!m) return fallbackHtml(MANIFOLD_FN);
        const market = m.market
            ? `<a href="${escapeHtml(m.market.url)}" target="_blank" rel="noopener noreferrer" class="link">${escapeHtml(m.market.question)}</a>`
            : "AI model releases";
        const standing =
            m.rank != null
                ? `currently <span class="fn-stat">#${m.rank}</span> in the world with a <span class="fn-stat">${mana(m.netWorth)}</span> net worth`
                : `a <span class="fn-stat">${mana(m.netWorth)}</span> net worth`;
        const b = m.bot;
        const bot = b
            ? " My bot " +
              (b.rank != null
                  ? `is currently <span class="fn-stat">#${b.rank}</span> in the world with a <span class="fn-stat">${mana(b.netWorth)}</span> net worth.`
                  : `has a <span class="fn-stat">${mana(b.netWorth)}</span> net worth.`)
            : "";
        return `I run a monthly ${market} market on Manifold, ${standing}.${bot}`;
    })();

    // Place each sidenote level with its marker, then push notes down just
    // enough that none overlap (classic Tufte-style margin note stacking).
    function layoutNotes() {
        if (!containerEl) return;
        if (!window.matchMedia(SIDENOTE_QUERY).matches) return;

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

        // Sidenotes and the bottom list are two renderings of the same notes,
        // and only one is displayed at a time. Whichever is visible owns the
        // `#fn-N` ids so a marker link always lands somewhere on screen.
        const wideMedia = window.matchMedia(SIDENOTE_QUERY);
        const syncWide = () => (wideNotes = wideMedia.matches);
        syncWide();
        wideMedia.addEventListener("change", syncWide);

        // Small delay to ensure all dynamic content is rendered (including
        // from parseLinks), then position the sidenotes.
        const setupTimeout = setTimeout(() => {
            layoutNotes();

            // Pointing at or focusing a marker brightens its note. Markers
            // come from @html, so the listeners are attached here; focus is
            // wired alongside hover so the pairing isn't pointer-only.
            document.querySelectorAll("[data-footnote]").forEach((marker) => {
                const id = parseInt(
                    marker.getAttribute("data-footnote") || "0",
                );
                marker.addEventListener("mouseenter", () => (hovered = id));
                marker.addEventListener("mouseleave", () => (hovered = null));
                marker.addEventListener("focus", () => (hovered = id));
                marker.addEventListener("blur", () => (hovered = null));
            });
        }, 100);

        // Re-measure when fonts land or the column reflows.
        document.fonts?.ready.then(scheduleLayout);
        const ro = new ResizeObserver(scheduleLayout);
        ro.observe(containerEl);
        window.addEventListener("resize", scheduleLayout);

        return () => {
            clearTimeout(setupTimeout);
            ro.disconnect();
            window.removeEventListener("resize", scheduleLayout);
            cancelAnimationFrame(layoutRaf);
            wideMedia.removeEventListener("change", syncWide);
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

    // Live footnotes and the reading line swap in after load: re-stack since
    // markers move and note heights change.
    $: if (browser && (manifoldFnHtml || readingFnHtml || readingBooks))
        tick().then(scheduleLayout);

    // Reactive so the template re-renders when either live note lands.
    $: liveHtml = (id: number, content: string) =>
        id === MANIFOLD_FN ? manifoldFnHtml : id === READING_FN ? readingFnHtml : escapeHtml(content);

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
<div class="about-layout" bind:this={containerEl}>
    <!-- Sidenotes (desktop only): each note sits in the right margin beside
         its marker, faint until hovered. -->
    <aside class="about-sidenotes layer-raised hidden xl:block">
        <div class="relative h-full">
            {#each footnotes as footnote (footnote.id)}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="sidenote footnote-item text-xs text-ink-500 dark:text-cream-500 leading-relaxed"
                    class:fn-ready={notesReady}
                    class:fn-active={hovered === footnote.id}
                    style="top: {noteTops[footnote.id] ?? 0}px"
                    id={wideNotes ? `fn-${footnote.id}` : undefined}
                    on:mouseenter={() => (hovered = footnote.id)}
                    on:mouseleave={() => (hovered = null)}
                >
                    <a
                        href="#fnref-{footnote.id}"
                        class="footnote-backref font-medium text-accent-dark dark:text-accent-light"
                        aria-label="Back to reference {footnote.id}"
                        on:focus={() => (hovered = footnote.id)}
                        on:blur={() => (hovered = null)}>{footnote.id}.</a
                    >
                    {@html liveHtml(footnote.id, footnote.content)}
                </div>
            {/each}
        </div>
    </aside>

    <!-- Main content - centered like other pages -->
    <div class="about-main page-shell page-shell-standard">
        <!-- Professional Section -->
        <section class="mb-12">
            <header class="page-header page-header-title-only">
                <h1 class="type-page-title text-ink-900 dark:text-cream-100">
                    who am i?
                </h1>
            </header>

            <div
                class="type-body flow-prose measure-reading text-ink-700 dark:text-cream-300"
            >
                <h2 class="section-heading">professionally speaking...</h2>

                <p>
                    {@html parseLinks(aboutData.professional.intro)}
                </p>

                {#each aboutData.professional.paragraphs as paragraph}
                    <p>
                        {@html parseLinks(
                            paragraph.text,
                        )}{#if paragraph.footnote}<a
                                    id="fnref-{paragraph.footnote}"
                                    href="#fn-{paragraph.footnote}"
                                    class="footnote-ref"
                                    data-footnote={paragraph.footnote}
                                    aria-label="Footnote {paragraph.footnote}"
                                    on:mouseenter={() => (hovered = paragraph.footnote ?? null)}
                                    on:mouseleave={() => (hovered = null)}
                                    on:focus={() => (hovered = paragraph.footnote ?? null)}
                                    on:blur={() => (hovered = null)}
                                    >[{paragraph.footnote}]</a
                                >{/if}
                    </p>
                {/each}

            </div>
        </section>

        <!-- Personal Section -->
        <section class="mb-12">
            <h2 class="section-heading">personally speaking...</h2>

            <div
                class="type-body flow-prose measure-reading text-ink-700 dark:text-cream-300"
            >
                {#each aboutData.personal.descriptions as description}
                    <p>
                        {@html parseLinks(description)}
                    </p>
                {/each}

                <!-- Live "currently reading" from Goodreads (via /api/now),
                     rendered as a normal full-size paragraph. -->
                {#if readingBooks.length > 0}
                    <p>
                        I'm currently reading {#each readingBooks as b, i}{#if i > 0}{i === readingBooks.length - 1 ? " and " : ", "}{/if}{#if b.url}<a
                                    href={b.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="link">{b.title}</a
                                >{:else}{b.title}{/if}{/each}.<a
                            id="fnref-{READING_FN}"
                            href="#fn-{READING_FN}"
                            class="footnote-ref"
                            data-footnote={READING_FN}
                            aria-label="Footnote {READING_FN}"
                            on:mouseenter={() => (hovered = READING_FN)}
                            on:mouseleave={() => (hovered = null)}
                            on:focus={() => (hovered = READING_FN)}
                            on:blur={() => (hovered = null)}
                            >[{READING_FN}]</a
                        >
                    </p>
                {/if}

                <p>
                    <span class="text-ink-500 dark:text-cream-500"
                        >other interests:</span
                    >
                    {@html parseLinks(aboutData.personal.interests)}
                </p>

                {#if aboutData.personal.blogs.length > 0}
                    <p>
                        <span class="text-ink-500 dark:text-cream-500"
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

        <!-- Where are you from -->
        <section class="mb-12">
            <h2 class="section-heading">where are you from?</h2>

            <div class="measure-reading text-ink-700 dark:text-cream-300">
                <p>
                    {@html parseLinks(aboutData.location.text)}
                </p>
            </div>
        </section>

        <!-- Why does this website look like this -->
        <section class="mb-12">
            <h2 class="section-heading">
                why does this website look like this?
            </h2>

            <div class="flow-prose measure-reading text-ink-700 dark:text-cream-300">
                <p>
                    <span class="text-ink-500 dark:text-cream-500"
                        >inspiration:</span
                    >
                    {aboutData.website.inspiration}
                </p>

                {#if aboutData.website.inspirationList.length > 0}
                    <ul class="space-y-0.5 text-sm">
                        {#each aboutData.website.inspirationList as site}
                            <li>
                                <a
                                    href={site.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="link font-medium">{site.name}</a
                                >:
                                <span class="text-ink-500 dark:text-cream-500"
                                    >{site.description}</span
                                >
                            </li>
                        {/each}
                    </ul>
                {/if}

                <p>
                    <span class="text-ink-500 dark:text-cream-500"
                        >built with:</span
                    >
                    {@html parseLinks(aboutData.website.builtWith)}
                </p>
            </div>
        </section>

        <!-- Things I'm thinking about -->
        <section class="mb-12">
            <h2 class="section-heading">thoughts floating around in my head</h2>

            <div class="flow-prose measure-reading text-ink-700 dark:text-cream-300">
                <ul class="list-disc list-inside space-y-2">
                    {#each aboutData.thoughts as thought}
                        <li>{@html parseLinks(thought)}</li>
                    {/each}
                </ul>
            </div>
        </section>

        <!-- Mobile footnotes (shown at bottom wherever the sidenotes aren't) -->
        <div class="xl:hidden mt-12 pt-8">
            <h3 class="type-label mb-4 text-ink-500 dark:text-cream-400">footnotes</h3>
            <div class="space-y-4">
                {#each footnotes as footnote}
                    <div
                        class="text-xs text-ink-500 dark:text-cream-500 leading-relaxed"
                        id={wideNotes ? undefined : `fn-${footnote.id}`}
                    >
                        <a
                            href="#fnref-{footnote.id}"
                            class="footnote-backref font-medium text-accent-dark dark:text-accent-light"
                            aria-label="Back to reference {footnote.id}"
                            >{footnote.id}.</a
                        >
                        {@html liveHtml(footnote.id, footnote.content)}
                    </div>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    .about-layout {
        position: relative;
        width: 100%;
        max-width: 820px;
        margin-inline: auto;
    }

    .about-main {
        width: 100%;
        max-width: calc(68ch + 3rem);
        margin-inline: 0;
    }

    @media (min-width: 1280px) {
        .about-layout {
            display: grid;
            width: min(calc(68ch + 19rem), calc(50% + 410px));
            max-width: none;
            margin-left: calc(50% - 410px);
            margin-right: 0;
            grid-template-columns: calc(68ch + 3rem) minmax(0, 14rem);
            column-gap: var(--space-8);
            justify-content: start;
            align-items: stretch;
        }

        .about-main {
            grid-column: 1;
            grid-row: 1;
            max-width: none;
        }

        .about-sidenotes {
            position: relative;
            grid-column: 2;
            grid-row: 1;
            width: 100%;
        }
    }

    /* Use :global() for footnote styles since they're dynamically generated via @html */
    :global(.footnote-ref) {
        font-size: 0.75rem;
        line-height: 1;
        vertical-align: super;
        color: theme("colors.accent.DEFAULT");
        cursor: pointer;
        text-decoration: none;
        transition: color var(--motion-base) var(--ease-standard);
    }

    :global(.footnote-ref:hover) {
        color: theme("colors.accent.dark");
    }

    /* The markers are links, so the shared :focus-visible ring applies. Only
       the corner radius is local, so the ring hugs the [n] rather than boxing
       a full line height. */
    :global(.footnote-ref),
    .footnote-backref {
        border-radius: var(--radius-control);
    }

    .footnote-backref {
        text-decoration: none;
    }

    /* Jumping to a note shouldn't land it under the sticky page top. */
    .footnote-item,
    .about-main [id^="fn-"] {
        scroll-margin-top: var(--space-16);
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
        transition: opacity var(--motion-slow) var(--ease-standard);
    }
    .sidenote.fn-ready {
        opacity: 0.45;
        transition:
            opacity var(--motion-slow) var(--ease-standard),
            top var(--motion-slow) var(--ease-emphasized);
    }
    .sidenote.fn-ready:hover,
    .sidenote.fn-ready.fn-active {
        opacity: 1;
    }

    /* Dark theme only: at 0.45 the resting note composited to 3.1:1 on
       ink-900, below AA for 12px text. 0.62 keeps it clearly recessive next
       to the full-opacity hover/focus state while staying legible. */
    :global(.dark) .sidenote.fn-ready {
        opacity: 0.62;
    }


    /* Marker echo: while its sidenote is hovered, the in-text marker warms. */
    :global(.footnote-ref.fn-hot) {
        color: theme("colors.accent.dark");
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
