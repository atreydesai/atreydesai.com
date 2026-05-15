<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import { posts } from "$lib/content";
    import { formatDate } from "$lib/utils/date";
</script>

<Seo
    title="Blog | Atrey Desai"
    description="Blog posts and writings by Atrey Desai on AI, research, and more."
    url="https://atreydesai.com/blog"
/>

<div class="layout-main py-8 md:py-12">
    <section class="mb-6">
        <h1
            class="heading-display mb-4 text-3xl text-ink-900 dark:text-cream-100"
        >
            blog
        </h1>
    </section>

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
                        {formatDate(post.date, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                        })}
                    </p>
                </a>
            </li>
        {/each}
    </ul>
</div>
