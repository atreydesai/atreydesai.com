<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import { formatDate } from "$lib/utils/date";
    import { marked } from "marked";
    import { ArrowLeft, CalendarDays } from "lucide-svelte";
    import type { PageData } from "./$types";

    export let data: PageData;

    $: post = data.post;
    $: htmlContent = marked(post.content);
</script>

<Seo
    title="{post.title} | Atrey Desai"
    description={post.excerpt}
    url="https://atreydesai.com/blog/{post.id}"
    type="article"
/>

<div class="layout-main py-8 md:py-12">
    <!-- Back link -->
    <a
        href="/blog"
        class="inline-flex items-center gap-1 text-sm text-ink-500 dark:text-ink-400 hover:text-accent dark:hover:text-accent-light transition-colors mb-8"
    >
        <ArrowLeft size={14} />
        Back to blog
    </a>

    <!-- Post header -->
    <header class="mb-8">
        <h1 class="heading-display text-3xl text-ink-900 dark:text-cream-100 mb-3">
            {post.title}
        </h1>

        <div class="flex items-center gap-4 text-sm">
            <span class="flex items-center gap-1 text-ink-500 dark:text-ink-400">
                <CalendarDays size={14} class="translate-y-[0.5px]" />
                {formatDate(post.date, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                })}
            </span>

            <div class="flex gap-2">
                {#each post.tags as tag}
                    <span class="pill text-xs">{tag}</span>
                {/each}
            </div>
        </div>
    </header>

    <!-- Post content -->
    <article class="prose-custom">
        {@html htmlContent}
    </article>
</div>

<style>
    .prose-custom :global(h2) {
        font-family: "neue-haas-grotesk-display", sans-serif;
        font-size: 1.5rem;
        font-weight: 600;
        margin-top: 2rem;
        margin-bottom: 0.75rem;
    }

    .prose-custom :global(h3) {
        font-family: "neue-haas-grotesk-display", sans-serif;
        font-size: 1.25rem;
        font-weight: 600;
        margin-top: 1.5rem;
        margin-bottom: 0.5rem;
    }

    .prose-custom :global(p) {
        margin-bottom: 1rem;
        line-height: 1.7;
    }

    .prose-custom :global(a) {
        color: theme("colors.accent.DEFAULT");
        text-decoration: underline;
        text-underline-offset: 3px;
    }

    :global(.dark) .prose-custom :global(a) {
        color: theme("colors.accent.light");
    }

    .prose-custom :global(ul),
    .prose-custom :global(ol) {
        margin-bottom: 1rem;
        padding-left: 1.5rem;
    }

    .prose-custom :global(li) {
        margin-bottom: 0.25rem;
        line-height: 1.7;
    }

    .prose-custom :global(ul) {
        list-style-type: disc;
    }

    .prose-custom :global(ol) {
        list-style-type: decimal;
    }

    .prose-custom :global(blockquote) {
        border-left: 3px solid theme("colors.ink.200");
        padding-left: 1rem;
        margin: 1.5rem 0;
        font-style: italic;
        color: theme("colors.ink.500");
    }

    :global(.dark) .prose-custom :global(blockquote) {
        border-color: theme("colors.ink.600");
        color: theme("colors.ink.400");
    }

    .prose-custom :global(code) {
        font-size: 0.9em;
        background-color: theme("colors.cream.200");
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
    }

    :global(.dark) .prose-custom :global(code) {
        background-color: theme("colors.ink.700");
    }

    .prose-custom :global(pre) {
        background-color: theme("colors.ink.900");
        color: theme("colors.cream.200");
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
        margin-bottom: 1rem;
    }

    .prose-custom :global(pre code) {
        background: none;
        padding: 0;
    }

    .prose-custom :global(hr) {
        margin: 2rem 0;
    }
</style>
