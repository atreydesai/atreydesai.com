<script lang="ts">
  // The counter the chef stands at: its painted close-up with the drink on
  // the mat, the order slip, the skill being worked, and the one primary key
  // that does the next thing. Nothing here explains the game; the slip and
  // the key say what is next.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import type { Shift } from "#lib/arcade/order-up/engine/shift-types.ts";
  import type { Station } from "#lib/arcade/order-up/content/schema.ts";
  import { selectedTicket, activeCup, currentSkill } from "#lib/arcade/order-up/engine/shift.ts";
  import { SKILLS, RECIPE_BY_ID, INGREDIENT_BY_ID, INGREDIENTS, GUEST_BY_ID } from "#lib/arcade/order-up/content/index.ts";
  import { skillMastery } from "#lib/arcade/order-up/engine/skill-setup.ts";
  import { stock } from "#lib/arcade/order-up/engine/pantry.ts";
  import { BEHAVIORS, type SkillAction } from "#lib/arcade/order-up/skills/index.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import type { Lesson } from "#lib/arcade/core/coach.ts";
  import { memoryChoices, canOfferGardenFeature } from "#lib/arcade/order-up/engine/guest-actions.ts";
  import OrderStationArt from "../OrderStationArt.svelte";
  import OrderKitchenItem from "../OrderKitchenItem.svelte";
  import OrderPixelWord from "../OrderPixelWord.svelte";
  import CupArt from "./CupArt.svelte";
  import Cup from "./Cup.svelte";
  import Icon from "./Icon.svelte";
  import Ingredient from "./Ingredient.svelte";
  import Mark from "./Mark.svelte";
  import OrderSlip from "./OrderSlip.svelte";

  export let campaign: Campaign;
  export let shift: Shift | null;
  export let paused = false;
  export let lesson: Lesson | null = null;
  export let reduced = false;
  export let primary: (hold?: boolean) => void = () => {};
  export let release: () => void = () => {};
  export let action: (a: SkillAction) => void = () => {};
  export let guestAction: (name: string, id?: string) => void = () => {};
  export let inspect: () => void = () => {};
  export let cupSelect: (index: number) => void = () => {};

  const benches: Record<Station, string> = {
    brew: "Brew stove",
    prep: "Prep counter",
    build: "Build island",
    serve: "Serve pass",
    stock: "Stockroom",
  };
  const legacyIngredients = ["milk", "oat", "pearls", "popping", "pudding", "grass-jelly", "strawberry", "banana", "mango",
    "yuzu", "brown-sugar", "honey", "vanilla", "sesame-syrup", "bun", "waffle", "seltzer"];
  // The meter is drawn on a 96 by 24 cell board.
  const W = 96;

  let board: SVGSVGElement | undefined;
  let dragging = false;

  let station: Station = "brew";
  $: station = shift?.chefStation ?? "brew";
  $: ticket = shift ? selectedTicket(shift) : null;
  $: cup = ticket ? activeCup(ticket) : null;
  $: hidden = !!ticket?.usual && !ticket.revealed;
  $: recipe = cup ? RECIPE_BY_ID[cup.recipe] : null;
  $: run = cup?.run ?? null;
  $: skill = SKILLS.find((k) => k.id === (cup ? currentSkill(cup) : null));
  $: behavior = run ? BEHAVIORS[run.id] : null;
  $: elsewhere = !!skill && !!shift && shift.chefStation !== skill.station;
  $: today = calendar(campaign.day);
  $: unlocked = legacyIngredients.filter((id) => (INGREDIENT_BY_ID[id]?.day ?? 99) <= campaign.day);
  $: shown = cup && recipe && !hidden ? cup.step + (run ? Math.min(0.9, run.position) : 0) : 0;
  $: spin = cup?.ready && !reduced && shift ? ((Math.floor(shift.realElapsed * 4) % 48) * Math.PI) / 24 : 0;
  $: working = run && !run.finished ? run.id : null;
  let finish: "shake" | "seal" | "foam" | null = null;
  $: finish = working === "shake" ? "shake" : working === "seal" ? "seal" : working === "cheese-foam" ? "foam" : null;
  $: ready = !!ticket && ticket.cups.every((c) => c.ready);
  // The house tea can be offered to one fresh, single-cup guest a shift where it is listed (the engine's own check).
  $: offerSlot = shift ? shift.tickets.findIndex((t) => !!t && canOfferGardenFeature(campaign, shift!, t.slot)) : -1;
  $: offerTo = offerSlot >= 0 ? shift!.tickets[offerSlot] : null;
  $: waitingForCourier = ready && !!ticket?.pickupAt && !!shift && shift.elapsed < ticket.pickupAt;

  $: label = (() => {
    if (!shift) return "Open the shop";
    if (!ticket) return "Waiting for a guest";
    if (ticket.sleeping) return "Wake them";
    if (ticket.special === "cat") return "Pour some milk";
    if (ticket.changeTo) return "Make the new drink";
    if (hidden) return "Check the album";
    if (waitingForCourier) return "Courier in " + Math.ceil(ticket.pickupAt! - shift.elapsed) + " seconds";
    if (ready) return ticket.packed ? "Pack and send" : "Hand off";
    if (elsewhere) return "Go to " + skill!.station;
    if (shift.walking > 0) return "Walking";
    if (cup?.warmup) return "Warming";
    if (!run) return "Start";
    if (skill?.input === "hold") return run.held ? "Let go" : "Hold";
    if (skill?.input === "drag") return "Done drawing";
    if (run.variant === "quick") return cap(skill?.steps[0] ?? "Press");
    if (skill?.input === "pick") return "Done";
    if (skill?.input === "knob") return "Choose one";
    if (skill?.input === "sequence") return cap(skill.steps[run.hits.length] ?? "Press");
    return cap(skill?.steps[0] ?? "Press");
  })();
  $: disabled =
    paused ||
    (!!shift && (!ticket || shift.walking > 0 || !!cup?.warmup || waitingForCourier)) ||
    (!!run && run.variant === "hand" && skill?.input === "knob");
  // How close the step in hand is to being one press, from good hand runs.
  $: mastery = skill ? skillMastery(campaign, skill.id as Parameters<typeof skillMastery>[1]) : null;
  // Toppings the shop knows, for the build counter's keys.
  $: toppings = INGREDIENTS.filter((i) => i.group === "topping" && i.day <= campaign.day);
  $: wantedIds = run ? [...new Set(run.wanted)] : [];
  const count = (list: readonly string[], id: string) => list.filter((x) => x === id).length;
  // How far a warming step has come, from the longest wait it showed.
  const warmups = new WeakMap<object, number>();
  $: warm = cup?.warmup ?? 0;
  $: if (cup && warm > (warmups.get(cup) ?? 0)) warmups.set(cup, warm);
  $: warmth = cup && warm > 0 ? 1 - warm / (warmups.get(cup) || warm) : 0;

  function cap(text: string) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function guestName(id: string) {
    return GUEST_BY_ID[id]?.name ?? id;
  }

  const cell = (value: number) => 4 + Math.round(value * (W - 8));

  function point(event: PointerEvent) {
    if (!board || !run || skill?.input !== "drag" || paused || lesson) return;
    const rect = board.getBoundingClientRect();
    action({ type: "point", x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height });
  }

  function keyDown(event: PointerEvent) {
    if (disabled) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    primary(skill?.input === "hold");
  }

  function keyUp() {
    if (skill?.input === "hold") release();
  }
</script>

<section class="counter boba-chip" aria-labelledby="counter-heading">
  <header class="counter-plaque">
    <h2 id="counter-heading">
      <OrderKitchenItem kind={station} size={22} />
      <span class="sr-only">{benches[station]}</span>
      <OrderPixelWord text={benches[station]} cells={1} />
    </h2>
  </header>

  <div class="bench">
    <OrderStationArt
      {station}
      showCup={false}
      tea={null}
      active={!paused && !reduced}
      branch={campaign.expansion.activeShop}
      weather={today.weather === "rain" ? "rain" : today.weather === "night" ? "festival" : "neighborhood"}
      daylight={shift ? shift.elapsed / shift.duration : 0}
      ingredientUnlocked={unlocked}
      milkUnlocked={unlocked.filter((id) => id === "milk" || id === "oat")}
      stockUnlocked={campaign.day >= 3}
      pearlCooking={working === "pearl-pot"}
      pearlProgress={working === "pearl-pot" ? (warm > 0 ? warmth : (run?.position ?? 0)) : 0}
      waffleAvailable={campaign.day >= 13}
      waffleCooking={working === "egg-waffle"}
      waffleProgress={working === "egg-waffle" ? (warm > 0 ? warmth : (run?.position ?? 0)) : 0}
      {finish}
    />
    {#if recipe && cup}
      <svg class="bench-cup" viewBox="0 0 900 344" aria-hidden="true">
        <CupArt
          recipe={hidden ? "usual-mochi" : recipe.id}
          steps={hidden ? 0 : shown}
          turn={spin}
          damage={cup.damage}
          x={station === "brew" ? 468 : 454}
          y={279}
          scale={4.45}
          shaking={working === "shake" && !reduced}
        />
      </svg>
      {#if hidden}<span class="unknown"><Mark kind="question" size={26} /></span>{/if}
      {#if ticket && ticket.cups.length > 1}
        <div class="cup-choices" role="group" aria-label="Cups in this order">
          {#each ticket.cups as item, i (i)}
            <button
              type="button"
              class="boba-key"
              class:is-down={ticket.cupIndex === i}
              aria-pressed={ticket.cupIndex === i}
              aria-label={"Cup " + (i + 1) + (item.ready ? ", ready" : "")}
              onclick={() => cupSelect(i)}
              >{i + 1}{#if item.ready}<Mark kind="check" size={10} />{/if}</button
            >
          {/each}
        </div>
      {/if}
      {#if cup.ready}<span class="ready-stamp">ready</span>{/if}
    {/if}
  </div>

  <!-- A first-use tip opens just above the slip, over the painting, so the order and the meter stay in view. -->
  <div class="slip-row" data-lesson-anchor><OrderSlip {ticket} {cup} {hidden} /></div>

  <div class="skill-area">
    {#if offerTo}
      <button type="button" class="boba-key offer" disabled={paused || !!lesson} onclick={() => guestAction("offer", String(offerSlot))}
        >Offer {offerTo.name} the house tea</button
      >
    {/if}
    {#if ticket && cup && ticket.changeTo}
      <p>{ticket.name} would like a {RECIPE_BY_ID[ticket.changeTo].name} instead.</p>
      <div class="choices">
        <button type="button" class="boba-key" disabled={paused || !!lesson} onclick={() => guestAction("accept")}
          >Make the new drink</button
        >
        <button type="button" class="boba-key" disabled={paused || !!lesson} onclick={() => guestAction("keep")}
          >Keep this one</button
        >
      </div>
    {:else if ticket && cup && hidden}
      <p>{ticket.memoryGuest ? `${ticket.name} wants ${guestName(ticket.memoryGuest)}'s usual.` : `${ticket.name} wants the usual.`}</p>
      <div class="memory">
        {#each memoryChoices(campaign, ticket) as option (option.id)}
          <button
            type="button"
            class="boba-key"
            disabled={paused || !!lesson}
            onclick={() => guestAction("remember", option.id)}
            title={option.name}
          >
            <Cup recipe={option.id} steps={99} size={34} />
            <span>{option.name}</span>
          </button>
        {/each}
      </div>
      <button type="button" class="album-key" disabled={paused || !!lesson} onclick={inspect}
        >Check the album (costs 3 seconds of patience)</button
      >
    {:else if ticket && cup && run && !cup.warmup && skill && !elsewhere}
      {#if run.variant === "quick"}
        <!-- A mastered step is one press; the player may still time it for the top grade. -->
        <div class="quick">
          <span class="mastered"><Mark kind="check" size={12} />Mastered</span>
          <button type="button" class="boba-key is-small" disabled={paused || !!lesson} onclick={() => action({ type: "precision" })}
            >Time it for top grade</button
          >
        </div>
      {:else if skill.input === "pick"}
        <div class="pick">
          <ul class="wanted" aria-label="Toppings in this cup">
            {#each wantedIds as id (id)}
              {@const want = count(run.wanted, id)}
              {@const got = count(run.added, id)}
              <li data-id={id} data-left={want - got} class:is-done={got >= want} class:is-over={got > want}>
                <Ingredient {id} size={22} /><span>{got}/{want}</span>
              </li>
            {/each}
          </ul>
          <div class="topping-keys" role="group" aria-label="Add a topping">
            {#each toppings as t (t.id)}
              <button
                type="button"
                class="boba-key is-small"
                data-id={t.id}
                class:is-wanted={count(run.wanted, t.id) > count(run.added, t.id)}
                disabled={paused || !!lesson}
                aria-label={"Add " + t.name + ", " + stock(campaign, t.id) + " in stock"}
                onclick={() => action({ type: "add", id: t.id })}
                ><Ingredient id={t.id} size={18} /><span>{t.name}</span></button
              >
            {/each}
          </div>
        </div>
      {:else if skill.input === "knob"}
        {@const options = run.choices.length ? run.choices : ["80°", "90°", "100°"]}
        <div class="knob" role="group" aria-label={skill.name}>
          {#each options as option, i (option)}
            <button
              type="button"
              class="boba-key"
              class:is-target={run.knobTarget === i}
              aria-pressed={run.knob === i}
              disabled={paused || !!lesson && run.knobTarget !== i}
              onclick={() => action({ type: "choose", index: i })}>{option}</button
            >
          {/each}
        </div>
      {:else if skill.input === "drag"}
        <svg
          bind:this={board}
          class="draw-board"
          viewBox="0 0 96 48"
          role="img"
          aria-label={skill.name + ": draw along the chalk"}
          onpointerdown={(e) => {
            e.preventDefault();
            dragging = true;
            board?.setPointerCapture(e.pointerId);
            point(e);
          }}
          onpointermove={(e) => dragging && point(e)}
          onpointerup={(e) => {
            if (dragging) point(e);
            dragging = false;
          }}
          onpointercancel={() => (dragging = false)}
          shape-rendering="crispEdges"
        >
          <rect width="96" height="48" fill="#241d20" />
          {#each behavior?.guide ?? [] as p, i (i)}
            <rect x={Math.round(p.x * 92) + 1} y={Math.round(p.y * 44) + 1} width="2" height="2" fill="#bba889" />
          {/each}
          {#each run.path as p, i (i)}
            <rect x={Math.round(p.x * 92)} y={Math.round(p.y * 44)} width="3" height="3" fill={skill.art.color} />
          {/each}
          <path
            d="M{Math.round(run.cursor.x * 92) - 2} {Math.round(run.cursor.y * 44) -
              2}h2v1h-1v1h-1zm6 0h-2v1h1v1h1zm-6 6h2v-1h-1v-1h-1zm6 0h-2v-1h1v-1h1z"
            fill="#fff1dd"
          />
        </svg>
      {:else}
        {@const marks =
          skill.input === "rhythm" || skill.input === "sequence" ? (behavior?.marks ?? [0.18, 0.38, 0.58, 0.78]) : []}
        <svg
          class="meter"
          viewBox="0 0 96 24"
          role="img"
          aria-label={`${skill.name}: at ${Math.round(run.position * 100)}, aim for ${Math.round(run.target * 100)}`}
          shape-rendering="crispEdges"
        >
          <rect x="0" y="6" width="96" height="14" fill="#1f191c" />
          <rect x="2" y="8" width="92" height="10" fill="#3a2f2e" />
          {#if marks.length}
            {#each marks as mark, i (i)}
              <rect
                x={cell(mark) - 2}
                y="8"
                width="4"
                height="10"
                fill={i < run.hits.length ? "#8aa37a" : i === run.hits.length ? "#e0b673" : "#6b5850"}
              />
            {/each}
          {:else}
            <rect
              x={cell(Math.max(0, run.target - run.window))}
              y="8"
              width={Math.max(2, cell(Math.min(1, run.target + run.window)) - cell(Math.max(0, run.target - run.window)))}
              height="10"
              fill="#7f9a72"
            />
          {/if}
          {#if skill.input === "hold"}<rect
              x="2"
              y="12"
              width={Math.max(0, cell(run.position) - 2)}
              height="2"
              fill="#e8c28a"
            />{/if}
          <rect x={cell(run.position) - 1} y="4" width="2" height="18" fill="#fff1dd" />
          {#if lesson && !marks.length}
            {@const from = cell(Math.max(0, run.target - run.window)) - 3}
            {@const to = cell(Math.min(1, run.target + run.window)) + 3}
            <path
              d="M{from} 3h4v1h-3v3h-1zM{to} 3h-4v1h3v3h1zM{from} 23h4v-1h-3v-3h-1zM{to} 23h-4v-1h3v-3h1z"
              fill="#e85d4c"
            />
          {/if}
        </svg>
        {#if skill.input === "sequence"}
          <ol class="sequence" aria-label="Moves">
            {#each skill.steps as move, i (i)}<li class:is-done={i < run.hits.length} class:is-now={i === run.hits.length}>
                {move}
              </li>{/each}
          </ol>
        {/if}
      {/if}
    {:else if ticket && cup && skill && !cup.ready}
      <!-- Before a step starts, and while it warms, its meter waits empty, so nothing moves when it begins. -->
      <svg class="meter is-idle" viewBox="0 0 96 24" aria-hidden="true" shape-rendering="crispEdges">
        <rect x="0" y="6" width="96" height="14" fill="#1f191c" />
        <rect x="2" y="8" width="92" height="10" fill="#3a2f2e" />
        {#if warmth > 0}<rect x="2" y="8" width={Math.round(92 * warmth)} height="10" fill="#6e5848" />{/if}
      </svg>
    {/if}
    {#if run && run.variant === "hand" && mastery && !mastery.mastered && !cup?.warmup && !elsewhere}
      <span class="mastery" role="img" aria-label={mastery.goodRuns + " of " + mastery.required + " good runs to make this step one press"}
        >{#each Array.from({ length: mastery.required }) as _, i (i)}<i class:is-on={i < mastery.goodRuns}></i>{/each}</span
      >
    {/if}
    <span class="result" aria-live="polite">
      {#if !lesson && shift?.lastMark && shift.realElapsed - shift.lastMark.time < 1.6}
        {#key shift.lastMark.time}<b class="ou-arrive" class:is-perfect={shift.lastMark.grade >= 98}
            >{shift.lastMark.grade >= 98 ? "Perfect" : shift.lastMark.grade < 60 ? "Off" : "Good"}</b
          >{/key}
      {/if}
    </span>
  </div>

  <footer class="primary-row">
    <span class="flow" role="img" aria-label={"Flow " + (shift?.flow ?? 0) + " of 5"}
      >{#each [1, 2, 3, 4, 5] as pip (pip)}<i class:is-on={(shift?.flow ?? 0) >= pip}></i>{/each}</span
    >
    <button
      type="button"
      class="boba-key is-primary primary-key"
      class:is-down={!!run?.held}
      {disabled}
      aria-keyshortcuts="Space"
      onclick={(e) => {
        if (e.detail === 0 && !disabled) primary(false);
      }}
      onpointerdown={keyDown}
      onpointerup={keyUp}
      onpointercancel={keyUp}
      onkeyup={(e) => e.key === " " && e.preventDefault()}
      >{#if warmth > 0}<i class="warming" style:width="{warmth * 100}%" aria-hidden="true"></i>{/if}<span>{label}</span><kbd
        aria-hidden="true">Space</kbd
      ></button
    >
  </footer>
</section>

<style>
  .counter {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 0;
    overflow: hidden;
    color: #fff0d6;
    background: #392b2b;
    box-shadow:
      inset 0 3px #966754,
      inset 0 -4px #211c21;
  }

  .counter-plaque {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: 38px;
    padding: 4px var(--space-3);
  }

  .counter-plaque h2 {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    color: #ffe7b8;
    line-height: 1;
  }

  /* On a short window the painting gives up height first, so the slip and the key always show. */
  .bench {
    position: relative;
    flex: 0 1 auto;
    min-height: 7rem;
    aspect-ratio: 900 / 344;
    margin: 0 6px;
    overflow: hidden;
    background: #6b5048;
  }

  .bench > :global(.station-art),
  .bench-cup {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .unknown {
    position: absolute;
    left: 51%;
    top: 50%;
    display: grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    transform: translate(-50%, -50%);
    background: #3b2826;
    color: #ffe7b8;
    clip-path: var(--notch);
  }

  .cup-choices {
    position: absolute;
    left: 6px;
    top: 6px;
    display: flex;
    gap: 3px;
  }

  .cup-choices .boba-key {
    min-width: 2.25rem;
    min-height: 2rem;
    gap: 3px;
    padding: 2px 6px;
    font-size: 0.75rem;
  }

  .ready-stamp {
    position: absolute;
    right: 12%;
    bottom: 22%;
    padding: 3px 8px;
    border: 2px solid #5f7a5e;
    color: #4d664c;
    background: rgb(255 241 214 / 0.9);
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    transform: rotate(-6deg);
  }

  .sequence {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .skill-area {
    position: relative;
    display: grid;
    flex: 1;
    align-content: center;
    gap: var(--space-2);
    min-height: 4.5rem;
    padding: var(--space-2) var(--space-3);
  }

  .skill-area p {
    margin: 0;
    color: #fff0d6;
    font-size: 0.875rem;
    line-height: 1.4;
  }

  .meter,
  .draw-board {
    display: block;
    width: 100%;
    image-rendering: pixelated;
  }

  .meter {
    max-height: 4.5rem;
  }

  /* Every key in the skill area stands at a hand's height, whatever row it sits in. */
  .skill-area .boba-key {
    min-height: 36px;
    padding-inline: 12px;
  }

  .quick {
    display: grid;
    justify-items: center;
    gap: 10px;
  }

  .mastered {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #c7d39a;
    font-size: 0.8125rem;
    font-weight: 600;
  }

  .pick {
    display: grid;
    gap: 10px;
  }

  .wanted {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .wanted li {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    color: #e7c9a8;
    background: #2a2123;
    font-size: 0.8125rem;
    clip-path: var(--notch);
  }

  .wanted li.is-done {
    color: #e5efcf;
    background: #4c5d47;
  }

  .wanted li.is-over {
    background: #7a3a2e;
  }

  .topping-keys {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: 6px;
  }

  .topping-keys .boba-key {
    justify-content: flex-start;
    min-height: 36px;
    font-size: 0.75rem;
  }

  /* What the cup still wants is outlined, so the task reads at a glance. */
  .topping-keys .boba-key.is-wanted {
    --key-rule: #f0c482;
    box-shadow:
      inset 0 0 0 2px #f0c482,
      inset 0 -4px 0 var(--key-foot);
  }

  .topping-keys .boba-key span {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .mastery {
    display: flex;
    justify-content: center;
    gap: 3px;
  }

  .mastery i {
    width: 8px;
    height: 4px;
    background: #4b3a36;
  }

  .mastery i.is-on {
    background: #c7d39a;
  }

  .meter.is-idle {
    opacity: 0.7;
  }

  .offer {
    justify-self: center;
    min-height: 40px;
  }

  .draw-board {
    max-height: 9rem;
    cursor: crosshair;
    touch-action: none;
  }

  .sequence li {
    padding: 3px 8px;
    background: #2a2123;
    color: #b99d84;
    font-size: 0.75rem;
    clip-path: var(--notch);
  }

  .sequence li.is-done {
    background: #4c5d47;
    color: #e5efcf;
  }

  .sequence li.is-now {
    background: #f0c482;
    color: #372222;
  }

  .knob,
  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .knob {
    justify-content: center;
  }

  .knob .boba-key {
    min-width: 5.5rem;
    min-height: 40px;
  }

  .knob .boba-key[aria-pressed="true"] {
    --key-face: #eaceac;
    --key-foot: #b08060;
    --key-rule: #f0d8bc;
    color: #322621;
  }

  .knob .boba-key.is-target {
    box-shadow:
      inset 0 0 0 2px #e85d4c,
      inset 0 -4px var(--key-foot);
  }

  .memory {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
    gap: 4px;
  }

  .memory .boba-key {
    display: grid;
    justify-items: center;
    gap: 2px;
    min-height: 4.5rem;
    padding: 4px;
    font-size: 0.75rem;
    line-height: 1.15;
    text-align: center;
  }

  .album-key {
    justify-self: start;
    border: 0;
    padding: 2px 0;
    background: none;
    color: #f0c482;
    font: inherit;
    font-size: 0.8125rem;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .result {
    position: absolute;
    top: 4px;
    right: var(--space-3);
    min-height: 1rem;
    font-size: 0.8125rem;
  }

  .result b {
    color: #e7c9a8;
    font-weight: 500;
  }

  .result b.is-perfect {
    color: #f0c482;
  }

  .primary-row {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: 6px var(--space-3) 10px;
  }

  .flow {
    display: flex;
    gap: 3px;
  }

  .flow i {
    width: 8px;
    height: 12px;
    background: #4c3c39;
  }

  .flow i.is-on {
    background: #f0c482;
  }

  .primary-key {
    position: relative;
    flex: 0 1 15rem;
    justify-content: space-between;
    min-height: 48px;
    overflow: hidden;
  }

  /* A warming step fills the key's foot as it comes up to heat. */
  .warming {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 4px;
    background: #f0c482;
  }

  .slip-row {
    flex: none;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @media (max-width: 760px) {
    .counter {
      overflow: visible;
    }

    .skill-area {
      min-height: 5.5rem;
    }

    /* The primary key stays in reach above the tool belt while the page scrolls. */
    .primary-row {
      position: sticky;
      bottom: 3.75rem;
      z-index: 2;
      background: #392b2b;
      box-shadow: 0 -3px #2a2224;
    }

    .primary-key {
      flex-basis: 12rem;
    }
  }

  @media (orientation: landscape) and (max-height: 540px) {
    .counter {
      overflow-y: auto;
    }

    .counter-plaque {
      min-height: 34px;
      padding-block: 3px;
    }

    .bench {
      min-height: 0;
      aspect-ratio: auto;
      height: 18vh;
    }

    /* A phone on its side has room for the key, not the slip; the rail's ticket still shows the order. */
    .slip-row {
      display: none;
    }

    .skill-area {
      min-height: 3.5rem;
      padding-block: 4px;
    }

    .primary-row {
      padding-block: 2px 4px;
    }

    .primary-key {
      min-height: 38px;
    }
  }
</style>
