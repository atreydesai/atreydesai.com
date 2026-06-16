<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import ShaderCanvas from "$lib/components/ShaderCanvas.svelte";
    import { formatLongDate } from "$lib/utils/date";
    import { marked } from "marked";
    import { ArrowLeft, CalendarDays } from "lucide-svelte";
    import type { PageData } from "./$types";

    export let data: PageData;

    $: post = data.post;
    $: prevPost = data.prevPost;
    $: nextPost = data.nextPost;

    // Split content on [[shader:variant]] markers so we can interleave live
    // shader canvases between rendered markdown segments.
    type Segment =
        | { type: "html"; content: string }
        | { type: "shader"; variant: "mound" | "nebula" }
        | { type: "image"; src: string; caption: string };

    function parseSegments(src: string): Segment[] {
        const re = /\[\[shader:(mound|nebula)\]\]|\[\[image:([^\]|]+)\|([^\]]+)\]\]/g;
        const out: Segment[] = [];
        let last = 0;
        let match: RegExpExecArray | null;
        while ((match = re.exec(src)) !== null) {
            if (match.index > last) {
                out.push({ type: "html", content: marked(src.slice(last, match.index)) as string });
            }
            if (match[1]) {
                out.push({ type: "shader", variant: match[1] as "mound" | "nebula" });
            } else {
                out.push({ type: "image", src: match[2], caption: match[3] });
            }
            last = match.index + match[0].length;
        }
        if (last < src.length) {
            out.push({ type: "html", content: marked(src.slice(last)) as string });
        }
        return out;
    }

    $: segments = parseSegments(post.content);

    function readingTime(content: string): string {
        const words = content.trim().split(/\s+/).length;
        const mins = Math.max(1, Math.round(words / 250));
        return `${mins} min read`;
    }
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
                {formatLongDate(post.date)}
            </span>

            <span class="text-ink-400 dark:text-ink-500">
                {readingTime(post.content)}
            </span>

            <div class="flex gap-2">
                {#each post.tags as tag}
                    <span class="pill text-xs">{tag}</span>
                {/each}
            </div>
        </div>
    </header>

    <!-- Post content -->
    <article class="prose-custom font-serif">
        {#each segments as seg}
            {#if seg.type === "html"}
                {@html seg.content}
            {:else if seg.type === "shader"}
                <ShaderCanvas variant={seg.variant} />
            {:else}
                <figure class="blog-figure">
                    <img src={seg.src} alt={seg.caption} />
                    <figcaption>{seg.caption}</figcaption>
                </figure>
            {/if}
        {/each}
    </article>

    <!-- Prev/next navigation -->
    {#if prevPost || nextPost}
        <nav
            class="mt-12 pt-6 border-t border-ink-100 dark:border-ink-800 flex items-start justify-between gap-4"
            aria-label="Post navigation"
        >
            <div class="flex-1">
                {#if prevPost}
                    <a
                        href="/blog/{prevPost.id}"
                        class="group flex flex-col gap-1 text-sm"
                    >
                        <span class="meta-label">← older</span>
                        <span class="text-ink-700 dark:text-cream-300 group-hover:text-accent dark:group-hover:text-accent-light transition-colors">
                            {prevPost.title}
                        </span>
                    </a>
                {/if}
            </div>

            <div class="flex-1 text-right">
                {#if nextPost}
                    <a
                        href="/blog/{nextPost.id}"
                        class="group flex flex-col gap-1 text-sm items-end"
                    >
                        <span class="meta-label">newer →</span>
                        <span class="text-ink-700 dark:text-cream-300 group-hover:text-accent dark:group-hover:text-accent-light transition-colors">
                            {nextPost.title}
                        </span>
                    </a>
                {/if}
            </div>
        </nav>
    {/if}
</div>

<style>
    /* Italic prose headings to match the site-wide `section-heading` voice
       (every other page uses the italic Optima prose face for in-content headings). */
    .prose-custom :global(h2) {
        font-family: Optima, Candara, "URW Classico", sans-serif;
        font-style: italic;
        font-size: 1.5rem;
        font-weight: 600;
        margin-top: 2rem;
        margin-bottom: 0.75rem;
    }

    .prose-custom :global(h3) {
        font-family: Optima, Candara, "URW Classico", sans-serif;
        font-style: italic;
        font-size: 1.25rem;
        font-weight: 600;
        margin-top: 1.5rem;
        margin-bottom: 0.5rem;
    }

    /* 18px prose (up from 17px since Optima reads smaller than the former serif):
       Rello et al. (2016) put on-screen comprehension optimum near 18px. The
       1.4rem inter-paragraph gap (~1.25×) keeps blocks distinct. */
    .prose-custom {
        font-size: 1.125rem;
    }

    .prose-custom :global(p) {
        margin-bottom: 1.4rem;
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

    .blog-figure {
        margin: 2rem 0;
    }

    .blog-figure img {
        width: 100%;
        border-radius: 0.5rem;
    }

    .blog-figure figcaption {
        margin-top: 0.5rem;
        font-size: 0.875rem;
        font-style: italic;
        color: theme("colors.ink.500");
        text-align: center;
    }

    :global(.dark) .blog-figure figcaption {
        color: theme("colors.ink.400");
    }
</style>
