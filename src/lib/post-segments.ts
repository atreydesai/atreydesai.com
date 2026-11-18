// A post's body as the page lays it out: rendered Markdown interleaved with the
// interactive pieces and images its source names in [[…]] markers. Worked out
// when the page is built (the post route's server load), so the browser gets
// the HTML and never downloads the Markdown parser.
import { marked } from "marked";
import { withMarks } from "#lib/marks.ts";

export type Segment =
    | { type: "html"; content: string }
    | { type: "shader"; variant: "mound" | "nebula" }
    | { type: "fruits" }
    | { type: "prose-diff" }
    | { type: "image"; src: string; caption: string; width?: number; height?: number };

const MARKER = /\[\[fruits\]\]|\[\[prose-diff\]\]|\[\[shader:(mound|nebula)\]\]|\[\[image:([^\]|]+)\|([^\]]+)\]\]/g;

export function postSegments(src: string): Segment[] {
    const out: Segment[] = [];
    const html = (markdown: string) => ({ type: "html" as const, content: withMarks(marked(markdown) as string) });
    let last = 0;
    for (const match of src.matchAll(MARKER)) {
        if (match.index > last) out.push(html(src.slice(last, match.index)));
        if (match[0] === "[[fruits]]") out.push({ type: "fruits" });
        else if (match[0] === "[[prose-diff]]") out.push({ type: "prose-diff" });
        else if (match[1]) out.push({ type: "shader", variant: match[1] as "mound" | "nebula" });
        else out.push({ type: "image", src: match[2], caption: match[3] });
        last = match.index + match[0].length;
    }
    if (last < src.length) out.push(html(src.slice(last)));
    return out;
}

export function readingTime(content: string): string {
    const words = content.trim().split(/\s+/).length;
    return `${Math.max(1, Math.round(words / 250))} min read`;
}
