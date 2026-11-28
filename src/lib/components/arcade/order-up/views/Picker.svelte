<script lang="ts">
  // A choice made with pixel keys instead of a native select. A few options
  // are a row of keys (the chosen one pressed); a long list is a stepper:
  // previous, the current item with its icon and name, next. The arrow keys
  // step it while either arrow key has focus, and keep the game from steering.
  import Ingredient from "../Ingredient.svelte";

  export let items: { id: string; name: string; icon?: string; swatch?: string; note?: string }[];
  export let value: string;
  /** What is being chosen, for screen readers: "Seed", "Route". */
  export let label: string;
  /** Lists longer than this become a stepper. */
  export let keys = 3;
  export let disabled = false;
  /** Fixed width of the stepper's middle, so names of any length don't shift the keys beside it. */
  export let width = "11rem";
  /** What the stepper shows when there is nothing to choose. */
  export let empty = "None";

  $: if (items.length && !items.some((i) => i.id === value)) value = items[0].id;
  $: index = Math.max(0, items.findIndex((i) => i.id === value));
  $: current = items[index];

  function step(by: number) {
    if (!items.length || disabled) return;
    value = items[(index + by + items.length) % items.length].id;
  }

  function onKey(event: KeyboardEvent) {
    const moves: Record<string, () => void> = {
      ArrowLeft: () => step(-1),
      ArrowRight: () => step(1),
      ArrowUp: () => step(-1),
      ArrowDown: () => step(1),
      Home: () => (value = items[0]?.id ?? value),
      End: () => (value = items[items.length - 1]?.id ?? value),
    };
    const move = moves[event.key];
    if (!move || disabled) return;
    event.preventDefault();
    event.stopPropagation();
    move();
  }
</script>

{#if items.length && items.length <= keys}
  <div class="picker-row" role="group" aria-label={label}>
    {#each items as item (item.id)}
      <button type="button" class="boba-key pick" class:is-down={item.id === value} aria-pressed={item.id === value} {disabled} onclick={() => (value = item.id)}>
        {#if item.icon}<Ingredient id={item.icon} size={18} />{:else if item.swatch}<i class="swatch" style:background={item.swatch}></i>{/if}
        <span>{item.name}</span>
      </button>
    {/each}
  </div>
{:else}
  <div class="stepper" role="group" aria-label={label}>
    <button type="button" class="boba-key arrow" aria-label={"Previous " + label.toLowerCase()} aria-keyshortcuts="ArrowLeft" disabled={disabled || items.length < 2} onclick={() => step(-1)} onkeydown={onKey}>‹</button>
    <span class="current" style:width aria-live="polite">
      {#if current?.icon}<Ingredient id={current.icon} size={18} />{:else if current?.swatch}<i class="swatch" style:background={current.swatch}></i>{/if}
      <span class="name" class:is-empty={!current}>{current?.name ?? empty}</span>
      {#if current?.note}<span class="note">{current.note}</span>{/if}
    </span>
    <button type="button" class="boba-key arrow" aria-label={"Next " + label.toLowerCase()} aria-keyshortcuts="ArrowRight" disabled={disabled || items.length < 2} onclick={() => step(1)} onkeydown={onKey}>›</button>
  </div>
{/if}

<style>
  .picker-row,
  .stepper {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 4px;
  }

  .pick {
    gap: 6px;
    min-height: 44px;
    padding-inline: 10px;
    font-size: 0.8125rem;
    white-space: nowrap;
  }

  .arrow {
    width: 36px;
    min-height: 44px;
    padding-inline: 0;
    font-size: 1.375rem;
    font-weight: 600;
    line-height: 1;
  }

  .current {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 10px;
    overflow: hidden;
    background: #2a2224;
    box-shadow: inset 0 0 0 2px #4d3a36;
    color: #fff0d6;
    font-size: 0.8125rem;
    white-space: nowrap;
    clip-path: var(--notch);
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .is-empty {
    color: #b99a80;
  }

  .note {
    margin-left: auto;
    color: #c9ad92;
    font-variant-numeric: tabular-nums;
  }

  .swatch {
    flex: none;
    width: 12px;
    height: 12px;
    box-shadow: inset 0 0 0 2px rgb(0 0 0 / 0.35);
  }
</style>
