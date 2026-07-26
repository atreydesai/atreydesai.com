// One-time/re-runnable canonical Letterboxd link backfill for bookshelf films.
//
// Most links resolve exactly through each film's Wikipedia -> Wikidata record.
// The small fallback table covers MDL/IMDb sources, redirects, recent releases,
// and the one aggregate series record. Existing dates and source URLs are
// asserted unchanged.

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    parseFrontmatter,
    upsertScalar,
    yamlString,
} from './letterboxd-utils.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOOKS_DIR = join(ROOT, 'src/content/books');
const USER_AGENT = 'atreydesai.com bookshelf sync (https://atreydesai.com)';

// Wikidata retains some superseded release dates. Letterboxd displays the
// actual release year for these films, which is what its importer expects.
const YEAR_OVERRIDES = {
    'doctor-strange-in-the-multiverse-of-madness': 2022,
    'mcfarland-u-s-a': 2015,
    'spider-man-across-the-spider-verse': 2023,
    'thor-love-and-thunder': 2022,
};

const LINK_OVERRIDES = {
    'a-guilty-conscience': film('a-guilty-conscience', 2023),
    'a-walk-to-remember': film('a-walk-to-remember', 2002),
    'better-days': film('better-days-2019', 2019),
    'black-bag': film('black-bag-2025', 2025),
    'divergent-series': {
        url: 'https://letterboxd.com/films/in/divergent-collection/by/release-earliest/',
        year: null,
    },
    scrapper: film('scrapper-2023', 2023),
    spectral: film('spectral', 2016),
    'the-last-10-years': film('the-last-10-years', 2022),
    'the-ugly-truth': film('the-ugly-truth', 2009),

    'just-for-meeting-you': film('just-for-meeting-you', 2023),
    'she-came-from-the-future': film('sore-a-wife-from-the-future', 2025),
    'upcoming-summer': film('upcoming-summer', 2021),
    'you-do-you': film('you-do-you', 2023),

    '20th-century-girl': film('20th-century-girl', 2022),
    'cheese-in-the-trap': film('cheese-in-the-trap', 2018),
    'drama-special-season-9-so-close-yet-so-far': film('so-close-yet-so-far', 2018),
    dream: film('dream-2023', 2023),
    'forbidden-fairytale': film('forbidden-fairytale', 2025),
    'good-news': film('good-news-2025', 2025),
    'hear-me-our-summer': film('hear-me-our-summer', 2024),
    'its-okay': film('its-okay-2023', 2023),
    'kill-bok-soon': film('kill-boksoon', 2023),
    'love-911': film('love-911', 2012),
    'love-in-the-big-city': film('love-in-the-big-city', 2024),
    'man-in-love': film('man-in-love', 2014),
    'midnight-runners': film('midnight-runners', 2017),
    'midnight-sun': film('midnight-sun-2025', 2025),
    'my-sassy-girl': film('my-sassy-girl', 2001),
    'night-fever': film('night-fever', 2026),
    'once-we-were-us': film('once-we-were-us', 2025),
    'please-be-my-ear': film('please-be-my-ear', 2023),
    'project-y': film('project-y', 2025),
    soulmate: film('soulmate-2023', 2023),
    'spring-summer-fall-winter-and-spring': film(
        'spring-summer-fall-winter-and-spring',
        2003
    ),
    switch: film('switch-2023', 2023),
    'tune-in-for-love': film('tune-in-for-love', 2019),
    vertigo: film('vertigo-2019', 2019),
    'you-are-the-apple-of-my-eye': film('you-are-the-apple-of-my-eye-2024', 2024),
};

const entries = readdirSync(BOOKS_DIR)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => {
        const path = join(BOOKS_DIR, file);
        const text = readFileSync(path, 'utf8');
        return {
            file,
            path,
            text,
            data: parseFrontmatter(text)?.data ?? {},
        };
    })
    .filter((entry) => entry.data.medium === 'movie');

const wikipediaEntries = entries.filter(
    (entry) =>
        !entry.data.letterboxdUrl &&
        !LINK_OVERRIDES[entry.data.id] &&
        /wikipedia\.org\/wiki\//.test(entry.data.url ?? '')
);
const wikidataLinks = await resolveWikipediaLinks(wikipediaEntries);

let linked = 0;
let corrected = 0;
let unchanged = 0;
const unavailable = [];

for (const entry of entries) {
    const resolved = entry.data.letterboxdUrl
        ? {
              url: entry.data.letterboxdUrl,
              year: YEAR_OVERRIDES[entry.data.id] ?? entry.data.letterboxdYear ?? null,
          }
        : LINK_OVERRIDES[entry.data.id] ?? wikidataLinks.get(entry.data.id);
    if (!resolved?.url) {
        unavailable.push({
            id: entry.data.id,
            title: entry.data.title,
            source: entry.data.url ?? null,
        });
        continue;
    }

    const originalDateAdded = entry.data.dateAdded;
    let next = entry.text;
    if (!entry.data.letterboxdUrl) {
        next = upsertScalar(
            next,
            'letterboxdUrl',
            yamlString(resolved.url),
            { after: ['url', 'mdlId'] }
        );
    }
    if (resolved.year) {
        next = upsertScalar(next, 'letterboxdYear', String(resolved.year), {
            after: ['letterboxdUrl'],
            overwrite: true,
        });
    }

    const updated = parseFrontmatter(next)?.data ?? {};
    if (updated.dateAdded !== originalDateAdded) {
        throw new Error(
            `${entry.file}: dateAdded changed from ${JSON.stringify(originalDateAdded)} to ${JSON.stringify(updated.dateAdded)}`
        );
    }
    if (updated.url !== entry.data.url) {
        throw new Error(`${entry.file}: source URL changed during Letterboxd backfill`);
    }

    if (next === entry.text) {
        unchanged++;
        continue;
    }

    writeFileSync(entry.path, next);
    if (entry.data.letterboxdUrl) corrected++;
    else linked++;
}

console.log(
    `[letterboxd-backfill] ${linked} linked, ${corrected} corrected, ${unchanged} already linked, ${unavailable.length} unavailable`
);
if (unavailable.length) console.log(JSON.stringify(unavailable, null, 2));

async function resolveWikipediaLinks(targets) {
    const results = new Map();

    for (let start = 0; start < targets.length; start += 50) {
        const chunk = targets.slice(start, start + 50);
        const requestedTitles = chunk.map((entry) =>
            decodeURIComponent(entry.data.url.split('/wiki/')[1].split('#')[0]).replace(/_/g, ' ')
        );
        const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({
            action: 'wbgetentities',
            sites: 'enwiki',
            titles: requestedTitles.join('|'),
            props: 'claims|sitelinks',
            format: 'json',
            redirects: 'yes',
        })}`;
        const response = await fetch(url, {
            headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        });
        if (!response.ok) {
            throw new Error(`Wikidata returned ${response.status}`);
        }

        const payload = await response.json();
        const aliases = new Map();
        for (const item of payload.normalized ?? []) aliases.set(item.from, item.to);
        for (const item of payload.redirects ?? []) aliases.set(item.from, item.to);

        const byTitle = new Map();
        for (const entity of Object.values(payload.entities ?? {})) {
            const title = entity.sitelinks?.enwiki?.title;
            if (title) byTitle.set(title, entity);
        }

        for (const [index, entry] of chunk.entries()) {
            let title = requestedTitles[index];
            const visited = new Set();
            while (aliases.has(title) && !visited.has(title)) {
                visited.add(title);
                title = aliases.get(title);
            }

            const entity = byTitle.get(title);
            const slug = claimValue(entity, 'P6127');
            if (!slug) continue;

            results.set(entry.data.id, {
                url: `https://letterboxd.com/film/${slug}/`,
                year: releaseYear(entity),
            });
        }
    }

    return results;
}

function claimValue(entity, property) {
    return entity?.claims?.[property]?.[0]?.mainsnak?.datavalue?.value ?? null;
}

function releaseYear(entity) {
    const years = (entity?.claims?.P577 ?? [])
        .map((claim) => claim.mainsnak?.datavalue?.value?.time?.slice(1, 5))
        .filter((year) => /^\d{4}$/.test(year))
        .map(Number);
    return years.length ? Math.min(...years) : null;
}

function film(slug, year) {
    return {
        url: `https://letterboxd.com/film/${slug}/`,
        year,
    };
}
