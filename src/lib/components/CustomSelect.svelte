<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { ChevronDown } from "@jis3r/icons";

    export let options: Array<{ value: string; label: string }>;
    export let value: string = options[0]?.value || "";
    export let placeholder: string = "Select...";

    let isOpen = false;
    let containerRef: HTMLDivElement;

    $: selectedOption = options.find((opt) => opt.value === value);
    $: displayLabel = selectedOption?.label || placeholder;

    function toggle() {
        isOpen = !isOpen;
    }

    function select(optionValue: string) {
        value = optionValue;
        isOpen = false;
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

<div class="custom-select" bind:this={containerRef}>
    <button
        type="button"
        class="select-trigger"
        class:open={isOpen}
        on:click={toggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
    >
        <span class="select-value">{displayLabel}</span>
        <span class="select-chevron" class:rotate={isOpen}>
            <ChevronDown size={14} />
        </span>
    </button>

    {#if isOpen}
        <div class="select-dropdown" role="listbox">
            {#each options as option}
                <button
                    type="button"
                    class="select-option"
                    class:selected={option.value === value}
                    on:click={() => select(option.value)}
                    role="option"
                    aria-selected={option.value === value}
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
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.375rem 0.75rem;
        font-size: 0.875rem;
        background-color: theme("colors.cream.100");
        border: 1px solid theme("colors.ink.200");
        border-radius: 0.5rem;
        color: theme("colors.ink.700");
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 120px;
        justify-content: space-between;
    }

    :global(.dark) .select-trigger {
        background-color: theme("colors.ink.700");
        border-color: theme("colors.ink.600");
        color: theme("colors.cream.300");
    }

    .select-trigger:hover {
        border-color: theme("colors.accent.DEFAULT");
    }

    .select-trigger.open {
        border-color: theme("colors.accent.DEFAULT");
        box-shadow: 0 0 0 2px theme("colors.accent.DEFAULT" / 20%);
    }

    .select-chevron {
        transition: transform 0.2s ease;
        opacity: 0.6;
    }

    .select-chevron.rotate {
        transform: rotate(180deg);
    }

    .select-dropdown {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        background-color: theme("colors.cream.100");
        border: 1px solid theme("colors.ink.200");
        border-radius: 0.5rem;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        z-index: 50;
        overflow: hidden;
        animation: dropdown-enter 0.15s ease-out;
    }

    :global(.dark) .select-dropdown {
        background-color: theme("colors.ink.700");
        border-color: theme("colors.ink.600");
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    @keyframes dropdown-enter {
        from {
            opacity: 0;
            transform: translateY(-4px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .select-option {
        display: block;
        width: 100%;
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        text-align: left;
        color: theme("colors.ink.600");
        background: none;
        border: none;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    :global(.dark) .select-option {
        color: theme("colors.cream.400");
    }

    .select-option:hover {
        background-color: theme("colors.cream.200");
        color: theme("colors.ink.900");
    }

    :global(.dark) .select-option:hover {
        background-color: theme("colors.ink.600");
        color: theme("colors.cream.100");
    }

    .select-option.selected {
        background-color: theme("colors.accent.DEFAULT" / 10%);
        color: theme("colors.accent.DEFAULT");
    }

    :global(.dark) .select-option.selected {
        background-color: theme("colors.accent.DEFAULT" / 20%);
        color: theme("colors.accent.light");
    }
</style>
