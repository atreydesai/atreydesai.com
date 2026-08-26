<script lang="ts">
  import { page } from "$app/stores";
  import Seo from "$lib/components/Seo.svelte";
  import { House, ArrowLeft } from "@jis3r/icons";

  let hoveredHome = false;
  let hoveredBack = false;
</script>

<Seo
  title="Page Not Found | Atrey Desai"
  description="The page you're looking for doesn't exist."
  url={$page.url.href}
  noindex={true}
/>

<div class="page-shell page-shell-standard py-16 text-center md:py-24">
  <div class="space-y-6">
    <h1 class="type-hero-title text-ink-300 dark:text-ink-400">
      404
    </h1>

    <h2 class="section-heading">page not found</h2>

    <p class="text-ink-600 dark:text-cream-400 max-w-md mx-auto">
      The page you're looking for doesn't exist or has been moved ┻━┻︵ \(°□°)/
      ︵ ┻━┻
    </p>

    <p class="text-sm text-ink-500 dark:text-cream-400 max-w-lg mx-auto">
      Looking for something specific? Try the
      <a href="/sitemap.xml" class="link">site map</a>,
      <a href="/llms.txt" class="link">agent guide</a>, or one of the main sections below.
    </p>

    <div
      class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
    >
      <a
        href="/"
        class="btn-primary inline-flex items-center gap-2"
        on:mouseenter={() => (hoveredHome = true)}
        on:mouseleave={() => (hoveredHome = false)}
      >
        <House size={16} animate={hoveredHome} />
        Back to Home
      </a>

      <button
        type="button"
        on:click={() => history.back()}
        class="btn bg-cream-200 dark:bg-ink-700 text-ink-700 dark:text-cream-300 hover:bg-cream-300 dark:hover:bg-ink-600 inline-flex items-center gap-2"
        on:mouseenter={() => (hoveredBack = true)}
        on:mouseleave={() => (hoveredBack = false)}
      >
        <ArrowLeft size={16} animate={hoveredBack} />
        Go Back
      </button>
    </div>

    <nav aria-label="Main sections" class="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
      <a href="/about/" class="link">About</a>
      <a href="/research/" class="link">Research</a>
      <a href="/blog/" class="link">Blog</a>
      <a href="/cv/" class="link">CV</a>
    </nav>
  </div>

  <!-- Fun decorative element -->
  <div class="mt-16 text-ink-200 dark:text-cream-500 text-sm">
    <p>
      If you think this is an error, feel free to
      <a href="mailto:adesai10@umd.edu" class="link">reach out</a>.
    </p>
  </div>
</div>
