<script lang="ts">
  // Order up's shop: the shop book between shifts, and during one the ticket
  // rail, the room, the counter and the tool belt. The rules live in
  // `order-up/engine`; this component draws them and listens.
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { get } from "svelte/store";
  import { arcadeExpert, setExpert } from "#lib/boba.ts";
  import { MENU_ICONS } from "#lib/arcade/art.ts";
  import { isOnControl, mountShell } from "#lib/arcade/shell.ts";
  import {
    finishMusic,
    setMusicPaused,
    setMusicPhase,
    sfxBlip,
    sfxBrew,
    sfxBrewed,
    sfxPlop,
    sfxPour,
    sfxSeal,
    sfxServe,
    sfxShake,
    sfxSizzle,
    sfxTicket,
    sfxTipJar,
    sfxWrong,
    startMusic,
    stopMusic,
  } from "#lib/sfx.ts";
  import { newCampaign, type Campaign, type CampaignMode } from "#lib/arcade/orders-campaign.ts";
  import { money } from "#lib/arcade/orders-display.ts";
  import { beforeImportKey, slotKey, unreadableKey, type SlotId } from "#lib/arcade/order-up/engine/slots.ts";
  import { beltShows } from "#lib/arcade/order-up/engine/opened.ts";
  import {
    addCash,
    addShiftTime,
    endShiftNow,
    finishEveryCup,
    finishSelectedCup,
    jumpToDay,
    openAllShops,
    refillPatience,
    stockEverything,
    unlockCollection,
    type CheatResult,
  } from "#lib/arcade/order-up/engine/cheats.ts";
  import { SKILLS, RECIPE_BY_ID, POWERUPS, VIEWS, GOALS } from "#lib/arcade/order-up/content/index.ts";
  import type { SkillId, Station } from "#lib/arcade/order-up/content/schema.ts";
  import {
    startShift,
    tickShift,
    settleShift,
    setStation,
    beginWork,
    skillAction,
    currentSkill,
    handoff,
    usePowerup,
    selectedTicket,
    activeCup,
    selectTicket,
    inspectUsual,
    wakeGuest,
    feedCat,
    shooGull,
    type Shift,
    type Receipt,
  } from "#lib/arcade/order-up/engine/shift.ts";
  import { rememberUsual, acceptChange, keepOriginal } from "#lib/arcade/order-up/engine/guest-actions.ts";
  import { loadEnvelope, parseSave, saveEnvelope, type LoadedSave } from "#lib/arcade/order-up/engine/save.ts";
  import { command } from "#lib/arcade/order-up/engine/commands.ts";
  import { calendar } from "#lib/arcade/order-up/engine/calendar.ts";
  import { rankFor } from "#lib/arcade/order-up/engine/management.ts";
  import { STATIONS } from "#lib/arcade/order-up/engine/state.ts";
  import { ticketLimit } from "#lib/arcade/order-up/engine/tuning.ts";
  import {
    startActivity,
    tickActivity,
    actActivity,
    finishChore,
    finishTasteoff,
    deliverRoute,
    makePearlBatch,
    type Activity,
  } from "#lib/arcade/order-up/engine/activities.ts";
  import type { SkillAction } from "#lib/arcade/order-up/skills/index.ts";
  import { createCoach, type Lesson } from "#lib/arcade/core/coach.ts";
  import PixelIcon from "#lib/components/PixelIcon.svelte";
  import Coach from "../Coach.svelte";
  import ExpertTag from "../ExpertTag.svelte";
  import HudButtons from "../HudButtons.svelte";
  import PauseCard from "../PauseCard.svelte";
  import OrderPixelWord from "../OrderPixelWord.svelte";
  import WorldView from "./WorldView.svelte";
  import SkillPanel from "./SkillPanel.svelte";
  import ShopBook from "./ShopBook.svelte";
  import TicketRail from "./TicketRail.svelte";
  import Icon from "./Icon.svelte";
  import Portrait from "./Portrait.svelte";

  const dispatch = createEventDispatcher<{ close: null; menu: null; saves: null }>();
  /** The save slot this shop lives in. */
  export let slot: SlotId = "1";
  /** The test kitchen: the book carries cheats (development hosts only). */
  export let cheats = false;
  const illustration = MENU_ICONS.orders;
  const keys = ["Q", "W", "E", "R", "T", "Y"];

  let mode: CampaignMode = get(arcadeExpert) ? "expert" : "normal";
  let campaign: Campaign = newCampaign(mode);
  let shift: Shift | null = null;
  let carry: Record<string, unknown> = {};
  let ready = false;
  let saveEnabled = true;
  let paused = false;
  let bookOpen = true;
  let bookTab = "today";
  /** A piece just placed from the book, picked when arranging opens. */
  let arrangeFocus = "";
  let view = "room";
  let station: Station = "brew";
  let reduced = false;
  let notice = "";
  let noticeAge = 0;
  let storageWarning = "";
  let lesson: Lesson | null = null;
  let lessonAge = 0;
  let activity: Activity | null = null;
  let taste: number[] | null = null;
  let steering = 0;
  let receiptOpen = false;
  let receiptIndex = -1;
  let pendingImport: LoadedSave | null = null;
  let pendingRaw = "";
  let importFile: HTMLInputElement;
  let host: HTMLElement;
  let heading: HTMLElement;
  let pauseCard: PauseCard | undefined;
  let hudButtons: HudButtons | undefined;
  let raf = 0;
  let previous = 0;
  let saveClock = 0;
  let uiClock = 0;
  let lastReceiptCount = 0;
  let lastMarkTime = -1;
  let lastArrivals = 0;
  let lastReceipts: Receipt[] = [];
  let musicPhase: "opening" | "steady" | "rush" | null = null;
  let anchor = { x: 0, y: 0, ring: 0, side: "above" as "left" | "above" };

  const coach = createCoach("orders");

  $: today = calendar(campaign.day);
  $: active = shift ? selectedTicket(shift) : null;
  $: cup = active ? activeCup(active) : null;
  $: remaining = shift ? Math.max(0, Math.ceil(shift.duration - shift.elapsed)) : 0;
  $: clock = Math.floor(remaining / 60) + ":" + String(remaining % 60).padStart(2, "0");
  $: selectedGoals = campaign.expansion.selectedGoals
    .map((id) => GOALS.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => !!g);
  $: receipts = shift?.receipts ?? lastReceipts;
  $: shownReceipt = receipts[receiptIndex < 0 ? receipts.length - 1 : receiptIndex];
  // Every slot keeps its place; one shows its powerup once the workshop sells it.
  $: belt = Array.from({ length: rankFor(campaign) >= 30 ? 6 : 5 }, (_, i) => {
    const power = POWERUPS.find((p) => p.id === campaign.expansion.loadout[i]);
    return power && beltShows(campaign, power.id) ? power : null;
  });
  $: hasRunner = campaign.expansion.staff.some(
    (s) => (s.role === "runner" || s.role === "courier") && s.shop === campaign.expansion.activeShop,
  );
  $: blocking = paused || bookOpen || receiptOpen || !!pendingImport;
  $: pegs = shift?.tickets.length ?? ticketLimit(campaign.day);

  function refresh() {
    campaign = campaign;
    shift = shift;
    activity = activity;
  }

  function say(text: string) {
    if (!text) return;
    notice = text;
    noticeAge = 0;
  }

  // --- Saving ------------------------------------------------------------------

  function save() {
    if (!ready || !saveEnabled) return;
    try {
      carry = { ...carry, lastReceipts: lastReceipts.slice(-40) };
      window.localStorage.setItem(slotKey(slot, mode), JSON.stringify(saveEnvelope(campaign, shift, carry)));
      storageWarning = "";
    } catch {
      storageWarning = "This browser can't keep the shop. Export it before you leave.";
    }
  }

  function read(modeToRead: CampaignMode) {
    saveEnabled = true;
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(slotKey(slot, modeToRead));
      const loaded = loadEnvelope(raw ? JSON.parse(raw) : null, modeToRead);
      // A shift left open in the first campaign's counter can't be played
      // here: the shop goes back to planning, its till and pantry kept.
      if (loaded.legacyShift) {
        loaded.campaign.status = "planning";
        loaded.warning = "The old shift was closed; the shop and pantry are safe.";
      }
      campaign = loaded.campaign;
      shift = loaded.shift;
      carry = loaded.carry;
      lastReceipts = Array.isArray(carry.lastReceipts)
        ? (carry.lastReceipts as Receipt[]).filter((r) => RECIPE_BY_ID[r?.recipe]).slice(-40)
        : [];
      if (shift?.status === "complete" && !shift.settled) {
        lastReceipts = shift.receipts;
        settleShift(campaign, shift);
        shift = null;
      }
      bookOpen = !shift;
      paused = !!shift;
      station = shift?.chefStation ?? "brew";
      say(loaded.warning);
    } catch (error) {
      saveEnabled = false;
      storageWarning = error instanceof Error ? error.message : "The save couldn't be read.";
      campaign = newCampaign(modeToRead);
      shift = null;
      carry = {};
      bookOpen = true;
      // Unreadable input is kept aside for recovery, never overwritten.
      if (raw) {
        try {
          window.localStorage.setItem(unreadableKey(slot, modeToRead), raw);
        } catch {}
      }
    }
    mode = modeToRead;
    ready = true;
    lastReceiptCount = shift?.receipts.length ?? 0;
    lastArrivals = shift?.arrivals ?? 0;
  }

  // --- Sound ---------------------------------------------------------------------

  const skillSounds: Record<SkillId, () => void> = {
    steep: sfxBrewed,
    "kettle-heat": sfxBrew,
    pour: () => sfxPour(),
    "milk-ratio": () => sfxPour(1),
    "pearl-pot": sfxSizzle,
    "egg-waffle": sfxSizzle,
    "fruit-board": () => sfxPlop(),
    "cheese-foam": () => sfxShake(),
    "tiger-stripes": () => sfxPlop(1),
    "topping-ladle": () => sfxPlop(2),
    blender: () => sfxShake(1),
    shake: () => sfxShake(),
    seal: sfxSeal,
    "straw-stab": sfxSeal,
    torch: sfxSizzle,
    "layered-pour": () => sfxPour(2),
    "colour-change": () => sfxPour(3),
    "cream-rosette": () => sfxPlop(3),
    packing: sfxTipJar,
  };

  function skillSound(id: SkillId, grade: number) {
    if (grade < 60) sfxWrong();
    else skillSounds[id]?.();
  }

  function followMusic(elapsed: number, duration: number) {
    const phase = elapsed >= duration * 0.81 ? "rush" : elapsed >= 16 ? "steady" : "opening";
    if (phase === musicPhase) return;
    musicPhase = phase;
    setMusicPhase(phase);
  }

  function startShiftMusic() {
    musicPhase = null;
    if (shift) followMusic(shift.elapsed, shift.duration);
    else setMusicPhase("opening");
    startMusic();
  }

  // --- The shift -------------------------------------------------------------------

  async function open(daily: string | null = null) {
    if (campaign.status === "closed") {
      say("Settle the rent book before you open.");
      return;
    }
    if (!shift) {
      try {
        shift = startShift(campaign, daily);
      } catch (error) {
        say(error instanceof Error ? error.message : "The shop couldn't open.");
        return;
      }
      lastReceiptCount = 0;
      lastArrivals = shift.arrivals;
      lastMarkTime = -1;
      station = shift.chefStation;
      startShiftMusic();
    } else setMusicPaused(false);
    bookOpen = false;
    paused = false;
    receiptOpen = false;
    activity = null;
    view = "room";
    save();
    refresh();
    await tick();
    heading?.focus({ preventScroll: true });
  }

  async function pause() {
    if (paused || bookOpen || !ready || (!shift && !(activity && !activity.done))) return;
    paused = true;
    steering = 0;
    if (cup?.run) cup.run.held = false;
    setMusicPaused(true);
    save();
    refresh();
    await tick();
    pauseCard?.focus();
  }

  async function resume() {
    if (!paused) return;
    paused = false;
    previous = 0;
    setMusicPaused(false);
    refresh();
    await tick();
    hudButtons?.focusPause();
  }

  function showBook(tab = "today") {
    bookTab = tab;
    bookOpen = true;
    paused = false;
    steering = 0;
    if (cup?.run) cup.run.held = false;
    if (shift) setMusicPaused(true);
    save();
  }

  function closeBook() {
    bookOpen = false;
    previous = 0;
    if (shift) setMusicPaused(false);
    void tick().then(() => heading?.focus({ preventScroll: true }));
  }

  /** A skill's first use on this device stops the shift with its one-line lesson. */
  function offerSkill() {
    if (!shift || !cup?.run || cup.warmup > 0 || cup.run.automatic !== null || coach.current) return;
    const skill = SKILLS.find((s) => s.id === cup!.run!.id)!;
    const id = "expansion.skill." + skill.id;
    if (coach.learned(id)) return;
    coach.offer({
      id,
      text: skill.lesson,
      name: skill.name,
      keys: skill.input === "drag" ? ["←", "↑", "↓", "→"] : ["Space"],
      touch: skill.input === "hold" ? "Hold" : skill.input === "drag" ? "Draw" : "Tap",
      slow: 0,
      life: Infinity,
      minLife: 0.4,
    });
    lesson = coach.current;
    lessonAge = 0;
    cup.run.held = false;
  }

  function acknowledge() {
    if (!coach.current) return;
    coach.skip(coach.current.id);
    coach.dismiss();
    lesson = null;
    previous = 0;
    refresh();
  }

  function runAction(a: SkillAction) {
    if (blocking || lesson || !shift) return;
    const before = shift.lastMark?.time;
    skillAction(campaign, shift, a);
    if (shift.lastMark && shift.lastMark.time !== before) {
      lastMarkTime = shift.lastMark.time;
      skillSound(shift.lastMark.skill, shift.lastMark.grade);
    }
    refresh();
  }

  function primary(hold = false) {
    if (blocking) return;
    // A press while a lesson holds the shift answers the lesson; it never
    // carries into the skill it stopped.
    if (lesson) {
      if (lessonAge >= 0.4) acknowledge();
      return;
    }
    if (activity && !activity.done && ["chore", "tasteoff"].includes(activity.kind)) {
      actActivity(activity);
      finishActivity();
      refresh();
      return;
    }
    if (!shift) {
      void open();
      return;
    }
    const ticket = selectedTicket(shift);
    if (!ticket) return;
    if (ticket.sleeping) {
      wakeGuest(shift);
      say(shift.notice);
      refresh();
      return;
    }
    if (ticket.special === "cat") {
      feedCat(campaign, shift);
      say(shift.notice);
      refresh();
      return;
    }
    if (ticket.changeTo) {
      guestAction("accept");
      return;
    }
    if (ticket.usual && !ticket.revealed) {
      inspectUsual(shift);
      refresh();
      return;
    }
    if (ticket.cups.every((c) => c.ready)) {
      serve();
      return;
    }
    const item = activeCup(ticket);
    const definition = SKILLS.find((k) => k.id === currentSkill(item));
    if (!definition) return;
    if (shift.chefStation !== definition.station) {
      setStation(campaign, shift, definition.station);
      station = definition.station;
      refresh();
      return;
    }
    if (shift.walking > 0 || item.warmup > 0) return;
    if (!item.run) {
      beginWork(campaign, shift);
      if (shift.notice && shift.noticeAt === shift.realElapsed) say(shift.notice);
      refresh();
      offerSkill();
      if (item.run && !lesson && definition.input === "hold" && item.warmup <= 0 && hold) runAction({ type: "down" });
      return;
    }
    if (definition.input === "hold" && hold) runAction({ type: "down" });
    else if (definition.input !== "hold") runAction({ type: "press" });
  }

  function release() {
    if (blocking || lesson || !shift) return;
    if (cup?.run && SKILLS.find((k) => k.id === cup!.run!.id)?.input === "hold") runAction({ type: "up" });
  }

  function guestAction(name: string, id = "") {
    if (!shift || blocking || lesson) return;
    if (name === "remember") rememberUsual(campaign, shift, id);
    else if (name === "accept") acceptChange(campaign, shift);
    else if (name === "keep") keepOriginal(campaign, shift);
    say(shift.notice);
    refresh();
    save();
  }

  function serve(slot?: number) {
    if (!shift) return;
    const ticket = slot === undefined ? selectedTicket(shift) : shift.tickets[slot];
    if (handoff(campaign, shift, slot)) {
      const got = shift.receipts.slice(lastReceiptCount);
      lastReceiptCount = shift.receipts.length;
      sfxServe(got.some((r) => r.grade >= 94));
      if (ticket && got.length) say(receiptLine(ticket.name, got));
      refresh();
      save();
    } else if (shift.notice) say(shift.notice);
  }

  function receiptLine(name: string, got: Receipt[]) {
    const grade = Math.round(got.reduce((n, r) => n + r.grade, 0) / got.length);
    const paid = got.reduce((n, r) => n + r.price + r.tip, 0);
    return `${name} paid ${money(paid)} for a ${grade}-point ${got.length > 1 ? "order" : "drink"}.`;
  }

  function chooseStation(id: string) {
    if (!STATIONS.includes(id as Station)) return;
    station = id as Station;
    if (shift && !blocking) setStation(campaign, shift, station);
    refresh();
  }

  function chooseTicket(slot: number) {
    if (!shift || !shift.tickets[slot]) return;
    shift.selected = slot;
    refresh();
  }

  function changeView(id: string) {
    const definition = VIEWS.find((v) => v.id === id);
    if (!definition) return;
    if (definition.day > campaign.day) {
      say(`The ${definition.name} opens on day ${definition.day}.`);
      return;
    }
    view = id;
    if (id === "station" && shift) station = shift.chefStation;
    if (!["room", "station", "window", "office"].includes(id)) {
      const lessonId = "expansion.view." + id;
      if (!coach.learned(lessonId) && !coach.current) {
        coach.offer({ id: lessonId, text: definition.decision, name: definition.name, slow: 0, life: Infinity, minLife: 0.4 });
        lesson = coach.current;
        lessonAge = 0;
      }
    }
  }

  function cycleView() {
    const choices = VIEWS.filter((v) => v.day <= campaign.day);
    changeView(choices[(choices.findIndex((v) => v.id === view) + 1) % choices.length].id);
  }

  function use(id: string) {
    if (blocking || lesson || !shift) return;
    if (usePowerup(campaign, shift, id)) {
      sfxTipJar();
      const power = POWERUPS.find((p) => p.id === id)!;
      say(shift.notice && shift.noticeAt === shift.realElapsed ? shift.notice : power.description);
      refresh();
      save();
    }
  }

  function callRunner() {
    if (!shift) return;
    for (const ticket of [...shift.tickets]) if (ticket?.cups.every((c) => c.ready)) serve(ticket.slot);
  }

  function finishActivity() {
    if (!activity?.done || activity.reward) return;
    let result = false;
    if (activity.kind === "chore") {
      result = finishChore(campaign, activity);
      say(result ? "The counter is clean again." : "Scrub at least three times.");
    } else if (activity.kind === "tasteoff") {
      const verdict = finishTasteoff(campaign, activity);
      if (verdict) {
        result = true;
        say(verdict.won ? "You won the round." : "Clover won this round.");
      }
    } else if (activity.kind === "delivery") {
      if (activity.target === "practice") {
        activity.reward = 1;
        say(`The carrier arrived with a grade of ${activity.grade}.`);
        result = true;
      } else {
        result = deliverRoute(campaign, activity);
        say(result ? "The van reached the shop." : "The route needs fresh stock.");
      }
    }
    if (result) {
      if (activity.grade >= 85) sfxBrewed();
      else sfxBlip();
      refresh();
      save();
    }
  }

  function doAction(name: string, data: any = {}) {
    switch (name) {
      case "open":
        void open();
        return;
      case "daily":
        void open(new Date().toISOString().slice(0, 10));
        return;
      case "resume":
        closeBook();
        return;
      case "export":
        exportSave();
        return;
      case "import":
        importFile?.click();
        return;
      case "mode":
        changeMode();
        return;
      case "saves":
        exit("saves");
        return;
      case "cheat":
        runCheat(data);
        return;
      case "view": {
        const place = VIEWS.find((v) => v.id === data.id);
        if (place && place.day > campaign.day) {
          say(`The ${place.name} opens on day ${place.day}.`);
          return;
        }
        bookOpen = false;
        changeView(data.id);
        return;
      }
      case "drive": {
        // From the book: open the delivery run for one planned route.
        const van = VIEWS.find((v) => v.id === "delivery");
        if (van && van.day > campaign.day) {
          say(`The ${van.name} opens on day ${van.day}.`);
          return;
        }
        if (activity && !activity.done) {
          say("Finish this job first.");
          return;
        }
        bookOpen = false;
        changeView("delivery");
        activity = startActivity("delivery", data.to ?? "", 0);
        refresh();
        return;
      }
      case "station":
        chooseStation(data.id);
        return;
      case "ticket":
        chooseTicket(data.slot);
        return;
      case "handoff":
        serve();
        return;
      case "inspect":
        if (shift) {
          inspectUsual(shift);
          refresh();
        }
        return;
      case "shoo":
        if (shift && shooGull(campaign, shift)) {
          sfxBlip();
          refresh();
        }
        return;
      case "steer":
        steering = data.value;
        return;
      case "activity-press":
        if (!lesson && !paused && activity) {
          actActivity(activity);
          finishActivity();
          refresh();
        }
        return;
      case "activity":
        if (activity && !activity.done) {
          say("Finish this job first.");
          return;
        }
        if (data.kind === "tasteoff" && (shift || campaign.day < 8 || campaign.expansion.tasteoffDay === campaign.day)) {
          say("The next round isn't ready yet.");
          return;
        }
        activity = startActivity(data.kind, data.target ?? "", data.round ?? 0);
        refresh();
        return;
      case "batch":
        if (makePearlBatch(campaign, 88)) {
          say("A fresh batch of pearls is warming.");
          sfxSizzle();
        } else say("A batch needs four portions of pearls.");
        refresh();
        save();
        return;
    }
    const result = command(campaign, name, data);
    if (name === "place-from-book" && result.ok) arrangeFocus = data.id + "#" + campaign.expansion.shops[campaign.expansion.activeShop].decor.length;
    if (result.taste) taste = result.taste;
    if (result.message) say(result.message);
    if (result.ok) {
      sfxBlip();
      if (result.view) {
        bookOpen = false;
        changeView(result.view);
      }
      refresh();
      save();
    }
  }

  // --- Saves on disk ---------------------------------------------------------------

  function exportSave() {
    try {
      const content = JSON.stringify(saveEnvelope(campaign, shift, { ...carry, lastReceipts }), null, 2);
      const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "order-up-" + mode + "-day-" + campaign.day + ".json";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say("The save is downloading.");
    } catch {
      say("The save couldn't be exported.");
    }
  }

  async function inspectImport(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("This file is too large to be a save.");
      pendingRaw = await file.text();
      const target = JSON.parse(pendingRaw)?.campaign?.mode;
      if (!["normal", "expert"].includes(target)) throw new Error("This file isn't an Order up save.");
      pendingImport = parseSave(pendingRaw, target);
      await tick();
      host?.querySelector<HTMLElement>(".import-card button")?.focus();
    } catch (error) {
      say(error instanceof Error ? error.message : "The file couldn't be read.");
    } finally {
      importFile.value = "";
    }
  }

  function acceptImport() {
    if (!pendingImport) return;
    save();
    try {
      const target = pendingImport.campaign.mode;
      const key = slotKey(slot, target);
      const existing = window.localStorage.getItem(key);
      if (existing) window.localStorage.setItem(beforeImportKey(slot, target), existing);
      window.localStorage.setItem(key, pendingRaw);
      setExpert(target === "expert");
      pendingImport = null;
      pendingRaw = "";
      coach.dismiss();
      lesson = null;
      receiptOpen = false;
      read(target);
      refresh();
      say("The shop is imported.");
    } catch {
      say("The browser couldn't store the save, so your shop is unchanged.");
    }
  }

  function changeMode(next: CampaignMode = mode === "normal" ? "expert" : "normal") {
    if (next === mode || shift) return;
    save();
    coach.dismiss();
    lesson = null;
    setExpert(next === "expert");
    read(next);
    refresh();
  }

  function openReceipts() {
    receiptOpen = true;
    receiptIndex = -1;
    if (shift) setMusicPaused(true);
    void tick().then(() => host?.querySelector<HTMLElement>(".receipt-card button")?.focus());
  }

  function closeReceipts() {
    receiptOpen = false;
    previous = 0;
    if (shift && !paused && !bookOpen) setMusicPaused(false);
  }

  function exit(to: boolean | "saves" = false) {
    save();
    stopMusic();
    dispatch(to === "saves" ? "saves" : to ? "menu" : "close");
  }

  // --- The test kitchen ------------------------------------------------------------

  /** Runs one of the test kitchen's cheats (only ever in its slot), then saves. */
  function runCheat(data: { name: string; value?: number | string }) {
    if (!cheats) return;
    let result: CheatResult | null = null;
    switch (data.name) {
      case "cash":
        result = addCash(campaign, Number(data.value));
        break;
      case "day":
        result = jumpToDay(campaign, Number(data.value));
        break;
      case "shops":
        result = openAllShops(campaign);
        break;
      case "stock":
        result = stockEverything(campaign);
        break;
      case "collection":
        result = unlockCollection(campaign);
        break;
      case "finish-cup":
        if (shift) result = finishSelectedCup(shift);
        break;
      case "finish-all":
        if (shift) result = finishEveryCup(shift);
        break;
      case "patience":
        if (shift) result = refillPatience(shift);
        break;
      case "time":
        if (shift) result = addShiftTime(shift);
        break;
      case "end":
        if (shift) result = endShiftNow(shift);
        break;
      case "view": {
        // Straight there, whatever day it would open on.
        const definition = VIEWS.find((v) => v.id === data.value);
        if (!definition) return;
        closeBook();
        view = definition.id;
        if (view === "station" && shift) station = shift.chefStation;
        break;
      }
      case "activity": {
        if (activity && !activity.done) {
          say("Finish this job first.");
          return;
        }
        const kind = String(data.value) as Activity["kind"];
        if (kind === "tasteoff") campaign.expansion.tasteoffDay = 0;
        closeBook();
        activity = startActivity(kind);
        break;
      }
    }
    if (result) say(result.message);
    refresh();
    save();
  }

  // --- Keys --------------------------------------------------------------------------

  function onKey(event: KeyboardEvent) {
    if (!ready || event.altKey || event.ctrlKey || event.metaKey) return;
    // Keys sent to the document itself have no element to look up from.
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("input, select, textarea")) return;
    if (event.key === "Escape") {
      if (pendingImport) {
        pendingImport = null;
        pendingRaw = "";
      } else if (receiptOpen) closeReceipts();
      else if (paused) exit();
      else if (bookOpen) closeBook();
      else void pause();
      event.preventDefault();
      return;
    }
    if (bookOpen || paused || receiptOpen || pendingImport) return;
    if (lesson) {
      if (event.key === "Enter" || event.code === "Space") {
        event.preventDefault();
        if (lessonAge >= 0.4 || event.key === "Enter") acknowledge();
      }
      return;
    }
    const key = event.key.toLowerCase();
    // Space is the counter's: on the play field, the HUD buttons and the primary key itself.
    if (event.code === "Space" && (!isOnControl(event) || target?.closest(".primary-key"))) {
      if (event.repeat) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      primary(true);
      return;
    }
    if (key === "v") {
      event.preventDefault();
      cycleView();
      return;
    }
    if (event.key === "[" || event.key === "]") {
      event.preventDefault();
      if (shift && selectTicket(shift, event.key === "[" ? -1 : 1)) refresh();
      return;
    }
    if (/^[1-5]$/.test(key)) {
      event.preventDefault();
      chooseStation(STATIONS[Number(key) - 1]);
      return;
    }
    const slot = keys.map((k) => k.toLowerCase()).indexOf(key);
    if (slot >= 0 && belt[slot]) {
      event.preventDefault();
      use(belt[slot]!.id);
      return;
    }
    if (event.key.startsWith("Arrow")) {
      if (activity?.kind === "delivery" && !activity.done) {
        event.preventDefault();
        steering = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
        return;
      }
      if (cup?.run && ["drag", "knob"].includes(SKILLS.find((s) => s.id === cup!.run!.id)?.input ?? "")) {
        event.preventDefault();
        runAction({
          type: "arrow",
          x: event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0,
          y: event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0,
        });
      }
    }
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.code === "Space") release();
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") steering = 0;
  }

  // --- The loop --------------------------------------------------------------------

  /** The callout sits over the counter's picture, just above the skill it explains. */
  function placeLesson() {
    const panel = host?.querySelector<HTMLElement>("[data-lesson-anchor]");
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    anchor = { x: rect.left + rect.width / 2, y: rect.top + 4, ring: 0, side: "above" };
  }

  function frame(time: number) {
    const dt = previous ? Math.max(0, Math.min(0.1, (time - previous) / 1000)) : 0;
    previous = time;
    if (ready) {
      coach.step(dt, dt);
      lesson = coach.current && !coach.leaving ? coach.current : null;
      if (lesson) {
        lessonAge += dt;
        placeLesson();
      }
      noticeAge += dt;
      if (!blocking && !lesson) {
        if (shift) {
          tickShift(campaign, shift, dt);
          station = shift.chefStation;
          if (shift.lastMark && shift.lastMark.time !== lastMarkTime) {
            lastMarkTime = shift.lastMark.time;
            skillSound(shift.lastMark.skill, shift.lastMark.grade);
          }
          if (shift.arrivals !== lastArrivals) {
            lastArrivals = shift.arrivals;
            sfxTicket();
          }
          if (shift.receipts.length !== lastReceiptCount) {
            const got = shift.receipts.slice(lastReceiptCount);
            lastReceiptCount = shift.receipts.length;
            sfxServe(got.some((r) => r.grade >= 94));
          }
          if (shift.notice && shift.noticeAt === shift.realElapsed) say(shift.notice);
          offerSkill();
          followMusic(shift.elapsed, shift.duration);
          if (shift.status === "complete") closeDay();
        }
        if (activity && !activity.done) {
          tickActivity(activity, dt, mode, steering);
          finishActivity();
        }
      }
      uiClock += dt;
      if (uiClock >= 1 / 30) {
        uiClock = 0;
        shift = shift;
        activity = activity;
      }
      saveClock += dt;
      if (saveClock >= 2.5) {
        saveClock = 0;
        campaign = campaign;
        if (!pendingImport && !blocking) save();
      }
    }
    raf = requestAnimationFrame(frame);
  }

  function closeDay() {
    if (!shift) return;
    lastReceipts = shift.receipts.slice(-40);
    settleShift(campaign, shift);
    shift = null;
    activity = null;
    view = "room";
    bookOpen = true;
    bookTab = "today";
    finishMusic();
    coach.dismiss();
    lesson = null;
    save();
    refresh();
  }

  onMount(() => {
    read(mode);
    if (shift) void tick().then(() => pauseCard?.focus());
    else heading?.focus({ preventScroll: true });
    const unsubscribeShell = mountShell({
      isOver: () => false,
      isPaused: () => paused,
      pause: () => void pause(),
      togglePause: () => (paused ? void resume() : void pause()),
      // Tab cycles within whatever is on top: the book, the receipts, or the shop.
      playScope: () =>
        (bookOpen ? host?.querySelector(".shop-book") : receiptOpen ? host?.querySelector(".receipt-card") : null) ?? host,
      onReduceMotion: (value) => (reduced = value),
      onKey,
    });
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pagehide", save);
    raf = requestAnimationFrame(frame);
    return () => {
      save();
      cancelAnimationFrame(raf);
      unsubscribeShell();
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pagehide", save);
      stopMusic();
      coach.dismiss();
    };
  });
</script>

<div class="boba-stage shop-wall" aria-hidden="true"></div>
<div
  bind:this={host}
  class="shop boba-ui order-pixel-ui"
  class:is-reduced={reduced}
  role="dialog"
  aria-modal="true"
  aria-labelledby="order-shop-title"
  data-mode={mode}
  data-day={campaign.day}
  data-view={view}
>
  <div class="shop-frame" inert={paused || bookOpen || receiptOpen || !!pendingImport}>
    <header class="shop-header">
      <div class="shop-sign">
        <PixelIcon grid={illustration.grid} palette={illustration.palette} px={3} />
        <div>
          <h1 id="order-shop-title" bind:this={heading} tabindex="-1" data-arcade-tab-anchor>
            <span class="sr-only">order up</span><OrderPixelWord text="Order Up" />
          </h1>
          {#if mode === "expert"}<span class="shop-expert"><ExpertTag /></span>{:else}<span class="shop-tagline"
              >{today.event.name.toLowerCase()}</span
            >{/if}
        </div>
      </div>
      <div class="shop-meter" aria-label="Shift">
        <span
          >Day <strong><span class="sr-only">{campaign.day}</span><OrderPixelWord text={String(campaign.day)} cells={1.5} /></strong
          ></span
        >
        <!-- The clock's place is kept before the shop opens, so nothing shifts when it does. -->
        <span class="shop-clock" class:is-idle={!shift}
          >{shift && shift.status !== "open" ? "Last call" : "Time"}
          <strong
            ><span class="sr-only">{shift ? clock : "Not open"}</span><OrderPixelWord
              text={shift && shift.status === "open" ? clock : "0:00"}
              cells={1.5}
            /></strong
          ></span
        >
        <span class="shop-till"
          >Till <strong><span class="sr-only">{money(campaign.cash)}</span><OrderPixelWord text={money(campaign.cash)} cells={1.5} /></strong
          ></span
        >
        <button type="button" class="shop-points" onclick={openReceipts} aria-label="Points and receipts">
          <span>Points</span>
          <strong
            ><OrderPixelWord text={String(shift?.points ?? campaign.expansion.lastReport?.points ?? 0)} cells={1.5} /></strong
          >
        </button>
      </div>
      <div class="shop-controls">
      {#if shift}
        <HudButtons bind:this={hudButtons} {paused} on:pause={() => void pause()} />
      {:else}
        <div class="shop-modes" role="group" aria-label="Difficulty">
          <button class="boba-key" type="button" aria-pressed={mode === "normal"} onclick={() => changeMode("normal")}>
            <span class="sr-only">Normal</span><OrderPixelWord text="Normal" cells={1} />
          </button>
          <button class="boba-key" type="button" aria-pressed={mode === "expert"} onclick={() => changeMode("expert")}>
            <span class="sr-only">Expert</span><OrderPixelWord text="Expert" cells={1} />
          </button>
        </div>
        <button class="shop-menu boba-key" type="button" aria-label="Arcade menu" onclick={() => exit(true)}>Arcade</button>
      {/if}
      </div>
    </header>

    <main class="shop-content">
      <TicketRail {shift} {pegs} {mode} select={chooseTicket} />
      <div class="play-area">
        <WorldView
          {campaign}
          {shift}
          {view}
          paused={blocking || !!lesson}
          {reduced}
          {activity}
          {taste}
          {steering}
          selectedStation={station}
          weather={today.weather}
          {changeView}
          {chooseTicket}
          openBook={showBook}
          action={doAction}
          {arrangeFocus}
        />
        <SkillPanel
          {campaign}
          {shift}
          paused={blocking}
          {lesson}
          {reduced}
          {primary}
          {release}
          action={runAction}
          {guestAction}
          inspect={() => doAction("inspect")}
          cupSelect={(index) => {
            if (active) {
              active.cupIndex = index;
              refresh();
            }
          }}
        />
      </div>
      <footer class="tool-belt" aria-label="Tool belt">
        <button type="button" class="boba-key belt-book" onclick={() => showBook("today")}>
          Book
        </button>
        <div class="power-keys">
          {#each belt as power, i (i)}
            {@const count = power ? (campaign.expansion.powerups[power.id] ?? 0) : 0}
            {@const cooling = !!power && !!shift && (shift.cooldowns[power.id] ?? 0) > shift.realElapsed}
            <button
              type="button"
              class="boba-key power-key"
              disabled={!power || !shift || !count || cooling}
              aria-label={power ? `${power.name}, ${count} left` : "Empty belt slot"}
              title={power ? power.description : undefined}
              aria-keyshortcuts={keys[i]}
              onclick={() => power && use(power.id)}
            >
              {#if power}
                <Icon art={power.art} size={26} />
                <span class="power-count">{count}</span>
                {#if cooling && shift}<span class="cooldown">{Math.ceil(shift.cooldowns[power.id] - shift.realElapsed)}</span>{/if}
              {/if}
              <kbd aria-hidden="true">{keys[i]}</kbd>
            </button>
          {/each}
        </div>
        <!-- The runner's key keeps its place in shops without one, so the belt never shifts. -->
        <button type="button" class="boba-key runner-key" class:is-absent={!hasRunner} disabled={!shift || !hasRunner} onclick={callRunner}>Runner</button>
      </footer>
    </main>
  </div>

  {#if notice && noticeAge < 4 && !bookOpen && !paused}
    <p class="toast boba-chip" aria-hidden="true">{notice}</p>
  {/if}
  {#if storageWarning}
    <button type="button" class="storage-warning boba-key" onclick={exportSave}>{storageWarning}</button>
  {/if}

  {#if bookOpen}
    <ShopBook
      {campaign}
      {cheats}
      bind:tab={bookTab}
      live={!!shift}
      notice={storageWarning || notice}
      action={doAction}
      close={closeBook}
    />
  {/if}

  {#if paused && !bookOpen}
    <PauseCard
      bind:this={pauseCard}
      pixel
      resumeLabel="Resume shift"
      menuLabel="Shop book"
      on:resume={() => void resume()}
      on:menu={() => showBook("today")}
      on:exit={() => exit()}
    />
  {/if}

  {#if receiptOpen}
    <div class="boba-scrim boba-ui" role="dialog" aria-modal="true" aria-labelledby="receipt-title">
      <div class="boba-card order-pixel-sheet receipt-card">
        <header>
          <h2 id="receipt-title" class="boba-title">receipts</h2>
          <button type="button" class="boba-key order-pixel-paper-key" onclick={closeReceipts}>Close<kbd>Esc</kbd></button>
        </header>
        {#if shownReceipt}
          {@const position = receipts.indexOf(shownReceipt)}
          <div class="receipt-top">
            <Portrait
              name={shownReceipt.guest}
              face={shownReceipt.grade >= 90 ? "starry" : shownReceipt.grade >= 65 ? "content" : "meh"}
              size={52}
            />
            <span>
              <strong>{shownReceipt.name}</strong>
              <small>{RECIPE_BY_ID[shownReceipt.recipe]?.name}</small>
            </span>
            <b class="receipt-grade">{shownReceipt.grade}</b>
          </div>
          <ul class="receipt-skills">
            {#each shownReceipt.skills as step, i (i)}
              {@const skill = SKILLS.find((s) => s.id === step.skill)!}
              <li>
                <Icon art={skill.art} size={22} />
                <span>{skill.name}{#if step.source}<small> {step.source === "powerup" ? "tool" : "helper"}</small>{/if}</span>
                <b>{step.grade}</b>
              </li>
            {/each}
          </ul>
          <p class="receipt-total">
            <span>Drink <b>{money(shownReceipt.price)}</b></span>
            <span>Tip <b>{money(shownReceipt.tip)}</b></span>
          </p>
          <footer>
            <button
              type="button"
              class="boba-key order-pixel-paper-key"
              disabled={position <= 0}
              onclick={() => (receiptIndex = Math.max(0, position - 1))}
              aria-label="Previous receipt">←</button
            >
            <span>{position + 1} of {receipts.length}</span>
            <button
              type="button"
              class="boba-key order-pixel-paper-key"
              disabled={position >= receipts.length - 1}
              onclick={() => (receiptIndex = Math.min(receipts.length - 1, position + 1))}
              aria-label="Next receipt">→</button
            >
          </footer>
        {:else}
          <p class="boba-deck">Hand off a drink to print its receipt.</p>
        {/if}
      </div>
    </div>
  {/if}

  {#if pendingImport}
    <div class="boba-scrim boba-ui" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div class="boba-card order-pixel-sheet import-card">
        <h2 id="import-title" class="boba-title">import</h2>
        <p class="boba-deck">
          Replace this {pendingImport.campaign.mode} shop with day {pendingImport.campaign.day} and {money(
            pendingImport.campaign.cash,
          )}?
        </p>
        <div class="boba-actions is-start">
          <button type="button" class="boba-key is-primary" onclick={acceptImport}>Import</button>
          <button
            type="button"
            class="boba-key order-pixel-paper-key"
            onclick={() => {
              pendingImport = null;
              pendingRaw = "";
            }}>Keep this shop</button
          >
        </div>
      </div>
    </div>
  {/if}

  <Coach
    lesson={lesson && !blocking ? lesson : null}
    x={anchor.x}
    y={anchor.y}
    side={anchor.side}
    ring={anchor.ring}
    continuable
    hidden={blocking}
    on:continue={acknowledge}
    returnFocus={() => heading?.focus({ preventScroll: true })}
  />

  <input
    class="file-input"
    bind:this={importFile}
    type="file"
    accept="application/json,.json"
    onchange={inspectImport}
    aria-label="Import a save"
    tabindex="-1"
  />
  <span class="sr-only" role="status" aria-live="polite">{notice}</span>
</div>

<style>
  .shop-wall {
    background: #2c2629;
  }

  .shop {
    position: fixed;
    inset: 0;
    z-index: calc(var(--layer-overlay) + 2);
    color: #fff1dd;
  }

  .shop-frame {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    height: 100%;
  }

  .shop-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    min-height: 66px;
    box-sizing: border-box;
    gap: var(--space-4);
    padding: max(10px, env(safe-area-inset-top)) max(var(--space-5), env(safe-area-inset-right)) var(--space-3)
      max(var(--space-5), env(safe-area-inset-left));
    border-bottom: 3px solid #7c5d50;
    background: #302622;
    color: #fff1dd;
  }

  .shop-sign {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }

  .shop-sign h1 {
    margin: 0;
    color: #fff1dd;
    line-height: 0.94;
  }

  .shop-sign h1:focus {
    outline: none;
  }

  .shop-tagline {
    display: block;
    margin-top: 3px;
    overflow: hidden;
    color: #e5c9ae;
    font-size: 0.75rem;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .shop-expert {
    display: block;
    margin-top: 3px;
    --b-accent: #f18272;
  }

  .shop-meter,
  .shop-modes {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  /* The right end holds the difficulty keys before a shift and pause and
     sound during one, in the same room either way. */
  .shop-controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-3);
    min-width: 15.5rem;
  }

  .shop-clock {
    min-width: 3.4rem !important;
  }

  .shop-clock.is-idle {
    opacity: 0.55;
  }

  .shop-till {
    min-width: 6.5rem !important;
  }

  .shop-modes {
    gap: 3px;
  }

  .shop-meter > span,
  .shop-points {
    display: grid;
    justify-items: start;
    min-width: 2.85rem;
    color: #ead3b9;
    font-size: 0.75rem;
    line-height: 1.1;
  }

  .shop-meter strong {
    color: #fff2df;
    font-variant-numeric: tabular-nums;
  }

  .shop-points {
    border: 0;
    padding: 2px 4px;
    margin: -2px -4px;
    background: none;
    cursor: pointer;
    font-family: inherit;
  }

  .shop-points:focus-visible {
    outline: 2px dashed #ffe0a8;
  }

  .shop-modes button,
  .shop-menu {
    min-height: 42px;
    padding-inline: var(--space-2);
    font-size: 0.8125rem;
  }

  .shop-modes button[aria-pressed="true"] {
    --key-face: #eaceac;
    --key-foot: #b08060;
    --key-rule: #f0d8bc;
    color: #322621;
  }

  .shop-header :global(.boba-icon-btn) {
    width: 2.625rem;
    height: 2.625rem;
    color: #fff2df;
    background: #392a28;
    border-radius: 0;
    box-shadow:
      inset 0 0 0 2px #836456,
      inset 0 -4px #221b1e;
    clip-path: var(--notch);
  }

  .shop-header :global(.boba-icon-btn:hover) {
    color: #ffb89d;
    background: rgb(255 225 194 / 0.13);
  }

  .shop-content {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: var(--space-3);
    width: min(calc(100% - 2rem), 92rem);
    min-height: 0;
    margin: var(--space-3) auto max(var(--space-3), env(safe-area-inset-bottom));
  }

  .play-area {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(19rem, 1fr);
    gap: var(--space-3);
    min-height: 0;
  }

  .tool-belt {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    padding: 6px var(--space-3);
    background: #392b2b;
    box-shadow:
      inset 0 3px #966754,
      inset 0 -4px #211c21;
    clip-path: var(--notch);
  }

  .tool-belt .boba-key {
    min-height: 44px;
    padding-inline: var(--space-3);
    font-size: 0.8125rem;
  }

  .runner-key.is-absent {
    visibility: hidden;
  }

  .power-keys {
    display: flex;
    flex: 0 1 auto;
    gap: 6px;
    min-width: 0;
    margin-inline: auto;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .power-key.boba-key {
    position: relative;
    width: 3.75rem;
    min-width: 3.75rem;
    padding: 4px 18px 6px 6px;
  }

  .power-key:disabled :global(svg) {
    opacity: 0.55;
  }

  .power-count {
    position: absolute;
    top: 4px;
    right: 7px;
    font-size: 0.75rem;
  }

  .cooldown {
    position: absolute;
    inset: 6px auto auto 6px;
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    background: rgb(37 29 31 / 0.82);
    color: #ffe1ad;
    font-size: 0.75rem;
  }

  .power-key kbd {
    position: absolute;
    right: 4px;
    bottom: 6px;
  }

  .toast {
    position: absolute;
    left: 50%;
    bottom: calc(5.25rem + env(safe-area-inset-bottom));
    z-index: 6;
    max-width: min(30rem, calc(100% - 2rem));
    margin: 0;
    padding: 9px 14px;
    transform: translateX(-50%);
    color: #fff1dd;
    font-size: 0.8125rem;
    line-height: 1.35;
    pointer-events: none;
  }

  .storage-warning {
    position: absolute;
    top: 5rem;
    left: 50%;
    z-index: 7;
    max-width: min(26rem, calc(100% - 2rem));
    transform: translateX(-50%);
    font-size: 0.8125rem;
  }

  .receipt-card,
  .import-card {
    width: min(28rem, calc(100vw - 2rem));
    padding: var(--space-5);
    color: var(--b-text);
  }

  .receipt-card header,
  .receipt-card footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .receipt-card .boba-title,
  .import-card .boba-title {
    margin: 0;
  }

  .receipt-top {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: var(--space-4) 0 var(--space-3);
  }

  .receipt-top span {
    display: grid;
    flex: 1;
    gap: 2px;
  }

  .receipt-top strong {
    color: var(--b-strong);
    font-weight: 500;
  }

  .receipt-top small {
    color: var(--b-muted);
    font-size: 0.8125rem;
  }

  .receipt-grade {
    font-family: var(--font-display);
    font-size: 1.875rem;
    font-weight: 700;
    color: var(--b-strong);
  }

  .receipt-skills {
    display: grid;
    gap: 6px;
    margin: 0 0 var(--space-3);
    padding: 0;
    list-style: none;
    font-size: 0.8125rem;
  }

  .receipt-skills li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .receipt-skills li span {
    flex: 1;
  }

  .receipt-skills small {
    color: var(--b-muted);
    font-style: italic;
  }

  .receipt-total {
    display: flex;
    gap: var(--space-4);
    margin: 0 0 var(--space-4);
    padding-top: var(--space-2);
    border-top: 1px dashed var(--b-rule);
    font-size: 0.8125rem;
  }

  .receipt-card footer span {
    font-size: 0.8125rem;
  }

  .import-card .boba-deck {
    margin: var(--space-3) 0 var(--space-4);
  }

  .file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }

  @media (max-width: 1100px) {
    .shop-header {
      grid-template-columns: minmax(0, 1fr) auto auto;
    }

    .shop-tagline {
      display: none;
    }

    .play-area {
      grid-template-columns: minmax(0, 1.25fr) minmax(17rem, 1fr);
    }
  }

  @media (max-width: 760px) {
    .shop-controls {
      min-width: 0;
      gap: 4px;
    }

    .shop-header {
      gap: var(--space-2);
      padding-inline: max(var(--space-2), env(safe-area-inset-left)) max(var(--space-2), env(safe-area-inset-right));
    }

    .shop-sign :global(.pixel-icon) {
      display: none;
    }

    .shop-meter {
      gap: var(--space-2);
    }

    .shop-meter > span,
    .shop-points {
      min-width: 2.2rem;
    }

    .shop-modes button {
      padding-inline: var(--space-1-5);
    }

    .shop-content {
      width: calc(100% - 1rem);
      gap: var(--space-2);
      margin-top: var(--space-2);
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .play-area {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto auto;
    }

    .tool-belt {
      position: sticky;
      bottom: 0;
      z-index: 3;
      padding: 4px 6px;
      gap: 4px;
    }

    .tool-belt .boba-key {
      padding-inline: var(--space-2);
    }

    .power-key.boba-key {
      width: 3.25rem;
      min-width: 3.25rem;
    }
  }

  @media (max-width: 420px) {
    .shop-till {
      display: none !important;
    }

    .belt-book {
      display: none;
    }
  }

  @media (orientation: landscape) and (max-height: 540px) {
    .shop-header {
      padding-block: 4px;
    }

    .shop-tagline,
    .shop-expert {
      display: none;
    }

    .shop-content {
      gap: 6px;
      margin-top: 6px;
    }

    .play-area {
      grid-template-columns: minmax(0, 1.15fr) minmax(16rem, 1fr);
    }

    .tool-belt {
      padding-block: 2px;
    }

    .tool-belt .boba-key {
      min-height: 38px;
    }
  }
</style>
