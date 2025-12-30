<script lang="ts">
    import { onMount } from "svelte";

    export let src: string;
    export let alt: string;
    export let aspectRatio: "landscape" | "portrait" | "square" = "landscape";
    export let class_: string = "";
    export { class_ as class };

    let loaded = false;
    let imgElement: HTMLImageElement;

    // Generate blur placeholder inline as a tiny base64 (will be replaced by actual blur later)
    const aspectRatios = {
        landscape: "aspect-[3/2]",
        portrait: "aspect-[2/3]",
        square: "aspect-square",
    };

    onMount(() => {
        if (imgElement?.complete) {
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
    <!-- Blur placeholder background -->
    <div
        class="absolute inset-0 bg-cream-300 dark:bg-ink-700 transition-opacity duration-500"
        class:opacity-0={loaded}
    ></div>

    <!-- Actual image -->
    <!-- svelte-ignore element_invalid_self_closing_tag -->
    <img
        bind:this={imgElement}
        {src}
        {alt}
        loading="lazy"
        decoding="async"
        on:load={handleLoad}
        class="w-full h-full object-cover transition-all duration-500"
        class:opacity-0={!loaded}
        class:scale-105={!loaded}
        class:opacity-100={loaded}
        class:scale-100={loaded}
    />
</div>
