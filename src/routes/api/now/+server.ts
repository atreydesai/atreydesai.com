import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// This route hits external APIs at request time, so it must NOT be prerendered
// (the root +layout.ts sets prerender = true for the rest of the site). Vercel
// serves it as a serverless function and caches the response at the edge.
export const prerender = false;
export const trailingSlash = 'ignore';

const MANIFOLD_USERNAME = 'prismatic';
// Stable Manifold user id for `prismatic`. Hardcoding it lets us fan out the
// portfolio / leagues / markets calls in parallel instead of waiting on the
// username lookup first.
const MANIFOLD_USER_ID = 'vbWl1dKRklRmZQoN6uJBJEosFYx2';
const GOODREADS_USER_ID = '72859295';

const TIMEOUT_MS = 8000;

interface ReadingBook {
	title: string;
	author: string | null;
	url: string | null;
}

interface ManifoldNow {
	netWorth: number;
	rank: number | null;
	market: { question: string; url: string } | null;
	profileUrl: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fetchJson(url: string): Promise<any> {
	return fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) }).then((r) => {
		if (!r.ok) throw new Error(`${url} -> ${r.status}`);
		return r.json();
	});
}

async function getManifold(): Promise<ManifoldNow> {
	const [portfolio, leagues, markets] = await Promise.all([
		fetchJson(`https://api.manifold.markets/v0/get-user-portfolio?userId=${MANIFOLD_USER_ID}`),
		fetchJson(`https://api.manifold.markets/v0/leagues?userId=${MANIFOLD_USER_ID}`),
		fetchJson(`https://api.manifold.markets/v0/markets?userId=${MANIFOLD_USER_ID}&limit=100`)
	]);

	// Net worth = cash balance + value of all open positions.
	const netWorth = (portfolio.balance ?? 0) + (portfolio.investmentValue ?? 0);

	// Rank within the most recent league season.
	let rank: number | null = null;
	if (Array.isArray(leagues) && leagues.length) {
		const latest = leagues.reduce((a, b) => (b.season > a.season ? b : a));
		if (typeof latest.rankSnapshot === 'number') rank = latest.rankSnapshot;
	}

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

	return {
		netWorth: Math.round(netWorth),
		rank,
		market,
		profileUrl: `https://manifold.markets/${MANIFOLD_USERNAME}`
	};
}

// Pull a tag's inner text out of an RSS <item>, unwrapping CDATA if present.
function tag(item: string, name: string): string | null {
	const m = item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
	if (!m) return null;
	const inner = m[1].replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, '').trim();
	return inner || null;
}

async function getReading(): Promise<ReadingBook[]> {
	const res = await fetch(
		`https://www.goodreads.com/review/list_rss/${GOODREADS_USER_ID}?shelf=currently-reading`,
		{
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { 'User-Agent': 'Mozilla/5.0 (compatible; atreydesai.com)' }
		}
	);
	if (!res.ok) throw new Error(`goodreads -> ${res.status}`);
	const xml = await res.text();

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

	return books
		.sort((a, b) => b.added - a.added)
		.slice(0, 2)
		.map(({ added: _added, ...rest }) => rest);
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
