<script lang="ts">
    import { browser } from "$app/environment";
    import { afterNavigate, replaceState } from "$app/navigation";
    import { page } from "$app/state";
    import { onMount } from "svelte";
    import { fade, fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import PageShell from "$lib/components/PageShell.svelte";
    import CustomSelect from "$lib/components/CustomSelect.svelte";
    import MediumIcon from "$lib/components/MediumIcon.svelte";
    import Mark from "$lib/components/Mark.svelte";
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

    $: allMediums = [
        ...new Set(books.map((book) => book.medium).filter(Boolean)),
    ].sort((a, b) => a!.localeCompare(b!)) as string[];

    // What the filters read for every entry on every keystroke, built once.
    const tagsById = new Map(books.map((book) => [book.id, bookTags(book)]));
    const searchTextById = new Map(
        books.map((book) => [
            book.id,
            [
                book.title,
                book.author,
                book.category,
                book.medium,
                book.notes,
                book.content,
                ...(tagsById.get(book.id) ?? []),
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase(),
        ]),
    );

    type Facet = "view" | "category" | "medium" | "tag";

    // Bundled so every derived list below depends on it explicitly; `matches`
    // reads it as an argument rather than closing over the loose variables,
    // which Svelte would not track.
    $: filters = {
        category: selectedCategory,
        tag: selectedTag,
        excludedTags,
        medium: selectedMedium,
        excludedMediums,
        shelved: showShelved,
        query: searchQuery.trim().toLowerCase(),
    };

    // Whether an entry passes every active filter except `skip`. Leaving one
    // facet out is what gives that facet its counts: how many entries each of
    // its options would show, given everything else that's set.
    function matches(book: Book, f: typeof filters, skip?: Facet): boolean {
        if (skip !== "view" && (book.status === "shelved") !== f.shelved) {
            return false;
        }
        if (skip !== "medium") {
            if (f.medium !== "all" && book.medium !== f.medium) return false;
            if (book.medium && f.excludedMediums.includes(book.medium)) {
                return false;
            }
        }
        if (skip !== "category") {
            if (f.category === "favorites" && !book.favorite) return false;
            if (
                f.category !== "all" &&
                f.category !== "favorites" &&
                book.category !== f.category
            ) {
                return false;
            }
        }
        if (skip !== "tag") {
            const tags = tagsById.get(book.id) ?? [];
            if (f.tag !== "all" && !tags.includes(f.tag)) return false;
            if (
                f.excludedTags.length > 0 &&
                tags.some((tag) => f.excludedTags.includes(tag))
            ) {
                return false;
            }
        }
        if (f.query && !searchTextById.get(book.id)?.includes(f.query)) {
            return false;
        }
        return true;
    }

    function countBy(
        list: Book[],
        keysOf: (book: Book) => string[],
    ): Map<string, number> {
        const counts = new Map<string, number>();
        for (const book of list) {
            for (const key of keysOf(book)) {
                counts.set(key, (counts.get(key) ?? 0) + 1);
            }
        }
        return counts;
    }

    // Most common first, and options with nothing behind them in the current
    // view drop out (268 tags otherwise). A value that's in use always stays,
    // so it can still be cleared or un-excluded.
    function facetOptions(
        values: string[],
        counts: Map<string, number>,
        selected: string,
        excluded: string[],
    ) {
        return values
            .filter(
                (value) =>
                    (counts.get(value) ?? 0) > 0 ||
                    value === selected ||
                    excluded.includes(value),
            )
            .map((value) => ({
                value,
                label: value,
                count: counts.get(value) ?? 0,
            }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    }

    $: filteredBooks = books.filter((book) => matches(book, filters));

    $: viewCounts = books.reduce(
        (counts, book) => {
            if (matches(book, filters, "view")) {
                counts[book.status === "shelved" ? "shelved" : "done"] += 1;
            }
            return counts;
        },
        { done: 0, shelved: 0 },
    );

    $: mediumCounts = countBy(
        books.filter((book) => matches(book, filters, "medium")),
        (book) => (book.medium ? [book.medium] : []),
    );

    $: tagCounts = countBy(
        books.filter((book) => matches(book, filters, "tag")),
        (book) => tagsById.get(book.id) ?? [],
    );

    $: mediumOptions = [
        { value: "all", label: "all mediums" },
        ...facetOptions(allMediums, mediumCounts, selectedMedium, excludedMediums),
    ];

    $: tagOptions = [
        { value: "all", label: "all tags" },
        ...facetOptions(allTags, tagCounts, selectedTag, excludedTags),
    ];

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

    // `filters` is named here only so the statement re-runs on every filter
    // change (dropdowns included); a call to filterSignature() alone isn't
    // tracked. The signature check skips changes that came from the URL.
    $: if (urlReady && filters) {
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

    // Everything the URL records. syncUrl() takes it as an argument because a
    // `$:` statement only re-runs for the names written in it, not for what
    // the functions it calls happen to read.
    $: urlState = {
        category: selectedCategory,
        tag: selectedTag,
        excludedTags,
        medium: selectedMedium,
        excludedMediums,
        shelved: showShelved,
        query: searchQuery.trim(),
        sortField,
        sortDirection,
        selectedBookId,
        currentPage,
    };

    $: if (urlReady) syncUrl(urlState);

    onMount(() => {
        readStateFromUrl();

        // Back/forward between this page's own history entries. A popstate
        // that is leaving for another page is the router's: re-reading here
        // would sync the URL, and that write would land on the other page.
        const { pathname } = window.location;
        const handlePopState = () => {
            if (window.location.pathname === pathname) readStateFromUrl();
        };
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

    // The URL is only written from here on. On a full page load onMount runs
    // while SvelteKit is still mounting the app, and its replaceState() fails
    // until the router has started. A link to this same page (the header's
    // bookshelf link) doesn't remount it, so that URL is read here instead.
    afterNavigate(({ from, to }) => {
        if (from?.route.id === to?.route.id) readStateFromUrl();
        urlReady = true;
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

    function setShelved(shelved: boolean) {
        showShelved = shelved;
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

    function syncUrl(state: typeof urlState) {
        const params = new URLSearchParams();

        if (state.category !== "all") params.set("c", state.category);
        if (state.tag !== "all") params.set("tag", state.tag);
        if (state.excludedTags.length)
            params.set("excludeTag", state.excludedTags.join(","));
        if (state.medium !== "all") params.set("m", state.medium);
        if (state.excludedMediums.length)
            params.set("excludeM", state.excludedMediums.join(","));
        if (state.shelved) params.set("view", "shelved");
        if (state.query) params.set("q", state.query);
        if (!(state.sortField === "dateAdded" && state.sortDirection === "desc")) {
            params.set("sort", state.sortField);
            params.set("dir", state.sortDirection);
        }
        if (state.selectedBookId) params.set("book", state.selectedBookId);
        if (state.currentPage > 1) params.set("p", String(state.currentPage));

        const query = params.toString();
        const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
        const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

        // Through SvelteKit, not history.replaceState(), which would overwrite
        // the router's own entry state and break back/forward. Only the URL
        // changes; page.state (shallow-routing state) is passed through.
        if (nextUrl !== currentUrl) {
            replaceState(nextUrl, page.state);
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
    heading="bookshelf"
>
    <svelte:fragment slot="deck">
        What I've read and watched, plus a shelf of what I haven't gotten to
        yet.
    </svelte:fragment>

    <!-- Two rows, one job each. The first picks which list you're looking
         at: a category, or the shelf of things not yet read. The second
         narrows it: search, medium, tag. Everything is text-weight, so the
         entries stay the loudest thing on the page. -->
    <section class="shelf-toolbar" aria-label="Bookshelf filters">
        <div class="shelf-row">
            <div class="shelf-group" role="group" aria-label="Category">
                {#each categories as category}
                    <button
                        type="button"
                        class="control-text"
                        aria-pressed={selectedCategory === category.id}
                        on:click={() => setCategory(category.id)}
                    >
                        {#if category.id === "favorites"}
                            <Star
                                size={12}
                                class={selectedCategory === category.id
                                    ? "fill-current"
                                    : ""}
                            />
                        {/if}
                        {category.name.toLowerCase()}
                    </button>
                {/each}
            </div>

            <div class="shelf-group shelf-views" role="group" aria-label="Shelf">
                <button
                    type="button"
                    class="control-text"
                    aria-pressed={!showShelved}
                    on:click={() => setShelved(false)}
                >
                    read &amp; watched
                    <span class="shelf-count">{viewCounts.done}</span>
                </button>
                <button
                    type="button"
                    class="control-text"
                    aria-pressed={showShelved}
                    on:click={() => setShelved(true)}
                    title="Things I want to read or watch but haven't yet"
                >
                    shelved
                    <span class="shelf-count">{viewCounts.shelved}</span>
                </button>
            </div>
        </div>

        <div class="shelf-row shelf-refine">
            <div class="shelf-search">
                <Search size={13} />
                <input
                    type="text"
                    placeholder="search titles, authors, notes"
                    aria-label="Search the bookshelf"
                    autocomplete="off"
                    spellcheck="false"
                    bind:value={searchQuery}
                    on:input={() => (currentPage = 1)}
                />
                {#if searchQuery}
                    <button
                        type="button"
                        class="shelf-search-clear"
                        aria-label="Clear search"
                        on:click={() => {
                            searchQuery = "";
                            currentPage = 1;
                        }}
                    >
                        <X size={12} />
                    </button>
                {/if}
            </div>

            <div class="shelf-group">
                <CustomSelect
                    options={mediumOptions}
                    bind:value={selectedMedium}
                    bind:excluded={excludedMediums}
                    excludable
                    label="medium"
                    placeholder="all"
                    ariaLabel="Filter by medium"
                />
                <CustomSelect
                    options={tagOptions}
                    bind:value={selectedTag}
                    bind:excluded={excludedTags}
                    excludable
                    searchable
                    searchPlaceholder="find a tag"
                    label="tag"
                    placeholder="all"
                    ariaLabel="Filter by tag"
                    animateOptions={false}
                />
                {#if activeFilters}
                    <button
                        type="button"
                        class="control-text control-accent"
                        on:click={clearFilters}
                    >
                        clear
                    </button>
                {/if}
            </div>

            <!-- The two rating columns are icon-only, and their meaning used
                 to live exclusively in a hover tooltip on the column header —
                 unreachable by touch. A native disclosure works everywhere.
                 Its panel is anchored to this row and taken out of flow, so
                 opening it never pushes the list down. -->
            <details class="rating-scale">
                <summary class="control-text">
                    <Mark kind="caret" />
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
        </div>
    </section>

    <div
        class="grid min-w-0 gap-5 {selectedBook
            ? 'xl:grid-cols-[minmax(0,1fr)_minmax(370px,0.42fr)]'
            : ''}"
    >
        <section class="min-w-0 max-w-full overflow-hidden" aria-label="Bookshelf entries">
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
                        <thead class="border-b border-ink-200/90 bg-cream-200/60 font-mono text-xs font-normal text-ink-500 [&_th]:font-normal dark:border-ink-800 dark:bg-ink-900/95 dark:text-cream-400">
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
                                    <div class="relative mx-auto flex w-fit justify-center">
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
                                    <div class="relative mx-auto flex w-fit justify-center">
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
                                    <span class="flex items-center gap-1.5">
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
                                    class="group cursor-pointer transition-colors duration-150 hover:bg-white/60 dark:hover:bg-ink-800/70 {selectedBookId === book.id ? 'bg-blush-100/70 outline outline-1 -outline-offset-1 outline-accent/35 dark:bg-accent/[0.08] dark:outline-accent-light/30' : ''}"
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
                                                strokeWidth={1.5}
                                                className="shrink-0 text-ink-300 transition-colors duration-150 group-hover:text-ink-500 dark:text-ink-600 dark:group-hover:text-ink-400"
                                            />
                                            {#if book.favorite}
                                                <span
                                                    class="status-icon inline-flex shrink-0 text-accent opacity-60 transition-opacity duration-150 group-hover:opacity-100 dark:text-accent-light"
                                                    aria-label="Favorite"
                                                >
                                                    <Star size={13} />
                                                </span>
                                            {/if}
                                            {#if isCurrent(book)}
                                                <span
                                                    class="status-icon inline-flex shrink-0 text-ochre-dark opacity-60 transition-opacity duration-150 group-hover:opacity-100 dark:text-ochre-light"
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
                                    strokeWidth={1.5}
                                    className="mt-1 shrink-0 text-ink-300 dark:text-ink-600"
                                />
                                {#if book.favorite}
                                    <span
                                        class="status-icon mt-1 inline-flex shrink-0 text-accent opacity-60 dark:text-accent-light"
                                        aria-label="Favorite"
                                    >
                                        <Star size={13} />
                                    </span>
                                {/if}
                                {#if isCurrent(book)}
                                    <span
                                        class="status-icon mt-1 inline-flex shrink-0 text-ochre-dark opacity-60 dark:text-ochre-light"
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
                    <p>Nothing on this shelf matches those filters.</p>
                    <button
                        type="button"
                        class="control-text control-accent mt-2"
                        on:click={clearFilters}
                    >
                        Clear filters
                    </button>
                </div>
            {/if}

            <nav class="shelf-pages" aria-label="Bookshelf pagination">
                <span>
                    {entryStart}–{pageEnd} of {sortedBooks.length}
                </span>
                {#if totalPages > 1}
                    <div class="flex items-center gap-0.5">
                        <button
                            type="button"
                            class="control-text shelf-page-step"
                            on:click={() => setPage(1)}
                            disabled={currentPage === 1}
                            aria-label="First page"
                        >
                            <ChevronsLeft size={14} />
                        </button>
                        <button
                            type="button"
                            class="control-text shelf-page-step"
                            on:click={() => setPage(currentPage - 1)}
                            disabled={currentPage === 1}
                            aria-label="Previous page"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <span class="px-2">
                            {currentPage} / {totalPages}
                        </span>
                        <button
                            type="button"
                            class="control-text shelf-page-step"
                            on:click={() => setPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            aria-label="Next page"
                        >
                            <ChevronRight size={14} />
                        </button>
                        <button
                            type="button"
                            class="control-text shelf-page-step"
                            on:click={() => setPage(totalPages)}
                            disabled={currentPage === totalPages}
                            aria-label="Last page"
                        >
                            <ChevronsRight size={14} />
                        </button>
                    </div>
                {/if}
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

    .shelf-toolbar {
        display: grid;
        gap: var(--space-2);
        margin-bottom: var(--space-4);
    }

    .shelf-row {
        /* Anchors the rating-scale panel. */
        position: relative;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-2) var(--space-4);
    }

    .shelf-group {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: var(--space-1);
    }

    @media (min-width: 768px) {
        .shelf-views {
            margin-left: auto;
        }
    }

    .shelf-count {
        color: theme("colors.ink.500");
    }

    :global(.dark) .shelf-count {
        color: theme("colors.cream.500");
    }

    /* An underline field rather than a box, so it sits in the row like the
       text controls beside it. */
    .shelf-search {
        display: flex;
        flex: 1 1 16rem;
        max-width: 22rem;
        align-items: center;
        gap: var(--space-1-5);
        min-height: 1.75rem;
        padding-inline: var(--space-1-5);
        color: theme("colors.ink.400");
        border-bottom: 1px solid theme("colors.ink.200");
        border-radius: var(--radius-control) var(--radius-control) 0 0;
        transition: border-color var(--motion-base) var(--ease-standard);
    }

    .shelf-search:focus-within {
        border-bottom-color: theme("colors.ink.500");
    }

    :global(.dark) .shelf-search {
        color: theme("colors.cream.500");
        border-bottom-color: theme("colors.ink.700");
    }

    :global(.dark) .shelf-search:focus-within {
        border-bottom-color: theme("colors.cream.500");
    }

    .shelf-search input {
        flex: 1;
        min-width: 0;
        min-height: 1.75rem;
        padding: 0;
        color: theme("colors.ink.900");
        background: transparent;
        border: 0;
        font-family: var(--font-mono);
        font-size: 0.75rem;
        line-height: 1.333;
    }

    .shelf-search input::placeholder {
        color: theme("colors.ink.500");
    }

    :global(.dark) .shelf-search input {
        color: theme("colors.cream.100");
    }

    :global(.dark) .shelf-search input::placeholder {
        color: theme("colors.cream.500");
    }

    /* The shared ring goes around the whole field (icon, text, clear) rather
       than the bare input inside it. Browsers without :has() keep the ring on
       the input. */
    .shelf-search:has(input:focus-visible) {
        outline: 2px solid var(--focus-ring);
        outline-offset: 2px;
    }

    @supports selector(:has(*)) {
        .shelf-search input:focus-visible {
            outline: none;
        }
    }

    .shelf-search-clear {
        display: inline-flex;
        padding: var(--space-1);
        color: theme("colors.ink.400");
        background: none;
        border: 0;
        border-radius: var(--radius-control);
        cursor: pointer;
        transition: color var(--motion-base) var(--ease-standard);
    }

    .shelf-search-clear:hover {
        color: theme("colors.ink.800");
    }

    :global(.dark) .shelf-search-clear:hover {
        color: theme("colors.cream.100");
    }

    .shelf-pages {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2) var(--space-4);
        margin-top: var(--space-3);
        color: theme("colors.ink.500");
        font-family: var(--font-mono);
        font-size: 0.75rem;
        line-height: 1.333;
        font-variant-numeric: lining-nums tabular-nums;
    }

    :global(.dark) .shelf-pages {
        color: theme("colors.cream.400");
    }

    .shelf-page-step {
        justify-content: center;
        min-width: 1.75rem;
        padding-inline: 0;
    }

    /* Quiet native disclosure at the end of the refine row. */
    .rating-scale {
        position: static;
        margin-left: auto;
    }

    /* `::marker` can only be sized and coloured, never vertically positioned,
       so the native triangle sits on the text baseline instead of its centre.
       Drop it for the site's drawn caret ($lib/marks), which turns itself a
       quarter when the <details> opens. */
    .rating-scale > summary {
        width: fit-content;
        list-style: none;
    }

    .rating-scale > summary::-webkit-details-marker {
        display: none;
    }

    /* Anchored to the refine row (which is `relative`), not to the <details>,
       so the panel spans a readable width instead of the summary's. Taken out
       of flow so opening it never reflows the list below. */
    .rating-scale-panel {
        position: absolute;
        top: calc(100% + var(--space-1-5));
        right: 0;
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
</style>
