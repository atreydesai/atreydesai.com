// Markdown for the pages whose content the HTML conversion can't reach: the
// bookshelf's rows and the photo tiles are <button>s (they open a detail
// panel or the lightbox), and the conversion drops buttons along with every
// other control. These are written from the same data the pages render.
// Served at /bookshelf/index.md and /photography/index.md, for
// `Accept: text/markdown`, and (briefer) in /llms-full.txt. A page added here
// also goes in MARKDOWN_PAGES in hooks.server.js.
import type { Book } from '#lib/books.ts';
import { categories } from '#lib/books.ts';
import { bookTags, getNoteParagraphs, ratingLegend } from '#lib/bookshelf.ts';
import photoManifest from '#lib/generated/photo-manifest.json';
import { originalUrl } from '#lib/photo-urls.js';
import { SITE_URL } from '#lib/seo.ts';
import { books } from '#lib/server/books.ts';

type Photo = {
    filename: string;
    alt: string;
    caption?: string;
    exif?: Partial<Record<'camera' | 'lens' | 'aperture' | 'shutter' | 'iso' | 'focalLength' | 'date', string>>;
};

/**
 * @param pathname a canonical page path
 * @param brief the short form, for llms-full.txt
 * @returns the page's Markdown (without the source footer), or null when the
 *   page is converted from its HTML instead
 */
export function pageMarkdown(pathname: string, { brief = false } = {}): string | null {
    if (pathname === '/bookshelf/') return bookshelf(brief);
    if (pathname === '/photography/') return photography(brief);
    return null;
}

// Titles and notes are plain text; keep them from turning into links or
// emphasis.
const esc = (text: string) => text.replace(/([\\`*_[\]<>])/g, '\\$1');
const categoryName = new Map(categories.map((c) => [c.id, c.name]));
const newestFirst = (a: Book, b: Book) => b.dateAdded.localeCompare(a.dateAdded);

function entry(book: Book, { notes = true } = {}): string {
    const href = book.url ?? book.letterboxdUrl;
    const title = href ? `[${esc(book.title)}](${href})` : `**${esc(book.title)}**`;
    const facts = [
        book.author ? `by ${esc(book.author)}` : '',
        book.medium ?? '',
        categoryName.get(book.category) ?? book.category,
        book.enjoyment ? `appreciation ${book.enjoyment}/10` : '',
        book.importance ? `importance ${book.importance}/10` : '',
        `added ${book.dateAdded}`,
    ].filter(Boolean);
    const tags = bookTags(book);
    if (tags.length) facts.push(`tags: ${tags.map(esc).join(', ')}`);
    let line = `- ${title}${book.favorite ? ' ★' : ''}: ${facts.join(' · ')}`;
    if (notes) {
        for (const paragraph of getNoteParagraphs(book)) line += `\n  > ${esc(paragraph).replace(/\n/g, '\n  > ')}`;
        for (const quote of book.quotes ?? []) line += `\n  > “${esc(quote)}”`;
    }
    return line;
}

function bookshelf(brief: boolean): string {
    const current = books.filter((b) => b.status === 'current').sort(newestFirst);
    const done = books.filter((b) => b.status !== 'shelved').sort(newestFirst);
    const shelved = books.filter((b) => b.status === 'shelved').sort(newestFirst);
    const favorites = books.filter((b) => b.favorite).sort(newestFirst);

    const parts = [
        '# bookshelf',
        `What I've read and watched, plus what I haven't gotten to yet: ${done.length} read and watched, ${shelved.length} shelved. Books sync from Goodreads, films from Letterboxd, and dramas and shows from MyDramaList; essays, papers, and posts are added by hand. Ratings are out of 10:`,
        `- **${ratingLegend.enjoyment.title}**: ${ratingLegend.enjoyment.body}\n- **${ratingLegend.importance.title}**: ${ratingLegend.importance.body}`,
        '★ marks a favorite. Quoted lines under an entry are my notes on it.',
    ];
    if (current.length) parts.push(`## Currently reading and watching (${current.length})`, current.map((b) => entry(b)).join('\n'));
    parts.push(`## Favorites (${favorites.length})`, favorites.map((b) => entry(b)).join('\n'));

    if (brief) {
        const recent = done.filter((b) => b.status !== 'current').slice(0, 15);
        parts.push(
            `## Recently read and watched`,
            recent.map((b) => entry(b, { notes: false })).join('\n'),
            `The full list of all ${done.length + shelved.length} entries, with notes, is at ${SITE_URL}/bookshelf/index.md.`,
        );
    } else {
        parts.push(
            `## Read and watched (${done.length})`,
            done.map((b) => entry(b)).join('\n'),
            `## Shelved (${shelved.length})`,
            'Planned, not yet read or watched.',
            shelved.map((b) => entry(b)).join('\n'),
        );
    }
    return parts.join('\n\n') + '\n';
}

function photography(brief: boolean): string {
    const photos = photoManifest as Photo[];
    const shown = brief ? photos.slice(0, 12) : photos;
    const lines = shown.map((photo) => {
        const e = photo.exif ?? {};
        const shot = [e.date, e.camera, e.focalLength, e.aperture, e.shutter && `${e.shutter} s`, e.iso].filter(Boolean);
        const label = photo.caption ? `**${esc(photo.caption)}**: ` : '';
        return `- ${label}${esc(photo.alt || 'Untitled photo')} (${shot.join(', ')}) [Full size](${SITE_URL}${originalUrl(photo)})`;
    });
    const parts = [
        '# photography',
        `${photos.length} photographs by Atrey Desai, newest first, each described in a sentence with its date, camera, and exposure. More on Instagram: [@framedbyatrey](https://instagram.com/framedbyatrey).`,
        lines.join('\n'),
    ];
    if (brief) parts.push(`All ${photos.length} photos are listed at ${SITE_URL}/photography/index.md.`);
    return parts.join('\n\n') + '\n';
}
