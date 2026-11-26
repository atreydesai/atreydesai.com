import { get } from "svelte/store";
import { arcadeExpert, type GameId } from "#lib/boba.ts";

// Personal bests are kept on this device and checked against the shared
// leaderboard behind /api/scores (one board per game and mode). The board is
// the record: whenever it is read for the name last signed on this device,
// a best it holds that the device has lost comes back. On the device a best
// lives in localStorage; older bests were cookies (catch keeps its original
// names so existing bests carry over), which Safari expires seven days after
// they were last written, so they are still read and never trusted alone.
// Expert runs keep their own bests and their own boards. Every function here
// takes the mode from the menu's switch unless it is given one, so a game
// needs no plumbing for it.

/** Which board a run belongs on. */
export type ArcadeMode = "normal" | "expert";

export function currentMode(): ArcadeMode {
  return get(arcadeExpert) ? "expert" : "normal";
}

// Catch went endless (v3), and sugar rush (v2) and cup stack's perfects (v2)
// got much harder, so their bests start over: an old best was set under
// different rules. Sugar rush's second climb (late game only) kept its v2
// board on purpose: the opening is unchanged, and existing bests stay.
const BEST_COOKIE: Record<GameId, string> = {
  catch: "boba_best_v3",
  stab: "boba_best_stab_v1",
  orders: "boba_best_orders_v2",
  stack: "boba_best_stack_v2",
  lander: "boba_best_lander_v1",
  runner: "boba_best_runner_v2",
  spill: "boba_best_spill_v1",
};

function bestCookie(game: GameId, mode: ArcadeMode) {
  if (game === "spill" && mode === "normal") return "boba_best_spill_v2";
  return mode === "expert" ? `${BEST_COOKIE[game]}_expert` : BEST_COOKIE[game];
}

const ONE_YEAR = 31_536_000;

function readCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

// One storage key per best (`boba_best:<cookie name>`), so two tabs saving
// bests for different games can't overwrite each other's. When storage is
// off, bests are kept for this visit in memory, besides the cookie.
const BEST_KEY = (name: string) => `boba_best:${name}`;
const sessionBests = new Map<string, number>();

function readStored(name: string) {
  try {
    return Math.floor(Number(localStorage.getItem(BEST_KEY(name)))) || 0;
  } catch {
    return sessionBests.get(name) ?? 0;
  }
}

/** Raises a stored best to `score`, never lowering it (another tab may have saved more a moment ago). */
function raiseStored(key: string, score: number) {
  try {
    if (score > (Math.floor(Number(localStorage.getItem(key))) || 0)) localStorage.setItem(key, String(score));
  } catch {
    // Storage off: the memory copy holds it for this visit.
  }
}

/** A best earned on this device. */
function writeBest(game: GameId, mode: ArcadeMode, score: number) {
  const name = bestCookie(game, mode);
  sessionBests.set(name, Math.max(score, sessionBests.get(name) ?? 0));
  raiseStored(BEST_KEY(name), score);
  // The old cookie too, only ever upward, for a browser with storage off.
  if (score > (parseInt(readCookie(name) ?? "", 10) || 0)) writeCookie(name, String(score));
}

// A best the leaderboard holds for a signed name is kept apart from the
// device's own, under that name, so signing as someone else never carries
// the last name's best over.
const BOARD_BEST_KEY = (player: string, name: string) => `boba_board_best:${player.trim().toLocaleLowerCase()}:${name}`;

function readBoardBest(name: string) {
  const player = readPlayerName().trim();
  if (!player) return 0;
  try {
    return Math.floor(Number(localStorage.getItem(BOARD_BEST_KEY(player, name)))) || 0;
  } catch {
    return sessionBests.get(`board:${player.toLocaleLowerCase()}:${name}`) ?? 0;
  }
}

/**
 * The best on this device for a game and mode: the highest of storage, this
 * visit's memory and the old cookie. A cookie that holds more than storage
 * (a best from before storage was used) is copied into storage, so it
 * outlives the cookie.
 */
export function readBest(game: GameId, mode: ArcadeMode = currentMode()) {
  const name = bestCookie(game, mode);
  const stored = Math.max(readStored(name), sessionBests.get(name) ?? 0);
  const cookie = parseInt(readCookie(name) ?? "", 10) || 0;
  if (cookie > stored) {
    raiseStored(BEST_KEY(name), cookie);
    sessionBests.set(name, cookie);
  }
  // The device's own best, or the signed name's best on the board if that is higher.
  return Math.max(stored, cookie, readBoardBest(name));
}

/** Saves `score` if it beats the stored best for the mode being played. */
export function recordScore(game: GameId, score: number, mode: ArcadeMode = currentMode()) {
  const best = readBest(game, mode);
  if (score <= best) return { best, newBest: false };
  writeBest(game, mode, score);
  return { best: score, newBest: true };
}

/** Keeps a best the leaderboard holds for the signed name; true if it raised the best shown. */
export function mergeBest(
  game: GameId,
  score: number | null | undefined,
  mode: ArcadeMode = currentMode(),
  player = readPlayerName().trim(),
) {
  const value = Math.floor(Number(score));
  if (!player || !Number.isFinite(value) || value <= 0) return false;
  const before = readBest(game, mode);
  const name = bestCookie(game, mode);
  sessionBests.set(`board:${player.toLocaleLowerCase()}:${name}`, Math.max(value, sessionBests.get(`board:${player.toLocaleLowerCase()}:${name}`) ?? 0));
  raiseStored(BOARD_BEST_KEY(player, name), value);
  return readBest(game, mode) > before;
}

// The last name signed on any board is offered again, so a regular doesn't
// retype it after every run, and it is how this device finds its own bests
// on the boards. It lives on this device only.
const NAME_KEY = "boba_player_name_v1";

export function readPlayerName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function savePlayerName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Storage can be off; the field just starts empty next time.
  }
}

/**
 * Dispatched on `window` (a CustomEvent whose detail is the mode) when a sync
 * has raised a best on this device, so a game already open (cup stack's best
 * line) can show it.
 */
export const BESTS_SYNCED = "boba:bests-synced";

/**
 * Brings back from the leaderboard any best this device has lost, for one
 * game or (without `game`) every game, in a mode. Needs the name signed on
 * this device; quietly does nothing without one or when the board is offline.
 * Resolves to whether any best changed, and announces a change as
 * `BESTS_SYNCED`.
 */
export async function syncBests(mode: ArcadeMode = currentMode(), game?: GameId): Promise<boolean> {
  const name = readPlayerName().trim();
  if (!name) return false;
  try {
    const query = new URLSearchParams({ mode, name, game: game ?? "all" });
    if (mode === "normal" && (!game || game === "spill")) query.set("spillVersion", "2");
    const response = await fetch(`/api/scores?${query}`);
    const data = await response.json();
    // A different name was signed while this was on its way: not this player's best.
    if (!data?.available || readPlayerName().trim() !== name) return false;
    let changed = false;
    if (game) changed = mergeBest(game, data.mine, mode);
    else {
      for (const [id, best] of Object.entries(data.bests ?? {})) {
        if (mergeBest(id as GameId, best as number, mode)) changed = true;
      }
    }
    if (changed && typeof window !== "undefined") window.dispatchEvent(new CustomEvent<ArcadeMode>(BESTS_SYNCED, { detail: mode }));
    return changed;
  } catch {
    return false;
  }
}


// Spill keeps its progress on this device as one small JSON value: each
// room's best stars and points, and whether after hours is open. Expert is
// its own climb, so it keeps its own value. The engine's cleanProgress checks
// whatever comes back, so this only stores and fetches. Storage can be off
// (private windows, blocked site data): every read and write is guarded, and
// the game plays on without it.
const SPILL_PROGRESS_KEY: Record<ArcadeMode, string> = {
  normal: "boba_spill_progress_v2",
  expert: "boba_spill_progress_expert_v1",
};
// The furthest room a run had reached, from before spill had levels.
const SPILL_REACH_COOKIES = ["boba_reach_spill_v1", "boba_spill_reach"];
/** The rooms there were when a reach was counted; rooms added since start locked. */
const SPILL_REACH_ROOMS = 18;
/** A reach cookie proves a clear, so each unlocked room keeps one star. */
const MIGRATED_STARS = 1;

/**
 * Spill progress as stored on this device for a mode, unchecked (null if
 * there is none). The first time in normal mode, an old reach cookie becomes
 * progress: every room before the one reached counts as cleared with one star.
 */
export function readSpillProgress(mode: ArcadeMode = currentMode()): unknown {
  try {
    const raw = localStorage.getItem(SPILL_PROGRESS_KEY[mode]);
    if (raw) return JSON.parse(raw);
  } catch {
    // Unreadable or unavailable: fall through to the old cookie, then nothing.
  }
  if (mode === "expert") return null;
  try {
    const old = JSON.parse(localStorage.getItem("boba_spill_progress_v1") ?? "null");
    if (Array.isArray(old?.stars)) {
      // The old score cannot show how much planning time was free. Keep
      // the room unlocks and stars, and start counting points anew.
      const migrated = { stars: old.stars, points: [], afterHours: old.afterHours };
      writeSpillProgress(migrated, mode);
      return migrated;
    }
  } catch {
    // An unreadable save may still have a reach cookie.
  }
  let reached = 0;
  for (const name of SPILL_REACH_COOKIES) reached = Math.max(reached, parseInt(readCookie(name) ?? "", 10) || 0);
  if (reached <= 0) return null;
  const rooms = Math.min(reached, SPILL_REACH_ROOMS);
  const migrated = {
    stars: Array.from({ length: rooms }, () => MIGRATED_STARS),
    points: [],
    afterHours: false,
  };
  // A cached v1 client still needs its reach cookie to recover those rooms.
  writeSpillProgress(migrated, mode);
  return migrated;
}

/** Saves spill progress for a mode on this device. Returns whether it was stored. */
export function writeSpillProgress(progress: unknown, mode: ArcadeMode = currentMode()) {
  try {
    localStorage.setItem(SPILL_PROGRESS_KEY[mode], JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

export interface BoardEntry {
  name: string;
  score: number;
  me?: boolean;
}

interface Board {
  available: boolean;
  scores: BoardEntry[];
  /** This device's name's best on the board, when it is on it. */
  mine: number | null;
}

export async function fetchBoard(game: GameId, mode: ArcadeMode = currentMode()): Promise<Board> {
  try {
    const query = new URLSearchParams({ game, mode });
    if (game === "spill" && mode === "normal") query.set("spillVersion", "2");
    const name = readPlayerName().trim();
    if (name) query.set("name", name);
    const response = await fetch(`/api/scores?${query}`);
    const data = await response.json();
    // The board also says this device's own best on it, which may be one the device lost.
    const mine = name && readPlayerName().trim() === name && Number.isFinite(data?.mine) ? Number(data.mine) : null;
    if (data?.available) mergeBest(game, mine, mode);
    return {
      available: !!data.available,
      scores: Array.isArray(data.scores) ? data.scores : [],
      mine,
    };
  } catch {
    return { available: false, scores: [], mine: null };
  }
}

type SubmitResult =
  | { ok: true; rank: number | null; scores: BoardEntry[]; mine: number | null }
  | { ok: false; reason: string };

export async function submitScore(
  game: GameId,
  name: string,
  score: number,
  mode: ArcadeMode = currentMode(),
): Promise<SubmitResult> {
  try {
    const response = await fetch("/api/scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game, name, score, mode, spillVersion: game === "spill" && mode === "normal" ? "2" : undefined }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      return { ok: false, reason: data?.reason ?? "couldn't submit" };
    }
    // The name just signed is the one the board answered for (it is saved after this returns).
    const mine = Number.isFinite(data.mine) ? Number(data.mine) : null;
    mergeBest(game, mine, mode, name.trim());
    return {
      ok: true,
      rank: data.rank ?? null,
      scores: Array.isArray(data.scores) ? data.scores : [],
      mine,
    };
  } catch {
    return { ok: false, reason: "couldn't submit, try again" };
  }
}
