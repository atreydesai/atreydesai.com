# atreydesai.com

Source code for my [personal website](https://atreydesai.com/), hosted on Vercel.

Use Node.js 26.12.1 (recorded in `.node-version`) and npm. The `engines.node`
field in `package.json` lists supported patched Node releases. Leave an active
Conda environment with `conda deactivate` before running the site.

```sh
npm ci          # install the committed dependency lock
npm run dev     # local dev server
npm run build   # sync the bookshelf, optimize photos, build
npm test        # node tests for the sync scripts, game engines, and agent endpoints
npm run check   # svelte-check
npm run og      # share cards for posts (needs `npm run dev` and Chrome)
npm run lab -- http://localhost:4173   # throttled-phone load metrics per page (needs `npm run preview` and Chrome)
node scripts/perf-runtime.mjs http://localhost:4173 --runs=5   # after load: idle CPU, tap/keypress latency, Back cache, render cost
```

## How it's served

Every page is prerendered: the build is the server. Vercel answers page
requests from static files, and only `/api/*` and the not-found fallback run as
functions. Each page also gets a Markdown twin at `…/index.md`, and the route
table (written by `src/lib/server/static-routes.js` after the adapter runs)
sends `Accept: text/markdown` requests to it. A page that reads the request
(its query string, headers, or cookies) fails the build; read those in the
browser instead.

Nothing holds a page's first paint but its HTML: each page carries its CSS
inline (`inlineStyleThreshold` in `vite.config.ts`), and the font services'
stylesheets (Typekit, Google Fonts) load without blocking, their fonts
swapping in when they arrive. `tests/render-blocking.test.mjs` fails if a
stylesheet starts blocking a page again.

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

The design system is documented in [docs/style-guide.md](docs/style-guide.md);
the boba arcade's games have their own
[docs/arcade-style-guide.md](docs/arcade-style-guide.md).
