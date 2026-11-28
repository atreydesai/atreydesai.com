<script lang="ts">
  // The order in hand on the shop's thermal paper: who it is for and how long
  // they will wait, the drink, what goes in it and its steps, ticked off as
  // they are done. It keeps one height for any recipe, so nothing under it
  // moves when the next order comes up.
  import "./slip.css";
  import "./motion.css";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import { figure } from "#lib/arcade/orders-guests.js";
  import type { Ticket, Cup } from "#lib/arcade/order-up/engine/shift-types.ts";
  import { RECIPE_BY_ID, INGREDIENT_BY_ID, SKILLS } from "#lib/arcade/order-up/content/index.ts";
  import Ingredient from "./Ingredient.svelte";
  import Icon from "./Icon.svelte";

  let { ticket, cup, hidden = false }: { ticket: Ticket | null; cup: Cup | null; hidden?: boolean } = $props();

  const ICE = ["no ice", "less ice", "ice", "extra ice"];
  // The step just done on the cup in hand flashes once; switching orders flashes nothing.
  let seen = "";
  let lastStep = -1;
  let fresh = $state(-1);
  $effect(() => {
    const key = ticket && cup ? ticket.id + ":" + ticket.cupIndex : "";
    const step = cup?.step ?? -1;
    if (key === seen && step > lastStep) {
      fresh = -1;
      queueMicrotask(() => (fresh = step - 1));
    } else if (key !== seen) fresh = -1;
    seen = key;
    lastStep = step;
  });
  const recipe = $derived(cup ? RECIPE_BY_ID[cup.recipe] : null);
  const left = $derived(ticket ? Math.max(0, Math.min(1, ticket.patience / ticket.maxPatience)) : 0);
  const face = $derived(
    ticket
      ? figure(ticket.name.toLowerCase(), ticket.sleeping ? "blink" : left < 0.25 ? "cross" : left < 0.55 ? "glance" : "calm")
      : null,
  );
</script>

<div class="order-slot">
  {#if ticket && recipe && face}
    <article class="bk-slip order-slip" aria-label={"Order for " + ticket.name}>
      <header class="who">
        <span class="face" aria-hidden="true"><PixelIcon grid={face.grid} palette={face.palette} px={2} /></span>
        <strong>{ticket.name}</strong>
        {#if ticket.cups.length > 1}<span class="cups">cup {ticket.cupIndex + 1} of {ticket.cups.length}</span>{/if}
        <span class="wait" class:is-low={left < 0.3} role="img" aria-label={Math.ceil(ticket.patience) + " seconds of patience"}
          ><i style:width="{left * 100}%"></i></span
        >
      </header>
      <hr />
      {#if ticket.special === "cat"}
        <p class="drink-line"><strong class="drink">a saucer of milk</strong></p>
      {:else if hidden}
        <p class="drink-line"><strong class="drink">the usual</strong></p>
      {:else}
        <p class="drink-line">
          <strong class="drink" title={recipe.name}>{recipe.name}</strong>
          <span class="levels">{recipe.sugar * 25}% sugar, {recipe.hot ? "hot" : ICE[recipe.ice]}</span>
        </p>
        <ul class="items" class:is-dense={recipe.ingredients.length > 6} aria-label="What goes in">
          {#each recipe.ingredients as item (item.id)}
            <li>
              <Ingredient id={item.id} size={18} /><span class="nm">{INGREDIENT_BY_ID[item.id].name}{#if item.quantity > 1}&nbsp;×{item.quantity}{/if}</span>
            </li>
          {/each}
        </ul>
        <hr />
        <ol class="steps" aria-label="Steps">
          {#each recipe.steps as id, i (i)}
            {@const step = SKILLS.find((x) => x.id === id)!}
            <li class:is-done={i < cup!.step} class:is-now={i === cup!.step && !cup!.ready} class:ou-gain={i === fresh} title={step.name}>
              <Icon art={step.art} size={18} />
              <span class="sr-only">{step.name}{i < cup!.step ? ", done" : i === cup!.step ? ", next" : ""}</span>
            </li>
          {/each}
        </ol>
      {/if}
    </article>
  {/if}
</div>

<style>
  /* Sized for the longest recipe: two rows of ingredients (icons alone past
     six) and eight steps. */
  .order-slot {
    flex: none;
    height: 11.5rem;
    padding: 8px 10px 0;
  }

  .order-slip {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 9px 12px 16px;
    overflow: hidden;
  }

  .order-slip hr {
    margin: 6px 0;
  }

  .who {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 30px;
  }

  .face {
    display: grid;
    flex: none;
    place-items: center;
    width: 30px;
    height: 30px;
    overflow: hidden;
  }

  .who strong {
    font-size: 14px;
    font-weight: 600;
  }

  .cups {
    color: var(--lg-slip-muted);
  }

  .wait {
    flex: none;
    width: 72px;
    height: 6px;
    margin-left: auto;
    background: var(--lg-slip-rule);
  }

  .wait i {
    display: block;
    height: 100%;
    background: #6f8f5c;
  }

  .wait.is-low i {
    background: #c9462f;
  }

  .drink-line {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin: 0;
  }

  .drink {
    min-width: 0;
    overflow: hidden;
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .levels {
    flex: none;
    margin-left: auto;
    color: var(--lg-slip-muted);
  }

  .items {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
    grid-auto-rows: 22px;
    gap: 0 10px;
    height: 44px;
    margin: 4px 0 0;
    padding: 0;
    overflow: hidden;
    list-style: none;
  }

  .items li {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .items li > span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .items.is-dense {
    grid-template-columns: repeat(auto-fill, 22px);
    gap: 0 4px;
  }

  .items.is-dense .nm {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .steps {
    display: flex;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .steps li {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    opacity: 0.35;
  }

  .steps li.is-done {
    opacity: 1;
    background: #e6ddd0;
  }

  .steps li.is-now {
    opacity: 1;
    box-shadow: inset 0 -3px #c9462f;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
</style>
