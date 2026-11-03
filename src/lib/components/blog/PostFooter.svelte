<script lang="ts">
  import Mark from "$lib/components/Mark.svelte";
  import { homepageData } from "$lib/content";

  export let postId: string;

  const email = homepageData.social.email;
  const x = homepageData.social.twitter;
</script>

<!-- What follows the last paragraph: one quiet line asking the reader back.
     The older/newer links below move sideways through the archive. -->
<aside class="post-footer" aria-label="Follow along">
  <p class="type-meta follow-line">
    follow along on
    <a href="/rss.xml" class="link" data-track="post_follow" data-track-channel="rss" data-track-from={postId}>RSS</a>
    <Mark kind="dot" />
    <a href={x} target="_blank" rel="noopener noreferrer" class="link" data-track="post_follow" data-track-channel="x" data-track-from={postId}>X</a>
    <Mark kind="dot" />
    or write to me at
    <a href="mailto:{email}" class="link" data-track="post_follow" data-track-channel="email" data-track-from={postId}>{email}</a>
  </p>
</aside>

<style>
  .post-footer {
    margin-top: var(--space-12);
  }

  .follow-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-1) var(--space-1-5);
    color: theme("colors.ink.500");
  }

  :global(.dark) .follow-line {
    color: theme("colors.cream.400");
  }
</style>
