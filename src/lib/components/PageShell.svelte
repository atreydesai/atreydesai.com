<script lang="ts">
  import Seo from "$lib/components/Seo.svelte";

  // SEO props (forwarded verbatim to <Seo>).
  export let title: string;
  export let description: string;
  export let url: string;
  export let type: string = "website";

  // Standard page header. Provide `heading` for the common
  // <section><h1>…</h1></section> block, or use the "header" slot for a
  // custom header (e.g. a title with an action button alongside it).
  export let heading: string = "";
  export let headingClass: string = "mb-4";
</script>

<Seo {title} {description} {url} {type} />

<div class="layout-main py-8 md:py-12">
  {#if $$slots.header}
    <slot name="header" />
  {:else if heading}
    <section class="mb-6">
      <h1 class="heading-display text-3xl text-ink-900 dark:text-cream-100 {headingClass}">
        {heading}
      </h1>
    </section>
  {/if}

  <slot />
</div>
