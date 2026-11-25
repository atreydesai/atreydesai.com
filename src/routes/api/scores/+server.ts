import { BlobPreconditionFailedError, get, list, put } from '@vercel/blob';
import { BLOB_READ_WRITE_TOKEN } from '$app/env/private';
import { cleanName } from '#lib/profanity.ts';
import type { RequestHandler } from './$types';

// Runs at request time (the root layout prerenders everything else).
export const prerender = false;
export const trailingSlash = 'ignore';

// One board per arcade game and mode. Catch's v2 file held its timed rules;
// catch is endless from v3, so it starts a fresh board, and sugar rush and cup
// stack did the same at v2 when they got much harder. Expert mode has its own board for every
// game. A request without a game means catch, and one without a mode means
// normal, so older clients keep working.
const BOARDS = {
	catch: 'boba/catch-v3-leaderboard.json',
	stab: 'boba/stab-v1-leaderboard.json',
	orders: 'boba/orders-v2-leaderboard.json',
	stack: 'boba/stack-v2-leaderboard.json',
	lander: 'boba/lander-v1-leaderboard.json',
	runner: 'boba/runner-v2-leaderboard.json',
	spill: 'boba/spill-v1-leaderboard.json',
} as const;

const EXPERT_BOARDS: Record<keyof typeof BOARDS, string> = {
	catch: 'boba/catch-v3-expert-leaderboard.json',
	stab: 'boba/stab-v1-expert-leaderboard.json',
	orders: 'boba/orders-v2-expert-leaderboard.json',
	stack: 'boba/stack-v2-expert-leaderboard.json',
	lander: 'boba/lander-v1-expert-leaderboard.json',
	runner: 'boba/runner-v2-expert-leaderboard.json',
	spill: 'boba/spill-v1-expert-leaderboard.json',
};

function boardPath(game: unknown, mode: unknown): string | null {
	if (mode !== null && mode !== undefined && mode !== '' && mode !== 'normal' && mode !== 'expert') return null;
	const key = game === null || game === undefined || game === '' ? 'catch' : game;
	if (typeof key !== 'string' || !Object.hasOwn(BOARDS, key)) return null;
	const id = key as keyof typeof BOARDS;
	return mode === 'expert' ? EXPERT_BOARDS[id] : BOARDS[id];
}

const MAX_ENTRIES = 50; // keep the blob small
const TOP = 20; // returned to clients

// Provided automatically when a Blob store is linked to the Vercel project;
// locally, `vercel env pull`. Without it the leaderboard is simply "offline".
const token = BLOB_READ_WRITE_TOKEN;

interface Entry { name: string; score: number; t: number }
interface PublicEntry { name: string; score: number }

function bestPerName(board: Entry[]): Entry[] {
	const seen = new Set<string>();
	return board.filter((entry) => {
		const key = entry.name.trim().toLocaleLowerCase();
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

function publicEntries(board: Entry[]): PublicEntry[] {
	return board.map(({ name, score }) => ({ name, score }));
}

const nameKey = (name: string) => name.trim().toLocaleLowerCase();

/** The name asked about, cleaned exactly as a signed name was (null if it couldn't have been signed). */
function askedName(url: URL): string | null {
	const raw = url.searchParams.get('name');
	if (!raw) return null;
	const checked = cleanName(raw);
	return checked.ok && checked.value ? checked.value : null;
}

// A player's own best on a board, matched by name the way bestPerName folds
// them, or null. The board keeps its top MAX_ENTRIES, so this finds anyone
// on it, not only the TOP shown. It is how a device that lost its stored
// best gets it back: the board is the record.
function bestFor(board: Entry[], name: string | null): number | null {
	if (!name) return null;
	const key = nameKey(name);
	let best: number | null = null;
	for (const entry of board) {
		if (nameKey(entry.name) === key && (best === null || entry.score > best)) best = entry.score;
	}
	return best;
}


// Each blob's URL is stable for a fixed pathname, so cache it across warm
// invocations: `list()` (an Advanced Operation: only 2,000/mo free on Hobby)
// then runs at most once per board per cold start instead of on every
// request. Reads hit the URL directly afterward.
const cachedUrls = new Map<string, string>();

// Resolves to the blob URL, null if the blob doesn't exist yet, or throws if
// the store can't be reached: callers must not mistake "can't reach the
// store" for "board is empty", or a subsequent write would clobber the board.
async function resolveUrl(path: string): Promise<string | null> {
	const cached = cachedUrls.get(path);
	if (cached) return cached;
	const { blobs } = await list({ prefix: path, token });
	const url = blobs.find((x) => x.pathname === path)?.url ?? null;
	if (url) cachedUrls.set(path, url);
	return url;
}

// [] = board genuinely empty (no blob yet); null = read failed, state unknown.
// `fresh` skips the Blob CDN cache: a write must start from the latest board,
// or it would put back a score that a moment ago was beaten.
interface Read { entries: Entry[]; etag: string | null }

async function readBoardFull(path: string, fresh = false): Promise<Read | null> {
	if (!token) return { entries: [], etag: null };
	try {
		const url = await resolveUrl(path);
		if (!url) return { entries: [], etag: null };
		// Authenticated download via the SDK: works for blobs in a PRIVATE store
		// (a plain fetch of the URL is rejected for private blobs). get() returns a
		// stream + metadata, not a Response.
		const result = await get(url, { access: 'private', token, useCache: !fresh });
		// get() resolves null when the blob doesn't exist: that's a legitimately
		// empty board, not a failure.
		if (!result) return { entries: [], etag: null };
		if (result.statusCode !== 200) {
			console.warn(`[api/scores] blob read returned ${result.statusCode}`);
			return null;
		}
		const data = await new Response(result.stream).json();
		return { entries: Array.isArray(data) ? data : [], etag: result.blob.etag ?? null };
	} catch (err) {
		console.warn('[api/scores] blob read failed:', err);
		return null;
	}
}

// Boards read for GETs are kept for a few seconds per instance, so a menu
// asking about every game, or many players at once, share one read.
const READ_TTL_MS = 15_000;
const recentReads = new Map<string, { at: number; read: Promise<Read | null> }>();

async function readBoard(path: string): Promise<Entry[] | null> {
	const now = Date.now();
	const recent = recentReads.get(path);
	if (recent && now - recent.at < READ_TTL_MS) return (await recent.read)?.entries.slice() ?? null;
	const read = readBoardFull(path);
	recentReads.set(path, { at: now, read });
	const result = await read;
	if (!result) recentReads.delete(path);
	return result ? result.entries.slice() : null;
}

/**
 * Writes a board only if it is still the one that was read (`etag`), or, for
 * a board that didn't exist, only if it still doesn't. False means another
 * write got there first: read again and retry.
 */
async function writeBoard(path: string, board: Entry[], etag: string | null): Promise<boolean> {
	try {
		// access MUST be 'private': the boba-game store is private, and put()
		// otherwise defaults to 'public', which a private store rejects.
		const { url } = await put(path, JSON.stringify(board), {
			access: 'private',
			contentType: 'application/json',
			addRandomSuffix: false,
			...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
			token,
		});
		cachedUrls.set(path, url);
		recentReads.delete(path);
		return true;
	} catch (err) {
		if (err instanceof BlobPreconditionFailedError) return false;
		// Creating a board another write has just created.
		if (!etag && err instanceof Error && /already exists/i.test(err.message)) return false;
		throw err;
	}
}

// Serialize read-modify-write cycles so concurrent submissions handled by the
// same instance can't lose each other's entry. Fluid Compute routes concurrent
// requests to a shared instance, so this covers the common case; simultaneous
// writes from *separate* instances can still race, which this store can't
// prevent (Blob has no conditional writes): acceptable for a toy leaderboard.
let writeLock: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
	const run = writeLock.then(fn, fn);
	writeLock = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}

// Per-IP fixed-window rate limit, in-memory (per instance: a determined
// attacker can still spread across instances, but this stops casual loops).
const RATE_LIMIT = 5; // submissions
const RATE_WINDOW_MS = 60_000; // per minute
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string, now: number): boolean {
	if (rateBuckets.size > 1000) {
		for (const [key, bucket] of rateBuckets) {
			if (bucket.resetAt <= now) rateBuckets.delete(key);
		}
	}
	const bucket = rateBuckets.get(ip);
	if (!bucket || bucket.resetAt <= now) {
		rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
		return false;
	}
	bucket.count += 1;
	return bucket.count > RATE_LIMIT;
}

export const GET: RequestHandler = async ({ url }) => {
	const name = askedName(url);
	// Every board for one name, in one mode: the arcade menu's prices.
	if (url.searchParams.get('game') === 'all') {
		const mode = url.searchParams.get('mode');
		if (!name || (mode !== null && mode !== 'normal' && mode !== 'expert')) {
			return Response.json({ available: false, bests: {} }, { status: 400 });
		}
		if (!token) return Response.json({ available: false, bests: {} });
		const ids = Object.keys(BOARDS) as Array<keyof typeof BOARDS>;
		const boards = await Promise.all(ids.map((id) => readBoard(boardPath(id, mode)!)));
		// A board that couldn't be read is left out; the others still answer.
		if (boards.every((board) => board === null)) return Response.json({ available: false, bests: {} });
		const bests: Partial<Record<keyof typeof BOARDS, number>> = {};
		ids.forEach((id, index) => {
			const board = boards[index];
			const best = board ? bestFor(board, name) : null;
			if (best !== null) bests[id] = best;
		});
		return Response.json({ available: true, bests }, { headers: { 'cache-control': 'private, max-age=20' } });
	}
	const path = boardPath(url.searchParams.get('game'), url.searchParams.get('mode'));
	if (!path) return Response.json({ available: false, scores: [] }, { status: 400 });
	if (!token) return Response.json({ available: false, scores: [] });
	const board = await readBoard(path);
	if (board === null) return Response.json({ available: false, scores: [] });
	board.sort((a, b) => b.score - a.score);
	// A player's own best is theirs to see, not the CDN's to keep: a request
	// that names someone is answered fresh and only to that browser.
	const cache = name ? 'private, max-age=20' : 'public, s-maxage=30, stale-while-revalidate=300';
	return Response.json(
		{
			available: true,
			scores: publicEntries(bestPerName(board).slice(0, TOP)),
			mine: bestFor(board, name),
		},
		// CDN-cache the public leaderboard response so repeat views don't re-run
		// the function (and its blob ops). Submitters get fresh data from POST.
		{ headers: { 'cache-control': cache } },
	);
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!token) {
		return Response.json({ ok: false, reason: 'global leaderboard is offline' }, { status: 503 });
	}

	let ip = 'unknown';
	try {
		ip = getClientAddress();
	} catch {
		// no address available (e.g. prerender-adjacent contexts); rate-limit
		// these under one shared bucket rather than rejecting
	}
	if (rateLimited(ip, Date.now())) {
		return Response.json({ ok: false, reason: 'too many submissions, slow down' }, { status: 429 });
	}

	let body: { name?: unknown; score?: unknown; game?: unknown; mode?: unknown };
	try {
		body = await request.json();
	} catch {
		return Response.json({ ok: false, reason: 'bad request' }, { status: 400 });
	}

	const path = boardPath(body.game, body.mode);
	if (!path) return Response.json({ ok: false, reason: 'unknown game' }, { status: 400 });

	// Validate score: a non-negative integer within a sane ceiling.
	const score = Math.floor(Number(body.score));
	if (!Number.isFinite(score) || score < 0 || score > 1000000) {
		return Response.json({ ok: false, reason: 'invalid score' }, { status: 400 });
	}

	// Validate + moderate the name (server is the authority).
	const checked = cleanName(typeof body.name === 'string' ? body.name : '');
	if (!checked.ok || !checked.value) {
		return Response.json({ ok: false, reason: checked.reason ?? 'invalid name' }, { status: 400 });
	}
	const name = checked.value;

	try {
		return await withWriteLock(async () => {
			const entry: Entry = { name, score, t: Date.now() };
			// Read the latest board and write it back only if nothing else wrote
			// in between (another instance can't be locked out any other way),
			// so a score already saved is never replaced by an older board.
			let trimmed: Entry[] | null = null;
			for (let attempt = 0; attempt < 4 && !trimmed; attempt++) {
				const read = await readBoardFull(path, true);
				if (read === null) {
					// Unknown board state: refuse to write rather than risk replacing
					// the real leaderboard with just this entry.
					return Response.json({ ok: false, reason: "couldn't save, try again" }, { status: 500 });
				}
				const board = [...read.entries, entry];
				board.sort((a, b) => b.score - a.score || a.t - b.t);
				const next = bestPerName(board).slice(0, MAX_ENTRIES);
				if (await writeBoard(path, next, read.etag)) trimmed = next;
			}
			if (!trimmed) return Response.json({ ok: false, reason: "couldn't save, try again" }, { status: 503 });

			const rank = trimmed.findIndex((e) => e === entry) + 1;
			return Response.json({
				ok: true,
				rank: rank > 0 ? rank : null,
				scores: publicEntries(trimmed.slice(0, TOP)),
				mine: bestFor(trimmed, name),
			});
		});
	} catch (err) {
		console.error('[api/scores] POST failed:', err);
		return Response.json({ ok: false, reason: "couldn't save, try again" }, { status: 500 });
	}
};
