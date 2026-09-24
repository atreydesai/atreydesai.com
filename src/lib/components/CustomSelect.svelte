<script lang="ts">
    import { onMount, tick } from "svelte";
    import { browser } from "$app/environment";
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { ChevronDown, Search } from "@jis3r/icons";
    import Mark from "$lib/components/Mark.svelte";

    // `count`, when given, is shown at the right of the option: how many
    // entries choosing it would leave.
    type Option = { value: string; label: string; count?: number };

    export let options: Option[] = [];
    export let value: string = options[0]?.value || "";
    export let placeholder: string = "Select...";
    // The dimension the control filters ("year", "tag"), set quieter before
    // the value. It keeps a chosen value legible out of context: "drama" is
    // both a medium and a tag on the bookshelf.
    export let label: string = "";
    // Accessible name for the listbox, and for the trigger when there is no
    // visible `label` (otherwise screen readers only hear the value).
    export let ariaLabel: string = "";
    // A filter field at the top of the menu, for lists too long to scan.
    export let searchable = false;
    export let searchPlaceholder = "filter";
    export let fastScroll = false;
    export let animateOptions = true;
    export let cascadeDuration = 300;
    export let cascadeDelayStep = 24;

    const MAX_CASCADE_OPTIONS = 30;
    const MAX_CASCADE_DELAY_MS = 240;

    // When `excludable` is on, a toggle at the top of the menu flips clicks from
    // single-select (set `value`) to multi-select exclusion (toggle membership
    // in `excluded`). `value` and `excluded` stay independent so you can filter
    // to one option while excluding several others.
    export let excludable = false;
    export let excluded: string[] = [];
    export let excludeLabel = "exclude";
    export let excludeResetLabel = "exclude none";

    let excludeMode = false;
    let isOpen = false;
    let alignEnd = false;
    let query = "";
    let containerRef: HTMLDivElement;
    let triggerRef: HTMLButtonElement;
    let dropdownRef: HTMLDivElement;
    let toggleRef: HTMLButtonElement;
    let searchRef: HTMLInputElement;
    let optionRefs: HTMLButtonElement[] = [];
    let activeIndex = -1;

    // First option doubles as the "no filter" reset (e.g. "All tags").
    $: resetValue = options[0]?.value ?? "";
    $: normalizedQuery = query.trim().toLowerCase();
    // While filtering, the reset row drops out: it would otherwise sit on top
    // of every result and take the Enter-to-pick-first slot.
    $: visibleOptions = normalizedQuery
        ? options.filter(
              (option) =>
                  option.value !== resetValue &&
                  option.label.toLowerCase().includes(normalizedQuery),
          )
        : options;
    $: cascadeOptions =
        animateOptions &&
        options.length <= MAX_CASCADE_OPTIONS &&
        !normalizedQuery;
    $: isFiltered = value !== resetValue || excluded.length > 0;
    // Every way of closing (pick, Escape, click away, tab out) starts the next
    // open from the full list.
    $: if (!isOpen) query = "";

    // The chosen value and the exclusions, shown with the drawn separator
    // between them (e.g. "romance ◦ −2").
    $: labelParts = buildLabel(options, value, excluded, placeholder, resetValue);

    function buildLabel(
        opts: Option[],
        val: string,
        excl: string[],
        fallback: string,
        reset: string,
    ): string[] {
        const parts: string[] = [];
        if (val !== reset) {
            const inc = opts.find((o) => o.value === val)?.label;
            if (inc) parts.push(inc);
        }
        if (excl.length === 1) {
            parts.push(`−${opts.find((o) => o.value === excl[0])?.label ?? excl[0]}`);
        } else if (excl.length > 1) {
            parts.push(`−${excl.length}`);
        }
        return parts.length ? parts : [fallback];
    }

    // "selected" = the chosen include value; "excluded" = an active exclusion.
    // Only one applies at a time since it depends on the current mode. Derived
    // as a reactive array (rather than a function called from markup) so the
    // highlight tracks `excludeMode`/`excluded`/`value` changes.
    $: optionStates = visibleOptions.map((option) =>
        statusFor(option, excludeMode, value, excluded, resetValue),
    );

    function statusFor(
        option: Option,
        mode: boolean,
        val: string,
        excl: string[],
        reset: string,
    ): "selected" | "excluded" | "none" {
        if (mode) {
            if (option.value === reset) {
                return excl.length === 0 ? "selected" : "none";
            }
            return excl.includes(option.value) ? "excluded" : "none";
        }
        return option.value === val ? "selected" : "none";
    }

    function initialFocusIndex(): number {
        if (excludeMode) {
            const i = visibleOptions.findIndex((o) => excluded.includes(o.value));
            return i >= 0 ? i : 0;
        }
        const i = visibleOptions.findIndex((o) => o.value === value);
        return i >= 0 ? i : 0;
    }

    async function open(focusIndex?: number) {
        alignEnd = false;
        isOpen = true;
        activeIndex = focusIndex ?? initialFocusIndex();
        await tick(); // wait for the dropdown to render before measuring/focusing
        // Flip to the trigger's right edge when the menu would run off-screen,
        // e.g. for controls that sit at the end of a right-aligned row.
        if (dropdownRef) {
            const { right } = dropdownRef.getBoundingClientRect();
            alignEnd = right > document.documentElement.clientWidth - 8;
        }
        if (searchable && focusIndex === undefined) {
            optionRefs[activeIndex]?.scrollIntoView({ block: "nearest" });
            searchRef?.focus();
        } else {
            optionRefs[activeIndex]?.focus();
        }
    }

    function close(refocusTrigger = true) {
        isOpen = false;
        if (refocusTrigger) triggerRef?.focus();
    }

    function toggle() {
        isOpen ? close(false) : open();
    }

    function toggleExcludeMode() {
        excludeMode = !excludeMode;
    }

    function selectOption(option: Option) {
        if (excludeMode) {
            if (option.value === resetValue) {
                excluded = [];
            } else if (excluded.includes(option.value)) {
                excluded = excluded.filter((v) => v !== option.value);
            } else {
                excluded = [...excluded, option.value];
            }
            // Stay open so several options can be toggled in one pass.
        } else {
            value = option.value;
            close();
        }
    }

    function onDropdownWheel(e: WheelEvent) {
        if (!fastScroll || !dropdownRef) return;
        e.preventDefault();
        dropdownRef.scrollTop += e.deltaY * 2.1;
    }

    function focusOption(index: number) {
        const n = visibleOptions.length;
        if (n === 0) return;
        activeIndex = ((index % n) + n) % n; // wrap around top/bottom
        optionRefs[activeIndex]?.focus();
    }

    // Arrow keys move between the filter field and the list; the exclude
    // toggle beside the field is a Tab stop. Without a field, the toggle is
    // what sits above the list.
    function focusAboveOptions() {
        if (searchable) searchRef?.focus();
        else if (excludable) toggleRef?.focus();
        else focusOption(-1);
    }

    function cascadeDelay(index: number): number {
        return Math.min(index * cascadeDelayStep, MAX_CASCADE_DELAY_MS);
    }

    // Open the listbox from the trigger with the keyboard.
    function onTriggerKeydown(e: KeyboardEvent) {
        switch (e.key) {
            case "ArrowDown":
            case "Enter":
            case " ":
                e.preventDefault();
                open();
                break;
            case "ArrowUp":
                e.preventDefault();
                open(options.length - 1);
                break;
        }
    }

    function onSearchKeydown(e: KeyboardEvent) {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                focusOption(0);
                break;
            case "Enter":
                e.preventDefault();
                if (normalizedQuery && visibleOptions.length > 0) {
                    selectOption(visibleOptions[0]);
                }
                break;
            case "Escape":
                e.preventDefault();
                if (query) query = "";
                else close();
                break;
        }
    }

    function onToggleKeydown(e: KeyboardEvent) {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                focusOption(0);
                break;
            case "ArrowUp":
                if (!searchable) break;
                e.preventDefault();
                searchRef?.focus();
                break;
            case "Escape":
                e.preventDefault();
                close();
                break;
        }
    }

    // Roving-focus navigation within the open listbox.
    function onOptionKeydown(e: KeyboardEvent, index: number) {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                focusOption(index + 1);
                break;
            case "ArrowUp":
                e.preventDefault();
                if (index === 0 && (excludable || searchable)) {
                    focusAboveOptions();
                } else {
                    focusOption(index - 1);
                }
                break;
            case "Home":
                e.preventDefault();
                focusOption(0);
                break;
            case "End":
                e.preventDefault();
                focusOption(visibleOptions.length - 1);
                break;
            case "Enter":
            case " ":
                e.preventDefault();
                selectOption(visibleOptions[index]);
                break;
            case "Escape":
                e.preventDefault();
                close();
                break;
            default:
                // Typing while on the list goes to the filter field: moving
                // focus during keydown lets the character land there.
                if (
                    searchable &&
                    e.key.length === 1 &&
                    !e.metaKey &&
                    !e.ctrlKey &&
                    !e.altKey
                ) {
                    searchRef?.focus();
                }
        }
    }

    // Close when focus leaves the widget entirely (e.g. Tab out).
    function onFocusOut(e: FocusEvent) {
        if (containerRef && !containerRef.contains(e.relatedTarget as Node)) {
            isOpen = false;
        }
    }

    function handleClickOutside(event: MouseEvent) {
        if (containerRef && !containerRef.contains(event.target as Node)) {
            isOpen = false;
        }
    }

    onMount(() => {
        if (browser) {
            document.addEventListener("click", handleClickOutside);
            return () =>
                document.removeEventListener("click", handleClickOutside);
        }
    });
</script>

<div class="custom-select" bind:this={containerRef} on:focusout={onFocusOut}>
    <button
        type="button"
        class="control-text select-trigger"
        class:open={isOpen}
        class:is-filtered={isFiltered}
        bind:this={triggerRef}
        on:click={toggle}
        on:keydown={onTriggerKeydown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={label ? undefined : ariaLabel || undefined}
    >
        {#if label}
            <span class="control-label">{label}</span>
        {/if}
        <span class="select-value"
            >{#each labelParts as part, i}{#if i}{" "}<Mark kind="dot" />{" "}{/if}{part}{/each}</span
        >
        <span class="select-chevron" class:rotate={isOpen} aria-hidden="true">
            <ChevronDown size={12} />
        </span>
    </button>

    {#if isOpen}
        <div
            class="select-dropdown"
            class:align-end={alignEnd}
            class:fast-scroll={fastScroll}
            bind:this={dropdownRef}
            on:wheel={onDropdownWheel}
            out:fly={{ y: -4, duration: 120, easing: cubicOut }}
        >
            {#if searchable || excludable}
                <div class="select-head">
                    {#if searchable}
                        <label class="select-search">
                            <Search size={12} />
                            <input
                                type="text"
                                bind:this={searchRef}
                                bind:value={query}
                                on:keydown={onSearchKeydown}
                                on:input={() => (activeIndex = 0)}
                                placeholder={searchPlaceholder}
                                aria-label={ariaLabel ? `${ariaLabel}: filter options` : "Filter options"}
                                autocomplete="off"
                                spellcheck="false"
                            />
                        </label>
                    {/if}
                    {#if excludable}
                        <button
                            type="button"
                            class="select-toggle"
                            class:active={excludeMode}
                            bind:this={toggleRef}
                            on:click={toggleExcludeMode}
                            on:keydown={onToggleKeydown}
                            aria-pressed={excludeMode}
                        >
                            <span>{excludeLabel}</span>
                            <span class="select-toggle-indicator" class:on={excludeMode}></span>
                        </button>
                    {/if}
                </div>
            {/if}

            <div
                class="select-list"
                role="listbox"
                aria-label={ariaLabel || label || undefined}
                aria-multiselectable={excludeMode || undefined}
            >
                {#each visibleOptions as option, i}
                    <button
                        type="button"
                        class="select-option"
                        class:cascade-in={cascadeOptions}
                        class:selected={optionStates[i] === "selected"}
                        class:excluded={optionStates[i] === "excluded"}
                        bind:this={optionRefs[i]}
                        on:click={() => selectOption(option)}
                        on:keydown={(e) => onOptionKeydown(e, i)}
                        role="option"
                        aria-selected={optionStates[i] !== "none"}
                        tabindex={activeIndex === i ? 0 : -1}
                        style="--cascade-delay: {cascadeDelay(i)}ms; --cascade-duration: {cascadeDuration}ms"
                    >
                        <!-- The chosen option gets the drawn loop, as if circled
                             in pen; an exclusion gets a minus. -->
                        <span class="select-mark" aria-hidden="true"
                            >{#if optionStates[i] === "selected"}<Mark
                                    kind="dot"
                                    text=""
                                />{:else if optionStates[i] === "excluded"}−{/if}</span
                        >
                        <span class="select-text">
                            {excludeMode && option.value === resetValue
                                ? excludeResetLabel
                                : option.label}
                        </span>
                        {#if option.count !== undefined && option.value !== resetValue}
                            <span class="select-count">{option.count}</span>
                        {/if}
                    </button>
                {/each}
            </div>
            {#if visibleOptions.length === 0}
                <p class="select-empty" role="status">No matches</p>
            {/if}
        </div>
    {/if}
</div>

<style>
    .custom-select {
        position: relative;
        display: inline-block;
        max-width: 100%;
    }

    /* The trigger is a `.control-text` (app.css); only what is particular to
       a select lives here. */
    .select-trigger {
        max-width: 100%;
    }

    .select-trigger.open {
        color: theme("colors.ink.900");
        background-color: rgb(26 26 26 / 0.07);
    }

    :global(.dark) .select-trigger.open {
        color: theme("colors.cream.100");
        background-color: rgb(253 248 243 / 0.1);
    }

    .select-value {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 12rem;
    }

    /* An active filter reads in the accent, so a glance at the row shows
       which controls are narrowing the list. */
    .select-trigger.is-filtered .select-value {
        color: theme("colors.accent.dark");
    }

    :global(.dark) .select-trigger.is-filtered .select-value {
        color: theme("colors.accent.light");
    }

    .select-chevron {
        display: inline-flex;
        color: theme("colors.ink.400");
        transition: transform var(--motion-slow) var(--ease-standard);
    }

    :global(.dark) .select-chevron {
        color: theme("colors.cream.500");
    }

    .select-chevron.rotate {
        transform: rotate(180deg);
    }

    .select-dropdown {
        position: absolute;
        top: calc(100% + var(--space-1));
        left: 0;
        min-width: max(100%, 9rem);
        max-width: min(18rem, calc(100vw - 2rem));
        background-color: theme("colors.cream.50");
        border: 1px solid theme("colors.ink.200");
        border-radius: var(--radius-control);
        box-shadow: var(--shadow-popover);
        z-index: var(--layer-popover);
        max-height: 16rem;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
    }

    .select-dropdown.align-end {
        left: auto;
        right: 0;
    }

    .select-dropdown.fast-scroll {
        max-height: 20rem;
    }

    :global(.dark) .select-dropdown {
        background-color: theme("colors.ink.800");
        border-color: theme("colors.ink.700");
        box-shadow: var(--shadow-popover-dark);
    }

    /* Filter field and exclude toggle share one sticky row above the list. */
    .select-head {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        align-items: stretch;
        background-color: theme("colors.cream.50");
        border-bottom: 1px solid theme("colors.ink.200");
    }

    :global(.dark) .select-head {
        background-color: theme("colors.ink.800");
        border-bottom-color: theme("colors.ink.700");
    }

    .select-search {
        display: flex;
        flex: 1;
        min-width: 0;
        align-items: center;
        gap: var(--space-1);
        padding-left: var(--space-2-5);
        color: theme("colors.ink.400");
    }

    :global(.dark) .select-search {
        color: theme("colors.cream.500");
    }

    .select-search input {
        flex: 1;
        min-width: 0;
        min-height: 1.75rem;
        padding: 0 var(--space-1);
        color: theme("colors.ink.900");
        background: transparent;
        border: 0;
        font-family: var(--font-mono);
        font-size: 0.75rem;
        line-height: 1.333;
    }

    .select-search input::placeholder {
        color: theme("colors.ink.500");
    }

    /* Inside the clipped menu, so the shared ring is drawn inset. */
    .select-search input:focus-visible {
        outline-offset: -2px;
    }

    :global(.dark) .select-search input {
        color: theme("colors.cream.100");
    }

    :global(.dark) .select-search input::placeholder {
        color: theme("colors.cream.500");
    }

    .select-toggle {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        min-height: 1.75rem;
        padding: 0 var(--space-2-5);
        font-family: var(--font-mono);
        font-size: 0.75rem;
        line-height: 1.333;
        text-align: left;
        white-space: nowrap;
        color: theme("colors.ink.500");
        background: none;
        border: none;
        cursor: pointer;
        transition: color var(--motion-base) var(--ease-standard);
    }

    /* Beside a filter field the toggle shrinks to its label. */
    .select-search + .select-toggle {
        flex: none;
        border-left: 1px solid theme("colors.ink.200");
    }

    :global(.dark) .select-search + .select-toggle {
        border-left-color: theme("colors.ink.700");
    }

    .select-toggle:focus-visible {
        outline-offset: -2px;
    }

    :global(.dark) .select-toggle {
        color: theme("colors.cream.400");
    }

    .select-toggle:hover,
    .select-toggle:focus-visible {
        color: theme("colors.ink.900");
    }

    :global(.dark) .select-toggle:hover,
    :global(.dark) .select-toggle:focus-visible {
        color: theme("colors.cream.100");
    }

    .select-toggle.active {
        color: theme("colors.accent.dark");
    }

    :global(.dark) .select-toggle.active {
        color: theme("colors.accent.light");
    }

    .select-toggle-indicator {
        width: 0.625rem;
        height: 0.625rem;
        border: 1px solid theme("colors.ink.300");
        border-radius: var(--radius-control);
        transition:
            background-color var(--motion-base) var(--ease-standard),
            border-color var(--motion-base) var(--ease-standard);
    }

    :global(.dark) .select-toggle-indicator {
        border-color: theme("colors.ink.600");
    }

    .select-toggle-indicator.on {
        background-color: theme("colors.accent.DEFAULT");
        border-color: theme("colors.accent.DEFAULT");
    }

    .select-list {
        padding-block: var(--space-1);
    }

    .select-option.cascade-in {
        opacity: 0;
        transform: translateY(-4px);
        animation: select-cascade var(--cascade-duration, 300ms) var(--ease-emphasized) forwards;
        animation-delay: var(--cascade-delay, 0ms);
    }

    @keyframes select-cascade {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* 28px rows: the dense control height, above the 24px target minimum. */
    .select-option {
        display: flex;
        align-items: center;
        gap: var(--space-1);
        width: 100%;
        min-height: 1.75rem;
        padding: var(--space-1) var(--space-2-5) var(--space-1) var(--space-1);
        font-family: var(--font-mono);
        font-size: 0.75rem;
        font-weight: 400;
        line-height: 1.333;
        text-align: left;
        color: theme("colors.ink.700");
        background: none;
        border: none;
        cursor: pointer;
        transition:
            background-color var(--motion-base) var(--ease-standard),
            color var(--motion-base) var(--ease-standard);
        white-space: nowrap;
    }

    :global(.dark) .select-option {
        color: theme("colors.cream.300");
    }

    .select-option:hover,
    .select-option:focus-visible {
        background-color: theme("colors.blush.100");
        color: theme("colors.ink.900");
    }

    /* Options sit flush against a scrolling, clipped dropdown, so the ring is
       drawn inside the row rather than offset outside it where it would be
       cut off at the first and last option. */
    .select-option:focus-visible {
        outline-offset: -2px;
    }

    :global(.dark) .select-option:hover,
    :global(.dark) .select-option:focus-visible {
        background-color: theme("colors.ink.700");
        color: theme("colors.cream.100");
    }

    /* A fixed marker column, so marking an option never shifts its label. The
       mark takes the option's colour, which keeps its accent plate visible. */
    .select-mark {
        display: inline-flex;
        flex: none;
        justify-content: center;
        width: 0.75rem;
    }

    .select-text {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .select-count {
        flex: none;
        margin-left: var(--space-3);
        color: theme("colors.ink.500");
        font-variant-numeric: lining-nums tabular-nums;
    }

    :global(.dark) .select-count {
        color: theme("colors.cream.500");
    }

    .select-option.selected,
    .select-option.excluded {
        color: theme("colors.accent.dark");
    }

    :global(.dark) .select-option.selected,
    :global(.dark) .select-option.excluded {
        color: theme("colors.accent.light");
    }

    .select-empty {
        padding: var(--space-1-5) var(--space-2-5);
        color: theme("colors.ink.500");
        font-family: var(--font-mono);
        font-size: 0.75rem;
        line-height: 1.333;
    }

    :global(.dark) .select-empty {
        color: theme("colors.cream.400");
    }
</style>
