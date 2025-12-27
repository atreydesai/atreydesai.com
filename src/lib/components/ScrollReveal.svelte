<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";

    export let threshold = 0.1;
    export let rootMargin = "0px";
    export let animation:
        | "fade-up"
        | "fade"
        | "slide-left"
        | "slide-right"
        | "scale" = "fade-up";
    export let delay = 0;
    export let duration = 600;
    export let once = true;

    let element: HTMLElement;
    let isVisible = false;

    onMount(() => {
        if (!browser) return;

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        if (prefersReducedMotion) {
            isVisible = true;
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        isVisible = true;
                        if (once) {
                            observer.unobserve(entry.target);
                        }
                    } else if (!once) {
                        isVisible = false;
                    }
                });
            },
            { threshold, rootMargin },
        );

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    });
</script>

<div
    bind:this={element}
    class="scroll-reveal {animation}"
    class:visible={isVisible}
    style="--delay: {delay}ms; --duration: {duration}ms;"
>
    <slot />
</div>

<style>
    .scroll-reveal {
        will-change: opacity, transform;
    }

    /* Fade up animation (default) */
    .fade-up {
        opacity: 0;
        transform: translateY(30px);
        transition:
            opacity var(--duration) ease-out var(--delay),
            transform var(--duration) ease-out var(--delay);
    }

    .fade-up.visible {
        opacity: 1;
        transform: translateY(0);
    }

    /* Fade only */
    .fade {
        opacity: 0;
        transition: opacity var(--duration) ease-out var(--delay);
    }

    .fade.visible {
        opacity: 1;
    }

    /* Slide from left */
    .slide-left {
        opacity: 0;
        transform: translateX(-40px);
        transition:
            opacity var(--duration) ease-out var(--delay),
            transform var(--duration) ease-out var(--delay);
    }

    .slide-left.visible {
        opacity: 1;
        transform: translateX(0);
    }

    /* Slide from right */
    .slide-right {
        opacity: 0;
        transform: translateX(40px);
        transition:
            opacity var(--duration) ease-out var(--delay),
            transform var(--duration) ease-out var(--delay);
    }

    .slide-right.visible {
        opacity: 1;
        transform: translateX(0);
    }

    /* Scale up */
    .scale {
        opacity: 0;
        transform: scale(0.9);
        transition:
            opacity var(--duration) ease-out var(--delay),
            transform var(--duration) ease-out var(--delay);
    }

    .scale.visible {
        opacity: 1;
        transform: scale(1);
    }
</style>
