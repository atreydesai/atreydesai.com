// One-time/backfill tag sync for existing bookshelf entries.
//
// Source priority:
//   - Goodreads top genres for books with goodreadsId
//   - MyDramaList Genres for MDL-linked movies/dramas, or MDL title search
//   - Wikidata genres for manually entered movies/shows without a source URL

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import {
    fetchGoodreadsGenreTags,
    fetchMdlGenreTagsByTitle,
    fetchMdlGenreTagsByUrl,
    fetchWikidataGenreTags,
    yamlListLines,
} from './tag-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOOKS_DIR = join(ROOT, 'src/content/books');
const OVERRIDES_PATH = join(ROOT, 'scripts/tag-overrides.json');
const TARGET_MEDIA = new Set(['book', 'movie', 'show', 'drama']);
const tagOverrides = existsSync(OVERRIDES_PATH)
    ? JSON.parse(readFileSync(OVERRIDES_PATH, 'utf8'))
    : {};

const files = readdirSync(BOOKS_DIR).filter((file) => file.endsWith('.md')).sort();
const unresolved = [];
let updated = 0;
let skipped = 0;

for (const file of files) {
    const path = join(BOOKS_DIR, file);
    const text = readFileSync(path, 'utf8');
    const parsed = parseFrontmatter(text);
    if (!parsed) continue;

    const data = yaml.load(parsed.frontmatter) ?? {};
    if (!TARGET_MEDIA.has(data.medium)) continue;

    const overrideTags = tagOverrides[data.id] ?? tagOverrides[file.replace(/\.md$/, '')];
    if (Array.isArray(overrideTags) && overrideTags.length > 0) {
        writeFileSync(path, upsertTags(text, parsed, overrideTags));
        updated++;
        console.log(`[tag-backfill] ${file}: ${overrideTags.join(', ')} (override)`);
        continue;
    }

    if (Array.isArray(data.tags) && data.tags.length > 0) {
        skipped++;
        continue;
    }

    const tags = await fetchTags(data);
    if (tags.length === 0) {
        unresolved.push({
            file,
            title: data.title,
            medium: data.medium,
            url: data.url ?? null,
            goodreadsId: data.goodreadsId ?? null,
            mdlId: data.mdlId ?? null,
        });
        continue;
    }

    writeFileSync(path, upsertTags(text, parsed, tags));
    updated++;
    console.log(`[tag-backfill] ${file}: ${tags.join(', ')}`);
}

console.log(
    `[tag-backfill] ${updated} updated, ${skipped} already tagged, ${unresolved.length} unresolved`
);
if (unresolved.length > 0) {
    console.log(JSON.stringify(unresolved, null, 2));
}

async function fetchTags(data) {
    if (data.medium === 'book' && data.goodreadsId) {
        return fetchGoodreadsGenreTags(data.goodreadsId);
    }
    if ((data.medium === 'drama' || data.medium === 'movie') && /mydramalist\.com/.test(data.url ?? '')) {
        return fetchMdlGenreTagsByUrl(data.url);
    }
    if (data.medium === 'drama') {
        return fetchMdlGenreTagsByTitle(data.title);
    }
    if (data.medium === 'movie' || data.medium === 'show') {
        return fetchWikidataGenreTags(data.title, data.medium);
    }
    return [];
}

function parseFrontmatter(text) {
    const match = text.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;
    return {
        frontmatter: match[1],
        start: match.index,
        end: match[0].length,
    };
}

function upsertTags(text, parsed, tags) {
    const lines = parsed.frontmatter.split('\n');
    const existingTags = lines.findIndex((line) => /^tags:\s*$/.test(line));
    if (existingTags !== -1) {
        let end = existingTags + 1;
        while (end < lines.length && /^  - /.test(lines[end])) end++;
        lines.splice(existingTags, end - existingTags);
    }
    const insertAfter = Math.max(
        lines.findLastIndex((line) => /^mdlId:/.test(line)),
        lines.findLastIndex((line) => /^goodreadsId:/.test(line)),
        lines.findLastIndex((line) => /^url:/.test(line)),
        lines.findLastIndex((line) => /^medium:/.test(line))
    );
    const nextLines = [...lines];
    nextLines.splice(insertAfter + 1, 0, ...yamlListLines('tags', tags));
    const nextFrontmatter = `---\n${nextLines.join('\n')}\n---`;
    return nextFrontmatter + text.slice(parsed.end);
}
