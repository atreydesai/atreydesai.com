<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import booksData from "$lib/../data/books.json";
    import Star from "lucide-svelte/icons/star";
    import BookOpen from "lucide-svelte/icons/book-open";
    import ChevronDown from "lucide-svelte/icons/chevron-down";
    import { slide } from "svelte/transition";

    // Filter state
    let selectedCategory = "all";

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

    // Filter books based on category
    $: filteredBooks = booksData.books.filter((book) => {
        if (selectedCategory === "all") return true;
        if (selectedCategory === "favorites") return book.favorite;
        return book.category === selectedCategory;
    });

    // Sort by date added (newest first)
    $: sortedBooks = [...filteredBooks].sort(
        (a, b) =>
            new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime(),
    );

    function renderStars(count: number) {
        return "★".repeat(count) + "☆".repeat(5 - count);
    }
</script>

<Seo
    title="Bookshelf | Atrey Desai"
    description="Reading list and book recommendations by Atrey Desai."
/>

<div class="layout-main py-8 md:py-12">
    <h1 class="heading-display text-3xl text-ink-900 dark:text-cream-100 mb-4">
        bookshelf
    </h1>

    <p class="text-ink-600 dark:text-cream-400 mb-4">
        A collection of books, essays, papers, and articles I've found valuable.
    </p>

    <!-- Instructions about TL;DR -->
    <p class="text-sm text-ink-500 dark:text-ink-400 mb-8 italic">
        Click on a book to reveal my notes/TL;DR.
    </p>

    <!-- Category filters -->
    <div class="flex flex-wrap gap-2 mb-8">
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

    <!-- Books list -->
    <div class="space-y-2">
        {#each sortedBooks as book (book.id)}
            <div class="border-b border-ink-100 dark:border-ink-800">
                <!-- Clickable header -->
                <button
                    type="button"
                    class="w-full py-4 text-left group transition-all duration-200 hover:bg-cream-50 dark:hover:bg-ink-800/50 -mx-2 px-2 rounded"
                    on:click={() => toggleNotes(book.id)}
                >
                    <div class="flex items-start justify-between gap-4">
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
                                {#if book.notes}
                                    <span
                                        class="text-ink-400 transition-transform duration-300"
                                        class:rotate-180={revealedNotes.has(
                                            book.id,
                                        )}
                                    >
                                        <ChevronDown size={16} />
                                    </span>
                                {/if}
                            </div>
                            <p class="text-sm text-ink-500 dark:text-ink-400">
                                {book.author}
                            </p>
                        </div>

                        <div class="text-right flex-shrink-0">
                            <!-- Ratings -->
                            <div
                                class="text-xs text-ink-400 dark:text-ink-500 space-y-1"
                            >
                                <div>
                                    <span class="text-ink-500 dark:text-ink-400"
                                        >enjoyment:</span
                                    >
                                    <span class="text-amber-500"
                                        >{renderStars(book.enjoyment)}</span
                                    >
                                </div>
                                <div>
                                    <span class="text-ink-500 dark:text-ink-400"
                                        >importance:</span
                                    >
                                    <span class="text-blue-500"
                                        >{renderStars(book.importance)}</span
                                    >
                                </div>
                            </div>
                        </div>
                    </div>
                </button>

                <!-- Animated notes reveal -->
                {#if revealedNotes.has(book.id) && book.notes}
                    <div
                        class="pb-4 px-2 -mx-2"
                        transition:slide={{ duration: 300 }}
                    >
                        <div
                            class="pl-6 border-l-2 border-accent/30 dark:border-accent-light/30"
                        >
                            <p
                                class="text-sm text-ink-600 dark:text-cream-400 italic"
                            >
                                {book.notes}
                            </p>
                        </div>

                        <!-- Category pill and date -->
                        <div class="mt-3 flex items-center gap-3">
                            <span class="pill text-xs">{book.category}</span>
                            {#if book.subcategory}
                                <span class="pill text-xs"
                                    >{book.subcategory}</span
                                >
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
                {/if}
            </div>
        {/each}
    </div>

    <!-- Empty state -->
    {#if sortedBooks.length === 0}
        <div class="text-center py-12 text-ink-500 dark:text-ink-400">
            <BookOpen size={48} class="mx-auto mb-4 opacity-50" />
            <p>No books in this category yet.</p>
        </div>
    {/if}
</div>
