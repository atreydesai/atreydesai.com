import { dev } from '$app/environment';
import { validateFrontmatter } from '$lib/frontmatter';

// Content loader utilities for markdown and YAML files. Bookshelf entries are
// deliberately not here: every page that imports this module ships it, so they
// live in $lib/books (types) and $lib/server/books (the entries).

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
    awards: string[];
    preprint: boolean;
    featured: boolean;
    highlight: boolean;  // Special emphasis styling
    priority: number;    // Lower number = higher priority for featured ordering
    imageDescription: string | null;
    classProject?: boolean;  // Distinguishes class projects from regular papers
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

export interface Post {
    id: string;
    title: string;
    date: string;
    tags: string[];
    excerpt: string;
    published: boolean;
    unlisted?: boolean;
    content: string;
    externalUrl?: string;
    externalSite?: string;
}

export interface ResearchInterestCitation {
    label: string;
    url: string | null;
}

export interface ResearchInterestItem {
    title: string;
    summary: string;
    question: string;
    citations?: ResearchInterestCitation[];
}

export interface HomepageData {
    intro: string[];
    banner?: {
        lead: string;
        projects: string[];
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
        feedback: string;
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

// Import all post markdown files
const postModules = import.meta.glob<Post>('/src/content/posts/*.md', { eager: true });
const publishedPosts: Post[] = Object.entries(postModules)
    .map(([path, mod]) => {
        validateFrontmatter(path, mod, {
            id: 'string', title: 'string', date: 'string', excerpt: 'string', tags: 'array',
        });
        return mod as unknown as Post;
    })
    .filter((p) => p.published !== false)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

// Public discovery surfaces share this list; unlisted posts retain direct access.
export const posts: Post[] = publishedPosts.filter((post) => !post.unlisted);
export const unlistedPosts: Post[] = publishedPosts.filter((post) => post.unlisted);

// Drafts are available by direct URL in development, never in published listings.
export const draftPosts: Post[] = dev
    ? Object.values(postModules).filter((p) => p.published === false)
    : [];

// Import YAML files
import talksYaml from '../content/talks.yaml';
import aboutYaml from '../content/about.yaml';
import homepageYaml from '../content/homepage.yaml';

export const talks: Talk[] = talksYaml as unknown as Talk[];
export const aboutData: AboutData = aboutYaml as unknown as AboutData;
export const homepageData: HomepageData = homepageYaml as unknown as HomepageData;
