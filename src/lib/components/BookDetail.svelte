<script lang="ts">
    import { onMount } from "svelte";
    import RatingGlyph from "$lib/components/RatingGlyph.svelte";
    import type { Book } from "$lib/books";
    import { formatMonthYear } from "$lib/utils/date";
    import { parseInline } from "$lib/utils/text";
    import {
        bookTags,
        currentStatusLabel,
        getCategoryColor,
        getNoteParagraphs,
        isCurrent,
        ratingLegend,
    } from "$lib/bookshelf";
    import {
        ArrowUpRight,
        BadgeQuestionMark,
        Bookmark,
        Heart,
        PanelRightClose,
        Star,
        X,
    } from "@jis3r/icons";

    export let book: Book;
    /**
     * `sidebar` is the sticky desktop column; `sheet` is the narrow-screen
     * presentation, where the parent wraps this in a modal container. The
     * only difference here is the dismiss glyph and who owns the height.
     */
    export let variant: "sidebar" | "sheet" = "sidebar";
    export let onClose: () => void;
    export let onSelectCategory: (category: string) => void;
    export let onSelectTag: (tag: string) => void;
    /** Move focus to the dismiss control on mount (used by the sheet). */
    export let autofocus = false;

    let closeButton: HTMLButtonElement | undefined;

    // Short names for the places entries link out to; anything else shows
    // its bare host.
    const SOURCE_NAMES: Record<string, string> = {
        "goodreads.com": "goodreads",
        "mydramalist.com": "mydramalist",
        "letterboxd.com": "letterboxd",
        "en.wikipedia.org": "wikipedia",
        "arxiv.org": "arxiv",
        "imdb.com": "imdb",
    };

    function sourceName(url: string): string {
        try {
            const host = new URL(url).hostname.replace(/^www\./, "");
            return SOURCE_NAMES[host] ?? host;
        } catch {
            return "source";
        }
    }

    $: noteParagraphs = getNoteParagraphs(book);
    // Tags that only repeat the category or medium (which lead the tag row)
    // add nothing.
    $: tags = bookTags(book).filter(
        (tag) =>
            ![book.category, book.medium]
                .filter(Boolean)
                .some((shown) => shown!.toLowerCase() === tag.toLowerCase()),
    );
    // One outbound link: the Letterboxd page when there is one (the
    // canonical film record), otherwise the entry's own source.
    $: sourceUrl = book.letterboxdUrl || book.url || "";
    $: added = Number.isNaN(new Date(book.dateAdded).getTime())
        ? ""
        : formatMonthYear(book.dateAdded).toLowerCase();

    onMount(() => {
        if (autofocus) closeButton?.focus();
    });
</script>

<!-- Ordered by what a visitor wants, in turn: what is it, what kind of thing
     is it, did he like it, and what did he think. -->
<div class="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
    <div class="min-w-0">
        <h2 class="text-balance font-ui text-xl font-normal leading-snug tracking-[-0.005em] text-ink-900 dark:text-cream-100">
            {book.title}
        </h2>
        {#if book.author}
            <p class="mt-1 font-ui text-sm text-ink-500 dark:text-cream-400">
                {book.author}
            </p>
        {/if}
    </div>
    <button
        type="button"
        bind:this={closeButton}
        class="-mr-1.5 -mt-1 shrink-0 p-1.5 text-ink-500 transition-colors hover:text-ink-900 dark:text-cream-400 dark:hover:text-cream-100"
        on:click={onClose}
        aria-label="Close details"
    >
        {#if variant === "sheet"}
            <X size={18} />
        {:else}
            <PanelRightClose size={18} />
        {/if}
    </button>
</div>

<div class="book-detail-body overflow-y-auto px-5 pb-5">
    <!-- Did he like it, when, and where to find it: one quiet line. -->
    <div class="type-meta flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-500 dark:text-cream-400">
        <!-- Unrated entries skip the meters rather than show placeholders. -->
        {#if book.enjoyment != null}
            <span class="inline-flex items-center gap-1.5" title={ratingLegend.enjoyment.title}>
                <span class="sr-only">{ratingLegend.enjoyment.title}</span>
                <Heart size={12} />
                <RatingGlyph value={book.enjoyment} type="enjoyment" />
            </span>
        {/if}
        {#if book.importance != null}
            <span class="inline-flex items-center gap-1.5" title={ratingLegend.importance.title}>
                <span class="sr-only">{ratingLegend.importance.title}</span>
                <BadgeQuestionMark size={12} />
                <RatingGlyph value={book.importance} type="importance" />
            </span>
        {/if}
        {#if added || sourceUrl}
            <span class="inline-flex items-center gap-3">
                {#if added}<span>added {added}</span>{/if}
                {#if sourceUrl}
                    <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="link-subtle inline-flex items-center gap-0.5"
                    >
                        {sourceName(sourceUrl)}
                        <ArrowUpRight size={12} />
                    </a>
                {/if}
            </span>
        {/if}
    </div>

    <!-- What he thought. The first paragraph is the summary, so it leads at
         reading size; the rest follow as ordinary notes. -->
    <div class="stagger-children mt-5 space-y-5 border-t border-ink-200/80 pt-5 dark:border-ink-800">
        {#if noteParagraphs.length > 0}
            <div class="space-y-3">
                <p class="text-[0.95rem] leading-relaxed text-ink-800 dark:text-cream-200">
                    {@html parseInline(noteParagraphs[0])}
                </p>
                {#each noteParagraphs.slice(1) as paragraph}
                    <p class="text-sm leading-6 text-ink-600 dark:text-cream-300">
                        {@html parseInline(paragraph)}
                    </p>
                {/each}
            </div>
        {:else}
            <p class="text-sm text-ink-400 dark:text-cream-500">No notes yet.</p>
        {/if}

        {#if book.quotes && book.quotes.length > 0}
            <section aria-label="Quotes" class="space-y-3">
                {#each book.quotes as quote}
                    <blockquote class="border-l-2 border-accent/35 pl-3 text-sm italic leading-6 text-ink-600 dark:border-accent-light/35 dark:text-cream-300">
                        {@html parseInline(quote)}
                    </blockquote>
                {/each}
            </section>
        {/if}

        <!-- Category, medium, and reading state lead the tags: the broadest
             facts first. -->
        <div class="flex flex-wrap gap-1.5" aria-label="Tags">
            <button
                type="button"
                class="pill {getCategoryColor(book.category)}"
                on:click={() => onSelectCategory(book.category)}
            >
                {book.category}
            </button>
            {#if book.medium}
                <span class="pill text-ink-600 dark:text-cream-300">{book.medium}</span>
            {/if}
            {#if isCurrent(book)}
                <span class="pill text-ochre-dark dark:text-ochre-light">
                    <Bookmark size={11} class="fill-current" />
                    {currentStatusLabel(book)}
                </span>
            {/if}
            {#if book.favorite}
                <button
                    type="button"
                    class="pill text-accent dark:text-accent-light"
                    on:click={() => onSelectCategory("favorites")}
                >
                    <Star size={11} class="fill-current" />
                    favorite
                </button>
            {/if}
            {#each tags as tag}
                <button
                    type="button"
                    class="pill"
                    on:click={() => onSelectTag(tag)}
                >
                    {tag}
                </button>
            {/each}
        </div>
    </div>
</div>

<style>
    /* In the sidebar the panel is pinned next to a long list, so the body
       scrolls within a viewport-relative cap. In the sheet the modal wrapper
       owns the height and this just fills it. */
    .book-detail-body {
        max-height: calc(100dvh - 14rem);
    }

    :global(.book-detail-sheet) .book-detail-body {
        max-height: none;
        flex: 1 1 auto;
    }
</style>
