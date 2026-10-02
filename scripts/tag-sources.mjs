import { decodeEntities, yamlString } from './bookshelf-utils.mjs';

const MAX_TAGS = 5;
const USER_AGENT = 'atreydesai.com bookshelf sync';

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

// Goodreads genre buttons used as fiction/nonfiction signals. We only split
// those two for imported books — `science`/`advice` stay reserved for the
// site's own writing and are set by hand.
const FICTION_GENRES = new Set([
    'fiction', 'fantasy', 'science fiction', 'sci-fi', 'romance', 'mystery',
    'thriller', 'horror', 'poetry', 'graphic novels', 'comics', 'manga',
    'young adult', 'literary fiction', 'historical fiction', 'short stories',
    'fairy tales', 'dystopia', 'paranormal', 'novels', 'adventure', 'crime',
    'urban fantasy', 'magical realism', 'plays', 'drama',
]);

const NONFICTION_GENRES = new Set([
    'nonfiction', 'non-fiction', 'non fiction', 'philosophy', 'history',
    'biography', 'memoir', 'autobiography', 'psychology', 'politics',
    'economics', 'religion', 'spirituality', 'essays', 'science', 'sociology',
    'anthropology', 'reference', 'textbooks', 'logic', 'true crime',
    'journalism', 'education', 'health', 'productivity', 'finance',
    'leadership', 'self help', 'self-help', 'business', 'language',
    'mathematics', 'medicine', 'physics', 'biology',
]);

/**
 * Map a list of genre tags to one of the bookshelf's categories.
 * An explicit Goodreads "Nonfiction"/"Fiction" shelf wins outright; otherwise
 * the dominant genre signal decides, and ties fall back to `fallback`.
 */
export function categoryFromTags(tags, fallback = 'fiction') {
    const set = new Set((tags ?? []).map((t) => String(t).toLowerCase().trim()));
    const hasNonfiction = [...set].some((t) => /^non[\s-]?fiction$/.test(t));
    const hasFiction = set.has('fiction');

    if (hasNonfiction && !hasFiction) return 'nonfiction';
    if (hasFiction && !hasNonfiction) return 'fiction';

    let fic = 0;
    let non = 0;
    for (const t of set) {
        if (FICTION_GENRES.has(t)) fic++;
        if (NONFICTION_GENRES.has(t)) non++;
    }
    if (non > fic) return 'nonfiction';
    if (fic > non) return 'fiction';
    return fallback;
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

function normalizeTag(value) {
    const tag = decodeEntities(String(value ?? ''))
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim();
    if (!tag || /^\d+$/.test(tag)) return '';
    return tag;
}

function stripHtml(value) {
    return decodeEntities(String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}
