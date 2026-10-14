<script lang="ts">
  import {
    absoluteSiteUrl,
    canonicalUrl as toCanonicalUrl,
    SITE_URL,
  } from "$lib/seo";
  import {
    graph,
    pageStructuredData,
    personStructuredData,
    websiteStructuredData,
    withoutContext,
  } from "$lib/structured-data";

  export let title = "Atrey Desai";
  export let description =
    "CS & Linguistics undergraduate at the University of Maryland studying calibrated trust in language-model agents, LLM evaluation, and multimodal reasoning.";
  // Social cards use a 1.91:1 crop of the portrait; the square original is the
  // Person's own image in structured data.
  export let image = "/og-image-wide.jpg";
  export let imageAlt = "Atrey Desai smiling in front of a blurred city skyline at night";
  export let url = SITE_URL;
  export let type = "website";
  export let noindex = false;

  // Structured data. `pageType` is a schema.org WebPage subtype; `breadcrumbs`
  // defaults to Home > this page; `jsonLd` carries page-specific nodes
  // (an article, a paper list) that join the shared @graph.
  export let pageType = "WebPage";
  export let breadcrumbs: Array<{ name: string; url: string }> | undefined =
    undefined;
  export let jsonLd: object[] = [];
  export let about = false;

  // Article metadata (only emitted when type="article").
  export let published: string | undefined = undefined;
  export let modified: string | undefined = undefined;
  export let tags: string[] = [];

  $: canonicalUrl = toCanonicalUrl(url);
  $: imageUrl = absoluteSiteUrl(image);
  $: pageName = title.replace(/\s*\|\s*Atrey Desai$/, "");
  $: isHome = canonicalUrl === `${SITE_URL}/`;
  $: crumbs =
    breadcrumbs ??
    (isHome
      ? []
      : [
          { name: "Home", url: `${SITE_URL}/` },
          { name: pageName, url: canonicalUrl },
        ]);
  $: structuredDataJson = JSON.stringify(
    graph([
      withoutContext(
        personStructuredData({ imageUrl: absoluteSiteUrl("/og-image.jpg") }),
      ),
      websiteStructuredData(),
      // Pages kept out of the index (404, unlisted posts) describe nothing
      // worth citing, so they carry only the shared site identity.
      ...(noindex
        ? []
        : [
            ...pageStructuredData({
              url: canonicalUrl,
              name: pageName,
              description,
              imageUrl,
              pageType,
              breadcrumbs: crumbs,
              about,
            }),
            ...jsonLd,
          ]),
    ]),
  ).replace(/</g, "\\u003c");
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />

  <!-- Robots -->
  {#if noindex}
    <meta name="robots" content="noindex, nofollow" />
  {:else}
    <meta
      name="robots"
      content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    />
  {/if}

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content={type} />
  <meta property="og:url" content={canonicalUrl} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={imageUrl} />
  <meta property="og:image:alt" content={imageAlt} />
  {#if image === "/og-image-wide.jpg"}
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
  {/if}
  <meta property="og:site_name" content="Atrey Desai" />
  <meta property="og:locale" content="en_US" />
  {#if type === "article"}
    {#if published}
      <meta property="article:published_time" content={published} />
    {/if}
    <meta property="article:modified_time" content={modified ?? published} />
    <meta property="article:author" content={`${SITE_URL}/about/`} />
    {#each tags as tag}
      <meta property="article:tag" content={tag} />
    {/each}
  {/if}

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content={canonicalUrl} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={imageUrl} />
  <meta name="twitter:image:alt" content={imageAlt} />
  <meta name="twitter:site" content="@atreydesai" />
  <meta name="twitter:creator" content="@atreydesai" />

  <!-- Additional SEO -->
  <meta name="author" content="Atrey Desai" />
  <link rel="canonical" href={canonicalUrl} />
  <link rel="alternate" type="text/markdown" href={canonicalUrl} />
  <link rel="describedby" type="text/plain" href="/llms.txt" />

  <!-- Machine-readable identity shared by every page. -->
  {@html `<script type="application/ld+json">${structuredDataJson}</script>`}
</svelte:head>
