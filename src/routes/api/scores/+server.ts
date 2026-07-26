import { json } from '@sveltejs/kit';
import { get, list, put } from '@vercel/blob';
import { env } from '$env/dynamic/private';
import { cleanName } from '$lib/profanity';
import type { RequestHandler } from './$types';

// Runs at request time (the root layout prerenders everything else).
export const prerender = false;
export const trailingSlash = 'ignore';

// v2 scores use the timed/combo/golden rules and are intentionally kept
// separate from the original endless-mode board.
const PATH = 'boba/v2-leaderboard.json';
const MAX_ENTRIES = 50; // keep the blob small
const TOP = 20; // returned to clients

// Provided automatically when a Blob store is linked to the Vercel project;
// locally, `vercel env pull`. Without it the leaderboard is simply "offline".
const token = env.BLOB_READ_WRITE_TOKEN;

interface Entry {
	name: string;
	score: number;
	t: number;
}

interface PublicEntry {
	name: string;
	score: number;
}

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

// The blob's URL is stable for a fixed pathname, so cache it across warm
// invocations: `list()` (an Advanced Operation — only 2,000/mo free on Hobby)
// then runs just once per cold start instead of on every request. Reads hit
// the URL directly afterward.
let cachedUrl: string | null = null;

// Resolves to the blob URL, null if the blob doesn't exist yet, or throws if
// the store can't be reached — callers must not mistake "can't reach the
// store" for "board is empty", or a subsequent write would clobber the board.
async function resolveUrl(): Promise<string | null> {
	if (cachedUrl) return cachedUrl;
	const { blobs } = await list({ prefix: PATH, token });
	cachedUrl = blobs.find((x) => x.pathname === PATH)?.url ?? null;
	return cachedUrl;
}

// [] = board genuinely empty (no blob yet); null = read failed, state unknown.
async function readBoard(): Promise<Entry[] | null> {
	if (!token) return [];
	try {
		const url = await resolveUrl();
		if (!url) return [];
		// Authenticated download via the SDK — works for blobs in a PRIVATE store
		// (a plain fetch of the URL is rejected for private blobs). get() returns a
		// stream + metadata, not a Response.
		const result = await get(url, { access: 'private', token });
		// get() resolves null when the blob doesn't exist — that's a legitimately
		// empty board, not a failure.
		if (!result) return [];
		if (result.statusCode !== 200) {
			console.warn(`[api/scores] blob read returned ${result.statusCode}`);
			return null;
		}
		const data = await new Response(result.stream).json();
		return Array.isArray(data) ? data : [];
	} catch (err) {
		console.warn('[api/scores] blob read failed:', err);
		return null;
	}
}

async function writeBoard(board: Entry[]): Promise<void> {
	// access MUST be 'private' — the boba-game store is private, and put()
	// otherwise defaults to 'public', which a private store rejects.
	const { url } = await put(PATH, JSON.stringify(board), {
		access: 'private',
		contentType: 'application/json',
		addRandomSuffix: false,
		allowOverwrite: true,
		token,
	});
	cachedUrl = url;
}

// Serialize read-modify-write cycles so concurrent submissions handled by the
// same instance can't lose each other's entry. Fluid Compute routes concurrent
// requests to a shared instance, so this covers the common case; simultaneous
// writes from *separate* instances can still race, which this store can't
// prevent (Blob has no conditional writes) — acceptable for a toy leaderboard.
let writeLock: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
	const run = writeLock.then(fn, fn);
	writeLock = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}

// Per-IP fixed-window rate limit, in-memory (per instance — a determined
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

export const GET: RequestHandler = async () => {
	if (!token) return json({ available: false, scores: [] });
	const board = await readBoard();
	if (board === null) return json({ available: false, scores: [] });
	board.sort((a, b) => b.score - a.score);
	return json(
		{
			available: true,
			scores: publicEntries(bestPerName(board).slice(0, TOP)),
		},
		// CDN-cache the leaderboard response so repeat views don't re-run the
		// function (and its blob ops). Submitters get fresh data from POST.
		{ headers: { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=300' } },
	);
};

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!token) {
		return json({ ok: false, reason: 'global leaderboard is offline' }, { status: 503 });
	}

	let ip = 'unknown';
	try {
		ip = getClientAddress();
	} catch {
		// no address available (e.g. prerender-adjacent contexts); rate-limit
		// these under one shared bucket rather than rejecting
	}
	if (rateLimited(ip, Date.now())) {
		return json({ ok: false, reason: 'too many submissions, slow down' }, { status: 429 });
	}

	let body: { name?: unknown; score?: unknown };
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, reason: 'bad request' }, { status: 400 });
	}

	// Validate score: a non-negative integer within a sane ceiling.
	const score = Math.floor(Number(body.score));
	if (!Number.isFinite(score) || score < 0 || score > 100000) {
		return json({ ok: false, reason: 'invalid score' }, { status: 400 });
	}

	// Validate + moderate the name (server is the authority).
	const checked = cleanName(typeof body.name === 'string' ? body.name : '');
	if (!checked.ok || !checked.value) {
		return json({ ok: false, reason: checked.reason ?? 'invalid name' }, { status: 400 });
	}
	const name = checked.value;

	try {
		return await withWriteLock(async () => {
			const board = await readBoard();
			if (board === null) {
				// Unknown board state — refuse to write rather than risk replacing
				// the real leaderboard with just this entry.
				return json({ ok: false, reason: "couldn't save, try again" }, { status: 500 });
			}
			const entry: Entry = { name, score, t: Date.now() };
			board.push(entry);
			board.sort((a, b) => b.score - a.score || a.t - b.t);
			const trimmed = bestPerName(board).slice(0, MAX_ENTRIES);
			await writeBoard(trimmed);

			const rank = trimmed.findIndex((e) => e === entry) + 1;
			return json({
				ok: true,
				rank: rank > 0 ? rank : null,
				scores: publicEntries(trimmed.slice(0, TOP)),
			});
		});
	} catch (err) {
		console.error('[api/scores] POST failed:', err);
		return json({ ok: false, reason: "couldn't save, try again" }, { status: 500 });
	}
};
