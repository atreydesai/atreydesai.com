<script lang="ts">
    import { browser } from "$app/environment";
    import { onMount } from "svelte";
    import { fade, fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import PageShell from "$lib/components/PageShell.svelte";
    import CustomSelect from "$lib/components/CustomSelect.svelte";
    import MediumIcon from "$lib/components/MediumIcon.svelte";
    import RatingGlyph from "$lib/components/RatingGlyph.svelte";
    import BookDetail from "$lib/components/BookDetail.svelte";
    import { books, categories } from "$lib/content";
    import type { Book } from "$lib/content";
    import {
        bookTags,
        currentStatusLabel,
        getCategoryColor,
        isCurrent,
        previewTags,
        ratingLegend,
        shortDate,
        tagOverflow,
        toList,
    } from "$lib/bookshelf";
    import {
        ArrowDown,
        ArrowUp,
        BadgeQuestionMark,
        Bookmark,
        BookOpenText,
        CalendarDays,
        ChevronLeft,
        ChevronRight,
        ChevronsLeft,
        ChevronsRight,
        ArrowUpRight,
        FileText,
        Archive,
        PanelRightClose,
        Search,
        Star,
        Tag,
        X,
        CirclePlus,
        Heart,
    } from "@jis3r/icons";

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

    // Above `xl` the note sits in a sticky column beside the table. Below it
    // there is no room for a second column, so the note is presented as a
    // modal sheet instead of being stacked underneath a 1080px-wide table.
    const WIDE_LAYOUT_QUERY = "(min-width: 1280px)";
    let isWideLayout = browser && matchMedia(WIDE_LAYOUT_QUERY).matches;
    $: asSheet = selectedBookId !== null && !isWideLayout;

    let sheetElement: HTMLElement | null = null;
    let sheetTrigger: HTMLElement | null = null;
    let lockedScrollY = 0;

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
    $: activeFilters =
        selectedCategory !== "all" ||
        selectedTag !== "all" ||
        excludedTags.length > 0 ||
        selectedMedium !== "all" ||
        excludedMediums.length > 0 ||
        searchQuery.trim().length > 0;

    // A value can't be both the active filter and an exclusion: drop the
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

        const wideMedia = window.matchMedia(WIDE_LAYOUT_QUERY);
        const syncWide = () => (isWideLayout = wideMedia.matches);
        syncWide();
        wideMedia.addEventListener("change", syncWide);

        return () => {
            window.removeEventListener("popstate", handlePopState);
            wideMedia.removeEventListener("change", syncWide);
            unlockScroll();
        };
    });

    // Pin the body rather than setting `overflow: hidden`, which iOS Safari
    // scrolls straight through.
    function lockScroll() {
        if (!browser || document.body.style.position === "fixed") return;
        lockedScrollY = window.scrollY;
        document.body.style.position = "fixed";
        document.body.style.top = `-${lockedScrollY}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
    }

    function unlockScroll() {
        if (!browser || document.body.style.position !== "fixed") return;
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        window.scrollTo(0, lockedScrollY);
    }

    $: if (browser) {
        if (asSheet) lockScroll();
        else unlockScroll();
    }

    function onSheetKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
            event.stopPropagation();
            closeDrawer();
            return;
        }
        if (event.key !== "Tab" || !sheetElement) return;
        const focusable = Array.from(
            sheetElement.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
        ).filter((element) => !element.hasAttribute("disabled"));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
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

    function selectBook(bookId: string, trigger?: HTMLElement | null) {
        selectedBookId = bookId;
        if (trigger) sheetTrigger = trigger;
    }

    function closeDrawer() {
        selectedBookId = null;
        // Send focus back to whatever opened the note, so keyboard users don't
        // land at the top of the document.
        sheetTrigger?.focus();
        sheetTrigger = null;
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

    // The row is a generous click target, but it is not itself a control:
    // the keyboard path is the real <button> in the title cell. Clicks that
    // landed on any other control inside the row belong to that control.
    function onRowClick(event: MouseEvent, bookId: string) {
        const target = event.target as HTMLElement | null;
        if (target?.closest("button, a")) return;
        selectBook(bookId, event.currentTarget as HTMLElement);
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

    function categoryLabel(categoryId: string): string {
        return (
            categories.find((category) => category.id === categoryId)?.name ||
            categoryId
        );
    }

</script>

<PageShell
    title="Bookshelf | Atrey Desai"
    description="Curated reading list and book recommendations by Atrey Desai - science, philosophy, fiction, and essays with personal notes and ratings."
    url="https://atreydesai.com/bookshelf/"
    width="wide"
>
    <header
        slot="header"
        class="page-header {showShelved ? 'page-header-deck' : 'page-header-title-only'} max-w-3xl"
    >
        <h1
            class="type-page-title text-ink-900 dark:text-cream-100"
            class:mb-4={showShelved}
        >
            bookshelf
        </h1>
        {#if showShelved}
            <p class="type-deck text-ink-600 dark:text-cream-400">
                What I want to read and watch, but haven't gotten to yet.
            </p>
        {/if}
    </header>

    <section class="mb-5 flex flex-wrap items-center gap-2" aria-label="Bookshelf categories">
        {#each categories as category}
            <button
                type="button"
                class="control-compact inline-flex items-center gap-1.5 border text-sm transition-colors duration-200 {selectedCategory === category.id ? 'border-ink-900 bg-ink-900 text-cream-100 dark:border-cream-100 dark:bg-cream-100 dark:text-ink-900' : 'border-ink-200 bg-cream-50/80 text-ink-700 hover:bg-white/70 dark:border-ink-700 dark:bg-ink-800/60 dark:text-cream-300 dark:hover:bg-ink-700/70'}"
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
            class="control-compact ml-auto inline-flex items-center gap-1.5 border text-sm transition-colors duration-200 {showShelved ? 'border-ink-900 bg-ink-900 text-cream-100 dark:border-cream-100 dark:bg-cream-100 dark:text-ink-900' : 'border-ink-200 bg-cream-50/80 text-ink-700 hover:bg-white/70 dark:border-ink-700 dark:bg-ink-800/60 dark:text-cream-300 dark:hover:bg-ink-700/70'}"
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
                class="control-regular w-full border border-ink-200 bg-cream-50/70 pl-9 pr-9 text-sm text-ink-700 placeholder:text-ink-400 focus:border-ink-500 dark:border-ink-700 dark:bg-ink-900/70 dark:text-cream-300 dark:focus:border-cream-400"
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
                cascadeDuration={200}
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
        class="grid min-w-0 gap-5 {selectedBook
            ? 'xl:grid-cols-[minmax(0,1fr)_minmax(370px,0.42fr)]'
            : ''}"
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

                <!-- The two rating columns are icon-only, and their meaning used
                     to live exclusively in a hover tooltip on the column header —
                     unreachable by touch. A native disclosure works everywhere.
                     It sits on this line, and opens as an absolutely-positioned
                     panel, so the legend costs no vertical space in either
                     state instead of pushing the list down by its own height. -->
                <details class="rating-scale mr-auto">
                    <summary class="type-meta text-ink-500 dark:text-cream-400">
                        <span class="rating-scale-caret" aria-hidden="true">▸</span>
                        <span>rating scale</span>
                    </summary>
                    <dl class="rating-scale-panel space-y-2 border border-ink-200 bg-cream-50 p-3 dark:border-ink-700 dark:bg-ink-900">
                        <div class="flex items-baseline gap-2">
                            <Heart size={13} class="shrink-0 translate-y-[2px] text-ink-400 dark:text-ink-400" />
                            <div>
                                <dt class="type-meta text-ink-900 dark:text-cream-100">
                                    {ratingLegend.enjoyment.title}
                                </dt>
                                <dd class="type-body-small text-ink-600 dark:text-cream-400">
                                    {ratingLegend.enjoyment.body}
                                </dd>
                            </div>
                        </div>
                        <div class="flex items-baseline gap-2">
                            <BadgeQuestionMark size={13} class="shrink-0 translate-y-[2px] text-ink-400 dark:text-ink-400" />
                            <div>
                                <dt class="type-meta text-ink-900 dark:text-cream-100">
                                    {ratingLegend.importance.title}
                                </dt>
                                <dd class="type-body-small text-ink-600 dark:text-cream-400">
                                    {ratingLegend.importance.body}
                                </dd>
                            </div>
                        </div>
                    </dl>
                </details>

                <span>
                    sorted by {sortLabel(sortField)} {sortDirection === "asc" ? "ascending" : "descending"}
                </span>
            </div>

            <!-- Filtering and sorting change the list silently otherwise: the
                 count above is visual only. -->
            <p class="sr-only" aria-live="polite" aria-atomic="true">
                {sortedBooks.length}
                {sortedBooks.length === 1 ? "entry" : "entries"} match the current
                filters, sorted by {sortLabel(sortField)}
                {sortDirection === "asc" ? "ascending" : "descending"}.
            </p>

            <!-- The table needs ~1080px to stay readable, so it only appears
                 from `md`. Narrower screens get the same entries as a stacked
                 list instead of a sideways-scrolling table. -->
            <div class="surface-ledger hidden max-w-full overflow-hidden border border-ink-200/90 bg-cream-50/60 md:block dark:border-ink-800 dark:bg-ink-900/45">
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
                                            <Archive size={14} />
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
                                                class="surface-tooltip layer-tooltip pointer-events-none absolute left-[7px] top-full mt-2 w-64 -translate-x-1/2 border border-ink-200 bg-cream-50 p-3 text-left font-mono text-xs font-normal leading-5 dark:border-ink-700 dark:bg-ink-900"
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
                                            <BadgeQuestionMark size={14} />
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
                                                class="surface-tooltip layer-tooltip pointer-events-none absolute left-[7px] top-full mt-2 w-64 -translate-x-1/2 border border-ink-200 bg-cream-50 p-3 text-left font-mono text-xs font-normal leading-5 dark:border-ink-700 dark:bg-ink-900"
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
                                        <Tag size={14} />
                                        Tags
                                    </span>
                                </th>
                            </tr>
                        </thead>
                        <!-- Keyed on page/sort/filter (not search: re-animating
                             every keystroke would flicker) so rows stagger in
                             on each view change. -->
                        <tbody class="stagger-children divide-y divide-ink-200/70 dark:divide-ink-800">
                            {#key `${currentPage}-${sortField}-${sortDirection}-${selectedCategory}-${selectedTag}-${excludedTags.join(",")}-${selectedMedium}-${excludedMediums.join(",")}-${showShelved}`}
                            {#each paginatedBooks as book (book.id)}
                                <!-- The row is a wide click target, not a
                                     control: it used to carry role="button"
                                     while containing real buttons, which is
                                     invalid and made VoiceOver read the whole
                                     row as one name. The keyboard path is the
                                     title button in the first cell. -->
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                                <tr
                                    class="cursor-pointer transition-colors duration-150 hover:bg-white/60 dark:hover:bg-ink-800/70 {selectedBookId === book.id ? 'bg-blush-100/70 outline outline-1 -outline-offset-1 outline-accent/35 dark:bg-accent/[0.08] dark:outline-accent-light/30' : ''}"
                                    aria-current={selectedBookId === book.id ? "true" : undefined}
                                    on:click={(event) => onRowClick(event, book.id)}
                                    on:mouseenter={() => (hoveredBookId = book.id)}
                                    on:mouseleave={() => (hoveredBookId = null)}
                                >
                                    <td class="px-3 py-2.5 align-middle">
                                        <div class="flex min-w-0 items-center gap-2">
                                            <MediumIcon
                                                medium={book.medium}
                                                size={15}
                                                animate={hoveredBookId === book.id || selectedBookId === book.id}
                                                className="shrink-0 text-ink-400 dark:text-ink-400"
                                            />
                                            {#if book.favorite}
                                                <span
                                                    class="status-icon inline-flex shrink-0 text-accent dark:text-accent-light"
                                                    aria-label="Favorite"
                                                >
                                                    <Star size={13} />
                                                </span>
                                            {/if}
                                            {#if isCurrent(book)}
                                                <span
                                                    class="status-icon inline-flex shrink-0 text-ochre-dark dark:text-ochre-light"
                                                    aria-label={currentStatusLabel(book)}
                                                >
                                                    <Bookmark size={13} />
                                                </span>
                                            {/if}
                                            <button
                                                type="button"
                                                class="row-open min-w-0 truncate text-left text-ink-900 dark:text-cream-100"
                                                aria-expanded={selectedBookId === book.id}
                                                on:click|stopPropagation={(event) =>
                                                    selectBook(book.id, event.currentTarget)}
                                            >
                                                {book.title}
                                                {#if book.author}
                                                    <span class="text-ink-400 dark:text-cream-500">
                                                        | {book.author}
                                                    </span>
                                                {/if}
                                            </button>
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
                                            <span class="font-mono text-xs text-ink-400 dark:text-ink-300">--</span>
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
                                                    on:click|stopPropagation={(event) =>
                                                        selectBook(book.id, event.currentTarget)}
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

            <!-- Narrow screens: the same entries, stacked. Every column of the
                 table is still here, just arranged vertically instead of
                 behind a horizontal scroll. -->
            <ul
                class="stagger-children surface-ledger max-w-full divide-y divide-ink-200/70 overflow-hidden border border-ink-200/90 bg-cream-50/60 md:hidden dark:divide-ink-800 dark:border-ink-800 dark:bg-ink-900/45"
                class:hidden={sortedBooks.length === 0}
            >
                {#key `${currentPage}-${sortField}-${sortDirection}-${selectedCategory}-${selectedTag}-${excludedTags.join(",")}-${selectedMedium}-${excludedMediums.join(",")}-${showShelved}`}
                    {#each paginatedBooks as book (book.id)}
                        <li
                            class="p-3 transition-colors duration-150 {selectedBookId ===
                            book.id
                                ? 'bg-blush-100/70 dark:bg-accent/[0.08]'
                                : ''}"
                            aria-current={selectedBookId === book.id
                                ? "true"
                                : undefined}
                        >
                            <div class="flex min-w-0 items-start gap-2">
                                <MediumIcon
                                    medium={book.medium}
                                    size={15}
                                    className="mt-1 shrink-0 text-ink-400 dark:text-ink-400"
                                />
                                {#if book.favorite}
                                    <span
                                        class="status-icon mt-1 inline-flex shrink-0 text-accent dark:text-accent-light"
                                        aria-label="Favorite"
                                    >
                                        <Star size={13} />
                                    </span>
                                {/if}
                                {#if isCurrent(book)}
                                    <span
                                        class="status-icon mt-1 inline-flex shrink-0 text-ochre-dark dark:text-ochre-light"
                                        aria-label={currentStatusLabel(book)}
                                    >
                                        <Bookmark size={13} />
                                    </span>
                                {/if}
                                <button
                                    type="button"
                                    class="card-open min-w-0 flex-1 text-left"
                                    aria-expanded={selectedBookId === book.id}
                                    on:click={(event) =>
                                        selectBook(book.id, event.currentTarget)}
                                >
                                    <span
                                        class="block text-ink-900 dark:text-cream-100"
                                        >{book.title}</span
                                    >
                                    {#if book.author}
                                        <span
                                            class="block type-body-small text-ink-500 dark:text-cream-500"
                                            >{book.author}</span
                                        >
                                    {/if}
                                </button>
                            </div>

                            <div class="mt-2 flex flex-wrap items-center gap-1.5">
                                <button
                                    type="button"
                                    class="pill {getCategoryColor(book.category)}"
                                    on:click={() => setCategory(book.category)}
                                >
                                    {book.category}
                                </button>
                                {#if book.medium}
                                    <span class="pill text-ink-600 dark:text-cream-300">
                                        {book.medium}
                                    </span>
                                {/if}
                                {#each previewTags(book) as tag}
                                    <button
                                        type="button"
                                        class="pill max-w-[9rem] truncate"
                                        on:click={() => setTag(tag)}
                                    >
                                        {tag}
                                    </button>
                                {/each}
                                {#if tagOverflow(book) > 0}
                                    <button
                                        type="button"
                                        class="pill shrink-0 text-ink-500 dark:text-cream-400"
                                        aria-label="Open details and show {tagOverflow(
                                            book,
                                        )} more tags"
                                        on:click={(event) =>
                                            selectBook(book.id, event.currentTarget)}
                                    >
                                        <CirclePlus size={12} />
                                        +{tagOverflow(book)}
                                    </button>
                                {/if}
                            </div>

                            <!-- The icon-only rating columns don't survive the
                                 loss of their headers, so label them inline. -->
                            <div
                                class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 type-meta text-ink-500 dark:text-cream-400"
                            >
                                <span class="inline-flex items-center gap-1.5">
                                    <span class="sr-only"
                                        >{ratingLegend.enjoyment.title}</span
                                    >
                                    <Heart size={12} />
                                    <RatingGlyph
                                        value={book.enjoyment}
                                        type="enjoyment"
                                        compact
                                    />
                                </span>
                                <span class="inline-flex items-center gap-1.5">
                                    <span class="sr-only"
                                        >{ratingLegend.importance.title}</span
                                    >
                                    <BadgeQuestionMark size={12} />
                                    <RatingGlyph
                                        value={book.importance}
                                        type="importance"
                                        compact
                                    />
                                </span>
                                <span class="ml-auto tabular-nums">
                                    {shortDate(book.dateAdded)}
                                </span>
                            </div>
                        </li>
                    {/each}
                {/key}
            </ul>

            {#if sortedBooks.length === 0}
                <div class="border-x border-b border-t border-ink-200/90 bg-cream-50/60 py-12 text-center text-ink-500 md:border-t-0 dark:border-ink-800 dark:bg-ink-900/45 dark:text-cream-400">
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

        <!-- Desktop only: the note as a sticky companion column. Below `xl`
             it is presented as a sheet (outside PageShell) instead. -->
        {#if selectedBook && isWideLayout}
            <aside
                class="surface-panel max-h-[calc(100dvh-6rem)] overflow-hidden border border-ink-200/90 bg-cream-100 dark:border-ink-800 dark:bg-ink-900/95 xl:sticky xl:top-24"
                aria-label="Selected reading note"
                in:fly={{ x: 28, duration: 300, easing: cubicOut }}
            >
                {#key selectedBook.id}
                    <BookDetail
                        book={selectedBook}
                        variant="sidebar"
                        onClose={closeDrawer}
                        onSelectCategory={setCategory}
                        onSelectTag={setTag}
                    />
                {/key}
            </aside>
        {/if}
    </div>
</PageShell>

<!-- Narrow screens: the note as a modal sheet rather than a panel stacked
     under a horizontally scrolling table. Focus moves in, is trapped while
     open, and returns to the row that opened it. -->
{#if selectedBook && asSheet}
    <div
        class="layer-overlay fixed inset-0 bg-ink-900/60"
        role="presentation"
        on:click={closeDrawer}
        transition:fade={{ duration: 150 }}
    ></div>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
        bind:this={sheetElement}
        class="book-detail-sheet surface-panel layer-modal fixed inset-x-0 bottom-0 flex max-h-[85dvh] flex-col overflow-hidden border-t border-ink-200/90 bg-cream-100 dark:border-ink-800 dark:bg-ink-900"
        role="dialog"
        aria-modal="true"
        aria-label="Selected reading note"
        tabindex="-1"
        on:keydown={onSheetKeydown}
        transition:fly={{ y: 240, duration: 260, easing: cubicOut }}
    >
        {#key selectedBook.id}
            <BookDetail
                book={selectedBook}
                variant="sheet"
                autofocus
                onClose={closeDrawer}
                onSelectCategory={setCategory}
                onSelectTag={setTag}
            />
        {/key}
    </div>
{/if}

<style>
    /* @jis3r icons set fill="none" on the nested SVG. Override that
       presentation attribute for state glyphs that are intentionally solid. */
    .status-icon :global(svg) {
        fill: currentColor;
    }

    /* The title is a real button so the row has a keyboard path, but it should
       still read as the row's text, not as a control. */
    .row-open,
    .card-open {
        font: inherit;
        color: inherit;
        background: none;
        border: 0;
        padding: 0;
        cursor: pointer;
    }

    /* Quiet native disclosure: the marker stays, the summary reads as metadata
       rather than a control. */
    .rating-scale {
        position: static;
    }

    /* `::marker` can only be sized and coloured, never vertically positioned,
       so the native triangle sits on the text baseline instead of its centre.
       Drop it for a real element that flex can centre, using the same ▸ caret
       the other disclosures on the site use. */
    .rating-scale > summary {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
        width: fit-content;
        cursor: pointer;
        list-style: none;
    }

    .rating-scale > summary::-webkit-details-marker {
        display: none;
    }

    .rating-scale-caret {
        display: inline-block;
        font-size: 0.85em;
        line-height: 1;
        transition: transform var(--motion-base) var(--ease-emphasized);
    }

    .rating-scale[open] .rating-scale-caret {
        transform: rotate(90deg);
    }

    @media (prefers-reduced-motion: reduce) {
        .rating-scale-caret {
            transition: none;
        }
    }

    /* Anchored to the status row (which is `relative`), not to the <details>,
       so the panel spans a readable width instead of the summary's. Taken out
       of flow so opening it never reflows the list below. */
    .rating-scale-panel {
        position: absolute;
        top: calc(100% + var(--space-1-5));
        left: 0;
        z-index: var(--layer-popover);
        width: max-content;
        max-width: min(34rem, 100%);
        border-radius: var(--radius-control);
        box-shadow: var(--shadow-popover);
        text-align: left;
    }

    :global(.dark) .rating-scale-panel {
        box-shadow: var(--shadow-popover-dark);
    }

    .rating-scale > summary:hover {
        color: theme("colors.ink.900");
    }

    :global(.dark) .rating-scale > summary:hover {
        color: theme("colors.cream.100");
    }
</style>
