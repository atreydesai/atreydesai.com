<script lang="ts">
  import "../app.css";

  import { browser } from "$app/environment";

  import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit";
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
</script>

<svelte:head>
  <!-- Preconnect to external resources for performance -->
  <link rel="preconnect" href="https://use.typekit.net" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link
    rel="preconnect"
    href="https://fonts.gstatic.com"
    crossorigin="anonymous"
  />
</svelte:head>

<!-- Custom Cursor (desktop only) -->
<CustomCursor />

<div class="min-h-screen flex flex-col cursor-custom">
  <Header />

  {#if isMobile || reducedMotion}
    <!-- Disable page transitions on mobile / reduced motion -->
    <main class="flex-1">
      <slot />
    </main>
  {:else}
    {#key data.pathname}
      <main
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
