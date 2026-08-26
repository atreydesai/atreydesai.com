<script lang="ts">
    import PageShell from "$lib/components/PageShell.svelte";
    import { posts } from "$lib/content";
    import { formatShortDate } from "$lib/utils/date";
    import { SquareArrowOutUpRight } from "@jis3r/icons";
</script>

<PageShell
    title="Blog | Atrey Desai"
    description="Blog posts and writings by Atrey Desai on AI, research, and more."
    url="https://atreydesai.com/blog/"
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
                    aria-describedby={post.externalUrl
                        ? `external-post-${post.id}`
                        : undefined}
                    class="external-post-card group blog-row-link no-underline"
                >
                    <h2
                        class="blog-row-title type-item-heading text-ink-900 transition-colors duration-200 group-hover:text-accent-dark dark:text-cream-100 dark:group-hover:text-accent-light"
                    >{post.title}{#if post.externalUrl}<span
                            class="external-post-indicator text-ink-400 transition-colors duration-200 group-hover:text-accent-dark dark:text-ink-400 dark:group-hover:text-accent-light"
                        ><span class="external-post-icon" aria-hidden="true"
                            ><SquareArrowOutUpRight size={14} /></span
                            ><span
                                id="external-post-{post.id}"
                                role="tooltip"
                                class="external-post-tooltip surface-tooltip layer-tooltip type-meta"
                            >
                                Originally published on {post.externalSite ??
                                    "an external site"}. Opens in a new tab.
                            </span></span
                        >{/if}</h2
                    >
                    <p
                        class="blog-row-meta type-meta text-ink-500 dark:text-cream-400"
                    >
                        {#if post.externalSite}
                            <span class="blog-row-site">{post.externalSite}</span>
                            <span aria-hidden="true">·</span>
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
       Rule sits on the <li> so it stays on the column grid; the hover band on
       the <a> bleeds a step past it on both sides, like an overshot stroke. */
    .blog-row + .blog-row {
        border-top: 1px dashed theme("colors.ink.200");
    }

    :global(.dark) .blog-row + .blog-row {
        border-top-color: theme("colors.ink.700");
    }

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

    /* Optima ships only Regular and Bold, so type-item-heading's 600 silently
       resolves to full Bold: too heavy for an index row. Drop to Regular and
       synthesize the missing middle weight with a hairline stroke. currentColor
       keeps it in step with the accent shift on hover and with dark mode. */
    .blog-row-title {
        flex: 1 1 auto;
        font-weight: 400;
        -webkit-text-stroke: 0.5px currentColor;
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

    .external-post-indicator {
        position: relative;
        display: inline-flex;
        align-items: center;
        /* The visual gap is the margin; the padding is hit area, cancelled by
           the negative margin so the glyph doesn't move. */
        margin-left: calc(var(--space-1-5) + var(--space-1));
        margin-right: calc(-1 * var(--space-1));
        padding: var(--space-1);
        /* Nudge onto the title's optical baseline. */
        transform: translateY(0.08em);
    }

    .external-post-tooltip {
        pointer-events: none;
        visibility: hidden;
        position: absolute;
        right: 0;
        bottom: calc(100% + var(--space-2));
        width: max-content;
        max-width: min(45ch, calc(100vw - var(--space-8)));
        padding: var(--space-2) var(--space-3);
        transform: translateY(var(--space-1));
        border: 1px solid theme("colors.ink.200");
        background: theme("colors.cream.50");
        color: theme("colors.ink.500");
        opacity: 0;
        transition:
            opacity var(--motion-slow) var(--ease-emphasized),
            transform var(--motion-slow) var(--ease-emphasized);
    }

    :global(.dark) .external-post-tooltip {
        border-color: theme("colors.ink.700");
        background: theme("colors.ink.800");
        color: theme("colors.cream.400");
    }

    .external-post-indicator:hover .external-post-tooltip,
    .external-post-card:focus-visible .external-post-tooltip {
        visibility: visible;
        transform: translateY(0);
        opacity: 1;
    }
</style>
