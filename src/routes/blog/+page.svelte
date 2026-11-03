<script lang="ts">
    import PageShell from "$lib/components/PageShell.svelte";
    import Mark from "$lib/components/Mark.svelte";
    import { posts } from "$lib/content";
    import { formatShortDate } from "$lib/utils/date";
</script>

<PageShell
    title="Blog | Atrey Desai"
    description="Essays and notes by Atrey Desai on research, language models, and interactive experiments."
    url="https://atreydesai.com/blog/"
    pageType="CollectionPage"
    heading="blog"
>
    <!-- Blog posts -->
    <ul class="stagger-children">
        {#each posts as post (post.id)}
            <li class="blog-row">
                <a
                    href={post.externalUrl ?? `/blog/${post.id}/`}
                    target={post.externalUrl ? "_blank" : undefined}
                    rel={post.externalUrl ? "noopener noreferrer" : undefined}
                    class="group blog-row-link no-underline"
                >
                    <div class="blog-row-heading">
                    <h2
                        class="type-item-heading text-ink-900 transition-colors duration-200 group-hover:text-accent-dark dark:text-cream-100 dark:group-hover:text-accent-light"
                    >{post.title}{#if post.externalUrl}<span class="sr-only"
                            >, opens in a new tab</span
                        >{/if}</h2
                    >
                    </div>
                    <p
                        class="blog-row-meta type-meta text-ink-500 dark:text-cream-400"
                    >
                        {#if post.externalSite}
                            <span class="blog-row-site">{post.externalSite}</span>
                            <Mark kind="dot" text="" />
                        {/if}
                        <time datetime={post.date}
                            >{formatShortDate(post.date)}</time
                        >
                    </p>
                </a>
            </li>
        {/each}
    </ul>
</PageShell>

<style>
    /* Index rows, not cards: a tight single line so the hover tint reads as a
       highlighter passing over the title rather than a panel lighting up.
       The hover band on the <a> bleeds a step past the column on both sides,
       like an overshot stroke. */
    .blog-row-link {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: var(--space-1) var(--space-4);
        padding: var(--space-2);
        margin-inline: calc(-1 * var(--space-2));
        transition: background-color var(--motion-base) var(--ease-standard);
    }

    .blog-row-link:hover {
        background: rgba(232, 93, 76, 0.06);
    }

    :global(.dark) .blog-row-link:hover {
        background: rgba(245, 230, 211, 0.05);
    }

    .blog-row-heading {
        display: flex;
        flex: 1 1 auto;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2);
        min-width: 0;
    }

    .blog-row-meta {
        display: inline-flex;
        align-items: baseline;
        gap: var(--space-1-5);
        flex: 0 0 auto;
        margin-left: auto;
        white-space: nowrap;
    }

    /* Narrow screens: let the date drop under the title, left-aligned, with the
       band still hugging both lines. */
    @media (max-width: 480px) {
        .blog-row-link {
            flex-direction: column;
            align-items: flex-start;
        }

        .blog-row-meta {
            margin-left: 0;
        }
    }
</style>
