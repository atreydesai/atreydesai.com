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
  import type { LayoutData } from "./$types";

  export let data: LayoutData;

  const isMobile = browser && /Android|iPhone/i.test(navigator.userAgent);
  const reducedMotion =
    browser && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let bobaDesktop = false;

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
      "%cI'm Atrey — applying to Ph.D. programs (2026–27). If you're a curious dev or a potential advisor, say hi: adesai10@umd.edu\n%cpsst… there's a hidden game. enter the konami code →  ↑ ↑ ↓ ↓ ← → ← → b a",
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

    // Google Analytics — production only, deferred to idle time.
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

  {#if isMobile || reducedMotion}
    <!-- Disable page transitions on mobile / reduced motion -->
    <main id="main-content" class="flex-1">
      <slot />
    </main>
  {:else}
    {#key data.pathname}
      <main
        id="main-content"
        class="flex-1"
        in:fly={{ x: -10, duration: 350, delay: 150 }}
        out:fly={{ y: 5, duration: 350 }}
      >
        <slot />
      </main>
    {/key}
  {/if}

  <Footer />
</div>

<!-- Konami easter egg: the persistent boba-catching minigame. -->
{#if $bobaMode && bobaDesktop}
  <BobaGame on:close={() => bobaMode.set(false)} />
{/if}

<style>
  /* CSS smooth scrolling - much simpler and more reliable */
  :global(html) {
    scroll-behavior: smooth;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(html) {
      scroll-behavior: auto;
    }
  }
</style>
