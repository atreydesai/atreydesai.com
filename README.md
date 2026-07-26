# atreydesai.com

Source code for my [personal website](https://atreydesai.com/), hosted on Vercel.

## Bookshelf sources

The bookshelf treats external services as the source of truth:

- Goodreads for books
- [Letterboxd (`silentnovas`)](https://letterboxd.com/silentnovas/) for films
- [MyDramaList (`silentnovas`)](https://mydramalist.com/dramalist/silentnovas) for Asian dramas and shows

The production build pulls from those services before compiling the site. When
adding media, add it to the relevant service instead of hand-writing a bookshelf
entry; the next sync will import it.

Letterboxd uses the public profile's films pages for watched and rated films,
the public watchlist for shelved films, and RSS for diary dates and reviews.
Watchlist films remain untagged until watched; when they are promoted, up to
five exact Letterboxd genres are added unless the bookshelf already has
curated tags.
Run `npm run letterboxd:backfill` to attach canonical Letterboxd links to older
film records and `npm run letterboxd:export` to regenerate the one-time
watched/watchlist import files.
