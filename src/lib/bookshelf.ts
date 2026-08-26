// Shared bookshelf helpers. These live outside the route because the entry
// list and the detail panel both need them, and the detail panel is its own
// component so it can render either as the desktop sidebar or as a sheet on
// narrow screens.
import type { Book } from "$lib/content";

export function toList(value: string | string[] | undefined): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

export function bookTags(book: Book): string[] {
    return [...new Set([...(book.tags || []), ...toList(book.subcategory)])];
}

export function previewTags(book: Book): string[] {
    return bookTags(book).slice(0, 2);
}

export function tagOverflow(book: Book): number {
    return Math.max(0, bookTags(book).length - 2);
}

export function isCurrent(book: Book): boolean {
    return (
        book.status === "current" &&
        (book.medium === "book" || book.medium === "drama")
    );
}

export function currentStatusLabel(book: Book): string {
    return book.medium === "drama" ? "currently watching" : "currently reading";
}

export function getNoteParagraphs(book: Book): string[] {
    return (book.notes || book.content || "")
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
}

export function shortDate(date: string): string {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "--";

    return `${parsed.getMonth() + 1}.${parsed.getDate()}.${String(
        parsed.getFullYear(),
    ).slice(-2)}`;
}

export function getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
        science:
            "text-accent-dark dark:text-accent-light bg-accent/10 dark:bg-accent/15",
        advice: "text-ochre-dark dark:text-ochre-light bg-ochre/10 dark:bg-ochre-dark/20",
        fiction:
            "text-wine-dark dark:text-wine-light bg-wine/10 dark:bg-wine-dark/20",
        nonfiction:
            "text-steel-dark dark:text-steel-light bg-steel/10 dark:bg-steel-dark/20",
        "blog post":
            "text-plum-dark dark:text-plum-light bg-plum/10 dark:bg-plum-dark/20",
    };
    return colors[category] || "text-ink-600 dark:text-cream-300";
}

// What the two rating columns actually mean. Shown as a disclosure above the
// list as well as in the column tooltips, so the definitions don't depend on
// being able to hover.
export const ratingLegend = {
    enjoyment: {
        title: "Appreciation",
        body: "How much I personally liked it, independent of usefulness.",
    },
    importance: {
        title: "Importance",
        body: "How useful, influential, or worth remembering I found it.",
    },
} as const;
