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

No photo file is part of a Vercel deployment. Originals live in `photos/`
(never in `static/`, where they would be copied into every deployment and
fill its storage). Their WebP/AVIF renditions are encoded locally into
`node_modules/.cache/photo-renditions/`. Both are served from the Cloudflare R2
bucket `atreydesai-photos` at `https://photos.atreydesai.com` (originals at
the root, renditions under `thumbs/`; see `src/lib/photo-urls.js`).

Whenever a photo in `photos/` is added, replaced, or re-exported, run this
before committing and pushing:

```sh
npm run optimize-photos   # renditions + manifest
npm run upload-photos     # new or changed files to R2 (needs `npx wrangler login` once)
```

The Vercel build cannot upload to R2. It checks instead that the bucket holds
every file the manifest names, and fails the deploy if one is missing, so a
photo pushed without `upload-photos` stops the deploy rather than showing as a
broken image. The upload script lists the bucket and only uploads what is
missing or a different size, so rerunning it is cheap; it never deletes. If
Wrangler is signed out, ask the user to run `npx wrangler login`; do not paste
or ask for Cloudflare tokens.

DNS for atreydesai.com is on Cloudflare (moved from Vercel DNS). The site's
records (apex, `www`, `*`) must stay "DNS only", pointing at Vercel; only
`photos.atreydesai.com` (the R2 custom domain) goes through Cloudflare's proxy.
