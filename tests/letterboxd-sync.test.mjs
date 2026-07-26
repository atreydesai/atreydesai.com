import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  dedupeItems,
  findExistingEntry,
  LetterboxdUnavailableError,
  parseLetterboxdFeed,
  parseLetterboxdFilms,
  parseLetterboxdGenreTags,
  parseLetterboxdWatchlist,
  renderNewEntry,
  runLetterboxdCli,
  runLetterboxdSync,
  updateExistingEntry,
} from "../scripts/sync-letterboxd.mjs";
import { parseFrontmatter } from "../scripts/letterboxd-utils.mjs";

const feed = `<?xml version="1.0"?>
<rss xmlns:letterboxd="https://letterboxd.com" xmlns:tmdb="https://themoviedb.org">
  <channel>
    <item>
      <title>C&#039;mon C&#039;mon, 2021 - ★★★½</title>
      <link>https://letterboxd.com/silentnovas/film/cmon-cmon/1/</link>
      <pubDate>Thu, 23 Jul 2026 16:03:01 +1200</pubDate>
      <letterboxd:watchedDate>2026-07-22</letterboxd:watchedDate>
      <letterboxd:filmTitle>C&#039;mon C&#039;mon</letterboxd:filmTitle>
      <letterboxd:filmYear>2021</letterboxd:filmYear>
      <letterboxd:memberRating>3.5</letterboxd:memberRating>
      <letterboxd:memberLike>Yes</letterboxd:memberLike>
      <tmdb:movieId>632617</tmdb:movieId>
    </item>
    <item>
      <title>A list, not a film</title>
      <link>https://letterboxd.com/silentnovas/list/a-list/</link>
    </item>
  </channel>
</rss>`;

const watchlist = `
<ul>
  <li class="griditem">
    <div
      class="react-component"
      data-component-class="LazyPoster"
      data-item-name="Hana &amp; Alice (2004)"
      data-item-slug="hana-alice"
      data-item-full-display-name="Hana &amp; Alice (2004)"
      data-postered-identifier='{&quot;uid&quot;:&quot;film:34194&quot;,&quot;type&quot;:&quot;film&quot;}'
      data-target-link="/film/hana-alice/"
    ></div>
  </li>
</ul>`;

const watchedFilms = `
<ul>
  <li class="griditem">
    <div
      class="react-component"
      data-component-class="LazyPoster"
      data-item-name="The Way Back (2020)"
      data-item-slug="the-way-back-2020"
      data-item-full-display-name="The Way Back (2020)"
      data-postered-identifier='{&quot;uid&quot;:&quot;film:458743&quot;,&quot;type&quot;:&quot;film&quot;}'
      data-target-link="/film/the-way-back-2020/"
    ></div>
    <p class="poster-viewingdata" data-item-uid="film:458743">
      <span class="rating -micro -darker rated-8">★★★★</span>
      <span class="like liked-micro has-icon icon-liked icon-16"></span>
    </p>
  </li>
</ul>`;

const filmGenres = `
<div id="tab-genres">
  <a href="/films/genre/drama/">Drama</a>
  <a href="/films/genre/sports/">Sports</a>
  <a href="/films/genre/drama/">Drama</a>
</div>`;

test("parses film items and ignores list-only RSS items", () => {
  assert.deepEqual(parseLetterboxdFeed(feed), [
    {
      title: "C'mon C'mon",
      slug: "cmon-cmon",
      letterboxdUrl: "https://letterboxd.com/film/cmon-cmon/",
      year: 2021,
      rating: 3.5,
      liked: true,
      watchedDate: "2026-07-22",
      publishedDate: "2026-07-23",
      tmdbId: "632617",
      tmdbType: "movie",
      medium: "movie",
    },
  ]);
});

test("parses public watchlist posters as shelved Letterboxd items", () => {
  assert.deepEqual(parseLetterboxdWatchlist(watchlist), [
    {
      title: "Hana & Alice",
      slug: "hana-alice",
      letterboxdUrl: "https://letterboxd.com/film/hana-alice/",
      year: 2004,
      rating: null,
      liked: false,
      watchedDate: null,
      publishedDate: null,
      letterboxdId: "film:34194",
      medium: "movie",
      watchlisted: true,
    },
  ]);
});

test("parses public watched films with ratings and likes", () => {
  assert.deepEqual(parseLetterboxdFilms(watchedFilms), [
    {
      title: "The Way Back",
      slug: "the-way-back-2020",
      letterboxdUrl: "https://letterboxd.com/film/the-way-back-2020/",
      year: 2020,
      rating: 4,
      liked: true,
      watchedDate: null,
      publishedDate: null,
      letterboxdId: "film:458743",
      medium: "movie",
      watched: true,
    },
  ]);
});

test("parses and deduplicates exact Letterboxd film genres", () => {
  assert.deepEqual(parseLetterboxdGenreTags(filmGenres), ["drama", "sports"]);
});

test("page poster identities never masquerade as TMDB identities", () => {
  const item = parseLetterboxdFilms(watchedFilms)[0];

  assert.equal(item.letterboxdId, "film:458743");
  assert.equal(item.tmdbId, undefined);
  assert.equal(item.tmdbType, undefined);
});

test("Letterboxd and TMDB identity namespaces never collide", () => {
  const items = dedupeItems([
    {
      title: "Page item",
      letterboxdId: "film:458743",
      letterboxdUrl: "https://letterboxd.com/film/page-item/",
    },
    {
      title: "RSS item",
      tmdbId: "458743",
      tmdbType: "movie",
      letterboxdUrl: "https://letterboxd.com/film/rss-item/",
    },
  ]);

  assert.equal(items.length, 2);
});

test("matching old activity never changes the bookshelf date or source URL", () => {
  const existing = `---
id: do-revenge
title: "Do Revenge"
author: ""
category: fiction
dateAdded: "2022-09-18"
favorite: false
medium: movie
url: "https://en.wikipedia.org/wiki/Do_Revenge"
tags:
  - comedy
  - thriller
status: shelved
---
`;
  const item = {
    ...parseLetterboxdFeed(feed)[0],
    title: "Do Revenge",
    slug: "do-revenge",
    letterboxdUrl: "https://letterboxd.com/film/do-revenge/",
    year: 2022,
    rating: 4,
    tmdbId: "762968",
  };

  const result = updateExistingEntry(existing, item);
  const data = parseFrontmatter(result.text).data;

  assert.equal(data.dateAdded, "2022-09-18");
  assert.equal(data.url, "https://en.wikipedia.org/wiki/Do_Revenge");
  assert.equal(data.letterboxdUrl, "https://letterboxd.com/film/do-revenge/");
  assert.equal(data.letterboxdYear, 2022);
  assert.equal(data.tmdbId, "762968");
  assert.equal(data.enjoyment, 8);
  assert.deepEqual(data.tags, ["comedy", "thriller"]);
  assert.equal(data.favorite, true);
  assert.equal(data.status, undefined);
});

test("watchlist activity preserves an existing shelved date and status", () => {
  const existing = `---
id: hana-and-alice
title: "Hana & Alice"
author: ""
category: fiction
dateAdded: "2024-01-05"
favorite: false
medium: movie
url: "https://example.com/hana-and-alice"
status: shelved
---
`;
  const item = parseLetterboxdWatchlist(watchlist)[0];
  const data = parseFrontmatter(updateExistingEntry(existing, item).text).data;

  assert.equal(data.dateAdded, "2024-01-05");
  assert.equal(data.status, "shelved");
  assert.equal(data.url, "https://example.com/hana-and-alice");
  assert.equal(data.letterboxdUrl, "https://letterboxd.com/film/hana-alice/");
  assert.equal(data.letterboxdYear, 2004);
  assert.equal(data.letterboxdId, "film:34194");
  assert.equal(data.tmdbId, undefined);
});

test("title fallback ignores books and other incompatible media", () => {
  const item = parseLetterboxdWatchlist(watchlist)[0];
  const book = {
    file: "hana-alice-book.md",
    data: {
      id: "hana-alice-book",
      title: "Hana & Alice",
      medium: "book",
    },
  };
  const movie = {
    file: "hana-alice-movie.md",
    data: {
      id: "hana-alice-movie",
      title: "Hana & Alice",
      medium: "movie",
    },
  };

  assert.equal(findExistingEntry(item, [book]), null);
  assert.equal(findExistingEntry(item, [book, movie]), movie);
});

test("watched promotion backfills tags without changing the original date", () => {
  const existing = `---
id: the-way-back
title: "The Way Back"
author: ""
category: fiction
dateAdded: "2026-07-25"
favorite: false
medium: movie
url: "https://letterboxd.com/film/the-way-back-2020/"
letterboxdUrl: "https://letterboxd.com/film/the-way-back-2020/"
letterboxdYear: 2020
status: shelved
---
`;
  const item = parseLetterboxdFilms(watchedFilms)[0];
  const result = updateExistingEntry(existing, item, ["drama", "sports"]);
  const data = parseFrontmatter(result.text).data;

  assert.equal(data.dateAdded, "2026-07-25");
  assert.equal(data.status, undefined);
  assert.deepEqual(data.tags, ["drama", "sports"]);
  assert.equal(result.tagged, true);
});

test("watched promotion never overwrites curated tags", () => {
  const existing = `---
id: the-way-back
title: "The Way Back"
author: ""
category: fiction
dateAdded: "2026-07-25"
favorite: false
medium: movie
url: "https://letterboxd.com/film/the-way-back-2020/"
letterboxdUrl: "https://letterboxd.com/film/the-way-back-2020/"
letterboxdYear: 2020
tags:
  - "recovery"
status: shelved
---
`;
  const item = parseLetterboxdFilms(watchedFilms)[0];
  const result = updateExistingEntry(existing, item, ["drama", "sports"]);
  const data = parseFrontmatter(result.text).data;

  assert.deepEqual(data.tags, ["recovery"]);
  assert.equal(result.tagged, false);
});

test("existing dates and ratings win over a newly added Letterboxd diary entry", () => {
  const existing = `---
id: do-revenge
title: "Do Revenge"
author: ""
category: fiction
dateAdded: "2022-09-18"
favorite: false
medium: movie
url: "https://en.wikipedia.org/wiki/Do_Revenge"
letterboxdUrl: "https://letterboxd.com/film/do-revenge/"
enjoyment: 7
---
`;
  const item = {
    ...parseLetterboxdFeed(feed)[0],
    title: "Do Revenge",
    slug: "do-revenge",
    letterboxdUrl: "https://letterboxd.com/film/do-revenge/",
    watchedDate: "2026-07-25",
    rating: 5,
  };

  const data = parseFrontmatter(updateExistingEntry(existing, item).text).data;
  assert.equal(data.dateAdded, "2022-09-18");
  assert.equal(data.enjoyment, 7);
});

test("new watchlist films use the sync date and remain shelved", () => {
  const item = parseLetterboxdWatchlist(watchlist)[0];
  const today = new Date("2026-07-25T12:00:00Z");
  const data = parseFrontmatter(
    renderNewEntry(item, "hana-and-alice", [], today),
  ).data;

  assert.equal(data.dateAdded, "2026-07-25");
  assert.equal(data.status, "shelved");
  assert.equal(data.letterboxdUrl, "https://letterboxd.com/film/hana-alice/");
  assert.equal(data.letterboxdId, "film:34194");
});

test("new watchlist films use New York time around UTC midnight", () => {
  const item = parseLetterboxdWatchlist(watchlist)[0];
  const lateEvening = new Date("2026-07-26T03:59:00Z");
  const data = parseFrontmatter(
    renderNewEntry(item, "hana-and-alice", [], lateEvening),
  ).data;

  assert.equal(data.dateAdded, "2026-07-25");
});

test("new rating-only films carry their rating and liked state", () => {
  const item = parseLetterboxdFilms(watchedFilms)[0];
  const today = new Date("2026-07-25T12:00:00Z");
  const data = parseFrontmatter(
    renderNewEntry(item, "the-way-back", [], today),
  ).data;

  assert.equal(data.dateAdded, "2026-07-25");
  assert.equal(data.enjoyment, 8);
  assert.equal(data.favorite, true);
  assert.equal(data.status, undefined);
});

test("new films get their watched date and canonical Letterboxd link", () => {
  const item = parseLetterboxdFeed(feed)[0];
  const data = parseFrontmatter(
    renderNewEntry(item, "cmon-cmon", ["drama"]),
  ).data;

  assert.equal(data.dateAdded, "2026-07-22");
  assert.equal(data.url, "https://letterboxd.com/film/cmon-cmon/");
  assert.equal(data.letterboxdUrl, "https://letterboxd.com/film/cmon-cmon/");
  assert.equal(data.letterboxdYear, 2021);
  assert.equal(data.tmdbId, "632617");
  assert.equal(data.enjoyment, 7);
});

test("aggregate component activity never mutates the aggregate record", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "letterboxd-aggregate-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const booksDir = join(root, "books");
  mkdirSync(booksDir);
  const aggregatePath = join(booksDir, "divergent-series.md");
  const aggregate = `---
id: "divergent-series"
title: "Divergent series"
author: ""
category: fiction
dateAdded: ""
favorite: false
medium: movie
url: "https://example.com/divergent"
letterboxdUrl: "https://letterboxd.com/films/in/divergent-collection/"
tags:
  - "science fiction"
status: shelved
---
`;
  writeFileSync(aggregatePath, aggregate);
  const overridesPath = join(root, "overrides.json");
  writeFileSync(
    overridesPath,
    JSON.stringify({
      matches: {},
      aggregates: { divergent: "divergent-series" },
      exclude: [],
    }),
  );
  const divergentFeed = `<?xml version="1.0"?>
<rss xmlns:letterboxd="https://letterboxd.com" xmlns:tmdb="https://themoviedb.org">
  <channel>
    <item>
      <link>https://letterboxd.com/silentnovas/film/divergent/1/</link>
      <letterboxd:watchedDate>2026-07-26</letterboxd:watchedDate>
      <letterboxd:filmTitle>Divergent</letterboxd:filmTitle>
      <letterboxd:filmYear>2014</letterboxd:filmYear>
      <letterboxd:memberRating>4</letterboxd:memberRating>
      <letterboxd:memberLike>Yes</letterboxd:memberLike>
      <tmdb:movieId>157350</tmdb:movieId>
    </item>
  </channel>
</rss>`;

  const counts = await runLetterboxdSync({
    booksDir,
    feedUrl: textDataUrl(divergentFeed, "application/xml"),
    filmsUrl: textDataUrl("<html></html>"),
    watchlistUrl: textDataUrl("<html></html>"),
    overridesPath,
    genreFetcher: async () => {
      throw new Error("aggregate items must not fetch genres");
    },
  });

  assert.equal(counts.aggregated, 1);
  assert.equal(counts.created, 0);
  assert.equal(readFileSync(aggregatePath, "utf8"), aggregate);
});

test("malformed local overrides fail the sync", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "letterboxd-overrides-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const booksDir = join(root, "books");
  mkdirSync(booksDir);
  const overridesPath = join(root, "overrides.json");
  writeFileSync(overridesPath, "{not-json");

  await assert.rejects(
    runLetterboxdSync({
      booksDir,
      feedUrl: textDataUrl("<rss><channel></channel></rss>", "application/xml"),
      filmsUrl: textDataUrl("<html></html>"),
      watchlistUrl: textDataUrl("<html></html>"),
      overridesPath,
    }),
    SyntaxError,
  );
});

test("invalid source URLs are local configuration errors", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "letterboxd-invalid-url-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const booksDir = join(root, "books");
  mkdirSync(booksDir);
  const overridesPath = join(root, "overrides.json");
  writeFileSync(
    overridesPath,
    JSON.stringify({ matches: {}, aggregates: {}, exclude: [] }),
  );

  await assert.rejects(
    runLetterboxdSync({
      booksDir,
      feedUrl: "not a URL",
      filmsUrl: textDataUrl("<html></html>"),
      watchlistUrl: textDataUrl("<html></html>"),
      overridesPath,
    }),
    TypeError,
  );
});

test("an all-source remote outage remains a soft-failable typed error", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "letterboxd-outage-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const booksDir = join(root, "books");
  mkdirSync(booksDir);
  const overridesPath = join(root, "overrides.json");
  writeFileSync(
    overridesPath,
    JSON.stringify({ matches: {}, aggregates: {}, exclude: [] }),
  );

  await assert.rejects(
    runLetterboxdSync({
      booksDir,
      feedUrl: "http://127.0.0.1:1/rss",
      filmsUrl: "http://127.0.0.1:1/films",
      watchlistUrl: "http://127.0.0.1:1/watchlist",
      overridesPath,
    }),
    LetterboxdUnavailableError,
  );
});

test("CLI soft-fails only typed remote outages", async () => {
  const remoteResult = await runLetterboxdCli(async () => {
    throw new LetterboxdUnavailableError("remote outage");
  });
  assert.equal(remoteResult, null);

  await assert.rejects(
    runLetterboxdCli(async () => {
      throw new Error("local write failure");
    }),
    /local write failure/,
  );
});

function textDataUrl(text, type = "text/html") {
  return `data:${type},${encodeURIComponent(text)}`;
}
