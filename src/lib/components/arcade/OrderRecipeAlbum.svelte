<script lang="ts">
  import { RECIPE_BOOK } from "#lib/arcade/orders-service.ts";
  import { CUP_PRINTS, recipeStampCount, signatureCount, type CupPrintId, type RecipeRecords } from "#lib/arcade/orders-recipe-journal.ts";
  import OrderCupPrint from "./OrderCupPrint.svelte";
  import OrderHouseCup from "./OrderHouseCup.svelte";

  interface Props {
    day: number;
    records: RecipeRecords;
    cupPrint: CupPrintId;
    locked?: boolean;
    onPrint: (kind: CupPrintId) => void;
    onPractice: (customerId: string) => void;
  }

  let { day, records, cupPrint, locked = false, onPrint, onPractice }: Props = $props();
  let picked = $state("");
  const recipes = $derived(RECIPE_BOOK.filter((entry) => entry.day <= day));
  const page = $derived(recipes.find((entry) => entry.customerId === picked) ?? recipes[0]);
  const record = $derived(page ? records[page.recipe.name] : undefined);
  const stamps = $derived(recipeStampCount(record));
  const signatures = $derived(signatureCount(records));
</script>

<section class="recipe-album" aria-label="Recipe album">
  {#if page}
    <label class="binder-index">
      <span>Recipe</span>
      <select aria-label="Recipe" value={page.customerId} onchange={(event) => picked = event.currentTarget.value}>
        {#each recipes as entry (entry.customerId)}
          <option value={entry.customerId}>{entry.recipe.name}</option>
        {/each}
      </select>
    </label>
    <div class="recipe-page">
      <div class="cup-illustration">
        <OrderHouseCup tea={page.recipe.tea} accentTea={page.recipe.accentTea} milk={page.recipe.milk}
          toppings={page.recipe.toppings} mixins={[...page.recipe.mixins, ...(page.recipe.sugar ? [page.recipe.syrup] : [])]} ice={page.recipe.ice}
          scoop={page.recipe.float} sparkling={page.recipe.sparkling} {cupPrint} size={100} />
      </div>
      <div class="recipe-notes">
        <h3>{page.recipe.name}</h3>
        <div class="brew-levels">
          {#each [{ name: "Sugar", level: page.recipe.sugar }, { name: "Ice", level: page.recipe.ice }] as setting (setting.name)}
            <span aria-label={setting.name + ": " + setting.level + " of 3"}>
              <span aria-hidden="true">{setting.name}</span>
              <span class="brew-pips" aria-hidden="true">
                {#each [1, 2, 3] as pip}
                  <i class:filled={pip <= setting.level}></i>
                {/each}
              </span>
            </span>
          {/each}
        </div>
        <div class="stamp-row" aria-label={stamps + " of 3 recipe stamps"}>
          {#each [1, 2, 3] as stamp}
            <svg viewBox="0 0 12 12" width="16" height="16" aria-hidden="true" shape-rendering="crispEdges">
              <path d="M4 1h4v2h2v2h1v2h-1v2H8v2H4V9H2V7H1V5h1V3h2zm1 3v1H4v2h1v1h2V7h1V5H7V4z"
                fill={stamp <= stamps ? "var(--album-ink)" : "var(--album-muted)"} opacity={stamp <= stamps ? 1 : .44} />
              {#if stamp <= stamps}
                <path d="M5 5h2v2H5z" fill="#b5794e" />
              {/if}
            </svg>
          {/each}
        </div>
        <p>{record ? `Best ${record.best}% · ${record.count} served` : "First serve pending"}</p>
      </div>
      <button class="practice" type="button" onclick={() => onPractice(page.customerId)}>Practice this recipe</button>
    </div>
  {:else}
    <p class="empty-page">Recipes appear as regulars join the shop.</p>
  {/if}

  <div class="print-rack">
    <h3>Cup prints</h3>
    <span>{signatures} {signatures === 1 ? "signature" : "signatures"}</span>
    <details class="stamp-info">
      <summary>How to earn stamps</summary>
      <p>Serve the recipe. Reach 88%. For a signature, serve it twice with a best of 97%.</p>
    </details>
    <div class="print-options" role="group" aria-label="Cup prints">
      {#each CUP_PRINTS as print (print.id)}
        {@const usable = signatures >= print.signatures}
        <button type="button" aria-pressed={cupPrint === print.id} disabled={locked || !usable} onclick={() => onPrint(print.id)}>
          <OrderCupPrint kind={print.id} size={24} />
          <span>{print.name}{#if !usable}<small>{print.signatures} signatures</small>{/if}</span>
        </button>
      {/each}
    </div>
  </div>
</section>

<style>
  .stamp-info { grid-column: 1 / -1; font-size: .75rem; color: var(--album-muted); }
  .stamp-info summary { cursor: pointer; }
  .stamp-info p { margin: 4px 0; }
  .recipe-album {
    --album-ink: var(--slip-ink, #523a34);
    --album-muted: var(--slip-muted, #795b50);
    display: grid;
    gap: 8px;
    min-inline-size: 0;
    color: var(--album-ink);
  }

  .binder-index {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    font-size: .8rem;
  }

  .binder-index select, button {
    color: var(--album-ink);
    background: var(--slip-card, #ead9b6);
    border: 1px solid var(--slip-stroke, #987462);
    border-radius: 2px;
    font: inherit;
  }

  .binder-index select { min-inline-size: 0; min-block-size: 36px; padding: 4px 8px; }
  .recipe-page {
    display: grid;
    grid-template-columns: minmax(60px, .55fr) minmax(0, 1fr);
    align-items: center;
    gap: 6px 8px;
    min-inline-size: 0;
    padding: 7px;
    background: var(--slip-card, #ead9b6);
    border: 1px solid var(--slip-stroke, #987462);
    box-shadow: 2px 2px 0 var(--slip-stroke, #987462);
  }

  .cup-illustration { display: grid; place-items: center; min-inline-size: 0; }
  .cup-illustration :global(svg) { display: block; max-inline-size: 100%; block-size: auto; }
  h3, p { margin: 0; }
  .recipe-notes { display: grid; gap: 4px; }
  h3 { font-size: .88rem; font-weight: 500; line-height: 1.24; }
  .recipe-notes p, .print-rack > span, .empty-page { font-size: .75rem; color: var(--album-muted); }
  .brew-levels { display: flex; flex-wrap: wrap; gap: 3px 8px; font-size: .71rem; }
  .brew-levels > span, .brew-pips { display: inline-flex; align-items: center; gap: 3px; }
  .brew-pips i { inline-size: 6px; block-size: 6px; border: 1px solid var(--album-muted); }
  .brew-pips i.filled { background: var(--album-muted); }
  .stamp-row { display: flex; gap: 3px; }
  .practice { grid-column: 1 / -1; min-block-size: 40px; cursor: pointer; }

  .print-rack {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: baseline;
    gap: 5px 8px;
    padding-block-start: 4px;
  }

  .print-options {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(115px, 100%), 1fr));
    gap: 5px;
    font-size: .75rem;
    line-height: 1.16;
  }

  .print-options button {
    display: flex;
    align-items: center;
    text-align: start;
    gap: 4px;
    min-block-size: 42px;
    padding: 3px 5px;
    cursor: pointer;
  }

  .print-options :global(svg) { flex: 0 0 auto; }
  .print-options button[aria-pressed="true"] { box-shadow: inset 0 0 0 1px var(--album-ink); }
  .print-options button:disabled { cursor: default; }
  .print-options button:disabled:not([aria-pressed="true"]) { color: var(--album-muted); }
  .print-options small { display: block; margin-block-start: 2px; font-size: .68rem; }
  :is(button, select):focus-visible { outline: 2px solid var(--album-ink); outline-offset: 2px; }
</style>
