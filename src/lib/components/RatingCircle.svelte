<script lang="ts">
    import { onMount } from "svelte";

    export let value: number | null | undefined = null;
    export let maxValue: number = 10;
    export let type: "enjoyment" | "importance" = "enjoyment";
    export let size: number = 32; // Size in pixels
    export let animated: boolean = true;

    // Circle calculations
    const strokeWidth = 3;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    // Animation state
    let progress = 0;
    let mounted = false;

    $: targetProgress = value != null ? (value / maxValue) * circumference : 0;
    $: strokeDashoffset = circumference - progress;
    $: displayValue = value != null ? value : null;

    // Colors based on type
    $: strokeColor =
        type === "enjoyment" ? "stroke-amber-500" : "stroke-blue-500";
    $: textColor =
        type === "enjoyment" ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400";

    onMount(() => {
        mounted = true;
        if (animated && value != null) {
            // Animate from 0 to target
            const duration = 800;
            const startTime = performance.now();

            function animate(currentTime: number) {
                const elapsed = currentTime - startTime;
                const progressRatio = Math.min(elapsed / duration, 1);
                // Easing function (ease-out cubic)
                const eased = 1 - Math.pow(1 - progressRatio, 3);
                progress = targetProgress * eased;

                if (progressRatio < 1) {
                    requestAnimationFrame(animate);
                } else {
                    progress = targetProgress;
                }
            }

            requestAnimationFrame(animate);
        } else {
            progress = targetProgress;
        }
    });

    // Update progress when value changes after mount
    $: if (mounted && !animated) {
        progress = targetProgress;
    }
</script>

<div
    class="relative inline-flex items-center justify-center"
    style="width: {size}px; height: {size}px;"
>
    {#if displayValue != null}
        <svg
            width={size}
            height={size}
            class="transform -rotate-90"
            aria-hidden="true"
        >
            <!-- Background circle -->
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke-width={strokeWidth}
                class="stroke-cream-300 dark:stroke-ink-700"
            />
            <!-- Progress circle -->
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke-width={strokeWidth}
                stroke-linecap="round"
                class={strokeColor}
                stroke-dasharray={circumference}
                stroke-dashoffset={strokeDashoffset}
            />
        </svg>
        <!-- Value in center -->
        <span
            class="absolute text-xs font-semibold {textColor}"
            aria-label="{type} rating: {displayValue} out of {maxValue}"
        >
            {displayValue}
        </span>
    {:else}
        <!-- Empty state -->
        <span class="text-xs text-ink-400 dark:text-ink-500">--</span>
    {/if}
</div>
