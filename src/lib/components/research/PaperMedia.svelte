<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { X } from "@jis3r/icons";

    export let paper: {
        title: string;
        image: string | null;
        imageAnimated: string | null;
        imageDescription: string | null;
    };

    export let isPreview = false;
    // Set by the parent card so hovering anywhere on the card plays the
    // explainer animation, not just hovering the thumbnail itself.
    export let active = false;

    let isHovered = false;
    let lightboxOpen = false;
    let imageOrientation: "landscape" | "portrait" = "landscape";
    let videoEl: HTMLVideoElement | null = null;
    let triggerElement: HTMLElement | null = null;
    let dialogElement: HTMLElement | null = null;

    function handleImageLoad(e: Event) {
        const img = e.currentTarget as HTMLImageElement;
        if (img.naturalWidth && img.naturalHeight) {
            imageOrientation =
                img.naturalWidth >= img.naturalHeight ? "landscape" : "portrait";
        }
    }

    // The explainer animation plays while the card (or the thumbnail) is
    // hovered/focused. Start it from the top each time so it reads as a
    // fresh loop.
    $: playing = active || isHovered;

    $: if (videoEl) {
        if (playing) {
            if (videoEl.paused) {
                videoEl.currentTime = 0;
                videoEl.play().catch(() => {});
            }
        } else {
            videoEl.pause();
        }
    }

    onMount(() => {
        return () => {
            if (typeof document !== "undefined") {
                document.body.style.overflow = "";
            }
        };
    });

    function openLightbox(trigger: HTMLElement) {
        if (!paper.image) return;

        lightboxOpen = true;
        triggerElement = trigger;

        if (typeof document !== "undefined") {
            document.body.style.overflow = "hidden";
        }

        setTimeout(() => dialogElement?.focus(), 0);
    }

    function closeLightbox() {
        lightboxOpen = false;

        if (typeof document !== "undefined") {
            document.body.style.overflow = "";
        }

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

    function portal(node: HTMLElement) {
        document.body.appendChild(node);

        return {
            destroy() {
                node.remove();
            },
        };
    }

    $: isVideo =
        paper.imageAnimated?.endsWith(".mp4") ||
        paper.imageAnimated?.endsWith(".webm");
</script>

<svelte:window on:keydown={(e) => e.key === "Escape" && closeLightbox()} />

{#if paper.image}
    <div
        class={`w-full md:flex-shrink-0 ${isPreview ? "md:w-36 md:-mt-2.5 md:-mb-2.5 md:-mr-2.5" : "md:w-36"}`}
    >
        <button
            type="button"
            on:click={(e) => openLightbox(e.currentTarget)}
            on:mouseenter={() => (isHovered = true)}
            on:mouseleave={() => (isHovered = false)}
            on:focus={() => (isHovered = true)}
            on:blur={() => (isHovered = false)}
            class={`relative block aspect-square w-full overflow-hidden rounded-lg border border-ink-200/80 bg-cream-100 transition-transform duration-300 hover:scale-[1.01] dark:border-ink-700 dark:bg-ink-900 ${isPreview ? "md:mt-1" : ""}`}
            aria-label={`Open image for ${paper.title}`}
        >
            <picture>
                <source
                    srcset={paper.image.replace(/\.(png|jpe?g)$/i, ".webp")}
                    type="image/webp"
                />
                <img
                    src={paper.image}
                    alt={`${paper.title} preview`}
                    width="800"
                    height="600"
                    on:load={handleImageLoad}
                    class="preview-shake absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
                    class:shake-x={playing &&
                        imageOrientation === "landscape"}
                    class:shake-y={playing &&
                        imageOrientation === "portrait"}
                    class:opacity-0={playing &&
                        Boolean(paper.imageAnimated)}
                    loading="lazy"
                    decoding="async"
                />
            </picture>

            {#if paper.imageAnimated}
                <!-- Plays only while the card is hovered/focused:
                     the static figure shows by default and the
                     animation fades in (starting from the top) on
                     hover, then pauses on leave. -->
                {#if isVideo}
                    <!-- svelte-ignore a11y-media-has-caption -->
                    <video
                        bind:this={videoEl}
                        src={paper.imageAnimated}
                        class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
                        class:opacity-0={!playing}
                        loop
                        muted
                        playsinline
                        preload="metadata"
                    ></video>
                {:else}
                    <img
                        src={paper.imageAnimated}
                        alt={`${paper.title} animated preview`}
                        class="absolute inset-0 h-full w-full object-cover transition-opacity duration-300"
                        class:opacity-0={!playing}
                        loading="lazy"
                    />
                {/if}
            {/if}
        </button>
    </div>
{/if}

{#if lightboxOpen && paper.image && browser}
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div class="lightbox-portal" use:portal>
        <div
            bind:this={dialogElement}
            class="fixed inset-0 z-[9999] flex items-center justify-center bg-ink-900/95 p-4"
            on:click={closeLightbox}
            on:keydown={(e) => { trapFocus(e); if (e.key === "Escape") closeLightbox(); }}
            role="dialog"
            aria-modal="true"
            aria-label="Image lightbox"
            tabindex="-1"
        >
            <button
                type="button"
                class="absolute right-4 top-4 z-10 text-cream-100 transition-colors hover:text-cream-300"
                on:click|stopPropagation={closeLightbox}
                aria-label="Close lightbox"
            >
                <X size={32} />
            </button>

            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div
                class="flex max-h-[80vh] max-w-3xl flex-col items-center"
                on:click|stopPropagation={() => {}}
                on:keydown|stopPropagation={() => {}}
            >
                {#if paper.imageAnimated && isVideo}
                    <!-- The explainer animation, full size: not the static
                         figure: so the lightbox shows the moving version. -->
                    <!-- svelte-ignore a11y-media-has-caption -->
                    <video
                        src={paper.imageAnimated}
                        class="max-h-[70vh] max-w-full rounded-lg object-contain"
                        autoplay
                        loop
                        muted
                        playsinline
                    ></video>
                {:else if paper.imageAnimated}
                    <img
                        src={paper.imageAnimated}
                        alt={`${paper.title} animated diagram`}
                        class="max-h-[70vh] max-w-full rounded-lg object-contain"
                    />
                {:else}
                    <img
                        src={paper.image}
                        alt={`${paper.title} diagram`}
                        class="max-h-[70vh] max-w-full rounded-lg object-contain"
                    />
                {/if}

                <div class="mt-4 max-w-xl text-center text-sm text-cream-300">
                    <p class="mb-1 font-medium text-cream-100">{paper.title}</p>
                    {#if paper.imageDescription}
                        <p>{paper.imageDescription}</p>
                    {/if}
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    /* Subtle pan of the preview within its fixed frame, only while hovered. The
       image overflows the square in its long dimension (object-cover), so panning
       object-position in that direction reveals hidden content without exposing
       the frame edges. Keyframes start/end at center so there's no jump on
       hover in/out. */
    .preview-shake.shake-x {
        animation: previewShakeX 2.4s ease-in-out infinite;
    }
    .preview-shake.shake-y {
        animation: previewShakeY 2.4s ease-in-out infinite;
    }
    @keyframes previewShakeX {
        0%, 100% { object-position: 50% center; }
        25%      { object-position: 35% center; }
        75%      { object-position: 65% center; }
    }
    @keyframes previewShakeY {
        0%, 100% { object-position: center 50%; }
        25%      { object-position: center 35%; }
        75%      { object-position: center 65%; }
    }
    @media (prefers-reduced-motion: reduce) {
        .preview-shake.shake-x,
        .preview-shake.shake-y {
            animation: none;
        }
    }
</style>
