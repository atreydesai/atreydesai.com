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

    function getKeyframes() {
        switch (animation) {
            case "fade":
                return [{ opacity: 0 }, { opacity: 1 }];
            case "slide-left":
                return [
                    { opacity: 0, transform: "translateX(-40px)" },
                    { opacity: 1, transform: "translateX(0)" },
                ];
            case "slide-right":
                return [
                    { opacity: 0, transform: "translateX(40px)" },
                    { opacity: 1, transform: "translateX(0)" },
                ];
            case "scale":
                return [
                    { opacity: 0, transform: "scale(0.9)" },
                    { opacity: 1, transform: "scale(1)" },
                ];
            case "fade-up":
            default:
                return [
                    { opacity: 0, transform: "translateY(30px)" },
                    { opacity: 1, transform: "translateY(0)" },
                ];
        }
    }

    onMount(() => {
        if (!browser || !element) return;

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        if (prefersReducedMotion) {
            return;
        }

        let hasAnimated = false;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        if (!hasAnimated || !once) {
                            element.animate(getKeyframes(), {
                                delay,
                                duration,
                                easing: "cubic-bezier(0.16, 1, 0.3, 1)",
                                fill: "both",
                            });
                            hasAnimated = true;
                        }
                        if (once) {
                            observer.unobserve(entry.target);
                        }
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
    class="scroll-reveal"
>
    <slot />
</div>

<style>
    .scroll-reveal {
        will-change: opacity, transform;
    }
</style>
