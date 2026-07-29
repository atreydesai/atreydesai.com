<script lang="ts">
    import { onMount, tick } from "svelte";
    import { browser } from "$app/environment";
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { ChevronDown } from "@jis3r/icons";

    type Option = { value: string; label: string };

    export let options: Option[] = [];
    export let value: string = options[0]?.value || "";
    export let placeholder: string = "Select...";
    // Accessible name for the control: without it screen readers only announce
    // the current value (e.g. "All Years") with no hint of what it filters.
    export let ariaLabel: string = "";
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
    export let excludeLabel = "Exclude";
    export let excludeResetLabel = "Exclude none";

    let excludeMode = false;
    let isOpen = false;
    let containerRef: HTMLDivElement;
    let triggerRef: HTMLButtonElement;
    let dropdownRef: HTMLDivElement;
    let toggleRef: HTMLButtonElement;
    let optionRefs: HTMLButtonElement[] = [];
    let activeIndex = -1;

    // First option doubles as the "no filter" reset (e.g. "All tags").
    $: resetValue = options[0]?.value ?? "";
    $: cascadeOptions = animateOptions && options.length <= MAX_CASCADE_OPTIONS;

    $: displayLabel = buildLabel(options, value, excluded, placeholder, resetValue);

    function buildLabel(
        opts: Option[],
        val: string,
        excl: string[],
        fallback: string,
        reset: string,
    ): string {
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
        return parts.length ? parts.join(" · ") : fallback;
    }

    // "selected" = the chosen include value; "excluded" = an active exclusion.
    // Only one applies at a time since it depends on the current mode. Derived
    // as a reactive array (rather than a function called from markup) so the
    // highlight tracks `excludeMode`/`excluded`/`value` changes.
    $: optionStates = options.map((option) =>
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
            const i = options.findIndex((o) => excluded.includes(o.value));
            return i >= 0 ? i : 0;
        }
        const i = options.findIndex((o) => o.value === value);
        return i >= 0 ? i : 0;
    }

    async function open(focusIndex?: number) {
        isOpen = true;
        activeIndex = focusIndex ?? initialFocusIndex();
        await tick(); // wait for the dropdown to render before focusing
        optionRefs[activeIndex]?.focus();
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
        const n = options.length;
        if (n === 0) return;
        activeIndex = ((index % n) + n) % n; // wrap around top/bottom
        optionRefs[activeIndex]?.focus();
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

    function onToggleKeydown(e: KeyboardEvent) {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                focusOption(0);
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
                if (index === 0 && excludable) {
                    toggleRef?.focus();
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
                focusOption(options.length - 1);
                break;
            case "Enter":
            case " ":
                e.preventDefault();
                selectOption(options[index]);
                break;
            case "Escape":
                e.preventDefault();
                close();
                break;
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
        class="select-trigger"
        class:open={isOpen}
        bind:this={triggerRef}
        on:click={toggle}
        on:keydown={onTriggerKeydown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel || undefined}
    >
        <span class="select-value">{displayLabel}</span>
        <span class="select-chevron" class:rotate={isOpen}>
            <ChevronDown size={14} />
        </span>
    </button>

    {#if isOpen}
        <div
            class="select-dropdown"
            class:fast-scroll={fastScroll}
            bind:this={dropdownRef}
            on:wheel={onDropdownWheel}
            out:fly={{ y: -6, duration: 150, easing: cubicOut }}
        >
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

            <div role="listbox" aria-label={ariaLabel || undefined} aria-multiselectable={excludeMode || undefined}>
                {#each options as option, i}
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
                        {excludeMode && option.value === resetValue
                            ? excludeResetLabel
                            : option.label}
                    </button>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .custom-select {
        position: relative;
        display: inline-block;
    }

    .select-trigger {
        display: inline-flex;
        align-items: center;
        gap: var(--space-2);
        min-height: 1.75rem;
        padding: var(--space-1-5) var(--space-2-5);
        font-family: var(--font-mono);
        font-size: 0.75rem;
        font-weight: 500;
        letter-spacing: 0.01em;
        background-color: transparent;
        border: 1px solid theme("colors.ink.200");
        border-radius: var(--radius-control);
        color: theme("colors.ink.600");
        cursor: pointer;
        transition:
            border-color var(--motion-base) var(--ease-standard),
            color var(--motion-base) var(--ease-standard),
            background-color var(--motion-base) var(--ease-standard);
        min-width: 8.75rem;
        justify-content: space-between;
    }

    :global(.dark) .select-trigger {
        border-color: theme("colors.ink.700");
        color: theme("colors.cream.400");
    }

    .select-trigger:hover,
    .select-trigger:focus-visible {
        border-color: theme("colors.ink.400");
        color: theme("colors.ink.900");
        outline: none;
    }

    :global(.dark) .select-trigger:hover,
    :global(.dark) .select-trigger:focus-visible {
        border-color: theme("colors.ink.500");
        color: theme("colors.cream.100");
    }

    .select-trigger.open {
        border-color: theme("colors.accent.DEFAULT");
        color: theme("colors.accent.DEFAULT");
    }

    :global(.dark) .select-trigger.open {
        color: theme("colors.accent.light");
    }

    .select-value {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 14rem;
    }

    .select-chevron {
        display: inline-flex;
        transition: transform var(--motion-slow) var(--ease-standard);
        opacity: 0.7;
    }

    .select-chevron.rotate {
        transform: rotate(180deg);
    }

    .select-dropdown {
        position: absolute;
        top: calc(100% + var(--space-1-5));
        left: 0;
        min-width: 100%;
        background-color: theme("colors.cream.50");
        border: 1px solid theme("colors.ink.200");
        border-radius: var(--radius-control);
        box-shadow: var(--shadow-popover);
        z-index: var(--layer-popover);
        max-height: 19rem;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
    }

    .select-dropdown.fast-scroll {
        max-height: 24rem;
    }

    :global(.dark) .select-dropdown {
        background-color: theme("colors.ink.800");
        border-color: theme("colors.ink.700");
        box-shadow: var(--shadow-popover-dark);
    }

    .select-toggle {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
        padding: var(--space-2) var(--space-3);
        font-family: var(--font-mono);
        font-size: 0.6875rem;
        font-weight: 500;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        text-align: left;
        color: theme("colors.ink.500");
        background-color: theme("colors.cream.50");
        border: none;
        border-bottom: 1px solid theme("colors.ink.200");
        cursor: pointer;
        transition:
            color var(--motion-base) var(--ease-standard),
            background-color var(--motion-base) var(--ease-standard);
    }

    :global(.dark) .select-toggle {
        color: theme("colors.cream.400");
        background-color: theme("colors.ink.800");
        border-bottom-color: theme("colors.ink.700");
    }

    .select-toggle:hover,
    .select-toggle:focus-visible {
        color: theme("colors.ink.900");
        outline: none;
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
        width: 0.7rem;
        height: 0.7rem;
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

    .select-option.cascade-in {
        opacity: 0;
        transform: translateY(-6px);
        animation: select-cascade var(--cascade-duration, 300ms) var(--ease-emphasized) forwards;
        animation-delay: var(--cascade-delay, 0ms);
    }

    @keyframes select-cascade {
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .select-option {
        display: block;
        width: 100%;
        padding: var(--space-2) var(--space-3);
        font-family: var(--font-mono);
        font-size: 0.75rem;
        font-weight: 400;
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
        outline: none;
    }

    :global(.dark) .select-option:hover,
    :global(.dark) .select-option:focus-visible {
        background-color: theme("colors.ink.700");
        color: theme("colors.cream.100");
    }

    .select-option.selected {
        color: theme("colors.accent.dark");
        font-weight: 500;
    }

    :global(.dark) .select-option.selected {
        color: theme("colors.accent.light");
    }

    .select-option.selected::before {
        content: "·";
        margin-right: var(--space-1-5);
        color: theme("colors.accent.DEFAULT");
    }

    .select-option.excluded {
        color: theme("colors.accent.dark");
        font-weight: 500;
    }

    :global(.dark) .select-option.excluded {
        color: theme("colors.accent.light");
    }

    .select-option.excluded::before {
        content: "−";
        margin-right: var(--space-1-5);
        color: theme("colors.accent.DEFAULT");
    }
</style>
