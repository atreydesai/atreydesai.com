import { json } from '@sveltejs/kit';
import { list, put } from '@vercel/blob';
import { env } from '$env/dynamic/private';
import { cleanName } from '$lib/profanity';
import type { RequestHandler } from './$types';

// Runs at request time (the root layout prerenders everything else).
export const prerender = false;
export const trailingSlash = 'ignore';

const PATH = 'boba/leaderboard.json';
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

// The blob's URL is stable for a fixed pathname, so cache it across warm
// invocations: `list()` (an Advanced Operation — only 2,000/mo free on Hobby)
// then runs just once per cold start instead of on every request. Reads hit
// the URL directly afterward.
let cachedUrl: string | null = null;

async function resolveUrl(): Promise<string | null> {
	if (cachedUrl) return cachedUrl;
	const { blobs } = await list({ prefix: PATH, token });
	cachedUrl = blobs.find((x) => x.pathname === PATH)?.url ?? null;
	return cachedUrl;
}

async function readBoard(fresh: boolean): Promise<Entry[]> {
	if (!token) return [];
	const url = await resolveUrl();
	if (!url) return [];
	// GET allows CDN cache HITs (free — no Simple Operation / Fast Origin
	// Transfer); POST bypasses the cache so a submit never reads stale data and
	// clobbers a recent entry.
	const res = await fetch(url, fresh ? { cache: 'no-store' } : {});
	if (!res.ok) return [];
	const data = await res.json();
	return Array.isArray(data) ? data : [];
}

async function writeBoard(board: Entry[]): Promise<void> {
	const { url } = await put(PATH, JSON.stringify(board), {
		access: 'public',
		contentType: 'application/json',
		addRandomSuffix: false,
		allowOverwrite: true,
		token,
	});
	cachedUrl = url;
}

export const GET: RequestHandler = async () => {
	if (!token) return json({ available: false, scores: [] });
	try {
		const board = await readBoard(false);
		board.sort((a, b) => b.score - a.score);
		return json(
			{ available: true, scores: board.slice(0, TOP) },
			// CDN-cache the leaderboard response so repeat views don't re-run the
			// function (and its blob ops). Submitters get fresh data from POST.
			{ headers: { 'cache-control': 'public, s-maxage=30, stale-while-revalidate=300' } },
		);
	} catch {
		return json({ available: false, scores: [] });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	if (!token) {
		return json({ ok: false, reason: 'global leaderboard is offline' }, { status: 503 });
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
		const board = await readBoard(true);
		const entry: Entry = { name, score, t: Date.now() };
		board.push(entry);
		board.sort((a, b) => b.score - a.score || a.t - b.t);
		const trimmed = board.slice(0, MAX_ENTRIES);
		await writeBoard(trimmed);

		const rank = trimmed.findIndex((e) => e === entry) + 1;
		return json({
			ok: true,
			rank: rank > 0 ? rank : null,
			scores: trimmed.slice(0, TOP),
		});
	} catch (err) {
		console.error('[api/scores] POST failed:', err);
		const reason = err instanceof Error ? `${err.name}: ${err.message}` : "couldn't save, try again";
		return json({ ok: false, reason }, { status: 500 });
	}
};
