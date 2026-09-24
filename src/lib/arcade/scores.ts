import type { GameId } from "$lib/boba";

// Personal bests and first-run tips live in cookies (catch keeps its original
// names so existing bests carry over); the shared leaderboard lives behind
// /api/scores, one board per game.

const BEST_COOKIE: Record<GameId, string> = {
  catch: "boba_best_v2",
  stab: "boba_best_stab_v1",
  orders: "boba_best_orders_v1",
  stack: "boba_best_stack_v1",
};

const TIP_COOKIE: Record<GameId, string> = {
  catch: "boba_instructions_seen_v1",
  stab: "boba_tip_stab_v1",
  orders: "boba_tip_orders_v1",
  stack: "boba_tip_stack_v1",
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

export interface BoardEntry {
  name: string;
  score: number;
  me?: boolean;
}

export interface Board {
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

export type SubmitResult =
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
