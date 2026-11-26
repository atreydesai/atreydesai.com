<script lang="ts" module>
  export interface RecipeMark {
    kind: string;
    label: string;
    count?: number;
    done?: boolean;
  }
</script>

<script lang="ts">
  import OrderKitchenItem from "./OrderKitchenItem.svelte";

  let { parts }: { parts: readonly RecipeMark[] } = $props();
</script>

<ul aria-label="Recipe ingredients">
  {#each parts as part (part.kind)}
    <li class:done={part.done} title={part.label}>
      <span class="sr-only">{part.label}{part.done ? ", ready" : ""}</span>
      <OrderKitchenItem kind={part.kind} size={23} />
      {#if part.count === 0}
        <span aria-hidden="true" class="zero"></span>
      {:else if part.count !== undefined}
        <span aria-hidden="true" class="dots">
          {#each { length: part.count } as _}<i></i>{/each}
        </span>
      {/if}
      {#if part.done}<i class="tick" aria-hidden="true"></i>{/if}
    </li>
  {/each}
</ul>

<style>
  ul { display: flex; flex-wrap: wrap; align-items: center; gap: 3px; margin: 2px 0 0; padding: 0; list-style: none; }
  li { position: relative; display: grid; min-width: 29px; min-height: 31px; place-content: start center; margin: 0; padding: 1px 2px 4px; background: #e8cda4; clip-path: var(--notch); }
  li.done { background: #d2d6ac; }
  .dots { position: absolute; display: flex; justify-content: center; gap: 2px; bottom: 4px; inset-inline: 3px; }
  .dots i, .zero { width: 3px; height: 3px; background: #785145; }
  .zero { position: absolute; inset: auto auto 4px calc(50% - 3px); width: 6px; height: 2px; }
  .tick { position: absolute; top: 1px; right: 1px; width: 9px; height: 9px; background: #46624b; clip-path: polygon(0 4px, 2px 4px, 2px 6px, 4px 6px, 4px 4px, 6px 4px, 6px 2px, 8px 2px, 8px 4px, 6px 4px, 6px 6px, 4px 6px, 4px 8px, 2px 8px, 2px 6px, 0 6px); }
</style>
