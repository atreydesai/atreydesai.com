# Repository instructions

## Bookshelf media workflow

External services are the source of truth for bookshelf media. If the user asks
to add a movie, show, drama, or book, do not create a hand-written entry in
`src/content/books/`. Give the user the matching link on the service the site can
sync from so they can add it there:

- Movies: Letterboxd profile `silentnovas`
- Asian dramas/shows: MyDramaList profile `silentnovas`
- Books: Goodreads

After the user adds the item to the appropriate service, use or rely on the
existing bookshelf sync. If a title is not carried by a supported service,
explain that limitation instead of silently creating a local record.

## Photography workflow

Photo originals live in `photos/` (never in `static/`, where they would be
copied into every Vercel deployment and fill its storage). The site displays
WebP/AVIF renditions that the build makes from them, and the "Download
original" link points at the Cloudflare R2 bucket `atreydesai-photos`
(`ORIGINALS_BASE` in `src/lib/photo-urls.js`).

Whenever a photo in `photos/` is added, replaced, or re-exported, run this
before committing and pushing:

```sh
npm run optimize-photos   # renditions + manifest
npm run upload-photos     # new or changed originals to R2 (needs `npx wrangler login` once)
```

The Vercel build cannot upload to R2, so a photo pushed without
`upload-photos` shows on the site but its download link is a 404. The script
only uploads files that are missing or a different size on R2, so rerunning it
is cheap. If Wrangler is signed out, ask the user to run `npx wrangler login`;
do not paste or ask for Cloudflare tokens.
