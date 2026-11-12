<script lang="ts">
  import "./arcade.css";

  import { onMount } from "svelte";

  import { arcadeScreen, closeArcade, type GameId } from "$lib/boba";
  import { sfxBlip } from "$lib/sfx";
  import ArcadeMenu from "./ArcadeMenu.svelte";
  import RisoDefs from "./RisoDefs.svelte";

  // The host owns everything the games share: the scroll lock, the hidden
  // site cursor, pausing the footer's music, Escape to quit, and returning
  // focus to wherever the visitor was when the arcade closes.

  // Each game is fetched when it is picked, so the menu opens on its own
  // code alone, and a game that fails to load can't take the arcade with it.
  // Games still being built load through a glob, which matches nothing until
  // the file exists, so the build and type-check pass in the meantime and
  // picking one falls back to the menu's "Couldn't load just now".
  const PENDING = import.meta.glob<{ default: any }>(["./SugarRush.svelte", "./Spill.svelte"]);
  const pending = (path: string) => () =>
    PENDING[path]?.() ?? Promise.reject(new Error(`${path} isn't built yet`));

  const LOADERS: Record<GameId, () => Promise<{ default: any }>> = {
    catch: () => import("./CatchGame.svelte"),
    stab: () => import("./StrawStab.svelte"),
    orders: () => import("./OrderUp.svelte"),
    stack: () => import("./CupStack.svelte"),
    lander: () => import("./TeaMinus.svelte"),
    runner: pending("./SugarRush.svelte"),
    spill: pending("./Spill.svelte"),
  };

  let Game: any = null;
  let loaded: GameId | null = null;
  let failed: GameId | null = null;

  async function load(id: GameId) {
    try {
      const module = await LOADERS[id]();
      // The visitor may have moved on while it loaded.
      if ($arcadeScreen !== id) return;
      Game = module.default;
      loaded = id;
    } catch (error) {
      console.error(`[arcade] ${id} failed to load`, error);
      if ($arcadeScreen !== id) return;
      failed = id;
      arcadeScreen.set("menu");
    }
  }

  $: screen = $arcadeScreen;
  $: if (screen && screen !== "menu") {
    if (loaded !== screen) {
      Game = null;
      loaded = null;
      void load(screen);
    }
  } else {
    Game = null;
    loaded = null;
  }

  function showMenu() {
    arcadeScreen.set("menu");
  }

  function pick(event: CustomEvent<GameId>) {
    failed = null;
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
    <ArcadeMenu {failed} on:pick={pick} on:close={closeArcade} />
  {:else if Game && loaded === $arcadeScreen}
    <svelte:component this={Game} on:close={closeArcade} on:menu={showMenu} />
  {:else}
    <!-- Paper over the page while the game's code arrives. -->
    <div class="boba-stage is-paper" aria-hidden="true"></div>
  {/if}
</div>

<style>
  .boba-arcade {
    display: contents;
  }
</style>
