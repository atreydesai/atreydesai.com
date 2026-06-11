// Sync MyDramaList dramalist into src/content/books/.
//
// MDL itself is behind Cloudflare, so this reads the Kuryana community API
// (https://github.com/tbdsux/kuryana) wrapper of the public dramalist page.
//
// Import rules:
//   - Completed -> done, score maps directly onto enjoyment (both 1-10)
//   - Plan to Watch -> status: shelved
//   - Watching / On-hold / Dropped are skipped (not finished, not a wishlist)
//   - single-episode entries are movies; everything else is a drama
//   - scripts/mdl-overrides.json: "favorites" marks entries favorite: true
//     (MDL has no public favorites feed), "exclude" skips entries
//
// Idempotent like the Goodreads sync: files keyed by mdlId are created once
// and never overwritten, so manual edits stick. Favorites only flip
// false -> true. Fails soft so deploys survive API downtime.

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchMdlGenreTagsByUrl, yamlListLines } from './tag-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOOKS_DIR = join(ROOT, 'src/content/books');
const OVERRIDES_PATH = join(ROOT, 'scripts/mdl-overrides.json');

const MDL_USER = 'silentnovas';
const API = `https://kuryana.tbdh.app/dramalist/${MDL_USER}`;

const overrides = existsSync(OVERRIDES_PATH)
    ? JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'))
    : { favorites: [], exclude: [] };
const favoriteIds = new Set(overrides.favorites ?? []);
const excludeIds = new Set(overrides.exclude ?? []);

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

function normTitle(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function existingMdlFiles() {
    const byId = new Map();
    const titles = new Set();
    for (const file of readdirSync(BOOKS_DIR)) {
        if (!file.endsWith('.md')) continue;
        const text = readFileSync(join(BOOKS_DIR, file), 'utf8');
        const id = text.match(/^mdlId:\s*"(.+)"\s*$/m);
        if (id) byId.set(id[1], file);
        // Track titles of all movie/show/drama entries so list items
        // imported without an mdlId (e.g. the plan-to-watch backfill) are
        // not duplicated if the API starts returning them.
        const medium = text.match(/^medium:\s*(movie|show|drama)\s*$/m);
        const title = text.match(/^title:\s*"(.*)"\s*$/m);
        if (medium && title) titles.add(normTitle(title[1]));
    }
    return { byId, titles };
}

let list;
try {
    const res = await fetch(API, { headers: { 'user-agent': 'atreydesai.com bookshelf sync' } });
    if (!res.ok) throw new Error(`Kuryana returned ${res.status}`);
    list = (await res.json()).data.list;
} catch (err) {
    console.warn(`[mdl-sync] fetch failed, skipping sync: ${err.message}`);
    process.exit(0);
}

const { byId: known, titles: knownTitles } = existingMdlFiles();
const existingSlugs = new Set(readdirSync(BOOKS_DIR).map((f) => f.replace(/\.md$/, '')));
const today = new Date().toISOString().slice(0, 10);
let created = 0;

const buckets = [
    { name: 'Completed', status: 'done' },
    { name: 'Plan to Watch', status: 'shelved' },
];

for (const bucket of buckets) {
    for (const item of list[bucket.name]?.items ?? []) {
        if (excludeIds.has(item.id) || known.has(item.id)) continue;
        if (knownTitles.has(normTitle(item.name))) continue;

        const score = parseFloat(item.score) || 0;
        const medium = item.episode_total === '1' ? 'movie' : 'drama';
        const url = `https://mydramalist.com/${item.id}`;
        const tags = await fetchMdlGenreTagsByUrl(url);
        const dateAdded = itemDateAdded(item) ?? (bucket.status === 'shelved' ? '' : today);

        let slug = slugify(item.name) || `mdl-${item.id}`;
        if (existingSlugs.has(slug)) slug = `${slug}-${medium}`;
        if (existingSlugs.has(slug)) continue;
        existingSlugs.add(slug);

        const lines = [
            '---',
            `id: ${yamlString(slug)}`,
            `title: ${yamlString(item.name)}`,
            'author: ""',
            'category: fiction',
            `dateAdded: "${dateAdded}"`,
            `favorite: ${favoriteIds.has(item.id)}`,
            `medium: ${medium}`,
            `url: "${url}"`,
            `mdlId: "${item.id}"`,
        ];
        lines.push(...yamlListLines('tags', tags));
        if (bucket.status === 'shelved') lines.push('status: shelved');
        if (score > 0) lines.push(`enjoyment: ${score}`);
        lines.push('---', '');

        writeFileSync(join(BOOKS_DIR, `${slug}.md`), lines.join('\n'));
        created++;
    }
}

function itemDateAdded(item) {
    for (const [key, value] of Object.entries(item)) {
        if (!/(date.*added|added.*date|created)/i.test(key)) continue;
        const parsed = parseFlexibleDate(value);
        if (parsed) return parsed;
    }
    return null;
}

function parseFlexibleDate(value) {
    if (!value) return null;
    const text = String(value).trim();
    const dmy = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dmy) {
        const [, day, month, year] = dmy;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

// Flip favorite false -> true for already-imported entries (never the reverse).
let favorited = 0;
for (const id of favoriteIds) {
    const file = known.get(id);
    if (!file) continue;
    const path = join(BOOKS_DIR, file);
    const text = readFileSync(path, 'utf8');
    if (/^favorite:\s*false\s*$/m.test(text)) {
        writeFileSync(path, text.replace(/^favorite:\s*false\s*$/m, 'favorite: true'));
        favorited++;
    }
}

console.log(
    `[mdl-sync] ${created} new files created, ${known.size} already imported, ${favorited} marked favorite`
);
