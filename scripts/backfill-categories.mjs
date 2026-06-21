// One-time/backfill category correction for Goodreads-imported books.
//
// The sync used to hard-code `category: fiction` for every book, so nonfiction
// (philosophy, history, science, etc.) ended up mislabeled. This re-derives the
// category from each book's genre tags.
//
// Safe by design:
//   - only touches `medium: book` entries that came from Goodreads (goodreadsId)
//   - only rewrites entries still on the old `fiction` default, so manually set
//     categories (science / advice / nonfiction) are never clobbered
//   - books without tags are skipped (run `npm run tags:backfill` first)

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { categoryFromTags } from './tag-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOOKS_DIR = join(ROOT, 'src/content/books');

const files = readdirSync(BOOKS_DIR).filter((file) => file.endsWith('.md')).sort();
let updated = 0;
let untagged = 0;

for (const file of files) {
    const path = join(BOOKS_DIR, file);
    const text = readFileSync(path, 'utf8');
    const match = text.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;

    const data = yaml.load(match[1]) ?? {};
    if (data.medium !== 'book' || !data.goodreadsId) continue;
    // Never override a category that was set by hand.
    if (data.category !== 'fiction') continue;

    if (!Array.isArray(data.tags) || data.tags.length === 0) {
        untagged++;
        continue;
    }

    const next = categoryFromTags(data.tags);
    if (next === data.category) continue;

    writeFileSync(path, text.replace(/^category:.*$/m, `category: ${next}`));
    updated++;
    console.log(
        `[category-backfill] ${file}: ${data.category} -> ${next} (${data.tags.join(', ')})`
    );
}

console.log(
    `[category-backfill] ${updated} recategorized, ${untagged} skipped (no tags yet)`
);
