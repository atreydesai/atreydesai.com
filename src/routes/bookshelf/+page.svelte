<script lang="ts">
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import Seo from "$lib/components/Seo.svelte";
    import CustomSelect from "$lib/components/CustomSelect.svelte";
    import MediumIcon from "$lib/components/MediumIcon.svelte";
    import RatingGlyph from "$lib/components/RatingGlyph.svelte";
    import { books, categories } from "$lib/content";
    import type { Book } from "$lib/content";
    import { formatMonthYear } from "$lib/utils/date";
    import { parseInline } from "$lib/utils/text";
    import {
        ArrowDown,
        ArrowUp,
        BadgeInfo,
        Bookmark,
        BookOpenText,
        CalendarDays,
        ChevronLeft,
        ChevronRight,
        ChevronsLeft,
        ChevronsRight,
        ExternalLink,
        FileText,
        Library,
        PanelRightClose,
        Search,
        Star,
        Tags,
        X,
    } from "lucide-svelte";
    import { CirclePlus, Heart } from "@jis3r/icons";

    const PAGE_SIZE = 30;
    const sortableFields = [
        "title",
        "category",
        "medium",
        "enjoyment",
        "importance",
        "dateAdded",
    ] as const;

    type SortField = (typeof sortableFields)[number];
    type SortDirection = "asc" | "desc";

    const categoryIds = new Set(categories.map((category) => category.id));

    let selectedCategory = "all";
    let selectedTag = "all";
    let excludedTags: string[] = [];
    let selectedMedium = "all";
    let excludedMediums: string[] = [];
    let showShelved = false;
    let searchQuery = "";
    let sortField: SortField = "dateAdded";
    let sortDirection: SortDirection = "desc";
    let selectedBookId: string | null = null;
    let currentPage = 1;
    let pendingBookPageId: string | null = null;
    let hoveredBookId: string | null = null;
    let hoveredRatingLegend: "enjoyment" | "importance" | null = null;
    let urlReady = false;
    let lastFilterSignature = "";

    const ratingLegend = {
        enjoyment: {
            title: "Appreciation",
            body: "How much I personally liked it, independent of usefulness.",
        },
        importance: {
            title: "Importance",
            body: "How useful, influential, or worth remembering I found it.",
        },
    };

    $: allTags = [
        ...new Set(
            books.flatMap((book) => [
                ...(book.tags || []),
                ...toList(book.subcategory),
            ]),
        ),
    ].sort((a, b) => a.localeCompare(b));

    $: tagOptions = [
        { value: "all", label: "All tags" },
        ...allTags.map((tag) => ({ value: tag, label: tag })),
    ];

    $: allMediums = [
        ...new Set(books.map((book) => book.medium).filter(Boolean)),
    ].sort((a, b) => a!.localeCompare(b!)) as string[];

    $: mediumOptions = [
        { value: "all", label: "All mediums" },
        ...allMediums.map((medium) => ({ value: medium, label: medium })),
    ];

    $: filteredBooks = books.filter((book) => {
        if ((book.status === "shelved") !== showShelved) return false;
        if (selectedMedium !== "all" && book.medium !== selectedMedium) {
            return false;
        }
        if (book.medium && excludedMediums.includes(book.medium)) {
            return false;
        }
        if (selectedCategory === "favorites" && !book.favorite) return false;
        if (
            selectedCategory !== "all" &&
            selectedCategory !== "favorites" &&
            book.category !== selectedCategory
        ) {
            return false;
        }

        if (selectedTag !== "all" && !bookTags(book).includes(selectedTag)) {
            return false;
        }
        if (
            excludedTags.length > 0 &&
            bookTags(book).some((tag) => excludedTags.includes(tag))
        ) {
            return false;
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            const searchableText = [
                book.title,
                book.author,
                book.category,
                book.medium,
                book.notes,
                book.content,
                ...(book.tags || []),
                ...toList(book.subcategory),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            if (!searchableText.includes(query)) return false;
        }

        return true;
    });

    $: sortedBooks = [...filteredBooks].sort((a, b) => {
        const modifier = sortDirection === "asc" ? 1 : -1;

        if (sortField === "title") {
            return modifier * a.title.localeCompare(b.title);
        }
        if (sortField === "category") {
            return modifier * a.category.localeCompare(b.category);
        }
        if (sortField === "medium") {
            return modifier * (a.medium || "").localeCompare(b.medium || "");
        }
        if (sortField === "enjoyment") {
            return modifier * ((a.enjoyment || 0) - (b.enjoyment || 0));
        }
        if (sortField === "importance") {
            return modifier * ((a.importance || 0) - (b.importance || 0));
        }

        // Undated entries always sort after dated ones, regardless of direction.
        const aTime = new Date(a.dateAdded).getTime();
        const bTime = new Date(b.dateAdded).getTime();
        if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
        if (Number.isNaN(aTime)) return 1;
        if (Number.isNaN(bTime)) return -1;
        return modifier * (aTime - bTime);
    });

    $: totalPages = Math.max(1, Math.ceil(sortedBooks.length / PAGE_SIZE));
    $: if (currentPage > totalPages) currentPage = totalPages;
    $: pageStart = (currentPage - 1) * PAGE_SIZE;
    $: pageEnd = Math.min(pageStart + PAGE_SIZE, sortedBooks.length);
    $: paginatedBooks = sortedBooks.slice(pageStart, pageEnd);
    $: entryStart = sortedBooks.length === 0 ? 0 : pageStart + 1;
    $: selectedBook = selectedBookId
        ? books.find((book) => book.id === selectedBookId) || null
        : null;
    $: selectedNoteParagraphs = selectedBook
        ? getNoteParagraphs(selectedBook)
        : [];
    $: selectedTags = selectedBook ? bookTags(selectedBook) : [];
    $: activeFilters =
        selectedCategory !== "all" ||
        selectedTag !== "all" ||
        excludedTags.length > 0 ||
        selectedMedium !== "all" ||
        excludedMediums.length > 0 ||
        searchQuery.trim().length > 0;

    // A value can't be both the active filter and an exclusion — drop the
    // contradiction so the two pickers never cancel each other to empty.
    $: if (selectedTag !== "all" && excludedTags.includes(selectedTag)) {
        excludedTags = excludedTags.filter((tag) => tag !== selectedTag);
    }

    $: if (selectedMedium !== "all" && excludedMediums.includes(selectedMedium)) {
        excludedMediums = excludedMediums.filter(
            (medium) => medium !== selectedMedium,
        );
    }

    $: if (urlReady) {
        const nextFilterSignature = filterSignature();
        if (nextFilterSignature !== lastFilterSignature) {
            currentPage = 1;
            lastFilterSignature = nextFilterSignature;
        }
    }

    $: if (pendingBookPageId && sortedBooks.length > 0) {
        const selectedIndex = sortedBooks.findIndex(
            (book) => book.id === pendingBookPageId,
        );
        if (selectedIndex >= 0) {
            currentPage = Math.floor(selectedIndex / PAGE_SIZE) + 1;
        }
        pendingBookPageId = null;
    }

    $: if (browser && urlReady) {
        syncUrl();
    }

    onMount(() => {
        readStateFromUrl();
        urlReady = true;

        const handlePopState = () => readStateFromUrl();
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    });

    function toList(value: string | string[] | undefined): string[] {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        return value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    // Parse a comma-separated URL param into a deduped list of known values.
    function parseListParam(raw: string | null, allowed: string[]): string[] {
        if (!raw) return [];
        return [
            ...new Set(
                raw
                    .split(",")
                    .map((item) => item.trim())
                    .filter((item) => allowed.includes(item)),
            ),
        ];
    }

    function filterSignature(): string {
        return [
            selectedCategory,
            selectedTag,
            excludedTags.join(","),
            selectedMedium,
            excludedMediums.join(","),
            showShelved ? "shelved" : "done",
            searchQuery.trim(),
        ].join("|");
    }

    function bookTags(book: Book): string[] {
        return [
            ...new Set([...(book.tags || []), ...toList(book.subcategory)]),
        ];
    }

    function previewTags(book: Book): string[] {
        return bookTags(book).slice(0, 2);
    }

    function tagOverflow(book: Book): number {
        return Math.max(0, bookTags(book).length - 2);
    }

    function isCurrent(book: Book): boolean {
        return (
            book.status === "current" &&
            (book.medium === "book" || book.medium === "drama")
        );
    }

    function currentStatusLabel(book: Book): string {
        return book.medium === "drama" ? "currently watching" : "currently reading";
    }

    function getNoteParagraphs(book: Book): string[] {
        return (book.notes || book.content || "")
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean);
    }

    function isSortField(value: string | null): value is SortField {
        return sortableFields.includes(value as SortField);
    }

    function defaultDirection(field: SortField): SortDirection {
        return field === "title" || field === "category" || field === "medium"
            ? "asc"
            : "desc";
    }

    function sortLabel(field: SortField): string {
        const labels: Record<SortField, string> = {
            title: "title",
            category: "category",
            medium: "medium",
            enjoyment: "appreciation",
            importance: "importance",
            dateAdded: "date added",
        };
        return labels[field];
    }

    function ariaSort(field: SortField): "ascending" | "descending" | undefined {
        if (sortField !== field) return undefined;
        return sortDirection === "asc" ? "ascending" : "descending";
    }

    function handleSort(field: SortField) {
        if (sortField === field) {
            sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
            sortField = field;
            sortDirection = defaultDirection(field);
        }
        currentPage = 1;
    }

    function setCategory(category: string) {
        selectedCategory = category;
        currentPage = 1;
    }

    function setTag(tag: string) {
        selectedTag = selectedTag === tag ? "all" : tag;
        // The contradiction guard reactively drops it from excludedTags.
        currentPage = 1;
    }

    function selectBook(bookId: string) {
        selectedBookId = bookId;
    }

    function closeDrawer() {
        selectedBookId = null;
    }

    function setPage(page: number) {
        currentPage = Math.max(1, Math.min(totalPages, page));
    }

    function clearFilters() {
        selectedCategory = "all";
        selectedTag = "all";
        excludedTags = [];
        selectedMedium = "all";
        excludedMediums = [];
        searchQuery = "";
        currentPage = 1;
    }

    function toggleShelved() {
        showShelved = !showShelved;
        currentPage = 1;
    }

    function onRowKeydown(event: KeyboardEvent, bookId: string) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            selectBook(bookId);
        }
    }

    function readStateFromUrl() {
        if (!browser) return;

        const params = new URLSearchParams(window.location.search);
        const category = params.get("c");
        const tag = params.get("tag");
        const sort = params.get("sort");
        const direction = params.get("dir");
        const bookId = params.get("book");
        const page = Number(params.get("p"));
        const hasExplicitPage = params.has("p");

        selectedCategory =
            category && categoryIds.has(category) ? category : "all";
        selectedTag = tag && allTags.includes(tag) ? tag : "all";
        excludedTags = parseListParam(params.get("excludeTag"), allTags).filter(
            (t) => t !== selectedTag,
        );
        const medium = params.get("m");
        selectedMedium =
            medium && allMediums.includes(medium) ? medium : "all";
        excludedMediums = parseListParam(
            params.get("excludeM"),
            allMediums,
        ).filter((m) => m !== selectedMedium);
        showShelved = params.get("view") === "shelved";
        searchQuery = params.get("q") || "";
        sortField = isSortField(sort) ? sort : "dateAdded";
        sortDirection =
            direction === "asc" || direction === "desc"
                ? direction
                : defaultDirection(sortField);
        selectedBookId =
            bookId && books.some((book) => book.id === bookId) ? bookId : null;
        currentPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
        pendingBookPageId =
            selectedBookId && !hasExplicitPage ? selectedBookId : null;
        lastFilterSignature = filterSignature();
    }

    function syncUrl() {
        const params = new URLSearchParams();

        if (selectedCategory !== "all") params.set("c", selectedCategory);
        if (selectedTag !== "all") params.set("tag", selectedTag);
        if (excludedTags.length) params.set("excludeTag", excludedTags.join(","));
        if (selectedMedium !== "all") params.set("m", selectedMedium);
        if (excludedMediums.length)
            params.set("excludeM", excludedMediums.join(","));
        if (showShelved) params.set("view", "shelved");
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        if (!(sortField === "dateAdded" && sortDirection === "desc")) {
            params.set("sort", sortField);
            params.set("dir", sortDirection);
        }
        if (selectedBookId) params.set("book", selectedBookId);
        if (currentPage > 1) params.set("p", String(currentPage));

        const query = params.toString();
        const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

        if (nextUrl !== currentUrl) {
            window.history.replaceState(null, "", nextUrl);
        }
    }

    function shortDate(date: string): string {
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return "--";

        return `${parsed.getMonth() + 1}.${parsed.getDate()}.${String(
            parsed.getFullYear(),
        ).slice(-2)}`;
    }

    function categoryLabel(categoryId: string): string {
        return (
            categories.find((category) => category.id === categoryId)?.name ||
            categoryId
        );
    }

    function getCategoryColor(category: string): string {
        const colors: Record<string, string> = {
            science:
                "text-accent-dark dark:text-accent-light bg-accent/10 dark:bg-accent/15",
            advice:
                "text-ochre-dark dark:text-ochre-light bg-ochre/10 dark:bg-ochre-dark/20",
            fiction:
                "text-wine-dark dark:text-wine-light bg-wine/10 dark:bg-wine-dark/20",
            nonfiction:
                "text-steel-dark dark:text-steel-light bg-steel/10 dark:bg-steel-dark/20",
            "blog post":
                "text-plum-dark dark:text-plum-light bg-plum/10 dark:bg-plum-dark/20",
        };
        return colors[category] || "text-ink-600 dark:text-cream-300";
    }
</script>

<Seo
    title="Bookshelf | Atrey Desai"
    description="Curated reading list and book recommendations by Atrey Desai - science, philosophy, fiction, and essays with personal notes and ratings."
    url="https://atreydesai.com/bookshelf/"
/>

<div class="max-w-6xl mx-auto px-4 sm:px-6 pt-8 md:pt-12 pb-12">
    <header class="mb-6 max-w-3xl">
        <h1 class="heading-display mb-4 text-3xl text-ink-900 dark:text-cream-100">
            bookshelf
        </h1>
        <p class="deck mb-3 text-ink-600 dark:text-cream-400">
            {#if showShelved}
                What I want to read and watch, but haven't gotten to yet.
            {:else}
                A collection of books, essays, papers, movies, and shows.
            {/if}
        </p>
    </header>

    <section class="mb-5 flex flex-wrap items-center gap-2" aria-label="Bookshelf categories">
        {#each categories as category}
            <button
                type="button"
                class="inline-flex h-8 items-center gap-1.5 border px-3 text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40 dark:focus:ring-accent-light/40 {selectedCategory === category.id ? 'border-ink-900 bg-ink-900 text-cream-100 dark:border-cream-100 dark:bg-cream-100 dark:text-ink-900' : 'border-ink-200 bg-cream-50/80 text-ink-700 hover:bg-white/70 dark:border-ink-700 dark:bg-ink-800/60 dark:text-cream-300 dark:hover:bg-ink-700/70'}"
                on:click={() => setCategory(category.id)}
                aria-pressed={selectedCategory === category.id}
            >
                {#if category.id === "favorites"}
                    <Star size={13} class={selectedCategory === category.id ? "fill-current" : ""} />
                {/if}
                {category.name}
            </button>
        {/each}
        <button
            type="button"
            class="ml-auto inline-flex h-8 items-center gap-1.5 border px-3 text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40 dark:focus:ring-accent-light/40 {showShelved ? 'border-ink-900 bg-ink-900 text-cream-100 dark:border-cream-100 dark:bg-cream-100 dark:text-ink-900' : 'border-ink-200 bg-cream-50/80 text-ink-700 hover:bg-white/70 dark:border-ink-700 dark:bg-ink-800/60 dark:text-cream-300 dark:hover:bg-ink-700/70'}"
            on:click={toggleShelved}
            aria-pressed={showShelved}
            title="Things I want to read or watch but haven't yet"
        >
            <Bookmark size={13} class={showShelved ? "fill-current" : ""} />
            Shelved
        </button>
    </section>

    <section
        class="mb-5 flex flex-col gap-3 border-y border-ink-200/80 bg-cream-200/40 px-4 py-3 dark:border-ink-800 dark:bg-ink-900/35 md:flex-row md:items-center"
        aria-label="Bookshelf controls"
    >
        <div class="relative min-w-0 flex-1">
            <Search
                size={15}
                class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
            <input
                type="text"
                placeholder="Search reading notes..."
                bind:value={searchQuery}
                on:input={() => (currentPage = 1)}
                class="h-9 w-full border border-ink-200 bg-cream-50/70 pl-9 pr-9 text-sm text-ink-700 placeholder:text-ink-400 focus:border-ink-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900/70 dark:text-cream-300 dark:focus:border-cream-400"
            />
            {#if searchQuery}
                <button
                    type="button"
                    aria-label="Clear search"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 transition-colors hover:text-ink-700 dark:hover:text-cream-200"
                    on:click={() => {
                        searchQuery = "";
                        currentPage = 1;
                    }}
                >
                    <X size={14} />
                </button>
            {/if}
        </div>

        <div class="flex flex-wrap items-center gap-3">
            <CustomSelect
                options={mediumOptions}
                bind:value={selectedMedium}
                bind:excluded={excludedMediums}
                excludable
                placeholder="All mediums"
                ariaLabel="Filter by medium"
            />
            <CustomSelect
                options={tagOptions}
                bind:value={selectedTag}
                bind:excluded={excludedTags}
                excludable
                placeholder="All tags"
                ariaLabel="Filter by tag"
                fastScroll
                cascadeDuration={220}
                cascadeDelayStep={24}
            />
            {#if activeFilters}
                <button
                    type="button"
                    class="text-xs font-medium text-ink-500 underline decoration-ink-300 underline-offset-[3px] transition-colors hover:text-ink-800 dark:text-cream-400 dark:decoration-ink-600 dark:hover:text-cream-100"
                    on:click={clearFilters}
                >
                    Clear filters
                </button>
            {/if}
        </div>
    </section>

    <div
        class="grid min-w-0 gap-5 {selectedBook ? 'xl:grid-cols-[minmax(0,1fr)_minmax(370px,0.42fr)]' : ''}"
    >
        <section class="min-w-0 max-w-full overflow-hidden" aria-label="Bookshelf entries">
            <div class="relative mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500 dark:text-cream-400">
                <button
                    type="button"
                    class="transition-colors hover:text-ink-900 dark:hover:text-cream-100"
                    on:click={clearFilters}
                    title="Clear filters"
                >
                    {sortedBooks.length} {sortedBooks.length === 1 ? "entry" : "entries"}
                </button>
                <span>
                    sorted by {sortLabel(sortField)} {sortDirection === "asc" ? "ascending" : "descending"}
                </span>
            </div>

            <div class="max-w-full overflow-hidden border border-ink-200/90 bg-cream-50/60 shadow-[0_1px_0_rgba(26,26,26,0.03)] dark:border-ink-800 dark:bg-ink-900/45">
                <div class="w-full max-w-full overflow-x-auto">
                    <table class="w-full min-w-[1080px] table-fixed text-sm">
                        <thead class="border-b border-ink-200/90 bg-cream-200/60 text-xs font-normal text-ink-500 dark:border-ink-800 dark:bg-ink-900/95 dark:text-cream-400">
                            <tr>
                                <th class="w-[35%] px-3 py-2 text-left" aria-sort={ariaSort("title")}>
                                    <button
                                        type="button"
                                        class="flex w-full items-center justify-between gap-2 transition-colors hover:text-ink-900 dark:hover:text-cream-100"
                                        on:click={() => handleSort("title")}
                                    >
                                        <span class="inline-flex items-center gap-1.5">
                                            <FileText size={14} />
                                            Title
                                        </span>
                                        {#if sortField === "title"}
                                            {#if sortDirection === "asc"}
                                                <ArrowUp size={13} />
                                            {:else}
                                                <ArrowDown size={13} />
                                            {/if}
                                        {/if}
                                    </button>
                                </th>
                                <th class="w-[12%] px-3 py-2 text-left" aria-sort={ariaSort("category")}>
                                    <button
                                        type="button"
                                        class="flex w-full items-center justify-between gap-2 transition-colors hover:text-ink-900 dark:hover:text-cream-100"
                                        on:click={() => handleSort("category")}
                                    >
                                        <span class="inline-flex items-center gap-1.5">
                                            <Library size={14} />
                                            Category
                                        </span>
                                        {#if sortField === "category"}
                                            {#if sortDirection === "asc"}
                                                <ArrowUp size={13} />
                                            {:else}
                                                <ArrowDown size={13} />
                                            {/if}
                                        {/if}
                                    </button>
                                </th>
                                <th class="w-[12%] px-3 py-2 text-left" aria-sort={ariaSort("medium")}>
                                    <button
                                        type="button"
                                        class="flex w-full items-center justify-between gap-2 transition-colors hover:text-ink-900 dark:hover:text-cream-100"
                                        on:click={() => handleSort("medium")}
                                    >
                                        <span class="inline-flex items-center gap-1.5">
                                            <BookOpenText size={14} />
                                            Medium
                                        </span>
                                        {#if sortField === "medium"}
                                            {#if sortDirection === "asc"}
                                                <ArrowUp size={13} />
                                            {:else}
                                                <ArrowDown size={13} />
                                            {/if}
                                        {/if}
                                    </button>
                                </th>
                                <th class="w-[7%] px-3 py-2 text-center" aria-sort={ariaSort("enjoyment")}>
                                    <div class="relative inline-flex justify-center">
                                        <button
                                            type="button"
                                            class="mx-auto flex items-center justify-center gap-1 transition-colors hover:text-ink-900 dark:hover:text-cream-100"
                                            on:click={() => handleSort("enjoyment")}
                                            on:mouseenter={() => (hoveredRatingLegend = "enjoyment")}
                                            on:mouseleave={() => (hoveredRatingLegend = null)}
                                            on:focus={() => (hoveredRatingLegend = "enjoyment")}
                                            on:blur={() => (hoveredRatingLegend = null)}
                                            aria-label="Sort by appreciation"
                                        >
                                            <Heart size={14} animate={hoveredRatingLegend === "enjoyment"} />
                                            {#if sortField === "enjoyment"}
                                                {#if sortDirection === "asc"}
                                                    <ArrowUp size={13} />
                                                {:else}
                                                    <ArrowDown size={13} />
                                                {/if}
                                            {/if}
                                        </button>
                                        {#if hoveredRatingLegend === "enjoyment"}
                                            <div
                                                class="pointer-events-none absolute left-[7px] top-full z-30 mt-2 w-64 -translate-x-1/2 border border-ink-200 bg-cream-50 p-3 text-left font-mono text-xs font-normal leading-5 shadow-[0_10px_28px_rgba(26,26,26,0.10)] dark:border-ink-700 dark:bg-ink-900 dark:shadow-[0_10px_28px_rgba(0,0,0,0.28)]"
                                                role="tooltip"
                                            >
                                                <div class="font-mono font-semibold text-ink-900 dark:text-cream-100">
                                                    {ratingLegend.enjoyment.title}
                                                </div>
                                                <div class="mt-1 font-mono font-normal text-ink-600 dark:text-cream-400">
                                                    {ratingLegend.enjoyment.body}
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                </th>
                                <th class="w-[7%] px-3 py-2 text-center" aria-sort={ariaSort("importance")}>
                                    <div class="relative inline-flex justify-center">
                                        <button
                                            type="button"
                                            class="mx-auto flex items-center justify-center gap-1 transition-colors hover:text-ink-900 dark:hover:text-cream-100"
                                            on:click={() => handleSort("importance")}
                                            on:mouseenter={() => (hoveredRatingLegend = "importance")}
                                            on:mouseleave={() => (hoveredRatingLegend = null)}
                                            on:focus={() => (hoveredRatingLegend = "importance")}
                                            on:blur={() => (hoveredRatingLegend = null)}
                                            aria-label="Sort by importance"
                                        >
                                            <BadgeInfo size={14} />
                                            {#if sortField === "importance"}
                                                {#if sortDirection === "asc"}
                                                    <ArrowUp size={13} />
                                                {:else}
                                                    <ArrowDown size={13} />
                                                {/if}
                                            {/if}
                                        </button>
                                        {#if hoveredRatingLegend === "importance"}
                                            <div
                                                class="pointer-events-none absolute left-[7px] top-full z-30 mt-2 w-64 -translate-x-1/2 border border-ink-200 bg-cream-50 p-3 text-left font-mono text-xs font-normal leading-5 shadow-[0_10px_28px_rgba(26,26,26,0.10)] dark:border-ink-700 dark:bg-ink-900 dark:shadow-[0_10px_28px_rgba(0,0,0,0.28)]"
                                                role="tooltip"
                                            >
                                                <div class="font-mono font-semibold text-ink-900 dark:text-cream-100">
                                                    {ratingLegend.importance.title}
                                                </div>
                                                <div class="mt-1 font-mono font-normal text-ink-600 dark:text-cream-400">
                                                    {ratingLegend.importance.body}
                                                </div>
                                            </div>
                                        {/if}
                                    </div>
                                </th>
                                <th class="w-[9%] px-3 py-2 text-left" aria-sort={ariaSort("dateAdded")}>
                                    <button
                                        type="button"
                                        class="flex w-full items-center justify-between gap-2 transition-colors hover:text-ink-900 dark:hover:text-cream-100"
                                        on:click={() => handleSort("dateAdded")}
                                    >
                                        <span class="inline-flex items-center gap-1.5">
                                            <CalendarDays size={14} />
                                            Added
                                        </span>
                                        {#if sortField === "dateAdded"}
                                            {#if sortDirection === "asc"}
                                                <ArrowUp size={13} />
                                            {:else}
                                                <ArrowDown size={13} />
                                            {/if}
                                        {/if}
                                    </button>
                                </th>
                                <th class="w-[18%] px-3 py-2 text-left">
                                    <span class="inline-flex items-center gap-1.5">
                                        <Tags size={14} />
                                        Tags
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <!-- Keyed on page/sort/filter (not search — re-animating
                             every keystroke would flicker) so rows stagger in
                             on each view change. -->
                        <tbody class="stagger-children divide-y divide-ink-200/70 dark:divide-ink-800">
                            {#key `${currentPage}-${sortField}-${sortDirection}-${selectedCategory}-${selectedTag}-${excludedTags.join(",")}-${selectedMedium}-${excludedMediums.join(",")}-${showShelved}`}
                            {#each paginatedBooks as book (book.id)}
                                <tr
                                    class="cursor-pointer transition-colors duration-150 hover:bg-white/60 dark:hover:bg-ink-800/70 {selectedBookId === book.id ? 'bg-blush-100/70 outline outline-1 -outline-offset-1 outline-accent/35 dark:bg-ink-800 dark:outline-accent-light/30' : ''}"
                                    role="button"
                                    tabindex="0"
                                    aria-current={selectedBookId === book.id ? "true" : undefined}
                                    on:click={() => selectBook(book.id)}
                                    on:keydown={(event) => onRowKeydown(event, book.id)}
                                    on:mouseenter={() => (hoveredBookId = book.id)}
                                    on:mouseleave={() => (hoveredBookId = null)}
                                >
                                    <td class="px-3 py-2.5 align-middle">
                                        <div class="flex min-w-0 items-center gap-2">
                                            <MediumIcon
                                                medium={book.medium}
                                                size={15}
                                                animate={hoveredBookId === book.id || selectedBookId === book.id}
                                                className="shrink-0 text-ink-400 dark:text-ink-500"
                                            />
                                            {#if book.favorite}
                                                <Star
                                                    size={13}
                                                    class="shrink-0 fill-accent text-accent dark:fill-accent-light dark:text-accent-light"
                                                    aria-label="Favorite"
                                                />
                                            {/if}
                                            {#if isCurrent(book)}
                                                <Bookmark
                                                    size={13}
                                                    class="shrink-0 fill-ochre text-ochre-dark dark:fill-ochre-light dark:text-ochre-light"
                                                    aria-label={currentStatusLabel(book)}
                                                />
                                            {/if}
                                            <span class="min-w-0 truncate text-ink-900 dark:text-cream-100" title={book.author ? `${book.title} | ${book.author}` : book.title}>
                                                {book.title}
                                                {#if book.author}
                                                    <span class="text-ink-400 dark:text-ink-500">
                                                        | {book.author}
                                                    </span>
                                                {/if}
                                            </span>
                                        </div>
                                    </td>
                                    <td class="px-3 py-2.5 align-middle">
                                        <button
                                            type="button"
                                            class="pill {getCategoryColor(book.category)}"
                                            on:click|stopPropagation={() => setCategory(book.category)}
                                        >
                                            {book.category}
                                        </button>
                                    </td>
                                    <td class="px-3 py-2.5 align-middle">
                                        {#if book.medium}
                                            <span class="pill text-ink-600 dark:text-cream-300">
                                                {book.medium}
                                            </span>
                                        {:else}
                                            <span class="font-mono text-xs text-ink-400 dark:text-ink-500">--</span>
                                        {/if}
                                    </td>
                                    <td class="px-3 py-2.5 text-center align-middle">
                                        <RatingGlyph
                                            value={book.enjoyment}
                                            type="enjoyment"
                                            compact
                                        />
                                    </td>
                                    <td class="px-3 py-2.5 text-center align-middle">
                                        <RatingGlyph
                                            value={book.importance}
                                            type="importance"
                                            compact
                                        />
                                    </td>
                                    <td class="px-3 py-2.5 align-middle font-mono text-xs text-ink-500 dark:text-cream-400">
                                        {shortDate(book.dateAdded)}
                                    </td>
                                    <td class="px-3 py-2.5 align-middle">
                                        <div class="flex flex-nowrap items-center gap-1 overflow-hidden">
                                            {#each previewTags(book) as tag}
                                                <button
                                                    type="button"
                                                    class="pill max-w-[9rem] truncate"
                                                    title={tag}
                                                    on:click|stopPropagation={() => setTag(tag)}
                                                >
                                                    {tag}
                                                </button>
                                            {/each}
                                            {#if tagOverflow(book) > 0}
                                                <button
                                                    type="button"
                                                    class="pill shrink-0 text-ink-500 dark:text-cream-400"
                                                    title="Open details to show all tags"
                                                    aria-label="Open details and show {tagOverflow(book)} more tags"
                                                    on:click|stopPropagation={() => selectBook(book.id)}
                                                >
                                                    <CirclePlus
                                                        size={12}
                                                        animate={hoveredBookId === book.id || selectedBookId === book.id}
                                                    />
                                                    +{tagOverflow(book)}
                                                </button>
                                            {/if}
                                        </div>
                                    </td>
                                </tr>
                            {/each}
                            {/key}
                        </tbody>
                    </table>
                </div>
            </div>

            {#if sortedBooks.length === 0}
                <div class="border-x border-b border-ink-200/90 bg-cream-50/60 py-12 text-center text-ink-500 dark:border-ink-800 dark:bg-ink-900/45 dark:text-cream-400">
                    <BookOpenText size={42} class="mx-auto mb-4 opacity-50" />
                    <p>No books match your filters.</p>
                    <button
                        type="button"
                        class="mt-2 text-sm text-accent underline underline-offset-[3px] dark:text-accent-light"
                        on:click={clearFilters}
                    >
                        Clear filters
                    </button>
                </div>
            {/if}

            <nav
                class="mt-4 flex flex-col gap-3 text-sm text-ink-500 dark:text-cream-400 sm:flex-row sm:items-center sm:justify-between"
                aria-label="Bookshelf pagination"
            >
                <span>
                    Showing {entryStart} to {pageEnd} of {sortedBooks.length} entries
                </span>
                <div class="flex items-center gap-1">
                    <button
                        type="button"
                        class="border border-ink-200 bg-cream-50 p-1.5 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-700 dark:bg-ink-800 dark:hover:bg-ink-700"
                        on:click={() => setPage(1)}
                        disabled={currentPage === 1}
                        aria-label="First page"
                    >
                        <ChevronsLeft size={15} />
                    </button>
                    <button
                        type="button"
                        class="border border-ink-200 bg-cream-50 p-1.5 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-700 dark:bg-ink-800 dark:hover:bg-ink-700"
                        on:click={() => setPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                    >
                        <ChevronLeft size={15} />
                    </button>
                    <span class="px-3 font-mono text-xs tabular-nums">
                        {currentPage} / {totalPages}
                    </span>
                    <button
                        type="button"
                        class="border border-ink-200 bg-cream-50 p-1.5 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-700 dark:bg-ink-800 dark:hover:bg-ink-700"
                        on:click={() => setPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        aria-label="Next page"
                    >
                        <ChevronRight size={15} />
                    </button>
                    <button
                        type="button"
                        class="border border-ink-200 bg-cream-50 p-1.5 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-ink-700 dark:bg-ink-800 dark:hover:bg-ink-700"
                        on:click={() => setPage(totalPages)}
                        disabled={currentPage === totalPages}
                        aria-label="Last page"
                    >
                        <ChevronsRight size={15} />
                    </button>
                </div>
            </nav>
        </section>

        {#if selectedBook}
            <aside
                class="max-h-[calc(100dvh-6rem)] overflow-hidden border border-ink-200/90 bg-cream-100 shadow-[0_12px_36px_rgba(26,26,26,0.08)] dark:border-ink-800 dark:bg-ink-900/95 xl:sticky xl:top-24"
                aria-label="Selected reading note"
                in:fly={{ x: 28, duration: 260, easing: cubicOut }}
            >
                <div class="flex items-start justify-between gap-4 border-b border-ink-200/90 p-4 dark:border-ink-800">
                    <div class="min-w-0">
                        <h2 class="flex items-start gap-2 text-balance text-xl font-medium leading-snug text-ink-900 dark:text-cream-100">
                            <MediumIcon
                                medium={selectedBook.medium}
                                size={20}
                                animate
                                className="mt-1 shrink-0 text-ink-500 dark:text-cream-400"
                            />
                            <span>{selectedBook.title}</span>
                        </h2>
                        {#if selectedBook.author}
                            <p class="mt-1 text-sm text-ink-500 dark:text-cream-400">
                                by {selectedBook.author}
                            </p>
                        {/if}
                    </div>
                    <button
                        type="button"
                        class="shrink-0 p-1.5 text-ink-500 transition-colors hover:text-ink-900 dark:text-cream-400 dark:hover:text-cream-100"
                        on:click={closeDrawer}
                        aria-label="Close details"
                    >
                        <PanelRightClose size={18} />
                    </button>
                </div>

                <!-- Keyed by book so switching entries re-runs the staggered
                     section fade-in. -->
                {#key selectedBook.id}
                <div class="stagger-children max-h-[calc(100dvh-14rem)] space-y-5 overflow-y-auto p-4">
                    <div class="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            class="pill {getCategoryColor(selectedBook.category)}"
                            on:click={() => setCategory(selectedBook.category)}
                        >
                            {selectedBook.category}
                        </button>
                        {#if selectedBook.medium}
                            <span class="pill text-ink-600 dark:text-cream-300">
                                {selectedBook.medium}
                            </span>
                        {/if}
                        {#if isCurrent(selectedBook)}
                            <span class="pill text-ochre-dark dark:text-ochre-light">
                                <Bookmark size={12} class="fill-current" />
                                {currentStatusLabel(selectedBook)}
                            </span>
                        {/if}
                        {#if selectedBook.favorite}
                            <button
                                type="button"
                                class="pill text-accent dark:text-accent-light"
                                on:click={() => setCategory("favorites")}
                            >
                                <Star size={12} class="fill-current" />
                                favorite
                            </button>
                        {/if}
                    </div>

                    <div class="grid grid-cols-3 gap-3 border-y border-ink-200/80 py-3 dark:border-ink-800">
                        <div>
                            <p class="meta-label mb-1.5">Appreciation</p>
                            <RatingGlyph
                                value={selectedBook.enjoyment}
                                type="enjoyment"
                            />
                        </div>
                        <div>
                            <p class="meta-label mb-1.5">Importance</p>
                            <RatingGlyph
                                value={selectedBook.importance}
                                type="importance"
                            />
                        </div>
                        <div>
                            <p class="meta-label mb-1.5">Date added</p>
                            <p class="font-mono text-sm text-ink-700 dark:text-cream-300">
                                {shortDate(selectedBook.dateAdded)}
                            </p>
                        </div>
                    </div>

                    {#if selectedNoteParagraphs.length > 0}
                        <section>
                            <div class="section-rule mb-2 gap-3">
                                <h3 class="meta-label">TLDR</h3>
                                <div class="section-rule-line"></div>
                            </div>
                            <p class="text-sm leading-6 text-ink-700 dark:text-cream-300">
                                {@html parseInline(selectedNoteParagraphs[0])}
                            </p>
                        </section>

                        {#if selectedNoteParagraphs.length > 1}
                            <section>
                                <div class="section-rule mb-2 gap-3">
                                    <h3 class="meta-label">Notes</h3>
                                    <div class="section-rule-line"></div>
                                </div>
                                <div class="space-y-3 border-l-2 border-ink-200 pl-4 dark:border-ink-700">
                                    {#each selectedNoteParagraphs.slice(1) as paragraph}
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

                    {#if selectedBook.quotes && selectedBook.quotes.length > 0}
                        <section>
                            <div class="section-rule mb-2 gap-3">
                                <h3 class="meta-label">Quotes</h3>
                                <div class="section-rule-line"></div>
                            </div>
                            <div class="space-y-3">
                                {#each selectedBook.quotes as quote}
                                    <blockquote class="border-l-2 border-accent/35 pl-4 text-sm italic leading-6 text-ink-600 dark:border-accent-light/35 dark:text-cream-300">
                                        {@html parseInline(quote)}
                                    </blockquote>
                                {/each}
                            </div>
                        </section>
                    {/if}

                    {#if selectedTags.length > 0}
                        <section>
                            <div class="section-rule mb-2 gap-3">
                                <h3 class="meta-label">Tags</h3>
                                <div class="section-rule-line"></div>
                            </div>
                            <div class="flex flex-wrap gap-1.5">
                                {#each selectedTags as tag}
                                    <button
                                        type="button"
                                        class="pill"
                                        on:click={() => setTag(tag)}
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
                            {#if selectedBook.url}
                                <a
                                    href={selectedBook.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="inline-flex items-center gap-1.5 border border-ink-900 bg-ink-900 px-2.5 py-1.5 text-sm text-cream-100 transition-colors hover:bg-ink-700 dark:border-cream-100 dark:bg-cream-100 dark:text-ink-900 dark:hover:bg-cream-200"
                                >
                                    View source
                                    <ExternalLink size={14} />
                                </a>
                            {:else}
                                <span class="text-sm text-ink-500 dark:text-cream-400">
                                    No source link.
                                </span>
                            {/if}
                            {#if !Number.isNaN(new Date(selectedBook.dateAdded).getTime())}
                                <span class="text-xs text-ink-400 dark:text-ink-500">
                                    Added {formatMonthYear(selectedBook.dateAdded)}
                                </span>
                            {/if}
                        </div>
                    </section>
                </div>
                {/key}
            </aside>
        {/if}
    </div>
</div>
