<script lang="ts">
  import {
    absoluteSiteUrl,
    canonicalUrl as toCanonicalUrl,
    SITE_URL,
  } from "$lib/seo";

  export let title = "Atrey Desai";
  export let description =
    "Atrey Desai - undergraduate researcher at University of Maryland studying NLP, AI safety, and computational linguistics. Research on benchmark evaluation, multimodal reasoning, and animal vocalizations.";
  export let image = "/og-image.jpg";
  export let url = SITE_URL;
  export let type = "website";
  export let keywords =
    "Atrey Desai, NLP, natural language processing, AI safety, computational linguistics, University of Maryland, machine learning, research";
  export let noindex = false;

  $: canonicalUrl = toCanonicalUrl(url);
  $: imageUrl = absoluteSiteUrl(image);
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <meta name="keywords" content={keywords} />

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
  <meta property="og:site_name" content="Atrey Desai" />
  <meta property="og:locale" content="en_US" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content={canonicalUrl} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={imageUrl} />
  <meta name="twitter:site" content="@atreydesai" />
  <meta name="twitter:creator" content="@atreydesai" />

  <!-- Additional SEO -->
  <meta name="author" content="Atrey Desai" />
  <link rel="canonical" href={canonicalUrl} />

  <!-- Structured Data for Google -->
  {@html `<script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "Atrey Desai",
      "givenName": "Atrey",
      "familyName": "Desai",
      "url": "${canonicalUrl}",
      "image": "${imageUrl}",
      "sameAs": [
        "https://github.com/atreydesai",
        "https://x.com/atreydesai",
        "https://scholar.google.com/citations?user=hTDzj6cAAAAJ&hl=en",
        "https://instagram.com/framedbyatrey"
      ],
      "jobTitle": "Undergraduate Researcher",
      "email": "adesai10@umd.edu",
      "affiliation": [
        {
          "@type": "Organization",
          "name": "University of Maryland",
          "url": "https://umd.edu"
        },
        {
          "@type": "Organization",
          "name": "CLIP Lab",
          "url": "https://clip.umd.edu"
        },
        {
          "@type": "Organization",
          "name": "Learn Prompting",
          "url": "https://learnprompting.org"
        }
      ],
      "alumniOf": {
        "@type": "CollegeOrUniversity",
        "name": "University of Maryland",
        "url": "https://umd.edu"
      },
      "knowsAbout": [
        "Natural Language Processing",
        "AI Safety",
        "Computational Linguistics",
        "Machine Learning",
        "Benchmark Evaluation",
        "Multimodal Reasoning"
      ]
    }
  </script>`}
</svelte:head>
