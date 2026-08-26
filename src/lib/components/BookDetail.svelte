<script lang="ts">
    import { onMount } from "svelte";
    import MediumIcon from "$lib/components/MediumIcon.svelte";
    import RatingGlyph from "$lib/components/RatingGlyph.svelte";
    import type { Book } from "$lib/content";
    import { formatMonthYear } from "$lib/utils/date";
    import { parseInline } from "$lib/utils/text";
    import {
        bookTags,
        currentStatusLabel,
        getCategoryColor,
        getNoteParagraphs,
        isCurrent,
        ratingLegend,
        shortDate,
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

    $: noteParagraphs = getNoteParagraphs(book);
    $: tags = bookTags(book);

    onMount(() => {
        if (autofocus) closeButton?.focus();
    });
</script>

<div class="flex items-start justify-between gap-4 border-b border-ink-200/90 p-4 dark:border-ink-800">
    <div class="min-w-0">
        <h2 class="flex items-start gap-2 text-balance text-xl font-medium leading-snug text-ink-900 dark:text-cream-100">
            <MediumIcon
                medium={book.medium}
                size={20}
                animate
                className="mt-1 shrink-0 text-ink-500 dark:text-cream-400"
            />
            <span>{book.title}</span>
        </h2>
        {#if book.author}
            <p class="mt-1 text-sm text-ink-500 dark:text-cream-400">
                by {book.author}
            </p>
        {/if}
    </div>
    <button
        type="button"
        bind:this={closeButton}
        class="shrink-0 p-1.5 text-ink-500 transition-colors hover:text-ink-900 dark:text-cream-400 dark:hover:text-cream-100"
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

<div class="stagger-children book-detail-body space-y-5 overflow-y-auto p-4">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-2">
        <button
            type="button"
            class="pill {getCategoryColor(book.category)}"
            on:click={() => onSelectCategory(book.category)}
        >
            {book.category}
        </button>
        {#if book.medium}
            <span class="pill text-ink-600 dark:text-cream-300">
                {book.medium}
            </span>
        {/if}
        {#if isCurrent(book)}
            <span class="pill text-ochre-dark dark:text-ochre-light">
                <Bookmark size={12} class="fill-current" />
                {currentStatusLabel(book)}
            </span>
        {/if}
        {#if book.favorite}
            <button
                type="button"
                class="pill text-accent dark:text-accent-light"
                on:click={() => onSelectCategory("favorites")}
            >
                <Star size={12} class="fill-current" />
                favorite
            </button>
        {/if}

        <!-- Ratings and date ride the pill line rather than a labelled
             three-column grid below it, which costs the panel ~75px of height
             before any actual content. Same icon + compact-meter treatment the
             card list already uses, so the glyphs read the same in both places:
             the icon and colour carry what the "Appreciation" / "Importance"
             headings used to, and each meter keeps its own title tooltip. -->
        <div
            class="ml-auto flex items-center gap-x-3 type-meta text-ink-500 dark:text-cream-400"
        >
            <span class="inline-flex items-center gap-1.5">
                <span class="sr-only">{ratingLegend.enjoyment.title}</span>
                <Heart size={12} />
                <RatingGlyph value={book.enjoyment} type="enjoyment" compact />
            </span>
            <span class="inline-flex items-center gap-1.5">
                <span class="sr-only">{ratingLegend.importance.title}</span>
                <BadgeQuestionMark size={12} />
                <RatingGlyph value={book.importance} type="importance" compact />
            </span>
            <span class="tabular-nums">{shortDate(book.dateAdded)}</span>
        </div>
    </div>

    {#if noteParagraphs.length > 0}
        <section>
            <div class="section-rule mb-2 gap-3">
                <h3 class="meta-label">TLDR</h3>
                <div class="section-rule-line"></div>
            </div>
            <p class="text-sm leading-6 text-ink-700 dark:text-cream-300">
                {@html parseInline(noteParagraphs[0])}
            </p>
        </section>

        {#if noteParagraphs.length > 1}
            <section>
                <div class="section-rule mb-2 gap-3">
                    <h3 class="meta-label">Notes</h3>
                    <div class="section-rule-line"></div>
                </div>
                <div class="space-y-3 border-l-2 border-ink-200 pl-4 dark:border-ink-700">
                    {#each noteParagraphs.slice(1) as paragraph}
                        <p class="text-sm leading-6 text-ink-700 dark:text-cream-300">
                            {@html parseInline(paragraph)}
                        </p>
                    {/each}
                </div>
            </section>
        {/if}
    {:else}
        <section>
            <div class="section-rule mb-2 gap-3">
                <h3 class="meta-label">Notes</h3>
                <div class="section-rule-line"></div>
            </div>
            <p class="text-sm text-ink-500 dark:text-cream-400">
                No notes added yet.
            </p>
        </section>
    {/if}

    {#if book.quotes && book.quotes.length > 0}
        <section>
            <div class="section-rule mb-2 gap-3">
                <h3 class="meta-label">Quotes</h3>
                <div class="section-rule-line"></div>
            </div>
            <div class="space-y-3">
                {#each book.quotes as quote}
                    <blockquote class="border-l-2 border-accent/35 pl-4 text-sm italic leading-6 text-ink-600 dark:border-accent-light/35 dark:text-cream-300">
                        {@html parseInline(quote)}
                    </blockquote>
                {/each}
            </div>
        </section>
    {/if}

    {#if tags.length > 0}
        <section>
            <div class="section-rule mb-2 gap-3">
                <h3 class="meta-label">Tags</h3>
                <div class="section-rule-line"></div>
            </div>
            <div class="flex flex-wrap gap-1.5">
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
        </section>
    {/if}

    <section>
        <div class="section-rule mb-2 gap-3">
            <h3 class="meta-label">Source</h3>
            <div class="section-rule-line"></div>
        </div>
        <div class="flex flex-wrap items-center gap-3">
            {#if book.url && book.url !== book.letterboxdUrl}
                <a
                    href={book.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="control-compact inline-flex items-center gap-1.5 border border-ink-900 bg-ink-900 text-sm text-cream-100 transition-colors hover:bg-ink-700 dark:border-cream-100 dark:bg-cream-100 dark:text-ink-900 dark:hover:bg-cream-200"
                >
                    View source
                    <ArrowUpRight size={14} />
                </a>
            {/if}
            {#if book.letterboxdUrl}
                <a
                    href={book.letterboxdUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="control-compact inline-flex items-center gap-1.5 border border-ink-300 bg-cream-50 text-sm text-ink-800 transition-colors hover:border-ink-900 hover:bg-white dark:border-ink-600 dark:bg-ink-800 dark:text-cream-200 dark:hover:border-cream-100 dark:hover:bg-ink-700"
                >
                    Letterboxd
                    <ArrowUpRight size={14} />
                </a>
            {/if}
            {#if !book.url && !book.letterboxdUrl}
                <span class="text-sm text-ink-500 dark:text-cream-400">
                    No source link.
                </span>
            {/if}
            {#if !Number.isNaN(new Date(book.dateAdded).getTime())}
                <span class="text-xs text-ink-400 dark:text-cream-500">
                    Added {formatMonthYear(book.dateAdded)}
                </span>
            {/if}
        </div>
    </section>
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
