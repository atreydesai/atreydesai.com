<script lang="ts">
  import { onMount } from "svelte";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import { CATERING_COURIER_TRAVEL } from "#lib/arcade/orders-catering.ts";
  import { dropFor, EMOTES, figure, nameHash, TAKEAWAY } from "#lib/arcade/orders-guests.js";
  import { cateringProgress, type ServiceOrder, type ServiceState } from "#lib/arcade/orders-service.ts";

  interface Props {
    shift: ServiceState;
    selected?: ServiceOrder;
    paused?: boolean;
    canHandoff?: boolean;
    canTake?: boolean;
    onChoose: (order: ServiceOrder, pickupReady: boolean) => void;
  }

  type Point = { x: number; y: number };
  type Face = Parameters<typeof figure>[1];
  type Reaction = "starry" | "wow" | "content" | "meh" | "unimpressed" | "storm";
  type Emote = keyof typeof EMOTES;
  type Phase = "arriving" | "line" | "seated" | "pickup" | "leaving";
  type Walk = { from: Point; to: Point; via?: Point; started: number; duration: number };
  type Guest = {
    order: ServiceOrder;
    walk: Walk;
    phase: Phase;
    doorCrossed: boolean;
    lingerUntil: number;
    reactionAt: number;
    reaction?: Reaction;
  };
  type Pose = {
    order: ServiceOrder;
    phase: Phase;
    at: Point;
    step: number;
    carries: boolean;
    face: Face;
    emote?: Emote;
    reaction?: Reaction;
    hop: boolean;
    sipping: boolean;
  };

  let { shift, selected, paused = false, canHandoff = false, canTake = true, onChoose }: Props = $props();
  let still = $state(false);

  const guests = new Map<string, Guest>();
  let currentDay: number | undefined;
  let previousTime = -1;
  let poses = $state<Pose[]>([]);

  // All positions share the kitchen scene's 900 by 535 drawing grid.
  const street = { x: 907, y: 440 };
  const door = { x: 856, y: 414 };
  const pickup = { x: 756, y: 363 };
  const courierStreet = { x: 933, y: 446 };
  const courierPickup = { x: 810, y: 389 };
  const tableSeats = [{ x: 48, y: 402 }, { x: 93, y: 432 }, { x: 138, y: 408 }];
  const aisle = { x: 647, y: 468 };
  const line = [
    { x: 665, y: 398 }, { x: 746, y: 444 }, { x: 652, y: 477 },
    { x: 560, y: 512 }, { x: 465, y: 518 }, { x: 370, y: 487 },
    { x: 276, y: 459 }, { x: 182, y: 428 }, { x: 91, y: 397 },
  ];
  const cupPalette = { ...TAKEAWAY.palette, T: "#be895d", Q: "#54362e" };
  const bubbleTea = TAKEAWAY.grid.map((row, i) => i === 4 ? "OTQTQO" : row);
  const footPoses = [
    ["...ODDODDO....", "...ODDODDO....", "..OOO..OOO...."],
    ["...ODDODDO....", "..ODDO..OO....", "..OOO........."],
    ["...ODDODDO....", "...OO..ODDO...", ".......OOOO..."],
  ];
  const courierTorso = [
    "....OOOOO.....",
    "...OGGGGGO....",
    "..OGLLGGGGO...",
    "..OGGGGGGGO...",
    "..OOOAAAAOO...",
    "...OHSSSSH.O..",
    "...OSHSSH.SO..",
    "...OSOSSO.SO..",
    "...OSSSSsO....",
    "....OSHsO.....",
    ".....OOO......",
    "....OGLGO.....",
    "...OAGLGGOO...",
    "..OGGLGGAaBO..",
    "..OGGLGGGaBO..",
    "..OGGLGGaBBO..",
    "..OSGGGaBBBO..",
    "...OGGaBBBO...",
    "...OGaBBBO....",
    "...ODDDDDO....",
  ];
  const courierBodies = footPoses.map((feet) => [...courierTorso, ...feet]);
  const courierInk = {
    O: "#2b2320", G: "#78876a", L: "#b1b49a", B: "#9f6145", A: "#dfac61",
    S: "#dca47c", s: "#ba815e", H: "#594131", a: "#936642", D: "#3a3f44",
  };
  const parcel = ["..OOOOOO..", ".OTTTTTTO.", "OTTTATTTOO", "OTYYAYTTOO", "OTTTATTTBO", "OTTTBTTBBO", ".OBBBBBBO.", "..OOOOOO.."];
  const parcelInk = { O: "#352921", T: "#bd9163", B: "#8d624d", Y: "#e1b784", A: "#f5d394" };
  const bodies = new WeakMap<string[], string[][]>();
  const reactionIcons: Record<Reaction, Emote> = {
    starry: "star",
    wow: "heart",
    content: "heart",
    meh: "drop",
    unimpressed: "drop",
    storm: "anger",
  };

  onMount(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { still = query.matches; };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  });

  function distance(from: Point, to: Point) {
    return Math.hypot(to.x - from.x, to.y - from.y);
  }

  function interpolate(from: Point, to: Point, t: number): Point {
    return {
      x: Math.round(from.x + (to.x - from.x) * t),
      y: Math.round(from.y + (to.y - from.y) * t),
    };
  }

  function position({ from, to, via, started, duration }: Walk, now: number, noMotion: boolean): Point {
    const t = noMotion || duration === 0 ? 1 : Math.min(1, Math.max(0, (now - started) / duration));
    if (!via) return interpolate(from, to, t);
    const bend = distance(from, via) / (distance(from, via) + distance(via, to));
    return t < bend ? interpolate(from, via, t / bend) : interpolate(via, to, (t - bend) / (1 - bend));
  }

  function walkTo(guest: Guest, to: Point, now: number, noMotion: boolean) {
    if (guest.walk.to.x === to.x && guest.walk.to.y === to.y) return;
    const from = position(guest.walk, now, noMotion);
    // The line bends around the front corner of the prep island.
    const roundsIsland = Math.min(from.x, to.x) < 620 && Math.max(from.x, to.x) > 643;
    const via = roundsIsland ? aisle : undefined;
    const length = via ? distance(from, via) + distance(via, to) : distance(from, to);
    guest.walk = { from, to, via, started: now, duration: length / 220 };
  }

  function queuePosition(index: number): Point {
    return line[index] ?? {
      x: 58 + ((index - line.length) % 8) * 103,
      y: 450 + Math.floor((index - line.length) / 8) * 71,
    };
  }

  function poseCourier(day: ServiceState, noMotion: boolean) {
    const progress = cateringProgress(day);
    if (!progress) return null;
    const { offer, arrivalAt, collectionAt } = progress;
    const now = day.elapsed;
    if (now < arrivalAt) return null;

    // The tray clears on the same tick that the courier takes the parcel.
    const atPass = arrivalAt + CATERING_COURIER_TRAVEL;
    const departure = collectionAt === null ? Math.max(atPass, offer.deadline) + 0.62 : collectionAt + 1.05;
    if (now >= departure + (noMotion ? 0 : CATERING_COURIER_TRAVEL)) return null;

    const entering = now < atPass;
    const leaving = now >= departure;
    if (noMotion && entering) return null;
    const started = leaving ? departure : arrivalAt;
    const walk = {
      from: leaving ? courierPickup : courierStreet,
      to: leaving ? courierStreet : courierPickup,
      via: door, started, duration: CATERING_COURIER_TRAVEL,
    };
    const at = entering || leaving ? position(walk, now, false) : courierPickup;
    const step = entering || leaving ? Math.floor((now - started) * 13) % 2 + 1 : 0;
    return {
      at, step,
      phase: entering ? "arriving" : leaving ? "leaving" : "pickup",
      carrying: collectionAt !== null && now >= collectionAt,
    };
  }

  const courier = $derived(poseCourier(shift, still));

  function verdict(quality: number): Reaction {
    if (quality >= 94) return "starry";
    if (quality >= 85) return "wow";
    if (quality >= 76) return "content";
    return quality >= 58 ? "meh" : "unimpressed";
  }

  function poseGuest(guest: Guest, now: number, noMotion: boolean, houseRoundAt?: number): Pose {
    const { order, walk, phase, reaction, reactionAt, lingerUntil } = guest;
    const walking = !noMotion && now < walk.started + walk.duration;
    const at = position(walk, now, noMotion);
    const reactionAge = now - reactionAt;
    const reacting = reaction && reactionAge >= 0;
    const carries = Boolean(reacting && reaction !== "storm");
    const patience = order.patience / order.maxPatience;
    const beat = now + (nameHash(order.id) % 31) * 0.14;
    let face: Face = "calm";
    let emote: Emote | undefined;
    if (reacting) {
      face = reaction;
      if (now < lingerUntil) emote = reactionIcons[reaction];
      else if (reaction === "storm" && walking && reactionAge < 0.85) emote = "puff";
    } else if ((phase === "line" || phase === "seated") && houseRoundAt !== undefined && now >= houseRoundAt && now < houseRoundAt + 1.15) {
      face = "content";
      emote = "heart";
    } else if ((phase === "line" || phase === "seated") && !walking) {
      if (patience < 0.23) {
        face = "cross";
        if (noMotion || beat % 3.6 < 0.9) emote = "anger";
      } else if (patience < 0.52) {
        face = !noMotion && beat % 2.2 < 1.1 ? "glanceAlt" : "glance";
        if (noMotion || beat % 4.8 < 1.12) emote = "clock";
      } else if (!noMotion && beat % 4.3 < 0.17) {
        face = "blink";
      }
    }
    return {
      order, phase, at, face, emote, reaction: reacting ? reaction : undefined,
      step: walking ? Math.floor((now - walk.started) * 13) % 2 + 1 : 0,
      carries,
      hop: !noMotion && (reaction === "starry" || reaction === "wow") && reactionAge >= 0.12 && reactionAge < 0.34,
      sipping: !noMotion && carries && reactionAge >= 0.34 && reactionAge < 0.63,
    };
  }

  function updateFloor(day: ServiceState, noMotion: boolean): Pose[] {
    const now = day.elapsed;
    const starting = currentDay !== day.day || now < previousTime;
    if (starting) guests.clear();
    currentDay = day.day;
    previousTime = now;
    const seats = new Map(day.orders.filter(({ reservation }) => reservation)
      .map(({ id }, index) => [id, tableSeats[index]]));
    let waiting = 0;
    let pickups = 0;

    for (const order of day.orders) {
      if (order.catering || order.arrivesAt > now) continue;
      let guest = guests.get(order.id);
      const seat = seats.get(order.id);
      const done = order.status === "served" || order.status === "missed";
      if (done) {
        if (!guest) continue;
        if (guest.phase !== "leaving") {
          const served = order.status === "served";
          guest.phase = "leaving";
          guest.doorCrossed = false;
          if (served) walkTo(guest, seat ?? pickup, now, noMotion);
          else walkTo(guest, position(guest.walk, now, noMotion), now, noMotion);
          const reachedPass = Math.max(now, guest.walk.started + guest.walk.duration);
          const quality = day.receipts.find(({ orderId }) => orderId === order.id)?.quality;
          guest.reaction = served ? verdict(quality ?? 76) : "storm";
          guest.reactionAt = served && !noMotion ? reachedPass : now;
          guest.lingerUntil = guest.reactionAt + (served ? 1.05 : 0.49);
        }
        if (now >= guest.lingerUntil) {
          if (noMotion) {
            guests.delete(order.id);
            continue;
          }
          if (!guest.doorCrossed) walkTo(guest, door, guest.lingerUntil, false);
          if (!guest.doorCrossed && now >= guest.walk.started + guest.walk.duration) {
            guest.doorCrossed = true;
            walkTo(guest, street, guest.walk.started + guest.walk.duration, false);
          }
          if (guest.doorCrossed && now >= guest.walk.started + guest.walk.duration) {
            guests.delete(order.id);
            continue;
          }
        }
      } else {
        const atPickup = !seat && order.cup?.sealed && pickups === 0;
        if (atPickup) pickups++;
        const destination = seat ?? (atPickup ? pickup : queuePosition(waiting++));
        if (!guest) {
          const restored = starting && now - order.arrivesAt > 2;
          const start = restored ? destination : street;
          guest = {
            order, walk: { from: start, to: start, started: order.arrivesAt, duration: 0 },
            phase: "arriving", doorCrossed: restored, lingerUntil: 0, reactionAt: Infinity,
          };
          if (!restored) walkTo(guest, door, order.arrivesAt, noMotion);
          guests.set(order.id, guest);
        }
        const crossing = guest.walk.started + guest.walk.duration;
        if (!guest.doorCrossed && (noMotion || now >= crossing)) {
          guest.doorCrossed = true;
          walkTo(guest, destination, crossing, noMotion);
        }
        if (guest.doorCrossed) walkTo(guest, destination, now, noMotion);
        guest.phase = !noMotion && guest.phase === "arriving" && now < guest.walk.started + guest.walk.duration
          ? "arriving"
          : seat ? "seated" : atPickup ? "pickup" : "line";
      }
      guest.order = order;
    }

    return [...guests.values()].map((guest) => poseGuest(guest, now, noMotion, day.houseRoundAt));
  }

  $effect(() => {
    poses = updateFloor(shift, still);
  });

  function sprite({ order, phase, step, face: mood }: Pose) {
    const name = order.customerName.toLowerCase();
    const face = figure(name, mood);
    let fullBody = bodies.get(face.grid);
    if (!fullBody) {
      // The arcade portrait ends at the waist. Keep the original ink and
      // extend the torso with a three-pose walk cycle.
      const torso = [...face.grid.slice(0, -1), ".OOODDDDDOOO.."];
      fullBody = [...footPoses.map((feet) => [...torso, ...feet]),
        [...torso.slice(0, -2), "..OODDDDDDOO..", "..OO.OOO.OO..."]];
      bodies.set(face.grid, fullBody);
    }
    const sitting = order.reservation && step === 0 && (phase === "seated" || (phase === "leaving" && mood !== "storm"));
    return { palette: face.palette, grid: fullBody[sitting ? 3 : step], inset: Math.min(8, dropFor(name) * 2) + "%" };
  }

  function action(order: ServiceOrder, pickupReady: boolean) {
    if (order.status === "waiting") return "take ticket";
    if (pickupReady && canHandoff) return "pick up their drink";
    return "select order";
  }
</script>

{#snippet guestShadow()}
  <svg class="shadow" viewBox="0 0 12 4" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true" focusable="false">
    <path d="M2 0h8v1h2v2h-2v1H2V3H0V1h2z" />
    <path class="shadow-trim" d="M2 3h8v1H2z" />
  </svg>
{/snippet}

{#snippet guestSprite(pose: Pose)}
  {@const art = sprite(pose)}
  {@render guestShadow()}
  <span class="walker" class:step={pose.step === 1} class:hop={pose.hop} style:--guest-inset={art.inset}>
    <PixelIcon grid={art.grid} palette={art.palette} px={4} />
    {#if pose.carries}
      <span class="cup" class:sipping={pose.sipping}><PixelIcon grid={bubbleTea} palette={cupPalette} px={4} /></span>
    {/if}
    {#if pose.emote}
      {@const icon = EMOTES[pose.emote]}
      <span class="emote" class:watch={pose.emote === "clock"} data-guest-emote={pose.emote}>
        <PixelIcon grid={icon.grid} palette={icon.palette} px={3} />
      </span>
    {/if}
  </span>
{/snippet}

<div class="customer-floor" class:moving={!paused && !still} role="group" aria-label="Customers in the boba shop">
  {#if courier}
    <div
      class="position"
      style:left={courier.at.x / 9 + "%"}
      style:top={courier.at.y / 5.35 + "%"}
      style:z-index={courier.at.y}
      data-courier-state={courier.phase}
      aria-hidden="true"
    >
      <span class="customer">
        {@render guestShadow()}
        <span class="walker" class:step={courier.step === 1} style:--guest-inset="0%">
          <PixelIcon grid={courierBodies[courier.step]} palette={courierInk} px={4} />
          {#if courier.carrying}
            <span class="parcel" data-courier-parcel><PixelIcon grid={parcel} palette={parcelInk} px={4} /></span>
          {/if}
        </span>
      </span>
    </div>
  {/if}
  {#each poses as pose (pose.order.id)}
    {@const { order, phase, at } = pose}
    {@const active = order.id === selected?.id}
    {@const pickupReady = (phase === "pickup" && at.x === pickup.x && at.y === pickup.y) ||
      (phase === "seated" && pose.step === 0 && !!order.cup?.sealed)}
    <div class="position" style:left={at.x / 9 + "%"} style:top={at.y / 5.35 + "%"} style:z-index={at.y} data-customer={order.customerId} data-customer-state={phase} data-pickup-ready={pickupReady || undefined} data-customer-reaction={pose.reaction}>
      {#if phase === "leaving"}
        <span class="customer" aria-hidden="true">{@render guestSprite(pose)}</span>
      {:else}
        <button
          type="button"
          class="customer"
          class:active
          disabled={paused || (!canTake && order.status === "waiting")}
          aria-label={order.customerName + ": " + action(order, pickupReady)}
          aria-pressed={order.status !== "waiting" && !(canHandoff && pickupReady) ? active : undefined}
          onclick={() => onChoose(order, pickupReady)}
        >
          {@render guestSprite(pose)}
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .customer-floor {
    position: absolute;
    inset: 0;
    z-index: 1;
    overflow: hidden;
    pointer-events: none;
  }

  .position {
    position: absolute;
    width: 6.2%;
    transform: translate(-50%, -100%);
  }

  .moving .position { transition: left 85ms linear, top 85ms linear; }

  .customer {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 14 / 23;
    padding: 0;
    border: 0;
    background: none;
  }

  button.customer {
    pointer-events: auto;
    cursor: pointer;
    touch-action: manipulation;
  }

  button.customer:disabled { pointer-events: none; }

  .walker {
    position: absolute;
    inset: auto var(--guest-inset) 0;
  }

  .walker.step { transform: translateY(-4%); }
  .walker.hop { transform: translateY(-8%); }
  .walker :global(svg) { display: block; width: 100%; height: auto; }

  .shadow {
    position: absolute;
    bottom: -5%;
    left: -4%;
    width: 108%;
    height: 21%;
    fill: #2b2320a8;
  }

  .shadow-trim { fill: transparent; }
  .active .shadow-trim { fill: #e8ae6e; }

  .cup {
    position: absolute;
    width: 45%;
    right: -3%;
    top: 48%;
    filter: drop-shadow(1px 0 #ffd288);
  }

  .cup.sipping { transform: translate(-24%, -29%); }

  .parcel {
    position: absolute;
    width: 67%;
    right: -10%;
    top: 52%;
  }

  .emote {
    position: absolute;
    top: -6%;
    left: 81%;
    width: 38%;
    pointer-events: none;
  }

  .emote.watch { top: -9%; width: 45%; }

  button.customer:focus-visible {
    outline: 2px dashed #ffe0a8;
    outline-offset: 2px;
  }

  @media (hover: hover) {
    button.customer:hover .shadow-trim { fill: #f8d091; }
  }

  @media (pointer: coarse) {
    button.customer::after {
      position: absolute;
      content: "";
      top: 50%;
      left: 50%;
      width: max(100%, 32px);
      height: max(100%, 40px);
      transform: translate(-50%, -50%);
    }
  }
</style>
