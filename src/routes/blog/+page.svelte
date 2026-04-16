<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import CustomSelect from "$lib/components/CustomSelect.svelte";
    import { posts } from "$lib/content";
    import { formatDate } from "$lib/utils/date";
    import { ExternalLink, CalendarDays } from "lucide-svelte";
    import { Blend } from "@jis3r/icons";

    const substackUrl = "https://substack.com/@aydi1";

    // Tag filtering
    let selectedTag: string = "all";

    $: allTags = [...new Set(posts.flatMap((p) => p.tags))].sort();
    $: tagOptions = [
        { value: "all", label: "All Topics" },
        ...allTags.map((t) => ({ value: t, label: t })),
    ];

    $: filteredPosts = selectedTag === "all"
        ? posts
        : posts.filter((p) => p.tags.includes(selectedTag));
</script>

<Seo
    title="Blog | Atrey Desai"
    description="Blog posts and writings by Atrey Desai on AI, research, and more."
    url="https://atreydesai.com/blog"
/>

<div class="layout-main py-8 md:py-12">
    <h1 class="heading-display text-3xl text-ink-900 dark:text-cream-100 mb-4">
        blog
    </h1>

    <p class="text-ink-600 dark:text-cream-400 mb-4">
        Thoughts, ideas, and explorations.
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

    <!-- Filter -->
    {#if allTags.length > 1}
        <div
            class="flex flex-wrap items-center gap-4 mb-8 p-4 bg-cream-50 dark:bg-ink-800 rounded-lg"
        >
            <div
                class="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400"
            >
                <Blend size={16} />
                <span>Filter:</span>
            </div>
            <CustomSelect
                options={tagOptions}
                bind:value={selectedTag}
                placeholder="All Topics"
            />
        </div>
    {/if}

    <!-- Blog posts -->
    <div class="space-y-6 stagger-children">
        {#each filteredPosts as post (post.id)}
            <article
                class="py-4 border-b border-ink-100 dark:border-ink-800 group"
            >
                <div class="flex items-start justify-between gap-4">
                    <div class="flex-1">
                        <h2
                            class="text-lg font-semibold text-ink-900 dark:text-cream-100 mb-2 group-hover:text-ink-700 dark:group-hover:text-cream-200 transition-colors"
                        >
                            <a href="/blog/{post.id}" class="hover:underline">
                                {post.title}
                            </a>
                        </h2>

                        <p class="text-ink-600 dark:text-cream-400 mb-3">
                            {post.excerpt}
                        </p>

                        <div class="flex items-center gap-4 text-sm">
                            <span
                                class="flex items-center gap-1 text-ink-500 dark:text-ink-400"
                            >
                                <CalendarDays
                                    size={14}
                                    class="translate-y-[0.5px]"
                                />
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
                    </div>
                </div>
            </article>
        {/each}
    </div>

    <!-- Empty state -->
    {#if filteredPosts.length === 0}
        <div class="text-center py-12 text-ink-500 dark:text-ink-400">
            <p>No posts match your current filter.</p>
            <button
                type="button"
                class="mt-2 link"
                on:click={() => { selectedTag = "all"; }}
            >
                Clear filter
            </button>
        </div>
    {/if}
</div>
