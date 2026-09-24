<script lang="ts">
  import "./arcade.css";

  import { onMount } from "svelte";

  import { arcadeScreen, closeArcade, type GameId } from "$lib/boba";
  import { sfxBlip } from "$lib/sfx";
  import ArcadeMenu from "./ArcadeMenu.svelte";
  import CatchGame from "./CatchGame.svelte";
  import CupStack from "./CupStack.svelte";
  import OrderUp from "./OrderUp.svelte";
  import RisoDefs from "./RisoDefs.svelte";
  import StrawStab from "./StrawStab.svelte";

  // The host owns everything the games share: the scroll lock, the hidden
  // site cursor, pausing the footer's music, Escape to quit, and returning
  // focus to wherever the visitor was when the arcade closes.

  function showMenu() {
    arcadeScreen.set("menu");
  }

  function pick(event: CustomEvent<GameId>) {
    arcadeScreen.set(event.detail);
  }

  onMount(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.classList.add("boba-active");
    window.dispatchEvent(new Event("boba-game-start"));

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      sfxBlip();
      closeArcade();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = previousOverflow;
      document.body.classList.remove("boba-active");
      queueMicrotask(() => {
        if (previousFocus?.isConnected) {
          previousFocus.focus();
          return;
        }
        document.querySelector<HTMLElement>(".boba-launcher")?.focus();
      });
    };
  });
</script>

<!-- One wrapper that takes no layout of its own, so the site's paragraph
     justifier leaves every game's copy alone. -->
<div class="boba-arcade" data-justify="off">
  <RisoDefs />

  {#if $arcadeScreen === "menu"}
    <ArcadeMenu on:pick={pick} on:close={closeArcade} />
  {:else if $arcadeScreen === "catch"}
    <CatchGame on:close={closeArcade} on:menu={showMenu} />
  {:else if $arcadeScreen === "stab"}
    <StrawStab on:close={closeArcade} on:menu={showMenu} />
  {:else if $arcadeScreen === "orders"}
    <OrderUp on:close={closeArcade} on:menu={showMenu} />
  {:else if $arcadeScreen === "stack"}
    <CupStack on:close={closeArcade} on:menu={showMenu} />
  {/if}
</div>

<style>
  .boba-arcade {
    display: contents;
  }
</style>
