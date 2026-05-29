<script lang="ts">
    import PageShell from "$lib/components/PageShell.svelte";
    import { posts } from "$lib/content";
    import { formatShortDate } from "$lib/utils/date";
</script>

<PageShell
    title="Blog | Atrey Desai"
    description="Blog posts and writings by Atrey Desai on AI, research, and more."
    url="https://atreydesai.com/blog"
    heading="blog"
>
    <!-- Blog posts -->
    <ul class="divide-y divide-ink-200/60 dark:divide-ink-700/60 stagger-children">
        {#each posts as post (post.id)}
            <li class="py-6">
                <a
                    href="/blog/{post.id}"
                    class="group block no-underline"
                >
                    <h2 class="text-2xl text-ink-900 dark:text-cream-100 group-hover:text-accent dark:group-hover:text-accent-light transition-colors duration-200 mb-2">
                        {post.title}
                    </h2>
                    <p class="text-sm text-ink-500 dark:text-cream-500">
                        {formatShortDate(post.date)}
                    </p>
                </a>
            </li>
        {/each}
    </ul>
</PageShell>
