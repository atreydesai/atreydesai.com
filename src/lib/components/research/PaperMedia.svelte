<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from "$app/environment";
    import { X } from "@jis3r/icons";
    import { explainers, type ExplainerComponent } from "$lib/explainers";
    import { focusedExplainer } from "$lib/explainers/focus";
    import { trapFocus } from "$lib/focus-trap";
    import { lockScroll, unlockScroll } from "$lib/scroll-lock";

    export let paper: {
        id: string;
        title: string;
        imageDescription: string | null;
    };

    export let isPreview = false;
    // Set by the parent card: pointing at or focusing anywhere on the card
    // gives its explainer the viewer's attention, not just the thumbnail.
    export let active = false;

    let lightboxOpen = false;
    let triggerElement: HTMLElement | null = null;
    let dialogElement: HTMLElement | null = null;

    // The paper's live explainer (an animated SVG scene). It plays by default
    // and holds while its own lightbox is open.
    let Explainer: ExplainerComponent | null = null;
    $: Explainer = explainers[paper.id] ?? null;

    // Pointing at or focusing a card plays its explainer and sends every other
    // card back to its first frame; letting go lets them all play again.
    const focusToken = Symbol(paper.id);
    $: if (Explainer && active) focusedExplainer.set(focusToken);
    $: if (!active && $focusedExplainer === focusToken) focusedExplainer.set(null);
    $: resting = $focusedExplainer !== null && $focusedExplainer !== focusToken;

    // If the card goes away while holding the viewer's attention or the page
    // scroll lock, hand both back.
    onMount(() => () => {
        if ($focusedExplainer === focusToken) focusedExplainer.set(null);
        if (lightboxOpen) unlockScroll();
    });

    function openLightbox(trigger: HTMLElement) {
        lightboxOpen = true;
        triggerElement = trigger;
        lockScroll();
        setTimeout(() => dialogElement?.focus(), 0);
    }

    function closeLightbox() {
        lightboxOpen = false;
        unlockScroll();
        triggerElement?.focus();
        triggerElement = null;
    }

    function portal(node: HTMLElement) {
        document.body.appendChild(node);

        return {
            destroy() {
                node.remove();
            },
        };
    }
</script>

<svelte:window on:keydown={(e) => lightboxOpen && e.key === "Escape" && closeLightbox()} />

{#if Explainer}
    <div
        class={`relative w-full md:flex-shrink-0 ${isPreview ? "md:w-40 md:-mt-2.5 md:-mb-2.5 md:-mr-2.5" : "md:w-40"}`}
    >
        <button
            type="button"
            on:click={(e) => openLightbox(e.currentTarget)}
            class={`relative block aspect-square w-full overflow-hidden rounded-lg border border-ink-200/80 bg-cream-50 transition-transform duration-300 hover:scale-[1.01] dark:border-ink-700 dark:bg-ink-800 ${isPreview ? "md:mt-1" : ""}`}
            aria-label={`Open the animated explainer for ${paper.title}`}
        >
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
        </button>
    </div>
{/if}

{#if lightboxOpen && Explainer && browser}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="lightbox-portal" use:portal>
        <div
            bind:this={dialogElement}
            class="layer-modal fixed inset-0 flex items-center justify-center bg-ink-900/95 p-4"
            on:click={closeLightbox}
            on:keydown={(e) => { trapFocus(e, dialogElement); if (e.key === "Escape") closeLightbox(); }}
            role="dialog"
            aria-modal="true"
            aria-label="Explainer lightbox"
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

            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="flex max-h-[80vh] max-w-3xl flex-col items-center"
                on:click|stopPropagation={() => {}}
                on:keydown={() => {}}
            >
                <!-- Sized to leave room for its controls within 80vh. -->
                <div class="w-[min(560px,90vw,62vh)]">
                    <svelte:component
                        this={Explainer}
                        size="stage"
                        label={paper.imageDescription ?? paper.title}
                    />
                </div>

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
</style>
