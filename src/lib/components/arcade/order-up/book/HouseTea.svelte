<script lang="ts">
  // The Garden Tea Room's house tea, a chain through five parts of the shop:
  // keep a sample of homegrown oolong at harvest, taste it with peach,
  // calibrate a precision brew machine, train a prep employee, then list it.
  // Each step is a tile, the next one edged orange; the line under them says
  // what the next step needs and holds its one key, so the tiles never move.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import { GARDEN_FEATURE } from "#lib/arcade/order-up/content/service-program.ts";
  import { treeChoiceOpen } from "#lib/arcade/order-up/engine/opened.ts";
  import { brewMod, workshopPrice } from "#lib/arcade/order-up/engine/upgrades.ts";
  import { machineDefinition, staffOnDuty } from "#lib/arcade/order-up/engine/management.ts";
  import { stock } from "#lib/arcade/order-up/engine/pantry.ts";
  import { upgradeSprite } from "#lib/arcade/order-up/art/upgrade-icons.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import OrderPixelWord from "../../OrderPixelWord.svelte";

  let { campaign, live = false, action }: { campaign: Campaign; live?: boolean; action: (name: string, data?: any) => void } = $props();

  interface Step {
    id: Parameters<typeof treeChoiceOpen>[1];
    name: string;
    done: boolean;
    /** Why the step can't be taken now, as a sentence; empty when it can. */
    why: string;
    key?: string;
    run?: () => void;
  }

  const steps = $derived.by((): Step[] => {
    void campaign.cash;
    const c = campaign;
    const f = c.expansion.gardenFeature;
    const here = c.expansion.activeShop === GARDEN_FEATURE.shop;
    const shut = live ? "Change this between shifts." : !here ? "Work at the Garden Tea Room for this." : "";
    const opens = (id: Step["id"], day: number) => (treeChoiceOpen(c, id) ? "" : `This opens on day ${day}.`);
    const sampled = f.developed || f.sampleUntil > c.day;
    const plot = c.expansion.garden.findIndex((p) => p.ingredient === GARDEN_FEATURE.tea && p.growth >= 3);
    const growing = c.expansion.garden.some((p) => p.ingredient === GARDEN_FEATURE.tea);
    const machine = Object.entries(c.expansion.machines).find(([key, m]) => {
      const d = machineDefinition(key);
      return m.shop === GARDEN_FEATURE.shop && m.automatic && !m.broken && m.condition > 0 && d?.station === "brew" && d.skills.includes("steep");
    });
    const precision = brewMod(c, GARDEN_FEATURE.shop)?.id === GARDEN_FEATURE.kit;
    const prep = c.expansion.staff.filter((s) => s.shop === GARDEN_FEATURE.shop && s.station === "prep");
    const trainee = prep.find((s) => s.shifts >= 2 && s.energy >= 45);
    const calibration = workshopPrice(c, GARDEN_FEATURE.calibrationCost);
    const training = workshopPrice(c, GARDEN_FEATURE.trainingCost);
    const trainedOnDuty = staffOnDuty(c, GARDEN_FEATURE.shop).some((s) => s.id === f.trainedStaff && s.station === "prep");
    return [
      {
        id: "tea-garden-oolong",
        name: "Keep a sample",
        done: sampled,
        why:
          opens("tea-garden-oolong", 20) || shut ||
          (plot < 0 ? (growing ? "The oolong bed isn't ripe yet." : "Plant oolong in a garden bed.") : ""),
        key: "Harvest and keep one",
        run: () => action("harvest", { plot, reserveSample: true }),
      },
      {
        id: "menu-garden-oolong",
        name: "Taste with peach",
        done: f.developed,
        why:
          opens("menu-garden-oolong", 22) || (live ? shut : "") ||
          (f.sampleUntil <= c.day ? "The sample keeps for " + GARDEN_FEATURE.sampleDays + " days; harvest a fresh one." : "") ||
          (stock(c, GARDEN_FEATURE.pairing[1]) < 1 ? "Buy a peach for the tasting." : ""),
        key: "Taste it",
        run: () => action("develop-garden-blend"),
      },
      {
        id: "machine-garden-calibration",
        name: "Calibrate a brew machine",
        done: !!f.calibratedMachine,
        why:
          opens("machine-garden-calibration", 23) || shut ||
          (!precision ? "Fit the precision head in the Workshop's upgrades." : "") ||
          (!machine ? "Fit a steeping brew machine set to run itself." : "") ||
          (c.cash < calibration ? "This needs " + money(calibration) + " in the till." : ""),
        key: "Calibrate, " + money(calibration),
        run: () => action("calibrate-garden-brew", { id: machine?.[0] }),
      },
      {
        id: "crew-garden-service",
        name: "Train a prep employee",
        done: !!f.trainedStaff,
        why:
          opens("crew-garden-service", 24) || shut ||
          (!prep.length ? "Put an employee on the prep counter here." : "") ||
          (!trainee ? "They need two shifts behind them and 45 energy." : "") ||
          (c.cash < training ? "This needs " + money(training) + " in the till." : ""),
        key: trainee ? "Train " + trainee.name + ", " + money(training) : "Train, " + money(training),
        run: () => action("train-garden-service", { id: trainee?.id }),
      },
      {
        id: "room-garden-feature",
        name: "Put it on the menu",
        done: f.listed,
        why: opens("room-garden-feature", 25) || shut || (!trainedOnDuty ? "The trained employee isn't on today's rota." : ""),
        key: "List the house tea",
        run: () => action("list-garden-feature", { value: true }),
      },
    ];
  });
  const next = $derived(steps.find((s) => !s.done));

  // A step done while the page is open flashes once.
  let before: boolean[] = [];
  let fresh = $state<string[]>([]);
  $effect(() => {
    const now = steps.map((s) => s.done);
    const changed = before.length ? steps.filter((s, i) => s.done && !before[i]).map((s) => s.id) : [];
    before = now;
    if (changed.length) {
      fresh = [];
      queueMicrotask(() => (fresh = changed));
    }
  });
</script>

<section class="house-tea" aria-label="House tea">
  <div class="bk-cap"><OrderPixelWord text="House tea" cells={2} /><span class="bk-meta">Garden Tea Room</span></div>
  <ol class="chain">
    {#each steps as step, i (step.id)}
      {@const icon = upgradeSprite(step.id)}
      <li class="bk-tile step" class:done={step.done} class:is-hot={step === next} class:later={!step.done && step !== next} class:ou-gain={fresh.includes(step.id)}>
        <span class="pic">{#if icon}<PixelIcon grid={[...icon.grid]} palette={icon.palette} px={2} />{/if}</span>
        <span class="bk-name">{step.name}</span>
        <span class="sr-only">{step.done ? ", done" : step === next ? ", next" : ""}</span>
        {#if step.done}<svg class="tick" viewBox="0 0 7 6" aria-hidden="true" shape-rendering="crispEdges"
            ><path d="M6 0h1v2H6v1H5v1H4v1H3v1H2V5H1V4H0V2h1v1h1v1h1V3h1V2h1V1h1z" /></svg
          >{/if}
        {#if i < steps.length - 1}<i class="link" aria-hidden="true"></i>{/if}
      </li>
    {/each}
  </ol>
  <div class="next" aria-live="polite">
    {#if next}
      {#if next.why}<p>{next.why}</p>{:else if next.key && next.run}
        <button type="button" class="boba-key is-primary" onclick={next.run}>{next.key}</button>
      {/if}
    {:else}
      <p>The house tea is listed. Offer it to one guest a shift at the counter.</p>
    {/if}
  </div>
</section>

<style>
  .house-tea {
    display: grid;
    gap: 10px;
  }

  .chain {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 14px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .house-tea .bk-tile.step {
    position: relative;
    gap: 6px;
    padding: 10px 6px;
    overflow: visible;
  }

  .pic {
    display: grid;
    place-items: center;
    height: 34px;
  }

  .house-tea .step .bk-name {
    display: grid;
    place-items: center;
    min-height: 30px;
    font-size: 12px;
    text-align: center;
  }

  .step.later .pic {
    opacity: 0.4;
  }

  .tick {
    position: absolute;
    right: 7px;
    bottom: 7px;
    width: 12px;
    height: 10px;
    fill: #9aa86a;
  }

  /* The wire from one step to the next, through the gap between tiles. */
  .link {
    position: absolute;
    top: 50%;
    right: -14px;
    width: 14px;
    height: 3px;
    background: var(--lg-line);
  }

  .step.done .link {
    background: #9aa86a;
  }

  .next {
    display: flex;
    align-items: center;
    min-height: 44px;
  }

  .next .boba-key {
    min-height: 40px;
    padding-inline: 16px;
  }

  .next p {
    margin: 0;
    color: var(--lg-muted);
    font-size: 13px;
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
