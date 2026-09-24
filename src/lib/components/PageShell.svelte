<script lang="ts">
  import Seo from "$lib/components/Seo.svelte";

  // SEO props (forwarded verbatim to <Seo>).
  export let title: string;
  export let description: string;
  export let url: string;
  export let type: string = "website";

  // Standard page geometry and header rhythm. Wide is reserved for visual
  // collections; standard is the editorial reading column. The header itself
  // always sits in the standard column (see `.page-shell-wide > .page-header`).
  export let width: "standard" | "wide" = "standard";
  export let heading: string = "";
  // Spacing below the header. Left unset, it follows from what the header
  // holds: a deck or an aside needs the roomier gap.
  export let headerVariant:
    | "title-only"
    | "deck"
    | "meta"
    | "action"
    | undefined = undefined;

  $: widthClass =
    width === "wide" ? "page-shell-wide" : "page-shell-standard";

  $: variant =
    headerVariant ??
    ($$slots.deck ? "deck" : $$slots.aside ? "action" : "title-only");
</script>

<Seo {title} {description} {url} {type} />

<div class="page-shell {widthClass}">
  {#if $$slots.header}
    <slot name="header" />
  {:else if heading}
    <header class="page-header page-header-{variant}">
      <div class="page-header-row">
        <h1 class="type-page-title text-ink-900 dark:text-cream-100">
          {heading}
        </h1>
        {#if $$slots.aside}
          <div class="page-header-aside">
            <slot name="aside" />
          </div>
        {/if}
      </div>
      {#if $$slots.deck}
        <p class="page-deck type-deck text-ink-600 dark:text-cream-400">
          <slot name="deck" />
        </p>
      {/if}
    </header>
  {/if}

  <slot />
</div>
