<script lang="ts">
  import { GUESTBOOK_STAMP_GOAL, guestbookStamps } from "#lib/arcade/orders-guestbook.ts";

  let { count }: { count: number } = $props();
  const stamps = Array.from({ length: GUESTBOOK_STAMP_GOAL }, (_, index) => index);
  const filled = $derived(guestbookStamps(count));
</script>

<span class="stamps" role="img" aria-label={`${filled} of ${GUESTBOOK_STAMP_GOAL} stamps`}>
  {#each stamps as index (index)}
    <span class="stamp" class:filled={index < filled} aria-hidden="true"></span>
  {/each}
</span>

<style>
  .stamps {
    display: inline-flex;
    align-items: center;
    gap: .26rem;
    vertical-align: middle;
  }

  .stamp {
    display: block;
    width: .52rem;
    height: .52rem;
    border: 1px solid #916e57;
    background: #f8e8c7;
    border-radius: 50%;
  }

  .filled {
    background: #925b48;
    border-color: #744637;
    box-shadow: inset 1px 1px #c88c6a;
  }
</style>
