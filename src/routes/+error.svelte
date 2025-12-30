<script lang="ts">
  import { page } from "$app/stores";
  import Seo from "$lib/components/Seo.svelte";
  import { House, ArrowLeft } from "@jis3r/icons";
</script>

<Seo
  title="Page Not Found | Atrey Desai"
  description="The page you're looking for doesn't exist."
/>

<div class="layout-main py-16 md:py-24 text-center">
  <div class="space-y-6">
    <h1
      class="heading-display text-6xl md:text-8xl text-ink-300 dark:text-ink-600"
    >
      404
    </h1>

    <h2 class="text-2xl font-medium text-ink-900 dark:text-cream-100">
      page not found
    </h2>

    <p class="text-ink-600 dark:text-cream-400 max-w-md mx-auto">
      The page you're looking for doesn't exist or has been moved ┻━┻︵ \(°□°)/
      ︵ ┻━┻
    </p>

    <div
      class="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
    >
      <a href="/" class="btn-primary inline-flex items-center gap-2">
        <House size={16} />
        Back to Home
      </a>

      <button
        type="button"
        on:click={() => history.back()}
        class="btn bg-cream-200 dark:bg-ink-700 text-ink-700 dark:text-cream-300 hover:bg-cream-300 dark:hover:bg-ink-600 inline-flex items-center gap-2"
      >
        <ArrowLeft size={16} />
        Go Back
      </button>
    </div>
  </div>

  <!-- Fun decorative element -->
  <div class="mt-16 text-ink-200 dark:text-ink-700 text-sm">
    <p>
      If you think this is an error, feel free to
      <a href="mailto:adesai10@umd.edu" class="link">reach out</a>.
    </p>
  </div>
</div>
