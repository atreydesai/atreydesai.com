<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import RatingCircle from "$lib/components/RatingCircle.svelte";
    import { booksData } from "$lib/content";
    import {
        Star,
        BookOpenText,
        ChevronDown,
        ExternalLink,
        Search,
        X,
        Filter,
        ArrowUp,
        ArrowDown,
    } from "lucide-svelte";
    import { slide, fade } from "svelte/transition";

    // Filter state
    let selectedCategory = "all";
    let selectedTag: string | null = null;
    let searchQuery = "";
    let showTagFilter = false;

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
            ...booksData.books.flatMap((book) => book.tags || []),
            ...booksData.books.flatMap((book) => book.subcategory || []),
        ]),
    ].sort();

    // Get all unique mediums
    $: allMediums = [
        ...new Set(booksData.books.map((book) => book.medium).filter(Boolean)),
    ].sort();

    // Filter books based on category, tag, and search
    $: filteredBooks = booksData.books.filter((book) => {
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
        if (selectedTag) {
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
        selectedTag = null;
        searchQuery = "";
    }

    function selectTag(tag: string) {
        selectedTag = selectedTag === tag ? null : tag;
        showTagFilter = false;
    }

    // Helper to get category display color
    function getCategoryColor(category: string): string {
        const colors: Record<string, string> = {
            science:
                "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
            advice: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
            fiction:
                "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
            nonfiction:
                "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
        };
        return (
            colors[category] ||
            "bg-cream-200 text-ink-600 dark:bg-ink-700 dark:text-cream-300"
        );
    }
</script>

<Seo
    title="Bookshelf | Atrey Desai"
    description="Curated reading list and book recommendations by Atrey Desai - science, philosophy, fiction, and essays with personal notes and ratings."
    url="https://atreydesai.com/bookshelf"
/>

<div class="layout-main py-8 md:py-12 pb-4">
    <h1 class="heading-display text-3xl text-ink-900 dark:text-cream-100 mb-4">
        bookshelf
    </h1>

    <p class="text-ink-600 dark:text-cream-400 mb-4">
        A collection of books, essays, papers, and articles I've found valuable.
    </p>

    <!-- Instructions about TL;DR -->
    <p class="text-sm text-ink-500 dark:text-ink-400 mb-0 italic">
        Click on a book to reveal my notes/TL;DR.
    </p>
</div>

<!-- Expanded width container for bookshelf content -->
<div class="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
    <!-- Category filters -->
    <div class="flex flex-wrap gap-2 mb-6">
        {#each booksData.categories as category}
            <button
                type="button"
                class="px-3 py-1.5 text-sm rounded-full transition-all duration-300"
                class:bg-ink-900={selectedCategory === category.id}
                class:text-cream-100={selectedCategory === category.id}
                class:dark:bg-cream-100={selectedCategory === category.id}
                class:dark:text-ink-900={selectedCategory === category.id}
                class:bg-cream-200={selectedCategory !== category.id}
                class:text-ink-700={selectedCategory !== category.id}
                class:dark:bg-ink-700={selectedCategory !== category.id}
                class:dark:text-cream-300={selectedCategory !== category.id}
                class:hover:bg-cream-300={selectedCategory !== category.id}
                class:dark:hover:bg-ink-600={selectedCategory !== category.id}
                class:hover:-translate-y-0.5={selectedCategory !== category.id}
                on:click={() => (selectedCategory = category.id)}
            >
                {category.name}
            </button>
        {/each}
    </div>

    <!-- Search and Filter Bar -->
    <div class="flex flex-col sm:flex-row gap-4 mb-6">
        <!-- Search Input -->
        <div class="relative flex-1">
            <Search
                size={16}
                class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
                type="text"
                placeholder="Search reading notes..."
                bind:value={searchQuery}
                class="w-full pl-10 pr-10 py-2 text-sm bg-cream-100 dark:bg-ink-800 border border-cream-300 dark:border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 dark:focus:ring-accent-light/50 text-ink-800 dark:text-cream-200 placeholder:text-ink-400"
            />
            {#if searchQuery}
                <button
                    type="button"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 dark:hover:text-cream-300"
                    on:click={() => (searchQuery = "")}
                >
                    <X size={14} />
                </button>
            {/if}
        </div>

        <!-- Tag Filter Dropdown -->
        <div class="relative">
            <button
                type="button"
                class="flex items-center gap-2 px-4 py-2 text-sm bg-cream-100 dark:bg-ink-800 border border-cream-300 dark:border-ink-700 rounded-lg hover:bg-cream-200 dark:hover:bg-ink-700 transition-colors"
                on:click={() => (showTagFilter = !showTagFilter)}
            >
                <Filter size={14} />
                <span>{selectedTag || "Filter by tag"}</span>
                <ChevronDown
                    size={14}
                    class={`transition-transform ${showTagFilter ? "rotate-180" : ""}`}
                />
            </button>

            {#if showTagFilter}
                <div
                    class="absolute right-0 mt-2 w-64 max-h-64 overflow-y-auto bg-cream-50 dark:bg-ink-800 border border-cream-300 dark:border-ink-700 rounded-lg shadow-lg z-50"
                    transition:slide={{ duration: 200 }}
                >
                    {#if selectedTag}
                        <button
                            type="button"
                            class="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-cream-100 dark:hover:bg-ink-700"
                            on:click={() => selectTag(selectedTag || "")}
                        >
                            Clear filter
                        </button>
                        <hr class="border-cream-200 dark:border-ink-700" />
                    {/if}
                    {#each allTags as tag}
                        <button
                            type="button"
                            class="w-full px-4 py-2 text-left text-sm hover:bg-cream-100 dark:hover:bg-ink-700 transition-colors"
                            class:bg-accent-subtle={selectedTag === tag}
                            class:text-accent={selectedTag === tag}
                            on:click={() => selectTag(tag)}
                        >
                            {tag}
                        </button>
                    {/each}
                    {#if allTags.length === 0}
                        <p class="px-4 py-2 text-sm text-ink-400">
                            No tags available
                        </p>
                    {/if}
                </div>
            {/if}
        </div>
    </div>

    <!-- Active filters indicator -->
    {#if selectedTag || searchQuery}
        <div
            class="flex items-center gap-2 mb-4"
            transition:fade={{ duration: 150 }}
        >
            <span class="text-sm text-ink-500 dark:text-ink-400">Filters:</span>
            {#if selectedTag}
                <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-accent/10 text-accent dark:text-accent-light rounded-full"
                >
                    {selectedTag}
                    <button
                        type="button"
                        on:click={() => (selectedTag = null)}
                        class="hover:text-accent-dark"
                    >
                        <X size={12} />
                    </button>
                </span>
            {/if}
            {#if searchQuery}
                <span
                    class="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full"
                >
                    "{searchQuery}"
                    <button
                        type="button"
                        on:click={() => (searchQuery = "")}
                        class="hover:text-blue-800 dark:hover:text-blue-300"
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
        class="hidden md:grid grid-cols-12 gap-4 px-2 py-2 text-xs font-medium text-ink-500 dark:text-ink-400 border-b border-ink-200 dark:border-ink-700 mb-2"
    >
        <button
            on:click={() => handleSort("title")}
            class="col-span-6 flex items-center gap-1 hover:text-ink-900 dark:hover:text-cream-100 transition-colors text-left"
        >
            Title
            {#if sortField === "title"}
                <div in:fade={{ duration: 200 }}>
                    {#if sortDirection === "asc"}
                        <ArrowUp size={12} />
                    {:else}
                        <ArrowDown size={12} />
                    {/if}
                </div>
            {/if}
        </button>
        <button
            on:click={() => handleSort("category")}
            class="col-span-2 flex items-center gap-1 hover:text-ink-900 dark:hover:text-cream-100 transition-colors text-left"
        >
            Category
            {#if sortField === "category"}
                <div in:fade={{ duration: 200 }}>
                    {#if sortDirection === "asc"}
                        <ArrowUp size={12} />
                    {:else}
                        <ArrowDown size={12} />
                    {/if}
                </div>
            {/if}
        </button>
        <button
            on:click={() => handleSort("medium")}
            class="col-span-2 flex items-center gap-1 hover:text-ink-900 dark:hover:text-cream-100 transition-colors text-left"
        >
            Medium
            {#if sortField === "medium"}
                <div in:fade={{ duration: 200 }}>
                    {#if sortDirection === "asc"}
                        <ArrowUp size={12} />
                    {:else}
                        <ArrowDown size={12} />
                    {/if}
                </div>
            {/if}
        </button>
        <button
            on:click={() => handleSort("enjoyment")}
            class="col-span-1 flex items-center justify-center gap-1 hover:text-ink-900 dark:hover:text-cream-100 transition-colors"
        >
            Enjoyment
            {#if sortField === "enjoyment"}
                <div in:fade={{ duration: 200 }}>
                    {#if sortDirection === "asc"}
                        <ArrowUp size={12} />
                    {:else}
                        <ArrowDown size={12} />
                    {/if}
                </div>
            {/if}
        </button>
        <button
            on:click={() => handleSort("importance")}
            class="col-span-1 flex items-center justify-center gap-1 hover:text-ink-900 dark:hover:text-cream-100 transition-colors"
        >
            Importance
            {#if sortField === "importance"}
                <div in:fade={{ duration: 200 }}>
                    {#if sortDirection === "asc"}
                        <ArrowUp size={12} />
                    {:else}
                        <ArrowDown size={12} />
                    {/if}
                </div>
            {/if}
        </button>
    </div>

    <!-- Books list -->
    <div class="space-y-0 stagger-children">
        {#each sortedBooks as book (book.id)}
            <div class="border-b border-ink-100 dark:border-ink-800">
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
                        <div class="col-span-2">
                            <span
                                class="inline-block px-2 py-0.5 text-xs rounded {getCategoryColor(
                                    book.category,
                                )}"
                            >
                                {book.category}
                            </span>
                        </div>

                        <!-- Medium -->
                        <div class="col-span-2">
                            {#if book.medium}
                                <span
                                    class="text-xs text-ink-500 dark:text-ink-400 bg-cream-200 dark:bg-ink-700 px-2 py-0.5 rounded"
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
                                            class="text-xs text-ink-500 dark:text-ink-400 bg-cream-200 dark:bg-ink-700 px-2 py-0.5 rounded"
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
                                            class="text-xs px-2 py-0.5 bg-cream-200 dark:bg-ink-700 text-ink-600 dark:text-cream-400 rounded hover:bg-cream-300 dark:hover:bg-ink-600 transition-colors"
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
                                        class="inline-flex items-center gap-1 text-sm text-accent dark:text-accent-light hover:underline"
                                        on:click|stopPropagation
                                    >
                                        <ExternalLink size={14} />
                                        View Source
                                    </a>
                                {/if}
                                {#if book.subcategory && book.subcategory.length > 0}
                                    {#each book.subcategory as sub}
                                        <span
                                            class="pill text-xs px-2 py-0.5 bg-cream-200 dark:bg-ink-700 rounded text-ink-600 dark:text-cream-400"
                                        >
                                            {sub}
                                        </span>
                                    {/each}
                                {/if}
                                <span
                                    class="text-xs text-ink-400 dark:text-ink-500"
                                >
                                    Added {new Date(
                                        book.dateAdded,
                                    ).toLocaleDateString("en-US", {
                                        month: "short",
                                        year: "numeric",
                                    })}
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
            {#if searchQuery || selectedTag}
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
