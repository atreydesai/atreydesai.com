<script lang="ts">
  // The left of the counter: the room, or whichever of the shop's places the
  // view picker has open. Each place is a painted scene with its controls
  // laid over the things they act on.
  import type { Campaign } from "#lib/arcade/orders-campaign.ts";
  import type { Shift } from "#lib/arcade/order-up/engine/shift-types.ts";
  import type { Activity } from "#lib/arcade/order-up/engine/activities.ts";
  import type { Station } from "#lib/arcade/order-up/content/schema.ts";
  import { SHOPS, VIEWS, DECOR } from "#lib/arcade/order-up/content/index.ts";
  import { STATIONS } from "#lib/arcade/order-up/engine/state.ts";
  import { selectedTicket, activeCup } from "#lib/arcade/order-up/engine/shift.ts";
  import RoomCanvas from "./RoomCanvas.svelte";
  import Portrait from "./Portrait.svelte";
  import Mark from "./Mark.svelte";
  import CupArt from "./CupArt.svelte";
  import OrderStationArt from "../OrderStationArt.svelte";
  import DeliveryView from "./views/DeliveryView.svelte";
  import GardenView from "./views/GardenView.svelte";
  import LabView from "./views/LabView.svelte";
  import ChoresView from "./views/ChoresView.svelte";
  import TasteoffView from "./views/TasteoffView.svelte";
  import StockroomView from "./views/StockroomView.svelte";
  import StreetView from "./views/StreetView.svelte";
  import WindowView from "./views/WindowView.svelte";
  import OfficeView from "./views/OfficeView.svelte";
  import MapView from "./views/MapView.svelte";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import { viewIcon } from "#lib/arcade/order-up/art/view-icons.ts";
  import "./views/view.css";

  export let campaign: Campaign;
  export let shift: Shift | null;
  export let view: string;
  export let paused: boolean;
  export let reduced: boolean;
  export let activity: Activity | null;
  export let taste: number[] | null;
  export let steering: number;
  export let weather: string;
  export let selectedStation: Station;
  export let changeView: (id: string) => void;
  export let chooseTicket: (slot: number) => void;
  export let openBook: (tab: string) => void;
  export let action: (name: string, data?: any) => void;
  /** A decor piece to have picked when arranging opens ("id#n", new each time). */
  export let arrangeFocus = "";

  $: shop = SHOPS.find((s) => s.id === campaign.expansion.activeShop)!;
  $: owned = campaign.expansion.shops[shop.id];
  $: views = VIEWS.filter((v) => v.day <= campaign.day);
  $: crew = campaign.expansion.staff.filter((p) => p.shop === shop.id && p.rota[(campaign.day - 1) % 7]);
  $: live = !!shift;
  $: ticket = shift ? selectedTicket(shift) : null;
  $: cup = ticket ? activeCup(ticket) : null;

  let staffPicked = "";
  let arrangePicked: Station = "brew";
  let decorPicked = "";
  let seenFocus = "";
  $: if (arrangeFocus !== seenFocus) {
    seenFocus = arrangeFocus;
    if (arrangeFocus) decorPicked = arrangeFocus.split("#")[0];
  }

  // Arranging moves a counter or a piece of decor: one list to step through.
  $: movable = [
    ...STATIONS.map((id) => ({ kind: "counter" as const, id })),
    ...[...campaign.expansion.decor, ...campaign.expansion.keepsakes]
      .filter((id) => ["decor", "keepsake"].includes(DECOR.find((x) => x.id === id)?.kind ?? ""))
      .map((id) => ({ kind: "decor" as const, id })),
  ];
  function stepMover(by: number) {
    const at = movable.findIndex((m) => (decorPicked ? m.kind === "decor" && m.id === decorPicked : m.kind === "counter" && m.id === arrangePicked));
    const next = movable[(at + by + movable.length) % movable.length];
    if (next.kind === "counter") {
      decorPicked = "";
      arrangePicked = next.id as Station;
    } else decorPicked = next.id;
  }

  function chooseStation(id: string) {
    if (staffPicked) {
      action("assign", { id: staffPicked, station: id });
      staffPicked = "";
    } else action("station", { id });
  }
</script>

<section class="world boba-chip" aria-label={views.find((v) => v.id === view)?.name ?? "room"}>
  <header class="world-plaque">
    <h2>
      {shop.name}<span class="here">{views.find((v) => v.id === view)?.name ?? "room"}</span>
      <span class="stars" role="img" aria-label={owned.stars + " of 5 stars"}
        >{#each [1, 2, 3, 4, 5] as n (n)}<span class:is-on={owned.stars >= n}><Mark kind="star" size={9} /></span>{/each}</span
      >
    </h2>
    <nav class="places" aria-label="Places">
      {#each views as v (v.id)}
        {@const icon = viewIcon(v.id)}
        <button
          type="button"
          class="place"
          class:is-here={view === v.id}
          aria-pressed={view === v.id}
          aria-label={v.name}
          title={v.name}
          data-view={v.id}
          onclick={() => changeView(v.id)}><PixelIcon grid={icon.grid} palette={icon.palette} px={2} /></button
        >
      {/each}
      <kbd aria-hidden="true">V</kbd>
    </nav>
  </header>

  <div class="world-body">
    {#if view === "room"}
      <div class="ou-view">
        <div class="ou-stage room-stage">
          <RoomCanvas {campaign} {shift} station={selectedStation} {weather} {paused} {reduced} choose={chooseStation} {chooseTicket} />
          {#if shift?.gull.active}
            <button type="button" class="boba-key gull" onclick={() => action("shoo")}>Shoo the gull</button>
          {/if}
        </div>
        <div class="ou-keys crew" role="group" aria-label="Crew on duty">
            {#each crew as person (person.id)}
              <button
                type="button"
                class="boba-key"
                class:is-down={staffPicked === person.id}
                aria-pressed={staffPicked === person.id}
                draggable="true"
                ondragstart={(e) => e.dataTransfer?.setData("crew", person.id)}
                onclick={() => (staffPicked = staffPicked === person.id ? "" : person.id)}
                title={staffPicked === person.id ? "Choose a counter for " + person.name : person.name}
              >
                <Portrait name={person.portrait} size={22} />
                <span>{person.name}{person.station ? ", " + person.station : ""}</span>
              </button>
            {/each}
          </div>
      </div>
    {:else if view === "station"}
      <div class="ou-view">
        <div class="ou-stage">
          <div class="station-frame">
            <OrderStationArt
              station={selectedStation}
              showCup={false}
              tea={null}
              active={!paused && !reduced}
              branch={shop.id}
              weather={weather === "rain" ? "rain" : weather === "night" ? "festival" : "neighborhood"}
              daylight={shift ? shift.elapsed / shift.duration : 0}
              stockUnlocked={campaign.day >= 3}
            />
            {#if cup}
              <svg class="station-cup" viewBox="0 0 900 344" aria-hidden="true">
                <CupArt recipe={cup.recipe} steps={cup.ready ? 99 : cup.step} x={selectedStation === "brew" ? 468 : 454} y={279} scale={4.45} />
              </svg>
            {/if}
          </div>
        </div>
        <div class="ou-keys">
          {#each STATIONS as id, i (id)}
            <button type="button" class="boba-key" class:is-down={selectedStation === id} aria-pressed={selectedStation === id} onclick={() => chooseStation(id)}
              >{id}<kbd aria-hidden="true">{i + 1}</kbd></button
            >
          {/each}
        </div>
      </div>
    {:else if view === "window"}
      <WindowView {campaign} {shift} {weather} {reduced} {paused} {action} {chooseTicket} />
    {:else if view === "street"}
      <StreetView {campaign} {shift} {weather} {reduced} {paused} {action} />
    {:else if view === "stockroom"}
      <StockroomView {campaign} {shift} {action} {openBook} />
    {:else if view === "office"}
      <OfficeView {campaign} {shift} {openBook} />
    {:else if view === "map"}
      <MapView {campaign} {shift} {action} {openBook} />
    {:else if view === "delivery"}
      <DeliveryView {campaign} {shift} {activity} {steering} {weather} {paused} {reduced} {action} />
    {:else if view === "garden"}
      <GardenView {campaign} {shift} {live} {paused} {reduced} {action} />
    {:else if view === "lab"}
      <LabView {campaign} {shift} {live} {taste} {action} />
    {:else if view === "chores"}
      <ChoresView {campaign} {shift} {activity} {paused} {reduced} {action} />
    {:else if view === "tasteoff"}
      <TasteoffView {campaign} {shift} {live} {activity} {paused} {reduced} {action} />
    {:else if view === "arrange"}
      <div class="ou-view">
        <div class="ou-stage room-stage">
<RoomCanvas
            {campaign}
            {shift}
            station={arrangePicked}
            {weather}
            {paused}
            {reduced}
            arrange={true}
            moving={decorPicked ? (DECOR.find((d) => d.id === decorPicked)?.name ?? "decor") : arrangePicked + " counter"}
            choose={(id) => {
              arrangePicked = id as Station;
              decorPicked = "";
            }}
            chooseTicket={() => {}}
            move={(x, y) => (decorPicked ? action("place-decor", { id: decorPicked, x, y }) : action("move-counter", { id: arrangePicked, x, y }))}
          />
        </div>
        <div class="ou-keys">
          <div class="mover" role="group" aria-label="What to move">
            <button type="button" class="boba-key" aria-label="Previous" onclick={() => stepMover(-1)}>‹</button>
            <span class="mover-name">{decorPicked ? (DECOR.find((d) => d.id === decorPicked)?.name ?? "") : arrangePicked[0].toUpperCase() + arrangePicked.slice(1) + " counter"}</span>
            <button type="button" class="boba-key" aria-label="Next" onclick={() => stepMover(1)}>›</button>
          </div>
          <p class="ou-note arrange-note">Pick a floor tile to move it there.</p>
        </div>
      </div>
    {/if}
  </div>
</section>

<style>
  .world {
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

  .world-plaque {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: 44px;
    padding: 6px var(--space-3);
  }

  .world-plaque h2 {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    margin: 0;
    overflow: hidden;
    color: #ffe7b8;
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .stars {
    display: inline-flex;
    gap: 2px;
    color: #6b5850;
  }

  .stars .is-on {
    color: #f0c482;
  }

  .here {
    color: #b99a80;
    font-weight: 400;
  }

  .here::before {
    content: "·";
    margin: 0 6px;
    color: #7d6358;
  }

  .places {
    display: flex;
    flex: none;
    align-items: center;
    gap: 3px;
    max-width: 62%;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .place {
    display: grid;
    flex: none;
    place-items: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 0;
    background: #2a2224;
    box-shadow:
      inset 0 2px #4d3a36,
      inset 0 -2px #1d181b;
    clip-path: var(--notch);
    cursor: pointer;
    opacity: 0.78;
    transition: background-color 120ms steps(2, end), opacity 120ms steps(2, end);
  }

  .place :global(svg) {
    width: 22px;
    height: 22px;
  }

  .place.is-here {
    background: #f0c482;
    box-shadow:
      inset 0 2px #ffe3a5,
      inset 0 -2px #ad6b4d;
    opacity: 1;
  }

  .place:focus-visible {
    outline: 2px solid #ffe0a8;
    outline-offset: -2px;
  }

  @media (hover: hover) {
    .place:not(.is-here):hover {
      background: #3b2f2f;
      opacity: 1;
    }
  }

  .places kbd {
    display: grid;
    place-items: center;
    min-width: 18px;
    height: 18px;
    margin-left: 3px;
    padding: 0 4px;
    border: 0;
    background: #6c4a3f;
    color: #ffe7b8;
    font: 500 0.6875rem/1 var(--font-ui);
  }

  /* Every place keeps one control row of the same height, so switching
     places or picking options never rescales the picture above it. */
  .world-body :global(.ou-keys) {
    flex: none;
    box-sizing: border-box;
    height: 60px;
    overflow-x: auto;
    overflow-y: hidden;
    flex-wrap: nowrap;
    scrollbar-width: none;
  }

  .world-body {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    margin: 0 6px 6px;
    background: #2c2629;
  }

  .station-frame {
    position: relative;
    width: min(100cqw, calc(100cqh * 900 / 344));
    aspect-ratio: 900 / 344;
  }

  .station-frame > :global(.station-art),
  .station-cup {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .gull {
    position: absolute;
    top: 10px;
    right: 10px;
  }

  .crew .boba-key {
    gap: 6px;
    min-height: 40px;
    padding: 2px 10px 2px 4px;
    font-size: 0.75rem;
  }

  /* The name has a fixed width, so stepping through names of different
     lengths never moves a key. */
  .mover {
    display: flex;
    flex: none;
    align-items: center;
    gap: 6px;
  }

  /* The line takes what the stepper leaves and wraps to two lines on a phone. */
  .ou-keys .arrange-note {
    flex: 1 1 0;
    min-width: 0;
    white-space: normal;
  }

  .mover-name {
    width: 10rem;
    overflow: hidden;
    color: #ffe7b8;
    font-size: 0.8125rem;
    text-align: center;
    white-space: nowrap;
    text-overflow: ellipsis;
  }


  @media (max-width: 560px) {
    .mover-name {
      width: 7rem;
    }
  }

  @media (pointer: coarse) {
    .places kbd {
      display: none;
    }
  }

  @media (orientation: landscape) and (max-height: 540px) {
    .world-plaque {
      min-height: 34px;
      padding-block: 2px;
    }

    .place {
      width: 26px;
      height: 26px;
    }
  }

  @media (max-width: 760px) {
    .room-stage {
      container-type: inline-size;
    }

    .station-frame {
      width: 100%;
    }
  }
</style>
