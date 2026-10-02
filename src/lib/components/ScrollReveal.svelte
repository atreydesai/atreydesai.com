<script lang="ts">
    import { onMount } from "svelte";

    export let delay = 0;

    let element: HTMLElement;

    const KEYFRAMES = [
        { opacity: 0, transform: "translateY(30px)" },
        { opacity: 1, transform: "translateY(0)" },
    ];

    onMount(() => {
        if (!element) return;

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
        ).matches;
        if (prefersReducedMotion) {
            return;
        }

        // Only content that starts off screen fades up. Content already on
        // screen at load stays as rendered, so it never blinks out and back
        // in. Off-screen content is parked on the first keyframe (hidden)
        // while nobody can see it, then played once it scrolls into view.
        let reveal: Animation | null = null;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[entries.length - 1];
                if (!reveal) {
                    if (entry.isIntersecting) {
                        observer.disconnect();
                        return;
                    }
                    reveal = element.animate(KEYFRAMES, {
                        delay,
                        duration: 600,
                        easing: "cubic-bezier(0.16, 1, 0.3, 1)",
                        fill: "both",
                    });
                    reveal.pause();
                    return;
                }
                if (!entry.isIntersecting) return;
                observer.disconnect();
                element.style.willChange = "opacity, transform";
                reveal.onfinish = () => {
                    element.style.willChange = "auto";
                };
                reveal.play();
            },
            { threshold: 0.1 },
        );

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    });
</script>

<div bind:this={element}>
    <slot />
</div>
