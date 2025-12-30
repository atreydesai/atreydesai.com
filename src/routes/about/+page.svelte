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
                "HackAPrompt is the world's largest red-teaming hackathon.",
        },
        {
            id: 2,
            content:
                "This work at ACL2 aims to eventually create an end-to-end machine translation pipeline for animal vocalizations. Our research is also graciously supported by the NSF.",
        },
        {
            id: 3,
            content:
                "Our findings were published at the AAAI-22 Workshop on Interactive Machine Learning (IMLW) and the Conference on Reinforcement Learning and Decision Making (RLDM-22). And also my first publications!",
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
                    >, a third-year undergraduate student double majoring in
                    Computer Science and Linguistics with a minor in Korean
                    Studies at the
                    <a
                        href="https://umd.edu"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link">University of Maryland</a
                    >. I am fortunate to be advised by
                    <a
                        href="https://rudinger.github.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link">Professor Rachel Rudinger</a
                    >
                    and
                    <a
                        href="http://www.umiacs.umd.edu/~jbg"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link">Professor Jordan Boyd-Graber</a
                    >.
                </p>

                <p>
                    I am a member of the <a
                        href="https://clip.umd.edu/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link"
                        >Computational Linguistics and Information Processing
                        (CLIP) lab</a
                    >
                    in UMIACS. I am also currently a member of the technical staff
                    of
                    <a
                        href="https://learnprompting.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link">Learn Prompting</a
                    >, where I work on HackAPrompt and research on creating
                    trustworhy and robust AI safety judges.<sup
                        class="footnote-ref"
                        data-footnote="1">[1]</sup
                    >
                </p>

                <p>
                    Currently, I'm also a visiting researcher under <a
                        href="https://kenzhu2000.github.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link">Professor Kenny Zhu</a
                    >
                    at the
                    <a
                        href="https://uta-acl2.github.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link"
                        >Arlington Computational Linguistics Lab (ACL2)</a
                    >
                    at the University of Texas at Arlington. Our work focuses on
                    identifying structural similarities to human language and contextual
                    semantics within animal vocalizations to gain insights about
                    the language of animal species.<sup
                        class="footnote-ref"
                        data-footnote="2">[2]</sup
                    >
                </p>

                <p>
                    Previously, I worked under <a
                        href="https://littmania.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link">Professor Michael Littman</a
                    >
                    at the
                    <a
                        href="http://irl.cs.brown.edu/"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link"
                        >Reinforcement Learning & Adaptive Behavior (RLAB)</a
                    >
                    group at Brown University on applications of reinforcement learning
                    to 2D non-sequential tasks.<sup
                        class="footnote-ref"
                        data-footnote="3">[3]</sup
                    >
                </p>

                <p>
                    My research interests lie in <strong
                        >natural language processing</strong
                    >, particularly:
                </p>
                <ol class="list-decimal list-inside space-y-1 ml-4">
                    <li>
                        How can we <strong>verify</strong> validity and
                        robustness of
                        <span class="text-ink-900 dark:text-cream-100"
                            >existing benchmarks</span
                        >?
                    </li>
                    <li>
                        How can humans and AI <strong>collaborate</strong> in data
                        creation?
                    </li>
                    <li>
                        How can we <strong>create</strong> new evaluation
                        methods that probe
                        <span class="text-ink-900 dark:text-cream-100"
                            >multimodal</span
                        >,
                        <span class="text-ink-900 dark:text-cream-100"
                            >linguistic</span
                        >, and
                        <span class="text-ink-900 dark:text-cream-100"
                            >spatiotemporal</span
                        >
                        understanding?
                    </li>
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
