<script lang="ts">
  import "../app.css";

  import { browser, dev } from "$app/environment";
  import { onMount } from "svelte";

  import { inject } from "@vercel/analytics";
  import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit";
  inject({ mode: dev ? "development" : "production" });
  injectSpeedInsights();

  import { fly } from "svelte/transition";

  import Header from "$lib/components/Header.svelte";
  import Footer from "$lib/components/Footer.svelte";
  import CustomCursor from "$lib/components/CustomCursor.svelte";
  import type { LayoutData } from "./$types";

  export let data: LayoutData;

  const isMobile = browser && /Android|iPhone/i.test(navigator.userAgent);
  const reducedMotion =
    browser && matchMedia("(prefers-reduced-motion: reduce)").matches;

  onMount(() => {
    if (dev) return;
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
  });
</script>

<!-- Custom Cursor (desktop only) -->
<CustomCursor />

<div class="min-h-screen flex flex-col cursor-custom">
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
        in:fly={{ x: -10, duration: 350, delay: 350 }}
        out:fly={{ y: 5, duration: 350 }}
      >
        <slot />
      </main>
    {/key}
  {/if}

  <Footer />
</div>

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
