<script lang="ts">
  export let title = "Atrey Desai";
  export let description =
    "Third year undergraduate researcher interested in AI and machine learning.";
  export let image = "/og-image.jpg";
  export let url = "https://atreydesai.com";
  export let type = "website";
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content={type} />
  <meta property="og:url" content={url} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:image" content={image} />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content={url} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={image} />
  <meta name="twitter:site" content="@atreydesai" />
  <meta name="twitter:creator" content="@atreydesai" />

  <!-- Additional SEO -->
  <meta name="author" content="Atrey Desai" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href={url} />

  <!-- Structured Data for Google Scholar -->
  {@html `<script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": "Atrey Desai",
      "url": "${url}",
      "sameAs": [
        "https://github.com/atreydesai",
        "https://x.com/atreydesai",
        "https://scholar.google.com/citations?user=hTDzj6cAAAAJ&hl=en"
      ],
      "jobTitle": "Undergraduate Researcher",
      "email": "adesai10@umd.edu"
    }
  </script>`}
</svelte:head>
