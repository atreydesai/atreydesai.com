<script lang="ts">
  import "../app.css";

  import { browser, dev } from "$app/environment";
  import { onMount } from "svelte";

  import { inject } from "@vercel/analytics";
  import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit";

  import { fly } from "svelte/transition";

  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import CustomCursor from "$lib/components/CustomCursor.svelte";
  import BobaGame from "$lib/components/BobaGame.svelte";
  import {
    BOBA_DESKTOP_QUERY,
    bobaMode,
    openBoba,
  } from "$lib/boba";
  import {
    PAGE_TRANSITIONS_ENABLED,
    PAGE_TRANSITION_DURATION_MS,
    PAGE_TRANSITION_IN_DELAY_MS,
    PAGE_TRANSITION_IN_X,
    PAGE_TRANSITION_OUT_Y,
  } from "$lib/motion";
  import type { LayoutData } from "./$types";

  export let data: LayoutData;

  // Both of these were previously evaluated once at module scope: the touch
  // test by sniffing the UA string (which reads iPad and touch laptops as
  // desktop), and Reduce Motion by reading matchMedia a single time (so
  // toggling it mid-session did nothing until reload). Now both track live.
  const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";
  const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

  let isTouch = browser && matchMedia(TOUCH_QUERY).matches;
  let reducedMotion = browser && matchMedia(REDUCED_MOTION_QUERY).matches;
  let bobaDesktop = false;

  // Transitions are a desktop-pointer nicety; on touch they compete with the
  // platform's own back-swipe animation.
  $: animatePages = PAGE_TRANSITIONS_ENABLED && !isTouch && !reducedMotion;

  // Konami easter egg: launches the persistent "boba mode" minigame.
  // (`bobaMode` lives in $lib/boba so the homepage boba can launch it too.)

  onMount(() => {
    const bobaMedia = window.matchMedia(BOBA_DESKTOP_QUERY);
    const syncBobaDesktop = () => {
      bobaDesktop = bobaMedia.matches;
      if (!bobaDesktop) bobaMode.set(false);
    };
    syncBobaDesktop();
    bobaMedia.addEventListener("change", syncBobaDesktop);

    // Input mode and Reduce Motion can both change while the page is open —
    // a trackpad gets attached, or the setting is flipped in System Settings.
    const touchMedia = window.matchMedia(TOUCH_QUERY);
    const motionMedia = window.matchMedia(REDUCED_MOTION_QUERY);
    const syncTouch = () => (isTouch = touchMedia.matches);
    const syncMotion = () => (reducedMotion = motionMedia.matches);
    syncTouch();
    syncMotion();
    touchMedia.addEventListener("change", syncTouch);
    motionMedia.addEventListener("change", syncMotion);

    // Vercel Analytics + Speed Insights use buffered PerformanceObservers,
    // so deferring their injection still captures paint/LCP events that
    // occurred earlier in the page lifecycle.
    inject({ mode: dev ? "development" : "production" });
    injectSpeedInsights();

    // Easter egg #1: a greeting for anyone who cracks open the console.
    console.log(
      "%c👋 hey, you found the console.",
      "color:#E85D4C;font-size:14px;font-weight:700",
    );
    console.log(
      "%cHmm why are you poking around here. You should say hi: adesai10@umd.edu\n%cpsst… there's a hidden game. enter the konami code →  ↑ ↑ ↓ ↓ ← → ← → b a",
      "color:#8a7d70;font-size:12px;line-height:1.6",
      "color:#b0a498;font-size:11px;font-style:italic",
    );

    // Easter egg #2: the konami code launches boba mode.
    const KONAMI = [
      "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
      "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a",
    ];
    let pos = 0;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === KONAMI[pos]) {
        pos += 1;
        if (pos === KONAMI.length) {
          pos = 0;
          openBoba();
        }
      } else {
        // Restart, but treat this key as a possible first step.
        pos = key === KONAMI[0] ? 1 : 0;
      }
    };
    window.addEventListener("keydown", onKey);

    // Google Analytics: production only, deferred to idle time.
    if (!dev) {
      const loadGa = () => {
        const w = window as any;
        w.dataLayer = w.dataLayer || [];
        function gtag(...args: any[]) { w.dataLayer.push(args); }
        gtag("js", new Date());
        gtag("config", "G-4NTR1HXBLW");
        const s = document.createElement("script");
        s.async = true;
        s.src = "https://www.googletagmanager.com/gtag/js?id=G-4NTR1HXBLW";
        document.head.appendChild(s);
      };
      if ("requestIdleCallback" in window) {
        (window as any).requestIdleCallback(loadGa, { timeout: 3000 });
      } else {
        setTimeout(loadGa, 1500);
      }
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      bobaMedia.removeEventListener("change", syncBobaDesktop);
      touchMedia.removeEventListener("change", syncTouch);
      motionMedia.removeEventListener("change", syncMotion);
    };
  });
</script>

<!-- Custom Cursor (desktop only) -->
<CustomCursor />

<div
  class="min-h-screen flex flex-col cursor-custom"
  inert={$bobaMode && bobaDesktop}
  aria-hidden={$bobaMode && bobaDesktop ? "true" : undefined}
>
  <a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] btn-primary focus:cursor-auto"
  >
    Skip to content
  </a>

  <Header />

  <!-- One stable <main> landmark holds the skip-link target; only the layer
       inside it is keyed on the route. The two layers overlap in a single
       grid cell while the transition runs, so the outgoing page can't stack
       below the incoming one and double the page height mid-navigation. -->
  <main id="main-content" class="page-stack flex-1">
    {#if animatePages}
      {#key data.pathname}
        <div
          class="page-layer"
          in:fly={{
            x: PAGE_TRANSITION_IN_X,
            duration: PAGE_TRANSITION_DURATION_MS,
            delay: PAGE_TRANSITION_IN_DELAY_MS,
          }}
          out:fly={{
            y: PAGE_TRANSITION_OUT_Y,
            duration: PAGE_TRANSITION_DURATION_MS,
          }}
        >
          <slot />
        </div>
      {/key}
    {:else}
      <div class="page-layer">
        <slot />
      </div>
    {/if}
  </main>

  <Footer />
</div>

<!-- Konami easter egg: the persistent boba-catching minigame. -->
{#if $bobaMode && bobaDesktop}
  <BobaGame on:close={() => bobaMode.set(false)} />
{/if}

<style>
  /* Single-cell grid: during a route change both the outgoing and incoming
     layers occupy the same cell rather than stacking in flow. */
  .page-stack {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .page-layer {
    grid-area: 1 / 1;
    /* Let wide children (the bookshelf table) size their own scroll container
       instead of forcing the grid track open. */
    min-width: 0;
  }
</style>
