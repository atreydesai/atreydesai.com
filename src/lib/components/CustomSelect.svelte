<script lang="ts">
    import { onMount, tick } from "svelte";
    import { browser } from "$app/environment";
    import { fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { ChevronDown } from "@jis3r/icons";

    export let options: Array<{ value: string; label: string }>;
    export let value: string = options[0]?.value || "";
    export let placeholder: string = "Select...";
    // Accessible name for the control — without it screen readers only announce
    // the current value (e.g. "All Years") with no hint of what it filters.
    export let ariaLabel: string = "";

    let isOpen = false;
    let containerRef: HTMLDivElement;
    let triggerRef: HTMLButtonElement;
    let optionRefs: HTMLButtonElement[] = [];
    let activeIndex = -1;

    $: selectedOption = options.find((opt) => opt.value === value);
    $: displayLabel = selectedOption?.label || placeholder;

    async function open(focusIndex?: number) {
        isOpen = true;
        const selectedIdx = options.findIndex((o) => o.value === value);
        activeIndex = focusIndex ?? (selectedIdx >= 0 ? selectedIdx : 0);
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

    function select(optionValue: string) {
        value = optionValue;
        close();
    }

    function focusOption(index: number) {
        const n = options.length;
        if (n === 0) return;
        activeIndex = ((index % n) + n) % n; // wrap around top/bottom
        optionRefs[activeIndex]?.focus();
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

    // Roving-focus navigation within the open listbox.
    function onOptionKeydown(e: KeyboardEvent, index: number) {
        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                focusOption(index + 1);
                break;
            case "ArrowUp":
                e.preventDefault();
                focusOption(index - 1);
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
                select(options[index].value);
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
            role="listbox"
            aria-label={ariaLabel || undefined}
            out:fly={{ y: -6, duration: 140, easing: cubicOut }}
        >
            {#each options as option, i}
                <button
                    type="button"
                    class="select-option cascade-in"
                    class:selected={option.value === value}
                    bind:this={optionRefs[i]}
                    on:click={() => select(option.value)}
                    on:keydown={(e) => onOptionKeydown(e, i)}
                    role="option"
                    aria-selected={option.value === value}
                    tabindex={activeIndex === i ? 0 : -1}
                    style="--cascade-delay: {i * 55}ms"
                >
                    {option.label}
                </button>
            {/each}
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
        gap: 0.5rem;
        padding: 0.3rem 0.65rem;
        font-family: "neue-haas-grotesk-text", sans-serif;
        font-size: 0.78rem;
        font-weight: 500;
        letter-spacing: 0.01em;
        background-color: transparent;
        border: 1px solid theme("colors.ink.200");
        border-radius: 2px;
        color: theme("colors.ink.600");
        cursor: pointer;
        transition: border-color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                    color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                    background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        min-width: 140px;
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

    .select-chevron {
        display: inline-flex;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 0.7;
    }

    .select-chevron.rotate {
        transform: rotate(180deg);
    }

    .select-dropdown {
        position: absolute;
        top: calc(100% + 6px);
        left: 0;
        min-width: 100%;
        background-color: theme("colors.cream.50");
        border: 1px solid theme("colors.ink.200");
        border-radius: 2px;
        box-shadow: 0 8px 24px rgba(26, 26, 26, 0.08);
        z-index: 50;
        max-height: 19rem;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
    }

    :global(.dark) .select-dropdown {
        background-color: theme("colors.ink.800");
        border-color: theme("colors.ink.700");
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.32);
    }

    .select-option.cascade-in {
        max-height: 0;
        padding-top: 0;
        padding-bottom: 0;
        opacity: 0;
        transform: translateY(-6px);
        overflow: hidden;
        animation: select-cascade 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        animation-delay: var(--cascade-delay, 0ms);
    }

    @keyframes select-cascade {
        to {
            max-height: 3rem;
            padding-top: 0.45rem;
            padding-bottom: 0.45rem;
            opacity: 1;
            transform: translateY(0);
        }
    }

    .select-option {
        display: block;
        width: 100%;
        padding: 0.45rem 0.75rem;
        font-family: "neue-haas-grotesk-text", sans-serif;
        font-size: 0.82rem;
        font-weight: 400;
        text-align: left;
        color: theme("colors.ink.700");
        background: none;
        border: none;
        cursor: pointer;
        transition: background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1),
                    color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
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
        margin-right: 0.4rem;
        color: theme("colors.accent.DEFAULT");
    }
</style>
