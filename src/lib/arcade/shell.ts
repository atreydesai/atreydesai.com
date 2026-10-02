// What every arcade game does the same way around its own rules: leaving,
// timers it can cancel together, the end of a run, and the input and window
// plumbing (auto-pause, Tab cycling, the pause key, Reduce Motion, resizing).
// Pause and resume stay in each game, since what they hold differs.

import type { EventDispatcher } from "svelte";
import type { GameId } from "$lib/boba";
import { finishMusic, sfxBlip, sfxGameOver } from "$lib/sfx";
import { trapFocus } from "./focus";
import { recordScore } from "./scores";

/** Back to the arcade menu, or out of the arcade entirely. */
export function arcadeExits(dispatch: EventDispatcher<{ close: null; menu: null }>) {
  return {
    exit() {
      sfxBlip();
      dispatch("close");
    },
    toMenu() {
      sfxBlip();
      dispatch("menu");
    },
  };
}

/** Timeouts a game can cancel together when it closes. */
export function createTimers() {
  const pending = new Set<ReturnType<typeof setTimeout>>();
  return {
    later(callback: () => void, delay: number) {
      const timer = setTimeout(() => {
        pending.delete(timer);
        callback();
      }, delay);
      pending.add(timer);
    },
    clear() {
      for (const timer of pending) clearTimeout(timer);
      pending.clear();
    },
  };
}

/**
 * The end of every run: the music winds down, the closing sting plays, and
 * the score is recorded. Returns the personal best and whether this run set it.
 */
export function concludeRun(game: GameId, score: number, reason: "hearts" | "time" = "hearts") {
  finishMusic();
  sfxGameOver(reason);
  return recordScore(game, score);
}

/** True when a key press belongs to a focused button or field, not the game. */
export function isOnControl(event: KeyboardEvent) {
  return event.target instanceof HTMLElement && !!event.target.closest("button, input");
}

interface ShellOptions {
  /** The results slip is up. */
  isOver: () => boolean;
  isPaused: () => boolean;
  /** Pause if the game can be paused right now; otherwise do nothing. */
  pause: () => void;
  togglePause: () => void;
  /** Where Tab cycles while the game is being played. */
  playScope: () => Element | null;
  /** The game's own keys, after Tab, held-down repeats, and `p` are handled. */
  onKey?: (event: KeyboardEvent) => void;
  /** Re-layout on window resize, and whenever `observe` changes size. */
  onResize?: () => void;
  observe?: Element;
  /** Follows Reduce Motion live, starting with its current value. */
  onReduceMotion?: (reduce: boolean) => void;
  /** Also pause when the pointer leaves the page (catch is played with it). */
  pauseOnPointerLeave?: boolean;
}

/** Wires a game into the window. Call from onMount; returns the teardown. */
export function mountShell(options: ShellOptions): () => void {
  const { isOver, isPaused, pause, togglePause, playScope, onKey, onResize, observe } = options;

  const onKeyDown = (event: KeyboardEvent) => {
    // Tab cycles within whichever layer is on top.
    if (event.key === "Tab") {
      if (isOver()) trapFocus(event, document.querySelector(".boba-over-card"));
      else if (isPaused()) trapFocus(event, document.querySelector(".boba-pause-card"));
      else trapFocus(event, playScope());
      return;
    }
    if (event.repeat || isOver()) return;
    if (event.key.toLowerCase() === "p") {
      event.preventDefault();
      togglePause();
      return;
    }
    onKey?.(event);
  };
  // Leaving the window or the tab pauses play.
  const onBlur = () => pause();
  const onVisibility = () => {
    if (document.hidden) pause();
  };
  const onWindowResize = () => onResize?.();

  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const syncMotion = () => options.onReduceMotion?.(motion.matches);
  syncMotion();

  const resizeObserver = observe && onResize ? new ResizeObserver(() => onResize()) : null;
  if (resizeObserver && observe) resizeObserver.observe(observe);
  const root = document.documentElement;

  motion.addEventListener("change", syncMotion);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("blur", onBlur);
  window.addEventListener("resize", onWindowResize);
  document.addEventListener("visibilitychange", onVisibility);
  if (options.pauseOnPointerLeave) root.addEventListener("mouseleave", onBlur);

  return () => {
    resizeObserver?.disconnect();
    motion.removeEventListener("change", syncMotion);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("resize", onWindowResize);
    document.removeEventListener("visibilitychange", onVisibility);
    root.removeEventListener("mouseleave", onBlur);
  };
}
