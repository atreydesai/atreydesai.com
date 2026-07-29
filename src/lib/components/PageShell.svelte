<script lang="ts">
  import Seo from "$lib/components/Seo.svelte";

  // SEO props (forwarded verbatim to <Seo>).
  export let title: string;
  export let description: string;
  export let url: string;
  export let type: string = "website";

  // Standard page geometry and header rhythm. Wide is reserved for visual
  // collections; standard is the editorial reading column.
  export let width: "standard" | "wide" = "standard";
  export let heading: string = "";
  export let headerVariant:
    | "title-only"
    | "deck"
    | "meta"
    | "action" = "title-only";

  $: widthClass =
    width === "wide" ? "page-shell-wide" : "page-shell-standard";
</script>

<Seo {title} {description} {url} {type} />

<div class="page-shell {widthClass}">
  {#if $$slots.header}
    <slot name="header" />
  {:else if heading}
    <header class="page-header page-header-{headerVariant}">
      <h1 class="type-page-title text-ink-900 dark:text-cream-100">
        {heading}
      </h1>
    </header>
  {/if}

  <slot />
</div>
