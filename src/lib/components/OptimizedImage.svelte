<script lang="ts">
    import { onMount } from "svelte";

    export let src: string;
    export let alt: string;
    export let aspectRatio: "landscape" | "portrait" | "square" = "landscape";
    export let priority: boolean = false; // For above-the-fold images
    export let class_: string = "";
    export { class_ as class };
    // Responsive candidate set (e.g. "img-400.webp 400w, img-800.webp 800w").
    // Without it `sizes` is inert and the browser always loads the single src.
    export let srcset: string = "";

    let loaded = false;
    let imgElement: HTMLImageElement;

    const aspectRatios = {
        landscape: "aspect-[3/2]",
        portrait: "aspect-[2/3]",
        square: "aspect-square",
    };

    // Calculate sizes based on grid layout (responsive)
    // Grid is 2 cols on mobile, 3 cols on md+
    const sizes = "(max-width: 768px) 50vw, 33vw";

    onMount(() => {
        if (imgElement?.complete && imgElement?.naturalWidth > 0) {
            loaded = true;
        }
    });

    function handleLoad() {
        loaded = true;
    }
</script>

<div
    class="relative overflow-hidden rounded-lg {aspectRatios[
        aspectRatio
    ]} {class_}"
>
    <!-- Blur placeholder background with CSS pattern -->
    <div
        class="absolute inset-0 bg-gradient-to-br from-cream-200 to-cream-300 dark:from-ink-700 dark:to-ink-800 transition-opacity duration-500"
        class:opacity-0={loaded}
    ></div>

    <!-- Actual image with native lazy loading and decoding -->
    <img
        bind:this={imgElement}
        {src}
        {alt}
        {sizes}
        srcset={srcset || undefined}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchpriority={priority ? "high" : "auto"}
        on:load={handleLoad}
        class="w-full h-full object-cover transition-all duration-500"
        class:opacity-0={!loaded}
        class:scale-105={!loaded}
        class:opacity-100={loaded}
        class:scale-100={loaded}
    />
</div>
