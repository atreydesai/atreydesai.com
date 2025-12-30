<script lang="ts">
    import { onMount, onDestroy } from "svelte";

    export let text = "";
    export let duration = 800;
    export let delay = 0;
    export let animateOnLoad = true;
    export let hoverTrigger = true;
    let className = "";
    export { className as class };

    const characters = "abcdefghijklmnopqrstuvwxyz";
    let displayText = text;
    let interval: ReturnType<typeof setInterval>;
    let isAnimating = false;

    function triggerAnimation() {
        if (isAnimating) return;
        isAnimating = true;

        let iteration = 0;
        const totalIterations = text.length;

        clearInterval(interval);

        // Calculate interval time based on duration and number of characters
        // Minimum 30ms for visibility
        const stepTime = Math.max(duration / (totalIterations * 2), 30);

        interval = setInterval(() => {
            displayText = text
                .split("")
                .map((char, index) => {
                    if (char === " ") return " ";
                    if (index < iteration) return text[index];
                    return characters[
                        Math.floor(Math.random() * characters.length)
                    ];
                })
                .join("");

            if (iteration >= totalIterations) {
                clearInterval(interval);
                isAnimating = false;
            }

            iteration += 0.5; // Slow down a bit for better effect
        }, stepTime);
    }

    onMount(() => {
        if (animateOnLoad) {
            setTimeout(() => triggerAnimation(), delay);
        }
    });

    onDestroy(() => {
        clearInterval(interval);
    });
</script>

<span
    class="inline-block whitespace-pre cursor-default {className}"
    on:mouseenter={() => hoverTrigger && triggerAnimation()}
    role="presentation"
>
    {displayText}
</span>
