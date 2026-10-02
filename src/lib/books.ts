// Bookshelf types and categories. Safe to import anywhere: the entries
// themselves are read on the server ($lib/server/books) and reach the browser
// only as /bookshelf page data, so no other page's bundle carries them.
import categoriesYaml from '../content/categories.yaml';

// One shelf entry as the page receives it. The files also record feed
// identities for the sync scripts (letterboxdYear, letterboxdId, tmdbId,
// tmdbType); the loader leaves those out because nothing here displays them.
export interface Book {
    id: string;
    title: string;
    author: string;
    category: string;
    subcategory: string[];      // Frontmatter may give a comma-separated string
    enjoyment?: number | null;  // 1-10 scale, optional
    importance?: number | null; // 1-10 scale, optional
    // "book", "movie", "drama", "show", "essay", "blog post", "article",
    // "report", "paper", "research paper", "chapter", "short story", "thread",
    // or "other"
    medium?: string;
    tags?: string[];            // For tag filtering
    quotes?: string[];          // Notable quotes from the work
    url?: string;               // Source link
    letterboxdUrl?: string;     // Canonical Letterboxd film/collection link
    dateAdded: string;
    favorite: boolean;
    status?: 'shelved' | 'current' | 'done'; // shelved = planned; current = reading/watching; absent = done
    notes?: string;
}

export interface Category {
    id: string;
    name: string;
}

export const categories: Category[] = categoriesYaml as unknown as Category[];
