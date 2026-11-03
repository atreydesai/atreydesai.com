<script lang="ts">
  import { artPosition, cardFit } from "$lib/og-art";
  import type { PageData } from "./$types";

  export let data: PageData;

  $: post = data.post;
  $: art = `/images/og/art/${post.id}.jpg`;
  $: position = artPosition(post.id);
  $: fit = cardFit(post.id);
</script>

<svelte:head>
  <title>og: {post.title}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<!-- A share card is a fixed 1200×630 image, not reflowing text, so sizes here
     are px by design (the canvas-and-generated-art exception). The card sits
     over the site chrome rather than opting out of the root layout. -->
<div class="og og-plate">
  <img
    class="og-art"
    src={art}
    alt=""
    style:object-position={position}
    style:object-fit={fit ? "contain" : null}
    style:background-color={fit?.background ?? null}
  />
  <div class="og-caption">
    <div>
      <h1 class="og-title">{post.title}</h1>
      <p class="og-excerpt">{post.excerpt}</p>
    </div>
    <p class="og-meta og-by">atrey desai<br />atreydesai.com</p>
  </div>
</div>


<style>
  :global(.custom-cursor) {
    display: none !important;
  }

  .og {
    position: fixed;
    inset: 0 auto auto 0;
    width: 1200px;
    height: 630px;
    overflow: hidden;
    z-index: 60; /* layer-modal: above the header it covers */
    background-color: theme("colors.cream.100");
    background-image: radial-gradient(rgba(26, 26, 26, 0.03) 1px, transparent 1.2px);
    background-size: 5px 5px;
    color: theme("colors.ink.700");
  }

  .og-title {
    font-family: var(--font-display);
    font-weight: 600;
    color: theme("colors.ink.900");
    text-wrap: balance;
  }

  .og-excerpt {
    font-family: var(--font-prose);
    color: theme("colors.ink.700");
    text-wrap: pretty;
  }

  .og-meta {
    font-family: var(--font-ui);
    font-weight: 400;
    font-variant-numeric: lining-nums tabular-nums;
    color: theme("colors.ink.500");
  }

  /* Art above, a caption line below, like a figure in a paper. */
  .og-plate {
    display: flex;
    flex-direction: column;
    gap: 28px;
    padding: 48px 56px 44px;
  }

  .og-art {
    width: 100%;
    height: 390px;
    object-fit: cover;
    border-radius: 16px;
    /* A hairline edge, so pale art (prose diff) doesn't dissolve into the
       paper, as on the homepage thumbnails. */
    outline: 1.5px solid rgba(26, 26, 26, 0.08);
    outline-offset: -1.5px;
  }

  .og-caption {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 48px;
  }

  .og-plate .og-title {
    font-size: 64px;
    line-height: 1;
    letter-spacing: -0.02em;
  }

  .og-plate .og-excerpt {
    margin-top: 10px;
    font-size: 26px;
    line-height: 1.3;
    font-style: italic;
    color: theme("colors.ink.500");
  }

  .og-by {
    flex: none;
    font-size: 22px;
    line-height: 1.4;
    text-align: right;
    letter-spacing: 0.01em;
  }
</style>
