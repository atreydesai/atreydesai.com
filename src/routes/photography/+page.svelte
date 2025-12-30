<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import OptimizedImage from "$lib/components/OptimizedImage.svelte";
    import { X, ChevronLeft, ChevronRight } from "@jis3r/icons";
    import { Instagram } from "lucide-svelte";
    import { onMount } from "svelte";

    // Photos loaded from server (auto-scanned from folder with EXIF extraction)
    export let data;
    $: photos = data.photos;

    // Split photos into three columns for masonry (photos 0,3,6... | 1,4,7... | 2,5,8...)
    $: col1 = photos.filter((_: unknown, i: number) => i % 3 === 0);
    $: col2 = photos.filter((_: unknown, i: number) => i % 3 === 1);
    $: col3 = photos.filter((_: unknown, i: number) => i % 3 === 2);

    // Get original index for lightbox from column index
    function getOriginalIndex(columnIndex: number, colNum: number): number {
        return columnIndex * 3 + colNum;
    }

    // Lightbox state
    let lightboxOpen = false;
    let currentPhotoIndex = 0;
    let lightboxImageLoaded = false;

    function openLightbox(index: number) {
        currentPhotoIndex = index;
        lightboxOpen = true;
        lightboxImageLoaded = false;
        if (typeof document !== "undefined") {
            document.body.style.overflow = "hidden";
        }
    }

    function closeLightbox() {
        lightboxOpen = false;
        if (typeof document !== "undefined") {
            document.body.style.overflow = "";
        }
    }

    function nextPhoto() {
        lightboxImageLoaded = false;
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
    }

    function prevPhoto() {
        lightboxImageLoaded = false;
        currentPhotoIndex =
            (currentPhotoIndex - 1 + photos.length) % photos.length;
    }

    // Keyboard navigation
    onMount(() => {
        const handleKeydown = (e: KeyboardEvent) => {
            if (!lightboxOpen) return;
            if (e.key === "Escape") closeLightbox();
            if (e.key === "ArrowRight") nextPhoto();
            if (e.key === "ArrowLeft") prevPhoto();
        };
        window.addEventListener("keydown", handleKeydown);
        return () => window.removeEventListener("keydown", handleKeydown);
    });

    $: currentPhoto = photos[currentPhotoIndex];
</script>

<Seo
    title="Photography | Atrey Desai"
    description="Photography by Atrey Desai - capturing moments and perspectives."
/>

<div class="layout-main py-8 md:py-12">
    <div class="flex items-center justify-between mb-8">
        <h1 class="heading-display text-3xl text-ink-900 dark:text-cream-100">
            photography
        </h1>
        <a
            href="https://instagram.com/framedbyatrey"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400 hover:text-accent transition-colors"
        >
            <Instagram size={18} />
            <span>@framedbyatrey</span>
        </a>
    </div>

    <p class="text-ink-600 dark:text-cream-400 mb-8">
        Photography from over the years, semi-randomized. Selected work is also
        on my Instagram.
    </p>
</div>

<!-- Expanded width container for photography grid -->
<div class="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
    <!-- Masonry-style Grid - supports items spanning 2 columns -->
    {#if photos.length > 0}
        <div
            class="grid grid-cols-2 md:grid-cols-3 grid-flow-dense gap-4"
            style="grid-auto-rows: 10px;"
        >
            {#each photos as photo, index}
                {@const isLarge =
                    (index * 7) % 10 === 0 && photo.orientation !== "portrait"}
                <button
                    type="button"
                    class="overflow-hidden rounded-lg group cursor-pointer"
                    style="
                        grid-column: span {isLarge ? 2 : 1};
                        grid-row: span {photo.orientation === 'landscape'
                        ? isLarge
                            ? 24
                            : 16
                        : photo.orientation === 'square'
                          ? isLarge
                              ? 24
                              : 16
                          : 20};
                    "
                    on:click={() => openLightbox(index)}
                >
                    <div
                        class="h-full w-full transition-transform duration-300 group-hover:scale-[1.02]"
                    >
                        <OptimizedImage
                            src={photo.thumbSrc}
                            alt={photo.alt}
                            aspectRatio={photo.orientation}
                            class="h-full w-full"
                        />
                    </div>
                </button>
            {/each}
        </div>
    {:else}
        <div class="text-center py-16 text-ink-500 dark:text-ink-400">
            <p class="mb-4">No photos yet.</p>
            <p class="text-sm">
                Add photos to <code
                    class="bg-cream-200 dark:bg-ink-700 px-2 py-1 rounded"
                    >static/images/photography/</code
                >
            </p>
        </div>
    {/if}
</div>

<!-- Lightbox -->
{#if lightboxOpen && currentPhoto}
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div
        class="fixed inset-0 z-50 bg-ink-900/95 flex items-center justify-center"
        on:click={closeLightbox}
        on:keydown={(e) => e.key === "Escape" && closeLightbox()}
        role="dialog"
        aria-modal="true"
        aria-label="Photo lightbox"
        tabindex="-1"
    >
        <!-- Close button -->
        <button
            type="button"
            class="absolute top-4 right-4 text-cream-100 hover:text-cream-300 transition-colors z-10"
            on:click|stopPropagation={closeLightbox}
            aria-label="Close lightbox"
        >
            <X size={32} />
        </button>

        <!-- Navigation buttons -->
        {#if photos.length > 1}
            <button
                type="button"
                class="absolute left-4 top-1/2 -translate-y-1/2 text-cream-100 hover:text-cream-300 transition-colors z-10"
                on:click|stopPropagation={prevPhoto}
                aria-label="Previous photo"
            >
                <ChevronLeft size={48} />
            </button>

            <button
                type="button"
                class="absolute right-4 top-1/2 -translate-y-1/2 text-cream-100 hover:text-cream-300 transition-colors z-10"
                on:click|stopPropagation={nextPhoto}
                aria-label="Next photo"
            >
                <ChevronRight size={48} />
            </button>
        {/if}

        <!-- Photo container -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="max-w-5xl max-h-[85vh] flex flex-col items-center px-4"
            on:click|stopPropagation={() => {}}
            aria-hidden="true"
        >
            <!-- Image with loading state -->
            <div
                class="relative rounded-lg overflow-hidden bg-ink-800"
                class:lightbox-landscape={currentPhoto.orientation ===
                    "landscape"}
                class:lightbox-portrait={currentPhoto.orientation ===
                    "portrait"}
                class:lightbox-square={currentPhoto.orientation === "square"}
            >
                <!-- Loading placeholder -->
                <div
                    class="absolute inset-0 bg-ink-700 flex items-center justify-center transition-opacity duration-300"
                    class:opacity-0={lightboxImageLoaded}
                >
                    <div
                        class="w-8 h-8 border-2 border-cream-400 border-t-transparent rounded-full animate-spin"
                    ></div>
                </div>

                <img
                    src={currentPhoto.src}
                    alt={currentPhoto.alt}
                    class="max-h-[70vh] w-auto object-contain transition-opacity duration-300"
                    class:opacity-0={!lightboxImageLoaded}
                    on:load={() => (lightboxImageLoaded = true)}
                />
            </div>

            <!-- EXIF data -->
            {#if currentPhoto.exif}
                <div class="mt-4 text-cream-300 text-sm text-center space-y-1">
                    <p class="font-medium text-cream-100">{currentPhoto.alt}</p>
                    {#if currentPhoto.exif.camera || currentPhoto.exif.lens}
                        <p>
                            {currentPhoto.exif.camera || ""}{currentPhoto.exif
                                .camera && currentPhoto.exif.lens
                                ? " · "
                                : ""}{currentPhoto.exif.lens || ""}
                        </p>
                    {/if}
                    {#if currentPhoto.exif.aperture || currentPhoto.exif.shutter || currentPhoto.exif.iso}
                        <p class="text-cream-400">
                            {[
                                currentPhoto.exif.focalLength,
                                currentPhoto.exif.aperture,
                                currentPhoto.exif.shutter,
                                currentPhoto.exif.iso,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </p>
                    {/if}
                    {#if currentPhoto.exif.date}
                        <p class="text-cream-500">
                            {new Date(
                                currentPhoto.exif.date,
                            ).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                            })}
                        </p>
                    {/if}
                </div>
            {/if}
        </div>

        <!-- Photo counter -->
        {#if photos.length > 1}
            <div
                class="absolute bottom-4 left-1/2 -translate-x-1/2 text-cream-400 text-sm"
            >
                {currentPhotoIndex + 1} / {photos.length}
            </div>
        {/if}
    </div>
{/if}

<style>
    .lightbox-landscape {
        max-width: 90vw;
    }
    .lightbox-portrait {
        max-width: min(60vw, 500px);
    }
    .lightbox-square {
        max-width: min(70vw, 600px);
    }
</style>
