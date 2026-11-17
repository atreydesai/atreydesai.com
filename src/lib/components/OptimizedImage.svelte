<script lang="ts">
    import { onMount } from "svelte";

    export let src: string;
    export let alt: string;
    export let aspectRatio: "landscape" | "portrait" | "square" = "landscape";
    export let class_: string = "";
    export { class_ as class };
    // Responsive candidate set (e.g. "img-400.webp 400w, img-800.webp 800w").
    // Without it `sizes` is inert and the browser always loads the single src.
    export let srcset: string = "";
    // How wide the image is drawn, for choosing from `srcset`. The caller
    // knows the slot; the default is a grid tile (2 columns, then 3).
    export let sizes = "(max-width: 767px) 50vw, 33vw";
    // Images in the first screenful load at once, and the very first one ahead
    // of everything else, since it is usually the largest paint.
    export let eager = false;
    export let priority = false;

    // Lazy images fade in once loaded. Eager ones are visible from the first
    // paint instead: hiding them until hydration would hold the largest paint
    // back for as long as the JavaScript takes.
    $: fades = !eager && !priority;
    let loaded = false;
    let imgElement: HTMLImageElement;

    const aspectRatios = {
        landscape: "aspect-3/2",
        portrait: "aspect-2/3",
        square: "aspect-square",
    };

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
    <!-- Gradient placeholder. The image is positioned too, so it paints over
         this as soon as it decodes, without waiting for the load handler. -->
    <div
        class="absolute inset-0 bg-linear-to-br from-cream-200 to-cream-300 transition-opacity duration-400 dark:from-ink-700 dark:to-ink-800"
        class:opacity-0={loaded}
    ></div>

    <img
        bind:this={imgElement}
        {src}
        {alt}
        {sizes}
        srcset={srcset || undefined}
        loading={eager || priority ? "eager" : "lazy"}
        decoding="async"
        fetchpriority={priority ? "high" : "auto"}
        on:load={handleLoad}
        class="relative h-full w-full object-cover {fades
            ? 'transition-[opacity,transform] duration-400'
            : ''}"
        class:opacity-0={fades && !loaded}
        class:scale-105={fades && !loaded}
    />
</div>
