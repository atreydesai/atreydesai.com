<script lang="ts">
  import Mark from "$lib/components/Mark.svelte";
  import { formatShortDate } from "$lib/utils/date";

  interface LatelyPost {
    id: string;
    title: string;
    date: string;
    href: string;
    externalSite: string | null;
    art: string | null;
    artPosition: string;
  }

  export let posts: LatelyPost[];
</script>

<!-- The newest posts, each led by its own art the way a research card is led
     by its media. -->
<section class="lately" aria-labelledby="lately-heading">
  <div class="section-rule mb-6">
    <h2 id="lately-heading" class="section-heading mb-0">
      <a href="/blog/" class="hover:text-accent dark:hover:text-accent-light transition-colors duration-200">lately</a>
    </h2>
    <div class="section-rule-line"></div>
  </div>

  <ul class="lately-thumbs">
    {#each posts as post (post.id)}
      <li>
        <a
          href={post.href}
          target={post.externalSite ? "_blank" : undefined}
          rel={post.externalSite ? "noopener noreferrer" : undefined}
          class="group lately-thumb no-underline"
          data-track="lately_click"
          data-track-post={post.id}
        >
          {#if post.art}
            <img
              class="lately-thumb-art"
              src={post.art}
              alt=""
              loading="lazy"
              style:object-position={post.artPosition}
            />
          {:else}
            <!-- No art: a quiet plate naming where the post lives. -->
            <span class="lately-thumb-art lately-thumb-plain" aria-hidden="true">
              <span class="section-heading mb-0">{post.externalSite ?? "notes"}</span>
            </span>
          {/if}
          <span class="type-item-heading lately-title">{post.title}{#if post.externalSite}<span class="sr-only">, on {post.externalSite}, opens in a new tab</span>{/if}</span>
          <span class="type-meta lately-meta">
            {#if post.externalSite}{post.externalSite}<Mark kind="dot" />{/if}<time datetime={post.date}>{formatShortDate(post.date)}</time>
          </span>
        </a>
      </li>
    {/each}
  </ul>
</section>

<style>
  .lately-title {
    color: theme("colors.ink.900");
    transition: color var(--motion-fast) var(--ease-standard);
  }

  :global(.dark) .lately-title {
    color: theme("colors.cream.100");
  }

  .group:hover .lately-title {
    color: theme("colors.accent.dark");
  }

  :global(.dark) .group:hover .lately-title {
    color: theme("colors.accent.light");
  }

  .lately-meta {
    display: inline-flex;
    align-items: baseline;
    gap: var(--space-1-5);
    color: theme("colors.ink.500");
    white-space: nowrap;
  }

  :global(.dark) .lately-meta {
    color: theme("colors.cream.400");
  }

  /* Phones: compact rows, the art a small plate beside the words. From sm:
     three columns, the art above. */
  .lately-thumbs {
    display: grid;
    gap: var(--space-4);
  }

  .lately-thumb {
    display: grid;
    grid-template-columns: 7rem minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    column-gap: var(--space-4);
    row-gap: var(--space-1);
  }

  .lately-thumb-art {
    display: block;
    grid-row: 1 / span 2;
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: var(--radius-media);
    background: theme("colors.cream.200");
    /* A hairline edge, so pale art doesn't dissolve into the paper. */
    outline: 1px solid rgba(26, 26, 26, 0.08);
    outline-offset: -1px;
  }

  :global(.dark) .lately-thumb-art {
    background: theme("colors.ink.800");
    outline-color: rgba(245, 230, 211, 0.08);
  }

  @media (min-width: 480px) {
    .lately-thumbs {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-6) var(--space-5);
    }

    .lately-thumb {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
    }

    .lately-thumb-art {
      margin-bottom: var(--space-2);
    }
  }

  .lately-thumb-plain {
    display: grid;
    place-items: center;
    padding: var(--space-2);
    text-align: center;
    color: theme("colors.ink.500");
  }

  :global(.dark) .lately-thumb-plain {
    color: theme("colors.cream.400");
  }

  /* Hover answers with the title's colour and a slight lift in the art's
     colour, never a lift in space. */
  img.lately-thumb-art {
    transition: filter var(--motion-base) var(--ease-standard);
  }

  .lately-thumb:hover img.lately-thumb-art {
    filter: saturate(1.08) brightness(0.98);
  }
</style>
