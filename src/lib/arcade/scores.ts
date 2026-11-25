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
// different rules.
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
  return mode === "expert" ? `${BEST_COOKIE[game]}_expert` : BEST_COOKIE[game];
}

const TIP_COOKIE: Record<GameId, string> = {
  catch: "boba_instructions_seen_v1",
  stab: "boba_tip_stab_v1",
  orders: "boba_tip_orders_v1",
  stack: "boba_tip_stack_v1",
  lander: "boba_tip_lander_v1",
  runner: "boba_tip_runner_v1",
  spill: "boba_tip_spill_v1",
};

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

function writeBest(game: GameId, mode: ArcadeMode, score: number) {
  const name = bestCookie(game, mode);
  sessionBests.set(name, Math.max(score, sessionBests.get(name) ?? 0));
  try {
    // Never lower: another tab may have saved a higher best a moment ago.
    if (score > readStored(name)) localStorage.setItem(BEST_KEY(name), String(score));
  } catch {
    // Storage off: the memory copy and the cookie below hold it.
  }
  writeCookie(name, String(score));
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
    try {
      localStorage.setItem(BEST_KEY(name), String(cookie));
    } catch {
      sessionBests.set(name, cookie);
    }
  }
  return Math.max(stored, cookie);
}

/** Saves `score` if it beats the stored best for the mode being played. */
export function recordScore(game: GameId, score: number, mode: ArcadeMode = currentMode()) {
  const best = readBest(game, mode);
  if (score <= best) return { best, newBest: false };
  writeBest(game, mode, score);
  return { best: score, newBest: true };
}

/** Takes a best the leaderboard holds for this device's name, if it beats the one here. */
export function mergeBest(game: GameId, score: number | null | undefined, mode: ArcadeMode = currentMode()) {
  const value = Math.floor(Number(score));
  if (!Number.isFinite(value) || value <= 0 || value <= readBest(game, mode)) return false;
  writeBest(game, mode, value);
  return true;
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
 * Brings back from the leaderboard any best this device has lost, for one
 * game or (without `game`) every game, in a mode. Needs the name signed on
 * this device; quietly does nothing without one or when the board is offline.
 * Resolves to whether any best changed.
 */
export async function syncBests(mode: ArcadeMode = currentMode(), game?: GameId): Promise<boolean> {
  const name = readPlayerName().trim();
  if (!name) return false;
  try {
    const query = new URLSearchParams({ mode, name, game: game ?? "all" });
    const response = await fetch(`/api/scores?${query}`);
    const data = await response.json();
    // A different name was signed while this was on its way: not this player's best.
    if (!data?.available || readPlayerName().trim() !== name) return false;
    if (game) return mergeBest(game, data.mine, mode);
    let changed = false;
    for (const [id, best] of Object.entries(data.bests ?? {})) {
      if (mergeBest(id as GameId, best as number, mode)) changed = true;
    }
    return changed;
  } catch {
    return false;
  }
}

/** True the first time a game is opened on this device; remembers the visit. */
export function firstVisit(game: GameId) {
  const seen = readCookie(TIP_COOKIE[game]) !== null;
  if (!seen) writeCookie(TIP_COOKIE[game], "1");
  return !seen;
}

/**
 * How a game opens: on its demo (the menu asked for it), asking whether to
 * watch the demo (the first time on this device), or straight to the
 * countdown. Remembers that the question was asked, so it is asked once.
 * (Order up also checks its older first-shift cookie, so a regular who
 * already answered that question isn't asked again.)
 */
export function demoIntro(game: GameId, requested: boolean): "demo" | "ask" | "none" {
  if (requested) {
    writeCookie(DEMO_COOKIE(game), "1");
    return "demo";
  }
  if (readCookie(DEMO_COOKIE(game)) !== null) return "none";
  writeCookie(DEMO_COOKIE(game), "1");
  return "ask";
}

const DEMO_COOKIE = (game: GameId) => `boba_demo_${game}_v1`;

// Spill keeps its progress on this device as one small JSON value: each
// room's best stars and points, and whether after hours is open. Expert is
// its own climb, so it keeps its own value. The engine's cleanProgress checks
// whatever comes back, so this only stores and fetches. Storage can be off
// (private windows, blocked site data): every read and write is guarded, and
// the game plays on without it.
const SPILL_PROGRESS_KEY: Record<ArcadeMode, string> = {
  normal: "boba_spill_progress_v1",
  expert: "boba_spill_progress_expert_v1",
};
// The furthest room a run had reached, from before spill had levels.
const SPILL_REACH_COOKIES = ["boba_reach_spill_v1", "boba_spill_reach"];
/** The rooms there were when a reach was counted; rooms added since start locked. */
const SPILL_REACH_ROOMS = 18;
/** Stars and points a migrated room gets: cleared once, at the least a clear scores. */
const MIGRATED_STARS = 1;
const MIGRATED_POINTS = 100;

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
  let reached = 0;
  for (const name of SPILL_REACH_COOKIES) reached = Math.max(reached, parseInt(readCookie(name) ?? "", 10) || 0);
  if (reached <= 0) return null;
  const rooms = Math.min(reached, SPILL_REACH_ROOMS);
  const migrated = {
    stars: Array.from({ length: rooms }, () => MIGRATED_STARS),
    points: Array.from({ length: rooms }, () => MIGRATED_POINTS),
    afterHours: false,
  };
  // Only once it is safely stored does the cookie go, so nothing is lost.
  if (writeSpillProgress(migrated, mode)) {
    for (const name of SPILL_REACH_COOKIES) document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
  }
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
  | { ok: true; rank: number | null; scores: BoardEntry[] }
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
      body: JSON.stringify({ game, name, score, mode }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      return { ok: false, reason: data?.reason ?? "couldn't submit" };
    }
    mergeBest(game, data.mine, mode);
    return {
      ok: true,
      rank: data.rank ?? null,
      scores: Array.isArray(data.scores) ? data.scores : [],
    };
  } catch {
    return { ok: false, reason: "couldn't submit, try again" };
  }
}
