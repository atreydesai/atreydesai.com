<script lang="ts">
    import PageShell from "$lib/components/PageShell.svelte";
    import OptimizedImage from "$lib/components/OptimizedImage.svelte";
    import { formatLongDate } from "$lib/utils/date";
    import { X, ChevronLeft, ChevronRight } from "@jis3r/icons";
    // Photos loaded from server (auto-scanned from folder with EXIF extraction)
    export let data;
    $: photos = data.photos;

    // Lightbox state
    let lightboxOpen = false;
    let currentPhotoIndex = 0;
    let lightboxImageLoaded = false;
    let triggerElement: HTMLElement | null = null;
    let dialogElement: HTMLElement | null = null;

    function openLightbox(index: number, trigger: HTMLElement) {
        currentPhotoIndex = index;
        lightboxOpen = true;
        lightboxImageLoaded = false;
        triggerElement = trigger;
        if (typeof document !== "undefined") {
            document.body.style.overflow = "hidden";
        }
        // Move focus into dialog on next tick after it renders
        setTimeout(() => dialogElement?.focus(), 0);
    }

    function closeLightbox() {
        lightboxOpen = false;
        if (typeof document !== "undefined") {
            document.body.style.overflow = "";
        }
        // Return focus to the photo button that opened the lightbox
        triggerElement?.focus();
        triggerElement = null;
    }

    function trapFocus(e: KeyboardEvent) {
        if (!dialogElement) return;
        const focusable = Array.from(
            dialogElement.querySelectorAll<HTMLElement>(
                'button, [href], input, [tabindex]:not([tabindex="-1"])'
            )
        ).filter(el => !el.hasAttribute('disabled'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.key === "Tab") {
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
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


    $: currentPhoto = photos[currentPhotoIndex];
</script>

<PageShell
    title="Photography | Atrey Desai"
    description="Photography portfolio by Atrey Desai. Follow @framedbyatrey on Instagram for more."
    url="https://atreydesai.com/photography/"
    width="wide"
>
    <header slot="header" class="page-header page-header-title-only">
        <div class="flex items-baseline justify-between gap-4">
            <h1 class="type-page-title text-ink-900 dark:text-cream-100">
                photography
            </h1>
            <a
                href="https://instagram.com/framedbyatrey"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400 hover:text-accent transition-colors"
            >
                <span>@framedbyatrey</span>
            </a>
        </div>
    </header>
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
                    on:click={(e) => openLightbox(index, e.currentTarget)}
                >
                    <div
                        class="h-full w-full transition-transform duration-300 group-hover:scale-[1.02]"
                    >
                        <OptimizedImage
                            src={photo.thumbSrc}
                            srcset={photo.thumbSrcset}
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
                    class="border border-ink-300 dark:border-ink-600 px-2 py-1 rounded"
                    >static/images/photography/</code
                >
            </p>
        </div>
    {/if}
</PageShell>

<!-- Lightbox -->
{#if lightboxOpen && currentPhoto}
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div
        bind:this={dialogElement}
        class="layer-modal fixed inset-0 flex items-center justify-center bg-ink-900/95"
        on:click={closeLightbox}
        on:keydown={(e) => { trapFocus(e); if (e.key === "Escape") closeLightbox(); if (e.key === "ArrowRight") nextPhoto(); if (e.key === "ArrowLeft") prevPhoto(); }}
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
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            class="max-w-5xl max-h-[85vh] flex flex-col items-center px-4"
            on:click|stopPropagation={() => {}}
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
                    class="absolute inset-0 animate-pulse bg-ink-700 transition-opacity duration-300"
                    class:opacity-0={lightboxImageLoaded}
                ></div>

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
                            {formatLongDate(currentPhoto.exif.date)}
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
