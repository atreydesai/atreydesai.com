// Content loader utilities for markdown and YAML files

// Type definitions
export interface Paper {
    id: string;
    title: string;
    authors: string[];
    year: number;
    venue: string;
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
    content?: string;
}

export interface Book {
    id: string;
    title: string;
    author: string;
    category: string;
    subcategory?: string | null;
    enjoyment: number;
    importance: number;
    dateAdded: string;
    favorite: boolean;
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

export interface Affiliations {
    name: string;
    title: string;
    school: string;
    program: string;
    year: string;
    advisors: Array<{ name: string; url?: string }>;
    currentRole?: {
        organization: string;
        role: string;
        url: string;
    };
    researchInterests: string[];
    priorExperience: Array<{ name: string; organization?: string; role?: string }>;
    mentors: Array<{ name: string; affiliation: string }>;
    location: {
        hometown: string;
        current: string;
    };
    personal: {
        description: string;
        interests: string[];
        blogs: Array<{ name: string; url: string }>;
    };
    social: {
        github: string;
        twitter: string;
        scholar: string;
        email: string;
    };
}

// Import all paper markdown files
const paperModules = import.meta.glob<Paper>('/src/content/papers/*.md', { eager: true });
export const papers: Paper[] = Object.values(paperModules)
    .map((mod) => mod as unknown as Paper)
    .sort((a, b) => b.year - a.year);

// Import all book markdown files
const bookModules = import.meta.glob<Book>('/src/content/books/*.md', { eager: true });
export const books: Book[] = Object.values(bookModules)
    .map((mod) => {
        const data = mod as unknown as Book;
        // Spread to create a mutable copy, use content as notes if notes not set
        return {
            ...data,
            notes: data.notes || data.content || undefined
        };
    });

// Import YAML files
import affiliationsYaml from '../content/affiliations.yaml';
import talksYaml from '../content/talks.yaml';
import categoriesYaml from '../content/categories.yaml';

export const affiliations: Affiliations = affiliationsYaml as Affiliations;
export const talks: Talk[] = talksYaml as Talk[];
export const categories: Category[] = categoriesYaml as Category[];

// Helper to get papers data in the old format (for compatibility)
export const papersData = {
    papers,
    talks
};

// Helper to get books data in the old format (for compatibility)
export const booksData = {
    books,
    categories
};
