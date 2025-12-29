<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import Seo from "$lib/components/Seo.svelte";
    import { affiliations as affiliationsData } from "$lib/content";

    // Footnotes data - can be edited to add your own footnotes
    const footnotes = [
        {
            id: 1,
            content:
                "It's unclear to me what order I should list them in, since I didn't tell the registrar who my primary advisor was when this info was entered into Stanford's system. This is entirely intended.",
        },
        {
            id: 2,
            content:
                "Nathan is responsible for helping me formulate who I want to be as a researcher (both directly and indirectly). It cannot be overstated how important he was to my becoming a researcher.",
        },
        {
            id: 3,
            content:
                "I was awarded the Georgetown Tropaia Computer Science Award in 2024. My favourite class at Georgetown was a field linguistics class taught by Michael Obiri-Yeboah where we documented the Dagaare language of West Africa from scratch.",
        },
    ];

    // Track which footnotes should be visible based on their markers
    let visibleFootnotes: Set<number> = new Set();

    onMount(() => {
        if (!browser) return;

        // Find all footnote markers and observe them
        const markers = document.querySelectorAll("[data-footnote]");

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const id = parseInt(
                        entry.target.getAttribute("data-footnote") || "0",
                    );
                    if (entry.isIntersecting) {
                        visibleFootnotes.add(id);
                    } else {
                        // Only hide if scrolled past (not above)
                        const rect = entry.boundingClientRect;
                        if (rect.top < 0) {
                            visibleFootnotes.delete(id);
                        }
                    }
                    visibleFootnotes = visibleFootnotes; // Trigger reactivity
                });
            },
            {
                threshold: 0,
                rootMargin: "-64px 0px -50% 0px", // Account for header and only track upper half of viewport
            },
        );

        markers.forEach((marker) => observer.observe(marker));

        return () => observer.disconnect();
    });
</script>

<Seo
    title="About | Atrey Desai"
    description="Learn more about Atrey Desai - undergraduate researcher, AI enthusiast, and curious mind."
/>

<!-- Centered layout container with footnotes on the side -->
<div class="relative">
    <!-- Footnotes Sidebar (desktop only) - positioned absolutely on the right -->
    <aside
        class="hidden lg:block fixed right-4 xl:right-8 top-24 w-48 xl:w-56 z-10"
    >
        <div class="space-y-4">
            {#each footnotes as footnote}
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
                    I'm <strong class="text-ink-900 dark:text-cream-100"
                        >Atrey Desai</strong
                    >, a {affiliationsData.year.toLowerCase()} undergraduate at {affiliationsData.school}.<sup
                        class="footnote-ref"
                        data-footnote="1">[1]</sup
                    >
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed
                    do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                </p>

                <p>
                    <span class="text-ink-500 dark:text-ink-400"
                        >affiliations:</span
                    >
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. [DESCRIBE
                    YOUR RESEARCH GROUP, LAB, OR ORGANIZATION AFFILIATIONS]<sup
                        class="footnote-ref"
                        data-footnote="2">[2]</sup
                    >
                </p>

                <p>
                    <span class="text-ink-500 dark:text-ink-400"
                        >other mentors:</span
                    >
                    {#if affiliationsData.mentors.length > 0}
                        {#each affiliationsData.mentors as mentor, i}
                            {mentor.name} ({mentor.affiliation}){#if i < affiliationsData.mentors.length - 1},
                            {/if}
                        {/each}
                    {:else}
                        [LIST OTHER MENTORS HERE]
                    {/if}
                </p>

                <p>
                    I'm an <strong>AI researcher</strong> interested in
                    {affiliationsData.researchInterests.join(", ")}.<sup
                        class="footnote-ref"
                        data-footnote="3">[3]</sup
                    >
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim
                    ad minim veniam, quis nostrud exercitation ullamco laboris.
                </p>
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
                    I'm <strong class="text-ink-900 dark:text-cream-100"
                        >{affiliationsData.personal.description}</strong
                    >. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                    Duis aute irure dolor in reprehenderit in voluptate velit
                    esse cillum dolore eu fugiat nulla pariatur.
                </p>

                <p>
                    <span class="text-ink-500 dark:text-ink-400"
                        >other interests:</span
                    >
                    {affiliationsData.personal.interests.join(", ")}
                    [ADD YOUR HOBBIES, INTERESTS, THINGS YOU'RE PASSIONATE ABOUT]
                </p>

                {#if affiliationsData.personal.blogs.length > 0}
                    <p>
                        <span class="text-ink-500 dark:text-ink-400"
                            >blogs i like:</span
                        >
                        {#each affiliationsData.personal.blogs as blog, i}
                            <a
                                href={blog.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="link">{blog.name}</a
                            >{#if i < affiliationsData.personal.blogs.length - 1},
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
                    I'm from <strong class="text-ink-900 dark:text-cream-100"
                        >{affiliationsData.location.hometown}</strong
                    >, and currently based in the {affiliationsData.location
                        .current}. Lorem ipsum dolor sit amet, consectetur
                    adipiscing elit. [ADD MORE ABOUT YOUR BACKGROUND, JOURNEY,
                    ETC.]
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
                    This site draws inspiration from many beautiful personal websites.
                    [LIST WEBSITES THAT INSPIRED YOUR DESIGN]
                </p>

                <p>
                    <span class="text-ink-500 dark:text-ink-400"
                        >built with:</span
                    >
                    This website was built in
                    <a
                        href="https://cursor.sh"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link">Cursor</a
                    >
                    with <strong>Antigravity</strong>. It uses SvelteKit,
                    Tailwind CSS, and is deployed on Vercel.
                </p>
            </div>
        </section>

        <hr class="border-dotted border-ink-200 dark:border-ink-700 my-8" />

        <!-- Things I'm thinking about -->
        <section class="mb-12">
            <h2 class="section-heading">things i'm thinking about lately</h2>

            <div class="text-ink-700 dark:text-cream-300 space-y-4">
                <ul class="list-disc list-inside space-y-2">
                    <li>[THOUGHT 1 - Lorem ipsum dolor sit amet]</li>
                    <li>
                        [THOUGHT 2 - How to make AI systems more interpretable]
                    </li>
                    <li>[THOUGHT 3 - The future of human-AI collaboration]</li>
                    <li>[THOUGHT 4 - Lorem ipsum dolor sit amet]</li>
                </ul>
            </div>
        </section>

        <!-- Mobile footnotes (shown at bottom) -->
        <div
            class="lg:hidden mt-12 pt-8 border-t border-ink-200 dark:border-ink-700"
        >
            <h3 class="section-heading text-sm">footnotes</h3>
            <div class="space-y-4">
                {#each footnotes as footnote}
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
    .footnote-ref {
        font-size: 0.75rem;
        line-height: 1;
        vertical-align: super;
        color: theme("colors.accent.DEFAULT");
        cursor: pointer;
        transition: color 0.2s;
    }

    .footnote-ref:hover {
        color: theme("colors.accent.dark");
    }

    .footnote-item {
        padding-left: 0.75rem;
        border-left: 2px solid theme("colors.accent.DEFAULT");
    }
</style>
