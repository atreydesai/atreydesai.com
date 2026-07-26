// Sync public Letterboxd watched films and watchlist films, plus new diary
// entries/reviews, into src/content/books/.
//
// Letterboxd intentionally offers its public RSS feed (rather than API access)
// for personal integrations. The feed contains new diary entries/reviews and
// lists; list-only items are ignored here. Public films and watchlist pages are
// read separately so rating-only and planned films can remain service-sourced.
//
// Existing bookshelf entries are matched by canonical Letterboxd URL,
// namespaced Letterboxd ID, true RSS-provided TMDB ID, or compatible-media
// title. Their original dateAdded and source URL are never changed. New
// diary films use their watched date (or feed publication date); new rating-only
// and watchlist films use the sync date, with watchlist films remaining shelved.
// Every new item stores a canonical letterboxdUrl.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  decodeEntities,
  normalizeTitle,
  parseFrontmatter,
  removeScalar,
  replaceScalar,
  slugify,
  upsertScalar,
  upsertStringList,
  yamlString,
} from "./letterboxd-utils.mjs";
import { cleanTags, yamlListLines } from "./tag-sources.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BOOKS_DIR = join(ROOT, "src/content/books");
const OVERRIDES_PATH = join(ROOT, "scripts/letterboxd-overrides.json");
const LETTERBOXD_USER = process.env.LETTERBOXD_USER || "silentnovas";
const FEED_URL = `https://letterboxd.com/${LETTERBOXD_USER}/rss/`;
const FILMS_URL = `https://letterboxd.com/${LETTERBOXD_USER}/films/`;
const WATCHLIST_URL = `https://letterboxd.com/${LETTERBOXD_USER}/watchlist/`;
const USER_AGENT = "Mozilla/5.0";
const BOOKSHELF_TIME_ZONE =
  process.env.BOOKSHELF_TIME_ZONE || "America/New_York";

export class LetterboxdRemoteError extends Error {
  constructor(message, cause = null) {
    super(message);
    this.name = "LetterboxdRemoteError";
    this.cause = cause;
  }
}

export class LetterboxdUnavailableError extends LetterboxdRemoteError {
  constructor(message) {
    super(message);
    this.name = "LetterboxdUnavailableError";
  }
}

export function parseLetterboxdFeed(xml) {
  const items = [];
  const blocks = String(xml).match(/<item>[\s\S]*?<\/item>/g) ?? [];

  for (const block of blocks) {
    const title = xmlTag(block, "letterboxd:filmTitle");
    const memberLink = xmlTag(block, "link");
    const slug = letterboxdSlug(memberLink);
    if (!title || !slug) continue;

    const movieId = xmlTag(block, "tmdb:movieId");
    const tvId = xmlTag(block, "tmdb:tvId");
    const ratingValue = Number(xmlTag(block, "letterboxd:memberRating"));
    const yearValue = Number(xmlTag(block, "letterboxd:filmYear"));
    const watchedDate = validIsoDate(xmlTag(block, "letterboxd:watchedDate"));
    const publishedDate = dateOnly(xmlTag(block, "pubDate"));

    items.push({
      title,
      slug,
      letterboxdUrl: `https://letterboxd.com/film/${slug}/`,
      year: Number.isInteger(yearValue) && yearValue > 1800 ? yearValue : null,
      rating:
        Number.isFinite(ratingValue) && ratingValue > 0 ? ratingValue : null,
      liked: /^yes$/i.test(xmlTag(block, "letterboxd:memberLike")),
      watchedDate,
      publishedDate,
      tmdbId: movieId || tvId || null,
      tmdbType: tvId ? "tv" : "movie",
      medium: tvId ? "show" : "movie",
    });
  }

  return items;
}

export function parseLetterboxdWatchlist(html) {
  const items = [];
  const posterTags =
    String(html).match(
      /<div\b[^>]*\bdata-item-slug=(?:"[^"]+"|'[^']+')[^>]*>/gi,
    ) ?? [];

  for (const tag of posterTags) {
    const poster = parsePosterTag(tag);
    if (!poster) continue;
    items.push({
      ...poster,
      rating: null,
      liked: false,
      watchedDate: null,
      publishedDate: null,
      watchlisted: true,
    });
  }

  return items;
}

export function parseLetterboxdFilms(html) {
  const items = [];
  const gridItems =
    String(html).match(
      /<li\b[^>]*\bclass=(?:"[^"]*\bgriditem\b[^"]*"|'[^']*\bgriditem\b[^']*')[^>]*>[\s\S]*?<\/li>/gi,
    ) ?? [];

  for (const block of gridItems) {
    const posterTag = block.match(
      /<div\b[^>]*\bdata-item-slug=(?:"[^"]+"|'[^']+')[^>]*>/i,
    )?.[0];
    const poster = posterTag ? parsePosterTag(posterTag) : null;
    if (!poster) continue;

    const ratingValue = Number(block.match(/\brated-(\d+)\b/i)?.[1]);
    items.push({
      ...poster,
      rating:
        Number.isInteger(ratingValue) && ratingValue >= 1 && ratingValue <= 10
          ? ratingValue / 2
          : null,
      liked: /\b(?:liked-micro|icon-liked)\b/i.test(block),
      watchedDate: null,
      publishedDate: null,
      watched: true,
    });
  }

  return items;
}

export function parseLetterboxdGenreTags(html) {
  const genreSlugs = [
    ...String(html).matchAll(/href=["']\/films\/genre\/([^/"'?#]+)\/["']/gi),
  ].map((match) => decodeURIComponent(match[1]).replace(/-/g, " ").trim());
  return cleanTags(genreSlugs);
}

export async function fetchLetterboxdGenreTags(letterboxdUrl) {
  if (!letterboxdUrl) return [];
  try {
    const html = await fetchLetterboxdText(
      letterboxdUrl,
      {
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html",
        },
      },
      "film genres",
    );
    return parseLetterboxdGenreTags(html);
  } catch (error) {
    if (!(error instanceof LetterboxdRemoteError)) throw error;
    console.warn(
      `[letterboxd-sync] genres unavailable for ${letterboxdUrl}: ${errorMessage(error)}`,
    );
    return [];
  }
}

export async function fetchLetterboxdWatchlist(watchlistUrl = WATCHLIST_URL) {
  return fetchLetterboxdPages(
    watchlistUrl,
    parseLetterboxdWatchlist,
    "watchlist",
  );
}

export async function fetchLetterboxdFilms(filmsUrl = FILMS_URL) {
  return fetchLetterboxdPages(filmsUrl, parseLetterboxdFilms, "films");
}

async function fetchLetterboxdPages(basePageUrl, parsePage, label) {
  const items = [];
  const seen = new Set();
  const baseUrl = basePageUrl.endsWith("/") ? basePageUrl : `${basePageUrl}/`;

  for (let page = 1; page <= 100; page++) {
    const url =
      page === 1 ? baseUrl : new URL(`page/${page}/`, baseUrl).toString();
    const response = await fetchLetterboxdResponse(
      url,
      {
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html",
        },
      },
      label,
    );

    // Letterboxd occasionally challenges deeper public profile pages.
    // Page one always contains the newest additions, so keeping the
    // successfully parsed prefix is preferable to dropping the whole sync.
    if (page > 1 && [403, 404, 429].includes(response.status)) break;
    if (!response.ok) {
      throw new LetterboxdRemoteError(
        `Letterboxd ${label} returned ${response.status}`,
      );
    }

    const pageItems = parsePage(await readLetterboxdText(response, label));
    if (pageItems.length === 0) break;

    let added = 0;
    for (const item of pageItems) {
      if (seen.has(item.slug)) continue;
      seen.add(item.slug);
      items.push(item);
      added++;
    }
    if (added === 0) break;
  }

  return items;
}

export function updateExistingEntry(text, item, tags = []) {
  const original = parseFrontmatter(text);
  if (!original) return { text, changed: false };

  const originalDateAdded = original.data.dateAdded;
  let next = text;
  const changes = {
    linked: false,
    rated: false,
    favorited: false,
    promoted: false,
    tagged: false,
    identified: false,
  };

  if (!original.data.letterboxdUrl) {
    next = upsertScalar(next, "letterboxdUrl", yamlString(item.letterboxdUrl), {
      after: ["url", "mdlId"],
    });
    changes.linked = next !== text;
  }

  let data = parseFrontmatter(next)?.data ?? {};
  if (!data.letterboxdYear && item.year) {
    next = upsertScalar(next, "letterboxdYear", String(item.year), {
      after: ["letterboxdUrl"],
    });
  }

  data = parseFrontmatter(next)?.data ?? {};
  if (!data.letterboxdId && item.letterboxdId) {
    next = upsertScalar(next, "letterboxdId", yamlString(item.letterboxdId), {
      after: ["letterboxdYear", "letterboxdUrl"],
    });
    changes.identified = true;
  }

  data = parseFrontmatter(next)?.data ?? {};
  if (!data.tmdbId && item.tmdbId) {
    next = upsertScalar(next, "tmdbId", yamlString(item.tmdbId), {
      after: ["letterboxdId", "letterboxdYear", "letterboxdUrl"],
    });
    next = upsertScalar(next, "tmdbType", item.tmdbType, {
      after: ["tmdbId"],
    });
  }

  data = parseFrontmatter(next)?.data ?? {};
  if (needsTagBackfill(data) && tags.length > 0) {
    next = upsertStringList(next, "tags", tags, {
      after: ["tmdbType", "tmdbId", "letterboxdId", "letterboxdYear"],
      overwrite: Array.isArray(data.tags),
    });
    changes.tagged = true;
  }

  data = parseFrontmatter(next)?.data ?? {};
  if (
    !item.watchlisted &&
    (data.status === "shelved" || data.status === "current")
  ) {
    next = removeScalar(next, "status");
    changes.promoted = true;
  }

  data = parseFrontmatter(next)?.data ?? {};
  if (
    (data.enjoyment === undefined || data.enjoyment === null) &&
    item.rating
  ) {
    next = upsertScalar(next, "enjoyment", formatNumber(item.rating * 2), {
      after: [
        "status",
        "tags",
        "tmdbType",
        "tmdbId",
        "letterboxdId",
        "letterboxdYear",
      ],
    });
    changes.rated = true;
  }

  data = parseFrontmatter(next)?.data ?? {};
  if (item.liked && data.favorite === false) {
    next = replaceScalar(next, "favorite", "true");
    changes.favorited = true;
  }

  const updatedDateAdded = parseFrontmatter(next)?.data?.dateAdded;
  if (updatedDateAdded !== originalDateAdded) {
    throw new Error(
      `Refusing to change dateAdded from ${JSON.stringify(originalDateAdded)} to ${JSON.stringify(updatedDateAdded)}`,
    );
  }

  return {
    text: next,
    changed: next !== text,
    ...changes,
  };
}

export function renderNewEntry(item, id, tags = [], today = new Date()) {
  const dateAdded =
    item.watchedDate || item.publishedDate || localIsoDate(today);
  const lines = [
    "---",
    `id: ${yamlString(id)}`,
    `title: ${yamlString(item.title)}`,
    'author: ""',
    "category: fiction",
    `dateAdded: ${yamlString(dateAdded)}`,
    `favorite: ${item.liked}`,
    `medium: ${itemMedium(item)}`,
    `url: ${yamlString(item.letterboxdUrl)}`,
    `letterboxdUrl: ${yamlString(item.letterboxdUrl)}`,
  ];

  if (item.year) lines.push(`letterboxdYear: ${item.year}`);
  if (item.letterboxdId) {
    lines.push(`letterboxdId: ${yamlString(item.letterboxdId)}`);
  }
  if (item.tmdbId) {
    lines.push(
      `tmdbId: ${yamlString(item.tmdbId)}`,
      `tmdbType: ${item.tmdbType}`,
    );
  }
  lines.push(...yamlListLines("tags", tags));
  if (item.rating) lines.push(`enjoyment: ${formatNumber(item.rating * 2)}`);
  if (item.watchlisted) lines.push("status: shelved");
  lines.push("---", "");

  return lines.join("\n");
}

export async function runLetterboxdSync({
  booksDir = BOOKS_DIR,
  feedUrl = FEED_URL,
  filmsUrl = FILMS_URL,
  watchlistUrl = WATCHLIST_URL,
  overridesPath = OVERRIDES_PATH,
  syncDate = new Date(),
  genreFetcher = fetchLetterboxdGenreTags,
} = {}) {
  const [feedResult, filmsResult, watchlistResult] = await Promise.allSettled([
    fetchLetterboxdText(
      feedUrl,
      {
        headers: {
          "user-agent": USER_AGENT,
          accept: "application/rss+xml,application/xml,text/xml",
        },
      },
      "RSS",
    ).then((xml) => dedupeItems(parseLetterboxdFeed(xml))),
    fetchLetterboxdFilms(filmsUrl).then(dedupeItems),
    fetchLetterboxdWatchlist(watchlistUrl).then(dedupeItems),
  ]);

  const feedItems = settledSourceValue(feedResult, "RSS");
  const filmsItems = settledSourceValue(filmsResult, "films");
  const watchlistItems = settledSourceValue(watchlistResult, "watchlist");
  if (
    feedResult.status === "rejected" &&
    filmsResult.status === "rejected" &&
    watchlistResult.status === "rejected"
  ) {
    throw new LetterboxdUnavailableError(
      "Letterboxd RSS, films, and watchlist are all unavailable",
    );
  }

  const overrides = existsSync(overridesPath)
    ? JSON.parse(readFileSync(overridesPath, "utf8"))
    : { matches: {}, aggregates: {}, exclude: [] };
  const excluded = new Set(overrides.exclude ?? []);
  const aggregateMatches = overrides.aggregates ?? {};
  const entries = loadEntries(booksDir);
  const existingSlugs = new Set(
    entries.map((entry) => entry.file.replace(/\.md$/, "")),
  );

  const counts = {
    feed: feedItems.length,
    films: filmsItems.length,
    watchlist: watchlistItems.length,
    created: 0,
    linked: 0,
    rated: 0,
    favorited: 0,
    promoted: 0,
    tagged: 0,
    identified: 0,
    aggregated: 0,
    unchanged: 0,
    excluded: 0,
  };

  const queuedItems = [
    ...watchlistItems,
    ...feedItems.reverse(),
    ...filmsItems,
  ];
  for (const item of queuedItems) {
    const aggregateId = aggregateMatches[item.slug];
    if (aggregateId) {
      const aggregate = entries.find((entry) => entry.data.id === aggregateId);
      if (!aggregate) {
        throw new Error(
          `Letterboxd aggregate override for ${item.slug} references missing entry ${aggregateId}`,
        );
      }
      if (aggregate.data.medium !== "movie") {
        throw new Error(
          `Letterboxd aggregate override for ${item.slug} points to incompatible medium ${aggregate.data.medium}`,
        );
      }
      counts.aggregated++;
      continue;
    }

    if (excluded.has(item.slug)) {
      counts.excluded++;
      continue;
    }

    const existing = findExistingEntry(item, entries, overrides.matches ?? {});
    if (existing) {
      const tags =
        !item.watchlisted && needsTagBackfill(existing.data)
          ? await genreFetcher(item.letterboxdUrl)
          : [];
      const result = updateExistingEntry(existing.text, item, tags);
      if (result.changed) {
        writeFileSync(existing.path, result.text);
        existing.text = result.text;
        existing.data = parseFrontmatter(result.text)?.data ?? existing.data;
        counts.linked += Number(result.linked);
        counts.rated += Number(result.rated);
        counts.favorited += Number(result.favorited);
        counts.promoted += Number(result.promoted);
        counts.tagged += Number(result.tagged);
        counts.identified += Number(result.identified);
      } else {
        counts.unchanged++;
      }
      continue;
    }

    const tags = item.watchlisted ? [] : await genreFetcher(item.letterboxdUrl);
    const id = availableSlug(item, existingSlugs);
    const text = renderNewEntry(item, id, tags, syncDate);
    const path = join(booksDir, `${id}.md`);
    writeFileSync(path, text);
    existingSlugs.add(id);
    entries.push({
      file: `${id}.md`,
      path,
      text,
      data: parseFrontmatter(text)?.data ?? {},
    });
    counts.created++;
  }

  console.log(
    `[letterboxd-sync] ${counts.feed} feed films, ${counts.films} watched films, ` +
      `${counts.watchlist} watchlist films, ` +
      `${counts.created} created, ` +
      `${counts.linked} linked, ${counts.identified} identified, ` +
      `${counts.rated} rated, ${counts.favorited} favorited, ` +
      `${counts.promoted} promoted to done, ${counts.tagged} tagged, ` +
      `${counts.aggregated} aggregate components ignored, ` +
      `${counts.unchanged} unchanged, ${counts.excluded} excluded`,
  );

  return counts;
}

function loadEntries(booksDir) {
  return readdirSync(booksDir)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const path = join(booksDir, file);
      const text = readFileSync(path, "utf8");
      return {
        file,
        path,
        text,
        data: parseFrontmatter(text)?.data ?? {},
      };
    });
}

export function findExistingEntry(item, entries, titleMatches = {}) {
  const forcedId = titleMatches[item.slug];
  if (forcedId) {
    const forced = entries.find((entry) => entry.data.id === forcedId);
    if (!forced) {
      throw new Error(
        `Letterboxd override for ${item.slug} references missing entry ${forcedId}`,
      );
    }
    if (!isCompatibleMedia(forced.data, item)) {
      throw new Error(
        `Letterboxd override for ${item.slug} points to incompatible medium ${forced.data.medium}`,
      );
    }
    return forced;
  }

  const canonicalUrl = normalizeUrl(item.letterboxdUrl);
  const byUrl = entries.find(
    (entry) => normalizeUrl(entry.data.letterboxdUrl) === canonicalUrl,
  );
  if (byUrl) return byUrl;

  if (item.letterboxdId) {
    const byLetterboxdId = entries.find(
      (entry) => entry.data.letterboxdId === item.letterboxdId,
    );
    if (byLetterboxdId) return byLetterboxdId;
  }

  if (item.tmdbId) {
    const byTmdb = entries.find(
      (entry) =>
        String(entry.data.tmdbId ?? "") === String(item.tmdbId) &&
        (!entry.data.tmdbType || entry.data.tmdbType === item.tmdbType),
    );
    if (byTmdb) return byTmdb;
  }

  const normalized = normalizeTitle(item.title);
  const titleCandidates = entries.filter(
    (entry) =>
      isCompatibleMedia(entry.data, item) &&
      normalizeTitle(entry.data.title) === normalized &&
      (!entry.data.letterboxdYear ||
        !item.year ||
        Number(entry.data.letterboxdYear) === item.year),
  );
  return titleCandidates.length === 1 ? titleCandidates[0] : null;
}

export function dedupeItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.tmdbId
      ? `tmdb:${item.tmdbType}:${item.tmdbId}`
      : item.letterboxdId
        ? `letterboxd:${item.letterboxdId}`
        : `url:${normalizeUrl(item.letterboxdUrl)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function needsTagBackfill(data) {
  return (
    !Object.prototype.hasOwnProperty.call(data, "tags") ||
    (Array.isArray(data.tags) && data.tags.length === 0)
  );
}

function itemMedium(item) {
  return item.medium === "show" || item.tmdbType === "tv" ? "show" : "movie";
}

function isCompatibleMedia(data, item) {
  return data.medium === itemMedium(item);
}

function htmlAttribute(tag, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = tag.match(
    new RegExp(`\\b${escapedName}=(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  return match ? decodeEntities(match[1] ?? match[2] ?? "") : "";
}

function parsePosterTag(tag) {
  const slug = htmlAttribute(tag, "data-item-slug");
  const displayName =
    htmlAttribute(tag, "data-item-full-display-name") ||
    htmlAttribute(tag, "data-item-name");
  if (!slug || !displayName) return null;

  const yearMatch = displayName.match(/\s+\((\d{4})\)\s*$/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  const title = yearMatch
    ? displayName.slice(0, yearMatch.index).trim()
    : displayName.trim();
  if (!title) return null;

  let letterboxdId = null;
  let medium = "movie";
  const identifierValue = htmlAttribute(tag, "data-postered-identifier");
  if (identifierValue) {
    try {
      const identifier = JSON.parse(identifierValue);
      const uid = String(identifier.uid ?? "");
      if (/^[a-z][a-z0-9_-]*:\d+$/i.test(uid)) {
        letterboxdId = uid;
      }
      const type = String(identifier.typeName ?? identifier.type ?? "");
      if (/^(?:tv|television|series)$/i.test(type)) medium = "show";
    } catch {
      // Title, year, and slug are sufficient if metadata changes.
    }
  }

  return {
    title,
    slug,
    letterboxdUrl: `https://letterboxd.com/film/${slug}/`,
    year: Number.isInteger(year) && year > 1800 ? year : null,
    letterboxdId,
    medium,
  };
}

async function fetchLetterboxdResponse(url, options, label) {
  try {
    new URL(url);
  } catch (error) {
    throw new TypeError(`Invalid Letterboxd ${label} URL: ${url}`, {
      cause: error,
    });
  }

  try {
    return await fetch(url, options);
  } catch (error) {
    throw new LetterboxdRemoteError(
      `Letterboxd ${label} request failed: ${errorMessage(error)}`,
      error,
    );
  }
}

async function readLetterboxdText(response, label) {
  try {
    return await response.text();
  } catch (error) {
    throw new LetterboxdRemoteError(
      `Letterboxd ${label} response failed: ${errorMessage(error)}`,
      error,
    );
  }
}

async function fetchLetterboxdText(url, options, label) {
  const response = await fetchLetterboxdResponse(url, options, label);
  if (!response.ok) {
    throw new LetterboxdRemoteError(
      `Letterboxd ${label} returned ${response.status}`,
    );
  }
  return readLetterboxdText(response, label);
}

function settledSourceValue(result, label) {
  if (result.status === "fulfilled") return result.value;
  if (!(result.reason instanceof LetterboxdRemoteError)) throw result.reason;
  console.warn(
    `[letterboxd-sync] ${label} unavailable: ${errorMessage(result.reason)}`,
  );
  return [];
}

function errorMessage(reason) {
  return reason instanceof Error ? reason.message : String(reason);
}

function availableSlug(item, existingSlugs) {
  const base =
    slugify(item.title) ||
    `letterboxd-${item.tmdbId || item.letterboxdId || item.slug}`;
  const candidates = [
    base,
    item.year ? `${base}-${item.year}` : null,
    item.tmdbId ? `${base}-${item.tmdbId}` : null,
    item.letterboxdId
      ? `${base}-${item.letterboxdId.replace(/[^a-z0-9]+/gi, "-")}`
      : null,
  ].filter(Boolean);
  return (
    candidates.find((candidate) => !existingSlugs.has(candidate)) ||
    `${base}-letterboxd`
  );
}

function xmlTag(block, name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(
    new RegExp(
      `<${escapedName}(?:\\s[^>]*)?>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${escapedName}>`,
    ),
  );
  return match ? decodeEntities(match[1].trim()) : "";
}

function letterboxdSlug(link) {
  try {
    return new URL(link).pathname.match(/\/film\/([^/]+)/)?.[1] ?? null;
  } catch {
    return null;
  }
}

function validIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function dateOnly(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function localIsoDate(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BOOKSHELF_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const dateParts = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: partValue }) => [type, partValue]),
  );
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function normalizeUrl(value) {
  return String(value ?? "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function formatNumber(value) {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(2)));
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

export async function runLetterboxdCli(sync = runLetterboxdSync) {
  try {
    return await sync();
  } catch (error) {
    if (!(error instanceof LetterboxdUnavailableError)) throw error;
    console.warn(
      `[letterboxd-sync] remote outage, skipping sync: ${error.message}`,
    );
    return null;
  }
}

if (isMain) await runLetterboxdCli();
