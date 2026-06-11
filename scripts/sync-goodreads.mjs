// Sync Goodreads "read" shelf into src/content/books/.
//
// Import rules:
//   - rated books always import (rating maps to enjoyment, 1-5 -> 2-10)
//   - unrated books import only if added on/after CUTOFF (filters the
//     pre-2022 bulk-added childhood books)
//   - scripts/goodreads-overrides.json can force-include or exclude any
//     Goodreads book id
//
// Idempotent: a book whose goodreadsId already appears in an existing
// markdown file is skipped, so manual edits (category, notes, quotes)
// are never overwritten. Network failures warn and exit 0 so deploys
// don't break on Goodreads downtime.

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchGoodreadsGenreTags, yamlListLines } from './tag-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOOKS_DIR = join(ROOT, 'src/content/books');
const OVERRIDES_PATH = join(ROOT, 'scripts/goodreads-overrides.json');

const GOODREADS_USER = '72859295';
const SHELF = 'read';
const FAVORITES_SHELF = 'favorites';
const TO_READ_SHELF = 'to-read';
const CUTOFF = new Date('2022-01-01T00:00:00Z');

const overrides = existsSync(OVERRIDES_PATH)
    ? JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'))
    : { include: [], exclude: [] };
const forceInclude = new Set((overrides.include ?? []).map(String));
const forceExclude = new Set((overrides.exclude ?? []).map(String));

function decodeEntities(s) {
    return s
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function tag(item, name) {
    const m = item.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`));
    return m ? decodeEntities(m[1].trim()) : '';
}

async function fetchShelf(shelf) {
    const items = [];
    for (let page = 1; page <= 20; page++) {
        const url = `https://www.goodreads.com/review/list_rss/${GOODREADS_USER}?shelf=${shelf}&page=${page}`;
        const res = await fetch(url, { headers: { 'user-agent': 'atreydesai.com bookshelf sync' } });
        if (!res.ok) throw new Error(`Goodreads returned ${res.status} for page ${page}`);
        const xml = await res.text();
        const pageItems = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
        items.push(...pageItems);
        if (pageItems.length < 100) break;
    }
    return items;
}

function parseDate(s) {
    const d = new Date(s);
    return isNaN(d) ? null : d;
}

function isoDate(d) {
    return d.toISOString().slice(0, 10);
}

function slugify(s) {
    return s
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[''']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60)
        .replace(/-+$/, '');
}

function yamlString(s) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function existingGoodreadsFiles() {
    const byId = new Map();
    for (const file of readdirSync(BOOKS_DIR)) {
        if (!file.endsWith('.md')) continue;
        const text = readFileSync(join(BOOKS_DIR, file), 'utf8');
        const m = text.match(/^goodreadsId:\s*"?(\d+)"?\s*$/m);
        if (m) byId.set(m[1], file);
    }
    return byId;
}

let items;
let toReadItems;
let favoriteIds;
try {
    items = await fetchShelf(SHELF);
    toReadItems = await fetchShelf(TO_READ_SHELF);
    favoriteIds = new Set(
        (await fetchShelf(FAVORITES_SHELF)).map((it) => tag(it, 'book_id')).filter(Boolean)
    );
} catch (err) {
    console.warn(`[goodreads-sync] fetch failed, skipping sync: ${err.message}`);
    process.exit(0);
}

const seen = new Set();
const knownFiles = existingGoodreadsFiles();
const known = new Set(knownFiles.keys());
const existingSlugs = new Set(readdirSync(BOOKS_DIR).map((f) => f.replace(/\.md$/, '')));
let created = 0;
let skippedKids = 0;
let shelved = 0;
let promoted = 0;

for (const item of items) {
    const bookId = tag(item, 'book_id');
    if (!bookId || seen.has(bookId)) continue;
    seen.add(bookId);

    const rating = parseInt(tag(item, 'user_rating'), 10) || 0;
    const added = parseDate(tag(item, 'user_date_created'));
    const readAt = parseDate(tag(item, 'user_read_at'));

    if (forceExclude.has(bookId)) continue;
    const qualifies = rating > 0 || (added && added >= CUTOFF) || forceInclude.has(bookId);
    if (!qualifies) {
        skippedKids++;
        continue;
    }
    if (known.has(bookId)) {
        // Book moved from to-read to read: promote shelved -> done and
        // pick up the rating it gained along the way.
        const path = join(BOOKS_DIR, knownFiles.get(bookId));
        let text = readFileSync(path, 'utf8');
        if (/^status:\s*shelved\s*$/m.test(text)) {
            text = text.replace(/^status:\s*shelved\s*\n/m, '');
            if (rating > 0 && !/^enjoyment:/m.test(text)) {
                text = text.replace(/^---\s*$(?![\s\S]*^---)/m, `enjoyment: ${rating * 2}\n---`);
            }
            writeFileSync(path, text);
            promoted++;
        }
        continue;
    }

    await writeBook(item, bookId, rating, readAt ?? added, false);
    created++;
}

// To-read shelf -> shelved entries (intentional adds, so no kids-era filter).
for (const item of toReadItems) {
    const bookId = tag(item, 'book_id');
    if (!bookId || seen.has(bookId)) continue;
    seen.add(bookId);
    if (forceExclude.has(bookId) || known.has(bookId)) continue;

    await writeBook(item, bookId, 0, parseDate(tag(item, 'user_date_created')), true);
    shelved++;
}

async function writeBook(item, bookId, rating, date, isShelved) {
    // Strip trailing series markers like "(Legend, #3)"
    const title = tag(item, 'title').replace(/\s*\([^)]*#[\d.–-]+[^)]*\)\s*$/, '').trim();
    const author = tag(item, 'author_name');
    const dateAdded = isoDate(date ?? new Date());

    let slug = slugify(title) || `book-${bookId}`;
    if (existingSlugs.has(slug)) slug = `${slug}-${bookId}`;
    if (existingSlugs.has(slug)) return;
    existingSlugs.add(slug);

    const tags = await fetchGoodreadsGenreTags(bookId);
    const lines = [
        '---',
        `id: ${yamlString(slug)}`,
        `title: ${yamlString(title)}`,
        `author: ${yamlString(author)}`,
        'category: fiction',
        `dateAdded: "${dateAdded}"`,
        `favorite: ${favoriteIds.has(bookId)}`,
        'medium: book',
        `url: "https://www.goodreads.com/book/show/${bookId}"`,
        `goodreadsId: "${bookId}"`,
    ];
    lines.push(...yamlListLines('tags', tags));
    if (isShelved) lines.push('status: shelved');
    if (rating > 0) lines.push(`enjoyment: ${rating * 2}`);
    lines.push('---', '');

    writeFileSync(join(BOOKS_DIR, `${slug}.md`), lines.join('\n'));
}

// Promote already-imported books that are on the favorites shelf.
// Only flips false -> true so manual favorites are never undone.
let favorited = 0;
for (const id of favoriteIds) {
    const file = knownFiles.get(id);
    if (!file) continue;
    const path = join(BOOKS_DIR, file);
    const text = readFileSync(path, 'utf8');
    if (/^favorite:\s*false\s*$/m.test(text)) {
        writeFileSync(path, text.replace(/^favorite:\s*false\s*$/m, 'favorite: true'));
        favorited++;
    }
}

console.log(
    `[goodreads-sync] ${items.length} read + ${toReadItems.length} to-read shelf items, ` +
        `${created} created, ${shelved} shelved, ${promoted} promoted to done, ` +
        `${known.size} already imported, ${skippedKids} skipped (unrated pre-2022), ` +
        `${favorited} marked favorite`
);
