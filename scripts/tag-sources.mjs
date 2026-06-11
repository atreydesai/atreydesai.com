const MAX_TAGS = 5;
const USER_AGENT = 'atreydesai.com bookshelf sync';

const WIKIDATA_TYPES = {
    movie: new Set([
        'film',
        'feature film',
        'animated feature film',
        'short film',
        'television film',
    ]),
    show: new Set([
        'television series',
        'miniseries',
        'web series',
        'television program',
    ]),
};

export function yamlString(s) {
    return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function yamlListLines(key, values) {
    const tags = cleanTags(values);
    if (tags.length === 0) return [];
    return [key + ':', ...tags.map((tag) => `  - ${yamlString(tag)}`)];
}

export function cleanTags(values, max = MAX_TAGS) {
    const seen = new Set();
    const tags = [];
    for (const value of values ?? []) {
        const tag = normalizeTag(value);
        if (!tag) continue;
        const key = tag.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push(tag);
        if (tags.length >= max) break;
    }
    return tags;
}

export function extractMdlId(url) {
    const match = String(url ?? '').match(/mydramalist\.com\/([^/?#]+)/);
    return match?.[1] ?? null;
}

export async function fetchGoodreadsGenreTags(bookId) {
    if (!bookId) return [];
    try {
        const html = await fetchText(`https://www.goodreads.com/book/show/${bookId}.xml`);
        const tags = [
            ...html.matchAll(
                /BookPageMetadataSection__genreButton[\s\S]*?<span class="Button__labelItem">([^<]+)<\/span>/g
            ),
        ].map((match) => decodeEntities(match[1]));
        return cleanTags(tags);
    } catch (err) {
        console.warn(`[tag-source] Goodreads ${bookId}: ${err.message}`);
        return [];
    }
}

export async function fetchMdlGenreTagsByUrl(url) {
    if (!url) return [];
    try {
        const html = await fetchText(url);
        return extractMdlGenres(html);
    } catch (err) {
        console.warn(`[tag-source] MDL ${url}: ${err.message}`);
        return [];
    }
}

export async function fetchMdlGenreTagsByTitle(title) {
    if (!title) return [];
    try {
        const searchUrl = `https://mydramalist.com/search?q=${encodeURIComponent(title)}`;
        const html = await fetchText(searchUrl);
        const candidates = [
            ...html.matchAll(/<h6 class="text-primary title">[\s\S]*?<a href="\/([^"?]+)"[^>]*>([\s\S]*?)<\/a>/g),
        ].map((match) => ({
            id: match[1],
            title: stripHtml(match[2]),
        }));
        const target = normTitle(title);
        const match =
            candidates.find((item) => normTitle(item.title) === target) ??
            candidates.find((item) => normTitle(item.title).includes(target) || target.includes(normTitle(item.title)));
        return match ? fetchMdlGenreTagsByUrl(`https://mydramalist.com/${match.id}`) : [];
    } catch (err) {
        console.warn(`[tag-source] MDL search ${title}: ${err.message}`);
        return [];
    }
}

export async function fetchWikidataGenreTags(title, medium) {
    if (!title || !WIKIDATA_TYPES[medium]) return [];
    const typeAllowlist = WIKIDATA_TYPES[medium];
    try {
        const qids = await fetchWikidataCandidateIds(title, medium);
        if (qids.length === 0) return [];
        const values = qids.map((qid) => `wd:${qid}`).join(' ');
        const query = `
SELECT ?item ?itemLabel ?typeLabel ?genreLabel WHERE {
  VALUES ?item { ${values} }
  OPTIONAL { ?item wdt:P31 ?type. }
  OPTIONAL { ?item wdt:P136 ?genre. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
`;
        const url = `https://query.wikidata.org/sparql?${new URLSearchParams({
            query,
            format: 'json',
        })}`;
        const json = await fetchJson(url);
        const rows = json.results?.bindings ?? [];
        const byItem = new Map();
        for (const row of rows) {
            const item = row.item?.value;
            if (!item) continue;
            if (!byItem.has(item)) {
                byItem.set(item, {
                    title: row.itemLabel?.value ?? '',
                    types: new Set(),
                    genres: [],
                });
            }
            const entry = byItem.get(item);
            entry.order = qids.indexOf(item.replace(/^.*\//, ''));
            if (row.typeLabel?.value) entry.types.add(row.typeLabel.value.toLowerCase());
            if (row.genreLabel?.value) entry.genres.push(row.genreLabel.value);
        }
        const candidates = [...byItem.values()].filter((item) => {
            const typeMatch = [...item.types].some((type) => typeAllowlist.has(type));
            return typeMatch && item.genres.length > 0;
        });
        candidates.sort((a, b) => a.order - b.order);
        return cleanTags((candidates[0]?.genres ?? []).map(normalizeWikidataGenre));
    } catch (err) {
        console.warn(`[tag-source] Wikidata ${title}: ${err.message}`);
        return [];
    }
}

async function fetchWikidataCandidateIds(title, medium) {
    const ids = [];
    const seen = new Set();
    for (const term of wikidataSearchTerms(title, medium)) {
        const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({
            action: 'wbsearchentities',
            search: term,
            language: 'en',
            format: 'json',
            limit: '8',
        })}`;
        const json = await fetchJson(url);
        for (const result of json.search ?? []) {
            if (!result.id || seen.has(result.id)) continue;
            seen.add(result.id);
            ids.push(result.id);
        }
    }
    return ids;
}

function wikidataSearchTerms(title, medium) {
    const base = String(title)
        .replace(/\s+—\s+Season\s+\d+.*$/i, '')
        .replace(/\s*\(S\d+.*?\)\s*$/i, '')
        .replace(/\s*\(\d{4}\)\s*$/i, '')
        .replace(/\s*\([^)]*cut[^)]*\)\s*$/i, '')
        .replace(/\s*\([^)]*version[^)]*\)\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    const terms = [base];
    if (medium === 'movie') terms.push(`${base} film`, `${base} movie`);
    if (medium === 'show') terms.push(`${base} television series`, `${base} TV series`);
    if (/^f1$/i.test(base)) terms.push('F1 The Movie');
    if (/crimes of grindelwald/i.test(base)) terms.push('Fantastic Beasts The Crimes of Grindelwald');
    if (/3 body problem/i.test(base)) terms.push('Three-Body television series');
    return [...new Set(terms.filter(Boolean))];
}

function extractMdlGenres(html) {
    const genreBlock =
        html.match(/<li[^>]*class="[^"]*show-genres[^"]*"[^>]*>[\s\S]*?<b[^>]*>\s*Genres:\s*<\/b>([\s\S]*?)<\/li>/i)?.[1] ??
        html.match(/<b[^>]*>\s*Genres:\s*<\/b>([\s\S]*?)<\/li>/i)?.[1] ??
        '';
    const tags = [...genreBlock.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((match) => stripHtml(match[1]));
    return cleanTags(tags);
}

async function fetchText(url) {
    const res = await fetch(url, {
        headers: {
            'user-agent': USER_AGENT,
            accept: 'text/html,application/xhtml+xml,application/json',
        },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

async function fetchJson(url) {
    const res = await fetch(url, {
        headers: {
            'user-agent': USER_AGENT,
            accept: 'application/sparql-results+json,application/json',
        },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

function normalizeTag(value) {
    const tag = decodeEntities(String(value ?? ''))
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim();
    if (!tag || /^\d+$/.test(tag)) return '';
    return tag;
}

function normalizeWikidataGenre(value) {
    return String(value ?? '')
        .replace(/\b(?:film|movie|television program|television series|tv series|novel|literature)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripHtml(value) {
    return decodeEntities(String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function decodeEntities(s) {
    return String(s)
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function normTitle(s) {
    return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
