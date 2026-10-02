<script lang="ts">
    export let value: number | null | undefined = null;
    export let type: "enjoyment" | "importance" = "enjoyment";

    const MAX_VALUE = 10;
    const SEGMENTS = 5;

    $: label = type === "enjoyment" ? "appreciation" : "importance";
    $: tone =
        type === "enjoyment"
            ? "text-accent-dark dark:text-accent-light"
            : "text-steel-dark dark:text-steel-light";
    // Each segment covers MAX_VALUE/SEGMENTS points; odd values half-fill one.
    $: fills = Array.from({ length: SEGMENTS }, (_, i) => {
        const per = MAX_VALUE / SEGMENTS;
        return Math.min(Math.max((value ?? 0) - i * per, 0), per) / per;
    });
</script>

{#if value != null}
    <span
        class="inline-flex items-center justify-center gap-1.5 {tone}"
        role="img"
        aria-label="{label} rating: {value} out of {MAX_VALUE}"
        title="{label}: {value}/{MAX_VALUE}"
    >
        <span class="flex items-center gap-[2px]" aria-hidden="true">
            {#each fills as fill, i}
                <span
                    class="seg block rounded-[1px] h-[8px] w-[4px]"
                    style="background: linear-gradient(90deg, currentColor {fill * 100}%, color-mix(in srgb, currentColor 18%, transparent) {fill * 100}%); animation-delay: {i * 45}ms;"
                ></span>
            {/each}
        </span>
    </span>
{:else}
    <span
        class="inline-flex h-5 min-w-7 items-center justify-center font-mono text-xs text-ink-400 dark:text-ink-300"
        aria-label="{label} rating not set"
        title="{label}: not set"
    >
        --
    </span>
{/if}

<style>
    /* Segments sweep in left-to-right on mount; `backwards` keeps each one
       hidden until its stagger delay elapses. */
    .seg {
        transform-origin: left center;
        animation: seg-in var(--motion-base) var(--ease-emphasized) backwards;
    }

    @keyframes seg-in {
        from {
            opacity: 0;
            transform: scaleX(0.3);
        }
        to {
            opacity: 1;
            transform: scaleX(1);
        }
    }
</style>
