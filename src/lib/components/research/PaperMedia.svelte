<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { X } from "@jis3r/icons";
    import { explainers, type ExplainerComponent } from "$lib/explainers";
    import { focusedExplainer } from "$lib/explainers/focus";

    export let paper: {
        id: string;
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

    // A live explainer (an animated SVG scene) replaces the static image for
    // papers that have one. It plays by default and holds while its own
    // lightbox is open.
    let Explainer: ExplainerComponent | null = null;
    $: Explainer = explainers[paper.id] ?? null;

    // Pointing at or focusing a card plays its explainer and sends every other
    // card back to its first frame; letting go lets them all play again.
    const focusToken = Symbol(paper.id);
    $: if (Explainer && active) focusedExplainer.set(focusToken);
    $: if (!active && $focusedExplainer === focusToken) focusedExplainer.set(null);
    $: resting = $focusedExplainer !== null && $focusedExplainer !== focusToken;

    // Reduce Motion, read live: it can be flipped while the page is open.
    let reduceMotion = false;

    // Animated media is live by default; under Reduce Motion it plays only
    // while the card is hovered or focused.
    $: playing = !reduceMotion || active || isHovered;

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
        const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
        const release = () => {
            if ($focusedExplainer === focusToken) focusedExplainer.set(null);
        };
        const syncMotion = () => (reduceMotion = motion.matches);
        syncMotion();
        motion.addEventListener("change", syncMotion);

        return () => {
            release();
            motion.removeEventListener("change", syncMotion);
            if (typeof document !== "undefined") {
                document.body.style.overflow = "";
            }
        };
    });

    function openLightbox(trigger: HTMLElement) {
        if (!paper.image && !Explainer) return;

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

{#if paper.image || Explainer}
    <div
        class={`relative w-full md:flex-shrink-0 ${isPreview ? "md:w-40 md:-mt-2.5 md:-mb-2.5 md:-mr-2.5" : "md:w-40"}`}
    >
        <button
            type="button"
            on:click={(e) => openLightbox(e.currentTarget)}
            on:mouseenter={() => (isHovered = true)}
            on:mouseleave={() => (isHovered = false)}
            on:focus={() => (isHovered = true)}
            on:blur={() => (isHovered = false)}
            class={`relative block aspect-square w-full overflow-hidden rounded-lg border border-ink-200/80 transition-transform duration-300 hover:scale-[1.01] dark:border-ink-700 ${Explainer ? "bg-cream-50 dark:bg-ink-800" : "bg-cream-100 dark:bg-ink-900"} ${isPreview ? "md:mt-1" : ""}`}
            aria-label={Explainer
                ? `Open the animated explainer for ${paper.title}`
                : `Open image for ${paper.title}`}
        >
            {#if Explainer}
                <svelte:component
                    this={Explainer}
                    size="card"
                    label={paper.imageDescription ?? paper.title}
                    paused={lightboxOpen}
                    {resting}
                />
                <!-- While another card has the viewer's attention, this one
                     rests on its first frame, very faintly darkened. -->
                <span class="explainer-dim" class:explainer-dim-on={resting} aria-hidden="true"></span>
            {:else if paper.image}
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
            {/if}
        </button>
    </div>
{/if}

{#if lightboxOpen && (paper.image || Explainer) && browser}
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div class="lightbox-portal" use:portal>
        <div
            bind:this={dialogElement}
            class="layer-modal fixed inset-0 flex items-center justify-center bg-ink-900/95 p-4"
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
                on:keydown={() => {}}
            >
                {#if Explainer}
                    <!-- Sized to leave room for its controls within 80vh. -->
                    <div class="w-[min(560px,90vw,62vh)]">
                        <svelte:component
                            this={Explainer}
                            size="stage"
                            label={paper.imageDescription ?? paper.title}
                        />
                    </div>
                {:else if paper.imageAnimated && isVideo}
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
                {:else if paper.image}
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
    /* A resting card (another one has the viewer's attention) dims just barely,
       so the one playing reads as the focus. */
    .explainer-dim {
        position: absolute;
        inset: 0;
        pointer-events: none;
        background: rgb(26 26 26 / 0.04);
        opacity: 0;
        transition: opacity var(--motion-slow) var(--ease-standard);
    }
    :global(.dark) .explainer-dim {
        background: rgb(0 0 0 / 0.12);
    }
    .explainer-dim-on {
        opacity: 1;
    }

    @media (prefers-reduced-motion: reduce) {
        .preview-shake.shake-x,
        .preview-shake.shake-y {
            animation: none;
        }
    }
</style>
