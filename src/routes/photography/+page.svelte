<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import PageShell from "#lib/components/PageShell.svelte";
    import OptimizedImage from "#lib/components/OptimizedImage.svelte";
    import Mark from "#lib/components/Mark.svelte";
    import { trapFocus } from "#lib/focus-trap.ts";
    import { lockScroll, unlockScroll } from "#lib/scroll-lock.ts";
    import { formatLongDate } from "#lib/utils/date.ts";
    import { X, ChevronLeft, ChevronRight, ArrowUpRight, Download } from "@jis3r/icons";
    import {
        originalUrl,
        photoStem,
        renditionSrcset,
        renditionUrl,
    } from "#lib/photo-urls.js";
    import type { PageData } from "./$types";
    import type { PhotoData } from "./+page.server";
    // Photos are bundled into a generated manifest during the build.
    export let data: PageData;
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

    // Grid geometry. The mosaic is designed at a 352px column (the wide
    // shell's three columns at full width), where a row step is 26px: a 10px
    // row and the 16px gap below it. Rows are sized from the column width
    // (.photo-grid, below), so a tile keeps the same shape at every width
    // instead of turning into a tall sliver once columns narrow while rows
    // stay fixed. Gaps stay 16px, the style guide's mobile minimum.
    const DESIGN_COLUMN_PX = 352;
    const ROW_STEP_PX = 26;
    const GAP_PX = 16;
    const TILE_ROWS: Record<MosaicVariant, Record<PhotoData["orientation"], number>> = {
        feature: { portrait: 24, landscape: 24, square: 24 },
        tall: { portrait: 24, landscape: 20, square: 20 },
        standard: { portrait: 20, landscape: 16, square: 16 },
        compact: { portrait: 16, landscape: 13, square: 13 },
    };

    // How wide a tile's image is drawn, for picking from its srcset. A photo
    // fills its tile (object-fit: cover), so when the photo is wider than the
    // tile's shape it is drawn at the tile's height and cropped at the sides:
    // drawn width = the tile's width times (photo ratio / tile ratio), at
    // least 1. Tiles scale with the column, so that factor is fixed per tile.
    function tileSizes(photo: PhotoData, variant: MosaicVariant): string {
        const rows = TILE_ROWS[variant][photo.orientation];
        const height = rows * ROW_STEP_PX - GAP_PX;
        const width =
            variant === "feature" ? 2 * DESIGN_COLUMN_PX + GAP_PX : DESIGN_COLUMN_PX;
        const factor = Math.max(1, (height * photo.width) / photo.height / width);
        // Column widths: two columns inside 16px gutters below 768px, three
        // inside 24-32px gutters above, up to the 352px design column.
        const [phone, desktop] =
            variant === "feature"
                ? ["calc(100vw - 32px)", "min(66.67vw - 48px, 720px)"]
                : ["calc(50vw - 24px)", "min(33.33vw - 32px, 352px)"];
        const scaled = (expr: string) =>
            factor > 1.01 ? `calc(${expr} * ${factor.toFixed(2)})` : expr;
        return `(max-width: 767px) ${scaled(phone)}, ${scaled(desktop)}`;
    }

    // The grid stops at 1200px: past that a 2x screen's opening tile would
    // pull an 800 KB file to show a crop, for no detail anyone sees at tile
    // size. The lightbox is where the 2048px rendition earns its bytes.
    const GRID_MAX_WIDTH = 1200;

    // The lightbox draws the photo within its frame's caps (see
    // .lightbox-* below): 70vh tall, the 1024px panel less its padding, and
    // a width cap by orientation.
    const LIGHTBOX_WIDTH_CAP: Record<PhotoData["orientation"], string> = {
        landscape: "90vw",
        portrait: "min(60vw, 500px)",
        square: "min(70vw, 600px)",
    };

    // Below 640px every orientation may take the full width less the
    // gutters (see .lightbox-* below).
    function lightboxSizes(photo: PhotoData): string {
        const byHeight = ((70 * photo.width) / photo.height).toFixed(2);
        return (
            `(max-width: 639px) min(100vw - 32px, ${byHeight}vh), ` +
            `min(${LIGHTBOX_WIDTH_CAP[photo.orientation]}, 100vw - 32px, 992px, ${byHeight}vh)`
        );
    }

    // The download is the untouched original; its label says what that means.
    function originalLabel(photo: PhotoData): string {
        const extension = photo.filename.split(".").pop()?.toLowerCase() ?? "";
        const format = { jpg: "JPEG", jpeg: "JPEG", png: "PNG", webp: "WebP" }[extension] ?? "";
        const megabytes = (photo.bytes / 1_000_000).toFixed(1);
        return `${photo.width} × ${photo.height} ${format}, ${megabytes} MB`.replace("  ", " ");
    }

    // The button's name is what screen readers and Voice Control use, so it
    // carries the photo's description; a photo with none falls back to its
    // position.
    function tileLabel(photo: (typeof photos)[number], index: number): string {
        return photo.alt
            ? `View photo: ${photo.alt}`
            : `View photo ${index + 1} of ${photos.length}`;
    }

    // Lightbox state
    let lightboxOpen = false;
    let currentPhotoIndex = 0;
    let lightboxImageLoaded = false;
    let triggerElement: HTMLElement | null = null;
    let dialogElement: HTMLElement | null = null;

    // Warm the neighbours so arrowing/swiping doesn't re-show the placeholder
    // for a photo the viewer is about to reach. They get the lightbox's own
    // srcset and sizes, so the browser fetches the same file the lightbox will
    // ask for. (sizes first: setting srcset starts the selection.)
    function preloadNeighbours(index: number) {
        if (typeof Image === "undefined" || photos.length < 2) return;
        for (const offset of [1, -1]) {
            const neighbour =
                photos[(index + offset + photos.length) % photos.length];
            if (!neighbour) continue;
            const image = new Image();
            image.sizes = lightboxSizes(neighbour);
            image.srcset = renditionSrcset(neighbour);
        }
    }

    // The open photo lives in the URL (?photo=<its file name, no extension>),
    // so Back closes the lightbox the way it closes any full-screen view on a
    // phone, and a photo can be linked to. Opening adds one history entry,
    // stepping between photos replaces it, and closing from the page goes
    // back over it: the history moves first and the lightbox follows the URL
    // (syncFromUrl), so every way of closing takes the same path.
    const PHOTO_PARAM = "photo";
    // Whether the current history entry is the one opening pushed. A photo
    // opened from a link has no entry of ours behind it to go back to.
    let pushedEntry = false;

    function urlFor(photo: PhotoData | null): string {
        const url = new URL(window.location.href);
        if (photo) url.searchParams.set(PHOTO_PARAM, photoStem(photo.filename));
        else url.searchParams.delete(PHOTO_PARAM);
        return `${url.pathname}${url.search}${url.hash}`;
    }

    // Through SvelteKit (shallow: no load reruns), not history.pushState(),
    // which would overwrite the router's own entry state.
    function writeUrl(photo: PhotoData | null, replace: boolean) {
        goto(urlFor(photo), { shallow: true, replace, state: page.state }).catch(() => {
            // The router isn't ready yet; the lightbox works without the URL.
        });
    }

    function showLightbox(index: number) {
        // Already showing it: its image has loaded and won't fire again.
        if (lightboxOpen && index === currentPhotoIndex) return;
        currentPhotoIndex = index;
        lightboxImageLoaded = false;
        preloadNeighbours(index);
        if (lightboxOpen) return;
        lightboxOpen = true;
        lockScroll();
        // Move focus into dialog on next tick after it renders
        setTimeout(() => dialogElement?.focus(), 0);
    }

    function hideLightbox() {
        if (!lightboxOpen) return;
        lightboxOpen = false;
        unlockScroll();
        // Return focus to the photo button that opened the lightbox; one
        // opened from a link returns it to the last photo's tile.
        const tile =
            triggerElement ??
            document.querySelectorAll<HTMLElement>(".photo-tile")[currentPhotoIndex];
        tile?.focus();
        triggerElement = null;
    }

    function openLightbox(index: number, trigger: HTMLElement) {
        triggerElement = trigger;
        showLightbox(index);
        pushedEntry = true;
        writeUrl(photos[index], false);
    }

    function closeLightbox() {
        if (pushedEntry) {
            history.back(); // syncFromUrl closes it when the entry pops
        } else {
            hideLightbox();
            writeUrl(null, true);
        }
    }

    // On load (a shared link) and on Back/Forward between this page's own
    // entries. An entry with a photo reached through history is one opening
    // pushed: only that one is ever added with the parameter.
    function syncFromUrl(fromHistory: boolean) {
        const stem = new URLSearchParams(window.location.search).get(PHOTO_PARAM);
        const index = stem
            ? photos.findIndex((photo) => photoStem(photo.filename) === stem)
            : -1;
        if (index >= 0) {
            pushedEntry = fromHistory;
            showLightbox(index);
        } else {
            pushedEntry = false;
            hideLightbox();
        }
    }

    onMount(() => {
        syncFromUrl(false);
        // A popstate that is leaving for another page is the router's.
        const { pathname } = window.location;
        const onPopState = () => {
            if (window.location.pathname === pathname) syncFromUrl(true);
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    });

    // The page is up: the photos held past the first screen (see the script
    // above the grid) can come in once the first photo has. (A visit by in-app
    // navigation held nothing, so this changes nothing there.)
    onMount(() => {
        const root = document.documentElement;
        if (!root.classList.contains("photos-held")) return;
        const release = () => root.classList.remove("photos-held");
        const first = document.querySelector<HTMLImageElement>(".photo-grid img[fetchpriority=high]");
        if (!first || first.complete) return release();
        first.addEventListener("load", release, { once: true });
        first.addEventListener("error", release, { once: true });
        return () => {
            first.removeEventListener("load", release);
            first.removeEventListener("error", release);
            release();
        };
    });

    // Leaving the page with the lightbox open must not leave the next page
    // pinned in place.
    onDestroy(unlockScroll);

    function nextPhoto() {
        showLightbox((currentPhotoIndex + 1) % photos.length);
        writeUrl(photos[currentPhotoIndex], true);
    }

    function prevPhoto() {
        showLightbox((currentPhotoIndex - 1 + photos.length) % photos.length);
        writeUrl(photos[currentPhotoIndex], true);
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

<svelte:head>
    <!-- The first photo is this page's largest paint: requested first thing in
         the head (data-hoist, see hooks.server.js) with the tile's own srcset
         and sizes, so the browser fetches the same file the tile will use. -->
    {#if photos[0]}
        <link
            rel="preload"
            as="image"
            type="image/avif"
            imagesrcset={renditionSrcset(photos[0], GRID_MAX_WIDTH, "avif")}
            imagesizes={tileSizes(photos[0], mosaicVariant(0))}
            fetchpriority="high"
            data-hoist
        />
    {/if}
</svelte:head>

<PageShell
    title="Photography | Atrey Desai"
    description="Photography by Atrey Desai. More on Instagram at @framedbyatrey."
    url="https://atreydesai.com/photography/"
    pageType="CollectionPage"
    width="wide"
    heading="photography"
    headerVariant="title-only"
>
    <a
        slot="aside"
        href="https://instagram.com/framedbyatrey"
        target="_blank"
        rel="noopener noreferrer"
        class="control-text"
    >
        @framedbyatrey
        <ArrowUpRight size={12} />
        <span class="sr-only">(opens Instagram in a new tab)</span>
    </a>
    <!-- Dense mosaic: mixed heights plus recurring two-column feature tiles.
         The frame is a size container, so the grid's rows can be sized from
         its own width (see .photo-grid). -->
    {#if photos.length > 0}
        <!-- The photos past the first screen wait until the page is up. On
             a slow link the server shares the line between everything asked
             for at once, and the browser asks for the lazy tiles within a few
             screens of the top as soon as it lays them out: a quarter of a
             megabyte against the first photo and the page's scripts, among
             them the ones SvelteKit fetches at start-up and waits for before
             a tile can open (on a slow phone link, taps did nothing until
             3.4 s; 2.4 s now). Before the grid is read, this marks the page
             as holding them (hidden lazy images aren't fetched; see the style
             below); the page lets them go once it has started and the first
             photo is in (onMount, above), or this does after 6 seconds in
             any case. Without JavaScript nothing is held, and a visit by
             in-app navigation never runs it. -->
        {@html `<script>try{document.documentElement.classList.add("photos-held");setTimeout(function(){document.documentElement.classList.remove("photos-held")},6000)}catch(e){}</script>`}
        <div class="photo-grid-frame">
        <div class="photo-grid">
            {#each photos as photo, index}
                {@const variant = mosaicVariant(index)}
                <!-- The first tiles fill the first screen on every layout
                     (the opening feature tile and the column beside it), so
                     they load at once; the first goes ahead of everything. -->
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
                            src={renditionUrl(photo, 800)}
                            srcset={renditionSrcset(photo, GRID_MAX_WIDTH)}
                            avifSrcset={renditionSrcset(photo, GRID_MAX_WIDTH, "avif")}
                            sizes={tileSizes(photo, variant)}
                            alt={photo.alt}
                            aspectRatio={photo.orientation}
                            eager={index < 4}
                            priority={index === 0}
                            class="h-full w-full"
                        />
                    </div>
                </button>
            {/each}
        </div>
        </div>
        <!-- A window taller than a phone's shows more tiles than the four that
             load at once (a 1440×1000 desktop shows five): with the grid read
             and laid out, but before any held photo has been asked for, the
             tiles that start on the first screen are let off the hold. -->
        {@html `<script>try{if(document.documentElement.classList.contains("photos-held")){var v=innerHeight;document.querySelectorAll(".photo-grid img[loading=lazy]").forEach(function(i){if(i.closest(".photo-tile").getBoundingClientRect().top<v)i.setAttribute("data-first-screen","")})}}catch(e){}</script>`}
    {:else}
        <div class="text-center py-16 text-ink-500 dark:text-cream-500">
            <p class="mb-4">No photos yet.</p>
            <p class="text-sm">
                Add photos to <code
                    class="border border-ink-300 dark:border-ink-600 px-2 py-1 rounded-sm"
                    >static/images/photography/</code
                >
            </p>
        </div>
    {/if}
</PageShell>

<!-- Lightbox -->
{#if lightboxOpen && currentPhoto}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
        bind:this={dialogElement}
        class="photo-lightbox layer-modal fixed inset-0 flex items-center justify-center bg-ink-900/95"
        on:click={closeLightbox}
        on:keydown={(e) => { trapFocus(e, dialogElement); if (e.key === "Escape") closeLightbox(); if (e.key === "ArrowRight") nextPhoto(); if (e.key === "ArrowLeft") prevPhoto(); }}
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
                class="lightbox-control lightbox-step absolute left-1 top-1/2 -translate-y-1/2 text-cream-100 hover:text-cream-300 transition-colors z-10"
                on:click|stopPropagation={prevPhoto}
                aria-label="Previous photo"
            >
                <ChevronLeft size={48} />
            </button>

            <button
                type="button"
                class="lightbox-control lightbox-step absolute right-1 top-1/2 -translate-y-1/2 text-cream-100 hover:text-cream-300 transition-colors z-10"
                on:click|stopPropagation={nextPhoto}
                aria-label="Next photo"
            >
                <ChevronRight size={48} />
            </button>
        {/if}

        <!-- Photo container -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
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
                 before the photo arrives: the placeholder covers real space and
                 the panel doesn't jump when the photo lands. The lightbox
                 shows a WebP sized to the screen (up to 2048px wide); the
                 original is the download link under the caption. -->
            <div
                class="lightbox-frame relative rounded-lg overflow-hidden bg-ink-800"
                class:lightbox-landscape={currentPhoto.orientation ===
                    "landscape"}
                class:lightbox-portrait={currentPhoto.orientation ===
                    "portrait"}
                class:lightbox-square={currentPhoto.orientation === "square"}
            >
                <!-- Loading placeholder. The pulse is dropped once the photo
                     lands: a running opacity animation beats `opacity-0`, so
                     leaving it on kept the placeholder flashing over the photo. -->
                <div
                    class="pointer-events-none absolute inset-0 bg-ink-700 transition-opacity duration-300"
                    class:animate-pulse={!lightboxImageLoaded}
                    class:opacity-0={lightboxImageLoaded}
                ></div>

                <img
                    src={renditionUrl(currentPhoto, 1200)}
                    srcset={renditionSrcset(currentPhoto)}
                    sizes={lightboxSizes(currentPhoto)}
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
                <div class="photo-exif mt-4 text-cream-300 text-sm text-center space-y-1">
                    {#if currentPhoto.caption}
                        <p class="text-cream-100">
                            {currentPhoto.caption}
                        </p>
                    {/if}
                    {#if currentPhoto.exif.camera || currentPhoto.exif.lens}
                        <p>
                            {#each [currentPhoto.exif.camera, currentPhoto.exif.lens].filter(Boolean) as part, i}{#if i}{" "}<Mark kind="dot" />{" "}{/if}{part}{/each}
                        </p>
                    {/if}
                    {#if currentPhoto.exif.focalLength || currentPhoto.exif.aperture || currentPhoto.exif.shutter || currentPhoto.exif.iso}
                        <p class="text-cream-400">
                            {#each [currentPhoto.exif.focalLength, currentPhoto.exif.aperture, currentPhoto.exif.shutter, currentPhoto.exif.iso].filter(Boolean) as part, i}{#if i}{" "}<Mark kind="dot" />{" "}{/if}{part}{/each}
                        </p>
                    {/if}
                    {#if currentPhoto.exif.date}
                        <p class="text-cream-500">
                            {formatLongDate(currentPhoto.exif.date)}
                        </p>
                    {/if}
                </div>
            {/if}

            <!-- Full resolution, byte for byte: the file as it was uploaded. -->
            <a
                class="lightbox-download"
                href={originalUrl(currentPhoto)}
                download={currentPhoto.filename}
            >
                <Download size={14} />
                Download original
                <span class="lightbox-download-meta">{originalLabel(currentPhoto)}</span>
            </a>
        </div>

        <!-- Photo counter -->
        {#if photos.length > 1}
            <div
                class="absolute bottom-4 left-1/2 -translate-x-1/2 font-ui text-cream-400 text-sm tabular-nums"
                aria-hidden="true"
            >
                {currentPhotoIndex + 1} / {photos.length}
            </div>
        {/if}
    </div>
{/if}

<style>
    /* The lightbox is dark in both themes, so the drawn separators in its
       caption take a dark paper and the lighter plate. The caption and
       settings are interface text, with lining figures for the numbers. */
    .photo-exif {
        --mark-paper: var(--color-ink-900);
        --mark-plate: #f07563;
    }

    .photo-exif p {
        font-family: var(--font-ui);
        font-variant-numeric: lining-nums tabular-nums;
    }

    .photo-grid-frame {
        container-type: inline-size;
    }

    /* Held until the page has started and the first photo is in (see the
       scripts around the grid); tiles on the first screen are never held.
       The tile keeps its size from the grid and shows its placeholder, as a
       lazy tile does until its photo arrives. */
    :global(html.photos-held .photo-grid img[loading="lazy"]:not([data-first-screen])) {
        display: none;
    }

    /* Two columns, then three from 768px. A row step is 26px at the 352px
       design column and scales with the column (100cqw is the grid's width),
       so every tile keeps its designed shape. The 16px row gap is each tile's
       bottom margin rather than row-gap: a fixed gap between scaled rows would
       add up across a tile's span and stretch narrow tiles. Browsers without
       container units keep the fixed 26px step, the full-width layout. */
    .photo-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-auto-flow: dense;
        column-gap: 16px;
        grid-auto-rows: 26px;
        grid-auto-rows: calc((100cqw - 16px) * 26 / 704);
        margin-bottom: -16px;
    }

    @media (min-width: 768px) {
        .photo-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            grid-auto-rows: calc((100cqw - 32px) * 26 / 1056);
        }
    }

    .photo-tile {
        grid-column: span 1;
        margin-bottom: 16px;
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

    /* On a phone the photo takes the full width less the gutters (60vw left
       a portrait 225px wide on a 375px screen), and its height leaves room
       for the caption, the download link, and the controls. The arrows move
       from the photo's edges to the bottom corners beside the counter, off
       the photo; swiping is the main way through on a touchscreen. */
    @media (max-width: 639px) {
        .lightbox-landscape,
        .lightbox-portrait,
        .lightbox-square {
            max-width: calc(100vw - 32px);
        }

        .lightbox-frame,
        .lightbox-image {
            max-height: min(70vh, 100dvh - 280px);
        }

        .lightbox-step {
            top: auto;
            bottom: var(--space-1);
            translate: none;
        }

        .lightbox-step :global(svg) {
            width: 32px;
            height: 32px;
        }
    }

    /* The download is a text control on the lightbox's dark surface in both
       themes: control-text's metrics with its dark-theme colours, and a
       compact 32px target. */
    .lightbox-download {
        display: inline-flex;
        align-items: center;
        gap: var(--space-1-5);
        min-height: 2rem;
        margin-top: var(--space-3);
        padding-inline: var(--space-2);
        border-radius: var(--radius-control);
        color: var(--color-cream-300);
        font-family: var(--font-ui);
        font-size: 0.75rem;
        letter-spacing: 0.01em;
        font-variant-numeric: lining-nums tabular-nums;
        text-decoration: none;
        transition:
            color var(--motion-base) var(--ease-standard),
            background-color var(--motion-base) var(--ease-standard);
    }

    .lightbox-download:hover,
    .lightbox-download:focus-visible {
        color: var(--color-cream-100);
        background-color: rgb(253 248 243 / 0.06);
    }

    .lightbox-download-meta {
        color: var(--color-cream-500);
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
