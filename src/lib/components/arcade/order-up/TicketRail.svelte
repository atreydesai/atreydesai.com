<script lang="ts">
  // The ticket rail: a fixed peg for every ticket the shop can hold, so a
  // guest arriving never moves the ticket the player is about to press. It
  // stands as a column between the room and the counter, beside the order
  // slip, where the eye already is during a shift.
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import { figure } from "#lib/arcade/orders-guests.js";
  import type { Shift, Ticket } from "#lib/arcade/order-up/engine/shift-types.ts";
  import type { Mode } from "#lib/arcade/order-up/content/schema.ts";
  import { RECIPE_BY_ID } from "#lib/arcade/order-up/content/index.ts";
  import OrderPixelWord from "../OrderPixelWord.svelte";
  import Ingredient from "./Ingredient.svelte";
  import Mark from "./Mark.svelte";

  export let shift: Shift | null;
  export let pegs: number;
  export let mode: Mode;
  export let select: (slot: number) => void;

  $: slots = shift?.tickets ?? Array.from({ length: pegs }, () => null);

  function face(ticket: Ticket) {
    const left = ticket.patience / ticket.maxPatience;
    return figure(ticket.name.toLowerCase(), ticket.sleeping ? "blink" : left < 0.25 ? "cross" : left < 0.55 ? "glance" : "calm");
  }

  function status(ticket: Ticket) {
    if (ticket.sleeping) return "asleep";
    if (ticket.changeTo) return "new request";
    if (ticket.usual && !ticket.revealed) return "the usual";
    if (ticket.cups.every((cup) => cup.ready)) return ticket.packed ? "packed" : "ready";
    if (ticket.cups.length > 1) return ticket.cups.filter((cup) => cup.ready).length + " of " + ticket.cups.length + " cups";
    return "";
  }

  function label(ticket: Ticket) {
    const recipe = RECIPE_BY_ID[ticket.recipe];
    const said = status(ticket);
    return ticket.name + (ticket.usual && !ticket.revealed ? ", the usual" : ", " + recipe.name) + (said ? ", " + said : "") +
      ", " + Math.ceil(ticket.patience) + " seconds of patience";
  }
</script>

<div class="ticket-wall">
  <h2 class="rail-label"><span class="sr-only">Tickets</span><OrderPixelWord text="Tickets" cells={1} /></h2>
  <div class="ticket-list" role="group" aria-label="Tickets">
    {#each slots as ticket, i (i)}
      {#if ticket}
        {@const recipe = RECIPE_BY_ID[ticket.recipe]}
        {@const left = ticket.patience / ticket.maxPatience}
        {@const portrait = face(ticket)}
        <button
          type="button"
          class="guest-ticket ou-arrive"
          class:is-active={shift?.selected === i}
          class:is-leaving={left < 0.3}
          class:is-ready={ticket.cups.every((cup) => cup.ready)}
          aria-pressed={shift?.selected === i}
          aria-label={label(ticket)}
          onclick={() => select(i)}
        >
          <span class="guest-portrait" aria-hidden="true"><PixelIcon grid={portrait.grid} palette={portrait.palette} px={2} /></span>
          <span class="guest-order">
            <strong>{ticket.name}{#if ticket.cups.length > 1}<small> ×{ticket.cups.length}</small>{/if}</strong>
            <span class="guest-recipe" aria-hidden="true">
              {#if ticket.usual && !ticket.revealed}
                <Mark kind="question" size={16} />
                {#if mode === "normal"}<span class="faint"><Ingredient id={recipe.ingredients[0].id} size={18} /></span>{/if}
              {:else if ticket.changeTo}
                <Mark kind="change" size={16} /><span>new request</span>
              {:else}
                {#each recipe.ingredients.slice(0, 4) as item (item.id)}<Ingredient id={item.id} size={18} />{/each}
                {#if ticket.cups.every((cup) => cup.ready)}<span class="ready-mark"><Mark kind="check" size={14} /></span>{/if}
              {/if}
            </span>
            <span class="patience" class:is-quiet={ticket.sleeping} class:ou-urgent={left < 0.25 && !ticket.sleeping && !ticket.cups.every((cup) => cup.ready)} aria-hidden="true"><i style:width={left * 100 + "%"}></i></span>
          </span>
        </button>
      {:else}
        <span class="empty-peg" aria-hidden="true"><i></i></span>
      {/if}
    {/each}
  </div>
</div>

<style>
  .ticket-wall {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    min-width: 0;
    min-height: 0;
    padding: 10px 8px;
    color: #fff0d6;
    background: #392b2b;
    box-shadow: inset 0 3px #966754, inset 0 -4px #211c21, 0 4px #252226;
    clip-path: var(--notch);
  }

  .rail-label {
    flex: none;
    margin: 0;
    color: inherit;
    line-height: 1;
  }

  .ticket-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-auto-rows: 3.35rem;
    align-content: start;
    flex: 1 1 auto;
    gap: 8px;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    padding: 2px;
    scrollbar-width: none;
  }

  .rail-label {
    padding-left: 4px;
  }

  .guest-ticket,
  .empty-peg {
    min-height: 3.35rem;
    clip-path: var(--notch);
  }

  .guest-ticket {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    min-width: 0;
    border: 0;
    padding: 5px 8px 6px;
    background: #ecd4ac;
    box-shadow: inset 0 2px #fff0cc, inset 0 -3px #bf9a79;
    color: #342527;
    cursor: pointer;
    text-align: left;
    font: inherit;
    touch-action: manipulation;
  }

  .guest-ticket.is-active {
    background: #f8d0a9;
    box-shadow: inset 0 3px #d48261, inset 0 -3px #d48261, inset 3px 0 #d48261, inset -3px 0 #d48261;
  }

  .guest-ticket.is-leaving:not(.is-ready) {
    background: #f2bf9a;
  }

  .guest-ticket:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 3px #ad3f30, inset 0 -3px #9d6755;
  }

  .guest-portrait {
    flex: none;
    align-self: end;
    height: 2.3rem;
    overflow: hidden;
  }

  .guest-order {
    display: grid;
    flex: 1;
    gap: 3px;
    min-width: 0;
    line-height: 1.14;
  }

  .guest-order strong {
    overflow: hidden;
    font-size: 0.8125rem;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .guest-order strong small {
    color: #7d5b4d;
    font-size: 0.75rem;
    font-weight: 400;
  }

  .guest-recipe {
    display: flex;
    align-items: center;
    gap: 1px;
    height: 18px;
    overflow: hidden;
    color: #654747;
    font-size: 0.75rem;
    white-space: nowrap;
  }

  .guest-recipe > span:not(.ready-mark) {
    display: contents;
  }

  .faint {
    opacity: 0.35;
  }

  .ready-mark {
    display: grid;
    place-items: center;
    margin-inline-start: auto;
    width: 18px;
    height: 18px;
    background: #5f7a5e;
    color: #fff0cc;
  }

  .patience {
    display: block;
    height: 3px;
    background: #d4b693;
  }

  .patience i {
    display: block;
    height: 100%;
    background: #9b523d;
  }

  .patience.is-quiet i {
    background: #759b90;
  }

  .is-ready .patience i {
    background: #5f7a5e;
  }

  .empty-peg {
    display: grid;
    place-items: center;
    background: #33282a;
    box-shadow: inset 0 0 0 2px #4b3a36;
  }

  .empty-peg i {
    width: 6px;
    height: 16px;
    background: #6b5048;
    box-shadow: 2px 2px #261e21;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @media (max-width: 720px) {
    .ticket-wall {
      padding: 4px 6px;
      gap: 6px;
    }

    .rail-label {
      display: none;
    }

    .ticket-list {
      grid-template-columns: none;
      grid-auto-columns: minmax(7.25rem, 1fr);
    }

    .guest-ticket,
    .empty-peg {
      min-height: 3rem;
    }
  }

  @media (orientation: landscape) and (max-height: 540px) {
    .ticket-wall {
      padding-block: 2px;
    }

    .rail-label {
      display: none;
    }

    .ticket-list {
      padding-block: 2px 4px;
    }

    .guest-ticket,
    .empty-peg {
      min-height: 2.5rem;
      padding-block: 2px;
    }

    .guest-portrait {
      height: 1.9rem;
    }
  }
</style>
