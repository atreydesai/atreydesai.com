<script lang="ts">
  // An ingredient as the kitchen draws it: the first campaign's icon where it
  // has one, otherwise the expansion's drawing of the same kind of thing.
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import { ingredientSprite, kitchenKind } from "#lib/arcade/order-up/art/icons.ts";
  import OrderKitchenItem from "../OrderKitchenItem.svelte";

  let { id, size = 24, lit = false }: { id: string; size?: number; lit?: boolean } = $props();

  const kind = $derived(kitchenKind(id));
  const sprite = $derived(kind ? null : ingredientSprite(id));
</script>

{#if kind}
  <OrderKitchenItem {kind} {size} {lit} />
{:else if sprite}
  <span class="ingredient" style:width={size + "px"} style:height={size + "px"}>
    <PixelIcon grid={[...sprite.grid]} palette={sprite.palette} px={1} />
  </span>
{/if}

<style>
  .ingredient {
    display: inline-grid;
    flex: none;
    place-items: center;
    vertical-align: middle;
  }

  .ingredient :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
