import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// This route hits external APIs at request time, so it is never prerendered.
// Vercel serves it as a serverless function and caches the response at the edge.
export const trailingSlash = 'ignore';

const MANIFOLD_USERNAME = 'prismatic';
// Stable Manifold user ids for `prismatic` and the bot `chromatic_`.
// Hardcoding them lets us fan out the portfolio / leagues / markets calls in
// parallel instead of waiting on the username lookups first.
const MANIFOLD_USER_ID = 'vbWl1dKRklRmZQoN6uJBJEosFYx2';
const MANIFOLD_BOT_USERNAME = 'chromatic_';
const MANIFOLD_BOT_ID = 'NMyTWRxNlyU3FXC36RNiVXN1w3R2';
const GOODREADS_USER_ID = '72859295';

const TIMEOUT_MS = 8000;

export interface ReadingBook {
	title: string;
	author: string | null;
	url: string | null;
}

export interface ReadingNow {
	books: ReadingBook[];
	/** Epoch ms of the latest reading activity on Goodreads, if any. */
	updatedAt: number | null;
}

export interface ManifoldStanding {
	netWorth: number;
	rank: number | null;
	profileUrl: string;
}

export interface ManifoldNow extends ManifoldStanding {
	market: { question: string; url: string } | null;
	/** The bot account's standing; null if its lookup failed. */
	bot: ManifoldStanding | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fetchJson(url: string): Promise<any> {
	return fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }).then((r) => {
		if (!r.ok) throw new Error(`${url} -> ${r.status}`);
		return r.json();
	});
}

async function getStanding(userId: string, username: string): Promise<ManifoldStanding> {
	const [portfolio, leagues] = await Promise.all([
		fetchJson(`https://api.manifold.markets/v0/get-user-portfolio?userId=${userId}`),
		fetchJson(`https://api.manifold.markets/v0/leagues?userId=${userId}`)
	]);

	// Net worth = cash balance + value of all open positions.
	const netWorth = (portfolio.balance ?? 0) + (portfolio.investmentValue ?? 0);

	// Rank within the most recent league season.
	let rank: number | null = null;
	if (Array.isArray(leagues) && leagues.length) {
		const latest = leagues.reduce((a, b) => (b.season > a.season ? b : a));
		if (typeof latest.rankSnapshot === 'number') rank = latest.rankSnapshot;
	}

	return {
		netWorth: Math.round(netWorth),
		rank,
		profileUrl: `https://manifold.markets/${username}`
	};
}

async function getManifold(): Promise<ManifoldNow> {
	const [standing, markets, bot] = await Promise.all([
		getStanding(MANIFOLD_USER_ID, MANIFOLD_USERNAME),
		fetchJson(`https://api.manifold.markets/v0/markets?userId=${MANIFOLD_USER_ID}&limit=100`),
		// The bot's line is optional: a failed lookup only drops that sentence.
		getStanding(MANIFOLD_BOT_ID, MANIFOLD_BOT_USERNAME).catch(() => null)
	]);

	// The most recent monthly "... AI model releases" market this user created.
	let market: ManifoldNow['market'] = null;
	if (Array.isArray(markets)) {
		const monthly = markets
			.filter((m) => /model release/i.test(m.question ?? ''))
			.sort((a, b) => (b.createdTime ?? 0) - (a.createdTime ?? 0));
		if (monthly[0]?.url && monthly[0]?.question) {
			market = { question: monthly[0].question, url: monthly[0].url };
		}
	}

	return { ...standing, market, bot };
}

// Pull a tag's inner text out of an RSS <item>, unwrapping CDATA if present.
function tag(item: string, name: string): string | null {
	const m = item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
	if (!m) return null;
	const inner = m[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '').trim();
	return inner || null;
}

function fetchGoodreads(url: string): Promise<string> {
	return fetch(url, {
		signal: AbortSignal.timeout(TIMEOUT_MS),
		headers: { 'User-Agent': 'Mozilla/5.0 (compatible; atreydesai.com)' }
	}).then((r) => {
		if (!r.ok) throw new Error(`goodreads -> ${r.status}`);
		return r.text();
	});
}

// Latest reading progress in the updates feed: page/percent updates
// (UserStatus) and started/finished reads (ReadStatus). "Wants to read" is
// shelving, not progress, so it doesn't count.
function latestProgress(xml: string): number {
	let latest = 0;
	for (const it of xml.match(/<item>[\s\S]*?<\/item>/g) ?? []) {
		const guid = tag(it, 'guid') ?? '';
		const title = tag(it, 'title') ?? '';
		const progress =
			guid.startsWith('UserStatus') ||
			(guid.startsWith('ReadStatus') && !/wants to read/i.test(title));
		if (!progress) continue;
		const at = Date.parse(tag(it, 'pubDate') ?? '');
		if (at > latest) latest = at;
	}
	return latest;
}

async function getReading(): Promise<ReadingNow> {
	const [xml, updates] = await Promise.all([
		fetchGoodreads(
			`https://www.goodreads.com/review/list_rss/${GOODREADS_USER_ID}?shelf=currently-reading`
		),
		// Optional: without it, the shelf's own dates still give a timestamp.
		fetchGoodreads(`https://www.goodreads.com/user/updates_rss/${GOODREADS_USER_ID}`).catch(
			() => ''
		)
	]);

	const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
	const books: Array<ReadingBook & { added: number }> = [];
	for (const it of items) {
		const title = tag(it, 'title');
		if (!title) continue;
		const id = tag(it, 'book_id');
		const added = tag(it, 'user_date_added');
		books.push({
			// Keep the inline line short: drop series suffixes like
			// "(The Captive's War, #1)" and subtitles after a colon.
			title: title
				.replace(/\s*\([^)]*#[^)]*\)\s*$/, '')
				.replace(/\s*:\s.*$/, '')
				.trim(),
			author: tag(it, 'author_name'),
			url: id ? `https://www.goodreads.com/book/show/${id}` : null,
			added: added ? Date.parse(added) || 0 : 0
		});
	}

	// Starting a book (adding it to currently-reading) is progress too.
	const updatedAt = Math.max(latestProgress(updates), ...books.map((b) => b.added));

	return {
		books: books
			.sort((a, b) => b.added - a.added)
			.slice(0, 2)
			.map(({ added: _added, ...rest }) => rest),
		updatedAt: updatedAt > 0 ? updatedAt : null
	};
}

export const GET: RequestHandler = async ({ setHeaders }) => {
	// Each source fails independently so a Goodreads hiccup never takes the
	// Manifold line down (or vice versa).
	const [manifold, reading] = await Promise.all([
		getManifold().catch(() => null),
		getReading().catch(() => null)
	]);

	setHeaders({
		// Edge-cache for an hour, then serve stale for a day while revalidating.
		'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'
	});

	return json({ manifold, reading });
};
