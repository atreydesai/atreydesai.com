// Content loader utilities for markdown and YAML files

// Type definitions
export interface Paper {
    id: string;
    title: string;
    authors: string[];
    year: number;
    venue: string | null;
    arxiv: string | null;
    pdf: string | null;
    code: string | null;
    demo: string | null;
    twitter: string | null;
    blog: string | null;
    tags: string[];
    tldr: string | null;
    abstract?: string;
    awards: string[];
    preprint: boolean;
    featured: boolean;
    highlight: boolean;  // Special emphasis styling
    priority: number;    // Lower number = higher priority for featured ordering
    image: string | null;
    imageAnimated: string | null;  // For hover effect - gif/mp4 version
    imageDescription: string | null;
    classProject?: boolean;  // Distinguishes class projects from regular papers
    content?: string;
}

export interface Book {
    id: string;
    title: string;
    author: string;
    category: string;
    subcategory?: string | string[];
    enjoyment?: number | null;  // 1-10 scale, optional
    importance?: number | null; // 1-10 scale, optional
    medium?: string;            // "essay", "book", "video", "article", "paper", "podcast", "short story"
    tags?: string[];            // For tag filtering
    quotes?: string[];          // Notable quotes from the work
    url?: string;               // Source link
    dateAdded: string;
    favorite: boolean;
    status?: 'shelved' | 'current' | 'done'; // shelved = planned; current = reading/watching; absent = done
    notes?: string;
    content?: string;
}

export interface Talk {
    id: string;
    title: string;
    venue: string;
    date: string;
    type: string;
    slides?: string | null;
    video?: string | null;
}

export interface Category {
    id: string;
    name: string;
}


export interface Post {
    id: string;
    title: string;
    date: string;
    tags: string[];
    excerpt: string;
    published: boolean;
    content: string;
}

export interface ResearchInterestCitation {
    label: string;
    url: string | null;
}

export interface ResearchInterestItem {
    text: string;
    citations?: ResearchInterestCitation[];
}

export interface HomepageData {
    intro: string[];
    banner?: {
        lead: string;
        body: string;
    };
    researchInterests: {
        intro: string;
        items: ResearchInterestItem[];
    };
    social: {
        github: string;
        twitter: string;
        scholar: string;
        email: string;
    };
}

export interface AboutData {
    footnotes: Array<{ id: number; content: string }>;
    professional: {
        intro: string;
        paragraphs: Array<{ text: string; footnote?: number }>;
    };
    personal: {
        descriptions: string[];
        interests: string;
        blogs: Array<{ name: string; url: string }>;
    };
    location: {
        text: string;
    };
    website: {
        inspiration: string;
        inspirationList: Array<{ name: string; url: string; description: string }>;
        builtWith: string;
    };
    thoughts: string[];
}

// Frontmatter validation: malformed content files should fail the build
// (these modules are imported by prerendered routes, so throwing here aborts
// `vite build` with the offending file named) instead of rendering broken.
type FieldType = 'string' | 'number' | 'array' | 'string|null';

function validateFrontmatter(path: string, mod: unknown, required: Record<string, FieldType>): void {
    const data = mod as Record<string, unknown>;
    for (const [field, type] of Object.entries(required)) {
        const value = data[field];
        const ok =
            type === 'array' ? Array.isArray(value)
            : type === 'string|null' ? value === null || typeof value === 'string'
            : typeof value === type;
        if (!ok) {
            throw new Error(`Invalid frontmatter in ${path}: "${field}" missing or not a ${type}`);
        }
    }
}

// Import all paper markdown files
const paperModules = import.meta.glob<Paper>('/src/content/papers/*.md', { eager: true });
export const papers: Paper[] = Object.entries(paperModules)
    .map(([path, mod]) => {
        validateFrontmatter(path, mod, {
            id: 'string', title: 'string', authors: 'array', year: 'number', venue: 'string|null',
        });
        return mod as unknown as Paper;
    })
    .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return (a.priority ?? 99) - (b.priority ?? 99);  // Secondary sort by priority (lower = higher priority)
    });

// Import all book markdown files
const bookModules = import.meta.glob<Book>('/src/content/books/*.md', { eager: true });
export const books: Book[] = Object.entries(bookModules).map(([path, mod]) => {
    validateFrontmatter(path, mod, {
        id: 'string', title: 'string', author: 'string', category: 'string', dateAdded: 'string',
    });
    const data = mod as unknown as Book;
    // Normalize subcategory to string[] (accepts an array or comma-separated string);
    // fall back to markdown content for notes when notes aren't set.
    const subcategory = Array.isArray(data.subcategory)
        ? data.subcategory
        : (data.subcategory ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return {
        ...data,
        subcategory,
        status: data.status === 'shelved' || data.status === 'current' ? data.status : 'done',
        notes: data.notes || data.content || undefined,
    };
});

// Import all post markdown files
const postModules = import.meta.glob<Post>('/src/content/posts/*.md', { eager: true });
export const posts: Post[] = Object.entries(postModules)
    .map(([path, mod]) => {
        validateFrontmatter(path, mod, {
            id: 'string', title: 'string', date: 'string', excerpt: 'string', tags: 'array',
        });
        return mod as unknown as Post;
    })
    .filter((p) => p.published !== false)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

// Import YAML files
import talksYaml from '../content/talks.yaml';
import categoriesYaml from '../content/categories.yaml';
import aboutYaml from '../content/about.yaml';
import homepageYaml from '../content/homepage.yaml';

export const talks: Talk[] = talksYaml as unknown as Talk[];
export const categories: Category[] = categoriesYaml as unknown as Category[];
export const aboutData: AboutData = aboutYaml as unknown as AboutData;
export const homepageData: HomepageData = homepageYaml as unknown as HomepageData;
