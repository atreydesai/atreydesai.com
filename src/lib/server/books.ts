import type { Book } from '$lib/books';
import { validateFrontmatter } from '$lib/frontmatter';

// A book file's frontmatter as written, before the loader normalizes it.
type BookFrontmatter = Omit<Book, 'subcategory'> & {
    subcategory?: string | string[];
    letterboxdYear?: number;
    letterboxdId?: string;
    tmdbId?: string;
    tmdbType?: 'movie' | 'tv';
    content?: string;
};

// Each file's default export is its frontmatter plus the markdown body as
// `content`, as one plain object (the module namespace would also carry a
// `default` copy of everything into the page data).
const bookModules = import.meta.glob<BookFrontmatter>('/src/content/books/*.md', {
    eager: true,
    import: 'default',
});

export const books: Book[] = Object.entries(bookModules).map(([path, mod]) => {
    validateFrontmatter(path, mod, {
        id: 'string', title: 'string', author: 'string', category: 'string', dateAdded: 'string',
    });
    // The feed identities are only read by the sync scripts, and the body is
    // only a fallback for notes, so neither is sent to the page.
    const {
        subcategory, status, notes, content,
        letterboxdYear, letterboxdId, tmdbId, tmdbType,
        ...data
    } = mod;
    return {
        ...data,
        // Accepts an array or a comma-separated string.
        subcategory: Array.isArray(subcategory)
            ? subcategory
            : (subcategory ?? "").split(",").map((s) => s.trim()).filter(Boolean),
        status: status === 'shelved' || status === 'current' ? status : 'done',
        notes: notes || content || undefined,
    };
});
