import assert from "node:assert/strict";
import test from "node:test";

import { createControls, keyName } from "../src/lib/arcade/core/controls.ts";
import { createRng } from "../src/lib/arcade/core/rng.ts";

const key = (name, repeat = false) => ({ key: name, repeat, preventDefault() {} });
const pointer = (pointerId, pointerType = "touch", button = 0) => ({
  pointerId,
  pointerType,
  button,
  currentTarget: { setPointerCapture() {} },
  preventDefault() {},
});

const LANDER_KEYS = { ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", ArrowUp: "thrust", w: "thrust", " ": "thrust" };
const RUNNER_KEYS = { " ": "jump", ArrowUp: "jump", w: "jump", ArrowDown: "down", s: "down", x: "rush", Shift: "rush" };

/**
 * Tea minus's input as the component wrote it before core/controls.ts,
 * from its handlers' game checks on (`trySkip` counts its calls).
 */
function oldTeaMinus(game) {
  const KEY_CONTROLS = LANDER_KEYS;
  const keysDown = new Set();
  const keys = { left: false, right: false, thrust: false };
  const padPointers = { left: new Set(), right: new Set(), thrust: new Set() };
  const padKeys = { left: false, right: false, thrust: false };
  let touchHeld = { left: false, right: false, thrust: false };
  const pressedKeys = { left: false, right: false, thrust: false };
  const pressedPadKeys = { left: false, right: false, thrust: false };
  const pressedPointers = new Map();
  const pressedPads = { left: false, right: false, thrust: false };
  function clearPresses() {
    pressedKeys.left = pressedKeys.right = pressedKeys.thrust = false;
    pressedPadKeys.left = pressedPadKeys.right = pressedPadKeys.thrust = false;
    pressedPads.left = pressedPads.right = pressedPads.thrust = false;
    pressedPointers.clear();
  }
  const input = { left: false, right: false, thrust: false };
  function controls() {
    input.left = keys.left || touchHeld.left || pressedKeys.left || pressedPadKeys.left || pressedPads.left;
    input.right = keys.right || touchHeld.right || pressedKeys.right || pressedPadKeys.right || pressedPads.right;
    input.thrust = keys.thrust || touchHeld.thrust || pressedKeys.thrust || pressedPadKeys.thrust || pressedPads.thrust;
    return input;
  }
  const trySkip = () => game.skips++;
  function onKeyDown(event) {
    if (game.gameOver || game.paused) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const control = KEY_CONTROLS[key];
    if (key === "Enter") {
      if (!event.repeat) trySkip();
      return;
    }
    if (!control) return;
    event.preventDefault();
    keysDown.add(key);
    syncKeys();
    if (event.repeat) return;
    pressedKeys[control] = true;
    trySkip();
  }
  function onKeyUp(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (keysDown.delete(key)) syncKeys();
  }
  function syncKeys() {
    keys.left = keys.right = keys.thrust = false;
    for (const key of keysDown) {
      const control = KEY_CONTROLS[key];
      if (control) keys[control] = true;
    }
  }
  function syncPads() {
    const left = padPointers.left.size > 0 || padKeys.left;
    const right = padPointers.right.size > 0 || padKeys.right;
    const thrust = padPointers.thrust.size > 0 || padKeys.thrust;
    if (left !== touchHeld.left || right !== touchHeld.right || thrust !== touchHeld.thrust) touchHeld = { left, right, thrust };
  }
  function syncPointerPresses() {
    pressedPads.left = pressedPads.right = pressedPads.thrust = false;
    for (const control of pressedPointers.values()) pressedPads[control] = true;
  }
  function releaseAll() {
    keysDown.clear();
    syncKeys();
    for (const control of ["left", "right", "thrust"]) {
      padPointers[control].clear();
      padKeys[control] = false;
    }
    clearPresses();
    syncPads();
  }
  function padDown(event, control) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    if (game.paused || game.gameOver) return;
    const target = event.currentTarget;
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // As in the game.
    }
    padPointers[control].add(event.pointerId);
    pressedPointers.set(event.pointerId, control);
    syncPointerPresses();
    syncPads();
    trySkip();
  }
  function padUp(event, control) {
    if (padPointers[control].delete(event.pointerId)) syncPads();
  }
  function padCancel(event, control) {
    padPointers[control].delete(event.pointerId);
    if (pressedPointers.delete(event.pointerId)) syncPointerPresses();
    syncPads();
  }
  function padKey(event, control, down) {
    if (event.key !== " " && event.key !== "Enter") return;
    event.preventDefault();
    if (down) {
      if (event.repeat || game.paused || game.gameOver) return;
      padKeys[control] = true;
      pressedPadKeys[control] = true;
      syncPads();
      trySkip();
    } else {
      padKeys[control] = false;
      syncPads();
    }
  }
  function padBlur(control) {
    if (!padKeys[control]) return;
    padKeys[control] = false;
    syncPads();
  }
  return {
    onKeyDown,
    onKeyUp,
    padDown,
    padUp,
    padCancel,
    padKey,
    padBlur,
    releaseAll,
    clearPresses,
    read: () => ({ ...controls() }),
    get pads() {
      return touchHeld;
    },
    holding: (control) => keys[control] || touchHeld[control],
  };
}

/** Tea minus's handlers on the core controls, as the component now has them. */
function newTeaMinus(game) {
  let touchHeld = { left: false, right: false, thrust: false };
  const input = createControls({
    names: ["left", "right", "thrust"],
    keys: LANDER_KEYS,
    enabled: () => !game.paused && !game.gameOver,
    onPads: (pads) => (touchHeld = pads),
  });
  const trySkip = () => game.skips++;
  return {
    onKeyDown(event) {
      if (game.gameOver || game.paused) return;
      const key = keyName(event);
      if (key === "Enter") {
        if (!event.repeat) trySkip();
        return;
      }
      if (!input.control(key)) return;
      event.preventDefault();
      input.keyDown(key, !event.repeat);
      if (event.repeat) return;
      trySkip();
    },
    onKeyUp: (event) => input.keyUp(keyName(event)),
    padDown(event, control) {
      if (input.padDown(event, control)) trySkip();
    },
    padUp: input.padUp,
    padCancel: input.padCancel,
    padKey(event, control, down) {
      if (input.padKey(event, control, down)) trySkip();
    },
    padBlur: input.padBlur,
    releaseAll: input.releaseAll,
    clearPresses: input.clearPresses,
    read: () => ({ ...input.read() }),
    get pads() {
      return touchHeld;
    },
    holding: input.holding,
  };
}

test("tea minus's keys and hold buttons behave exactly as before on the core controls", () => {
  const KEYS = ["ArrowLeft", "a", "A", "ArrowRight", "d", "ArrowUp", "w", "W", " ", "Enter", "q", "Shift"];
  const CONTROLS = ["left", "right", "thrust"];
  for (const seed of [1, 2, 3, 4, 5, 17, 99, 2024]) {
    const random = createRng(seed);
    const pick = (list) => list[Math.floor(random() * list.length)];
    const oldGame = { paused: false, gameOver: false, skips: 0 };
    const newGame = { paused: false, gameOver: false, skips: 0 };
    const old = oldTeaMinus(oldGame);
    const now = newTeaMinus(newGame);
    let oldPads = old.pads;
    let newPads = now.pads;
    for (let n = 0; n < 3000; n++) {
      const roll = random();
      const control = pick(CONTROLS);
      const id = 1 + Math.floor(random() * 4);
      const type = random() < 0.85 ? "touch" : "mouse";
      const button = random() < 0.9 ? 0 : 2;
      let what;
      if (roll < 0.2) {
        const name = pick(KEYS);
        const repeat = random() < 0.3;
        what = `keydown ${name}${repeat ? " (repeat)" : ""}`;
        for (const side of [old, now]) side.onKeyDown(key(name, repeat));
      } else if (roll < 0.35) {
        const name = pick(KEYS);
        what = `keyup ${name}`;
        for (const side of [old, now]) side.onKeyUp(key(name));
      } else if (roll < 0.5) {
        what = `pointerdown ${id} on ${control}`;
        for (const side of [old, now]) side.padDown(pointer(id, type, button), control);
      } else if (roll < 0.6) {
        what = `pointerup ${id} on ${control}`;
        for (const side of [old, now]) side.padUp(pointer(id, type, button), control);
      } else if (roll < 0.66) {
        what = `pointercancel ${id} on ${control}`;
        for (const side of [old, now]) side.padCancel(pointer(id, type, button), control);
      } else if (roll < 0.74) {
        const name = pick([" ", "Enter", "x"]);
        const down = random() < 0.6;
        const repeat = random() < 0.2;
        what = `pad key ${name} ${down ? "down" : "up"} on ${control}`;
        for (const side of [old, now]) side.padKey(key(name, repeat), control, down);
      } else if (roll < 0.78) {
        what = `blur ${control}`;
        for (const side of [old, now]) side.padBlur(control);
      } else if (roll < 0.9) {
        what = "a step reads and clears";
        assert.deepEqual(now.read(), old.read(), `seed ${seed}, event ${n}: step input`);
        for (const side of [old, now]) side.clearPresses();
      } else if (roll < 0.93) {
        what = "release all";
        for (const side of [old, now]) side.releaseAll();
      } else if (roll < 0.97) {
        what = "pause toggled";
        oldGame.paused = newGame.paused = !oldGame.paused;
      } else {
        what = "game over toggled";
        oldGame.gameOver = newGame.gameOver = !oldGame.gameOver;
      }
      const label = `seed ${seed}, event ${n} (${what})`;
      assert.deepEqual(now.read(), old.read(), `${label}: input`);
      assert.deepEqual({ ...now.pads }, { ...old.pads }, `${label}: pads drawn held`);
      // The pads object is replaced exactly when the old one was, so the markup redraws as often.
      assert.equal(now.pads !== newPads, old.pads !== oldPads, `${label}: pads replaced`);
      oldPads = old.pads;
      newPads = now.pads;
      for (const c of CONTROLS) assert.equal(now.holding(c), old.holding(c), `${label}: holding ${c}`);
      assert.equal(newGame.skips, oldGame.skips, `${label}: skips`);
    }
  }
});

/**
 * Sugar rush's input before core/controls.ts: one flag per control for the
 * keys and one for the pads, so any source letting go let go of the control.
 */
function oldSugarRush(game) {
  const KEY_CONTROLS = RUNNER_KEYS;
  const keys = { jump: false, down: false, rush: false };
  let touchHeld = { jump: false, down: false, rush: false };
  const input = { jump: false, down: false, rush: false };
  const pressedKeys = { jump: false, down: false, rush: false };
  const pressedPads = { jump: false, down: false, rush: false };
  const clearPressed = () => {
    pressedKeys.jump = pressedKeys.down = pressedKeys.rush = false;
    pressedPads.jump = pressedPads.down = pressedPads.rush = false;
  };
  function controls() {
    input.jump = keys.jump || touchHeld.jump || pressedKeys.jump || pressedPads.jump;
    input.down = keys.down || touchHeld.down || pressedKeys.down || pressedPads.down;
    input.rush = keys.rush || touchHeld.rush || pressedKeys.rush || pressedPads.rush;
    return input;
  }
  function holdPad(control, down) {
    if (down && (game.paused || game.gameOver)) return;
    if (touchHeld[control] === down) return;
    touchHeld = { ...touchHeld, [control]: down };
    if (down) pressedPads[control] = true;
  }
  return {
    onKeyDown(event) {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const control = KEY_CONTROLS[key];
      if (!control) return;
      keys[control] = true;
      pressedKeys[control] = true;
    },
    onKeyUp(event) {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const control = KEY_CONTROLS[key];
      if (control) keys[control] = false;
    },
    padDown: (event, control) => holdPad(control, true),
    padUp: (event, control) => holdPad(control, false),
    padCancel(event, control) {
      pressedPads[control] = false;
      holdPad(control, false);
    },
    padKey(event, control, down) {
      if (down && event.repeat) return;
      holdPad(control, down);
    },
    padBlur: (control) => holdPad(control, false),
    clearPresses: clearPressed,
    read: () => ({ ...controls() }),
    get pads() {
      return touchHeld;
    },
  };
}

function newSugarRush(game) {
  let touchHeld = { jump: false, down: false, rush: false };
  const input = createControls({
    names: ["jump", "down", "rush"],
    keys: RUNNER_KEYS,
    enabled: () => !game.paused && !game.gameOver,
    onPads: (pads) => (touchHeld = pads),
  });
  return {
    onKeyDown(event) {
      const key = keyName(event);
      if (!input.control(key)) return;
      input.keyDown(key, true);
    },
    onKeyUp: (event) => input.keyUp(keyName(event)),
    padDown: input.padDown,
    padUp: input.padUp,
    padCancel: input.padCancel,
    padKey: input.padKey,
    padBlur: input.padBlur,
    clearPresses: input.clearPresses,
    read: () => ({ ...input.read() }),
    get pads() {
      return touchHeld;
    },
  };
}

test("sugar rush plays as before wherever one source holds a control at a time", () => {
  // Scripts of [event, ...args]; "step" reads what a step would see, then clears its presses.
  const scripts = [
    // A key tapped between steps still counts once.
    [["down", " "], ["up", " "], ["step"], ["step"]],
    // Held across steps, its repeats latching too, then let go.
    [["down", "ArrowUp"], ["step"], ["down", "ArrowUp", true], ["step"], ["up", "ArrowUp"], ["step"]],
    // Slide and rush together, by keys.
    [["down", "s"], ["down", "Shift"], ["step"], ["up", "s"], ["step"], ["up", "Shift"], ["step"]],
    // A pad tapped by one finger between steps, then held and lifted.
    [["pad", 1, "jump"], ["lift", 1, "jump"], ["step"], ["pad", 2, "down"], ["step"], ["step"], ["lift", 2, "down"], ["step"]],
    // A touch taken back never counts as a press.
    [["pad", 3, "rush"], ["cancel", 3, "rush"], ["step"]],
    // Space on a focused pad, its repeat ignored, then let go.
    [["padkey", "jump", true], ["step"], ["padkey", "jump", true, true], ["step"], ["padkey", "jump", false], ["step"]],
    // Paused, a pad press does nothing.
    [["pause"], ["pad", 4, "jump"], ["step"], ["lift", 4, "jump"], ["pause"], ["step"]],
  ];
  for (const script of scripts) {
    const oldGame = { paused: false, gameOver: false };
    const newGame = { paused: false, gameOver: false };
    const old = oldSugarRush(oldGame);
    const now = newSugarRush(newGame);
    for (const [index, [what, a, b, c]] of script.entries()) {
      for (const side of [old, now]) {
        if (what === "down") side.onKeyDown(key(a, !!b));
        else if (what === "up") side.onKeyUp(key(a));
        else if (what === "pad") side.padDown(pointer(a), b);
        else if (what === "lift") side.padUp(pointer(a), b);
        else if (what === "cancel") side.padCancel(pointer(a), b);
        else if (what === "padkey") side.padKey(key(" ", !!c), a, b);
      }
      if (what === "pause") oldGame.paused = newGame.paused = !oldGame.paused;
      const label = `${JSON.stringify(script)} at ${index}`;
      assert.deepEqual(now.read(), old.read(), `${label}: input`);
      assert.deepEqual({ ...now.pads }, { ...old.pads }, `${label}: pads`);
      if (what === "step") for (const side of [old, now]) side.clearPresses();
    }
  }
});

test("sugar rush now keeps a control held while another of its sources still holds it", () => {
  const game = { paused: false, gameOver: false };
  const now = newSugarRush(game);
  // Space and Up both jump: letting go of one leaves the jump held.
  now.onKeyDown(key(" "));
  now.onKeyDown(key("ArrowUp"));
  now.onKeyUp(key(" "));
  now.clearPresses();
  assert.equal(now.read().jump, true);
  now.onKeyUp(key("ArrowUp"));
  assert.equal(now.read().jump, false);
  // Two fingers on the jump pad: lifting one leaves it held, and drawn held.
  now.padDown(pointer(1), "jump");
  now.padDown(pointer(2), "jump");
  now.padUp(pointer(1), "jump");
  now.clearPresses();
  assert.equal(now.read().jump, true);
  assert.equal(now.pads.jump, true);
  // Focus leaving the pad ends a key's hold on it, not the finger's.
  now.padBlur("jump");
  assert.equal(now.read().jump, true);
  // A second finger taken back cancels only its own press.
  now.padDown(pointer(3), "down");
  now.padDown(pointer(4), "down");
  now.padCancel(pointer(4), "down");
  assert.equal(now.read().down, true);
});
