<script lang="ts">
  import { untrack } from "svelte";
  import { BLEND_TIN_LIMIT, sameBlend, type BlendTin } from "#lib/arcade/orders-blend-tin.ts";
  import { INGREDIENTS } from "#lib/arcade/orders-campaign.ts";
  import type { CupPrintId } from "#lib/arcade/orders-recipe-journal.ts";
  import { FLOAT_FLAVORS, MIXED_TEA_DAY, MIXINS, normalizeHouseBlend, recipeFromHouseBlend, SYRUPS, TOPPINGS, unlockedIngredients, type HouseBlend, type Level } from "#lib/arcade/orders-service.ts";
  import OrderHouseCup from "./OrderHouseCup.svelte";
  import OrderKitchenItem from "./OrderKitchenItem.svelte";

  interface Props {
    blend: HouseBlend | null;
    day: number;
    cupPrint?: CupPrintId;
    disabled?: boolean;
    onSave: (value: HouseBlend | null) => void;
    tin?: BlendTin;
    onTin?: (next: BlendTin) => void;
    todayBlend?: HouseBlend | null;
  }

  let { blend, day, cupPrint, disabled = false, onSave, tin, onTin, todayBlend }: Props = $props();
  const defaults: HouseBlend = { tea: "black", milk: "milk", fruit: null, topping: "pearls", syrup: "brown-sugar", sugar: 1, ice: 2 };
  let draft = $state<HouseBlend>(untrack(() => blend ?? { ...defaults }));
  const unlocked = $derived(unlockedIngredients(day));
  const scoops = $derived(FLOAT_FLAVORS.filter((flavor) => unlocked.includes(flavor)));
  const recipe = $derived(recipeFromHouseBlend(draft));
  const validDraft = $derived(normalizeHouseBlend(draft, day));
  const ready = $derived(!!validDraft);
  const inTin = $derived(!!tin && tin.presets.some((saved) => sameBlend(saved, draft)));
  const menuName = $derived(todayBlend ? recipeFromHouseBlend(todayBlend).name : "");

  function saveToTin() {
    if (!tin || !validDraft || inTin || tin.presets.length >= BLEND_TIN_LIMIT) return;
    onTin?.({ ...tin, presets: [...tin.presets, validDraft] });
  }

  function removeFromTin(index: number) {
    if (!tin) return;
    const presets = tin.presets.filter((_, position) => position !== index);
    onTin?.({ ...tin, presets, rotate: tin.rotate && presets.length >= 2 });
  }

  const shelves = [
    { field: "tea", title: "Tea", options: ["black", "jasmine", "taro"] },
    { field: "milk", title: "Milk", options: [null, "milk", "oat"] },
    { field: "fruit", title: "Fruit", options: [null, ...MIXINS] },
    { field: "topping", title: "Topping", options: [null, ...TOPPINGS] },
    { field: "syrup", title: "Syrup", options: SYRUPS },
  ] as const;

  const names = new Map(INGREDIENTS.map(({ id, name }) => [id as string, name]));
</script>

<div class="blend-desk">
  <div class="tasting-tools">
    <figure class="tasting-mat">
      <OrderHouseCup tea={recipe.tea} milk={recipe.milk} toppings={recipe.toppings}
        mixins={[...recipe.mixins, ...Array<string>(recipe.sugar).fill(recipe.syrup)]}
        ice={recipe.ice} scoop={recipe.float} accentTea={recipe.accentTea} sparkling={recipe.sparkling} {cupPrint} size={230} />
      <figcaption>{recipe.name}</figcaption>
    </figure>

    {#if tin}
      <details class="recipe-tin">
        <summary>
          <OrderKitchenItem kind="quality" size={21} />
          <span>Recipe tin</span><small>{tin.presets.length} / {BLEND_TIN_LIMIT}</small>
          {#if tin.rotate && menuName}
            <span class="tin-menu">Today · {menuName}</span>
          {/if}
        </summary>
        <div class="tin-inset">
          {#if tin.presets.length}
            <ul class="saved-blends" aria-label="Saved blends">
              {#each tin.presets as saved, index}
                {@const name = recipeFromHouseBlend(saved).name}
                <li>
                  <button class="boba-key order-pixel-paper-key tin-load" type="button" {disabled}
                    aria-pressed={sameBlend(saved, draft)} aria-label={"Edit " + name}
                    onclick={() => draft = { ...saved }}>
                    <OrderKitchenItem kind={saved.tea} size={20} />
                    <span>{name}</span>
                  </button>
                  <button class="boba-key order-pixel-paper-key tin-remove" type="button" disabled={disabled || !onTin}
                    aria-label={"Remove " + name + " from the recipe tin"} onclick={() => removeFromTin(index)}>
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
          <div class="tin-actions">
            <button class="boba-key order-pixel-paper-key" type="button"
              disabled={disabled || !onTin || !ready || inTin || tin.presets.length >= BLEND_TIN_LIMIT} onclick={saveToTin}>
              {inTin ? "Draft saved" : "Keep this draft"}
            </button>
            <button class="boba-key order-pixel-paper-key" type="button"
              disabled={disabled || !onTin || tin.presets.length < 2} aria-pressed={tin.rotate}
              title={tin.presets.length < 2 ? "Save two recipes to rotate" : undefined}
              onclick={() => tin && onTin?.({ ...tin, rotate: !tin.rotate })}>
              Rotate daily
            </button>
          </div>
        </div>
      </details>
    {/if}
  </div>

  <div class="blend-controls">
    {#each shelves as shelf}
      <div class="blend-shelf" role="group" aria-label={shelf.title}>
        <span>{shelf.title}</span>
        {#each shelf.options as option}
          {#if option === null || unlocked.some((id) => option === id)}
            {@const name = option ? names.get(option) ?? option : shelf.field === "milk" ? "Plain" : "None"}
            <button type="button" class="boba-key order-pixel-paper-key blend-key" {disabled}
              aria-pressed={draft[shelf.field] === option} aria-label={name} title={name}
              onclick={() => draft = { ...draft, [shelf.field]: option,
                ...(shelf.field === "tea" && draft.accentTea === option ? { accentTea: undefined } : {}),
                ...(shelf.field === "milk" && option !== null ? { sparkling: undefined } : {}) }}>
              <OrderKitchenItem kind={option ?? "plain"} size={24} />
              <span>{name}</span>
            </button>
          {/if}
        {/each}
      </div>
      {#if shelf.field === "tea" && day >= MIXED_TEA_DAY}
        <div class="blend-shelf" role="group" aria-label="Second tea">
          <span>Second tea</span>
          {#each [undefined, ...shelf.options] as option}
            {#if option !== draft.tea}
              <button type="button" class="boba-key order-pixel-paper-key blend-key" {disabled}
                aria-pressed={draft.accentTea === option} aria-label={option ? "Second tea " + names.get(option) : "No second tea"}
                onclick={() => draft = { ...draft, accentTea: option }}>
                <OrderKitchenItem kind={option ?? "plain"} size={24} /><span>{option ? names.get(option) : "None"}</span>
              </button>
            {/if}
          {/each}
        </div>
      {/if}
    {/each}

    {#if unlocked.includes("seltzer")}
      <div class="blend-shelf" role="group" aria-label="Bubbles">
        <span>Bubbles</span>
        <button type="button" class="boba-key order-pixel-paper-key blend-key" {disabled} aria-pressed={!draft.sparkling}
          onclick={() => draft = { ...draft, sparkling: undefined }}>
          <OrderKitchenItem kind="plain" size={24} /><span>Still</span>
        </button>
        <button type="button" class="boba-key order-pixel-paper-key blend-key" {disabled} aria-pressed={!!draft.sparkling}
          onclick={() => draft = { ...draft, milk: null, float: undefined, sparkling: true }}>
          <OrderKitchenItem kind="seltzer" size={24} /><span>Sparkling</span>
        </button>
      </div>
    {/if}

    {#if scoops.length}
      <div class="blend-shelf" role="group" aria-label="Ice cream">
        <span>Ice cream</span>
        {#each [undefined, ...scoops] as flavor}
          <button type="button" class="boba-key order-pixel-paper-key blend-key" {disabled}
            aria-pressed={draft.float === flavor} aria-label={flavor ? names.get(flavor) : "No ice cream"}
            onclick={() => draft = { ...draft, float: flavor, ...(flavor ? { sparkling: undefined } : {}) }}>
            <OrderKitchenItem kind={flavor ?? "plain"} size={24} />
            <span>{flavor === "banana-scoop" ? "Banana" : flavor === "vanilla-scoop" ? "Vanilla" : "None"}</span>
          </button>
        {/each}
      </div>
    {/if}

    {#each [{ label: "Syrup pumps", field: "sugar", icon: "brown-sugar" }, { label: "Ice level", field: "ice", icon: "ice" }] as dial}
      <div class="blend-shelf" role="group" aria-label={dial.label}>
        <span><OrderKitchenItem kind={dial.icon} size={18} />{dial.label}</span>
        {#each [0, 1, 2, 3] as level}
          <button type="button" class="boba-key order-pixel-paper-key blend-key amount" {disabled}
            aria-label={dial.label + " " + level} aria-pressed={draft[dial.field as "sugar" | "ice"] === level}
            onclick={() => draft = { ...draft, [dial.field]: level as Level }}>{level}</button>
        {/each}
      </div>
    {/each}

    <div class="blend-actions">
      <button class="boba-key is-primary" type="button" disabled={disabled || !ready} onclick={() => onSave(draft)}>
        <OrderKitchenItem kind="street-sign" size={22} /> Put on the menu
      </button>
      {#if blend}<button class="boba-key order-pixel-paper-key" type="button" {disabled} onclick={() => onSave(null)}>Take off the menu</button>{/if}
    </div>
  </div>
</div>

<style>
  .blend-desk { display: grid; grid-template-columns: minmax(0, 0.68fr) minmax(0, 1fr); align-items: start; gap: var(--space-5); }
  .tasting-mat { display: grid; justify-items: center; min-width: 0; margin: 0; }
  .tasting-mat :global(svg) { max-width: 100%; height: auto; }
  figcaption { color: var(--b-gold); font-family: var(--font-ui); font-size: 0.96rem; font-style: italic; text-align: center; }
  .blend-controls { display: grid; gap: 5px; }
  .blend-shelf, .blend-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
  .blend-shelf > span { display: inline-flex; align-items: center; gap: 2px; flex: 0 0 3.85rem; color: var(--b-muted); font-size: 0.75rem; }
  .blend-key.boba-key { min-height: 42px; padding-inline: 7px; font-size: 0.75rem; }
  .blend-key.amount { min-width: 34px; }
  .blend-key[aria-pressed="true"] { --key-face: var(--b-mine); --key-rule: var(--b-accent); }
  .blend-actions { margin-top: var(--space-3); }
  .blend-actions .boba-key { min-height: 43px; }
  .tasting-tools { display: grid; gap: 8px; min-inline-size: 0; }
  .recipe-tin {
    min-inline-size: 0;
    color: var(--slip-ink, #523a34);
    background: var(--slip-card, #ead9b6);
    border: 1px solid var(--slip-stroke, #987462);
    box-shadow: 2px 2px 0 var(--slip-stroke, #987462);
  }

  .recipe-tin summary {
    display: grid;
    grid-template-columns: auto auto minmax(0, 1fr) auto;
    gap: 4px;
    align-items: center;
    min-block-size: 44px;
    padding-inline: 7px;
    cursor: pointer;
    font-size: .8rem;
    list-style: none;
  }

  .recipe-tin summary::-webkit-details-marker { display: none; }
  .recipe-tin summary::before {
    content: "";
    block-size: 7px;
    inline-size: 7px;
    margin-inline-end: 2px;
    background: currentColor;
    clip-path: polygon(0 0, 48% 0, 48% 27%, 76% 27%, 76% 46%, 100% 46%, 100% 54%, 76% 54%, 76% 73%, 48% 73%, 48% 100%, 0 100%);
  }
  .recipe-tin[open] summary::before { transform: rotate(90deg); }
  .recipe-tin summary:focus-visible { outline: 2px solid var(--slip-ink, #523a34); outline-offset: 2px; }
  .recipe-tin small, .tin-menu { color: var(--slip-muted, #73584c); }

  .tin-inset { display: grid; gap: 6px; padding: 5px 6px 6px; }
  .tin-menu { grid-column: 2 / -1; margin-block-start: -3px; padding-block-end: 5px; font-size: .72rem; overflow-wrap: anywhere; }
  .saved-blends { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
  .saved-blends li { display: grid; grid-template-columns: minmax(0, 1fr) 44px; gap: 4px; }
  .recipe-tin .boba-key { min-block-size: 44px; min-inline-size: 0; padding-inline: 5px; font-size: .72rem; }
  .tin-load { justify-content: flex-start; text-align: start; overflow-wrap: anywhere; }
  .tin-load :global(svg) { flex: 0 0 auto; }
  .tin-remove span { font-size: 1.1rem; }
  .tin-actions { display: flex; flex-wrap: wrap; gap: 4px; }
  .tin-actions button { flex: 1 1 85px; }
  .recipe-tin button[aria-pressed="true"] { --key-face: var(--b-mine); --key-rule: var(--b-accent); }
  @media (max-width: 620px) {
    .blend-desk { grid-template-columns: minmax(0, 1fr); }
    .tasting-mat :global(svg) { max-width: min(100%, 12rem); }
  }
</style>
