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
