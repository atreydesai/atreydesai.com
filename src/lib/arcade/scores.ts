import type { GameId } from "$lib/boba";

// Personal bests and first-run tips live in cookies (catch keeps its original
// names so existing bests carry over); the shared leaderboard lives behind
// /api/scores, one board per game.

const BEST_COOKIE: Record<GameId, string> = {
  catch: "boba_best_v2",
  stab: "boba_best_stab_v1",
  orders: "boba_best_orders_v2",
  stack: "boba_best_stack_v1",
  lander: "boba_best_lander_v1",
  runner: "boba_best_runner_v1",
  spill: "boba_best_spill_v1",
};

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

export function readBest(game: GameId) {
  return parseInt(readCookie(BEST_COOKIE[game]) ?? "", 10) || 0;
}

/** Saves `score` if it beats the stored best. */
export function recordScore(game: GameId, score: number) {
  const best = readBest(game);
  if (score <= best) return { best, newBest: false };
  writeCookie(BEST_COOKIE[game], String(score));
  return { best: score, newBest: true };
}

/** True the first time a game is opened on this device; remembers the visit. */
export function firstVisit(game: GameId) {
  const seen = readCookie(TIP_COOKIE[game]) !== null;
  if (!seen) writeCookie(TIP_COOKIE[game], "1");
  return !seen;
}

// Spill keeps its progress on this device as one small JSON value: each
// room's best stars and points, and whether after hours is open. The engine's
// cleanProgress checks whatever comes back, so this only stores and fetches.
// Storage can be off (private windows, blocked site data): every read and
// write is guarded, and the game plays on without it.
const SPILL_PROGRESS_KEY = "boba_spill_progress_v1";
// The furthest room a run had reached, from before spill had levels.
const SPILL_REACH_COOKIES = ["boba_reach_spill_v1", "boba_spill_reach"];
/** Stars and points a migrated room gets: cleared once, at the least a clear scores. */
const MIGRATED_STARS = 1;
const MIGRATED_POINTS = 100;

/**
 * Spill progress as stored on this device, unchecked (null if there is
 * none). The first time, an old reach cookie becomes progress: every room
 * before the one reached counts as cleared with one star.
 */
export function readSpillProgress(): unknown {
  try {
    const raw = localStorage.getItem(SPILL_PROGRESS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Unreadable or unavailable: fall through to the old cookie, then nothing.
  }
  let reached = 0;
  for (const name of SPILL_REACH_COOKIES) reached = Math.max(reached, parseInt(readCookie(name) ?? "", 10) || 0);
  if (reached <= 0) return null;
  const rooms = Math.min(reached, 64);
  const migrated = {
    stars: Array.from({ length: rooms }, () => MIGRATED_STARS),
    points: Array.from({ length: rooms }, () => MIGRATED_POINTS),
    afterHours: false,
  };
  // Only once it is safely stored does the cookie go, so nothing is lost.
  if (writeSpillProgress(migrated)) {
    for (const name of SPILL_REACH_COOKIES) document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
  }
  return migrated;
}

/** Saves spill progress on this device. Returns whether it was stored. */
export function writeSpillProgress(progress: unknown) {
  try {
    localStorage.setItem(SPILL_PROGRESS_KEY, JSON.stringify(progress));
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
}

export async function fetchBoard(game: GameId): Promise<Board> {
  try {
    const response = await fetch(`/api/scores?game=${game}`);
    const data = await response.json();
    return {
      available: !!data.available,
      scores: Array.isArray(data.scores) ? data.scores : [],
    };
  } catch {
    return { available: false, scores: [] };
  }
}

type SubmitResult =
  | { ok: true; rank: number | null; scores: BoardEntry[] }
  | { ok: false; reason: string };

export async function submitScore(
  game: GameId,
  name: string,
  score: number,
): Promise<SubmitResult> {
  try {
    const response = await fetch("/api/scores", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game, name, score }),
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      return { ok: false, reason: data?.reason ?? "couldn't submit" };
    }
    return {
      ok: true,
      rank: data.rank ?? null,
      scores: Array.isArray(data.scores) ? data.scores : [],
    };
  } catch {
    return { ok: false, reason: "couldn't submit, try again" };
  }
}
