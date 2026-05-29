<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import RatingCircle from "$lib/components/RatingCircle.svelte";
    import CustomSelect from "$lib/components/CustomSelect.svelte";
    import { books, categories } from "$lib/content";
    import { formatMonthYear } from "$lib/utils/date";
    import {
        Star,
        BookOpenText,
        ChevronDown,
        Search,
    } from "lucide-svelte";
    import { ArrowUp, ArrowDown, X, CircleArrowOutUpRight } from "@jis3r/icons";
    import { fade, slide } from "svelte/transition";
    import { flip } from "svelte/animate";

    // Filter state
    let selectedCategory = "all";
    let selectedTag: string = "all";
    let searchQuery = "";

    // Sort state
    let sortField:
        | "title"
        | "category"
        | "medium"
        | "enjoyment"
        | "importance"
        | "dateAdded" = "dateAdded";
    let sortDirection: "asc" | "desc" = "desc";

    function handleSort(field: typeof sortField) {
        if (sortField === field) {
            sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
            sortField = field;
            sortDirection =
                field === "enjoyment" ||
                field === "importance" ||
                field === "dateAdded"
                    ? "desc"
                    : "asc";
        }
    }

    // Track which books have notes revealed
    let revealedNotes: Set<string> = new Set();

    function toggleNotes(bookId: string) {
        if (revealedNotes.has(bookId)) {
            revealedNotes.delete(bookId);
        } else {
            revealedNotes.add(bookId);
        }
        revealedNotes = revealedNotes; // Trigger reactivity
    }

    // Get all unique tags and subcategories across books
    $: allTags = [
        ...new Set([
            ...books.flatMap((book) => book.tags || []),
            ...books.flatMap((book) => book.subcategory || []),
        ]),
    ].sort();

    $: categoryOptions = categories.map((c) => ({
        value: c.id,
        label: c.name,
    }));
    $: tagOptions = [
        { value: "all", label: "All Tags" },
        ...allTags.map((t) => ({ value: t, label: t })),
    ];

    // Get all unique mediums
    $: allMediums = [
        ...new Set(books.map((book) => book.medium).filter(Boolean)),
    ].sort();

    // Filter books based on category, tag, and search
    $: filteredBooks = books.filter((book) => {
        // Category filter
        if (selectedCategory !== "all") {
            if (selectedCategory === "favorites" && !book.favorite)
                return false;
            if (
                selectedCategory !== "favorites" &&
                book.category !== selectedCategory
            )
                return false;
        }

        // Tag filter (checks tags AND subcategories)
        if (selectedTag && selectedTag !== "all") {
            const hasTag = book.tags && book.tags.includes(selectedTag);
            const hasSubcategory =
                book.subcategory && book.subcategory.includes(selectedTag);
            if (!hasTag && !hasSubcategory) {
                return false;
            }
        }

        // Search filter (search in notes/content)
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const searchableText =
                `${book.title} ${book.author} ${book.notes || ""} ${book.content || ""}`.toLowerCase();
            if (!searchableText.includes(query)) return false;
        }

        return true;
    });

    // Sort books
    $: sortedBooks = [...filteredBooks].sort((a, b) => {
        const modifier = sortDirection === "asc" ? 1 : -1;

        if (sortField === "title") {
            return modifier * a.title.localeCompare(b.title);
        } else if (sortField === "category") {
            return modifier * a.category.localeCompare(b.category);
        } else if (sortField === "medium") {
            return modifier * (a.medium || "").localeCompare(b.medium || "");
        } else if (sortField === "enjoyment") {
            return modifier * ((a.enjoyment || 0) - (b.enjoyment || 0));
        } else if (sortField === "importance") {
            return modifier * ((a.importance || 0) - (b.importance || 0));
        } else {
            // dateAdded
            return (
                modifier *
                (new Date(a.dateAdded).getTime() -
                    new Date(b.dateAdded).getTime())
            );
        }
    });

    function clearFilters() {
        selectedCategory = "all";
        selectedTag = "all";
        searchQuery = "";
    }

    function selectTag(tag: string) {
        selectedTag = selectedTag === tag ? "all" : tag;
    }

    // Helper to get category display color (text/border only — transparent bg)
    function getCategoryColor(category: string): string {
        const colors: Record<string, string> = {
            science: "text-sage-dark dark:text-sage-light",
            advice: "text-ochre-dark dark:text-ochre-light",
            fiction: "text-wine-dark dark:text-wine-light",
            nonfiction: "text-steel-dark dark:text-steel-light",
            "blog post": "text-plum-dark dark:text-plum-light",
        };
        return colors[category] || "text-ink-600 dark:text-cream-300";
    }

    let hoveredSortCol: string | null = null;
    let hoveredSourceId: string | null = null;
</script>

<Seo
    title="Bookshelf | Atrey Desai"
    description="Curated reading list and book recommendations by Atrey Desai - science, philosophy, fiction, and essays with personal notes and ratings."
    url="https://atreydesai.com/bookshelf"
/>

<div class="max-w-6xl mx-auto px-4 sm:px-6 pt-8 md:pt-12 pb-12">
    <div class="mb-6">
        <h1 class="heading-display text-3xl text-ink-900 dark:text-cream-100 mb-4">
            bookshelf
        </h1>

        <p class="deck text-ink-600 dark:text-cream-400 mb-4">
            A collection of books, essays, papers, and articles I've found valuable.
        </p>

    </div>

    <!-- Filters bar -->
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <!-- Search Input -->
        <div class="relative flex-1">
            <Search
                size={14}
                class="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
                type="text"
                placeholder="Search reading notes..."
                bind:value={searchQuery}
                class="w-full pl-8 pr-8 py-1.5 text-[0.78rem] font-medium tracking-[0.01em] bg-transparent border border-ink-200 dark:border-ink-700 rounded text-ink-700 dark:text-cream-300 placeholder:text-ink-400 placeholder:font-normal focus:outline-none focus:border-accent dark:focus:border-accent-light transition-colors duration-300"
            />
            {#if searchQuery}
                <button
                    type="button"
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-cream-300"
                    on:click={() => { searchQuery = ""; }}
                >
                    <X size={12} />
                </button>
            {/if}
        </div>

        <div class="flex flex-wrap items-center gap-3">
            <CustomSelect
                options={categoryOptions}
                bind:value={selectedCategory}
                placeholder="All Categories"
            />
            <CustomSelect
                options={tagOptions}
                bind:value={selectedTag}
                placeholder="All Tags"
            />
        </div>
    </div>

    <!-- Active filters indicator -->
    {#if (selectedTag && selectedTag !== "all") || searchQuery}
        <div
            class="flex items-center gap-2 mb-4"
            transition:fade={{ duration: 150 }}
        >
            <span class="text-sm text-ink-500 dark:text-ink-400">Filters:</span>
            {#if selectedTag && selectedTag !== "all"}
                <span
                    class="pill text-accent dark:text-accent-light"
                >
                    {selectedTag}
                    <button
                        type="button"
                        on:click={() => (selectedTag = "all")}
                        class="hover:text-accent-dark"
                    >
                        <X size={12} />
                    </button>
                </span>
            {/if}
            {#if searchQuery}
                <span
                    class="pill text-steel-dark dark:text-steel-light"
                >
                    "{searchQuery}"
                    <button
                        type="button"
                        on:click={() => { searchQuery = ""; }}
                        class="hover:text-steel dark:hover:text-steel-light"
                    >
                        <X size={12} />
                    </button>
                </span>
            {/if}
            <button
                type="button"
                class="text-xs text-ink-500 hover:text-ink-700 dark:hover:text-cream-300 underline"
                on:click={clearFilters}
            >
                Clear all
            </button>
        </div>
    {/if}

    <!-- Table Header (desktop only) -->
    <div
        class="hidden md:grid grid-cols-12 gap-4 py-2 text-xs font-medium text-ink-500 dark:text-ink-400 border-b border-ink-200 dark:border-ink-700 mb-2"
    >
        <button
            on:click={() => handleSort("title")}
            on:mouseenter={() => (hoveredSortCol = "title")}
            on:mouseleave={() => (hoveredSortCol = null)}
            class="col-span-6 flex items-center gap-1 hover:text-ink-900 dark:hover:text-cream-100 transition-colors text-left"
        >
            Title
            {#if sortField === "title"}
                <div in:fade={{ duration: 200 }}>
                    {#if sortDirection === "asc"}
                        <ArrowUp size={12} animate={hoveredSortCol === "title"} />
                    {:else}
                        <ArrowDown size={12} animate={hoveredSortCol === "title"} />
                    {/if}
                </div>
            {/if}
        </button>
        <button
            on:click={() => handleSort("category")}
            on:mouseenter={() => (hoveredSortCol = "category")}
            on:mouseleave={() => (hoveredSortCol = null)}
            class="col-span-2 flex items-center gap-1 hover:text-ink-900 dark:hover:text-cream-100 transition-colors text-left"
        >
            Category
            {#if sortField === "category"}
                <div in:fade={{ duration: 200 }}>
                    {#if sortDirection === "asc"}
                        <ArrowUp size={12} animate={hoveredSortCol === "category"} />
                    {:else}
                        <ArrowDown size={12} animate={hoveredSortCol === "category"} />
                    {/if}
                </div>
            {/if}
        </button>
        <button
            on:click={() => handleSort("medium")}
            on:mouseenter={() => (hoveredSortCol = "medium")}
            on:mouseleave={() => (hoveredSortCol = null)}
            class="col-span-2 flex items-center gap-1 hover:text-ink-900 dark:hover:text-cream-100 transition-colors text-left"
        >
            Medium
            {#if sortField === "medium"}
                <div in:fade={{ duration: 200 }}>
                    {#if sortDirection === "asc"}
                        <ArrowUp size={12} animate={hoveredSortCol === "medium"} />
                    {:else}
                        <ArrowDown size={12} animate={hoveredSortCol === "medium"} />
                    {/if}
                </div>
            {/if}
        </button>
        <button
            on:click={() => handleSort("enjoyment")}
            on:mouseenter={() => (hoveredSortCol = "enjoyment")}
            on:mouseleave={() => (hoveredSortCol = null)}
            class="col-span-1 flex items-center justify-center gap-1 text-center hover:text-ink-900 dark:hover:text-cream-100 transition-colors"
        >
            Enjoyment
            {#if sortField === "enjoyment"}
                <div in:fade={{ duration: 200 }}>
                    {#if sortDirection === "asc"}
                        <ArrowUp size={12} animate={hoveredSortCol === "enjoyment"} />
                    {:else}
                        <ArrowDown size={12} animate={hoveredSortCol === "enjoyment"} />
                    {/if}
                </div>
            {/if}
        </button>
        <button
            on:click={() => handleSort("importance")}
            on:mouseenter={() => (hoveredSortCol = "importance")}
            on:mouseleave={() => (hoveredSortCol = null)}
            class="col-span-1 flex items-center justify-center gap-1 text-center hover:text-ink-900 dark:hover:text-cream-100 transition-colors"
        >
            Importance
            {#if sortField === "importance"}
                <div in:fade={{ duration: 200 }}>
                    {#if sortDirection === "asc"}
                        <ArrowUp size={12} animate={hoveredSortCol === "importance"} />
                    {:else}
                        <ArrowDown size={12} animate={hoveredSortCol === "importance"} />
                    {/if}
                </div>
            {/if}
        </button>
    </div>

    <!-- Books list -->
    <div class="space-y-0">
        {#each sortedBooks as book, i (book.id)}
            <div
                class="border-b border-ink-100 dark:border-ink-800"
                in:fade|local={{ duration: 220, delay: Math.min(i, 9) * 25 }}
                out:fade|local={{ duration: 140 }}
                animate:flip={{ duration: 280 }}
            >
                <!-- Clickable header -->
                <button
                    type="button"
                    class="w-full py-3 text-left group transition-all duration-200 hover:bg-cream-50 dark:hover:bg-ink-800/50 -mx-2 px-2 rounded"
                    on:click={() => toggleNotes(book.id)}
                >
                    <!-- Desktop: Table row layout -->
                    <div class="hidden md:grid grid-cols-12 gap-4 items-center">
                        <!-- Title -->
                        <div class="col-span-6 flex items-center gap-2">
                            {#if book.favorite}
                                <Star
                                    size={14}
                                    class="text-amber-500 fill-amber-500 flex-shrink-0"
                                />
                            {/if}
                            <span
                                class="font-medium text-ink-900 dark:text-cream-100 group-hover:text-accent dark:group-hover:text-accent-light transition-colors truncate"
                            >
                                {book.title}
                            </span>
                            {#if book.notes || book.content}
                                <span
                                    class="text-ink-400 transition-transform duration-300 flex-shrink-0"
                                    class:rotate-180={revealedNotes.has(
                                        book.id,
                                    )}
                                >
                                    <ChevronDown size={14} />
                                </span>
                            {/if}
                        </div>

                        <!-- Category -->
                        <div class="col-span-2 pl-1">
                            <span
                                class="inline-block px-2 py-0.5 text-xs rounded border border-current bg-transparent {getCategoryColor(
                                    book.category,
                                )}"
                            >
                                {book.category}
                            </span>
                        </div>

                        <!-- Medium -->
                        <div class="col-span-2 pl-1">
                            {#if book.medium}
                                <span
                                    class="pill !font-normal"
                                >
                                    {book.medium}
                                </span>
                            {:else}
                                <span class="text-xs text-ink-400">--</span>
                            {/if}
                        </div>

                        <!-- Enjoyment -->
                        <div class="col-span-1 flex justify-center">
                            <RatingCircle
                                value={book.enjoyment}
                                type="enjoyment"
                                size={28}
                            />
                        </div>

                        <!-- Importance -->
                        <div class="col-span-1 flex justify-center">
                            <RatingCircle
                                value={book.importance}
                                type="importance"
                                size={28}
                            />
                        </div>
                    </div>

                    <!-- Mobile: Stack layout -->
                    <div class="md:hidden">
                        <div class="flex items-start justify-between gap-2">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    {#if book.favorite}
                                        <Star
                                            size={14}
                                            class="text-amber-500 fill-amber-500"
                                        />
                                    {/if}
                                    <h3
                                        class="font-medium text-ink-900 dark:text-cream-100 group-hover:text-accent dark:group-hover:text-accent-light transition-colors"
                                    >
                                        {book.title}
                                    </h3>
                                    {#if book.notes || book.content}
                                        <span
                                            class="text-ink-400 transition-transform duration-300"
                                            class:rotate-180={revealedNotes.has(
                                                book.id,
                                            )}
                                        >
                                            <ChevronDown size={14} />
                                        </span>
                                    {/if}
                                </div>
                                <p
                                    class="text-sm text-ink-500 dark:text-ink-400 mb-2"
                                >
                                    {book.author}
                                </p>
                                <!-- Pills row -->
                                <div class="flex flex-wrap gap-2">
                                    <span
                                        class="inline-block px-2 py-0.5 text-xs rounded {getCategoryColor(
                                            book.category,
                                        )}"
                                    >
                                        {book.category}
                                    </span>
                                    {#if book.medium}
                                        <span
                                            class="pill"
                                        >
                                            {book.medium}
                                        </span>
                                    {/if}
                                </div>
                            </div>
                            <!-- Ratings on right -->
                            <div class="flex gap-2">
                                <RatingCircle
                                    value={book.enjoyment}
                                    type="enjoyment"
                                    size={28}
                                />
                                <RatingCircle
                                    value={book.importance}
                                    type="importance"
                                    size={28}
                                />
                            </div>
                        </div>
                    </div>
                </button>

                <!-- Animated notes reveal -->
                {#if revealedNotes.has(book.id) && (book.notes || book.content)}
                    <div
                        class="pb-4 px-2 -mx-2"
                        transition:slide={{ duration: 300 }}
                    >
                        <div
                            class="pl-6 border-l-2 border-accent/30 dark:border-accent-light/30 space-y-4"
                        >
                            <!-- Author (desktop) -->
                            <p
                                class="hidden md:block text-sm text-ink-500 dark:text-ink-400"
                            >
                                by {book.author}
                            </p>

                            <!-- Notes -->
                            <div>
                                <p
                                    class="text-sm text-ink-600 dark:text-cream-400"
                                >
                                    {book.notes || book.content}
                                </p>
                            </div>

                            <!-- Quotes -->
                            {#if book.quotes && book.quotes.length > 0}
                                <div class="mt-4">
                                    <h4
                                        class="text-xs font-medium text-ink-500 dark:text-ink-400 mb-2 uppercase tracking-wide"
                                    >
                                        Quotes
                                    </h4>
                                    <div class="space-y-2">
                                        {#each book.quotes as quote}
                                            <blockquote
                                                class="text-sm italic text-ink-600 dark:text-cream-400 pl-4 border-l-2 border-ink-200 dark:border-ink-700"
                                            >
                                                "{quote}"
                                            </blockquote>
                                        {/each}
                                    </div>
                                </div>
                            {/if}

                            <!-- Tags (full list) -->
                            {#if book.tags && book.tags.length > 0}
                                <div class="flex flex-wrap gap-2 mt-3">
                                    {#each book.tags as tag}
                                        <button
                                            type="button"
                                            class="pill hover:bg-cream-200/40 dark:hover:bg-ink-700/40 transition-colors"
                                            on:click|stopPropagation={() =>
                                                selectTag(tag)}
                                        >
                                            {tag}
                                        </button>
                                    {/each}
                                </div>
                            {/if}

                            <!-- Footer: URL link, subcategory, date -->
                            <div class="mt-3 flex flex-wrap items-center gap-3">
                                {#if book.url}
                                    <a
                                        href={book.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="inline-flex items-center gap-1.5 text-sm text-accent dark:text-accent-light hover:underline"
                                        on:click|stopPropagation
                                        on:mouseenter={() => (hoveredSourceId = book.id)}
                                        on:mouseleave={() => (hoveredSourceId = null)}
                                    >
                                        <CircleArrowOutUpRight size={14} animate={hoveredSourceId === book.id} />
                                        View Source
                                    </a>
                                {/if}
                                {#if book.subcategory && book.subcategory.length > 0}
                                    {#each book.subcategory as sub}
                                        <button
                                            type="button"
                                            class="pill hover:bg-cream-200/40 dark:hover:bg-ink-700/40 transition-colors cursor-pointer"
                                            on:click|stopPropagation={() =>
                                                selectTag(sub)}
                                        >
                                            {sub}
                                        </button>
                                    {/each}
                                {/if}
                                <span
                                    class="text-xs text-ink-400 dark:text-ink-500"
                                >
                                    Added {formatMonthYear(book.dateAdded)}
                                </span>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>
        {/each}
    </div>

    <!-- Empty state -->
    {#if sortedBooks.length === 0}
        <div class="text-center py-12 text-ink-500 dark:text-ink-400">
            <BookOpenText size={48} class="mx-auto mb-4 opacity-50" />
            {#if searchQuery || (selectedTag && selectedTag !== "all")}
                <p>No books match your filters.</p>
                <button
                    type="button"
                    class="mt-2 text-accent dark:text-accent-light hover:underline"
                    on:click={clearFilters}
                >
                    Clear filters
                </button>
            {:else}
                <p>No books in this category yet.</p>
            {/if}
        </div>
    {/if}
</div>
