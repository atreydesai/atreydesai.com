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

    function readingTime(content: string): string {
        const words = content.trim().split(/\s+/).length;
        const mins = Math.max(1, Math.round(words / 250));
        return `${mins} min read`;
    }
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

    <p class="text-ink-600 dark:text-cream-400 mb-8">
        Thoughts, ideas, and explorations.
    </p>

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
    <div class="space-y-3 stagger-children">
        {#each filteredPosts as post (post.id)}
            <a
                href="/blog/{post.id}"
                class="block surface-card surface-card-hover border-transparent p-4 md:p-5 group no-underline"
            >
                <h2
                    class="text-lg font-semibold text-ink-900 dark:text-cream-100 mb-2 group-hover:text-accent dark:group-hover:text-accent-light transition-colors duration-200"
                >
                    {post.title}
                </h2>

                <p class="text-sm leading-relaxed text-ink-600 dark:text-cream-400 mb-3">
                    {post.excerpt}
                </p>

                <div class="flex items-center gap-4 text-sm">
                    <span class="flex items-center gap-1 text-ink-500 dark:text-ink-400">
                        <CalendarDays size={14} class="translate-y-[0.5px]" />
                        {formatDate(post.date, {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                        })}
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
            </a>
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

    <!-- Substack link -->
    <div class="mt-10 pt-6 border-t border-ink-100 dark:border-ink-800 text-sm text-ink-500 dark:text-ink-400">
        I also write on Substack —
        <a
            href={substackUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="link inline-flex items-center gap-1"
        >
            subscribe for email delivery
            <ExternalLink size={12} />
        </a>
    </div>
</div>
