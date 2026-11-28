<script lang="ts">
  // A catalogue entry's picture: its ingredient, tool or skill where one is
  // drawn, else the kind's own pixel sign in the entry's colour.
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import { iconSprite } from "#lib/arcade/order-up/art/sprites.ts";
  import { powerKitchenKind, powerSprite, skillKitchenKind, skillSprite } from "#lib/arcade/order-up/art/icons.ts";
  import type { ArtRef } from "#lib/arcade/order-up/content/schema.ts";
  import OrderKitchenItem from "../OrderKitchenItem.svelte";
  import Ingredient from "./Ingredient.svelte";

  let { art = { kind: "cup", color: "#b88c6e", seed: 1, motif: "cup" }, size = 32 }: { art?: ArtRef; size?: number } =
    $props();

  const ingredient = $derived(["tea", "milk", "fruit", "topping", "syrup", "side"].includes(art.kind) ? art.motif : null);
  const kitchen = $derived(
    art.kind === "powerup" ? powerKitchenKind(art.motif) : art.kind === "skill" ? skillKitchenKind(art.motif) : null,
  );
  const drawn = $derived(
    art.kind === "powerup" ? powerSprite(art.motif) : art.kind === "skill" ? skillSprite(art.motif) : null,
  );
  const sprite = $derived(drawn ?? iconSprite(art));
</script>

{#if ingredient}
  <Ingredient id={ingredient} {size} />
{:else if kitchen}
  <OrderKitchenItem kind={kitchen} {size} />
{:else}
  <span class="ou-icon" style:width={size + "px"} style:height={size + "px"} aria-hidden="true">
    <PixelIcon grid={[...sprite.grid]} palette={sprite.palette} px={1} />
  </span>
{/if}

<style>
  .ou-icon {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
  }

  .ou-icon :global(svg) {
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
  }
</style>
