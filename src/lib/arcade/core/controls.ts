// Held controls, for a game steered by keys held down and by on-screen
// hold buttons (sugar rush's jump, slide and rush; tea minus's tilts and
// burn). Each source holds a control on its own, so letting go of one never
// lets go of another still held: a key by its name (W and Space both burn),
// a hold button by each pointer on it and by a key pressed while it has
// focus. A press is also latched until an engine step has seen it (in a
// lesson's slow motion, frames can pass without one), and a touch the
// browser takes back clears only its own press.
//
// The component keeps its own filtering (Tab, modifiers, pause, a focused
// control, Enter for a lesson) and calls these from its handlers; an engine
// step reads `read()` and then `clearPresses()`. DOM-light: it touches only
// the events it is handed.

export type Held<C extends string> = Record<C, boolean>;

export interface ControlsOptions<C extends string> {
  /** Every control, in the order the game names them. */
  names: readonly C[];
  /** The control each key holds, by `keyName`. */
  keys: Readonly<Record<string, C>>;
  /** Whether a press counts now (not while paused, nor once the game is over). */
  enabled: () => boolean;
  /** Told what the hold buttons hold whenever it changes, as a fresh object (so markup redraws). */
  onPads?: (pads: Readonly<Held<C>>) => void;
}

/** A key as the controls name it: a letter in lower case (Shift+W still burns), anything else as the browser names it. */
export const keyName = (event: KeyboardEvent) => (event.key.length === 1 ? event.key.toLowerCase() : event.key);

export function createControls<C extends string>({ names, keys: keyMap, enabled, onPads }: ControlsOptions<C>) {
  const none = () => Object.fromEntries(names.map((name) => [name, false])) as Held<C>;
  /** Keys down, by physical source, and what they hold. */
  const keysDown = new Map<string, C>();
  const keys = none();
  /** Pointers on each hold button, and a key holding it while it has focus. */
  const padPointers = Object.fromEntries(names.map((name) => [name, new Set<number>()])) as Record<C, Set<number>>;
  const padKeys = none();
  /** What the hold buttons hold now. */
  let pads = none();
  /** Presses not yet seen by a step: by key, by a hold button's key, and by pointer. */
  const pressedKeys = none();
  const pressedPadKeys = none();
  const pressedPointers = new Map<number, C>();
  const pressedPads = none();
  /** The controls as the next engine step sees them. */
  const input = none();

  /** What the keys down hold: a control stays held while any of its keys is. */
  function syncKeys() {
    for (const name of names) keys[name] = false;
    for (const control of keysDown.values()) keys[control] = true;
  }

  /** What the hold buttons hold: any pointer on one, or a key on it while it has focus. */
  function syncPads() {
    let changed = false;
    for (const name of names) if ((padPointers[name].size > 0 || padKeys[name]) !== pads[name]) changed = true;
    if (!changed) return;
    const next = none();
    for (const name of names) next[name] = padPointers[name].size > 0 || padKeys[name];
    pads = next;
    onPads?.(pads);
  }

  /** The presses by pointer still waiting for a step, by control. */
  function syncPointerPresses() {
    for (const name of names) pressedPads[name] = false;
    for (const control of pressedPointers.values()) pressedPads[control] = true;
  }

  function clearPresses() {
    for (const name of names) pressedKeys[name] = pressedPadKeys[name] = pressedPads[name] = false;
    pressedPointers.clear();
  }

  return {
    /** What the hold buttons hold now. */
    get pads(): Readonly<Held<C>> {
      return pads;
    },
    /** The control `key` holds, if any. */
    control(key: string): C | undefined {
      return keyMap[key];
    },
    /** A key the game's own handler let through went down: it holds its control, and with `latch` its press waits for a step. */
    keyDown(key: string, latch: boolean, source = key) {
      const control = keyMap[key];
      if (!control) return;
      keysDown.set(source, control);
      syncKeys();
      if (latch) pressedKeys[control] = true;
    },
    /** A key came up: its control stays held if another of its keys is still down. */
    keyUp(source: string) {
      if (keysDown.delete(source)) syncKeys();
    },
    /**
     * A pointer down on a hold button: holds `control` until that pointer
     * lifts. Returns whether it counted as a press (not another mouse
     * button, nor while the game is paused or over).
     */
    padDown(event: PointerEvent, control: C) {
      if (event.pointerType === "mouse" && event.button !== 0) return false;
      event.preventDefault();
      if (!enabled()) return false;
      const target = event.currentTarget as HTMLElement;
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Capture is a nicety; the up and cancel handlers still release.
      }
      padPointers[control].add(event.pointerId);
      pressedPointers.set(event.pointerId, control);
      syncPointerPresses();
      syncPads();
      return true;
    },
    /** A pointer lifted (or its capture lost) lets go of its own hold only. */
    padUp(event: PointerEvent, control: C) {
      if (padPointers[control].delete(event.pointerId)) syncPads();
    },
    /** A touch the browser took back (a scroll, a system gesture) never counts as a press, and ends only its own hold. */
    padCancel(event: PointerEvent, control: C) {
      padPointers[control].delete(event.pointerId);
      if (pressedPointers.delete(event.pointerId)) syncPointerPresses();
      syncPads();
    },
    /** Space or Enter on a focused hold button holds it, as a key of its own. Returns whether it was a fresh press. */
    padKey(event: KeyboardEvent, control: C, down: boolean) {
      if (event.key !== " " && event.key !== "Enter") return false;
      event.preventDefault();
      if (down) {
        if (event.repeat || !enabled()) return false;
        padKeys[control] = true;
        pressedPadKeys[control] = true;
        syncPads();
        return true;
      }
      padKeys[control] = false;
      syncPads();
      return false;
    },
    /** Focus leaving a hold button ends the key's hold on it, not a pointer's. */
    padBlur(control: C) {
      if (!padKeys[control]) return;
      padKeys[control] = false;
      syncPads();
    },
    /** Held right now, by a key or a hold button (a press waiting for a step doesn't count). */
    holding(control: C) {
      return keys[control] || pads[control];
    },
    /** The controls held now, and any press a step hasn't seen yet: one object, reused. */
    read(): Readonly<Held<C>> {
      for (const name of names) {
        input[name] = keys[name] || pads[name] || pressedKeys[name] || pressedPadKeys[name] || pressedPads[name];
      }
      return input;
    },
    /** A step has seen the presses (or a new run starts without them). */
    clearPresses,
    /** Lets go of everything (pause, blur, the end of a run). */
    releaseAll() {
      keysDown.clear();
      syncKeys();
      for (const name of names) {
        padPointers[name].clear();
        padKeys[name] = false;
      }
      clearPresses();
      syncPads();
    },
  };
}

const COARSE = "(hover: none) and (pointer: coarse)";

/**
 * Whether to show touch controls: on a device whose main pointer is coarse
 * and can't hover, or once any touch has been seen (a touch laptop, a
 * tablet with a mouse). `touch` is the answer now; `onChange` hears of each
 * change after. Call `stop` on close.
 */
export function watchTouch(onChange: (touch: boolean) => void) {
  const query = window.matchMedia(COARSE);
  let coarse = query.matches;
  let seen = false;
  let touch = coarse;
  const sync = () => {
    const next = coarse || seen;
    if (next === touch) return;
    touch = next;
    onChange(touch);
  };
  const onQuery = () => {
    coarse = query.matches;
    sync();
  };
  const onFirstTouch = (event: PointerEvent) => {
    if (event.pointerType !== "touch" || seen) return;
    seen = true;
    sync();
  };
  query.addEventListener("change", onQuery);
  window.addEventListener("pointerdown", onFirstTouch, true);
  return {
    touch,
    stop() {
      query.removeEventListener("change", onQuery);
      window.removeEventListener("pointerdown", onFirstTouch, true);
    },
  };
}
