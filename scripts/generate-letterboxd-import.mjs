// Generate a clickable audit and exact-URI CSVs for the one-time migration of
// existing bookshelf films into Letterboxd. WatchedDate is intentionally
// omitted: the bookshelf does not know the actual viewing date for most older
// films, and inventing one would create false diary history.

import {
    mkdirSync,
    readFileSync,
    readdirSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './letterboxd-utils.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOOKS_DIR = join(ROOT, 'src/content/books');
const OUTPUT_DIR = join(ROOT, 'scripts/letterboxd-import');

const EXPANSIONS = {
    'divergent-series': [
        {
            title: 'Divergent',
            year: 2014,
            letterboxdUrl: 'https://letterboxd.com/film/divergent/',
        },
        {
            title: 'Insurgent',
            year: 2015,
            letterboxdUrl: 'https://letterboxd.com/film/insurgent/',
        },
        {
            title: 'Allegiant',
            year: 2016,
            letterboxdUrl: 'https://letterboxd.com/film/allegiant/',
        },
    ],
};

const entries = readdirSync(BOOKS_DIR)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => {
        const text = readFileSync(join(BOOKS_DIR, file), 'utf8');
        return { file, ...(parseFrontmatter(text)?.data ?? {}) };
    })
    .filter((entry) => entry.medium === 'movie');

const rows = [];
const unavailable = [];
for (const entry of entries) {
    if (EXPANSIONS[entry.id]) {
        rows.push(
            ...EXPANSIONS[entry.id].map((film) => ({
                ...entry,
                ...film,
                aggregateTitle: entry.title,
            }))
        );
        continue;
    }
    if (!entry.letterboxdUrl) {
        unavailable.push(entry);
        continue;
    }
    rows.push({
        ...entry,
        year: entry.letterboxdYear ?? '',
    });
}

const watched = rows
    .filter((entry) => entry.status !== 'shelved')
    .sort(byTitle);
const watchlist = rows
    .filter((entry) => entry.status === 'shelved')
    .sort(byTitle);

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(
    join(OUTPUT_DIR, 'watched.csv'),
    [
        ['LetterboxdURI', 'Title', 'Year', 'Rating10'],
        ...watched.map((entry) => [
            entry.letterboxdUrl,
            entry.title,
            entry.year,
            exactRating10(entry.enjoyment),
        ]),
    ]
        .map(csvRow)
        .join('\n') + '\n'
);
writeFileSync(
    join(OUTPUT_DIR, 'watchlist.csv'),
    [
        ['LetterboxdURI', 'Title', 'Year'],
        ...watchlist.map((entry) => [
            entry.letterboxdUrl,
            entry.title,
            entry.year,
        ]),
    ]
        .map(csvRow)
        .join('\n') + '\n'
);
writeFileSync(join(OUTPUT_DIR, 'README.md'), renderReport());

console.log(
    `[letterboxd-export] ${watched.length} watched, ${watchlist.length} watchlist, ${unavailable.length} unavailable`
);

function renderReport() {
    return `# Letterboxd backfill list

Profile: [silentnovas](https://letterboxd.com/silentnovas/)

This is the complete Letterboxd-compatible inventory from the bookshelf: **${watched.length + watchlist.length} individual titles** (${watched.length} watched and ${watchlist.length} watchlist). The aggregate “Divergent series” bookshelf record is expanded into its three films.

For less clicking, [watched.csv](./watched.csv) can be uploaded through Letterboxd’s watched-film importer and [watchlist.csv](./watchlist.csv) through its separate watchlist importer. Both files use exact Letterboxd URIs. They intentionally omit \`WatchedDate\`, so they do not invent historical diary dates. Integer bookshelf ratings are included losslessly; half-point ratings out of ten are left blank because Letterboxd cannot represent quarter-star values.

## Watched (${watched.length})

${watched.map(reportLine).join('\n')}

## Watchlist (${watchlist.length})

${watchlist.map(reportLine).join('\n')}

## Not currently available on Letterboxd (${unavailable.length})

${unavailable.length ? unavailable.map(unavailableLine).join('\n') : '- None.'}
`;
}

function reportLine(entry) {
    const details = [];
    const yearSuffix = entry.year ? ` (${entry.year})` : ' (unreleased)';
    const label = String(entry.title).endsWith(yearSuffix)
        ? entry.title
        : `${entry.title}${yearSuffix}`;
    if (entry.dateAdded) details.push(`bookshelf date ${entry.dateAdded}`);
    if (entry.enjoyment !== undefined && entry.enjoyment !== null) {
        details.push(`appreciation ${entry.enjoyment}/10`);
    }
    if (entry.aggregateTitle) details.push(`from “${entry.aggregateTitle}”`);
    return `- [${label}](${entry.letterboxdUrl})${details.length ? ` — ${details.join('; ')}` : ''}`;
}

function unavailableLine(entry) {
    const source = entry.url
        ? `[source record](${entry.url})`
        : 'no source record';
    return `- **${entry.title}** — ${source}. Letterboxd does not currently carry this KBS TV special, so there is no canonical Letterboxd link to attach.`;
}

function exactRating10(value) {
    const rating = Number(value);
    return Number.isInteger(rating) && rating >= 1 && rating <= 10 ? rating : '';
}

function csvRow(values) {
    return values.map(csvCell).join(',');
}

function csvCell(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function byTitle(a, b) {
    return a.title.localeCompare(b.title);
}
