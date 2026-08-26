<script lang="ts">
    import PageShell from "$lib/components/PageShell.svelte";
    import OptimizedImage from "$lib/components/OptimizedImage.svelte";
    import { formatLongDate } from "$lib/utils/date";
    import { X, ChevronLeft, ChevronRight } from "@jis3r/icons";
    // Photos are bundled into a generated manifest during the build.
    export let data;
    $: photos = data.photos;

    type MosaicVariant = "feature" | "tall" | "standard" | "compact";

    // A fixed rhythm keeps server and client rendering identical while
    // avoiding an obvious repeating grid. Feature tiles appear immediately
    // and at uneven intervals; the dense grid fills the spaces around them.
    const mosaicPattern: MosaicVariant[] = [
        "feature",
        "tall",
        "compact",
        "standard",
        "compact",
        "tall",
        "standard",
        "feature",
        "compact",
        "tall",
        "standard",
        "compact",
        "tall",
        "standard",
        "compact",
        "feature",
        "standard",
        "tall",
    ];

    function mosaicVariant(index: number): MosaicVariant {
        return mosaicPattern[index % mosaicPattern.length];
    }

    // An untitled photo is presentational: the grid <img> carries an empty
    // alt, so the button needs its own name for screen readers and Voice
    // Control. Captioned photos are announced by their caption.
    function tileLabel(photo: (typeof photos)[number], index: number): string {
        return photo.caption
            ? `View photo: ${photo.caption}`
            : `View photo ${index + 1} of ${photos.length}`;
    }

    // Lightbox state
    let lightboxOpen = false;
    let currentPhotoIndex = 0;
    let lightboxImageLoaded = false;
    let triggerElement: HTMLElement | null = null;
    let dialogElement: HTMLElement | null = null;
    let lockedScrollY = 0;

    // Warm the neighbours so arrowing/swiping doesn't re-show the placeholder
    // for a photo the viewer is about to reach.
    function preloadNeighbours(index: number) {
        if (typeof Image === "undefined" || photos.length < 2) return;
        for (const offset of [1, -1]) {
            const neighbour =
                photos[(index + offset + photos.length) % photos.length];
            if (neighbour) new Image().src = neighbour.src;
        }
    }

    // `overflow: hidden` on <body> doesn't hold on iOS Safari, so pin the body
    // at the current offset instead and restore it on close.
    function lockScroll() {
        if (typeof document === "undefined") return;
        lockedScrollY = window.scrollY;
        document.body.style.position = "fixed";
        document.body.style.top = `-${lockedScrollY}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.overflow = "hidden";
    }

    function unlockScroll() {
        if (typeof document === "undefined") return;
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.overflow = "";
        window.scrollTo(0, lockedScrollY);
    }

    function openLightbox(index: number, trigger: HTMLElement) {
        currentPhotoIndex = index;
        lightboxOpen = true;
        lightboxImageLoaded = false;
        triggerElement = trigger;
        lockScroll();
        preloadNeighbours(index);
        // Move focus into dialog on next tick after it renders
        setTimeout(() => dialogElement?.focus(), 0);
    }

    function closeLightbox() {
        lightboxOpen = false;
        unlockScroll();
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
        preloadNeighbours(currentPhotoIndex);
    }

    function prevPhoto() {
        lightboxImageLoaded = false;
        currentPhotoIndex =
            (currentPhotoIndex - 1 + photos.length) % photos.length;
        preloadNeighbours(currentPhotoIndex);
    }

    // Swiping between full-screen photos is the gesture people reach for first
    // on a touchscreen; the chevrons stay as the non-gesture equivalent.
    const SWIPE_THRESHOLD_PX = 50;
    let swipeStartX: number | null = null;
    let swipeStartY = 0;

    function onSwipeStart(event: PointerEvent) {
        if (event.pointerType === "mouse") return;
        swipeStartX = event.clientX;
        swipeStartY = event.clientY;
    }

    function onSwipeEnd(event: PointerEvent) {
        if (swipeStartX === null) return;
        const dx = event.clientX - swipeStartX;
        const dy = event.clientY - swipeStartY;
        swipeStartX = null;
        // Ignore mostly-vertical drags so a scroll attempt isn't read as a swipe.
        if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0) nextPhoto();
        else prevPhoto();
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
                class="flex items-center gap-2 text-sm text-ink-500 dark:text-cream-500 hover:text-accent transition-colors"
            >
                <span>@framedbyatrey</span>
            </a>
        </div>
    </header>
    <!-- Dense mosaic: mixed heights plus recurring two-column feature tiles. -->
    {#if photos.length > 0}
        <div
            class="grid grid-cols-2 md:grid-cols-3 grid-flow-dense gap-4"
            style="grid-auto-rows: 10px;"
        >
            {#each photos as photo, index}
                {@const variant = mosaicVariant(index)}
                <button
                    type="button"
                    class="photo-tile photo-tile-{variant} photo-tile-{photo.orientation} group cursor-pointer overflow-hidden rounded-lg"
                    aria-label={tileLabel(photo, index)}
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
        <div class="text-center py-16 text-ink-500 dark:text-cream-500">
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
        <!-- Photo changes are silent otherwise: the counter is visual only. -->
        <p class="sr-only" aria-live="polite" aria-atomic="true">
            Photo {currentPhotoIndex + 1} of {photos.length}{currentPhoto.caption
                ? `: ${currentPhoto.caption}`
                : ""}
        </p>

        <!-- Close button -->
        <button
            type="button"
            class="lightbox-control absolute top-2 right-2 text-cream-100 hover:text-cream-300 transition-colors z-10"
            on:click|stopPropagation={closeLightbox}
            aria-label="Close lightbox"
        >
            <X size={32} />
        </button>

        <!-- Navigation buttons -->
        {#if photos.length > 1}
            <button
                type="button"
                class="lightbox-control absolute left-1 top-1/2 -translate-y-1/2 text-cream-100 hover:text-cream-300 transition-colors z-10"
                on:click|stopPropagation={prevPhoto}
                aria-label="Previous photo"
            >
                <ChevronLeft size={48} />
            </button>

            <button
                type="button"
                class="lightbox-control absolute right-1 top-1/2 -translate-y-1/2 text-cream-100 hover:text-cream-300 transition-colors z-10"
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
            on:pointerdown={onSwipeStart}
            on:pointerup={onSwipeEnd}
            on:pointercancel={() => (swipeStartX = null)}
        >
            <!-- Image with loading state. The intrinsic width/height come from
                 the manifest, so the browser reserves a correctly-shaped box
                 before the full-size JPEG arrives: the placeholder covers real
                 space and the panel doesn't jump when the photo lands. -->
            <div
                class="lightbox-frame relative rounded-lg overflow-hidden bg-ink-800"
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
                    width={currentPhoto.width}
                    height={currentPhoto.height}
                    class="lightbox-image block object-contain transition-opacity duration-300"
                    class:opacity-0={!lightboxImageLoaded}
                    on:load={() => (lightboxImageLoaded = true)}
                />
            </div>

            <!-- EXIF data -->
            {#if currentPhoto.exif}
                <div class="mt-4 text-cream-300 text-sm text-center space-y-1">
                    {#if currentPhoto.caption}
                        <p class="font-medium text-cream-100">
                            {currentPhoto.caption}
                        </p>
                    {/if}
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
                aria-hidden="true"
            >
                {currentPhotoIndex + 1} / {photos.length}
            </div>
        {/if}
    </div>
{/if}

<style>
    .photo-tile {
        grid-column: span 1;
    }

    .photo-tile-feature {
        grid-column: span 2;
        grid-row: span 24;
    }

    .photo-tile-portrait.photo-tile-tall {
        grid-row: span 24;
    }

    .photo-tile-portrait.photo-tile-standard {
        grid-row: span 20;
    }

    .photo-tile-portrait.photo-tile-compact {
        grid-row: span 16;
    }

    .photo-tile-square.photo-tile-tall,
    .photo-tile-landscape.photo-tile-tall {
        grid-row: span 20;
    }

    .photo-tile-square.photo-tile-standard,
    .photo-tile-landscape.photo-tile-standard {
        grid-row: span 16;
    }

    .photo-tile-square.photo-tile-compact,
    .photo-tile-landscape.photo-tile-compact {
        grid-row: span 13;
    }

    /* Sized by the image's intrinsic ratio, clamped by the viewport. */
    .lightbox-frame {
        max-height: 70vh;
        /* Horizontal drags are the swipe gesture; vertical is still the page. */
        touch-action: pan-y;
    }

    .lightbox-image {
        width: auto;
        height: auto;
        max-width: 100%;
        max-height: 70vh;
    }

    .lightbox-landscape {
        max-width: 90vw;
    }
    .lightbox-portrait {
        max-width: min(60vw, 500px);
    }
    .lightbox-square {
        max-width: min(70vw, 600px);
    }

    /* Chevrons and the close glyph are drawn small; the padding is what makes
       them comfortable to hit, especially next to the swipe area. */
    .lightbox-control {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: var(--space-2);
        border-radius: var(--radius-media);
    }
</style>
