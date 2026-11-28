<script lang="ts">
  import PixelIcon from "../../PixelIcon.svelte";
  import { machineSprite } from "#lib/arcade/order-up/art/sprites.ts";
  export let id = "";
  export let tier = 1;
  export let turn = 0;
  export let working = false;
  export let size = 80;
  /** A brew kit fitted at the shop, drawn as its rig beside the machine. */
  export let kit = "";
  $: sprite = machineSprite(id, tier, turn, working, kit);
</script>

<span class="machine" class:working style:width={size + "px"} style:height={size + "px"} aria-hidden="true"
  ><PixelIcon grid={sprite.grid} palette={sprite.palette} px={3} />{#if working}<i></i>{/if}</span
>

<style>
  .machine {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .machine :global(svg) {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    image-rendering: pixelated;
  }
  .machine i {
    position: absolute;
    top: 0;
    left: 50%;
    width: 4px;
    height: 12px;
    background: #f3e6cb;
    animation: steam 0.8s steps(3) infinite;
  }
  @keyframes steam {
    to {
      transform: translate(4px, -12px);
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .machine i {
      animation: none;
    }
  }
</style>
