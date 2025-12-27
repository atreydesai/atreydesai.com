<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import ExternalLink from "lucide-svelte/icons/external-link";
    import Calendar from "lucide-svelte/icons/calendar";

    // Placeholder blog posts - will be replaced with actual content
    // All marked as external since internal routes don't exist yet
    const posts = [
        {
            id: "post-1",
            title: "Lorem Ipsum: Thoughts on AI Research",
            excerpt:
                "Dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
            date: "2024-12-01",
            tags: ["ai", "research"],
            external: true,
            url: "#", // Placeholder - replace with actual URL
        },
        {
            id: "post-2",
            title: "Consectetur Adipiscing: A Deep Dive",
            excerpt:
                "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
            date: "2024-11-15",
            tags: ["deep-learning"],
            external: true,
            url: "#", // Placeholder - replace with actual URL
        },
        {
            id: "post-3",
            title: "External Post on Substack",
            excerpt:
                "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.",
            date: "2024-10-20",
            tags: ["thoughts"],
            external: true,
            url: "https://substack.com/@atreydesai",
        },
    ];

    const substackUrl = "https://substack.com/@atreydesai";
</script>

<Seo
    title="Blog | Atrey Desai"
    description="Blog posts and writings by Atrey Desai on AI, research, and more."
/>

<div class="layout-main py-8 md:py-12">
    <h1 class="heading-display text-3xl text-ink-900 dark:text-cream-100 mb-4">
        blog
    </h1>

    <p class="text-ink-600 dark:text-cream-400 mb-4">
        Thoughts, ideas, and explorations. Lorem ipsum dolor sit amet,
        consectetur adipiscing elit.
    </p>

    <!-- Substack link -->
    <div class="mb-8 p-4 bg-cream-50 dark:bg-ink-800 rounded-lg">
        <p class="text-ink-700 dark:text-cream-300">
            I also write on Substack:
            <a
                href={substackUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="link inline-flex items-center gap-1"
            >
                Subscribe to my newsletter
                <ExternalLink size={14} />
            </a>
        </p>
    </div>

    <!-- Blog posts -->
    <div class="space-y-6">
        {#each posts as post (post.id)}
            <article
                class="py-4 border-b border-ink-100 dark:border-ink-800 group"
            >
                <div class="flex items-start justify-between gap-4">
                    <div class="flex-1">
                        <h2
                            class="text-lg font-semibold text-ink-900 dark:text-cream-100 mb-2 group-hover:text-ink-700 dark:group-hover:text-cream-200 transition-colors"
                        >
                            {#if post.external}
                                <a
                                    href={post.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="inline-flex items-center gap-2"
                                >
                                    {post.title}
                                    <ExternalLink
                                        size={16}
                                        class="opacity-50"
                                    />
                                </a>
                            {:else}
                                <span>
                                    {post.title}
                                </span>
                            {/if}
                        </h2>

                        <p class="text-ink-600 dark:text-cream-400 mb-3">
                            {post.excerpt}
                        </p>

                        <div class="flex items-center gap-4 text-sm">
                            <span
                                class="flex items-center gap-1 text-ink-500 dark:text-ink-400"
                            >
                                <Calendar size={14} />
                                {new Date(post.date).toLocaleDateString(
                                    "en-US",
                                    {
                                        month: "long",
                                        day: "numeric",
                                        year: "numeric",
                                    },
                                )}
                            </span>

                            <div class="flex gap-2">
                                {#each post.tags as tag}
                                    <span class="pill text-xs">{tag}</span>
                                {/each}
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        {/each}
    </div>
</div>
