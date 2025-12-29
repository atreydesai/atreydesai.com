<script lang="ts">
    import Seo from "$lib/components/Seo.svelte";
    import { X, ChevronLeft, ChevronRight } from "@jis3r/icons";
    import { Instagram } from "lucide-svelte";
    import { onMount } from "svelte";

    // Placeholder photos - replace with actual photos
    const photos = [
        {
            id: 1,
            src: "/images/photography/placeholder-1.jpg",
            alt: "Landscape photo 1",
            orientation: "landscape",
            exif: {
                camera: "Canon EOS R5",
                lens: "RF 24-70mm f/2.8",
                aperture: "f/2.8",
                shutter: "1/250s",
                iso: "ISO 100",
                date: "2024-06-15",
            },
        },
        {
            id: 2,
            src: "/images/photography/placeholder-2.jpg",
            alt: "Portrait photo 1",
            orientation: "portrait",
            exif: {
                camera: "Canon EOS R5",
                lens: "RF 85mm f/1.2",
                aperture: "f/1.4",
                shutter: "1/500s",
                iso: "ISO 200",
                date: "2024-07-20",
            },
        },
        {
            id: 3,
            src: "/images/photography/placeholder-3.jpg",
            alt: "Landscape photo 2",
            orientation: "landscape",
            exif: {
                camera: "Canon EOS R5",
                lens: "RF 70-200mm f/2.8",
                aperture: "f/4",
                shutter: "1/1000s",
                iso: "ISO 400",
                date: "2024-08-10",
            },
        },
        {
            id: 4,
            src: "/images/photography/placeholder-4.jpg",
            alt: "Portrait photo 2",
            orientation: "portrait",
            exif: {
                camera: "Canon EOS R5",
                lens: "RF 50mm f/1.2",
                aperture: "f/1.8",
                shutter: "1/320s",
                iso: "ISO 160",
                date: "2024-09-05",
            },
        },
        {
            id: 5,
            src: "/images/photography/placeholder-5.jpg",
            alt: "Landscape photo 3",
            orientation: "landscape",
            exif: {
                camera: "Canon EOS R5",
                lens: "RF 15-35mm f/2.8",
                aperture: "f/8",
                shutter: "1/125s",
                iso: "ISO 100",
                date: "2024-10-01",
            },
        },
        {
            id: 6,
            src: "/images/photography/placeholder-6.jpg",
            alt: "Portrait photo 3",
            orientation: "portrait",
            exif: {
                camera: "Canon EOS R5",
                lens: "RF 85mm f/1.2",
                aperture: "f/2",
                shutter: "1/640s",
                iso: "ISO 100",
                date: "2024-11-12",
            },
        },
    ];

    // Lightbox state
    let lightboxOpen = false;
    let currentPhotoIndex = 0;

    function openLightbox(index: number) {
        currentPhotoIndex = index;
        lightboxOpen = true;
        // Prevent body scroll
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
        currentPhotoIndex = (currentPhotoIndex + 1) % photos.length;
    }

    function prevPhoto() {
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
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Capturing
        moments through the lens. [ADD YOUR PHOTOGRAPHY PHILOSOPHY OR
        DESCRIPTION]
    </p>

    <!-- Masonry Grid (2 columns like Jessy Lin's) -->
    <div class="columns-1 sm:columns-2 gap-4 space-y-4 stagger-children">
        {#each photos as photo, index}
            <button
                type="button"
                class="w-full break-inside-avoid mb-4 overflow-hidden rounded-lg group cursor-pointer bg-cream-200 dark:bg-ink-800"
                on:click={() => openLightbox(index)}
            >
                <!-- Placeholder div since we don't have actual images -->
                <div
                    class="w-full flex items-center justify-center text-ink-400 dark:text-ink-500 transition-transform duration-300 group-hover:scale-105"
                    class:aspect-video={photo.orientation === "landscape"}
                    class:aspect-portrait={photo.orientation === "portrait"}
                >
                    <span class="text-sm p-4 text-center">
                        [{photo.orientation} placeholder]<br />
                        {photo.exif.camera}
                    </span>
                </div>
            </button>
        {/each}
    </div>
</div>

<!-- Lightbox -->
{#if lightboxOpen}
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

        <!-- Photo container -->
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
            class="max-w-4xl max-h-[80vh] flex flex-col items-center"
            on:click|stopPropagation={() => {}}
            aria-hidden="true"
        >
            <!-- Placeholder for actual image -->
            <div
                class="bg-cream-200 dark:bg-ink-700 rounded-lg flex items-center justify-center"
                style="width: 600px; height: {currentPhoto.orientation ===
                'portrait'
                    ? '800px'
                    : '400px'}; max-height: 70vh; max-width: 90vw;"
            >
                <span class="text-ink-500 dark:text-ink-400 text-center p-8">
                    [{currentPhoto.orientation} photo placeholder]<br />
                    {currentPhoto.alt}
                </span>
            </div>

            <!-- EXIF data -->
            <div class="mt-4 text-cream-300 text-sm text-center space-y-1">
                <p class="font-medium text-cream-100">{currentPhoto.alt}</p>
                <p>
                    {currentPhoto.exif.camera} · {currentPhoto.exif.lens}
                </p>
                <p class="text-cream-400">
                    {currentPhoto.exif.aperture} · {currentPhoto.exif.shutter} ·
                    {currentPhoto.exif.iso}
                </p>
                <p class="text-cream-500">
                    {new Date(currentPhoto.exif.date).toLocaleDateString(
                        "en-US",
                        {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                        },
                    )}
                </p>
            </div>
        </div>

        <!-- Photo counter -->
        <div
            class="absolute bottom-4 left-1/2 -translate-x-1/2 text-cream-400 text-sm"
        >
            {currentPhotoIndex + 1} / {photos.length}
        </div>
    </div>
{/if}

<style>
    .aspect-portrait {
        aspect-ratio: 2/3;
    }
</style>
